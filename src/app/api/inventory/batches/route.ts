import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildActivityEventInsert } from "@/lib/activity-events";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ ok: false, message: "Payload JSON required" }, { status: 400 });
  }

  const { product = {}, quantity, unit, storageArea, expirationDate, notes } = payload as any;

  if (!product || !product.name || !quantity || Number(quantity) <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (err) {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  // Ensure we have a household: prefer header, then env, otherwise create a demo household
  let householdId = req.headers.get("x-household-id") || process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID || process.env.DEMO_HOUSEHOLD_ID;

  if (!householdId) {
    const { data: created, error: createErr } = await supabase
      .from("households")
      .insert({ name: "Demo household" })
      .select("id")
      .maybeSingle();

    if (createErr || !created) {
      console.error("create household error:", createErr);

      const msg = createErr?.message ?? String(createErr);

      // If the DB schema is not applied (tables missing), fallback to a simulated demo response
      const lower = msg?.toLowerCase() ?? "";
      if (
        lower.includes("could not find the table") ||
        lower.includes("relation \"households\" does not exist") ||
        lower.includes("households") && lower.includes("schema") ||
        lower.includes("schema cache") ||
        lower.includes("does not exist")
      ) {
        const fakeHouseholdId = `household-fake-${Date.now()}`;
        const fakeBatchId = `batch-fake-${Date.now()}`;
        const fakeMovementId = `movement-fake-${Date.now()}`;

        const fakeBatch = {
          id: fakeBatchId,
          household_id: fakeHouseholdId,
          product_id: product.id ?? `product-fake-${Date.now()}`,
          quantity_initial: quantity,
          quantity_remaining: quantity,
          unit: unit ?? "unit",
          storage_area: storageArea ?? "other",
          expiration_date: expirationDate ?? null,
          notes: notes ?? null,
          source: "scan",
          created_at: new Date().toISOString()
        };

        const fakeMovement = {
          id: fakeMovementId,
          household_id: fakeHouseholdId,
          inventory_batch_id: fakeBatchId,
          product_id: fakeBatch.product_id,
          type: "add",
          quantity_delta: quantity,
          unit: unit ?? "unit",
          reason: "Ajout depuis scan",
          metadata: { source: "scan" },
          created_at: new Date().toISOString()
        };

        return NextResponse.json({ ok: true, batch: fakeBatch, movement: fakeMovement, product: { id: product.id ?? fakeBatch.product_id, name: product.name }, warning: "db_schema_missing" });
      }

      return NextResponse.json({ ok: false, message: "Unable to create demo household", error: createErr?.message ?? createErr }, { status: 500 });
    }

    householdId = created.id;
  }

  // Upsert product into catalog (by barcode if provided)
  let productId: string | undefined = product.id;

  if (!productId) {
    const upsertPayload: any = {
      name: product.name,
      brand: product.brand ?? null,
      category: product.category ?? null,
      image_url: product.imageUrl ?? null,
      source: product.source ?? "manual",
      default_storage_area: product.default_storage_area ?? "other",
      default_unit: product.default_unit ?? (product.quantityText ? "unit" : "unit")
    };

    if (product.barcode) {
      upsertPayload.barcode = product.barcode;
    }

    const { data: storedProduct, error: upsertError } = await supabase
      .from("products")
      .upsert(upsertPayload, product.barcode ? { onConflict: "barcode" } : undefined)
      .select("id, barcode, name")
      .maybeSingle();

    if (upsertError) {
      return NextResponse.json({ ok: false, message: "Unable to upsert product", error: upsertError }, { status: 500 });
    }

    productId = storedProduct?.id;
  }

  if (!productId) {
    return NextResponse.json({ ok: false, message: "Could not determine product id" }, { status: 500 });
  }

  // Create inventory batch
  const batchInsert = {
    household_id: householdId,
    product_id: productId,
    quantity_initial: quantity,
    quantity_remaining: quantity,
    unit: unit ?? "unit",
    storage_area: storageArea ?? "other",
    expiration_date: expirationDate ?? null,
    notes: notes ?? null,
    source: "scan"
  };

  const { data: batch, error: batchError } = await supabase
    .from("inventory_batches")
    .insert(batchInsert)
    .select()
    .maybeSingle();

  if (batchError || !batch) {
    return NextResponse.json({ ok: false, message: "Unable to create inventory batch", error: batchError }, { status: 500 });
  }

  // Record inventory movement
  const movementInsert = {
    household_id: householdId,
    inventory_batch_id: batch.id,
    product_id: productId,
    type: "add",
    quantity_delta: quantity,
    unit: unit ?? "unit",
    reason: "Ajout depuis scan",
    metadata: { source: "scan" }
  } as any;

  const { data: movement, error: movementError } = await supabase
    .from("inventory_movements")
    .insert(movementInsert)
    .select()
    .maybeSingle();

  if (movementError || !movement) {
    return NextResponse.json({ ok: false, message: "Batch created but unable to record movement", batch, error: movementError }, { status: 500 });
  }

  const { data: activityEvent, error: activityError } = await supabase
    .from("activity_events")
    .insert(
      buildActivityEventInsert({
        household_id: householdId || batch.household_id,
        type: "product_added",
        title: `+${quantity} ${product.name} ajoute au stock`,
        description: `${quantity} ${unit ?? "unit"} - ajout via scan`,
        product_id: productId,
        can_undo: false,
        metadata: {
          source: "scan",
          inventory_batch_id: batch.id,
          inventory_movement_id: movement.id
        }
      })
    )
    .select("id")
    .maybeSingle();

  if (!activityError && activityEvent) {
    await supabase
      .from("inventory_movements")
      .update({ activity_event_id: activityEvent.id })
      .eq("id", movement.id);
  }

  return NextResponse.json({ ok: true, batch, movement, product: { id: productId, name: product.name } });
}
