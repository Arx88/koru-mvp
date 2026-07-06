type AlarmBlock = Extract<UiBlock, { type: "alarm" }>;
import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function AlarmCard({ block }: { block: AlarmBlock }) {
  return (
    <div className="flex w-full" data-ui-block="alarm">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-rose-500">alarm</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Alarma"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-rose-400 bg-rose-50">
              Activa
            </span>
          </div>

          {/* Time */}
          <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-red-200 flex items-center justify-center shrink-0">
                <Mat className="text-[24px] text-rose-500">schedule</Mat>
              </div>
              <div>
                <p className="text-xs text-rose-500 font-bold uppercase tracking-wider">Hora</p>
                <p className="text-2xl font-bold text-gray-900">{block.time}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          {block.repeat && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <Mat className="text-[16px] text-gray-400">repeat</Mat>
              {block.repeat}
            </div>
          )}

          {block.note && (
            <p className="text-[10.5px] text-gray-400 leading-relaxed">{block.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

