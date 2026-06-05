"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type InstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallPromptChoice>;
};

const DISMISSED_STORAGE_KEY = "ecofoodstock-pwa-install-dismissed";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }

    const dismissed = window.localStorage.getItem(DISMISSED_STORAGE_KEY) === "1";

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);

      if (!dismissed) {
        setVisible(true);
      }
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setVisible(false);
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!visible || !installPrompt) {
    return null;
  }

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    const promptEvent = installPrompt;
    setVisible(false);
    setInstallPrompt(null);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === "dismissed") {
        window.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
      }
    } catch {
      // Browser install prompts are optional and can be unavailable.
    }
  }

  function dismissPrompt() {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:right-4 sm:bottom-4 sm:w-96">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">Installer EcoFoodStock</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Ajoute l'app a ton ecran d'accueil pour l'ouvrir sans la barre du navigateur.</p>
          <Button className="mt-3 h-9 px-3 text-xs" onClick={() => void installApp()}>
            Installer
          </Button>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Masquer l'invite d'installation"
          onClick={dismissPrompt}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
