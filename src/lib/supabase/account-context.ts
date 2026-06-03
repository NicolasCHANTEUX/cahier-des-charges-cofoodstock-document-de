import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountContext = {
  authenticated: boolean;
  authUserId?: string;
  appUserId?: string;
  householdId?: string;
  onboardingCompleted?: boolean;
};

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

  const { data: existingUser } = await supabase
    .from("users")
    .select("id, onboarding_completed")
    .eq("auth_user_id", authUserId)
    .maybeSingle<{ id: string; onboarding_completed: boolean }>();

  let appUserId = existingUser?.id;
  let onboardingCompleted = existingUser?.onboarding_completed ?? false;

  if (!appUserId) {
    const displayName = (userData.user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name
      ?? (userData.user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name
      ?? null;

    const { data: createdUser } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUserId,
        email: authUserEmail,
        display_name: displayName
      })
      .select("id, onboarding_completed")
      .maybeSingle<{ id: string; onboarding_completed: boolean }>();

    appUserId = createdUser?.id;
    onboardingCompleted = createdUser?.onboarding_completed ?? false;
  }

  if (!appUserId) {
    return { authenticated: true, authUserId };
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
