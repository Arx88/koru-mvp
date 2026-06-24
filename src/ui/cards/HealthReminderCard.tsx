import React from "react";

export type HealthReminderBlock = {
  type: "health_reminder";
  title?: string;
  icon?: string;
  iconColor?: string;
  bgColor?: string;
  reminder: string;
  actionLabel?: string;
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function HealthReminderCard({ block }: { block: HealthReminderBlock }) {
  return (
    <div className="flex w-full" data-ui-block="health_reminder">
      <div className="flex flex-col w-full">
        <div
          className="rounded-3xl p-5 shadow-sm border transition-colors"
          style={{
            backgroundColor: block.bgColor ?? "#fff1f2",
            borderColor: block.bgColor ? `${block.bgColor}` : "#fecdd3",
          }}
        >
          <div className="flex gap-4 items-start">
            <div
              className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ color: block.iconColor ?? "#e11d48" }}
            >
              <Mat className="text-[24px]">{block.icon ?? "favorite"}</Mat>
            </div>
            <div className="flex-1">
              <h4 className="text-[15px] font-bold text-gray-900 mb-1">
                {block.title ?? "Recordatorio de salud"}
              </h4>
              <p className="text-[13px] text-gray-600 font-medium leading-relaxed">
                {block.reminder}
              </p>
              {block.actionLabel && (
                <button className="mt-3 bg-white text-rose-600 border border-rose-200 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-rose-50 active:scale-95 transition-transform">
                  {block.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HealthReminderCard;
