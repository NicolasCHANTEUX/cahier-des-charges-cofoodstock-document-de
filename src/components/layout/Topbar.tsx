"use client";

import { useEffect, useState } from "react";
import { Bell, UserRound } from "lucide-react";
import { defaultSettingsProfile } from "@/lib/settings";

export function Topbar() {
  const [modeLabel, setModeLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ecofoodstock:settings-profile");
      if (stored) {
        const parsed = JSON.parse(stored) as typeof defaultSettingsProfile;
        setModeLabel(parsed.appMode === "athlete" ? "Sportif" : "Grand Public");
        return;
      }
    } catch (e) {
      // ignore
    }

    setModeLabel(null);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm text-slate-500">Foyer</p>
          <h1 className="font-semibold">Alex&apos;s Pantry</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:inline-flex">
            <span className="text-slate-500">Mode :</span>
            <strong>{modeLabel ?? "Sportif"}</strong>
          </span>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Profil">
            <UserRound className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

