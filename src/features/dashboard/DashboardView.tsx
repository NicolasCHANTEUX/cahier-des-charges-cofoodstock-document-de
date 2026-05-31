"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Heart, PackageSearch, ShoppingCart, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProductThumbnail } from "@/components/shared/ProductThumbnail";
import { PageHeader } from "@/components/shared/PageHeader";
import type { DashboardPayload } from "@/lib/dashboard-data";
import { formatQuantity } from "@/lib/units";
import type { BadgeTone } from "@/types/domain";

const alertIcons = {
  check: CheckCircle2,
  sparkles: Sparkles,
  cart: ShoppingCart,
  heart: Heart
} as const;

const alertToneStyles: Record<BadgeTone, { container: string; title: string; icon: string }> = {
  green: {
    container: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-900",
    icon: "text-emerald-600"
  },
  blue: {
    container: "border-blue-200 bg-blue-50",
    title: "text-blue-900",
    icon: "text-blue-600"
  },
  red: {
    container: "border-rose-200 bg-rose-50",
    title: "text-rose-900",
    icon: "text-rose-600"
  },
  orange: {
    container: "border-orange-200 bg-orange-50",
    title: "text-orange-900",
    icon: "text-orange-600"
  },
  slate: {
    container: "border-slate-200 bg-slate-50",
    title: "text-slate-900",
    icon: "text-slate-600"
  }
};

const nutritionStyles: Record<DashboardPayload["nutrition"][number]["tone"], string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-orange-600",
  orange: "bg-orange-50 text-orange-500"
};

export function DashboardView() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard", {
          signal: controller.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`API error ${response.status}`);
        }

        const payload = (await response.json()) as DashboardPayload;
        setData(payload);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Impossible de charger les données depuis l'API.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();

    return () => controller.abort();
  }, []);

  const inventory = data?.inventory ?? [];
  const recipes = data?.recipes ?? [];
  const alerts = data?.alerts ?? [];
  const nutrition = data?.nutrition ?? [];

  return (
    <div>
      <PageHeader
        icon={PackageSearch}
        title="Tableau de bord"
        description="Vue rapide du stock, des DLC et des prochaines actions, alimentée par l'API."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,340px)]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase text-slate-600">Alertes intelligentes</h3>
            <Badge tone="blue">API</Badge>
          </div>

          {loading && !data ? <p className="text-sm text-slate-500">Chargement des alertes...</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="space-y-3">
            {alerts.map((alert) => {
              const Icon = alertIcons[alert.icon];
              const styles = alertToneStyles[alert.tone];

              return (
                <div key={alert.title} className={`flex gap-3 items-start rounded-xl border p-3.5 ${styles.container}`}>
                  <Icon className={`mt-0.5 h-5 w-5 ${styles.icon}`} />
                  <div>
                    <p className={`font-semibold ${styles.title}`}>{alert.title}</p>
                    <p className={`text-sm ${styles.title}`}>{alert.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase text-slate-600">Mon inventaire</h2>
              <p className="mt-1 text-sm text-slate-500">
                {loading && !data ? "Récupération en cours..." : `${data?.summary.inventoryCount ?? 0} produits`}
              </p>
            </div>
            <Badge tone="green">{data?.summary.expiringCount ?? 0} DLC proches</Badge>
          </div>

          <div className="space-y-2">
            {inventory.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <ProductThumbnail name={item.name} imageUrl={item.imageUrl} fallbackLabel={item.icon} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-sm text-slate-500">
                      {formatQuantity(item.quantity, item.unit)} {item.expirationLabel ? `· ${item.expirationLabel}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.dlcStatus ? <Badge tone={item.dlcStatus.tone}>{item.dlcStatus.label}</Badge> : <span />}
                </div>
              </div>
            ))}

            <div className="mt-3 text-center">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Voir tout l'inventaire
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-bold uppercase text-slate-600">Avis nutritionnels</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {nutrition.map((item) => (
              <div key={item.label} className={`rounded-xl border border-slate-100 p-4 ${nutritionStyles[item.tone]}`}>
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-current" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight">Que cuisiner maintenant ?</h3>
          <Badge tone="slate">{data?.summary.recipeCount ?? 0} idées</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {recipes.map((recipe) => (
            <Card key={recipe.title} className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div
                className="relative h-40 overflow-hidden"
                style={{ backgroundImage: recipe.cover, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <div className="absolute left-3 top-3 flex gap-2">
                  <button className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm">
                    <Heart className="h-4 w-4" />
                  </button>
                  <button className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {recipe.highlighted ? (
                  <div className="absolute right-3 top-3 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                    Anti-gaspi
                  </div>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 text-white">
                  <p className="text-[15px] font-semibold leading-tight">{recipe.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-[12px] text-white/85">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {recipe.time}
                    </span>
                    <span className="inline-flex items-center gap-1">{recipe.people}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <p className="text-sm text-orange-500">Il manque : {recipe.missing}</p>

                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <Badge key={tag} tone="slate">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <ShoppingCart className="h-4 w-4" />
                  Ajouter aux courses
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
