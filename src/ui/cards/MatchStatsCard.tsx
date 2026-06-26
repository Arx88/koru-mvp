import type { UiBlock } from "../../domain/types";

export function MatchStatsCard({ block }: { block: UiBlock }) {
  const stats = (block as any).stats ?? [
    { label: "Posesión", home: "62%", away: "38%", width: "62%" },
    { label: "Tiros", home: "14", away: "8", width: "64%" },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Estadísticas</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="space-y-3 px-2">
          {stats.map((s: any, i: number) => (
            <button
              key={i}
              onClick={() => console.log("[MatchStatsCard] stat:", s.label, s.home, s.away)}
              className="w-full text-left group"
            >
              <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                <span>{s.home}</span>
                <span className="uppercase tracking-wider">{s.label}</span>
                <span>{s.away}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full flex overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: s.width }}></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
