import React from "react";
export function SmartChecklistCard({ block }: { block: any }) {
  const items = block.items || [];
  const progress = block.progress ?? 0;
  return (
    <article data-ui-block="smart_checklist" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-indigo-500">task_alt</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Checklist"}</span>
        <div className="ml-auto w-6 h-6 rounded-full border-2 border-indigo-100 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-indigo-500" style={{ transform: `scale(${progress / 100})` }} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${item.checked ? "bg-teal-50 border-teal-100" : "bg-white border-gray-100"}`}>
            <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${item.checked ? "bg-teal-500 text-white" : "border border-gray-300 bg-white"}`}>
              {item.checked && "✓"}
            </div>
            <span className={`text-xs ${item.checked ? "text-teal-700" : "text-slate-600"}`}>{item.label}</span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin items.</p>
        )}
      </div>
    </article>
  );
}
