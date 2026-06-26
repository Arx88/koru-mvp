import type { UiBlock } from "../../domain/types";

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

type ResearchSourcesBlock = Extract<UiBlock, { type: "research_sources" }>;

export function ResearchSourcesCard({ block }: { block: ResearchSourcesBlock }) {
  const sources = block.sources ?? [];
  return (
    <div className="flex w-full" data-ui-block="research_sources">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-3xl p-4 card-shadow"
          style={{ borderTopLeftRadius: "4px" }}
        >
          {/* Query row */}
          {block.summary && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 mb-3">
              <Mat className="text-[20px] text-blue-500">sync</Mat>
              <span className="text-[14px] font-medium text-gray-700 truncate">
                {block.summary}
              </span>
            </div>
          )}

          {/* Sources list */}
          {sources.length > 0 && (
            <div className="space-y-1">
              {sources.slice(0, 5).map((source, idx) => (
                <a
                  key={`${source.domain}-${idx}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? "bg-gradient-to-br from-blue-100 to-blue-200"
                          : "bg-gray-100"
                      }`}
                    >
                      <Mat
                        className={`text-[14px] ${
                          idx === 0 ? "text-blue-500" : "text-gray-400"
                        }`}
                      >
                        {idx === 0 ? "verified" : "link"}
                      </Mat>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-gray-800 truncate">
                        {source.title}
                      </p>
                      <p className="text-[11px] text-gray-500">{source.domain}</p>
                    </div>
                  </div>
                  <Mat className="text-gray-300 text-[18px] shrink-0">chevron_right</Mat>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

