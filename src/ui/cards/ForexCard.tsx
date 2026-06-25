import React from "react";
export function ForexCard({ block }: { block: any }) {
  const pairs = block.pairs || [];
  return (
    <article data-ui-block="forex" className="ai-bubble relative overflow-hidden rounded-3xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-amber-500">currency_exchange</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Forex"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {pairs.map((p, i) => (
          <div key={i} className="bg-slate-50 rounded-xl p-2.5 flex flex-col items-center gap-1">
            <span className="text-xl">{p.flag || "💱"}</span>
            <span className="text-[10px] font-semibold text-slate-700">{p.pair}</span>
            <span className="text-xs font-bold text-slate-800">{p.rate}</span>
            <span className={`text-[10px] ${p.change.startsWith("+") ? "text-emerald-500" : "text-rose-500"}`}>{p.change}</span>
          </div>
        ))}
        {pairs.length === 0 && (
          <p className="text-xs text-slate-400 italic col-span-2 text-center">Sin cotizaciones.</p>
        )}
      </div>
    </article>
  );
}
