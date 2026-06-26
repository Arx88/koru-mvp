import type { UiBlock } from "../../domain/types";

export function MatchTimelineCard({ block }: { block: UiBlock }) {
  const items = (block as any).items ?? [
    { minute: "34'", text: "Boca 1-0", sub: "Benedetto", active: true },
    { minute: "59'", text: "River 1-1", sub: "", active: false },
    { minute: "78'", text: "Boca 2-1", sub: "Benedetto · Ahora", now: true },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Fixture · En vivo</span>
      </div>
      <div className="bg-white rounded-3xl p-5 card-shadow border border-gray-50">
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-300 before:via-emerald-200 before:to-transparent">
          {items.map((ev: any, i: number) => (
            <button
              key={i}
              onClick={() => {}}
              className="relative flex items-start gap-4 group w-full text-left transition-transform hover:scale-[1.01]"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white ring-4 ring-white z-10 shrink-0 text-[10px] font-bold ${ev.now ? "bg-emerald-500" : ev.active ? "bg-emerald-500" : "bg-sky-400"}`}>
                {ev.minute}
              </div>
              <div className={`p-3 rounded-xl w-full ${ev.now ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50"}`}>
                <p className="text-[13px] font-bold text-gray-900">
                  {ev.text}
                  {ev.sub && <span className={`font-medium ${ev.now ? "text-emerald-600" : "text-gray-400"}`}> {ev.sub}</span>}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
