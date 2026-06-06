import { NextResponse } from "next/server";
import { buildActivityEventInsert } from "@/lib/activity-events";
import { ensureDemoHousehold } from "@/lib/supabase/demo-household";
import {
  canUseDemoMode,
  ensureUserHousehold,
  isProductionEnvironment,
  resolveAccountContext,
  userBelongsToHousehold
} from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ShoppingListRow = {
  id: string;
  household_id: string;
  is_active: boolean;
  archived_at: string | null;
};

type ShoppingItemRow = {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  status: "active" | "checked" | "archived";
};

const COMPLETED_SESSION_VISIBLE_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const context = await resolveAccountContext(req, supabase);
  const householdId = await resolveHouseholdId(req, supabase, context);

  if (!householdId.ok) {
    return householdId.response;
  }

  const state = await loadShoppingState(supabase, householdId.householdId);
  return NextResponse.json({ ok: true, ...state });
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload.action !== "string") {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const context = await resolveAccountContext(req, supabase);
  const household = await resolveHouseholdId(req, supabase, context);

  if (!household.ok) {
    return household.response;
  }

  const householdId = household.householdId;

  if (payload.action === "add_item") {
    const label = String(payload.label ?? "").trim();
    const quantity = Number(payload.quantity);
    const category = normalizeCategory(payload.category);
    const unit = normalizeUnit(payload.unit);

    if (!label) {
      return NextResponse.json({ ok: false, message: "Label is required" }, { status: 400 });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ ok: false, message: "Quantity must be greater than 0" }, { status: 400 });
    }

    const listId = await getOrCreateActiveListId(supabase, householdId);
    const { error } = await supabase.from("shopping_items").insert({
      shopping_list_id: listId,
      label,
      quantity,
      unit,
      category,
      status: "active",
      source: "manual",
      added_by: context.appUserId ?? null
    });

    if (error) {
      return NextResponse.json({ ok: false, message: "Unable to add shopping item", error: error.message }, { status: 500 });
    }
  } else if (payload.action === "toggle_item") {
    const itemId = String(payload.itemId ?? "");
    const checked = Boolean(payload.checked);
    const listId = await getActiveListId(supabase, householdId);

    if (!itemId) {
      return NextResponse.json({ ok: false, message: "itemId is required" }, { status: 400 });
    }

    if (!listId) {
      return NextResponse.json({ ok: false, message: "No active shopping list" }, { status: 400 });
    }

    const { error } = await supabase
      .from("shopping_items")
      .update({
        status: checked ? "checked" : "active",
        checked_at: checked ? new Date().toISOString() : null,
        checked_by: checked ? context.appUserId ?? null : null
      })
      .eq("id", itemId)
      .eq("shopping_list_id", listId);

    if (error) {
      return NextResponse.json({ ok: false, message: "Unable to update shopping item", error: error.message }, { status: 500 });
    }
  } else if (payload.action === "delete_item") {
    const itemId = String(payload.itemId ?? "");
    const listId = await getActiveListId(supabase, householdId);

    if (!itemId) {
      return NextResponse.json({ ok: false, message: "itemId is required" }, { status: 400 });
    }

    if (!listId) {
      return NextResponse.json({ ok: false, message: "No active shopping list" }, { status: 400 });
    }

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", itemId)
      .eq("shopping_list_id", listId);

    if (error) {
      return NextResponse.json({ ok: false, message: "Unable to delete shopping item", error: error.message }, { status: 500 });
    }
  } else if (payload.action === "complete_list" || payload.action === "archive_list") {
    const { data: activeList } = await supabase
      .from("shopping_lists")
      .select("id, household_id, is_active, archived_at")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ShoppingListRow>();

    if (!activeList) {
      return NextResponse.json({ ok: false, message: "No active shopping list" }, { status: 400 });
    }

    const { data: checkedItems } = await supabase
      .from("shopping_items")
      .select("id, label, quantity, unit, category, status")
      .eq("shopping_list_id", activeList.id)
      .eq("status", "checked")
      .returns<ShoppingItemRow[]>();

    const archivedAt = new Date().toISOString();

    await supabase
      .from("shopping_items")
      .update({ status: "archived" })
      .eq("shopping_list_id", activeList.id)
      .eq("status", "active");

    const { error: archiveError } = await supabase
      .from("shopping_lists")
      .update({ is_active: false, archived_at: archivedAt })
      .eq("id", activeList.id);

    if (archiveError) {
      return NextResponse.json({ ok: false, message: "Unable to archive shopping list", error: archiveError.message }, { status: 500 });
    }

    if ((checkedItems ?? []).length > 0) {
      await supabase.from("activity_events").insert(
        buildActivityEventInsert({
          household_id: householdId,
          user_id: context.appUserId ?? null,
          type: "shopping_finished",
          title: "Courses terminées",
          description: `${checkedItems?.length ?? 0} article(s) cochés`,
          can_undo: false,
          metadata: {
            source: "shopping",
            shopping_list_id: activeList.id,
            completed_at: archivedAt
          }
        })
      );
    }
  } else {
    return NextResponse.json({ ok: false, message: "Unsupported action" }, { status: 400 });
  }

  const state = await loadShoppingState(supabase, householdId);
  return NextResponse.json({ ok: true, ...state });
}

