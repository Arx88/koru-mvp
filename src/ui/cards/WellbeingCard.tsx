import React from "react";

type WellbeingSection = {
  icon: string;
  iconColor: string;
  bgColor: string;
  borderColor?: string;
  value: string;
  label: string;
};

export type WellbeingBlock = {
  type: "wellbeing";
  title?: string;
  emoji?: string;
  sections: WellbeingSection[];
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function WellbeingCard({ block }: { block: WellbeingBlock }) {
  return (
    <div className="flex w-full" data-ui-block="wellbeing">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
          style={{ borderTopLeftRadius: "4px" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center">
              <Mat className="text-[16px] text-purple-500">favorite</Mat>
            </div>
            <span className="text-[15px] font-medium text-gray-800">
              {block.title ?? "Tu bienestar"} {block.emoji ?? "🧘‍♀️"}
            </span>
          </div>
          <div className="flex gap-3">
            {block.sections.map((section, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-xl p-3 flex flex-col items-center justify-center text-center"
                style={{
                  backgroundColor: section.bgColor,
                  border: section.borderColor ? `1px solid ${section.borderColor}` : undefined,
                }}
              >
                <Mat className="text-[20px] mb-1" style={{ color: section.iconColor }}>
                  {section.icon}
                </Mat>
                <p className="text-sm font-bold text-gray-800">{section.value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{section.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WellbeingCard;
