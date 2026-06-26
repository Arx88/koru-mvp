import type { UiBlock } from "../../domain/types";

export function ReviewScoreCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { emoji: "🎧", score: "9.2", label: "Calidad", color: "emerald" },
    { emoji: "🔋", score: "8.8", label: "Batería", color: "amber" },
    { emoji: "☁️", score: "7.5", label: "Comfort", color: "blue" },
    { emoji: "💰", score: "5.5", label: "Precio", color: "red" },
  ];
  const buttonLabel = (block as any).buttonLabel ?? "Ver reseñas";

  const bgMap: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
    blue: "bg-blue-50 border-blue-100",
    red: "bg-red-50 border-red-100",
  };
  const textMap: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    red: "text-red-400",
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Review</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {items.map((item: any, i: number) => (
            <div key={i} className={`rounded-2xl p-3 flex flex-col items-center justify-center aspect-square relative border ${bgMap[item.color] ?? bgMap.emerald}`}>
              <span className="text-2xl mb-1">{item.emoji}</span>
              <p className={`text-[22px] font-extrabold ${textMap[item.color] ?? textMap.emerald}`}>{item.score}</p>
              <p className="text-[10px] font-bold text-gray-600 uppercase text-center">{item.label}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => console.log("[ReviewScoreCard] action:", buttonLabel)}
          className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-bold active:scale-[0.98] transition-transform"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
