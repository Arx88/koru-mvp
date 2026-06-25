import React from "react";

export function SocialInteractionCard({ block }: { block: any }) {
  const gifts = block.gifts || [];

  return (
    <article data-ui-block="social_interaction" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-base text-pink-500">cake</span>
        <span className="text-xs font-semibold text-pink-600">Social</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">🎂</span>
        <div>
          <p className="text-sm font-bold text-slate-800">{block.title || "Cumpleaños de Ana"}</p>
          <p className="text-[10px] text-slate-500">{block.subtitle || "12 jul · 35 años · Faltan 8 días"}</p>
        </div>
      </div>

      <div className="overflow-x-auto snap-x snap-mandatory -mx-4 px-4 flex gap-3 pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {(gifts.length ? gifts : [
          { name: "Velas LED", time: "Entrega: 2 días", icon: "🪔" },
          { name: "Box musical", time: "Entrega: mañana", icon: "🎁" },
          { name: "Maceta aromática", time: "Entrega: 3-5 días", icon: "🪴" },
          { name: "Taza personalizada", time: "Entrega: 7 días", icon: "☕" },
        ]).map((g, i) => (
          <div key={i} className="snap-start flex-shrink-0 w-36 bg-white/80 backdrop-blur rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-white/50 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xl">{g.icon}</div>
            <span className="text-[10px] font-semibold text-slate-700 text-center">{g.name}</span>
            <span className="text-[9px] text-slate-400 text-center">{g.time}</span>
            <button className="mt-1 px-3 py-1 rounded-full bg-pink-100 text-pink-600 text-[10px] font-semibold">Enviar</button>
          </div>
        ))}
      </div>
    </article>
  );
}
