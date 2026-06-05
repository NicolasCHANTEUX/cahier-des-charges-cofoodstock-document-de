import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const context = await resolveAccountContext(request, supabase);

    if (!context.appUserId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Ensure the user has permission to invite (owner or admin)
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", context.appUserId)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const token = typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from("invitation_tokens").insert({
      token,
      household_id: membership.household_id,
      expires_at: expiresAt
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, token, expires_at: expiresAt });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? "Unexpected" }, { status: 500 });
  }
}
