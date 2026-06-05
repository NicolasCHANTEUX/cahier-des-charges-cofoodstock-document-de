import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/supabase/account-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateTargetCalories, defaultSettingsProfile, type SettingsProfile } from "@/lib/settings";

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
    const { data: goals } = await supabase.from("nutrition_goals").select("*").eq("user_id", context.appUserId).order("created_at", { ascending: false }).limit(1).maybeSingle();

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
        } catch {
          // ignore
        }
      }
    }

    if (goals) {
      if (goals.calories_kcal) profile.dailyCaloriesAdjustment = Math.round(goals.calories_kcal - (profile.dailyCaloriesAdjustment || 0));
    }

    return NextResponse.json({ ok: true, profile });
  } catch {
    return NextResponse.json({ ok: true, profile: defaultSettingsProfile, warning: "supabase_not_configured" });
  }
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Partial<SettingsProfile> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "Payload JSON required" }, { status: 400 });
  }

  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, message: "Supabase server client not configured" }, { status: 500 });
  }

  const context = await resolveAccountContext(req, supabase);

  if (!context.authenticated || !context.appUserId) {
    return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
  }

  const profile = normalizeProfile(payload);

  const { error: preferencesError } = await supabase.from("user_preferences").upsert(
    {
      user_id: context.appUserId,
      app_mode: profile.appMode,
      household_size: profile.householdSize,
      diet: profile.diet,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (preferencesError) {
    return NextResponse.json({ ok: false, message: "Unable to save preferences", error: preferencesError.message }, { status: 500 });
  }

  const { error: healthError } = await supabase.from("user_health_profiles").upsert(
    {
      user_id: context.appUserId,
      sex: profile.sex,
      height_cm: Math.round(profile.heightCm),
      weight_kg: profile.weightKg,
      birthdate: ageToBirthdate(profile.age),
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (healthError) {
    return NextResponse.json({ ok: false, message: "Unable to save health profile", error: healthError.message }, { status: 500 });
  }

  const targetCalories = calculateTargetCalories(profile);

  if (targetCalories !== null) {
    await supabase
      .from("nutrition_goals")
      .update({ is_active: false })
      .eq("user_id", context.appUserId)
      .eq("is_active", true);

    await supabase.from("nutrition_goals").insert({
      user_id: context.appUserId,
      calories_kcal: targetCalories,
      is_active: true
    });
  }

  return NextResponse.json({ ok: true, profile });
}

function normalizeProfile(payload: Partial<SettingsProfile>): SettingsProfile {
  return {
    householdSize: clampInteger(payload.householdSize, 1, 12, defaultSettingsProfile.householdSize),
    diet: isDiet(payload.diet) ? payload.diet : defaultSettingsProfile.diet,
    appMode: payload.appMode === "athlete" ? "athlete" : "general_public",
    age: clampInteger(payload.age, 1, 120, defaultSettingsProfile.age),
    weightKg: clampNumber(payload.weightKg, 20, 400, defaultSettingsProfile.weightKg),
    heightCm: clampNumber(payload.heightCm, 80, 260, defaultSettingsProfile.heightCm),
    sex: payload.sex === "female" || payload.sex === "other" ? payload.sex : "male",
    goal: payload.goal === "mass_gain" || payload.goal === "cut" ? payload.goal : "maintenance",
    dailyCaloriesAdjustment: Number.isFinite(Number(payload.dailyCaloriesAdjustment)) ? Number(payload.dailyCaloriesAdjustment) : 0
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Math.round(Number(value));

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function isDiet(value: unknown): value is SettingsProfile["diet"] {
  return value === "omnivore" || value === "vegetarian" || value === "vegan" || value === "pescatarian";
}

function ageToBirthdate(age: number) {
  const birthdate = new Date();
  birthdate.setFullYear(birthdate.getFullYear() - age);
  return birthdate.toISOString().slice(0, 10);
}
