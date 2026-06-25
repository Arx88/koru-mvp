import React from "react";
export function OutfitCard({ block }: { block: any }) {
  const specs = block.specs || [];
  return (
    <article data-ui-block="outfit" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-rose-500">checkroom</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Comparativa"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {specs.map((s, i) => (
          <div key={i} className="bg-slate-50 rounded-xl p-2 flex flex-col items-center gap-1">
            <span className="text-xl">{s.emoji}</span>
            <span className="text-[9px] text-slate-400 uppercase">{s.label}</span>
            <span className="text-[10px] font-bold text-slate-700">{s.value}</span>
          </div>
        ))}
        {specs.length === 0 && (
          <p className="text-xs text-slate-400 italic col-span-3 text-center">Sin especificaciones.</p>
        )}
      </div>
    </article>
  );
}
