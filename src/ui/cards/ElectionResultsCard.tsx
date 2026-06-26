import { useState } from "react";
import type { UiBlock } from "../../domain/types";

export function ElectionResultsCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const items = data.items ?? [
    { name: "Martínez", percent: "42.3%", detail: "12.847 mesas", done: true, color: "bg-emerald-500" },
    { name: "Frente Amplio", percent: "35.1%", detail: "", done: true, color: "bg-amber-400" },
    { name: "Otros", percent: "22.6%", detail: "En definición", done: false, color: "bg-gray-200" },
  ];
  const status = data.status ?? "Escrutinio 87%";
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">psychology</span> {status}
        </span>
      </div>
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-3xl p-5 card-shadow border border-amber-100/50">
        <h4 className="text-[15px] font-bold text-gray-900 mb-4">{(data as any).title ?? "Elecciones 2025"}</h4>
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-amber-300 before:via-amber-200 before:to-transparent">
          {items.map((item: any, i: number) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`relative flex items-start gap-4 group w-full text-left transition-transform ${item.done ? "" : "opacity-50"} ${selected === i ? "scale-[1.02]" : "hover:scale-[1.01]"}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ring-4 ring-amber-50 z-10 shrink-0 ${item.color}`}>
                <span className="material-symbols-outlined text-[16px]">{item.done ? "check" : "more_horiz"}</span>
              </div>
              <div className={`bg-white p-3 rounded-xl shadow-sm border w-full ${selected === i ? "border-amber-400 ring-1 ring-amber-200" : "border-amber-50/50"}`}>
                <p className="text-[13px] font-bold text-gray-800">{item.name}</p>
                <p className="text-[11px] text-gray-500">{item.percent}{item.detail ? ` · ${item.detail}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
