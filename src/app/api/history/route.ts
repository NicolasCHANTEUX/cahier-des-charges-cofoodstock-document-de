import { NextResponse } from "next/server";
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
};

export async function GET() {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: true, groups: [] });
  }

  const { data, error } = await supabase
    .from("activity_events")
    .select("id, type, title, description, can_undo, created_at")
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

  let householdId: string;

  try {
    householdId = await ensureDemoHousehold(supabase);
  } catch (error) {
    return NextResponse.json({ ok: false, message: "Unable to resolve demo household", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("activity_events")
    .insert(
      buildActivityEventInsert({
        household_id: householdId,
        type: payload.type ?? "undo",
        title: String(payload.title),
        description: payload.description ?? null,
        can_undo: Boolean(payload.canUndo),
        metadata: payload.metadata ?? {}
      })
    )
    .select("id, type, title, description, can_undo, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Unable to create history event", error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: mapActivityEventRow(data as ActivityEventRow) });
}
