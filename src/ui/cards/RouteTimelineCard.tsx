import React from "react";
export function RouteTimelineCard({ block }: { block: any }) {
  const steps = block.steps || [];
  const colors = { blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500", gray: "bg-gray-400", slate: "bg-slate-500" };
  return (
    <article data-ui-block="route_timeline" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-indigo-500">pin_drop</span>
          <span className="text-xs font-semibold text-slate-700">{block.title || "Ruta"}</span>
        </div>
        {block.duration && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{block.duration}</span>}
      </div>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${colors[s.color || "gray"] || "bg-gray-400"}`} />
            <div>
              <p className="text-xs font-medium text-slate-700">{s.instruction}</p>
              {s.detail && <p className="text-[10px] text-slate-400 mt-0.5">{s.detail}</p>}
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin pasos de ruta.</p>
        )}
      </div>
    </article>
  );
}
