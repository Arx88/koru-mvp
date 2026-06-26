import type { UiBlock } from "../../domain/types";

export function BirthdayAlarmCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const name = data.name ?? "Cumpleaños Ana";
  const date = data.date ?? "12 jul";
  const countdown = data.countdown ?? "08";
  const unit = data.unit ?? "días";
  const eta = data.eta ?? "En 30m";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest">Alarma · {eta}</span>
      </div>
      <button
        onClick={() => console.log("[BirthdayAlarmCard] alarm:", name, date)}
        className="w-full bg-amber-50/50 rounded-3xl p-4 card-shadow flex items-center justify-between border border-amber-100/50 text-left transition-transform active:scale-[0.98] hover:bg-amber-100/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-600">
            <span className="material-symbols-outlined text-[20px]">alarm</span>
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-900">{name}</p>
            <p className="text-[12px] text-amber-700 font-medium">{date}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-extrabold text-gray-900">{countdown}</p>
          <p className="text-[10px] text-gray-400 font-bold">{unit}</p>
        </div>
      </button>
    </div>
  );
}