async function resolveHouseholdId(
  req: Request,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  context: Awaited<ReturnType<typeof resolveAccountContext>>
) {
  let householdId = context.householdId;

  if (!context.authenticated && isProductionEnvironment()) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 })
    };
  }

  if (context.authenticated) {
    try {
      householdId = await ensureUserHousehold(supabase, context);
    } catch (error) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { ok: false, message: "Unable to resolve household", error: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        )
      };
    }

    const belongs = await userBelongsToHousehold(supabase, context.appUserId, householdId);
    if (!belongs) {
      return {
        ok: false as const,
        response: NextResponse.json({ ok: false, message: "Forbidden household access" }, { status: 403 })
      };
    }
  } else if (canUseDemoMode()) {
    householdId = await ensureDemoHousehold(supabase).catch(() => undefined);
  }

  if (!householdId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Household is required" }, { status: 400 })
    };
  }

  return { ok: true as const, householdId };
}

async function loadShoppingState(supabase: ReturnType<typeof createSupabaseServerClient>, householdId: string) {
  const { data: activeList } = await supabase
    .from("shopping_lists")
    .select("id, household_id, is_active, archived_at")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ShoppingListRow>();

  const { data: archivedList } = await supabase
    .from("shopping_lists")
    .select("id, household_id, is_active, archived_at")
    .eq("household_id", householdId)
    .eq("is_active", false)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(1)
    .maybeSingle<ShoppingListRow>();

  let groups: Array<{ category: string; items: Array<{ id: string; label: string; quantity: string; icon: string; checked: boolean }> }> = [];

  if (activeList) {
    const { data: activeItems } = await supabase
      .from("shopping_items")
      .select("id, label, quantity, unit, category, status")
      .eq("shopping_list_id", activeList.id)
      .in("status", ["active", "checked"])
      .order("created_at", { ascending: true })
      .returns<ShoppingItemRow[]>();

    groups = groupShoppingItems(activeItems ?? []);
  }

  let completedSession: {
    completedAt: string;
    groups: Array<{ category: string; items: Array<{ id: string; label: string; quantity: string; icon: string; checked: boolean }> }>;
  } | null = null;

  if (archivedList?.archived_at && isRecentCompletedSession(archivedList.archived_at)) {
    const { data: checkedItems } = await supabase
      .from("shopping_items")
      .select("id, label, quantity, unit, category, status")
      .eq("shopping_list_id", archivedList.id)
      .eq("status", "checked")
      .order("updated_at", { ascending: true })
      .returns<ShoppingItemRow[]>();

    const checkedGroups = groupShoppingItems(checkedItems ?? []);
    if (checkedGroups.length > 0) {
      completedSession = {
        completedAt: archivedList.archived_at,
        groups: checkedGroups
      };
    }
  }

  return { groups, completedSession };
}

async function getOrCreateActiveListId(supabase: ReturnType<typeof createSupabaseServerClient>, householdId: string) {
  const existingId = await getActiveListId(supabase, householdId);

  if (existingId) {
    return existingId;
  }

  const { data: created, error } = await supabase
    .from("shopping_lists")
    .insert({ household_id: householdId, is_active: true, name: "Liste active" })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !created?.id) {
    throw new Error(error?.message ?? "Unable to create shopping list");
  }

  return created.id;
}

async function getActiveListId(supabase: ReturnType<typeof createSupabaseServerClient>, householdId: string) {
  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return existing?.id ?? null;
}

function normalizeCategory(value: unknown) {
  if (value === "fresh" || value === "frozen" || value === "dry") {
    return value;
  }

  return "other";
}

function normalizeUnit(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "unit";
  }

  return value.trim();
}

function groupShoppingItems(items: ShoppingItemRow[]) {
  const grouped = new Map<string, Array<{ id: string; label: string; quantity: string; icon: string; checked: boolean }>>();

  items.forEach((item) => {
    const category = categoryLabel(item.category);
    const existing = grouped.get(category) ?? [];
    existing.push({
      id: item.id,
      label: item.label,
      quantity: formatQuantityLabel(item.quantity, item.unit),
      icon: createIconLabel(item.label),
      checked: item.status === "checked"
    });
    grouped.set(category, existing);
  });

  return Array.from(grouped.entries()).map(([category, groupedItems]) => ({
    category,
    items: groupedItems
  }));
}

function categoryLabel(value: string) {
  if (value === "fresh") {
    return "Frais";
  }

  if (value === "frozen") {
    return "Surgelés";
  }

  if (value === "dry") {
    return "Épicerie";
  }

  return "Autres";
}

function formatQuantityLabel(quantity: number | null, unit: string | null) {
  if (!quantity || quantity <= 0) {
    return "À définir";
  }

  const cleanUnit = unit?.trim() || "unité";
  const displayedQuantity = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.?0+$/, "");
  return `${displayedQuantity} ${cleanUnit}`;
}

function isRecentCompletedSession(archivedAt: string) {
  const archivedTime = Date.parse(archivedAt);

  if (!Number.isFinite(archivedTime)) {
    return false;
  }

  return Date.now() - archivedTime < COMPLETED_SESSION_VISIBLE_MS;
}

function createIconLabel(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return compact || "PR";
}
