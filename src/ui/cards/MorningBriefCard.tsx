import React from "react";

type MorningBriefItem = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  variant?: "default" | "highlight";
};

type MorningBriefBlock = {
  type: "morning_brief";
  greeting?: string;
  items: MorningBriefItem[];
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function MorningBriefCard({ block }: { block: MorningBriefBlock }) {
  return (
    <div className="flex w-full" data-ui-block="morning_brief">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
          style={{ borderTopLeftRadius: "4px" }}
        >
          <p className="text-[15px] text-gray-800 mb-3 font-medium">
            {block.greeting ?? "¡Hola! Aquí tienes tu resumen matutino 🌅"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {block.items.map((item, idx) => (
              <div
                key={idx}
                className={[
                  "rounded-xl p-3 flex items-center gap-3",
                  item.variant === "highlight"
                    ? "bg-[#FFF4E5] border border-[#FDE0B2]"
                    : "bg-[#F8F9FA]",
                ].join(" ")}
              >
                <Mat style={{ color: item.iconColor }}>
                  {item.icon}
                </Mat>
                <div>
                  <p
                    className={[
                      "text-xs",
                      item.variant === "highlight"
                        ? "text-[#D9A05B] font-medium"
                        : "text-gray-500",
                    ].join(" ")}
                  >
                    {item.label}
                  </p>
                  <p className="text-sm font-medium text-gray-800">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

