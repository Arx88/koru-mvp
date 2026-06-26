import type { UiBlock } from "../../domain/types";

export type RestaurantSynthesisResult = Extract<UiBlock, { type: "restaurant_synthesis" }>;

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function PlaceholderImg({ alt, muted }: { alt?: string; muted?: boolean }) {
  return (
    <div
      aria-label={alt || "Restaurante"}
      className={`w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 ${
        muted
          ? "from-gray-100 to-gray-200"
          : "from-orange-100 to-amber-200"
      }`}
      role="img"
    >
      <Mat className={`text-[24px] ${muted ? "text-gray-300" : "text-orange-400"}`}>
        restaurant
      </Mat>
    </div>
  );
}

export function RestaurantSynthesisCard({ result }: { result: RestaurantSynthesisResult }) {
  const matches = result.matches ?? [];
  const top = matches[0];
  const pros = result.pros ?? [];
  const cons = result.cons ?? [];
  const labels = result.labels ?? {};
  const sources = result.sources ?? [];

  const cardTitle = labels.cardTitle ?? result.title ?? "DeepHungry Synthesis";
  const top3Label = labels.top3Label ?? "Top coincidencias";
  const topPickLabel = labels.topPickLabel ?? "RECOMENDACIÓN #1";
  const prosLabel = labels.prosLabel ?? "Puntos a favor";
  const consLabel = labels.consLabel ?? "A considerar";
  const synthesisLabel = labels.synthesisLabel ?? "Síntesis de las fuentes";
  const navigateLabel = labels.navigateLabel ?? "Cómo llegar";
  const callLabel = labels.callLabel ?? "Reservar";

  const totalSources = sources.length;

  const hasMatches = matches.length > 0;
  const hasBreakdown = top && (pros.length > 0 || cons.length > 0 || !!result.synthesis);
  const isPartial = result.status === "partial";
  const isFailed = result.status === "failed";

  return (
    <div className="flex w-full" data-ui-block="restaurant_deep_search">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] rounded-tl-sm p-5 shadow-sm border border-gray-100 ai-bubble">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-orange-500">restaurant_menu</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{cardTitle}</h2>
            </div>
            <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full uppercase">
              {totalSources} {totalSources === 1 ? "fuente" : "fuentes"}
            </span>
          </div>

          {/* Failed state */}
          {isFailed && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                  <Mat className="text-[18px] text-gray-400">error</Mat>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">No disponible</p>
                  <p className="text-xs text-gray-600 leading-snug">
                    {result.note ?? "No he podido buscar restaurantes ahora mismo. Intentá de nuevo en un momento."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top coincidencias */}
          {!isFailed && hasMatches && (
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{top3Label}</p>
              <div className="space-y-2">
                {matches.slice(0, 3).map((match, idx) => {
                  const isTop = idx === 0;
                  const scoreText = totalSources > 0 ? `${match.sourcesMentioning}/${totalSources}` : "";
                  return (
                    <div
                      key={`${match.name}-${idx}`}
                      className={`flex items-center gap-3 p-2 rounded-xl border ${
                        isTop ? "bg-gray-50 border-gray-100" : "border-transparent opacity-80"
                      }`}
                    >
                      {match.imageUrl ? (
                        <img
                          alt={match.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                          src={match.imageUrl}
                        />
                      ) : (
                        <PlaceholderImg alt={match.name} muted={!isTop} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-800 truncate">{match.name}</p>
                          {scoreText && (
                            <div className="flex items-center gap-0.5">
                              {isTop && (
                                <Mat className="text-[14px] text-emerald-500">check_circle</Mat>
                              )}
                              <span className={`text-xs font-bold ${isTop ? "text-emerald-600" : "text-gray-500"}`}>
                                {scoreText}
                              </span>
                            </div>
                          )}
                        </div>
                        {match.quote && (
                          <p className="text-[11px] text-gray-500 truncate italic">&ldquo;{match.quote}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Breakdown del #1 */}
          {!isFailed && hasBreakdown && (
            <div className="bg-[#F8FAF8] rounded-2xl p-4 border border-[#E8F0E8] mb-4">
              {top && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-[#70B873] bg-[#E4F2E4] px-2 py-0.5 rounded">
                    {topPickLabel}
                  </span>
                  <span className="text-sm font-bold text-gray-800">{top.name}</span>
                </div>
              )}
              {(pros.length > 0 || cons.length > 0) && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {pros.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{prosLabel}</p>
                      <ul className="space-y-1.5">
                        {pros.map((p, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-gray-700 font-medium leading-tight"
                          >
                            <Mat className="text-[14px] text-emerald-500 mt-0.5">check_circle</Mat>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cons.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{consLabel}</p>
                      <ul className="space-y-1.5">
                        {cons.map((c, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-gray-600 leading-tight"
                          >
                            <Mat className="text-[14px] text-orange-400 mt-0.5">info</Mat>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {result.synthesis && (
                <div className="border-t border-[#E8F0E8] pt-3 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Mat className="text-[16px] text-[#70B873]">auto_awesome</Mat>
                    <p className="text-xs font-bold text-gray-800">{synthesisLabel}</p>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed italic">
                    &ldquo;{result.synthesis}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Partial state alert */}
          {!isFailed && isPartial && (
            <div className="bg-[#FFF8F0] rounded-2xl p-4 border border-[#F5E6D3] mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                  <Mat className="text-[18px] text-amber-500">info</Mat>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Profundidad limitada</p>
                  <p className="text-xs text-amber-800 leading-snug">
                    {result.note ??
                      `Solo crucé ${totalSources} fuente${totalSources === 1 ? "" : "s"}. Para una recomendación confiable probá especificar barrio o tipo de cocina. No voy a inventar.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fuentes consultadas */}
          {!isFailed && sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {sources.map((s, i) => {
                const name = s.title ?? "";
                return (
                  <span
                    key={i}
                    className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md"
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          {!isFailed && top && (
            <div className="flex gap-2">
              <button className="flex-1 bg-[#2C3E2D] text-white py-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
                {navigateLabel}
              </button>
              <button className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1">
                <Mat className="text-[18px]">call</Mat>
                {callLabel}
              </button>
              <button
                aria-label="Compartir"
                className="w-12 h-12 bg-white border border-gray-200 text-gray-400 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform"
              >
                <Mat className="text-[20px]">share</Mat>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
