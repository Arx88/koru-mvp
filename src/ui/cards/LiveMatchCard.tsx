import React from "react";

type MatchStatBar = {
  label: string;
  leftPercent: number;
  rightPercent: number;
  leftColor?: string;
  rightColor?: string;
};

export type LiveMatchBlock = {
  type: "live_match";
  league?: string;
  time?: string;
  status?: string;
  homeTeam?: { name: string; abbrev: string; color?: string; score: number };
  awayTeam?: { name: string; abbrev: string; color?: string; score: number };
  stats: MatchStatBar[];
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function LiveMatchCard({ block }: { block: LiveMatchBlock }) {
  const home = block.homeTeam ?? { name: "Local", abbrev: "LOC", score: 0 };
  const away = block.awayTeam ?? { name: "Visitante", abbrev: "VIS", score: 0 };
  return (
    <div className="flex w-full" data-ui-block="live_match">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mat className="text-koru text-[18px]">sports_soccer</Mat>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                {block.league ?? "Champions League"}
              </span>
            </div>
            <div className="bg-red-50 text-red-500 text-[10px] font-extrabold px-2 py-1 rounded-md animate-pulse">
              {block.time ?? "89 min"}
            </div>
          </div>
          <div className="flex items-center justify-between px-2 mb-4">
            <div className="flex flex-col items-center gap-2 w-1/3">
              <div
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-900 font-bold border border-gray-100 shadow-sm relative"
                style={home.color ? { borderColor: home.color } : undefined}
              >
                {home.abbrev}
              </div>
              <span className="text-[12px] font-bold text-gray-900">{home.name}</span>
            </div>
            <div className="flex flex-col items-center justify-center w-1/3">
              <span className="text-3xl font-extrabold text-gray-900">
                {home.score} <span className="text-gray-300 font-normal">-</span> {away.score}
              </span>
              {block.status && (
                <span className="text-[10px] text-koru mt-1 font-bold uppercase tracking-wider">
                  {block.status}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 w-1/3">
              <div
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-100 shadow-sm"
                style={away.color ? { borderColor: away.color } : undefined}
              >
                {away.abbrev}
              </div>
              <span className="text-[12px] font-bold text-gray-900">{away.name}</span>
            </div>
          </div>
          {block.stats && block.stats.length > 0 && (
            <div className="space-y-3 px-2 pt-3 border-t border-gray-100/50">
              {block.stats.map((stat, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                    <span>{stat.leftPercent}%</span>
                    <span className="uppercase tracking-wider">{stat.label}</span>
                    <span>{stat.rightPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full flex overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${stat.leftPercent}%`,
                        backgroundColor: stat.leftColor ?? "#1f2937",
                      }}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${stat.rightPercent}%`,
                        backgroundColor: stat.rightColor ?? "#3b82f6",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveMatchCard;
