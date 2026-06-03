import { getBrowserAuthHeaders } from "@/lib/supabase/browser-auth";

export type BrowserAccountStatus = {
  authenticated: boolean;
  onboardingCompleted: boolean;
  householdId?: string | null;
};

export async function getBrowserAccountStatus(): Promise<BrowserAccountStatus> {
  const headers = await getBrowserAuthHeaders();

  if (!headers.Authorization) {
    return { authenticated: false, onboardingCompleted: false };
  }

  const response = await fetch("/api/account/status", {
    cache: "no-store",
    headers
  });

  if (!response.ok) {
    return { authenticated: true, onboardingCompleted: true };
  }

  return (await response.json()) as BrowserAccountStatus;
}
