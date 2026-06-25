import React from "react";
export function ReviewQuoteCard({ block }: { block: any }) {
  return (
    <article data-ui-block="review_quote" className="ai-bubble relative overflow-hidden rounded-2xl p-5 w-72 bg-gradient-to-b from-[#F8F7FF] to-white border border-violet-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-xs text-violet-600">auto_awesome</span>
        </div>
        <span className="text-xs font-semibold text-slate-700">{block.source || "TechKoru"}</span>
        <span className="text-[10px] font-medium text-violet-600 ml-auto">{block.sourceLabel || "Review"}</span>
      </div>
      <p className="text-sm italic text-slate-700 leading-relaxed mb-3">
        "{block.quote || "Sin cita disponible."}"
      </p>
      {block.tags && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {block.tags.map((t, i) => (
            <span key={i} className="px-2 py-0.5 text-[10px] font-semibold text-violet-600 bg-white/80 backdrop-blur rounded-full border border-violet-100">{t}</span>
          ))}
        </div>
      )}
      <button className="w-full py-2 text-xs font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition">Leer completo</button>
    </article>
  );
}
