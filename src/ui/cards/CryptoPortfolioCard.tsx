import type { UiBlock } from "../../domain/types";

export function CryptoPortfolioCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { symbol: "BTC", name: "Bitcoin", price: "$64.230", change: 2.4, color: "text-orange-500", bg: "bg-orange-50" },
    { symbol: "ETH", name: "Ethereum", price: "$3.450", change: -0.8, color: "text-blue-500", bg: "bg-blue-50", char: "Ξ" },
    { symbol: "USDC", name: "Stable", price: "$1.000", change: 0, color: "text-gray-600", bg: "bg-gray-100" },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Mercados · Hace 15m</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="space-y-0">
          {items.map((item: any, i: number) => (
            <div key={i}>
              <button
                onClick={() => console.log("[CryptoPortfolioCard] selected:", item.symbol, item.price)}
                className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center ${item.color} font-bold text-sm`}>
                    {item.char ?? item.symbol.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{item.symbol}</p>
                    <p className="text-[12px] text-gray-500">{item.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-gray-900">{item.price}</p>
                  <p className={`text-[12px] font-bold ${item.change > 0 ? "text-emerald-500" : item.change < 0 ? "text-red-500" : "text-gray-400"}`}>
                    {item.change > 0 ? "+" : ""}{item.change}%
                  </p>
                </div>
              </button>
              {i < items.length - 1 && <div className="h-px bg-gray-50 mx-2"></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
