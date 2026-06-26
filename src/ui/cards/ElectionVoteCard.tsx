import { useState } from "react";
import type { UiBlock } from "../../domain/types";

export function ElectionVoteCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const question = data.question ?? "¿Aprobás la reforma?";
  const subtitle = data.subtitle ?? "Reforma laboral · Vinculante";
  const options = data.options ?? [
    { label: "Sí", sub: "Flexibilización" },
    { label: "No", sub: "Legislación vigente" },
  ];
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-violet-500 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">how_to_vote</span> Votar
        </span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <h4 className="text-[16px] font-bold text-gray-900 mb-1">{question}</h4>
        <p className="text-[13px] text-gray-500 font-medium mb-4">{subtitle}</p>
        <div className="space-y-2 mb-4" role="radiogroup" aria-label={question}>
          {options.map((opt: any, i: number) => (
            <button
              key={i}
              role="radio"
              aria-checked={selected === i}
              onClick={() => setSelected(i)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl transition-colors text-left ${selected === i ? "bg-violet-50 border border-violet-200" : "bg-gray-50 hover:bg-gray-100"}`}
            >
              <div>
                <p className="text-[14px] font-bold text-gray-900">{opt.label}</p>
                <p className="text-[12px] text-gray-500">{opt.sub}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected === i ? "border-violet-600" : "border-gray-300"}`}>
                {selected === i && <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={() => {}}
          className="w-full py-3 bg-violet-600 text-white rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
          disabled={selected === null}
        >
          Confirmar voto
        </button>
      </div>
    </div>
  );
}
