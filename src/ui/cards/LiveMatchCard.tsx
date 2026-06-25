import React from "react";

export function LiveMatchCard({ block }: { block: any }) {
  const tabs = ["Goles", "Estadísticas", "Escudo"];
  const [activeTab, setActiveTab] = React.useState("Goles");

  const home = block.homeTeam || block.home || "River Plate";
  const away = block.awayTeam || block.away || "Mέxico";
  const score = block.score || "3 - 0";

  return (
    <article data-ui-block="live_match" className="ai-bubble relative overflow-hidden rounded-2xl w-72 bg-white border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="material-symbols-outlined text-base text-rose-600">sports_soccer</span>
        <span className="text-xs font-semibold text-rose-600">Deportes</span>
        <span className="text-xs text-slate-400 ml-auto">Estadísticas</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4">
        {tabs.map((t) => (
          <button key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-[11px] font-semibold border-b-2 transition ${activeTab === t ? "border-rose-500 text-rose-600" : "border-transparent text-slate-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Goles */}
      {activeTab === "Goles" && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-1">
                <span className="material-symbols-outlined text-gray-600">shield</span>
              </div>
              <div className="text-[10px] font-semibold text-slate-600">{home}</div>
            </div>
            <div className="text-2xl font-black text-slate-800 px-2">{score}</div>
            <div className="text-center flex-1">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-1">
                <span className="material-symbols-outlined text-gray-600">shield</span>
              </div>
              <div className="text-[10px] font-semibold text-slate-600">{away}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {[{ minute: "17'", event: `Gol de ${home}`, highlight: true },
              { minute: "42'", event: `Gol de ${home}`, highlight: true },
              { minute: "68'", event: `Gol de ${home}`, highlight: true }].map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold w-6 text-right text-rose-600">{e.minute}</span>
                <div className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-xs text-slate-700">{e.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Estadísticas */}
      {activeTab === "Estadísticas" && (
        <div className="p-4 space-y-3">
          <div className="text-center">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
              <span>{home}</span>
              <span>{away}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden">
              <div className="bg-rose-500 rounded-l-full" style={{ width: "73%" }} />
              <div className="bg-blue-500 rounded-r-full" style={{ width: "27%" }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Posesión</div>
          </div>
          {[
            { label: "Tiros", home: 9, away: 3 },
            { label: "Paradas", home: 2, away: 8 },
            { label: "Córner", home: 5, away: 3 },
            { label: "Faltas", home: 1, away: 0 },
          ].map((s, i) => {
            const total = s.home + s.away;
            const hp = total ? s.home / total * 100 : 50;
            return (
              <div key={i}>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{s.home}</span>
                  <span className="text-slate-400">{s.label}</span>
                  <span>{s.away}</span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  <div className="bg-rose-500 rounded-l-full" style={{ width: `${hp}%` }} />
                  <div className="bg-blue-500 rounded-r-full" style={{ width: `${100 - hp}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Escudo */}
      {activeTab === "Escudo" && (
        <div className="p-4 flex items-center justify-center">
          <svg width="160" height="80" viewBox="0 0 160 80">
            {/* Home half */}
            <rect x="0" y="0" width="80" height="65" rx="8" fill="#F1F5F9" />
            <circle cx="40" cy="32" r="8" fill="none" stroke="#CBD5E1" strokeWidth="1" />
            <circle cx="40" cy="32" r="3" fill="#CBD5E1" />
            <path d="M0 32 Q20 32 30 20" stroke="#CBD5E1" fill="none" />
            {/* Away half */}
            <rect x="80" y="0" width="80" height="65" rx="8" fill="#F1F5F9" />
            <circle cx="120" cy="32" r="8" fill="none" stroke="#CBD5E1" strokeWidth="1" />
            <circle cx="120" cy="32" r="3" fill="#CBD5E1" />
            <path d="M160 32 Q140 32 130 20" stroke="#CBD5E1" fill="none" />
            {/* Center line */}
            <line x1="80" y1="0" x2="80" y2="65" stroke="#E2E8F0" strokeWidth="1" />
          </svg>
        </div>
      )}
    </article>
  );
}
