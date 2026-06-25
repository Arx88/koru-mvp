import React from "react";
export function RouteMapCard({ block }: { block: any }) {
  const progress = block.progress || 0;
  return (
    <article data-ui-block="route_map" className="ai-bubble relative overflow-hidden rounded-2xl p-5 w-72 bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-base text-blue-600">my_location</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "En ruta"}</span>
      </div>
      <div className="flex items-center justify-center mb-4">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#DBEAFE" strokeWidth="10" />
          <circle cx="60" cy="60" r="50" fill="none" stroke="#3B82F6" strokeWidth="10"
            strokeDasharray={`${progress * 3.14} ${314 - progress * 3.14}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)" />
        </svg>
      </div>
      {block.subtitle && <p className="text-center text-xs text-slate-500">{block.subtitle}</p>}
    </article>
  );
}
