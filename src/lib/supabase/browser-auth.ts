import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function getBrowserAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    return {};
  }

  return { Authorization: `Bearer ${accessToken}` };
}
