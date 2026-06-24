

export type DeliveryBlock = {
  type: "delivery";
  title?: string;
  status?: string;
  carrier?: string;
  trackingId?: string;
  estimatedDate?: string;
  steps?: Array<{ label: string; done: boolean; time?: string }>;
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function DeliveryCard({ block }: { block: DeliveryBlock }) {
  return (
    <div className="flex w-full" data-ui-block="delivery">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Mat className="text-[20px]">local_shipping</Mat>
              </div>
              <h2 className="text-[14px] font-bold text-gray-900">
                {block.title ?? "Paquete en camino"}
              </h2>
            </div>
            {block.status && (
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                {block.status}
              </span>
            )}
          </div>
          {block.carrier && (
            <p className="text-[12px] text-gray-500 font-medium mb-4">
              {block.carrier}
              {block.estimatedDate ? ` \u2022 Llega ${block.estimatedDate}` : ""}
            </p>
          )}
          {block.trackingId && (
            <p className="text-[11px] text-gray-400 font-mono mb-4">{block.trackingId}</p>
          )}
          {block.steps && block.steps.length > 0 && (
            <div className="relative pt-2 pb-2">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100"></div>
              {block.steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`relative flex items-center gap-4 ${idx < block.steps!.length - 1 ? "mb-3" : ""}`}
                >
                  <div
                    className={[
                      "w-4 h-4 rounded-full z-10 border-2",
                      step.done
                        ? "bg-indigo-500 border-white shadow-sm"
                        : "bg-gray-200 border-white",
                    ].join(" ")}
                  ></div>
                  <p
                    className={[
                      "text-[12px]",
                      step.done ? "font-semibold text-gray-900" : "font-medium text-gray-400",
                    ].join(" ")}
                  >
                    {step.label}
                    {step.time && (
                      <span className="text-gray-400 font-normal ml-2">{step.time}</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
          {block.estimatedDate && !block.carrier && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
              <Mat className="text-[16px] text-gray-400">schedule</Mat>
              <p className="text-xs text-gray-600 font-medium">
                Llegada estimada:{" "}
                <span className="font-bold text-gray-900">{block.estimatedDate}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeliveryCard;
