import { Box } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AuthCard() {
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
          <Button variant="secondary" className="w-full">Continuer avec Google</Button>
          <Button variant="secondary" className="w-full">Continuer avec Apple</Button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="space-y-4">
          <input
            className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
            placeholder="Email"
            type="email"
          />
          <input
            className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
            placeholder="Mot de passe"
            type="password"
          />
          <div className="text-right">
            <button className="text-sm font-medium text-brand-700" type="button">
              Mot de passe oublie ?
            </button>
          </div>
          <Button className="w-full" type="submit">Se connecter</Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          Pas encore de compte ? <span className="font-semibold text-brand-700">Creer un compte</span>
        </p>
      </Card>
    </main>
  );
}

