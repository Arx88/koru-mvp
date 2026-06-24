import React from "react";

export type UrgentNowBlock = {
  type: "urgent_now";
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  headline: string;
  description: string;
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function UrgentNowCard({ block }: { block: UrgentNowBlock }) {
  return (
    <div className="flex w-full" data-ui-block="urgent_now">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex gap-4 items-start">
            <div
              className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: block.iconBg ?? "#fef2f2", color: block.iconColor ?? "#ef4444" }}
            >
              <Mat className="text-[20px]">{block.icon ?? "breaking_news_alt_1"}</Mat>
            </div>
            <div>
              <h4 className="text-[15px] font-bold text-gray-900 leading-tight mb-2">
                {block.headline}
              </h4>
              <p className="text-[13px] text-gray-500 leading-relaxed font-medium">
                {block.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UrgentNowCard;
