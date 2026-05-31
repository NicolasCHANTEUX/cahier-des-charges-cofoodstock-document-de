import { Activity, Box, UsersRound, Utensils } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function OnboardingFlow() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
            <Box className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-600">Etape 1 sur 4</p>
        </div>
        <div className="mb-8 h-2 rounded-full bg-slate-200">
          <div className="h-2 w-1/4 rounded-full bg-slate-950" />
        </div>

        <Card className="p-8 shadow-soft">
          <div className="mb-6 flex items-center gap-3">
            <UsersRound className="h-7 w-7 text-brand-600" />
            <h1 className="text-2xl font-bold">Pour combien de personnes cuisinez-vous ?</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((size) => (
              <button
                key={size}
                className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-center transition hover:border-brand-500 first:border-brand-600 first:bg-brand-50"
                type="button"
              >
                <span className="block text-2xl font-bold">{size}</span>
                <span className="text-xs text-slate-600">{size === 5 ? "5+" : "pers."}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brand-600 bg-brand-50 p-4">
              <Utensils className="mb-3 h-5 w-5 text-brand-600" />
              <p className="font-semibold">Regime alimentaire</p>
              <p className="mt-1 text-sm text-slate-600">Omnivore, vegetarien, vegan ou pescetarien.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <Activity className="mb-3 h-5 w-5 text-blue-600" />
              <p className="font-semibold">Mode d'utilisation</p>
              <p className="mt-1 text-sm text-slate-600">Grand public ou sportif/macros.</p>
            </div>
          </div>

          <Button className="mt-8 w-full">Continuer</Button>
        </Card>
      </div>
    </main>
  );
}

