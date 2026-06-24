import React from "react";

export type ActivityMetric = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  progress?: number;
  progressColor?: string;
};

export type ActivityTrackerBlock = {
  type: "activity_tracker";
  title?: string;
  subtitle?: string;
  metrics: ActivityMetric[];
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function ActivityTrackerCard({ block }: { block: ActivityTrackerBlock }) {
  return (
    <div className="flex w-full" data-ui-block="activity_tracker">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Mat className="text-[20px] text-teal-500">fitness_center</Mat>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">
                {block.title ?? "Actividad Física"}
              </h2>
              {block.subtitle && (
                <p className="text-[11px] text-gray-400 font-medium">{block.subtitle}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {block.metrics.map((m, idx) => (
              <div key={idx} className="bg-gray-50/60 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Mat className="text-[16px]" style={{ color: m.iconColor }}>
                    {m.icon}
                  </Mat>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    {m.label}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {m.value}
                    {m.unit && (
                      <span className="text-xs font-medium text-gray-400 ml-0.5">{m.unit}</span>
                    )}
                  </p>
                </div>
                {typeof m.progress === "number" && (
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, m.progress))}%`,
                        backgroundColor: m.progressColor ?? "#14b8a6",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityTrackerCard;
