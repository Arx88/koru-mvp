import React from "react";
export function BirthdayCalendarCard({ block }: { block: any }) {
  const month = block.month || "Junio";
  const year = block.year || 2025;
  const days = ["D", "L", "M", "X", "J", "V", "S"];
  const calendarDays = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, null, null, null]
  ];
  return (
    <article data-ui-block="birthday_calendar" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-amber-600">{month} {year}</span>
        <span className="material-symbols-outlined text-amber-500">calendar_month</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {days.map((d) => <span key={d} className="text-[10px] font-semibold text-slate-400">{d}</span>)}
      </div>
      {calendarDays.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 text-center mb-1">
          {week.map((day, di) => (
            <div key={di} className={`text-xs font-medium py-1 rounded-full ${day === block.highlightedDay ? "bg-pink-500 text-white" : day ? "text-slate-700" : ""}`}>
              {day || ""}
            </div>
          ))}
        </div>
      ))}
    </article>
  );
}
