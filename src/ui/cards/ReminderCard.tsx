type ReminderBlock = Extract<UiBlock, { type: "reminder" }>;
import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function ReminderCard({ block }: { block: ReminderBlock }) {
  return (
    <div className="flex w-full" data-ui-block="reminder">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-teal-500">notifications</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Recordatorio"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-teal-400 bg-teal-50">
              Guardado
            </span>
          </div>

          {/* Due text */}
          {block.dueText && (
            <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-200 flex items-center justify-center shrink-0">
                  <Mat className="text-[24px] text-teal-500">event</Mat>
                </div>
                <div>
                  <p className="text-xs text-teal-500 font-bold uppercase tracking-wider">Cuándo</p>
                  <p className="text-xl font-bold text-gray-900">{block.dueText}</p>
                </div>
              </div>
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

