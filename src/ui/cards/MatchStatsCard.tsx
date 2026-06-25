import React from "react";

export function MatchStatsCard({ block }: { block: any }) {
  const stats = block.stats || [];
  const home = block.homeTeam || "Local";
  const away = block.awayTeam || "Visitante";
  return (
    <article data-ui-block="match_stats" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-slate-800">tune</span>
        <span className="text-xs font-semibold text-slate-700">Estadísticas</span>
      </div>
      <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
        <span>{home}</span>
        <span>{away}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {stats.map((s, i) => {
          const total = s.homeValue + s.awayValue;
          const homePct = total > 0 ? (s.homeValue / total) * 100 : 50;
          const awayPct = total > 0 ? (s.awayValue / total) * 100 : 50;
          return (
            <div key={i}>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>{s.homeValue}</span>
                <span className="text-slate-400">{s.label}</span>
                <span>{s.awayValue}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 rounded-l-full" style={{ width: `${homePct}%` }} />
                <div className="bg-rose-500 rounded-r-full" style={{ width: `${awayPct}%` }} />
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin estadísticas disponibles.</p>
        )}
      </div>
    </article>
  );
}
