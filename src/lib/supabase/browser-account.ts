import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type BrowserAccountStatus = {
  authenticated: boolean;
  onboardingCompleted: boolean;
  householdId?: string | null;
  householdName?: string | null;
  displayName?: string | null;
  email?: string | null;
};

type AccountStatusOptions = {
  force?: boolean;
};

let statusCache: { accessToken: string; status: BrowserAccountStatus } | null = null;
let pendingStatus: { accessToken: string; promise: Promise<BrowserAccountStatus> } | null = null;

export function clearBrowserAccountStatusCache() {
  statusCache = null;
  pendingStatus = null;
}

export async function getBrowserAccountStatus(options: AccountStatusOptions = {}): Promise<BrowserAccountStatus> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    clearBrowserAccountStatusCache();
    return { authenticated: false, onboardingCompleted: false };
  }

  if (!options.force && statusCache?.accessToken === accessToken) {
    return statusCache.status;
  }

  if (!options.force && pendingStatus?.accessToken === accessToken) {
    return pendingStatus.promise;
  }

  const promise = fetchAccountStatus(accessToken)
    .then((status) => {
      statusCache = { accessToken, status };
      return status;
    })
    .finally(() => {
      if (pendingStatus?.accessToken === accessToken) {
        pendingStatus = null;
      }
    });

  pendingStatus = { accessToken, promise };
  return promise;
}

async function fetchAccountStatus(accessToken: string): Promise<BrowserAccountStatus> {
  const response = await fetch("/api/account/status", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { authenticated: false, onboardingCompleted: false };
    }

    throw new Error(`Unable to load account status (${response.status})`);
  }

  const payload = (await response.json()) as Partial<BrowserAccountStatus>;

  if (typeof payload.authenticated !== "boolean" || typeof payload.onboardingCompleted !== "boolean") {
    throw new Error("Invalid account status response");
  }

  return payload as BrowserAccountStatus;
}
