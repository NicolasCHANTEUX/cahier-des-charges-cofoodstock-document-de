import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/supabase/household-access";

export async function GET(request: Request) {
  const access = await requireHouseholdAccess(request, { requireAuth: true });

  if (!access.ok) {
    if (access.response.status === 401) {
      return NextResponse.json({ authenticated: false, onboardingCompleted: false }, { status: 401 });
    }

    return access.response;
  }

  const { context, householdId, supabase } = access;
  let householdName: string | null = null;

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
