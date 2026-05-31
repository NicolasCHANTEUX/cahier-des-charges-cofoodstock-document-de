import { Bell, UserRound } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm text-slate-500">Foyer</p>
          <h1 className="font-semibold">Alex&apos;s Pantry</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm sm:inline-flex">
            Mode : Sportif
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

