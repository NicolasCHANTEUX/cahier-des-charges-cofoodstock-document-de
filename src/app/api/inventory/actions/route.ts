import { NextResponse } from "next/server";
import { z } from "zod";
import { buildActivityEventInsert } from "@/lib/activity-events";
import { requireHouseholdAccess } from "@/lib/supabase/household-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeQuantityUnit } from "@/lib/units";

type InventoryAction = "consume" | "waste" | "adjust";

type ActiveBatchRow = {
  id: string;
  household_id: string;
  product_id: string;
  quantity_remaining: number;
  unit: string;
  status: string;
  expiration_date: string | null;
  storage_area: string;
};

type RollbackBatchState = {
  id: string;
  quantity_remaining: number;
  status: string;
};

const quantityUnitSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return normalizeQuantityUnit(value);
  },
  z.enum(["g", "ml", "pieces", "portions", "pots", "paquets", "bouteilles"]).optional()
);

const inventoryActionSchema = z.object({
  productId: z.string().trim().min(1),
  action: z.enum(["consume", "waste", "adjust"]),
  quantity: z.coerce.number().positive(),
  householdId: z.string().trim().optional(),
  storageArea: z.enum(["fresh", "frozen", "dry", "other"]).optional(),
  unit: quantityUnitSchema
});

