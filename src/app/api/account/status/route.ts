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

  try {
    householdId = await ensureUserHousehold(supabase, context);
  } catch {
    // The session is valid; household repair can be retried by the next protected request.
  }

  return NextResponse.json({
    authenticated: true,
    onboardingCompleted: Boolean(context.onboardingCompleted),
    householdId: householdId ?? null
  });
}

