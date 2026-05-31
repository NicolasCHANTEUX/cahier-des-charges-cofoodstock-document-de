"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { AnalysisCard } from "@/components/health/AnalysisCard";
import { TrendChart } from "@/components/health/TrendChart";
import { FreshVsProcessedCard } from "@/components/health/FreshVsProcessedCard";
import { RadarFamiliesCard } from "@/components/health/RadarFamiliesCard";
import { SeasonalityCard } from "@/components/health/SeasonalityCard";
import {
  defaultSettingsProfile,
  calculateBmi,
  getBmiLabel,
  formatBmi,
  calculateMaintenanceCalories,
  calculateTargetCalories,
  formatCalories,
  getGoalLabel,
  type SettingsProfile,
} from "@/lib/settings";

const STORAGE_KEY = "ecofoodstock:settings-profile";

export default function HealthPage() {
  const [profile, setProfile] = useState<SettingsProfile>(defaultSettingsProfile);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfile(JSON.parse(stored) as SettingsProfile);
      }
    } catch (e) {
      // ignore and keep defaults
    }
  }, []);

  const bmi = useMemo(() => calculateBmi(profile), [profile]);
  const maintenance = useMemo(() => calculateMaintenanceCalories(profile), [profile]);
  const target = useMemo(() => calculateTargetCalories(profile), [profile]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/health/summary")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        icon={Heart}
        title="Suivi santé"
        description="Indicateurs basés sur vos paramètres (IMC et besoins caloriques)."
      />
      <div className="space-y-4">
        <div>
          {/* Analysis card */}
          <AnalysisCard stats={summary?.macronutrients} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
            {/* Trend chart */}
            <TrendChart stats={summary?.macronutrients} />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card>
              <h3 className="text-sm text-slate-500">IMC</h3>
              <div className="mt-2 text-3xl font-bold">{formatBmi(bmi)}</div>
              <div className="mt-1 text-sm text-slate-600">{getBmiLabel(bmi)}</div>
            </Card>

            <Card>
              <h3 className="text-sm text-slate-500">Objectif</h3>
              <div className="mt-2 text-2xl font-bold">{getGoalLabel(profile.goal)}</div>
              <div className="mt-1 text-sm text-slate-600">Cible : {formatCalories(target)}</div>
            </Card>
          </div>
        </div>
      </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FreshVsProcessedCard ratio={summary?.freshnessRatio} />
        <RadarFamiliesCard radar={summary?.radar} />
      </div>

      <div className="mt-6">
        <SeasonalityCard score={summary?.seasonalityScore} />
      </div>
    </div>
  );
}

