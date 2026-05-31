import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureDemoHousehold(supabase: SupabaseClient) {
  const configuredHouseholdId = process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID || process.env.DEMO_HOUSEHOLD_ID;

  if (configuredHouseholdId) {
    return configuredHouseholdId;
  }

  const { data: existingHousehold } = await supabase
    .from("households")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingHousehold?.id) {
    return existingHousehold.id;
  }

  const { data: createdHousehold, error } = await supabase
    .from("households")
    .insert({ name: "Mon foyer" })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !createdHousehold) {
    throw error ?? new Error("Unable to create demo household");
  }

  return createdHousehold.id;
}
