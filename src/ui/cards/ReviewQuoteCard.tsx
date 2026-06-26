import type { UiBlock } from "../../domain/types";

export function ReviewQuoteCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const sourceName = data.sourceName ?? "TechKoru";
  const sourceType = data.sourceType ?? "Review";
  const quote = data.quote ?? "El rey de la cancelación activa regresa con mejor batería y un diseño más liviano.";
  const tags = data.tags ?? ["Calidad top", "Premium", "Recomendado"];
  const buttonLabel = data.buttonLabel ?? "Leer completo";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-violet-500 uppercase tracking-widest">Veredicto final</span>
      </div>
      <div className="bg-gradient-to-br from-[#F8F7FF] to-white rounded-3xl p-6 card-shadow border border-violet-100/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </div>
          <div>
            <h4 className="text-[16px] font-bold text-gray-900">{sourceName}</h4>
            <p className="text-[11px] text-gray-400 font-bold">{sourceType}</p>
          </div>
        </div>
        <p className="text-[14px] text-gray-600 font-medium leading-relaxed mb-5 italic">“{quote}”</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {tags.map((tag: string, i: number) => (
            <span key={i} className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg text-[11px] font-bold text-violet-600 shadow-sm border border-gray-50/80">
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={() => {}}
          className="w-full py-3 bg-violet-600 text-white rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-transform"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
