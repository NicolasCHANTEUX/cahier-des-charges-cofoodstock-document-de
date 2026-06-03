import { NextResponse } from "next/server";
import { ensureUserHousehold, resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mockInventory } from "@/lib/mock-data";
import { lookupOpenFoodFactsProduct } from "@/lib/open-food-facts";
import { proxiedOffImageUrl } from "@/lib/image-proxy";

type InventorySummaryRow = {
  household_id: string;
  product_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  barcode?: string | null;
  image_url: string | null;
  storage_area: string;
  nearest_expiration_date: string | null;
  total_quantity_remaining: number;
  unit: string;
};

export async function GET(req: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: true, inventory: mockInventory });
  }

  const context = await resolveAccountContext(req, supabase);
  let householdId = context.householdId;

  if (context.authenticated) {
    try {
      householdId = await ensureUserHousehold(supabase, context);
    } catch (error) {
      return NextResponse.json({ ok: false, message: "Unable to resolve household", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

    if (!householdId) {
      return NextResponse.json({ ok: true, inventory: [] });
    }
  }

  let query = supabase
    .from("active_inventory_summary")
    .select("household_id, product_id, name, brand, category, image_url, storage_area, nearest_expiration_date, total_quantity_remaining, unit")
    .order("nearest_expiration_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (householdId) {
    query = query.eq("household_id", householdId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json({ ok: true, inventory: mockInventory, warning: error?.message ?? "inventory_view_fallback" });
  }

  const rows = data as InventorySummaryRow[];

  const missingImageRows = rows.filter((row) => !row.image_url);
  const fallbackImageMap = new Map<string, string>();

  if (missingImageRows.length > 0) {
    const { data: productRows } = await supabase
      .from("products")
      .select("id, barcode, image_url")
      .in(
        "id",
        missingImageRows.map((row) => row.product_id)
      );

    const productIndex = new Map<string, { barcode?: string | null; image_url?: string | null }>();
    (productRows ?? []).forEach((product) => {
      productIndex.set(product.id, { barcode: product.barcode, image_url: product.image_url });
    });

    await Promise.all(
      missingImageRows.map(async (row) => {
        const product = productIndex.get(row.product_id);

        if (product?.image_url) {
          fallbackImageMap.set(row.product_id, product.image_url);
          return;
        }

        if (!product?.barcode) {
          return;
        }

        const offProduct = await lookupOpenFoodFactsProduct(product.barcode).catch(() => null);

        if (!offProduct?.imageUrl) {
          return;
        }

        fallbackImageMap.set(row.product_id, offProduct.imageUrl);

        await supabase
          .from("products")
          .update({ image_url: offProduct.imageUrl })
          .eq("id", row.product_id);
      })
    );
  }

  const inventory = rows.map((row) => ({
    id: row.product_id,
    name: row.name,
    icon: createIconLabel(row.name),
    imageUrl: proxiedOffImageUrl(row.image_url ?? fallbackImageMap.get(row.product_id) ?? undefined),
    quantity: Number(row.total_quantity_remaining),
    unit: normalizeUnit(row.unit),
    storageArea: normalizeStorageArea(row.storage_area),
    expirationDate: row.nearest_expiration_date ?? undefined,
    expirationLabel: formatExpirationLabel(row.nearest_expiration_date ?? undefined),
    dlcStatus: getExpirationStatus(row.nearest_expiration_date ?? undefined)
  }));

  return NextResponse.json({ ok: true, inventory });
}

function createIconLabel(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return compact || "PR";
}

function normalizeStorageArea(value: string): "fresh" | "frozen" | "dry" | "other" {
  if (value === "fresh" || value === "frozen" || value === "dry") {
    return value;
  }

  return "other";
}

function normalizeUnit(value: string) {
  if (value === "g" || value === "ml" || value === "pieces" || value === "portions" || value === "pots" || value === "paquets" || value === "bouteilles") {
    return value;
  }

  return "pieces";
}

function formatExpirationLabel(expirationDate?: string) {
  if (!expirationDate) {
    return undefined;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${expirationDate}T00:00:00`);
  const diffDays = Math.round((expiration.getTime() - today.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return "Expire aujourd'hui";
  }

  if (diffDays === 1) {
    return "Expire demain";
  }

  if (diffDays <= 3) {
    return `Expire dans ${diffDays} jours`;
  }

  const [year, month, day] = expirationDate.split("-");
  return `Expire le ${day}/${month}/${year}`;
}

function getExpirationStatus(expirationDate?: string) {
  if (!expirationDate) {
    return undefined;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${expirationDate}T00:00:00`);
  const diffDays = Math.round((expiration.getTime() - today.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return { label: "DLC aujourd'hui", tone: "red" as const };
  }

  if (diffDays === 1) {
    return { label: "DLC demain", tone: "orange" as const };
  }

  if (diffDays <= 3) {
    return { label: "DLC proche", tone: "orange" as const };
  }

  return undefined;
}
