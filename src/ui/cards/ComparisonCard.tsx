import React from "react";
import type { Extract } from "../domain/types";

type ComparisonBlock = Extract<UiBlock, { type: "comparison" }>;
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function ComparisonCard({ block }: { block: ComparisonBlock }) {
  const items = block.items ?? [];
  return (
    <div className="flex w-full" data-ui-block="comparison">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-pink-500">balance</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Comparación"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-pink-400 bg-pink-50">
              {items.length} opciones
            </span>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="space-y-3 mb-5">
              {items.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className={`p-4 rounded-xl border ${idx === 0 ? "bg-gray-50 border-gray-100" : "border-transparent"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-800">{item.title}</p>
                    {idx === 0 && (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Recomendado</span>
                    )}
                  </div>
                  {item.details && item.details.length > 0 && (
                    <div className="space-y-1">
                      {item.details.map((d, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2">
                          <Mat className="text-[14px] text-gray-400">{d.positive ? "check" : "close"}</Mat>
                          <p className={`text-xs ${d.positive ? "text-gray-700" : "text-gray-400"}`}>{d.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          {block.recommendation && (
            <div className="bg-pink-50 rounded-xl p-3 border border-pink-100">
              <div className="flex items-start gap-2">
                <Mat className="text-[16px] text-pink-500 mt-0.5">recommend</Mat>
                <p className="text-xs font-medium text-pink-800">{block.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

