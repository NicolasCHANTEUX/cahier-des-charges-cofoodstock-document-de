import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountContext = {
  authenticated: boolean;
  authUserId?: string;
  appUserId?: string;
  householdId?: string;
  email?: string;
  displayName?: string | null;
  onboardingCompleted?: boolean;
};

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function canUseDemoMode() {
  return !isProductionEnvironment();
}

export async function userBelongsToHousehold(
  supabase: SupabaseClient,
  appUserId: string | undefined,
  householdId: string | undefined
) {
  if (!appUserId || !householdId) {
    return false;
  }

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", appUserId)
    .eq("household_id", householdId)
    .limit(1)
    .maybeSingle<{ household_id: string }>();

  return !error && Boolean(data?.household_id);
}

export async function resolveAccountContext(request: Request, supabase: SupabaseClient): Promise<AccountContext> {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!accessToken) {
    return { authenticated: false };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const authUserId = userData.user?.id;

  if (userError || !authUserId) {
    return { authenticated: false };
  }

  const authUserEmail = userData.user?.email ?? `${authUserId}@missing.local`;
  const metadata = userData.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const metadataDisplayName = metadata?.full_name ?? metadata?.name ?? null;

  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email, display_name, onboarding_completed")
    .eq("auth_user_id", authUserId)
    .maybeSingle<{ id: string; email: string | null; display_name: string | null; onboarding_completed: boolean }>();

  let appUserId = existingUser?.id;
  let email = existingUser?.email ?? authUserEmail;
  let displayName = existingUser?.display_name ?? metadataDisplayName;
  let onboardingCompleted = existingUser?.onboarding_completed ?? false;

  if (!appUserId) {
    const { data: createdUser } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUserId,
        email: authUserEmail,
        display_name: displayName
      })
      .select("id, email, display_name, onboarding_completed")
      .maybeSingle<{ id: string; email: string | null; display_name: string | null; onboarding_completed: boolean }>();

    appUserId = createdUser?.id;
    email = createdUser?.email ?? authUserEmail;
    displayName = createdUser?.display_name ?? displayName;
    onboardingCompleted = createdUser?.onboarding_completed ?? false;
  } else if (!existingUser?.display_name && metadataDisplayName) {
    await supabase.from("users").update({ display_name: metadataDisplayName }).eq("id", appUserId);
    displayName = metadataDisplayName;
  }

  if (!appUserId) {
    return { authenticated: true, authUserId, email, displayName };
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", appUserId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    authenticated: true,
    authUserId,
    appUserId,
    householdId: membership?.household_id ?? undefined,
    email,
    displayName,
    onboardingCompleted
  };
}

export async function ensureUserHousehold(supabase: SupabaseClient, context: AccountContext) {
  if (context.householdId) {
    return context.householdId;
  }

  if (!context.appUserId) {
    return undefined;
  }

  const { data: existingMembership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", context.appUserId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ household_id: string }>();

  if (existingMembership?.household_id) {
    return existingMembership.household_id;
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({
      name: "Mon foyer",
      created_by: context.appUserId
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (householdError || !household?.id) {
    throw householdError ?? new Error("Unable to create user household");
  }

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: context.appUserId,
    role: "owner"
  });

  if (memberError) {
    throw memberError;
  }

  return household.id;
}
