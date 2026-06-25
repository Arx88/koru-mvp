import React from "react";
export function ElectionVoteCard({ block }: { block: any }) {
  const options = block.options || [];
  return (
    <article data-ui-block="election_vote" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-base text-slate-700">how_to_vote</span>
        <span className="text-xs font-semibold text-slate-700">{block.question || "¿A quién votar?"}</span>
      </div>
      {block.subtitle && <p className="text-[10px] text-slate-400 mb-3">{block.subtitle}</p>}
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <div key={i} className="p-3 rounded-xl border border-gray-100 bg-slate-50 hover:bg-white transition cursor-pointer">
            <div className="text-xs font-semibold text-slate-800">{o.label}</div>
            {o.description && <div className="text-[10px] text-slate-500 mt-1">{o.description}</div>}
          </div>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin opciones disponibles.</p>
        )}
      </div>
    </article>
  );
}
