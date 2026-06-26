import type { UiBlock } from "../../domain/types";

export function ProductAnalysisCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const title = data.title ?? "Nespresso A";
  const subtitle = data.subtitle ?? "Versus Dolce Gusto B";
  const icon = data.icon ?? "coffee";
  const specs = data.specs ?? [
    { label: "Precio", value: "$89" },
    { label: "Presión", value: "19 bar" },
    { label: "Depósito", value: "0.7 L" },
    { label: "Garantía", value: "2 años", highlight: true },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">reviews</span> Product Analysis
        </span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="flex gap-4 mb-4">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
            <span className="material-symbols-outlined text-[32px]">{icon}</span>
          </div>
          <div className="flex-1">
            <h4 className="text-[15px] font-bold text-gray-900">{title}</h4>
            <p className="text-[12px] text-gray-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {specs.map((spec: any, i: number) => (
            <div key={i} className="bg-gray-50 p-2 rounded-xl">
              <p className="text-[10px] text-gray-500 uppercase font-bold">{spec.label}</p>
              <p className={`text-[12px] font-semibold ${spec.highlight ? "text-emerald-600" : "text-gray-900"}`}>{spec.value}</p>
            </div>
          ))}
        </div>
        <button className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[16px]">shopping_cart</span> Ver opciones
        </button>
      </div>
    </div>
  );
}
