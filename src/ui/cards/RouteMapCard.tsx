import type { UiBlock } from "../../domain/types";

export function RouteMapCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const progress = data.progress ?? 75;
  const from = data.from ?? "Olivos";
  const to = data.to ?? "Shopping";
  const distance = data.distance ?? "3 km";
  const remaining = data.remaining ?? "18 min restantes";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-sky-500 uppercase tracking-widest">Mapa</span>
      </div>
      <button
        onClick={() => {}}
        className="w-full bg-white rounded-3xl p-5 card-shadow border border-gray-50 flex items-center gap-5 text-left transition-transform active:scale-[0.98] hover:bg-gray-50"
      >
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path className="text-sky-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${progress}, 100`} strokeLinecap="round" strokeWidth="2.5" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[16px] font-black text-gray-900 leading-none">{progress}%</span>
          </div>
        </div>
        <div>
          <h4 className="text-[15px] font-bold text-gray-900">{from} → {to}</h4>
          <p className="text-xs text-gray-500 font-medium">{distance} · {remaining}</p>
        </div>
      </button>
    </div>
  );
}
