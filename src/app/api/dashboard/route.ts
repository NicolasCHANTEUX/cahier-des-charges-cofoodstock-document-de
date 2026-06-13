import { NextResponse } from "next/server";
import { createDashboardPayload } from "@/lib/dashboard-data";
import { canUseDemoMode } from "@/lib/supabase/account-context";
import { requireHouseholdAccess } from "@/lib/supabase/household-access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireHouseholdAccess(req, { allowDemo: true, requireAuth: false });

  if (!access.ok) {
    if (canUseDemoMode()) {
      const payload = await createDashboardPayload(process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ?? process.env.DEMO_HOUSEHOLD_ID ?? null);
      return NextResponse.json(payload);
    }
    return access.response;
  }

  return NextResponse.json(await createDashboardPayload(access.householdId));
}
