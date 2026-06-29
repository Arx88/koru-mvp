type DataCardBlock = Extract<UiBlock, { type: "data_card" }>;
import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function DataCard({ block }: { block: DataCardBlock }) {
  return (
    <div className="flex w-full" data-ui-block="data_card">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-emerald-500">verified</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Datos verificados"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-emerald-400 bg-emerald-50">
              {block.items?.length ?? 0} datos
            </span>
          </div>

          {/* Items */}
          {block.items && block.items.length > 0 && (
            <div className="space-y-2 mb-5">
              {block.items.map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? "bg-gray-50 border-gray-100" : "border-transparent"}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${idx === 0 ? "bg-gradient-to-br from-emerald-100 to-teal-200" : "bg-gradient-to-br from-gray-100 to-gray-200"}`}>
                    <Mat className={`text-[20px] ${idx === 0 ? "text-emerald-500" : "text-gray-400"}`}>
                      {idx === 0 ? "check_circle" : "radio_button_unchecked"}
                    </Mat>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-bold text-gray-800">{item.value}</p>
                    {item.detail && <p className="text-[11px] text-gray-500">{item.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sources */}
          {block.sourceStatus && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <Mat className="text-[14px] text-emerald-500">verified</Mat>
              Cada dato viene con su fuente. Si no estaba en la fuente, no está acá.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

