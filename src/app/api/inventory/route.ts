import { NextResponse } from "next/server";
import { canUseDemoMode } from "@/lib/supabase/account-context";
import { requireHouseholdAccess } from "@/lib/supabase/household-access";
import { mockInventory } from "@/lib/mock-data";
import { proxiedOffImageUrl } from "@/lib/image-proxy";
import { normalizeQuantityUnit } from "@/lib/units";

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
  const access = await requireHouseholdAccess(req, { allowDemo: true, requireAuth: false });

  if (!access.ok) {
    if (canUseDemoMode()) {
      return NextResponse.json({ ok: true, inventory: mockInventory });
    }
    return access.response;
  }

  const { supabase } = access;

  const { data, error } = await supabase
    .from("active_inventory_summary")
    .select("household_id, product_id, name, brand, category, image_url, storage_area, nearest_expiration_date, total_quantity_remaining, unit")
    .eq("household_id", access.householdId)
    .order("nearest_expiration_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error || !data) {
    if (canUseDemoMode()) {
      return NextResponse.json({ ok: true, inventory: mockInventory, warning: error?.message ?? "inventory_view_fallback" });
    }
    return NextResponse.json({ ok: false, message: "Unable to load inventory", error: error?.message }, { status: 500 });
  }

  const rows = data as InventorySummaryRow[];

  const inventory = rows.map((row) => ({
    id: createInventoryLineId(row.product_id, row.storage_area, row.unit),
    productId: row.product_id,
    name: row.name,
    icon: createIconLabel(row.name),
    imageUrl: proxiedOffImageUrl(row.image_url ?? undefined),
    quantity: Number(row.total_quantity_remaining),
    unit: normalizeQuantityUnit(row.unit),
    storageArea: normalizeStorageArea(row.storage_area),
    expirationDate: row.nearest_expiration_date ?? undefined,
    expirationLabel: formatExpirationLabel(row.nearest_expiration_date ?? undefined),
    dlcStatus: getExpirationStatus(row.nearest_expiration_date ?? undefined)
  }));

  return NextResponse.json({ ok: true, inventory });
}

function createInventoryLineId(productId: string, storageArea: string, unit: string) {
  return `${productId}:${normalizeStorageArea(storageArea)}:${normalizeQuantityUnit(unit)}`;
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
