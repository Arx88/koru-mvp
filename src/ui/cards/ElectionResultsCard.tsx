import React from "react";
export function ElectionResultsCard({ block }: { block: any }) {
  const candidates = block.candidates || [];
  return (
    <article data-ui-block="election_results" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-gradient-to-br from-slate-50 to-gray-50 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-slate-700">how_to_vote</span>
        <span className="text-xs font-semibold text-slate-800">{block.title || "Escrutinio"}</span>
      </div>
      <div className="flex flex-col gap-2">
        {candidates.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${c.status === "winner" ? "bg-emerald-500" : c.status === "second" ? "bg-blue-500" : "bg-slate-400"}`}>
              {c.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">{c.name}</span>
                <span className="text-xs font-bold text-slate-800">{c.percent}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${c.status === "winner" ? "bg-emerald-500" : c.status === "second" ? "bg-blue-500" : "bg-slate-400"}`} style={{ width: `${c.percent}%` }} />
              </div>
            </div>
          </div>
        ))}
        {candidates.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin datos de escrutinio.</p>
        )}
      </div>
      {block.escrutinio && <p className="text-[10px] text-slate-400 mt-2">{block.escrutinio}</p>}
    </article>
  );
}