export async function POST(req: Request) {
  const rawPayload = await req.json().catch(() => null);
  const parsedPayload = inventoryActionSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid payload", errors: parsedPayload.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const payload = parsedPayload.data;
  const access = await requireHouseholdAccess(req, {
    allowDemo: true,
    requireAuth: false,
    requestedHouseholdId: payload.householdId
  });

  if (!access.ok) {
    return access.response;
  }

  const { context, householdId, supabase } = access;
  const productId = extractProductId(payload.productId);
  const batches = await loadMatchingBatches(supabase, {
    householdId,
    productId,
    storageArea: payload.storageArea,
    unit: payload.unit
  });

  if (batches.error || batches.rows.length === 0) {
    return NextResponse.json(
      { ok: false, message: "No active batch found for this product", error: batches.error?.message },
      { status: 404 }
    );
  }

  const totalAvailable = batches.rows.reduce((sum, batch) => sum + Number(batch.quantity_remaining), 0);

  if (payload.quantity > totalAvailable) {
    return NextResponse.json(
      {
        ok: false,
        message: "Requested quantity is greater than available stock",
        availableQuantity: totalAvailable
      },
      { status: 409 }
    );
  }

  const { data: productRow } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle<{ name: string }>();

  const movementType = getMovementType(payload.action);
  const productName = productRow?.name ?? productId;
  const firstUnit = payload.unit ?? normalizeQuantityUnit(batches.rows[0]?.unit);
  const eventText = getActionText(payload.action);

  const { data: activityEvent, error: activityError } = await supabase
    .from("activity_events")
    .insert(
      buildActivityEventInsert({
        household_id: householdId,
        user_id: context.appUserId ?? null,
        type:
          movementType === "waste"
            ? "product_wasted"
            : movementType === "adjust"
              ? "product_adjusted"
              : "product_consumed",
        title: `${productName} ${eventText.titleSuffix}`,
        description: `${payload.quantity} ${firstUnit} ${eventText.descriptionSuffix}`,
        product_id: productId,
        can_undo: true,
        metadata: {
          source: "inventory_action",
          action: payload.action,
          requested_quantity: payload.quantity,
          storage_area: payload.storageArea ?? null,
          unit: payload.unit ?? null,
          inventory_movement_pending: true
        }
      })
    )
    .select("id")
    .maybeSingle<{ id: string }>();

  if (activityError || !activityEvent?.id) {
    return NextResponse.json({ ok: false, message: "Unable to record activity", error: activityError?.message }, { status: 500 });
  }

  const rollbackBatchStates: RollbackBatchState[] = [];
  const insertedMovementIds: string[] = [];
  const updatedBatches: ActiveBatchRow[] = [];
  const movements: unknown[] = [];
  let remainingToApply = payload.quantity;

  for (const batch of batches.rows) {
    if (remainingToApply <= 0) {
      break;
    }

    const batchQuantity = Number(batch.quantity_remaining);
    const appliedQuantity = Math.min(remainingToApply, batchQuantity);

    if (appliedQuantity <= 0) {
      continue;
    }

    const nextRemaining = roundQuantity(batchQuantity - appliedQuantity);
    const updatePayload: Record<string, unknown> = {
      quantity_remaining: nextRemaining
    };

    if (nextRemaining === 0) {
      updatePayload.status =
        payload.action === "waste" ? "wasted" : payload.action === "consume" ? "consumed" : "removed";
    }

    const { data: updatedBatch, error: updateError } = await supabase
      .from("inventory_batches")
      .update(updatePayload)
      .eq("id", batch.id)
      .select("id, household_id, product_id, quantity_remaining, unit, status, expiration_date, storage_area")
      .maybeSingle<ActiveBatchRow>();

    if (updateError || !updatedBatch) {
      const rollbackErrors = await rollbackInventoryAction(supabase, rollbackBatchStates, insertedMovementIds, activityEvent.id);
      return NextResponse.json(
        { ok: false, message: "Unable to update batch", error: updateError?.message, rollbackErrors },
        { status: 500 }
      );
    }

    rollbackBatchStates.push({
      id: batch.id,
      quantity_remaining: batchQuantity,
      status: batch.status
    });
    updatedBatches.push(updatedBatch);

    const { data: movement, error: movementError } = await supabase
      .from("inventory_movements")
      .insert({
        household_id: householdId,
        user_id: context.appUserId ?? null,
        inventory_batch_id: batch.id,
        product_id: productId,
        type: movementType,
        quantity_delta: -appliedQuantity,
        unit: batch.unit,
        reason: eventText.reason,
        activity_event_id: activityEvent.id,
        metadata: {
          source: "inventory_action",
          action: payload.action,
          activity_event_id: activityEvent.id
        }
      })
      .select()
      .maybeSingle<{ id: string }>();

    if (movementError || !movement) {
      const rollbackErrors = await rollbackInventoryAction(supabase, rollbackBatchStates, insertedMovementIds, activityEvent.id);
      return NextResponse.json(
        {
          ok: false,
          message: "Batch updated but movement not recorded",
          error: movementError?.message,
          rollbackErrors
        },
        { status: 500 }
      );
    }

    insertedMovementIds.push(movement.id);
    movements.push(movement);
    remainingToApply = roundQuantity(remainingToApply - appliedQuantity);
  }

  if (remainingToApply > 0) {
    const rollbackErrors = await rollbackInventoryAction(supabase, rollbackBatchStates, insertedMovementIds, activityEvent.id);
    return NextResponse.json(
      { ok: false, message: "Unable to apply the full quantity", remainingQuantity: remainingToApply, rollbackErrors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    batches: updatedBatches,
    movements,
    appliedQuantity: payload.quantity,
    activityEventId: activityEvent.id
  });
}

async function loadMatchingBatches(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  options: {
    householdId: string;
    productId: string;
    storageArea?: string;
    unit?: string;
  }
) {
  let query = supabase
    .from("inventory_batches")
    .select("id, household_id, product_id, quantity_remaining, unit, status, expiration_date, storage_area")
    .eq("product_id", options.productId)
    .eq("household_id", options.householdId)
    .eq("status", "active")
    .gt("quantity_remaining", 0);

  if (options.storageArea) {
    query = query.eq("storage_area", options.storageArea);
  }

  if (options.unit) {
    query = query.eq("unit", options.unit);
  }

  const { data, error } = await query
    .order("expiration_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .returns<ActiveBatchRow[]>();

  return { rows: data ?? [], error };
}

async function rollbackInventoryAction(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  batchStates: RollbackBatchState[],
  movementIds: string[],
  activityEventId: string
) {
  const errors: string[] = [];

  if (movementIds.length > 0) {
    const { error } = await supabase.from("inventory_movements").delete().in("id", movementIds);
    if (error) {
      errors.push(`inventory_movements: ${error.message}`);
    }
  }

  for (const state of batchStates.reverse()) {
    const { error } = await supabase
      .from("inventory_batches")
      .update({
        quantity_remaining: state.quantity_remaining,
        status: state.status
      })
      .eq("id", state.id);

    if (error) {
      errors.push(`inventory_batches ${state.id}: ${error.message}`);
    }
  }

  const { error } = await supabase.from("activity_events").delete().eq("id", activityEventId);
  if (error) {
    errors.push(`activity_events: ${error.message}`);
  }

  return errors;
}

function extractProductId(value: string) {
  return value.includes(":") ? value.split(":")[0] : value;
}

function getMovementType(action: InventoryAction) {
  if (action === "waste") {
    return "waste";
  }

  if (action === "adjust") {
    return "adjust";
  }

  return "consume";
}

function getActionText(action: InventoryAction) {
  if (action === "waste") {
    return {
      titleSuffix: "jeté",
      descriptionSuffix: "sorti du stock",
      reason: "Sortie du stock (jeté)"
    };
  }

  if (action === "adjust") {
    return {
      titleSuffix: "ajusté",
      descriptionSuffix: "ajusté manuellement",
      reason: "Ajustement manuel"
    };
  }

  return {
    titleSuffix: "consommé",
    descriptionSuffix: "retiré du stock",
    reason: "Sortie du stock (consommé)"
  };
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}
