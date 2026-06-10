"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Download, History, KeyRound, LogOut, RotateCcw, Settings, Target, Trash2, UsersRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { HistoryView } from "@/features/history/HistoryView";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearBrowserAccountStatusCache } from "@/lib/supabase/browser-account";
import { getBrowserAuthHeaders } from "@/lib/supabase/browser-auth";
import { buildAccountStorageKey } from "@/lib/account-storage";
import { routes } from "@/lib/routes";
import { buildSettingsChangeSummary, calculateBmi, calculateMaintenanceCalories, calculateTargetCalories, defaultSettingsProfile, formatBmi, formatCalories, getBmiLabel, getGoalDefaultAdjustment, getGoalLabel, type SettingsProfile } from "@/lib/settings";
import { applyThemePreference, isThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const STORAGE_KEY = "ecofoodstock:settings-profile";

type SettingsSection = "household" | "personal" | "history" | "account" | "application";

const settingsSectionConfigs: Record<SettingsSection, { title: string; description: string; icon: LucideIcon }> = {
  household: {
    title: "Mon profil & foyer",
    description: "Mode, regime, taille du foyer et invitations.",
    icon: UsersRound
  },
  personal: {
    title: "Infos perso & objectifs",
    description: "Age, poids, taille et objectifs nutritionnels.",
    icon: Target
  },
  history: {
    title: "Historique",
    description: "Actions du stock, des courses et des parametres.",
    icon: History
  },
  account: {
    title: "Compte & securite",
    description: "Mot de passe, export, deconnexion et suppression.",
    icon: KeyRound
  },
  application: {
    title: "Application",
    description: "Theme, cache local et donnees temporaires.",
    icon: Settings
  }
};

export function SettingsView() {
  const router = useRouter();
  const [profile, setProfile] = useState<SettingsProfile>(defaultSettingsProfile);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountActionStatus, setAccountActionStatus] = useState<string | null>(null);
  const baselineRef = useRef<SettingsProfile>(defaultSettingsProfile);

  useEffect(() => {
    let active = true;

    async function hydrateProfile() {
      let nextStorageKey = buildAccountStorageKey(STORAGE_KEY, null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        nextStorageKey = buildAccountStorageKey(STORAGE_KEY, data.session?.user?.id ?? null);
        setAccountEmail(data.session?.user?.email ?? null);
      } catch {
        nextStorageKey = STORAGE_KEY;
      }

      if (!active) {
        return;
      }

      setStorageKey(nextStorageKey);

      const storedThemePreference = window.localStorage.getItem(THEME_STORAGE_KEY);
      const nextThemePreference = isThemePreference(storedThemePreference) ? storedThemePreference : "system";
      setThemePreference(nextThemePreference);
      applyThemePreference(nextThemePreference);

      const storedProfile = readStoredProfile([nextStorageKey, STORAGE_KEY]);

      if (storedProfile) {
        setProfile(storedProfile);
        baselineRef.current = storedProfile;
        setAdvancedOpen(storedProfile.appMode === "athlete");
      }

      setLoaded(true);
    }

    void hydrateProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function syncSystemTheme() {
      if (themePreference === "system") {
        applyThemePreference("system");
      }
    }

    mediaQuery.addEventListener("change", syncSystemTheme);
    return () => mediaQuery.removeEventListener("change", syncSystemTheme);
  }, [themePreference]);

  const bmi = useMemo(() => calculateBmi(profile), [profile]);
  const maintenanceCalories = useMemo(() => calculateMaintenanceCalories(profile), [profile]);
  const targetCalories = useMemo(() => calculateTargetCalories(profile), [profile]);
  const showAdvanced = profile.appMode === "athlete" || advancedOpen;
  const activeSectionConfig = activeSection ? settingsSectionConfigs[activeSection] : null;

  async function saveSettings() {
    setSaving(true);
    setStatus(null);

    try {
      persistProfileLocally(profile);
      const authHeaders = await getBrowserAuthHeaders();

      const settingsResponse = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(profile)
      });

      if (!settingsResponse.ok) {
        throw new Error(`HTTP ${settingsResponse.status}`);
      }

      const changes = buildSettingsChangeSummary(baselineRef.current, profile);

      if (changes !== "Aucune modification") {
        const historyResponse = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            type: "product_adjusted",
            title: "Paramètres mis à jour",
            description: `${changes}. IMC ${formatBmi(bmi)}, besoin ${formatCalories(maintenanceCalories)}, objectif ${getGoalLabel(profile.goal)} (${profile.dailyCaloriesAdjustment > 0 ? "+" : ""}${profile.dailyCaloriesAdjustment} kcal).`,
            canUndo: true,
            metadata: {
              section: "settings",
              previous_profile: baselineRef.current,
              next_profile: profile
            }
          })
        });

        baselineRef.current = profile;
        setStatus(
          historyResponse.ok
            ? "Parametres enregistres et ajoutes a l'historique."
            : "Parametres enregistres, mais l'historique n'a pas pu etre mis a jour."
        );
        return;
      }

      baselineRef.current = profile;
      setStatus("Paramètres enregistrés.");
    } catch {
      setStatus("Impossible d'enregistrer les paramètres pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  function persistProfileLocally(nextProfile: SettingsProfile) {
    const nextStorageKey = storageKey ?? STORAGE_KEY;
    window.localStorage.setItem(nextStorageKey, JSON.stringify(nextProfile));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
  }

  function updateProfile<K extends keyof SettingsProfile>(key: K, value: SettingsProfile[K]) {
    setProfile((current) => {
      const nextProfile = { ...current, [key]: value };
      persistProfileLocally(nextProfile);
      return nextProfile;
    });
  }

  function updateGoal(goal: SettingsProfile["goal"]) {
    setProfile((current) => {
      const nextProfile = {
        ...current,
        goal,
        dailyCaloriesAdjustment: goal === "maintenance" ? 0 : getGoalDefaultAdjustment(goal)
      };
      persistProfileLocally(nextProfile);
      return nextProfile;
    });
  }

  function updateMode(appMode: SettingsProfile["appMode"]) {
    setProfile((current) => {
      const nextProfile = { ...current, appMode };
      persistProfileLocally(nextProfile);
      return nextProfile;
    });

    if (appMode === "athlete") {
      setAdvancedOpen(true);
    }
  }

  function updateThemePreference(preference: ThemePreference) {
    setThemePreference(preference);
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    applyThemePreference(preference);
  }

  async function generateInvite() {
    setGeneratingInvite(true);
    setStatus(null);
    setInviteToken(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setStatus("Veuillez vous connecter pour générer une invitation.");
        return;
      }

      const res = await fetch("/api/household/invite", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error ?? "Impossible de generer l'invitation.");
        return;
      }

      setInviteToken(json.token);
      setInviteExpiresAt(json.expires_at || null);
      setStatus("Invitation generee.");
    } catch {
      setStatus("Erreur lors de la generation de l'invitation.");
    } finally {
      setGeneratingInvite(false);
    }
  }

  function copyInvite() {
    if (!inviteToken) return;
    const url = `${window.location.origin}/join?token=${encodeURIComponent(inviteToken)}`;
    navigator.clipboard.writeText(url).then(() => setStatus("Lien d'invitation copie."));
  }

  async function signOut() {
    setSigningOut(true);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      clearBrowserAccountStatusCache();
      router.replace(routes.login);
    } catch {
      setStatus("Impossible de vous deconnecter pour le moment.");
    } finally {
      setSigningOut(false);
    }
  }

  async function clearLocalCache() {
    setClearingCache(true);
    setStatus(null);

    try {
      await Promise.all([
        clearCacheStorage(),
        unregisterServiceWorkers()
      ]);

      clearEcoFoodStockStorage(window.localStorage);
      clearEcoFoodStockStorage(window.sessionStorage);
      clearBrowserAccountStatusCache();
      setInviteToken(null);
      setInviteExpiresAt(null);
      setStatus("Cache local vide. Rechargez la page pour repartir sur un etat propre.");
    } catch {
      setStatus("Impossible de vider tout le cache local pour le moment.");
    } finally {
      setClearingCache(false);
    }
  }

  async function exportAccountData() {
    setExportingData(true);
    setAccountActionStatus(null);

    try {
      const headers = await getBrowserAuthHeaders();

      if (!headers.Authorization) {
        router.replace(routes.login);
        return;
      }

      const response = await fetch("/api/account/export", {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible d'exporter les donnees pour le moment.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ecofoodstock-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setAccountActionStatus("Export CSV telecharge.");
    } catch (error) {
      setAccountActionStatus((error as Error).message ?? "Impossible d'exporter les donnees pour le moment.");
    } finally {
      setExportingData(false);
    }
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      "Cette action supprimera definitivement votre compte EcoFoodStock. Si vous etes le seul membre du foyer, les donnees du foyer seront aussi supprimees. Continuer ?"
    );

    if (!confirmed) {
      return;
    }

    const typedConfirmation = window.prompt("Tapez supprimer pour confirmer la suppression definitive du compte.");

    if (typedConfirmation?.trim().toLocaleLowerCase("fr-FR") !== "supprimer") {
      setAccountActionStatus("Suppression annulee.");
      return;
    }

    setDeletingAccount(true);
    setAccountActionStatus(null);

    try {
      const headers = await getBrowserAuthHeaders();

      if (!headers.Authorization) {
        router.replace(routes.login);
        return;
      }

      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? payload?.error ?? "Impossible de supprimer le compte pour le moment.");
      }

      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        // The auth user may already be deleted server-side.
      }

      clearEcoFoodStockStorage(window.localStorage);
      clearEcoFoodStockStorage(window.sessionStorage);
      await clearCacheStorage();
      clearBrowserAccountStatusCache();
      router.replace(routes.login);
    } catch (error) {
      setAccountActionStatus((error as Error).message ?? "Impossible de supprimer le compte pour le moment.");
    } finally {
      setDeletingAccount(false);
    }
  }

  async function updatePassword() {
    setPasswordStatus(null);

    if (newPassword.length < 8) {
      setPasswordStatus("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      setPasswordStatus("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setChangingPassword(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace(routes.login);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      setNewPassword("");
      setNewPasswordConfirmation("");
      setPasswordStatus("Mot de passe mis a jour.");
    } catch (error) {
      setPasswordStatus((error as Error).message ?? "Impossible de modifier le mot de passe pour le moment.");
    } finally {
      setChangingPassword(false);
    }
  }

  function renderActiveSection() {
    if (activeSection === "household") {
      return (
        <div className="space-y-6">
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

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="border-t border-slate-100 pt-5">
            <p className="font-semibold">Invitations</p>
            <p className="mt-1 text-sm text-slate-600">Invitez des membres dans votre foyer en generant un lien.</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={() => void generateInvite()} disabled={generatingInvite}>
                {generatingInvite ? "Generation..." : "Generer une invitation"}
              </Button>

              {inviteToken ? (
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    readOnly
                    className="h-11 min-w-0 flex-1 rounded-lg border px-3"
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?token=${inviteToken}`}
                  />
                  <Button variant="secondary" onClick={copyInvite}>
                    Copier
                  </Button>
                </div>
              ) : null}
            </div>

            {inviteExpiresAt ? <p className="mt-2 text-xs text-slate-500">Expire le {new Date(inviteExpiresAt).toLocaleString()}</p> : null}
          </div>
        </div>
      );
    }

    if (activeSection === "personal") {
      return (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <label className="space-y-2 text-sm">
              <span>Age</span>
              <input
                type="number"
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.age}
                onChange={(event) => updateProfile("age", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Poids (kg)</span>
              <input
                type="number"
                step="0.1"
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.weightKg}
                onChange={(event) => updateProfile("weightKg", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Taille (cm)</span>
              <input
                type="number"
                step="0.1"
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.heightCm}
                onChange={(event) => updateProfile("heightCm", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Sexe</span>
              <select
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
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
              <p className="mt-1 text-sm text-slate-500">Base quotidienne estimee</p>
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
                  <p className="font-semibold">Options avancees</p>
                  <p className="text-sm text-slate-500">Reglages utiles si vous voulez suivre un objectif sportif.</p>
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
                    <option value="cut">Seche</option>
                    <option value="maintenance">Maintien normal</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span>Calories supplementaires quotidiennes</span>
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
                  ? "Par defaut, la prise de masse ajoute 300 kcal par jour."
                  : profile.goal === "cut"
                    ? "Par defaut, la seche retire 200 kcal par jour."
                    : "Le maintien normal laisse l'ajustement a 0 kcal."}
              </p>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div>
                <p className="font-semibold">Options avancees</p>
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
              {status ?? "Les parametres sont enregistres localement et chaque sauvegarde est ajoutee a l'historique."}
            </p>
            <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer les parametres"}
            </Button>
          </div>
        </div>
      );
    }

    if (activeSection === "history") {
      return <HistoryView embedded />;
    }

    if (activeSection === "account") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-brand-700" />
              <div>
                <p className="font-semibold text-slate-950">Modifier le mot de passe</p>
                {accountEmail ? <p className="mt-1 text-sm text-slate-600">{accountEmail}</p> : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>Nouveau mot de passe</span>
                <input
                  type="password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>Confirmer le mot de passe</span>
                <input
                  type="password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                  value={newPasswordConfirmation}
                  onChange={(event) => setNewPasswordConfirmation(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {passwordStatus ? <p className="text-sm font-medium text-slate-700">{passwordStatus}</p> : <span />}
              <Button
                type="button"
                className="gap-2 sm:shrink-0"
                onClick={() => void updatePassword()}
                disabled={changingPassword}
              >
                <KeyRound className="h-4 w-4" />
                {changingPassword ? "Mise a jour..." : "Mettre a jour"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">Exporter mes donnees</p>
              <p className="mt-1 text-sm text-slate-600">
                Telechargez un fichier CSV avec votre profil, vos preferences, votre inventaire, vos courses et votre historique.
              </p>
              {accountActionStatus ? <p className="mt-2 text-sm font-medium text-slate-700">{accountActionStatus}</p> : null}
            </div>
            <Button
              variant="secondary"
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => void exportAccountData()}
              disabled={exportingData || deletingAccount || signingOut || clearingCache}
            >
              <Download className="h-4 w-4" />
              {exportingData ? "Export..." : "Exporter en CSV"}
            </Button>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">Se deconnecter</p>
              <p className="mt-1 text-sm text-slate-600">Fermer la session sur cet appareil.</p>
            </div>
            <Button
              variant="secondary"
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => void signOut()}
              disabled={signingOut || clearingCache || deletingAccount || exportingData}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Deconnexion..." : "Se deconnecter"}
            </Button>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-rose-950">Supprimer mon compte definitivement</p>
              <p className="mt-1 text-sm text-rose-800">
                Cette action supprime votre compte, vos donnees personnelles et votre foyer si vous en etes le seul membre.
              </p>
              {accountActionStatus ? <p className="mt-2 text-sm font-medium text-rose-800">{accountActionStatus}</p> : null}
            </div>
            <Button
              variant="danger"
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => void deleteAccount()}
              disabled={deletingAccount || exportingData || signingOut || clearingCache}
            >
              <Trash2 className="h-4 w-4" />
              {deletingAccount ? "Suppression..." : "Supprimer mon compte"}
            </Button>
          </div>
        </div>
      );
    }

    if (activeSection === "application") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <p className="font-semibold text-slate-950">Apparence</p>
              <p className="mt-1 text-sm text-slate-600">
                Choisissez un theme clair, sombre, ou suivez le reglage de votre appareil.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                { label: "Clair", value: "light" as const },
                { label: "Sombre", value: "dark" as const },
                { label: "Systeme", value: "system" as const }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`h-10 rounded-lg px-2 text-sm font-semibold transition ${
                    themePreference === option.value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => updateThemePreference(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">Vider le cache local</p>
              <p className="mt-1 text-sm text-slate-600">Nettoyer les donnees temporaires conservees sur cet appareil.</p>
            </div>
            <Button
              variant="secondary"
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => void clearLocalCache()}
              disabled={clearingCache || signingOut}
            >
              <RotateCcw className="h-4 w-4" />
              {clearingCache ? "Nettoyage..." : "Vider le cache local"}
            </Button>
          </div>
        </div>
      );
    }

    return null;
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

      {status ? (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          {status}
        </div>
      ) : null}

      <div className="overflow-hidden">
        <div
          className={`flex w-[200%] transition-transform duration-300 ease-out ${
            activeSection ? "-translate-x-1/2" : "translate-x-0"
          }`}
        >
          <div className="w-1/2 shrink-0 space-y-3">
        <SettingsCategory
          title="Mon profil & foyer"
          description="Mode, regime, taille du foyer et invitations."
          icon={UsersRound}
          open={activeSection === "household"}
          onToggle={() => setActiveSection("household")}
        >
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

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-5 flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-bold">Invitations</h2>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600">Invitez des membres dans votre foyer en generant un lien.</p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={() => void generateInvite()} disabled={generatingInvite}>
                  {generatingInvite ? "Génération..." : "Generer une invitation"}
                </Button>

                {inviteToken ? (
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      className="h-11 rounded-lg border px-3"
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?token=${inviteToken}`}
                    />
                    <Button variant="secondary" onClick={copyInvite}>
                      Copier
                    </Button>
                  </div>
                ) : null}
              </div>

              {inviteExpiresAt ? <p className="text-xs text-slate-500">Expire le {new Date(inviteExpiresAt).toLocaleString()}</p> : null}
            </div>
          </div>
        </SettingsCategory>

        <SettingsCategory
          title="Application"
          description="Cache local et donnees temporaires."
          icon={Settings}
          open={activeSection === "application"}
          onToggle={() => setActiveSection("application")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="secondary"
              type="button"
              className="gap-2"
              onClick={() => void clearLocalCache()}
              disabled={clearingCache || signingOut}
            >
              <RotateCcw className="h-4 w-4" />
              {clearingCache ? "Nettoyage..." : "Vider le cache local"}
            </Button>

            <Button
              variant="danger"
              type="button"
              className="gap-2"
              onClick={() => void signOut()}
              disabled={signingOut || clearingCache}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Deconnexion..." : "Se deconnecter"}
            </Button>
          </div>
        </SettingsCategory>

        <SettingsCategory
          title="Infos perso & objectifs"
          description="Age, poids, taille, calculs nutritionnels et objectif sportif."
          icon={Target}
          open={activeSection === "personal"}
          onToggle={() => setActiveSection("personal")}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <label className="space-y-2 text-sm">
              <span>Age</span>
              <input
                type="number"
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.age}
                onChange={(event) => updateProfile("age", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Poids (kg)</span>
              <input
                type="number"
                step="0.1"
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.weightKg}
                onChange={(event) => updateProfile("weightKg", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Taille (cm)</span>
              <input
                type="number"
                step="0.1"
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
                value={profile.heightCm}
                onChange={(event) => updateProfile("heightCm", Number(event.target.value) || 0)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>Sexe</span>
              <select
                className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3"
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
        </SettingsCategory>

        <SettingsCategory
          title="Historique"
          description="Consulter les actions du stock, des courses et des parametres."
          icon={History}
          open={activeSection === "history"}
          onToggle={() => setActiveSection("history")}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">Historique d'activite</p>
              <p className="mt-1 text-sm text-slate-600">
                Les modifications de parametres enregistrees apparaissent ici avec les autres actions.
              </p>
            </div>
            <Button
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => router.push(routes.history)}
            >
              <History className="h-4 w-4" />
              Ouvrir l'historique
            </Button>
          </div>
        </SettingsCategory>

        <SettingsCategory
          title="Compte & securite"
          description="Mot de passe, export, deconnexion et suppression."
          icon={KeyRound}
          open={activeSection === "account"}
          onToggle={() => setActiveSection("account")}
        >
          <div className="mb-4 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">Exporter mes donnees</p>
              <p className="mt-1 text-sm text-slate-600">
                Telechargez un fichier CSV avec votre profil, vos preferences, votre inventaire, vos courses et votre historique.
              </p>
              {accountActionStatus ? <p className="mt-2 text-sm font-medium text-slate-700">{accountActionStatus}</p> : null}
            </div>
            <Button
              variant="secondary"
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => void exportAccountData()}
              disabled={exportingData || deletingAccount || signingOut || clearingCache}
            >
              <Download className="h-4 w-4" />
              {exportingData ? "Export..." : "Exporter en CSV"}
            </Button>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-rose-950">Supprimer mon compte definitivement</p>
              <p className="mt-1 text-sm text-rose-800">
                Cette action supprime votre compte, vos donnees personnelles et votre foyer si vous en etes le seul membre.
              </p>
              {accountActionStatus ? <p className="mt-2 text-sm font-medium text-rose-800">{accountActionStatus}</p> : null}
            </div>
            <Button
              variant="danger"
              type="button"
              className="gap-2 sm:shrink-0"
              onClick={() => void deleteAccount()}
              disabled={deletingAccount || exportingData || signingOut || clearingCache}
            >
              <Trash2 className="h-4 w-4" />
              {deletingAccount ? "Suppression..." : "Supprimer mon compte"}
            </Button>
          </div>
        </SettingsCategory>
          </div>

          <div className="w-1/2 shrink-0">
            {activeSectionConfig ? (
              <SettingsDetailShell
                description={activeSectionConfig.description}
                icon={activeSectionConfig.icon}
                title={activeSectionConfig.title}
                onBack={() => setActiveSection(null)}
              >
                {renderActiveSection()}
              </SettingsDetailShell>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCategory({
  description,
  icon: Icon,
  onToggle,
  open,
  title
}: {
  children?: ReactNode;
  description: string;
  icon: LucideIcon;
  onToggle: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950">{title}</span>
            <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
      </button>
    </section>
  );
}

function SettingsDetailShell({
  children,
  description,
  icon: Icon,
  onBack,
  title
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  onBack: () => void;
  title: string;
}) {
  return (
    <section className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <Button
          variant="ghost"
          type="button"
          className="h-10 w-10 shrink-0 px-0"
          aria-label="Revenir aux parametres"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 items-start gap-3">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:flex">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}

function clearEcoFoodStockStorage(storage: Storage) {
  const keysToDelete: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key?.startsWith("ecofoodstock:") || key?.startsWith("ecofoodstock-")) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => storage.removeItem(key));
}

function readStoredProfile(keys: string[]) {
  for (const key of keys) {
    const stored = window.localStorage.getItem(key);

    if (!stored) {
      continue;
    }

    try {
      return JSON.parse(stored) as SettingsProfile;
    } catch {
      // Ignore stale local settings and keep looking for a usable fallback.
    }
  }

  return null;
}

async function clearCacheStorage() {
  if (!("caches" in window)) {
    return;
  }

  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

