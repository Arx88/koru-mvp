import type { UiBlock } from "../../domain/types";

export function MarketCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const symbol = data.symbol ?? "BTC";
  const name = data.name ?? "Bitcoin";
  const pair = data.pair ?? `${symbol}/USD`;
  const price = data.price ?? "$64.230";
  const change = data.change ?? 2.45;
  const isUp = change >= 0;
  const time = data.time ?? "1D";

  // SVG sparkline exact from design-cards.html
  const sparkPath = "M0 40 L0 30 Q 10 20, 20 25 T 40 15 T 60 20 T 80 5 T 100 10 L100 40 Z";
  const linePath = "M0 30 Q 10 20, 20 25 T 40 15 T 60 20 T 80 5 T 100 10";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">candlestick_chart</span> Market Live
        </span>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{time}</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 font-bold text-xl">{symbol === "BTC" ? "₿" : symbol.slice(0, 1)}</div>
            <div>
              <div className="flex items-baseline gap-2">
                <h4 className="text-[18px] font-bold text-gray-900">{pair}</h4>
              </div>
              <p className="text-[12px] text-gray-500 font-medium">{name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[18px] font-extrabold text-gray-900 font-mono">{price}</p>
            <p className={`text-[13px] font-bold flex items-center justify-end gap-0.5 ${isUp ? "text-emerald-500" : "text-red-500"}`}>
              <span className="material-symbols-outlined text-[14px]">{isUp ? "arrow_upward" : "arrow_downward"}</span>
              {isUp ? "" : ""}{Math.abs(change)}%
            </p>
          </div>
        </div>
        <div className="h-20 w-full bg-gray-50 rounded-xl relative overflow-hidden flex items-end px-2 pb-2 pt-4">
          <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 40">
            <defs>
              <linearGradient id="btcGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={sparkPath} fill="url(#btcGrad)"/>
            <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="100" cy="10" fill="#10b981" r="3">
              <animate attributeName="r" dur="2s" repeatCount="indefinite" values="3;6;3"/>
              <animate attributeName="opacity" dur="2s" repeatCount="indefinite" values="1;0.5;1"/>
            </circle>
          </svg>
        </div>
      </div>
    </div>
  );
}
