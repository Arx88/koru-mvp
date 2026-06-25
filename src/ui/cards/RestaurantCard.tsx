import type { UiBlock } from "../../domain/types";

export type RestaurantSynthesisResult = Extract<UiBlock, { type: "restaurant_synthesis" }>;

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function PlaceholderImg({ alt }: { alt?: string }) {
  return (
    <div
      aria-label={alt || "Restaurante"}
      className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center shrink-0"
      role="img"
    >
      <Mat className="text-[24px] text-orange-400">restaurant</Mat>
    </div>
  );
}

export function RestaurantSynthesisCard({ result }: { result: RestaurantSynthesisResult }) {
  const matches = result.matches ?? [];
  const top = matches[0];
  const pros = result.pros ?? [];
  const cons = result.cons ?? [];
  const labels = result.labels ?? {};

  const cardTitle = labels.cardTitle ?? result.title ?? "";
  const badge = labels.badge ?? "";
  const top3Label = labels.top3Label ?? "";
  const topPickLabel = labels.topPickLabel ?? "";
  const prosLabel = labels.prosLabel ?? "";
  const consLabel = labels.consLabel ?? "";
  const chefLabel = labels.chefLabel ?? "";
  const reserveAction = labels.reserveAction ?? "";
  const menuAction = labels.menuAction ?? "";

  const hasBreakdownContent = top && (pros.length > 0 || cons.length > 0 || result.synthesis);
  const hasActions = top && (reserveAction || menuAction);

  return (
    <div className="flex w-full" data-ui-block="restaurant_deep_search">
      <div className="flex flex-col w-full">
        <div className="bg-white rounded-[24px] rounded-tl-sm p-5 shadow-sm border border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <Mat className="text-[20px] text-orange-500">restaurant_menu</Mat>
              </div>
              {cardTitle && (
                <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">
                  {cardTitle}
                </h2>
              )}
            </div>
            {badge && (
              <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full uppercase">
                {badge}
              </span>
            )}
          </div>

          {/* Top 3 Comparison */}
          {matches.length > 0 && top3Label && (
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {top3Label}
              </p>
              <div className="space-y-2">
                {matches.slice(0, 3).map((match, idx) => {
                  const isTop = idx === 0;
                  return (
                    <div
                      key={`${match.name}-${idx}`}
                      className={`flex items-center gap-3 p-2 rounded-xl border ${
                        isTop
                          ? "bg-gray-50 border-gray-100"
                          : "border-transparent opacity-80"
                      }`}
                    >
                      {match.imageUrl ? (
                        <img
                          alt={match.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                          src={match.imageUrl}
                        />
                      ) : (
                        <PlaceholderImg alt={match.name} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-800 truncate">
                            {match.name}
                          </p>
                          {typeof match.rating === "number" && (
                            <div className="flex items-center gap-0.5">
                              <Mat className="text-[14px] text-yellow-400 fill-current">
                                star
                              </Mat>
                              <span className="text-xs font-bold text-gray-700">
                                {match.rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                        {match.quote && (
                          <p className="text-[11px] text-gray-500 truncate italic">
                            &ldquo;{match.quote}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Breakdown Section for #1 */}
          {hasBreakdownContent && (
            <div className="bg-[#F8FAF8] rounded-2xl p-4 border border-[#E8F0E8] mb-4">
              {top && (
                <div className="flex items-center gap-2 mb-3">
                  {topPickLabel && (
                    <span className="text-xs font-bold text-[#70B873] bg-[#E4F2E4] px-2 py-0.5 rounded">
                      {topPickLabel}
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-800">{top.name}</span>
                </div>
              )}
              {(pros.length > 0 || cons.length > 0) && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {pros.length > 0 && prosLabel && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                        {prosLabel}
                      </p>
                      <ul className="space-y-1.5">
                        {pros.map((p, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-gray-700 font-medium leading-tight"
                          >
                            <Mat className="text-[14px] text-emerald-500 mt-0.5">
                              check_circle
                            </Mat>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cons.length > 0 && consLabel && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                        {consLabel}
                      </p>
                      <ul className="space-y-1.5">
                        {cons.map((c, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-gray-600 leading-tight"
                          >
                            <Mat className="text-[14px] text-orange-400 mt-0.5">
                              info
                            </Mat>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Chef's Recommendation */}
              {result.synthesis && chefLabel && (
                <div className="border-t border-[#E8F0E8] pt-3 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Mat className="text-[16px] text-orange-500">skillet</Mat>
                    <p className="text-xs font-bold text-gray-800">{chefLabel}</p>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed italic">
                    &ldquo;{result.synthesis}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {hasActions && (
            <div className="flex gap-2">
              {reserveAction && (
                <button className="flex-1 bg-[#2C3E2D] text-white py-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
                  {reserveAction}
                </button>
              )}
              {menuAction && (
                <button
                  aria-label={menuAction}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1"
                >
                  <Mat className="text-[18px]">menu_book</Mat>
                  {menuAction}
                </button>
              )}
              <button
                aria-label="Guardar favorito"
                className="w-12 h-12 bg-white border border-gray-200 text-gray-400 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform"
              >
                <Mat className="text-[20px]">star</Mat>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RestaurantSynthesisCard;
