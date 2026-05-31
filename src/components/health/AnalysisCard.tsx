"use client";

import { CheckCircle, Info, AlertTriangle } from "lucide-react";

export function AnalysisCard({ stats }: { stats?: { fat_g?: number; carbs_g?: number; protein_g?: number } }) {
  const fatLow = stats?.fat_g !== undefined && stats.fat_g < 50;
  const proteinLow = stats?.protein_g !== undefined && stats.protein_g < 50;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-emerald-50 to-white p-6">
      <div className="flex items-start gap-4">
        <div className="mt-1 text-emerald-600">
          <Info className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Analyse de la semaine</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-4 w-4 text-emerald-500" />
              <span>Super régularité ! Tu as atteint tes objectifs de fibres 5 jours de suite.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-4 w-4 text-emerald-500" />
              <span>Excellente variété alimentaire cette semaine.</span>
            </li>
            {fatLow ? (
              <li className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-4 w-4 text-amber-600" />
                <span className="text-amber-800">Attention, tes apports en lipides sont un peu bas sur les 3 derniers jours.</span>
              </li>
            ) : null}
            {proteinLow ? (
              <li className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-4 w-4 text-amber-600" />
                <span className="text-amber-800">Vos apports en protéines semblent faibles — pensez aux légumineuses ou œufs.</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
