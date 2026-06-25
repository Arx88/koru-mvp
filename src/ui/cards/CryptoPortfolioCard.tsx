import React from "react";
export function CryptoPortfolioCard({ block }: { block: any }) {
  const coins = block.coins || [];
  return (
    <article data-ui-block="crypto_portfolio" className="ai-bubble relative overflow-hidden rounded-3xl p-4 w-72 bg-gradient-to-br from-white to-slate-50 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-emerald-500">account_balance_wallet</span>
        <span className="text-xs font-semibold text-slate-700">{block.title || "Crypto"}</span>
      </div>
      <div className="flex flex-col gap-3">
        {coins.map((c, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{c.symbol === "BTC" ? "₿" : c.symbol === "ETH" ? "Ξ" : "◈"}</span>
              <div>
                <div className="text-xs font-semibold text-slate-800">{c.symbol}</div>
                <div className="text-[10px] text-slate-400">{c.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-800">{c.price}</div>
              <div className={`text-[10px] ${c.changePositive ? "text-emerald-500" : "text-rose-500"}`}>{c.change}</div>
            </div>
          </div>
        ))}
        {coins.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin datos de criptomonedas.</p>
        )}
      </div>
    </article>
  );
}
