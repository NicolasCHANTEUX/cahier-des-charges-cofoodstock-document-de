import { mockInventory } from "@/lib/mock-data";
import { proxiedOffImageUrl } from "@/lib/image-proxy";
import { canUseDemoMode } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BadgeTone, InventoryItem, QuantityUnit, StorageArea } from "@/types/domain";

export type DashboardAlert = {
  tone: BadgeTone;
  icon: "check" | "sparkles" | "cart" | "heart";
  title: string;
  description: string;
};

export type DashboardNutritionMetric = {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "orange";
  progress: number;
};

export type DashboardRecipe = {
  title: string;
  time: string;
  people: string;
  missing: string;
  tags: string[];
  cover: string;
  highlighted: boolean;
};

export type DashboardPayload = {
  summary: {
    inventoryCount: number;
    expiringCount: number;
    recipeCount: number;
    alertCount: number;
  };
  alerts: DashboardAlert[];
  inventory: InventoryItem[];
  nutrition: DashboardNutritionMetric[];
  recipes: DashboardRecipe[];
  source: "api" | "api-mock";
  fetchedAt: string;
};

type InventorySummaryRow = {
  product_id: string;
  name: string;
  storage_area: string;
  nearest_expiration_date: string | null;
  total_quantity_remaining: number;
  unit: string;
  image_url: string | null;
};

export async function createDashboardPayload(householdId: string | null): Promise<DashboardPayload> {
  const inventory = await loadInventory(householdId);
  const expiringCount = inventory.filter((item) => item.dlcStatus).length;

  return {
    summary: {
      inventoryCount: inventory.length,
      expiringCount,
      recipeCount: 0,
      alertCount: expiringCount
    },
    alerts: [],
    inventory,
    nutrition: [],
    recipes: [],
    source: inventory === mockInventory ? "api-mock" : "api",
    fetchedAt: new Date().toISOString()
  };
}

async function loadInventory(householdId: string | null) {
  if (!householdId) {
    if (canUseDemoMode()) {
      return mockInventory.map((item) => ({ ...item }));
    }
    throw new Error("Household is required to load dashboard inventory");
  }

  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("active_inventory_summary")
      .select("product_id, name, storage_area, nearest_expiration_date, total_quantity_remaining, unit, image_url")
      .eq("household_id", householdId)
      .order("nearest_expiration_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error || !data) {
      if (canUseDemoMode()) {
        return mockInventory.map((item) => ({ ...item }));
      }
      throw error ?? new Error("Unable to load inventory");
    }

    return (data as InventorySummaryRow[]).map((row) => ({
      id: row.product_id,
      name: row.name,
      icon: createIconLabel(row.name),
      imageUrl: proxiedOffImageUrl(row.image_url ?? undefined),
      quantity: Number(row.total_quantity_remaining),
      unit: normalizeUnit(row.unit),
      storageArea: normalizeStorageArea(row.storage_area),
      expirationDate: row.nearest_expiration_date ?? undefined,
      expirationLabel: formatExpirationLabel(row.nearest_expiration_date ?? undefined),
      dlcStatus: getExpirationStatus(row.nearest_expiration_date ?? undefined)
    }));
  } catch {
    if (canUseDemoMode()) {
      return mockInventory.map((item) => ({ ...item }));
    }
    throw new Error("Unable to load dashboard inventory");
  }
}

function createIconLabel(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return compact || "PR";
}

function normalizeStorageArea(value: string): StorageArea {
  if (value === "fresh" || value === "frozen" || value === "dry") {
    return value;
  }

  return "other";
}

function normalizeUnit(value: string): QuantityUnit {
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