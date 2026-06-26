

type WellbeingBlock = {
  type: "wellbeing";
  title?: string;
  emoji?: string;
  sleep?: {
    icon: string;
    value: string;
    label: string;
  };
  suggestion?: {
    icon: string;
    value: string;
    label: string;
  };
};

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export function WellbeingCard({ block }: { block: WellbeingBlock }) {
  return (
    <div className="flex w-full" data-ui-block="wellbeing">
      <div className="flex flex-col w-full">
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
          style={{ borderTopLeftRadius: "4px" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center">
              <Mat className="text-[16px] text-purple-500">favorite</Mat>
            </div>
            <span className="text-[15px] font-medium text-gray-800">
              {block.title ?? "Tu bienestar"} {block.emoji ?? "🧘‍♀️"}
            </span>
          </div>
          <div className="flex gap-3">
            {block.sleep && (
              <div className="flex-1 bg-[#F8F9FA] rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <Mat className="text-indigo-400 mb-1">{block.sleep.icon}</Mat>
                <p className="text-sm font-bold text-gray-800">{block.sleep.value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  {block.sleep.label}
                </p>
              </div>
            )}
            {block.suggestion && (
              <button className="flex-1 bg-purple-50 border border-purple-100 rounded-xl p-3 flex flex-col items-center justify-center text-center hover:bg-purple-100 transition-colors">
                <Mat className="text-purple-500 mb-1">{block.suggestion.icon}</Mat>
                <p className="text-sm font-medium text-purple-700">
                  {block.suggestion.value}
                </p>
                <p className="text-[10px] text-purple-500/70">{block.suggestion.label}</p>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

