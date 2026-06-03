import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;

    if (!token) {
      return NextResponse.json({ error: "Token requis" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // find token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("invitation_tokens")
      .select("id, household_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Token invalide" }, { status: 404 });
    }

    const now = new Date().toISOString();
    if (tokenRow.expires_at && tokenRow.expires_at < now) {
      return NextResponse.json({ error: "Token expiré" }, { status: 410 });
    }

    const context = await resolveAccountContext(request, supabase);
    const userId = context.appUserId;

    if (!context.authenticated || !userId) {
      return NextResponse.json({ error: "Utilisateur non authentifié" }, { status: 401 });
    }

    // check if already member
    const { data: existing } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", tokenRow.household_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, message: "already" });
    }

    const { error: insertErr } = await supabase.from("household_members").insert({
      household_id: tokenRow.household_id,
      user_id: userId,
      role: "member"
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? "Unexpected" }, { status: 500 });
  }
}
