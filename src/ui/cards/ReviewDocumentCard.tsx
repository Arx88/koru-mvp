import type { UiBlock } from "../../domain/types";

export function ReviewDocumentCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const title = data.title ?? "Sony WH-1000XM5";
  const body = data.body ?? (
    <>
      <p>Nuestra prueba concluyó que ofrece <span className="text-green-400">cancelación top</span> en el segmento.</p>
      <br />
      <p className="text-sky-400">## Pros</p>
      <ul className="list-none pl-2 mt-2 space-y-1">
        <li><span className="text-yellow-400">-</span> Batería de 2 días</li>
        <li><span className="text-yellow-400">-</span> App completa</li>
        <li><span className="text-yellow-400">-</span> <span className="cursor-blink">Sonido limpio</span></li>
      </ul>
    </>
  );

  // If body is provided as string, render it; otherwise use children
  const renderBody = () => {
    if (typeof body === "string") {
      return (
        <div className="font-mono text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap">
          <p className="text-sky-400"># {title}</p>
          <br />
          {body}
        </div>
      );
    }
    return (
      <div className="font-mono text-[12px] text-gray-300 leading-relaxed">
        <p className="text-sky-400"># {title}</p>
        <br />
        {body}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Veredicto</span>
      </div>
      <button
        onClick={() => console.log("[ReviewDocumentCard] document:", title)}
        className="w-full bg-[#1E1E1E] rounded-3xl p-5 card-shadow overflow-hidden relative text-left transition-transform active:scale-[0.98]"
      >
        <div className="flex gap-1.5 mb-4">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
        </div>
        {renderBody()}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1E1E1E] to-transparent pointer-events-none"></div>
      </button>
    </div>
  );
}
