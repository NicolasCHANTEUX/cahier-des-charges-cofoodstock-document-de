import { NextResponse } from "next/server";
import { createDashboardPayload } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await createDashboardPayload());
}