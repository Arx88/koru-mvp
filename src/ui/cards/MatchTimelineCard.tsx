import React from "react";

export function MatchTimelineCard({ block }: { block: any }) {
  const events = block.events || [];
  const home = block.homeTeam || "Local";
  const away = block.awayTeam || "Visitante";
  return (
    <article data-ui-block="match_timeline" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-rose-500">sports_soccer</span>
        <span className="text-xs font-semibold text-slate-700">{home} vs {away}</span>
      </div>
      <div className="flex flex-col gap-3">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`text-xs font-bold w-8 text-right ${e.highlight ? "text-rose-600" : "text-slate-500"}`}>{e.minute}</span>
            <div className={`h-2 w-2 rounded-full ${e.highlight ? "bg-rose-500" : "bg-slate-300"}`} />
            <span className="text-xs text-slate-700 flex-1">{e.event}</span>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin eventos registrados.</p>
        )}
      </div>
    </article>
  );
}
