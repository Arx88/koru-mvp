import React from "react";
import type { AssistantPlanItem } from "../../domain/types";

export type PlanTimelineBlock = {
  type: "plan";
  title?: string;
  id?: string;
  items: AssistantPlanItem[];
  actionLabel?: string;
  actionIcon?: string;
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function PlanTimelineCard({ block }: { block: PlanTimelineBlock }) {
  return (
    <div className="flex w-full" data-ui-block="plan">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-[24px] p-5 border border-gray-100"
          style={{ borderTopLeftRadius: "4px" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Mat className="text-[20px] text-green-600">route</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">
                {block.title ?? "Logística de Actividad"}
              </h2>
            </div>
            {block.id && (
              <span className="text-[10px] font-bold text-gray-400 border border-gray-100 px-2 py-0.5 rounded-full uppercase">
                {block.id}
              </span>
            )}
          </div>
          <div className="space-y-6">
            {block.items.map((item, idx) => {
              const isLast = idx === block.items.length - 1;
              const status: "done" | "current" | "pending" =
                idx === 0 ? "done" : idx === 1 ? "current" : "pending";
              const isCurrent = status === "current";
              const tags: Array<{ label: string }> = [
                ...(item.priority ? [{ label: item.priority }] : []),
                ...(item.mode ? [{ label: item.mode }] : []),
                ...(item.durationMinutes ? [{ label: `${item.durationMinutes} min` }] : []),
              ];
              return (
                <div key={idx} className="flex gap-4 relative plan-timeline-item">
                  {!isLast && (
                    <div className="absolute left-[7px] top-[24px] bottom-[-8px] w-[1px] bg-gray-200" />
                  )}
                  <div
                    className={[
                      "relative z-10 w-[15px] h-[15px] rounded-full border-2",
                      isCurrent ? "bg-[#70B873] border-[#70B873]" : "bg-white border-[#70B873]"
                    ].join(" ")}
                  />
                  <div className="flex-1 pb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {item.time ?? "--:--"}
                      </p>
                      {status === "done" && (
                        <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          INICIO
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-800 mt-1 plan-timeline-title">{item.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                      {item.rationale ?? ""}
                    </p>
                    {tags.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {tags.map((tag, tidx) => (
                          <span
                            key={tidx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600"
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {block.actionLabel && (
            <button className="mt-8 w-full bg-[#121411] text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
              {block.actionIcon && <Mat className="text-[18px]">{block.actionIcon}</Mat>}
              {block.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanTimelineCard;
