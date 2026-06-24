import React from "react";

export type DeliveryBlock = {
  type: "delivery";
  title?: string;
  status: string;
  carrier?: string;
  trackingId?: string;
  estimatedDate?: string;
  steps?: Array<{ label: string; done: boolean }>;
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function DeliveryCard({ block }: { block: DeliveryBlock }) {
  return (
    <div className="flex w-full" data-ui-block="delivery">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Mat className="text-[20px] text-amber-600">local_shipping</Mat>
              </div>
              <h2 className="text-[15px] font-bold text-gray-900">
                {block.title ?? "Envío en curso"}
              </h2>
            </div>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
              {block.status}
            </span>
          </div>
          {block.trackingId && (
            <p className="text-[11px] text-gray-400 font-mono mb-4">{block.trackingId}</p>
          )}
          {block.steps && block.steps.length > 0 && (
            <div className="space-y-3 mb-4">
              {block.steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className={[
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      step.done
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-400 border border-gray-200",
                    ].join(" ")}
                  >
                    {step.done ? "✓" : (idx + 1)}
                  </div>
                  <p
                    className={[
                      "text-sm font-medium",
                      step.done ? "text-gray-800" : "text-gray-400",
                    ].join(" ")}
                  >
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          )}
          {block.estimatedDate && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
              <Mat className="text-[16px] text-gray-400">schedule</Mat>
              <p className="text-xs text-gray-600 font-medium">
                Llegada estimada: <span className="font-bold text-gray-900">{block.estimatedDate}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeliveryCard;
