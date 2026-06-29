type ProactiveSignalBlock = Extract<UiBlock, { type: "proactive_signal" }>;
import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function ProactiveSignalCard({ block }: { block: ProactiveSignalBlock }) {
  const severity = block.severity ?? "info";
  const isUrgent = severity === "urgent" || severity === "important";
  const bgColor = isUrgent ? "bg-amber-50" : "bg-purple-50";
  const borderColor = isUrgent ? "border-amber-100" : "border-purple-100";
  const accentColor = isUrgent ? "text-amber-500" : "text-purple-500";
  const accentBg = isUrgent ? "bg-amber-50" : "bg-purple-50";

  const categoryIcon: Record<string, string> = {
    weather: "partly_cloudy_day",
    traffic: "traffic",
    market: "trending_up",
    health: "health_and_safety",
    relationship: "diversity_1",
    news: "newspaper",
    world: "public",
  };

  return (
    <div className="flex w-full" data-ui-block="proactive_signal" data-severity={severity}>
      <div className="flex flex-col w-full">
        <div className={`bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100`} style={{ borderTopLeftRadius: "4px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${accentBg} flex items-center justify-center shrink-0`}>
                <Mat className={`text-[20px] ${accentColor}`}>{categoryIcon[block.category] ?? "notifications_active"}</Mat>
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{block.title}</h2>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${accentColor} ${accentBg}`}>
              {severity}
            </span>
          </div>

          {/* Body */}
          {block.body && (
            <div className={`${bgColor} rounded-2xl p-4 border ${borderColor} mb-5`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0`}>
                  <Mat className={`text-[18px] ${accentColor}`}>info</Mat>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{block.body}</p>
              </div>
            </div>
          )}

          {/* Summary items */}
          {block.summaryItems && block.summaryItems.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              {block.summaryItems.map((item, idx) => (
                <div key={`${item.label}-${idx}`} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sources */}
          {block.sources && block.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {block.sources.slice(0, 4).map((s, i) => (
                <a
                  key={`${s.domain}-${i}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  {s.domain}
                </a>
              ))}
            </div>
          )}

          {/* Follow up */}
          {block.followUpQuestion && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-2">
                <Mat className="text-[16px] text-gray-400">chat</Mat>
                <p className="text-xs font-medium text-gray-600">{block.followUpQuestion}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

