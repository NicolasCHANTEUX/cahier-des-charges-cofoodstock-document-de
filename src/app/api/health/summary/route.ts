import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNumber(v: any) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (err) {
    // Supabase not configured — return a sensible mock
    return NextResponse.json({
      ok: true,
      macronutrients: { calories: 2100, protein_g: 75, carbs_g: 260, fat_g: 70 },
      freshnessRatio: { fresh: 72, processed: 28 },
      radar: { fruits: 80, vegetables: 78, starches: 60, dairy: 50, proteins: 70 },
      seasonalityScore: 85,
      warning: "supabase_not_configured"
    });
  }

  const householdId = req.headers.get("x-household-id") || process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID || process.env.DEMO_HOUSEHOLD_ID;

  // Compute since timestamp for last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1) Macronutrients from consumption movements in last 7 days
    const { data: movements } = await supabase
      .from("inventory_movements")
      .select(
        `product_id,quantity_delta,unit,created_at,products!inner(id,name,is_raw_fresh,is_seasonal,category,product_nutrition(per_unit,calories_kcal,protein_g,carbs_g,fat_g))`
      )
      .in("type", ["consume", "cook"]) // consider consume/cook as intake
      .gte("created_at", since)
      .maybeSingle();

    // Note: supabase .select with join on products returns an array; handle undefined
    const mac = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    if (Array.isArray(movements)) {
      for (const mv of movements) {
        const qty = safeNumber(mv.quantity_delta);
        const prod = (mv as any).products ?? null;
        const pn = prod?.product_nutrition?.[0] ?? null;

        if (pn) {
          // Parse per_unit, try to extract numeric base (e.g., '100g')
          let perUnitValue = 100;
          try {
            const match = String(pn.per_unit || "100").match(/(\d+(?:\.\d+)?)/);
            if (match) perUnitValue = Number(match[1]);
          } catch (e) {}

          const factor = perUnitValue > 0 ? qty / perUnitValue : 0;

          mac.calories += safeNumber(pn.calories_kcal) * factor;
          mac.protein_g += safeNumber(pn.protein_g) * factor;
          mac.carbs_g += safeNumber(pn.carbs_g) * factor;
          mac.fat_g += safeNumber(pn.fat_g) * factor;
        }
      }
    }

    // 2) Freshness ratio & seasonality & radar using active_inventory_summary
    const { data: inv } = await supabase
      .from("active_inventory_summary")
      .select("product_id,total_quantity_remaining,unit,product_id!inner(products(id,is_raw_fresh,is_seasonal,category,name))")
      .maybeSingle();

    // Fallback: if inv is not an array, fetch inventory_batches join products
    let inventoryRows: any[] = [];

    if (Array.isArray(inv)) {
      inventoryRows = inv;
    } else {
      const { data: batches } = await supabase
        .from("inventory_batches")
        .select("quantity_remaining,unit,products(id,is_raw_fresh,is_seasonal,category,name)")
        .eq("status", "active");

      if (Array.isArray(batches)) {
        inventoryRows = batches.map((b: any) => ({
          total_quantity_remaining: b.quantity_remaining,
          unit: b.unit,
          products: b.products
        }));
      }
    }

    let totalQty = 0;
    let freshQty = 0;
    let seasonalQty = 0;
    const radarBuckets: Record<string, number> = { fruits: 0, vegetables: 0, starches: 0, dairy: 0, proteins: 0 };

    for (const row of inventoryRows || []) {
      const qty = safeNumber(row.total_quantity_remaining ?? row.quantity_remaining ?? 0);
      const prod = row.products ?? row.product_id ?? null;

      totalQty += qty;

      if (prod?.is_raw_fresh) freshQty += qty;
      if (prod?.is_seasonal) seasonalQty += qty;

      const cat = (prod?.category || "").toLowerCase();
      if (cat.includes("fruit")) radarBuckets.fruits += qty;
      else if (cat.includes("légume") || cat.includes("legume") || cat.includes("veget")) radarBuckets.vegetables += qty;
      else if (cat.includes("féculent") || cat.includes("feculent") || cat.includes("pâtes") || cat.includes("pates") || cat.includes("riz")) radarBuckets.starches += qty;
      else if (cat.includes("lait") || cat.includes("yaourt") || cat.includes("fromage")) radarBuckets.dairy += qty;
      else radarBuckets.proteins += qty;
    }

    const freshnessRatio = totalQty > 0 ? { fresh: Math.round((freshQty / totalQty) * 100), processed: Math.round(((totalQty - freshQty) / totalQty) * 100) } : { fresh: 0, processed: 0 };
    const seasonalityScore = totalQty > 0 ? Math.round((seasonalQty / totalQty) * 100) : 0;

    // Normalize radar values to 0-100 scale by finding max and scaling
    const maxRadar = Math.max(...Object.values(radarBuckets), 1);
    const radar = Object.fromEntries(Object.entries(radarBuckets).map(([k, v]) => [k, Math.round((v / maxRadar) * 100)]));

    return NextResponse.json({
      ok: true,
      macronutrients: {
        calories: Math.round(mac.calories),
        protein_g: Math.round(mac.protein_g),
        carbs_g: Math.round(mac.carbs_g),
        fat_g: Math.round(mac.fat_g)
      },
      freshnessRatio,
      radar,
      seasonalityScore
    });
  } catch (e: any) {
    console.error("health summary error:", e?.message ?? e);
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}
