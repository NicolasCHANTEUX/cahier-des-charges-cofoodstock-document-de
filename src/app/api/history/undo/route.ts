import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildActivityEventInsert } from "@/lib/activity-events";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);

  if (!payload || !payload.eventId) {
    return NextResponse.json({ ok: false, message: "eventId required" }, { status: 400 });
  }

  const eventId = String(payload.eventId);

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const context = await resolveAccountContext(req, supabase);

  // fetch the activity event
  const { data: evRow, error: evErr } = await supabase.from("activity_events").select("id, household_id, type, title, can_undo, undone_at, metadata").eq("id", eventId).maybeSingle();

  if (evErr || !evRow) {
    return NextResponse.json({ ok: false, message: "Event not found" }, { status: 404 });
  }

  if (!evRow.can_undo) {
    return NextResponse.json({ ok: false, message: "Event cannot be undone" }, { status: 400 });
  }

  if (context.householdId && evRow.household_id !== context.householdId) {
    return NextResponse.json({ ok: false, message: "Event not found" }, { status: 404 });
  }

  if (evRow.undone_at) {
    return NextResponse.json({ ok: false, message: "Event already undone" }, { status: 400 });
  }

  const metadata = (evRow.metadata ?? {}) as Record<string, unknown>;
  const isSettingsUndo = metadata.section === "settings";

  // find related inventory movements (not required for settings events)
  const { data: movements, error: mvErr } = await supabase.from("inventory_movements").select("*").eq("activity_event_id", eventId);

  if (!isSettingsUndo && mvErr) {
    return NextResponse.json({ ok: false, message: "Unable to fetch movements", error: mvErr.message }, { status: 500 });
  }

  // create undo activity event
  const { data: undoEvent, error: undoEventErr } = await supabase
    .from("activity_events")
    .insert(
      buildActivityEventInsert({
        household_id: evRow.household_id,
        type: "undo",
        title: `Action annulée: ${evRow.title}`,
        description: `Annulation de l'action ${evRow.title}`,
        can_undo: false,
        metadata: { undo_of_event_id: eventId }
      })
    )
    .select("id")
    .maybeSingle();

  if (undoEventErr || !undoEvent) {
    return NextResponse.json({ ok: false, message: "Unable to create undo event", error: undoEventErr?.message }, { status: 500 });
  }

  const undoEventId = undoEvent.id;

  const createdUndoMovements: any[] = [];

  for (const mv of movements ?? []) {
    try {
      // compute inverse
      const inverse = -Number(mv.quantity_delta);

      // try to restore batch quantity if batch known
      const batchId = mv.inventory_batch_id ?? (mv.metadata && mv.metadata.inventory_batch_id ? mv.metadata.inventory_batch_id : null);

      let effectiveBatchId = null;
      if (batchId) {
        // fetch current batch
        const { data: batchRow } = await supabase.from("inventory_batches").select("id, quantity_remaining, status").eq("id", batchId).maybeSingle();
        if (batchRow) {
          const currentQty = Number(batchRow.quantity_remaining ?? 0);
          const newQty = currentQty + inverse;
          const updatePayload: Record<string, unknown> = { quantity_remaining: newQty };
          if (newQty > 0 && batchRow.status !== "active") {
            updatePayload.status = "active";
          }
          await supabase.from("inventory_batches").update(updatePayload).eq("id", batchId);
          effectiveBatchId = batchRow.id;
        }
      }

      // if no batch found, attempt to recreate one using movement data
      if (!effectiveBatchId) {
        if (mv.product_id) {
          const createdQty = inverse > 0 ? inverse : Math.abs(inverse);
          const insertPayload: Record<string, unknown> = {
            household_id: mv.household_id || evRow.household_id,
            product_id: mv.product_id,
            quantity_initial: createdQty,
            quantity_remaining: createdQty,
            unit: mv.unit || "unit",
            storage_area: (mv.storage_area as string) || "other",
            status: "active",
            source: "undo_recreated",
            added_by: mv.user_id ?? null
          };

          const { data: createdBatch, error: createBatchErr } = await supabase.from("inventory_batches").insert(insertPayload).select("id").maybeSingle();
          if (createBatchErr) {
            // log error but continue
            createdUndoMovements.push({ ok: false, movementId: mv.id, error: createBatchErr.message });
          } else if (createdBatch && createdBatch.id) {
            effectiveBatchId = createdBatch.id;
          }
        }
      }

      // insert inverse movement referencing original movement
      const { data: insertedMv, error: insertMvErr } = await supabase.from("inventory_movements").insert({
        household_id: mv.household_id,
        inventory_batch_id: effectiveBatchId ?? mv.inventory_batch_id,
        product_id: mv.product_id,
        user_id: mv.user_id,
        type: "undo",
        quantity_delta: inverse,
        unit: mv.unit,
        reason: `Undo of movement ${mv.id}`,
        activity_event_id: undoEventId,
        undo_of_movement_id: mv.id,
        metadata: { undo_of_activity_event: eventId }
      }).select().maybeSingle();

      if (insertMvErr) {
        // continue but record error
        createdUndoMovements.push({ ok: false, movementId: mv.id, error: insertMvErr.message });
      } else {
        createdUndoMovements.push({ ok: true, originalMovement: mv.id, undoMovement: insertedMv?.id });
      }
    } catch (e) {
      createdUndoMovements.push({ ok: false, movementId: mv.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // mark original activity as undone
  await supabase.from("activity_events").update({ undone_at: new Date().toISOString(), can_undo: false }).eq("id", eventId);

  const restoredSettingsProfile = isSettingsUndo && typeof metadata.previous_profile === "object"
    ? (metadata.previous_profile as Record<string, unknown>)
    : null;

  return NextResponse.json({
    ok: true,
    undoneEventId: undoEventId,
    movements: createdUndoMovements,
    restoredSettingsProfile
  });
}
