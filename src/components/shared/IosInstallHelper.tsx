"use client";

import { useEffect, useState } from "react";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function IosInstallHelper() {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissedFlag = window.localStorage.getItem("ecofoodstock-ios-install-dismissed") === "1";
    const shouldShow = isIosDevice() && !isStandaloneMode() && !dismissedFlag;
    setVisible(shouldShow);
    setDismissed(dismissedFlag);
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Installer EcoFoodStock</p>
          <p className="mt-1 text-sm text-slate-600">Sur iPhone/iPad, utilisez le bouton Partager puis “Sur l’écran d’accueil”.</p>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-brand-700"
          onClick={() => {
            window.localStorage.setItem("ecofoodstock-ios-install-dismissed", "1");
            setDismissed(true);
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
