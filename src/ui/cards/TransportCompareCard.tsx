import React from "react";
export function TransportCompareCard({ block }: { block: any }) {
  const options = block.options || [];
  return (
    <article data-ui-block="transport_compare" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-blue-500">route</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Comparativa"}</span>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${o.highlighted ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-white"}`}>
            <span className="material-symbols-outlined text-lg text-slate-500 flex-shrink-0">{o.icon}</span>
            <span className="text-xs font-semibold text-slate-700 uppercase flex-1">{o.mode}</span>
            <span className={`text-xs font-bold ${o.highlighted ? "text-indigo-600" : "text-slate-500"}`}>{o.time}</span>
          </div>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin opciones.</p>
        )}
      </div>
    </article>
  );
}
