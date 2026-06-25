import React from "react";
export function ReviewScoreCard({ block }: { block: any }) {
  const scores = block.scores || [];
  const colorMap = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <article data-ui-block="review_score" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-sky-500">headset_mic</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Review"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {scores.map((s, i) => (
          <div key={i} className={`rounded-xl p-3 flex flex-col items-center gap-1 ${colorMap[s.color] || "bg-slate-100 text-slate-700"}`}>
            <span className="text-xl">{s.emoji}</span>
            <span className="text-[10px] font-semibold uppercase">{s.label}</span>
            <span className="text-lg font-black">{s.value}</span>
          </div>
        ))}
        {scores.length === 0 && (
          <p className="text-xs text-slate-400 italic col-span-2 text-center">Sin scores.</p>
        )}
      </div>
    </article>
  );
}
