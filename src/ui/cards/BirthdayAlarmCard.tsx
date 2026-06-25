import React from "react";
export function BirthdayAlarmCard({ block }: { block: any }) {
  const daysLeft = block.daysLeft ?? 8;
  return (
    <article data-ui-block="birthday_alarm" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 border border-amber-100/50 bg-amber-50/50 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-amber-500">alarm</span>
        <span className="text-xs font-semibold text-amber-600">{block.title || "Alarma"}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-amber-600 text-xl">cake</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-700">{block.title || "Cumpleaños Ana"}</p>
          <p className="text-xs text-slate-500">{block.date || "12 jul"}</p>
        </div>
        <div className="text-2xl font-black text-amber-500">{String(daysLeft).padStart(2, "0")}<span className="text-xs font-medium text-amber-400 ml-0.5">días</span></div>
      </div>
    </article>
  );
}
