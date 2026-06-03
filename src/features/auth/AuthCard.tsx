"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Box } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getBrowserAccountStatus } from "@/lib/supabase/browser-account";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

export function AuthCard() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");
  const nextPath = searchParams.get("next");
  const safeNextPath = useMemo(() => getSafeRedirectTarget(nextPath), [nextPath]);

  useEffect(() => {
    let active = true;

    async function redirectAuthenticatedUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();

        if (!active || !data.session) {
          return;
        }

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
  }, [inviteToken, router, safeNextPath]);

  async function handleOAuth(provider: "google" | "apple") {
    try {
      setLoading(true);
      setErrorMessage(null);
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
            `${provider === "google" ? "Google" : "Apple"} n'est pas activé dans Supabase. Activez ce provider dans Authentication > Providers.`
          );
        }

        throw error;
      }
    } catch (err) {
      const message = (err as Error).message ?? "Erreur OAuth";
      if (message.toLowerCase().includes("provider is not enabled") || message.toLowerCase().includes("unsupported provider")) {
        setErrorMessage("Google/Apple n'est pas activé dans Supabase. Activez le provider dans le dashboard ou utilisez l'email.");
        return;
      }

      setErrorMessage(message);
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
          body: JSON.stringify({ email, password, inviteToken, full_name: fullName.trim() })
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "La création du compte a échoué.");
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          if (signInError.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("Votre compte a été créé, mais l'email doit être confirmé dans Supabase. Activez l'autoconfirmation ou confirmez ce compte dans le dashboard.");
          }

          throw signInError;
        }

        setSuccessMessage("Compte créé. Redirection...");
        router.push(routes.onboarding);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setSuccessMessage("Connexion réussie. Redirection...");
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

        <div className="space-y-3">
          <Button variant="secondary" className="w-full" onClick={() => handleOAuth("google")} disabled={loading}>
            Continuer avec Google
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => handleOAuth("apple")} disabled={loading}>
            Continuer avec Apple
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {errorMessage ? (
            <div role="alert" aria-live="assertive" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div role="status" aria-live="polite" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
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
            <button className="text-sm font-medium text-brand-700" type="button">
              Mot de passe oublie ?
            </button>
          </div>
          <Button className="w-full" type="submit" disabled={loading}>{isSignUp ? "Creer un compte" : "Se connecter"}</Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          {isSignUp ? (
            <>
              Déjà un compte ? <button className="font-semibold text-brand-700" onClick={() => setIsSignUp(false)}>Se connecter</button>
            </>
          ) : (
            <>
              Pas encore de compte ? <button className="font-semibold text-brand-700" onClick={() => setIsSignUp(true)}>Creer un compte</button>
            </>
          )}
        </p>
      </Card>
    </main>
  );
}

function getSafeRedirectTarget(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return routes.dashboard;
  }

  return value;
}
