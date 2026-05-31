"use client";

export function SeasonalityCard({ score = 85 }: { score?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold">Score de Saisonnalité</h3>

      <div className="mt-6">
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div className="h-3 rounded-full bg-slate-900" style={{ width: `${score}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">De saison: Tomates, courgettes, haricots verts</div>
          <div className="text-lg font-bold text-emerald-600">{score}%</div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-emerald-50 p-3 text-sm">De saison<br/><span className="text-xs text-slate-600">Tomates, courgettes</span></div>
          <div className="rounded-md bg-sky-50 p-3 text-sm">Impact écologique<br/><span className="text-xs text-slate-600">Faible empreinte</span></div>
          <div className="rounded-md bg-amber-50 p-3 text-sm">Conseil<br/><span className="text-xs text-slate-600">Privilégiez les circuits courts</span></div>
        </div>
      </div>
    </div>
  );
}
