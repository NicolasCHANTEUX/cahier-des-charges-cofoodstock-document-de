import { NextResponse } from "next/server";
import { buildActivityEventInsert } from "@/lib/activity-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ ok: false, message: "Payload JSON required" }, { status: 400 });
  }

  const productId = String(payload.productId ?? "");
  const action = String(payload.action ?? "") as InventoryAction;
  const quantity = Number(payload.quantity);
  const householdId = String(payload.householdId ?? process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ?? process.env.DEMO_HOUSEHOLD_ID ?? "");

  if (!productId || !["consume", "waste", "adjust"].includes(action) || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const { data: batch, error: batchError } = await supabase
    .from("inventory_batches")
    .select("id, household_id, product_id, quantity_remaining, unit, status, expiration_date, storage_area")
    .eq("product_id", productId)
    .eq("status", "active")
    .gt("quantity_remaining", 0)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<ActiveBatchRow>();

  if (batchError || !batch) {
    return NextResponse.json({ ok: false, message: "No active batch found for this product", error: batchError?.message }, { status: 404 });
  }

  const { data: productRow } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle<{ name: string }>();

  const appliedQuantity = Math.min(quantity, Number(batch.quantity_remaining));

  if (appliedQuantity <= 0) {
    return NextResponse.json({ ok: false, message: "Nothing left to update" }, { status: 400 });
  }

  const nextRemaining = action === "adjust" ? Number(batch.quantity_remaining) - appliedQuantity : Number(batch.quantity_remaining) - appliedQuantity;

  const updatePayload: Record<string, unknown> = {
    quantity_remaining: Math.max(nextRemaining, 0)
  };

  if (Math.max(nextRemaining, 0) === 0) {
    updatePayload.status = action === "waste" ? "wasted" : "consumed";
  }

  const { data: updatedBatch, error: updateError } = await supabase
    .from("inventory_batches")
    .update(updatePayload)
    .eq("id", batch.id)
    .select("id, household_id, product_id, quantity_remaining, unit, status, expiration_date, storage_area")
    .maybeSingle<ActiveBatchRow>();

  if (updateError || !updatedBatch) {
    return NextResponse.json({ ok: false, message: "Unable to update batch", error: updateError?.message }, { status: 500 });
  }

  const movementType = action === "waste" ? "waste" : action === "adjust" ? "adjust" : "consume";

  const { data: activityEvent, error: activityError } = await supabase
    .from("activity_events")
    .insert(
      buildActivityEventInsert({
        household_id: householdId || batch.household_id,
        type: movementType === "waste" ? "product_wasted" : movementType === "adjust" ? "product_adjusted" : "product_consumed",
        title:
          movementType === "waste"
            ? `${productRow?.name ?? batch.product_id} jete`
            : movementType === "adjust"
              ? `${productRow?.name ?? batch.product_id} ajuste`
              : `${productRow?.name ?? batch.product_id} consomme`,
        description:
          movementType === "waste"
            ? `${appliedQuantity} ${batch.unit} sorti du stock`
            : movementType === "adjust"
              ? `${appliedQuantity} ${batch.unit} ajuste manuellement`
              : `${appliedQuantity} ${batch.unit} retire du stock`,
        product_id: productId,
        can_undo: true,
        metadata: {
          source: "inventory_action",
          action,
          inventory_batch_id: batch.id,
          inventory_movement_pending: true
        }
      })
    )
    .select("id")
    .maybeSingle();

  const { data: movement, error: movementError } = await supabase
    .from("inventory_movements")
    .insert({
      household_id: householdId || batch.household_id,
      inventory_batch_id: batch.id,
      product_id: productId,
      type: movementType,
      quantity_delta: -appliedQuantity,
      unit: batch.unit,
      reason: action === "waste" ? "Sortie du stock (jeté)" : action === "adjust" ? "Ajustement manuel" : "Sortie du stock (consommé)",
      activity_event_id: activityEvent?.id ?? null,
      metadata: { source: "inventory_action", action, activity_event_id: activityEvent?.id ?? null }
    })
    .select()
    .maybeSingle();

  if (movementError || !movement) {
    return NextResponse.json({ ok: false, message: "Batch updated but movement not recorded", error: movementError?.message }, { status: 500 });
  }

  if (!activityError && activityEvent && !movement.activity_event_id) {
    await supabase
      .from("inventory_movements")
      .update({ activity_event_id: activityEvent.id })
      .eq("id", movement.id);
  }

  return NextResponse.json({ ok: true, batch: updatedBatch, movement });
}
