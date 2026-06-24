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

export function ActivityTrackerCard({ block }: { block: ActivityTrackerBlock }) {
  const firstMetric = block.metrics[0];
  const progress = firstMetric?.progress ?? 75;
  const value = firstMetric?.value ?? "8.5k";

  return (
    <div className="flex w-full" data-ui-block="activity_tracker">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50 flex items-center gap-5">
          <div className="relative w-16 h-16 shrink-0">
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 36 36"
            >
              <path
                className="text-gray-100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                className="text-teal-500"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${progress}, 100`}
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-[16px] font-black text-gray-900 leading-none">
                {value}
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-gray-900 mb-1">
              {block.title ?? "Casi logras tu meta"}
            </h4>
            <p className="text-[12px] text-gray-500 font-medium">
              {block.subtitle ??
                "Te faltan 1,500 pasos para tu objetivo diario. ¿Una caminata corta después de comer?"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityTrackerCard;
