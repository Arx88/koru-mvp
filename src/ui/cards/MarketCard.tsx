import React from "react";

export type MarketAsset = {
  symbol: string;
  name: string;
  category?: string;
  price: string;
  change: string;
  changeUp: boolean;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  shape?: "circle" | "rounded";
};

export type MarketBlock = {
  type: "market";
  title?: string;
  assets: MarketAsset[];
};

export function MarketCard({ block }: { block: MarketBlock }) {
  return (
    <div className="flex w-full" data-ui-block="market">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 card-shadow">
          <div className="space-y-4">
            {block.assets.map((asset, idx) => {
              const isUp = asset.changeUp;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl hover:bg-gray-50/50 transition-colors cursor-pointer -mx-2 px-2 py-1"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "w-10 h-10 flex items-center justify-center font-bold text-sm",
                        asset.shape === "rounded" ? "rounded-full" : "rounded-full",
                      ].join(" ")}
                      style={{
                        backgroundColor: asset.iconBg ?? (isUp ? "#fff7ed" : "#eff6ff"),
                        color: asset.iconColor ?? (isUp ? "#f97316" : "#3b82f6"),
                      }}
                    >
                      {asset.icon ? (
                        <span className="material-symbols-outlined text-[18px]">{asset.icon}</span>
                      ) : (
                        asset.symbol.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">{asset.symbol}</p>
                      <p className="text-[12px] text-gray-500 font-medium">{asset.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className={isUp ? "spark-up" : "spark-down"} />
                    <div className="text-right">
                      <p className="text-[14px] font-bold text-gray-900">{asset.price}</p>
                      <p
                        className={[
                          "text-[12px] font-bold",
                          isUp ? "text-emerald-500" : "text-red-500",
                        ].join(" ")}
                      >
                        {asset.change}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketCard;
