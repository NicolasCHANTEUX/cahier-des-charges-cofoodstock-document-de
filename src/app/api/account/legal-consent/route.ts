import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LEGAL_TERMS_VERSION = "2026-06-07";
const DEFAULT_PRIVACY_POLICY_VERSION = "2026-06-07";

export async function POST(request: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, message: "Supabase serveur n'est pas configure." }, { status: 500 });
  }

  const context = await resolveAccountContext(request, supabase);

  if (!context.authenticated || !context.authUserId || !context.appUserId) {
    return NextResponse.json({ ok: false, message: "Utilisateur non authentifie." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const acceptedAt = normalizeIsoDate(body?.acceptedAt) ?? new Date().toISOString();
  const legalTermsVersion = String(body?.legalTermsVersion ?? DEFAULT_LEGAL_TERMS_VERSION);
  const privacyPolicyVersion = String(body?.privacyPolicyVersion ?? DEFAULT_PRIVACY_POLICY_VERSION);
  const metadata = {
    legal_terms_accepted_at: acceptedAt,
    legal_terms_version: legalTermsVersion,
    privacy_policy_version: privacyPolicyVersion
  };

  const { data: authUserData } = await supabase.auth.admin.getUserById(context.authUserId);
  const existingMetadata = (authUserData.user?.user_metadata ?? {}) as Record<string, unknown>;

  const { error: authError } = await supabase.auth.admin.updateUserById(context.authUserId, {
    user_metadata: {
      ...existingMetadata,
      ...metadata
    }
  });

  if (authError) {
    return NextResponse.json({ ok: false, message: "Impossible d'enregistrer le consentement.", error: authError.message }, { status: 500 });
  }

  const { error: userError } = await supabase
    .from("users")
    .update({
      legal_terms_accepted_at: acceptedAt,
      legal_terms_version: legalTermsVersion,
      privacy_policy_version: privacyPolicyVersion,
      updated_at: new Date().toISOString()
    })
    .eq("id", context.appUserId);

  if (userError && !isMissingLegalConsentColumn(userError.message)) {
    return NextResponse.json({ ok: false, message: "Impossible d'enregistrer le consentement.", error: userError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    consent: metadata,
    warning: userError ? "legal_columns_missing" : undefined
  });
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function isMissingLegalConsentColumn(message: string) {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("legal_terms_accepted_at") ||
    lowerMessage.includes("legal_terms_version") ||
    lowerMessage.includes("privacy_policy_version")
  );
}
