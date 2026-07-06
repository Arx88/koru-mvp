type DecisionSupportBlock = Extract<UiBlock, { type: "decision_support" }>;
import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function DecisionSupportCard({ block }: { block: DecisionSupportBlock }) {
  const options = block.options ?? [];
  const factors = block.factors ?? [];
  return (
    <div className="flex w-full" data-ui-block="decision_support">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-yellow-500">psychology</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Decisión"}</h2>
            </div>
          </div>

          {/* Options */}
          {options.length > 0 && (
            <div className="space-y-2 mb-5">
              {options.map((opt, idx) => (
                <div
                  key={`${opt.label}-${idx}`}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? "bg-gray-50 border-gray-100" : "border-transparent"}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${idx === 0 ? "bg-gradient-to-br from-yellow-100 to-amber-200" : "bg-gray-100"}`}>
                    <Mat className={`text-[20px] ${idx === 0 ? "text-yellow-500" : "text-gray-400"}`}>
                      {idx === 0 ? "star" : "radio_button_unchecked"}
                    </Mat>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{opt.label}</p>
                    {opt.probability !== undefined && (
                      <p className="text-[11px] text-gray-500">Probabilidad: {Math.round(opt.probability * 100)}%</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Factors */}
          {factors.length > 0 && (
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100 mb-4">
              <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider mb-2">Factores clave</p>
              <div className="space-y-1.5">
                {factors.map((f, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <Mat className="text-[14px] text-yellow-500 mt-0.5">lightbulb</Mat>
                    <p className="text-xs text-gray-700">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.recommendation && (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <div className="flex items-start gap-2">
                <Mat className="text-[16px] text-emerald-500 mt-0.5">recommend</Mat>
                <p className="text-xs font-medium text-emerald-800">{block.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

