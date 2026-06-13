import { NextResponse } from "next/server";
import { z } from "zod";
import { mapActivityEventRow } from "@/lib/activity-events";
import { buildActivityEventInsert } from "@/lib/activity-events";
import { requireHouseholdAccess } from "@/lib/supabase/household-access";
import type { ActivityType } from "@/types/domain";

type ActivityEventRow = {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  can_undo: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const historyEventSchema = z.object({
  type: z.enum(["product_added", "product_consumed", "product_wasted", "product_adjusted", "recipe_cooked", "shopping_finished", "undo"]).optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  canUndo: z.coerce.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

export async function GET(req: Request) {
  const access = await requireHouseholdAccess(req, { allowDemo: true, requireAuth: false });

  if (!access.ok) {
    return access.response;
  }

  const { householdId, supabase } = access;
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, type, title, description, can_undo, created_at, metadata")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Unable to load history", error: error?.message ?? "history_query_failed" }, { status: 500 });
  }

  const events = (data as ActivityEventRow[]).map(mapActivityEventRow);
  return NextResponse.json({ ok: true, events });
}

export async function POST(req: Request) {
  const rawPayload = await req.json().catch(() => null);
  const parsedPayload = historyEventSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid payload", errors: parsedPayload.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const access = await requireHouseholdAccess(req, { requireAuth: true });

  if (!access.ok) {
    return access.response;
  }

  const payload = parsedPayload.data;
  const { context, householdId, supabase } = access;
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
