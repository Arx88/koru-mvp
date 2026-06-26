import type { UiBlock } from "../../domain/types";

export function TransportCompareCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { mode: "Auto", time: "18 min", icon: "directions_car", active: false },
    { mode: "Transporte", time: "42 min", icon: "directions_bus", active: true },
    { mode: "Caminando", time: "1h 50m", icon: "directions_walk", active: false },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Comparativa</span>
      </div>
      <div className="bg-white rounded-3xl p-4 card-shadow border border-gray-50">
        <div className="space-y-0">
          {items.map((item: any, i: number) => (
            <button
              key={i}
              onClick={() => {}}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-transform active:scale-[0.98] ${item.active ? "bg-amber-50" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined ${item.active ? "text-amber-500" : "text-gray-400"} text-lg`}>{item.icon}</span>
                <span className={`text-sm font-bold ${item.active ? "text-amber-500" : ""}`}>{item.mode}</span>
              </div>
              <span className={`text-sm font-extrabold ${item.active ? "text-amber-500" : item.mode === "Caminando" ? "text-gray-400" : "text-gray-900"}`}>
                {item.time}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
