import React from "react";
export function DataTickerCard({ block }: { block: any }) {
  const items = block.items || [];
  return (
    <article data-ui-block="data_ticker" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-slate-700">emoji_events</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Datos"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div key={i} className={`p-2.5 rounded-xl ${item.highlight ? "bg-emerald-50 border border-emerald-100" : "bg-slate-50 border border-gray-100"}`}>
            <div className="text-[10px] text-slate-400 mb-1">{item.label}</div>
            <div className={`text-sm font-bold ${item.highlight ? "text-emerald-600" : "text-slate-800"}`}>{item.value}</div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic col-span-2">Sin datos.</p>
        )}
      </div>
      {block.alert && (
        <div className="mt-3 text-[10px] font-semibold text-orange-500 bg-orange-50 rounded-lg px-2 py-1 border border-orange-100">{block.alert}</div>
      )}
    </article>
  );
}
