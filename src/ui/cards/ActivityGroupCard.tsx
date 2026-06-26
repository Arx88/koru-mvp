import React from "react";
import type { Extract } from "../domain/types";

type ActivityGroupBlock = Extract<UiBlock, { type: "activity_group" }>;
import type { UiBlock } from "../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function sectionTone(tone?: string): { bg: string; border: string; icon: string; text: string } {
  switch (tone) {
    case "green": return { bg: "bg-emerald-50", border: "border-emerald-100", icon: "text-emerald-500", text: "text-emerald-600" };
    case "amber": return { bg: "bg-amber-50", border: "border-amber-100", icon: "text-amber-500", text: "text-amber-600" };
    case "rose": return { bg: "bg-rose-50", border: "border-rose-100", icon: "text-rose-500", text: "text-rose-600" };
    case "purple": return { bg: "bg-purple-50", border: "border-purple-100", icon: "text-purple-500", text: "text-purple-600" };
    default: return { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-500", text: "text-blue-600" };
  }
}

export function ActivityGroupCard({ block }: { block: ActivityGroupBlock }) {
  const sections = block.sections ?? [];
  return (
    <div className="flex w-full" data-ui-block="activity_group">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100" style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-sky-500">sunny</Mat>
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title}</h2>
                {block.subtitle && <p className="text-xs text-gray-500">{block.subtitle}</p>}
              </div>
            </div>
          </div>

          {/* Energy */}
          {block.energy && (
            <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-100 to-cyan-200 flex items-center justify-center shrink-0">
                  <Mat className="text-[20px] text-sky-500">battery_full</Mat>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-sky-500 font-bold uppercase tracking-wider">{block.energy.label}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, block.energy.value))}%` }} />
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900">{block.energy.value}%</span>
              </div>
            </div>
          )}

          {/* Sections */}
          {sections.length > 0 && (
            <div className="space-y-4 mb-5">
              {sections.map((section, sIdx) => {
                const tone = sectionTone(section.tone);
                return (
                  <div key={`${section.title}-${sIdx}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${tone.icon.replace("text-", "bg-")}`} />
                      <p className={`text-[11px] font-bold uppercase tracking-widest ${tone.text}`}>{section.title}</p>
                    </div>
                    <div className="space-y-2">
                      {(section.tiles ?? []).map((tile, tIdx) => (
                        <div key={`tile-${tIdx}`} className={`${tone.bg} rounded-xl p-3 border ${tone.border} flex items-center justify-between`}>
                          <span className="text-xs font-medium text-gray-700">{tile.label}</span>
                          <span className="text-sm font-bold text-gray-900">{tile.value}</span>
                        </div>
                      ))}
                      {(section.rows ?? []).map((row, rIdx) => (
                        <div key={`row-${rIdx}`} className={`${tone.bg} rounded-xl p-3 border ${tone.border} flex items-center justify-between`}>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{row.title}</p>
                            {row.detail && <p className="text-[11px] text-gray-500">{row.detail}</p>}
                          </div>
                          {row.urgent && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">Urgente</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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

