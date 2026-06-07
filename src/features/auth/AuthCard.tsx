"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Box } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getBrowserAccountStatus } from "@/lib/supabase/browser-account";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

const LEGAL_TERMS_VERSION = "2026-06-07";
const PRIVACY_POLICY_VERSION = "2026-06-07";
const PENDING_LEGAL_CONSENT_KEY = "ecofoodstock:pending-legal-consent";

export function AuthCard() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");
  const nextPath = searchParams.get("next");
  const safeNextPath = useMemo(() => getSafeRedirectTarget(nextPath), [nextPath]);
  const isRecoverySearch = searchParams.get("reset") === "1" || searchParams.get("type") === "recovery";
  const [passwordResetMode, setPasswordResetMode] = useState(isRecoverySearch);

  useEffect(() => {
    if (isRecoverySearch || window.location.hash.includes("type=recovery")) {
      setPasswordResetMode(true);
    }
  }, [isRecoverySearch]);

  useEffect(() => {
    let active = true;

    async function redirectAuthenticatedUser() {
      if (passwordResetMode || isRecoverySearch || window.location.hash.includes("type=recovery")) {
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();

        if (!active || !data.session) {
          return;
        }

        await syncPendingLegalConsent(data.session.access_token);

        const status = await getBrowserAccountStatus();
        const target = status.onboardingCompleted ? safeNextPath : routes.onboarding;

        router.replace(inviteToken ? `/join?token=${encodeURIComponent(inviteToken)}` : target);
      } catch {
        // Missing Supabase variables are handled when the user submits the form.
      }
    }

    void redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [inviteToken, isRecoverySearch, passwordResetMode, router, safeNextPath]);

  async function handleOAuth(provider: "google" | "apple") {
    if (!acceptedLegalTerms) {
      setErrorMessage("Cochez l'acceptation des CGU et de la politique de confidentialite avant de continuer avec Google ou Apple.");
      setSuccessMessage(null);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      savePendingLegalConsent();

      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}${inviteToken ? `/join?token=${encodeURIComponent(inviteToken)}` : safeNextPath}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      });

      if (error) {
        const lowerMessage = error.message.toLowerCase();
        if (lowerMessage.includes("unsupported provider") || lowerMessage.includes("provider is not enabled") || error.status === 400) {
          throw new Error(
            `${provider === "google" ? "Google" : "Apple"} n'est pas active dans Supabase. Activez ce provider dans Authentication > Providers.`
          );
        }

        throw error;
      }
    } catch (err) {
      window.localStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
      const message = (err as Error).message ?? "Erreur OAuth";
      if (message.toLowerCase().includes("provider is not enabled") || message.toLowerCase().includes("unsupported provider")) {
        setErrorMessage("Google/Apple n'est pas active dans Supabase. Activez le provider dans le dashboard ou utilisez l'email.");
        return;
      }

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErrorMessage("Renseignez votre email, puis relancez la reinitialisation du mot de passe.");
      setSuccessMessage(null);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}${routes.login}?reset=1`
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Email envoye. Ouvrez le lien recu pour choisir un nouveau mot de passe.");
    } catch (err) {
      setErrorMessage((err as Error).message ?? "Impossible d'envoyer l'email de reinitialisation.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      setLoading(false);
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        throw new Error("Le lien de reinitialisation a expire. Relancez la demande depuis l'ecran de connexion.");
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
      window.history.replaceState(null, "", routes.login);
      setPasswordResetMode(false);
      setPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      setSuccessMessage("Mot de passe mis a jour. Vous pouvez vous reconnecter.");
    } catch (err) {
      setErrorMessage((err as Error).message ?? "Impossible de mettre a jour le mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isSignUp && !fullName.trim()) {
      setErrorMessage("Nom et prenom requis.");
      setLoading(false);
      return;
    }

    if (isSignUp && !acceptedLegalTerms) {
      setErrorMessage("Vous devez accepter les CGU et la politique de confidentialite pour creer un compte.");
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setErrorMessage("Email et mot de passe requis.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignUp) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            inviteToken,
            full_name: fullName.trim(),
            acceptedLegalTerms,
            legalTermsVersion: LEGAL_TERMS_VERSION,
            privacyPolicyVersion: PRIVACY_POLICY_VERSION
          })
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "La creation du compte a echoue.");
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          if (signInError.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("Votre compte a ete cree, mais l'email doit etre confirme dans Supabase. Activez l'autoconfirmation ou confirmez ce compte dans le dashboard.");
          }

          throw signInError;
        }

        setSuccessMessage("Compte cree. Redirection...");
        router.push(routes.onboarding);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setSuccessMessage("Connexion reussie. Redirection...");
      const status = await getBrowserAccountStatus();
      const target = status.onboardingCompleted ? safeNextPath : routes.onboarding;

      router.push(inviteToken ? `/join?token=${encodeURIComponent(inviteToken)}` : target);
    } catch (err) {
      const msg = (err as Error).message ?? "Erreur d'authentification";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <Card className="w-full max-w-md p-8 shadow-soft">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <Box className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">EcoFoodStock</h1>
          <p className="mt-2 text-sm text-slate-600">Gerez votre stock, evitez le gaspillage</p>
        </div>

        {errorMessage ? (
          <div role="alert" aria-live="assertive" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div role="status" aria-live="polite" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {passwordResetMode ? (
          <form className="space-y-4" onSubmit={handlePasswordUpdate}>
            <p className="text-sm text-slate-600">
              Choisissez un nouveau mot de passe pour finaliser la reinitialisation.
            </p>
            <input
              className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
              placeholder="Nouveau mot de passe"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
              placeholder="Confirmer le mot de passe"
              type="password"
              value={newPasswordConfirmation}
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
            />
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Mise a jour..." : "Mettre a jour le mot de passe"}
            </Button>
            <button
              className="w-full text-sm font-semibold text-brand-700"
              type="button"
              onClick={() => {
                window.history.replaceState(null, "", routes.login);
                setPasswordResetMode(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Revenir a la connexion
            </button>
          </form>
        ) : (
          <>
            <div className="space-y-3">
              <Button variant="secondary" className="w-full" onClick={() => handleOAuth("google")} disabled={loading}>
                Continuer avec Google
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => handleOAuth("apple")} disabled={loading}>
                Continuer avec Apple
              </Button>
            </div>

            <div className="mt-4">
              <LegalConsentCheckbox accepted={acceptedLegalTerms} onChange={setAcceptedLegalTerms} />
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              ou
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignUp ? (
                <input
                  className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
                  placeholder="Nom et prenom"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              ) : null}
              <input
                className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
                placeholder="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right">
                <button className="text-sm font-medium text-brand-700 disabled:text-slate-400" type="button" onClick={() => void handleForgotPassword()} disabled={loading}>
                  Mot de passe oublie ?
                </button>
              </div>
              <Button className="w-full" type="submit" disabled={loading}>{isSignUp ? "Creer un compte" : "Se connecter"}</Button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              {isSignUp ? (
                <>
                  Deja un compte ? <button className="font-semibold text-brand-700" onClick={() => setIsSignUp(false)}>Se connecter</button>
                </>
              ) : (
                <>
                  Pas encore de compte ? <button className="font-semibold text-brand-700" onClick={() => setIsSignUp(true)}>Creer un compte</button>
                </>
              )}
            </p>
          </>
        )}
      </Card>
    </main>
  );
}

function LegalConsentCheckbox({
  accepted,
  onChange
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-600">
      <input
        checked={accepted}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        J'accepte les{" "}
        <a className="font-semibold text-brand-700 underline-offset-2 hover:underline" href="/legal/terms" target="_blank" rel="noreferrer">
          CGU
        </a>{" "}
        et la{" "}
        <a className="font-semibold text-brand-700 underline-offset-2 hover:underline" href="/legal/privacy" target="_blank" rel="noreferrer">
          politique de confidentialite
        </a>
        . Cette acceptation est necessaire pour creer un compte ou continuer avec Google/Apple.
      </span>
    </label>
  );
}

function savePendingLegalConsent() {
  window.localStorage.setItem(
    PENDING_LEGAL_CONSENT_KEY,
    JSON.stringify({
      acceptedAt: new Date().toISOString(),
      legalTermsVersion: LEGAL_TERMS_VERSION,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION
    })
  );
}

async function syncPendingLegalConsent(accessToken: string) {
  const stored = window.localStorage.getItem(PENDING_LEGAL_CONSENT_KEY);

  if (!stored) {
    return;
  }

  try {
    const consent = JSON.parse(stored) as {
      acceptedAt?: string;
      legalTermsVersion?: string;
      privacyPolicyVersion?: string;
    };

    const response = await fetch("/api/account/legal-consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(consent)
    });

    if (response.ok) {
      window.localStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
    }
  } catch {
    window.localStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
  }
}

function getSafeRedirectTarget(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return routes.dashboard;
  }

  return value;
}
