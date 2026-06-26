import React from "react";
import type { Extract } from "../domain/types";

type MemoryBlock = Extract<UiBlock, { type: "memory" }>;
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function MemoryCard({ block }: { block: MemoryBlock }) {
  const items = block.items ?? [];
  return (
    <div className="flex w-full" data-ui-block="memory">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-fuchsia-500">memory</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title ?? "Memoria"}</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-fuchsia-400 bg-fuchsia-50">
              {items.length} recuerdo{items.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="space-y-2 mb-5">
              {items.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Mat className="text-[16px] text-fuchsia-400">auto_awesome</Mat>
                    <p className="text-xs font-bold text-fuchsia-500 uppercase tracking-wider">{item.domain}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-800">{item.title}</p>
                  {item.detail && <p className="text-[11px] text-gray-500">{item.detail}</p>}
                  {item.confidence !== undefined && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                        <div className="bg-fuchsia-500 h-1.5 rounded-full" style={{ width: `${Math.round(item.confidence * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{Math.round(item.confidence * 100)}%</span>
                    </div>
                  )}
                </div>
              ))}
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

