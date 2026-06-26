import type { UiBlock } from "../../domain/types";

export function DataTickerCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { label: "Votos válidos", value: "28.4M" },
    { label: "Mesas", value: "12.847" },
    { label: "Participación", value: "77%", highlight: true },
  ];
  const alert = (block as any).alert ?? "Diferencia 7.2 pp entre 1° y 2°";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-sky-500 uppercase tracking-widest">Resumen</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="space-y-2 mb-3">
          {items.map((item: any, i: number) => (
            <button
              key={i}
              onClick={() => { navigator.clipboard?.writeText(item.value).catch(() => {});  }}
              className="w-full flex items-center justify-between py-2 hover:bg-gray-50 rounded-lg px-2 transition-colors text-left"
            >
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</span>
              <span className={`text-xl font-black ${item.highlight ? "text-emerald-600" : ""}`}>{item.value}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {}}
          className="w-full bg-amber-50 rounded-xl p-3 text-center hover:bg-amber-100 transition-colors"
        >
          <span className="text-xs font-bold text-amber-600">{alert}</span>
        </button>
      </div>
    </div>
  );
}
