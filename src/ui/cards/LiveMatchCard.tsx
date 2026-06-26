import { useState } from "react";
import type { UiBlock } from "../../domain/types";

export function LiveMatchCard({ block }: { block: UiBlock }) {
  const data = block as any;
  const [activeTab, setActiveTab] = useState<"stats" | "lineups" | "timeline">("stats");
  const homeScore = data.homeScore ?? 2;
  const awayScore = data.awayScore ?? 1;
  const homeInitials = data.homeInitials ?? "RMA";
  const awayInitials = data.awayInitials ?? "MCI";
  const homeName = data.homeName ?? "Real Madrid";
  const awayName = data.awayName ?? "Man City";
  const globalAgg = data.globalAgg ?? "Global 3-3";
  const minute = data.minute ?? "72'";

  const tabBase = "flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all";
  const tabActive = "bg-white shadow-sm text-gray-800";
  const tabInactive = "text-gray-500 hover:text-gray-800";

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">sports_soccer</span>
          Live Match
        </span>
        <span className="bg-red-50 text-red-500 text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">{minute}</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="flex items-center justify-between px-2 mb-6">
          <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-900 font-bold border-2 border-gray-200 shadow-sm relative">
              {homeInitials}
              {data.homeYellow && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">1</div>
              )}
            </div>
            <span className="text-[13px] font-bold text-gray-900">{homeName}</span>
          </div>
          <div className="flex flex-col items-center justify-center w-1/3">
            <span className="text-4xl font-black text-gray-900 tracking-tighter">
              {homeScore} <span className="text-gray-300 font-normal">-</span> {awayScore}
            </span>
            <span className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-full">{globalAgg}</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-700 font-bold border-2 border-blue-200 shadow-sm">{awayInitials}</div>
            <span className="text-[13px] font-bold text-gray-900">{awayName}</span>
          </div>
        </div>
        <div className="bg-gray-50 p-1 rounded-xl flex mb-4">
          <button className={`${tabBase} ${activeTab === "stats" ? tabActive : tabInactive}`} onClick={() => setActiveTab("stats")}>Stats</button>
          <button className={`${tabBase} ${activeTab === "lineups" ? tabActive : tabInactive}`} onClick={() => setActiveTab("lineups")}>Lineups</button>
          <button className={`${tabBase} ${activeTab === "timeline" ? tabActive : tabInactive}`} onClick={() => setActiveTab("timeline")}>Timeline</button>
        </div>
        {activeTab === "stats" && (
          <div className="space-y-3 px-2">
            <div>
              <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                <span>{data.homePossession ?? "62%"}</span>
                <span className="uppercase tracking-wider">Possession</span>
                <span>{data.awayPossession ?? "38%"}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full flex overflow-hidden">
                <div className="bg-gray-800 h-full" style={{ width: data.homePossession ?? "62%" }}></div>
                <div className="bg-blue-500 h-full" style={{ width: data.awayPossession ?? "38%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                <span>{data.homeShots ?? "14"}</span>
                <span className="uppercase tracking-wider">Shots (On Target)</span>
                <span>{data.awayShots ?? "8"}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full flex overflow-hidden">
                <div className="bg-gray-800 h-full" style={{ width: "64%" }}></div>
                <div className="bg-blue-500 h-full" style={{ width: "36%" }}></div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "lineups" && (
          <div className="px-2 text-center">
            <p className="text-sm font-bold text-gray-400">Alineaciones no disponibles</p>
          </div>
        )}
        {activeTab === "timeline" && (
          <div className="px-2 text-center">
            <p className="text-sm font-bold text-gray-400">Timeline no disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
