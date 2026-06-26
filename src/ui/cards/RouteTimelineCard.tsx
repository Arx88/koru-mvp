import type { UiBlock } from "../../domain/types";

export function RouteTimelineCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { label: "Girá a la izquierda", detail: "Av. Corrientes", color: "bg-emerald-500" },
    { label: "Continuá por Acceso Norte", detail: "5.8 km", color: "bg-amber-400" },
    { label: "Salida 12 Olivos", detail: "1.9 km", color: "bg-violet-500" },
  ];
  const eta = (block as any).eta ?? "18 min";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest">Ruta rápida · {eta}</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-300 before:via-emerald-200 before:to-transparent">
          {items.map((item: any, i: number) => (
            <div key={i} className="relative flex items-start gap-3">
              <div className={`w-[10px] h-[10px] rounded-full border-[2.5px] border-white shadow-sm shrink-0 z-10 ${item.color}`}></div>
              <div>
                <p className="text-sm font-bold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => {}}
          className="w-full mt-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold active:scale-[0.98] transition-transform"
        >
          Iniciar GPS
        </button>
      </div>
    </div>
  );
}
