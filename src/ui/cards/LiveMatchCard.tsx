import { useState } from "react";

export type MatchStatBar = {
  label: string;
  leftValue: string | number;
  rightValue: string | number;
  leftPercent: number;
  rightPercent: number;
};

export type LiveMatchBlock = {
  type: "live_match";
  league?: string;
  time?: string;
  status?: string;
  homeTeam?: { name: string; abbrev: string; badgeClass?: string; borderClass?: string; score: number; cardCount?: number };
  awayTeam?: { name: string; abbrev: string; badgeClass?: string; borderClass?: string; score: number };
  globalStatus?: string;
  stats: MatchStatBar[];
};

export function LiveMatchCard({ block }: { block: LiveMatchBlock }) {
  const home = block.homeTeam ?? { name: "Real Madrid", abbrev: "RMA", score: 0 };
  const away = block.awayTeam ?? { name: "Man City", abbrev: "MCI", score: 0 };
  const [activeTab, setActiveTab] = useState<"stats" | "lineups" | "timeline">("stats");

  const homeBadge = home.badgeClass ?? "bg-gray-50";
  const homeBorder = home.borderClass ?? "border-gray-200";
  const awayBadge = away.badgeClass ?? "bg-blue-50";
  const awayBorder = away.borderClass ?? "border-blue-200";

  return (
    <div className="flex w-full" data-ui-block="live_match">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
          <div className="flex items-center justify-between px-2 mb-6">
            <div className="flex flex-col items-center gap-2 w-1/3">
              <div
                className={`w-14 h-14 ${homeBadge} rounded-full flex items-center justify-center text-gray-900 font-bold border-2 ${homeBorder} shadow-sm relative`}
              >
                {home.abbrev}
                {home.cardCount !== undefined && home.cardCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                    {home.cardCount}
                  </div>
                )}
              </div>
              <span className="text-[13px] font-bold text-gray-900">{home.name}</span>
            </div>
            <div className="flex flex-col items-center justify-center w-1/3">
              <span className="text-4xl font-black text-gray-900 tracking-tighter">
                {home.score} <span className="text-gray-300 font-normal">-</span> {away.score}
              </span>
              {block.globalStatus && (
                <span className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-full">
                  {block.globalStatus}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 w-1/3">
              <div
                className={`w-14 h-14 ${awayBadge} rounded-full flex items-center justify-center text-blue-700 font-bold border-2 ${awayBorder} shadow-sm`}
              >
                {away.abbrev}
              </div>
              <span className="text-[13px] font-bold text-gray-900">{away.name}</span>
            </div>
          </div>

          <div className="bg-gray-50 p-1 rounded-xl flex mb-4">
            <button
              className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                activeTab === "stats"
                  ? "text-gray-800 bg-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              onClick={() => setActiveTab("stats")}
            >
              Stats
            </button>
            <button
              className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                activeTab === "lineups"
                  ? "text-gray-800 bg-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              onClick={() => setActiveTab("lineups")}
            >
              Lineups
            </button>
            <button
              className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                activeTab === "timeline"
                  ? "text-gray-800 bg-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              onClick={() => setActiveTab("timeline")}
            >
              Timeline
            </button>
          </div>

          {activeTab === "stats" && block.stats && block.stats.length > 0 && (
            <div className="space-y-3 px-2">
              {block.stats.map((stat, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                    <span>{stat.leftValue}</span>
                    <span className="uppercase tracking-wider">{stat.label}</span>
                    <span>{stat.rightValue}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full flex overflow-hidden">
                    <div
                      className="bg-gray-800 h-full"
                      style={{ width: `${stat.leftPercent}%` }}
                    />
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${stat.rightPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "lineups" && (
            <div className="space-y-3 px-2">
              <p className="text-[12px] text-gray-500 font-medium text-center">
                Alineaciones no disponibles
              </p>
            </div>
          )}
          {activeTab === "timeline" && (
            <div className="space-y-3 px-2">
              <p className="text-[12px] text-gray-500 font-medium text-center">
                Timeline no disponible
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveMatchCard;
