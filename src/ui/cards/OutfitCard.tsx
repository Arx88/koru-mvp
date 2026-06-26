import type { UiBlock } from "../../domain/types";

export function OutfitCard({ block }: { block: UiBlock }) {
  const specs = (block as any).specs ?? [
    { emoji: "☕", label: "Precio", value: "$89" },
    { emoji: "⚡", label: "Presión", value: "19b" },
    { emoji: "💧", label: "Depósito", value: "0.7L" },
  ];
  const buttonLabel = (block as any).buttonLabel ?? "Verward ganador";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest">Specs</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {specs.map((spec: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-2 flex flex-col items-center justify-center aspect-square relative border border-gray-100">
              <span className="text-2xl mb-1">{spec.emoji}</span>
              <p className="text-[9px] font-bold text-gray-600 uppercase text-center">{spec.label}</p>
              <p className="text-[13px] font-extrabold">{spec.value}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => {}}
          className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[16px]">check_circle</span> {buttonLabel}
        </button>
      </div>
    </div>
  );
}
