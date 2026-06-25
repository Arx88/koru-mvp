import React from "react";

export function MarketCard({ block }: { block: any }) {
  const prices = block.prices || [];
  const coins = block.coins || [];

  return (
    <article data-ui-block="market" className="ai-bubble relative overflow-hidden rounded-2xl p-4 w-72 bg-gradient-to-br from-white to-slate-50 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
          <span className="text-xs font-semibold text-slate-700">BTC</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-slate-800">{block.title || "96.294,99€"}</span>
          <span className="block text-[10px] text-emerald-500 font-semibold">{block.subtitle || "▲ 0,25%"}</span>
        </div>
      </div>

      {/* Sparkline area */}
      <div className="h-12 mb-3">
        <svg width="240" height="48" viewBox="0 0 240 48">
          <path d="M0,40 Q30,38 60,35 T120,28 T180,22 T240,18" fill="none" stroke="#10B981" strokeWidth="1.5" />
          <path d="M0,40 Q30,38 60,35 T120,28 T180,22 T240,18 L240,48 L0,48 Z" fill="url(#greenGrad)" opacity="0.2" />
          <defs>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {(prices.length ? prices : [
          { label: "EUR", price: "96.294,99 €", change: "▲ 0,25%" },
          { label: "USD", price: "104.523,32 $", change: "▲ 0,25%" },
          { label: "GBP", price: "88.305,47 £", change: "▼ 0,05%" },
        ]).map((p, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">{p.label}</span>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-700">{p.price}</span>
              <span className={`text-[10px] ml-2 ${p.change?.includes("▼") ? "text-rose-500" : "text-emerald-500"}`}>{p.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(coins.length ? coins : [
          { name: "BTC", value: "96.295 €", change: "+0,25%", positive: true },
          { name: "ETH", value: "2.481 €", change: "+1,12%", positive: true },
          { name: "DOGE", value: "0,31 €", change: "-1,05%", positive: false },
        ]).map((c, i) => (
          <div key={i} className="bg-white rounded-xl p-2 border border-gray-100 text-center">
            <div className="text-xs font-semibold text-slate-700">{c.name}</div>
            <div className="text-[10px] font-semibold text-slate-500 mt-1">{c.value}</div>
            <div className={`text-[10px] font-medium mt-0.5 ${c.positive ? "text-emerald-500" : "text-rose-500"}`}>{c.change}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
