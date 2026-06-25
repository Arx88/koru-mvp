import React from "react";
import type { Extract } from "../domain/types";

export type PlanBlock = Extract<UiBlock, { type: "plan" }>;
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function PlanCard({ block }: { block: PlanBlock }) {
  const items = block.items ?? [];
  return (
    <div className="flex w-full" data-ui-block="plan">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 card-shadow">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                <Mat className="text-cyan-500">calendar_month</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Plan"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-cyan-400 bg-cyan-50">
              {items.length} pasos
            </span>
          </div>

          {/* Items timeline */}
          {items.length > 0 && (
            <div className="space-y-3 mb-5">
              {items.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0 ${item.done ? "bg-emerald-500" : "bg-cyan-500"}`}>
                      {item.done ? <Mat className="text-[14px]">check</Mat> : idx + 1}
                    </div>
                    {idx < items.length - 1 && <div className="w-0.5 h-full min-h-[24px] bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className={`text-sm font-bold ${item.done ? "text-gray-400 line-through" : "text-gray-800"}`}>
                      {item.title}
                    </p>
                    {item.detail && <p className="text-[11px] text-gray-500">{item.detail}</p>}
                    {item.timeEstimate && (
                      <span className="text-[10px] font-medium text-cyan-500 bg-cyan-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                        ~{item.timeEstimate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          {block.note && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-600 leading-relaxed">{block.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanCard;
