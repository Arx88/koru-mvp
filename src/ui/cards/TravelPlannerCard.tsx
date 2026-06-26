import React from "react";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

type TravelPlannerBlock = {
  type: "travel_planner";
  destination?: string;
  dates?: string;
  steps?: Array<{ time: string; label: string; detail?: string; icon?: string }>;
  actionLabel?: string;
};

export function TravelPlannerCard({ block }: { block: TravelPlannerBlock }) {
  const steps = block.steps ?? [];
  return (
    <div className="flex w-full" data-ui-block="travel_planner">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <Mat className="text-[20px] text-sky-500">flight_takeoff</Mat>
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">
                  {block.destination ?? "Plan de viaje"}
                </h2>
                {block.dates && (
                  <p className="text-[11px] text-gray-400 font-medium">{block.dates}</p>
                )}
              </div>
            </div>
            <span className="text-[10px] font-bold text-sky-400 bg-sky-50 px-2 py-0.5 rounded-full uppercase">
              Itinerario
            </span>
          </div>
          {steps.length > 0 && (
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const isLast = idx === steps.length - 1;
                return (
                  <div key={idx} className="flex gap-3 relative">
                    {!isLast && (
                      <div className="absolute left-[11px] top-[28px] bottom-[-12px] w-[2px] bg-gray-100" />
                    )}
                    <div className="relative z-10 w-6 h-6 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0">
                      <Mat className="text-[14px] text-sky-500">{step.icon ?? "circle"}</Mat>
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {step.time}
                      </p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">{step.label}</p>
                      {step.detail && (
                        <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {block.actionLabel && (
            <button className="mt-5 w-full bg-[#121411] text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
              <Mat className="text-[18px]">map</Mat>
              {block.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

