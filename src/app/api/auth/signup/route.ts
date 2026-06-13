import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LEGAL_TERMS_VERSION = "2026-06-07";
const DEFAULT_PRIVACY_POLICY_VERSION = "2026-06-07";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      full_name,
      acceptedLegalTerms,
      legalTermsVersion = DEFAULT_LEGAL_TERMS_VERSION,
      privacyPolicyVersion = DEFAULT_PRIVACY_POLICY_VERSION
    } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    if (acceptedLegalTerms !== true) {
      return NextResponse.json({ error: "Legal consent required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const adminAuth = supabase.auth.admin;

    if (!adminAuth || typeof adminAuth.createUser !== "function") {
      return NextResponse.json({ error: "Server Supabase admin API not available" }, { status: 501 });
    }

    const legalTermsAcceptedAt = new Date().toISOString();

    const { data, error } = await adminAuth.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        legal_terms_accepted_at: legalTermsAcceptedAt,
        legal_terms_version: legalTermsVersion,
        privacy_policy_version: privacyPolicyVersion
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: appUser, error: appUserError } = await insertAppUser(supabase, {
      authUserId: data.user.id,
      email,
      fullName: full_name,
      legalTermsAcceptedAt,
      legalTermsVersion,
      privacyPolicyVersion
    });

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
        .select("id, household_id, expires_at, consumed_at")
        .eq("token", inviteToken)
        .maybeSingle<{ id: string; household_id: string; expires_at: string | null; consumed_at: string | null }>();

      if (tokenRow && !tokenRow.consumed_at && (!tokenRow.expires_at || tokenRow.expires_at > new Date().toISOString())) {
        await supabase.from("household_members").insert({
          household_id: tokenRow.household_id,
          user_id: appUser.id,
          role: "member"
        });
        await supabase
          .from("invitation_tokens")
          .update({
            consumed_at: new Date().toISOString(),
            consumed_by: appUser.id
          })
          .eq("id", tokenRow.id);
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

async function insertAppUser(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  input: {
    authUserId: string;
    email: string;
    fullName?: string | null;
    legalTermsAcceptedAt: string;
    legalTermsVersion: string;
    privacyPolicyVersion: string;
  }
) {
  const insertPayload = {
    auth_user_id: input.authUserId,
    email: input.email,
    display_name: input.fullName ?? null,
    legal_terms_accepted_at: input.legalTermsAcceptedAt,
    legal_terms_version: input.legalTermsVersion,
    privacy_policy_version: input.privacyPolicyVersion
  };

  const result = await supabase.from("users").insert(insertPayload).select("id").maybeSingle();

  if (!isMissingLegalConsentColumn(result.error?.message)) {
    return result;
  }

  return supabase
    .from("users")
    .insert({
      auth_user_id: input.authUserId,
      email: input.email,
      display_name: input.fullName ?? null
    })
    .select("id")
    .maybeSingle();
}

function isMissingLegalConsentColumn(message?: string | null) {
  if (!message) {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("legal_terms_accepted_at") ||
    lowerMessage.includes("legal_terms_version") ||
    lowerMessage.includes("privacy_policy_version")
  );
}
