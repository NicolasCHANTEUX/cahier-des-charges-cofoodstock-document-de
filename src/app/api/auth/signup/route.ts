import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const adminAuth = supabase.auth.admin;

    if (!adminAuth || typeof adminAuth.createUser !== "function") {
      return NextResponse.json({ error: "Server Supabase admin API not available" }, { status: 501 });
    }

    const { data, error } = await adminAuth.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("users")
      .insert({
        auth_user_id: data.user.id,
        email,
        display_name: full_name ?? null
      })
      .select("id")
      .maybeSingle();

    if (appUserError || !appUser) {
      return NextResponse.json({ error: appUserError?.message ?? "Unable to create app user" }, { status: 500 });
    }

    // If invite token provided, attach the created user to the household
    const { inviteToken } = body as { inviteToken?: string };
    let joinedInviteHousehold = false;

    if (inviteToken && data?.user?.id) {
      // find token
      const { data: tokenRow } = await supabase
        .from("invitation_tokens")
        .select("household_id, expires_at")
        .eq("token", inviteToken)
        .maybeSingle();

      if (tokenRow && (!tokenRow.expires_at || tokenRow.expires_at > new Date().toISOString())) {
        await supabase.from("household_members").insert({
          household_id: tokenRow.household_id,
          user_id: appUser.id,
          role: "member"
        });
        joinedInviteHousehold = true;
      }
    }

    if ((!inviteToken || !joinedInviteHousehold) && appUser?.id) {
      const { data: household } = await supabase
        .from("households")
        .insert({
          name: "Mon foyer",
          created_by: appUser.id
        })
        .select("id")
        .maybeSingle();

      if (household?.id) {
        await supabase.from("household_members").insert({
          household_id: household.id,
          user_id: appUser.id,
          role: "owner"
        });
      }
    }

    return NextResponse.json({ user: data.user }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? "Unexpected error" }, { status: 500 });
  }
}
