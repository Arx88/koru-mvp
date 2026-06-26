import React from "react";

type UrgentNowBlock = {
  type: "urgent_now";
  eyebrow?: string;
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
  const hasCustomIconStyle = Boolean(block.iconBg || block.iconColor);

  return (
    <div className="flex w-full" data-ui-block="urgent_now">
      <div className="flex flex-col w-full">
        {block.eyebrow && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest">
              {block.eyebrow}
            </span>
          </div>
        )}
        <div className="bg-white rounded-3xl p-5 card-shadow">
          <div className="flex gap-4 items-start">
            <div
              className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center ${
                hasCustomIconStyle ? "" : "bg-red-50 text-red-500"
              }`}
              style={
                hasCustomIconStyle
                  ? { backgroundColor: block.iconBg ?? "#fef2f2", color: block.iconColor ?? "#ef4444" }
                  : undefined
              }
            >
              <Mat className="text-[20px]">{block.icon ?? "breaking_news_alt_1"}</Mat>
            </div>
            <div>
              {block.headline && (
                <h4 className="text-[15px] font-bold text-gray-900 leading-tight mb-2">
                  {block.headline}
                </h4>
              )}
              {block.description && (
                <p className="text-[13px] text-gray-500 leading-relaxed font-medium">
                  {block.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

