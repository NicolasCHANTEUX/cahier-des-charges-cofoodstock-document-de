"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBrowserAccountStatus } from "@/lib/supabase/browser-account";
import { routes } from "@/lib/routes";

export function AuthGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const loginUrl = () => `${routes.login}?next=${encodeURIComponent(getCurrentPath())}`;

    async function handleSession(session: unknown) {
      if (!active) {
        return;
      }

      if (!session) {
        setAuthorized(false);
        router.replace(loginUrl());
        return;
      }

      const status = await getBrowserAccountStatus();

      if (!active) {
        return;
      }

      if (!status.onboardingCompleted && window.location.pathname !== routes.onboarding) {
        setAuthorized(false);
        router.replace(routes.onboarding);
        return;
      }

      setAuthorized(true);
    }

    try {
      const supabase = createSupabaseBrowserClient();

      supabase.auth.getSession().then(({ data }) => {
        void handleSession(data.session);
      });

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        void handleSession(session);
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      router.replace(routes.login);
    }

    return () => {
      active = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
        <p className="text-sm font-medium text-slate-600">Vérification de la session...</p>
      </main>
    );
  }

  return <>{children}</>;
}

function getCurrentPath() {
  return `${window.location.pathname}${window.location.search}`;
}
