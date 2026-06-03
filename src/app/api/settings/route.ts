import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultSettingsProfile } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const context = await resolveAccountContext(req, supabase);

    if (!context.appUserId) {
      return NextResponse.json({ ok: true, profile: defaultSettingsProfile, warning: "no_user_header" });
    }

    // fetch user preferences
    const { data: prefs, error: prefsErr } = await supabase.from("user_preferences").select("*").eq("user_id", context.appUserId).limit(1).maybeSingle();
    // fetch user health profile
    const { data: health, error: healthErr } = await supabase.from("user_health_profiles").select("*").eq("user_id", context.appUserId).limit(1).maybeSingle();
    // fetch latest active nutrition goal if exists
    const { data: goals, error: goalsErr } = await supabase.from("nutrition_goals").select("*").eq("user_id", context.appUserId).order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (prefsErr || healthErr) {
      // return default but provide warning
      return NextResponse.json({ ok: true, profile: defaultSettingsProfile, warning: "supabase_query_error" });
    }

    const profile = { ...defaultSettingsProfile };

    if (prefs) {
      if (typeof prefs.household_size === "number") profile.householdSize = prefs.household_size;
      if (prefs.diet) profile.diet = prefs.diet;
      if (prefs.app_mode) profile.appMode = prefs.app_mode;
    }

    if (health) {
      if (typeof health.weight_kg === "number") profile.weightKg = Number(health.weight_kg);
      if (typeof health.height_cm === "number") profile.heightCm = Number(health.height_cm);
      if (health.sex) profile.sex = health.sex;
      if (health.birthdate) {
        try {
          const birth = new Date(health.birthdate);
          const age = new Date().getFullYear() - birth.getFullYear();
          profile.age = age;
        } catch (e) {
          // ignore
        }
      }
    }

    if (goals) {
      if (goals.calories_kcal) profile.dailyCaloriesAdjustment = Math.round(goals.calories_kcal - (profile.dailyCaloriesAdjustment || 0));
    }

    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    return NextResponse.json({ ok: true, profile: defaultSettingsProfile, warning: "supabase_not_configured" });
  }
}
