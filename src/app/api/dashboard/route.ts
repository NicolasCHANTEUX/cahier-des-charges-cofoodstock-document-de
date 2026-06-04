import { NextResponse } from "next/server";
import { createDashboardPayload } from "@/lib/dashboard-data";
import {
  canUseDemoMode,
  ensureUserHousehold,
  isProductionEnvironment,
  resolveAccountContext,
  userBelongsToHousehold
} from "@/lib/supabase/account-context";
import { ensureDemoHousehold } from "@/lib/supabase/demo-household";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    if (canUseDemoMode()) {
      const payload = await createDashboardPayload(process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ?? process.env.DEMO_HOUSEHOLD_ID ?? null);
      return NextResponse.json(payload);
    }
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const context = await resolveAccountContext(req, supabase);

  if (!context.authenticated) {
    if (isProductionEnvironment()) {
      return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
    }

    if (!canUseDemoMode()) {
      return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
    }

    const demoHouseholdId = await ensureDemoHousehold(supabase).catch(() => null);
    const payload = await createDashboardPayload(demoHouseholdId);
    return NextResponse.json(payload);
  }

  const householdId = await ensureUserHousehold(supabase, context);

  if (!householdId) {
    return NextResponse.json({ ok: false, message: "Household is required" }, { status: 400 });
  }

  const belongsToHousehold = await userBelongsToHousehold(supabase, context.appUserId, householdId);

  if (!belongsToHousehold) {
    return NextResponse.json({ ok: false, message: "Forbidden household access" }, { status: 403 });
  }

  return NextResponse.json(await createDashboardPayload(householdId));
}