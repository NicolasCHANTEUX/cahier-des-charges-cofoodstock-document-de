import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/supabase/household-access";

export async function POST(request: Request) {
  try {
    const access = await requireHouseholdAccess(request, { requireAuth: true });

    if (!access.ok) {
      return access.response;
    }

    const { context, householdId, supabase } = access;
    const appUserId = context.appUserId!;

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", appUserId)
      .eq("household_id", householdId)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const token =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from("invitation_tokens").insert({
      token,
      household_id: householdId,
      created_by: appUserId,
      expires_at: expiresAt
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, token, expires_at: expiresAt });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected" }, { status: 500 });
  }
}
