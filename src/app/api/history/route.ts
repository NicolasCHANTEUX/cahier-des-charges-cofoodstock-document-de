import { NextResponse } from "next/server";
import { canUseDemoMode, isProductionEnvironment, resolveAccountContext, userBelongsToHousehold } from "@/lib/supabase/account-context";
import { mapActivityEventRow } from "@/lib/activity-events";
import { buildActivityEventInsert } from "@/lib/activity-events";
import { ensureDemoHousehold } from "@/lib/supabase/demo-household";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActivityEventRow = {
  id: string;
  type: "product_added" | "product_consumed" | "product_wasted" | "product_adjusted" | "undo";
  title: string;
  description: string | null;
  can_undo: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export async function GET(req: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: true, groups: [] });
  }

  const context = await resolveAccountContext(req, supabase);
  let householdId = context.householdId;

  if (!context.authenticated && isProductionEnvironment()) {
    return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
  }

  if (!householdId && canUseDemoMode()) {
    try {
      householdId = await ensureDemoHousehold(supabase);
    } catch {
      householdId = undefined;
    }
  }

  if (!householdId) {
    return NextResponse.json({ ok: true, events: [] });
  }

  const { data, error } = await supabase
    .from("activity_events")
    .select("id, type, title, description, can_undo, created_at, metadata")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return NextResponse.json({ ok: true, groups: [], warning: error?.message ?? "history_fallback" });
  }

  const events = (data as ActivityEventRow[]).map(mapActivityEventRow);
  return NextResponse.json({ ok: true, events });
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);

  if (!payload || !payload.title) {
    return NextResponse.json({ ok: false, message: "Payload JSON required" }, { status: 400 });
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const context = await resolveAccountContext(req, supabase);

  if (!context.authenticated || !context.appUserId) {
    return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
  }

  let householdId = context.householdId;

  if (!householdId && canUseDemoMode()) {
    try {
      householdId = await ensureDemoHousehold(supabase);
    } catch (error) {
      return NextResponse.json({ ok: false, message: "Unable to resolve demo household", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  const canWrite = await userBelongsToHousehold(supabase, context.appUserId, householdId);
  if (!canWrite || !householdId) {
    return NextResponse.json({ ok: false, message: "Forbidden household access" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("activity_events")
    .insert(
      buildActivityEventInsert({
        household_id: householdId,
        user_id: context.appUserId ?? null,
        type: payload.type ?? "undo",
        title: String(payload.title),
        description: payload.description ?? null,
        can_undo: Boolean(payload.canUndo),
        metadata: payload.metadata ?? {}
      })
    )
    .select("id, type, title, description, can_undo, created_at, metadata")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Unable to create history event", error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: mapActivityEventRow(data as ActivityEventRow) });
}
