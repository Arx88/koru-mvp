import React from "react";

export type SocialInteractionBlock = {
  type: "social_interaction";
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: string;
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function SocialInteractionCard({ block }: { block: SocialInteractionBlock }) {
  return (
    <div className="flex w-full" data-ui-block="social_interaction">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
              style={{
                backgroundColor: block.iconBg ?? "#fff7ed",
                color: block.iconColor ?? "#f97316",
              }}
            >
              <Mat className="text-[20px]">{block.icon ?? "cake"}</Mat>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">{block.title}</h4>
              {block.subtitle && (
                <p className="text-xs text-orange-600 font-medium mt-0.5">{block.subtitle}</p>
              )}
            </div>
          </div>
          {block.actionLabel && (
            <div className="mt-3 flex justify-end">
              <button
                className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1"
                aria-label={block.actionLabel}
              >
                <Mat className="text-[20px]">
                  {block.actionIcon ?? "notifications_active"}
                </Mat>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SocialInteractionCard;
