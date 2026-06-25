import React from "react";

export function ProductAnalysisCard({ block }: { block: any }) {
  const specs = block.specs || [];
  const badges = block.badges || [];
  const emojis = block.emojis || ["🎧", "🎶", "🪧"];

  return (
    <article data-ui-block="product_analysis" className="ai-bubble relative overflow-hidden rounded-2xl w-72 bg-gradient-to-br from-white to-amber-50 border border-gray-100 shadow-sm">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex -space-x-1">
            {emojis.map((e, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center text-sm z-10 relative" style={{ zIndex: emojis.length - i }}>
                {e}
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-700">{block.title || "Review Express"}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {(specs.length ? specs : [
            { emoji: "🔋", name: "Batería", value: "30h" },
            { emoji: "💧", name: "Resistencia", value: "IPX4" },
            { emoji: "🔵", name: "Bluetooth", value: "5.3" },
            { emoji: "🎵", name: "Altavoz", value: "12mm" },
            { emoji: "🎙", name: "Micrófono", value: "3" },
            { emoji: "🔇", name: "Ruido", value: "ANC" },
          ]).map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-2 border border-gray-100 flex flex-col items-center gap-1">
              <span className="text-lg">{s.emoji}</span>
              <span className="text-[9px] text-slate-400">{s.name}</span>
              <span className="text-[10px] font-bold text-slate-700">{s.value}</span>
            </div>
          ))}
        </div>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {badges.map((b, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">{b}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-amber-500">star</span>
            <span className="text-sm font-bold text-slate-800">{block.rating || "4,8"}</span>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition">
            {block.buttonLabel || "Comprar ahora"}
          </button>
        </div>
      </div>
    </article>
  );
}
