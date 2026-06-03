import { NextResponse } from "next/server";
import { ensureUserHousehold, resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ authenticated: false, onboardingCompleted: false });
  }

  const context = await resolveAccountContext(request, supabase);

  if (!context.authenticated || !context.appUserId) {
    return NextResponse.json({ authenticated: false, onboardingCompleted: false });
  }

  let householdId = context.householdId;
  let householdName: string | null = null;

  try {
    householdId = await ensureUserHousehold(supabase, context);
  } catch {
    // The session is valid; household repair can be retried by the next protected request.
  }

  if (householdId) {
    const { data: household } = await supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle<{ name: string | null }>();

    householdName = household?.name ?? null;
  }

  return NextResponse.json({
    authenticated: true,
    onboardingCompleted: Boolean(context.onboardingCompleted),
    householdId: householdId ?? null,
    householdName,
    displayName: context.displayName ?? null,
    email: context.email ?? null
  });
}
