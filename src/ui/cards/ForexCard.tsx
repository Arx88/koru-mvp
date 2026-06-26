import type { UiBlock } from "../../domain/types";

export function ForexCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { pair: "EUR/USD", rate: "1.0854", change: 0.02, flag: "DE", positive: true },
    { pair: "GBP/USD", rate: "1.2730", change: 0.08, flag: "GB", positive: true },
    { pair: "USD/JPY", rate: "148.32", change: -0.15, flag: "JP", positive: false },
    { pair: "AUD/USD", rate: "0.6645", change: 0.04, flag: "AU", positive: true },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest">Forex</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {items.map((item: any, i: number) => (
            <button
              key={i}
              onClick={() => {}}
              className={`p-2 rounded-xl text-left transition-transform active:scale-[0.98] ${item.positive ? "bg-gray-50 hover:bg-gray-100" : "bg-red-50 hover:bg-red-100"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <img src={`https://flagsapi.com/${item.flag}/flat/24.png`} className="w-5 h-5 rounded-full" alt={item.flag} />
                <p className={`text-[10px] uppercase font-bold ${item.positive ? "text-gray-500" : "text-red-400"}`}>{item.pair}</p>
              </div>
              <p className="text-[13px] font-bold">{item.rate}</p>
              <p className={`text-xs font-bold ${item.positive ? "text-emerald-500" : "text-red-500"}`}>
                {item.change > 0 ? "+" : ""}{item.change}%
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
