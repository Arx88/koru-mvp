import React from "react";

type TimelineStep = {
  time: string;
  label: string;
  description: string;
  status: "done" | "current" | "pending";
  tags?: Array<{ label: string; bg?: string; color?: string }>;
};

export type PlanTimelineBlock = {
  type: "plan";
  title?: string;
  id?: string;
  steps: TimelineStep[];
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
            {block.steps.map((step, idx) => {
              const isLast = idx === block.steps.length - 1;
              const isCurrent = step.status === "current";
              return (
                <div key={idx} className="flex gap-4 relative">
                  {!isLast && (
                    <div
                      className="absolute left-[7px] top-[24px] bottom-[-8px] w-[1px] bg-gray-200"
                    />
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
                        {step.time}
                      </p>
                      {step.status === "done" && (
                        <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          INICIO
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-800 mt-1">{step.label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                      {step.description}
                    </p>
                    {step.tags && step.tags.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {step.tags.map((tag, tidx) => (
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
