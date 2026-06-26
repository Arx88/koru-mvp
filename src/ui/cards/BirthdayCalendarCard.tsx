import type { UiBlock } from "../../domain/types";

export function BirthdayCalendarCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const month = data.month ?? "Junio 2025";
  const highlightedDay = data.highlightedDay ?? 12;
  const startDay = data.startDay ?? 6;
  const daysInMonth = data.daysInMonth ?? 13;

  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest">{month}</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-300 mb-1">
          <span>L</span>
          <span>M</span>
          <span>M</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
          <span>D</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-600">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => { if (day === highlightedDay ) {} }}
              className={`py-1 ${day === highlightedDay ? "rounded-md bg-pink-500 text-white font-bold shadow-sm cursor-pointer hover:bg-pink-600" : "cursor-default"}`}
            >
              {day ?? ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
