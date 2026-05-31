"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Settings, Target, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildSettingsChangeSummary, calculateBmi, calculateBmr, calculateMaintenanceCalories, calculateTargetCalories, defaultSettingsProfile, formatBmi, formatCalories, getBmiLabel, getGoalDefaultAdjustment, getGoalLabel, type SettingsProfile } from "@/lib/settings";

const STORAGE_KEY = "ecofoodstock:settings-profile";

export function SettingsView() {
  const [profile, setProfile] = useState<SettingsProfile>(defaultSettingsProfile);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const baselineRef = useRef<SettingsProfile>(defaultSettingsProfile);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SettingsProfile;
        setProfile(parsed);
        baselineRef.current = parsed;
        setAdvancedOpen(parsed.appMode === "athlete");
      } catch {
        setProfile(defaultSettingsProfile);
        baselineRef.current = defaultSettingsProfile;
      }
    }

    setLoaded(true);
  }, []);

  const bmi = useMemo(() => calculateBmi(profile), [profile]);
  const bmr = useMemo(() => calculateBmr(profile), [profile]);
  const maintenanceCalories = useMemo(() => calculateMaintenanceCalories(profile), [profile]);
  const targetCalories = useMemo(() => calculateTargetCalories(profile), [profile]);
  const showAdvanced = profile.appMode === "athlete" || advancedOpen;

  async function saveSettings() {
    setSaving(true);
    setStatus(null);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

      const changes = buildSettingsChangeSummary(baselineRef.current, profile);

      if (changes !== "Aucune modification") {
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "undo",
            title: "Paramètres mis à jour",
            description: `${changes}. IMC ${formatBmi(bmi)}, besoin ${formatCalories(maintenanceCalories)}, objectif ${getGoalLabel(profile.goal)} (${profile.dailyCaloriesAdjustment > 0 ? "+" : ""}${profile.dailyCaloriesAdjustment} kcal).`,
            canUndo: false,
            metadata: {
              section: "settings",
              profile
            }
          })
        });
      }

      baselineRef.current = profile;
      setStatus("Paramètres enregistrés.");
    } catch {
      setStatus("Impossible d'enregistrer les paramètres pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  function updateProfile<K extends keyof SettingsProfile>(key: K, value: SettingsProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateGoal(goal: SettingsProfile["goal"]) {
    setProfile((current) => ({
      ...current,
      goal,
      dailyCaloriesAdjustment: goal === "maintenance" ? 0 : getGoalDefaultAdjustment(goal)
    }));
  }

  function updateMode(appMode: SettingsProfile["appMode"]) {
    setProfile((current) => ({ ...current, appMode }));

    if (appMode === "athlete") {
      setAdvancedOpen(true);
    }
  }

  if (!loaded) {
    return (
      <div>
        <PageHeader icon={Settings} title="Parametres" />
        <Card className="p-6 text-sm text-slate-500">Chargement des paramètres...</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={Settings} title="Parametres" />

      <div className="space-y-5">
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <UsersRound className="h-5 w-5 text-brand-600" />
            <h2 className="text-xl font-bold">Mon profil & foyer</h2>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Taille du foyer</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((size) => (
                  <button
                    key={size}
                    className={`h-11 w-11 rounded-lg border font-semibold transition ${
                      profile.householdSize === size ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700"
                    }`}
                    type="button"
                    onClick={() => updateProfile("householdSize", size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Regime alimentaire</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { label: "Omnivore", value: "omnivore" as const },
                  { label: "Vegetarien", value: "vegetarian" as const },
                  { label: "Vegan", value: "vegan" as const },
                  { label: "Pescetarien", value: "pescatarian" as const }
                ].map((diet) => (
                  <button
                    key={diet.value}
                    className={`rounded-lg border px-3 py-3 text-sm transition ${
                      profile.diet === diet.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700"
                    }`}
                    type="button"
                    onClick={() => updateProfile("diet", diet.value)}
                  >
                    {diet.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <div>
                <p className="font-medium">Mode actuel</p>
                <p className="text-sm text-slate-500">
                  {profile.appMode === "athlete" ? "Sportif / Macros" : "Grand public"}
                </p>
              </div>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => updateMode("general_public")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    profile.appMode === "general_public" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Grand public
                </button>
                <button
                  type="button"
                  onClick={() => updateMode("athlete")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    profile.appMode === "athlete" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Sportif / macros
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-3">
            <Target className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold">Objectifs & donnees physiques</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span>Age</span>
              <input
                type="number"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.age}
                onChange={(event) => updateProfile("age", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Poids (kg)</span>
              <input
                type="number"
                step="0.1"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.weightKg}
                onChange={(event) => updateProfile("weightKg", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Taille (cm)</span>
              <input
                type="number"
                step="0.1"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.heightCm}
                onChange={(event) => updateProfile("heightCm", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Sexe</span>
              <select
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.sex}
                onChange={(event) => updateProfile("sex", event.target.value as SettingsProfile["sex"])}
              >
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">IMC</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatBmi(bmi)}</p>
              <p className="mt-1 text-sm text-slate-500">{getBmiLabel(bmi)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Besoin calorique</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatCalories(maintenanceCalories)}</p>
              <p className="mt-1 text-sm text-slate-500">Base quotidienne estimée</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Objectif quotidien</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatCalories(targetCalories)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {getGoalLabel(profile.goal)} {profile.dailyCaloriesAdjustment > 0 ? `(+${profile.dailyCaloriesAdjustment})` : `(${profile.dailyCaloriesAdjustment})`}
              </p>
            </div>
          </div>

          {showAdvanced ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Options avancées</p>
                  <p className="text-sm text-slate-500">Réglages utiles si vous voulez suivre un objectif sportif.</p>
                </div>
                {profile.appMode !== "athlete" ? (
                  <Button variant="secondary" type="button" className="gap-2" onClick={() => setAdvancedOpen(false)}>
                    <ChevronUp className="h-4 w-4" />
                    Masquer
                  </Button>
                ) : (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    Actif en mode sportif
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>Objectif</span>
                  <select
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
                    value={profile.goal}
                    onChange={(event) => updateGoal(event.target.value as SettingsProfile["goal"])}
                  >
                    <option value="mass_gain">Prise de masse</option>
                    <option value="cut">Sèche</option>
                    <option value="maintenance">Maintien normal</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span>Calories supplémentaires quotidiennes</span>
                  <input
                    type="number"
                    step="25"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={profile.goal === "maintenance" ? 0 : profile.dailyCaloriesAdjustment}
                    disabled={profile.goal === "maintenance"}
                    onChange={(event) => updateProfile("dailyCaloriesAdjustment", Number(event.target.value) || 0)}
                  />
                </label>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {profile.goal === "mass_gain"
                  ? "Par défaut, la prise de masse ajoute 300 kcal par jour."
                  : profile.goal === "cut"
                    ? "Par défaut, la sèche retire 200 kcal par jour."
                    : "Le maintien normal laisse l'ajustement à 0 kcal."}
              </p>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div>
                <p className="font-semibold">Options avancées</p>
                <p className="text-sm text-slate-500">
                  Objectif et ajustement calorique visibles uniquement en mode sportif ou via cette option.
                </p>
              </div>
              <Button variant="secondary" type="button" className="gap-2" onClick={() => setAdvancedOpen(true)}>
                <ChevronDown className="h-4 w-4" />
                Afficher
              </Button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {status ?? "Les paramètres sont enregistrés localement et chaque sauvegarde est ajoutée à l'historique."}
            </p>
            <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

