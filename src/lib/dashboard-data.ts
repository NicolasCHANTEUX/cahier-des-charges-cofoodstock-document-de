import { mockInventory } from "@/lib/mock-data";
import { proxiedOffImageUrl } from "@/lib/image-proxy";
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

export async function createDashboardPayload(): Promise<DashboardPayload> {
  const inventory = await loadInventory();
  const expiringCount = inventory.filter((item) => item.dlcStatus).length;

  return {
    summary: {
      inventoryCount: inventory.length,
      expiringCount,
      recipeCount: 4,
      alertCount: 4
    },
    alerts: [
      {
        tone: "green",
        icon: "check",
        title: "Vous pourrez préparer",
        description: "2 repas complets !"
      },
      {
        tone: "blue",
        icon: "sparkles",
        title: "Vieira Carbonara Express",
        description: "Il manque 1 ingrédient"
      },
      {
        tone: "red",
        icon: "cart",
        title: "Le lait expire demain",
        description: "À consommer rapidement pour éviter le gaspillage."
      },
      {
        tone: "orange",
        icon: "heart",
        title: "Vous gaspillez souvent",
        description: "Le lait est à consommer plus rapidement."
      }
    ],
    inventory,
    nutrition: [
      { label: "Calories", value: "2730", tone: "blue", progress: 62 },
      { label: "Protéines", value: "140g", tone: "emerald", progress: 86 },
      { label: "Glucides", value: "372g", tone: "amber", progress: 78 },
      { label: "Lipides", value: "76g", tone: "orange", progress: 68 }
    ],
    recipes: [
      {
        title: "Pâtes Carbonara Express",
        time: "20 min",
        people: "4 pers.",
        missing: "Pâtes Barilla, Lait Lactel",
        tags: ["Italien", "Rapide"],
        highlighted: true,
        cover:
          "linear-gradient(135deg, rgba(224,189,113,0.95), rgba(89,66,28,0.82)), radial-gradient(circle at 22% 18%, rgba(255,255,255,0.65), transparent 18%), radial-gradient(circle at 72% 30%, rgba(255,244,199,0.75), transparent 20%), linear-gradient(0deg, #b8a074, #6b5431)"
      },
      {
        title: "Omelette aux Légumes",
        time: "15 min",
        people: "2 pers.",
        missing: "Tomates",
        tags: ["Rapide", "Protéiné"],
        highlighted: true,
        cover:
          "linear-gradient(135deg, rgba(255,214,123,0.96), rgba(181,99,21,0.78)), radial-gradient(circle at 65% 40%, rgba(255,255,255,0.75), transparent 18%), radial-gradient(circle at 35% 52%, rgba(255,241,180,0.75), transparent 15%), linear-gradient(0deg, #c98b30, #7b4d18)"
      },
      {
        title: "Poulet Rôti aux Légumes",
        time: "45 min",
        people: "4 pers.",
        missing: "Carottes, Tomates",
        tags: ["Protéiné", "Équilibré"],
        highlighted: true,
        cover:
          "linear-gradient(135deg, rgba(153,111,67,0.92), rgba(51,33,18,0.84)), radial-gradient(circle at 25% 25%, rgba(255,196,113,0.7), transparent 18%), radial-gradient(circle at 78% 35%, rgba(255,134,66,0.8), transparent 15%), linear-gradient(0deg, #8d5c33, #452a17)"
      },
      {
        title: "Riz aux Légumes",
        time: "30 min",
        people: "4 pers.",
        missing: "Riz Basmati, Carottes",
        tags: ["Végétarien", "Sain"],
        highlighted: false,
        cover:
          "linear-gradient(135deg, rgba(113,150,101,0.95), rgba(44,66,42,0.84)), radial-gradient(circle at 50% 48%, rgba(224,255,187,0.75), transparent 17%), radial-gradient(circle at 28% 60%, rgba(179,232,144,0.6), transparent 14%), linear-gradient(0deg, #6f915f, #2b4c2f)"
      }
    ],
    source: inventory === mockInventory ? "api-mock" : "api",
    fetchedAt: new Date().toISOString()
  };
}

async function loadInventory() {
  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("active_inventory_summary")
      .select("product_id, name, storage_area, nearest_expiration_date, total_quantity_remaining, unit, image_url")
      .order("nearest_expiration_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error || !data) {
      return mockInventory.map((item) => ({ ...item }));
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
    return mockInventory.map((item) => ({ ...item }));
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