import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json({ error: "Token requis" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const context = await resolveAccountContext(request, supabase);
    const userId = context.appUserId;

    if (!context.authenticated || !userId) {
      return NextResponse.json({ error: "Utilisateur non authentifie" }, { status: 401 });
    }

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("invitation_tokens")
      .select("id, household_id, expires_at, consumed_at")
      .eq("token", token)
      .maybeSingle<{ id: string; household_id: string; expires_at: string | null; consumed_at: string | null }>();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Token invalide" }, { status: 404 });
    }

    const now = new Date().toISOString();
    if (tokenRow.expires_at && tokenRow.expires_at < now) {
      return NextResponse.json({ error: "Token expire" }, { status: 410 });
    }

    if (tokenRow.consumed_at) {
      return NextResponse.json({ error: "Token deja utilise" }, { status: 410 });
    }

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

    await supabase
      .from("invitation_tokens")
      .update({
        consumed_at: now,
        consumed_by: userId
      })
      .eq("id", tokenRow.id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected" }, { status: 500 });
  }
}
