import { Bell, Leaf, MoonStar } from "lucide-react";
import { useKoru, type HistoryEntry } from "./KoruProvider";
import { cn } from "../lib/utils";

const KIND_META = {
  "check-in": { icon: Bell, tint: "text-gold", bg: "bg-gold/15" },
  memoria: { icon: Leaf, tint: "text-moss", bg: "bg-moss/15" },
  cierre: { icon: MoonStar, tint: "text-forest", bg: "bg-forest/10" },
} as const;

export function HistoryScreen() {
  const { history } = useKoru();

  return (
    <div className="flex h-full flex-col px-6 pb-4 pt-8">
      <header className="animate-rise">
        <h1 className="font-serif text-2xl text-bark">Historial</h1>
        <p className="mt-1 text-sm text-earth">
          Cada acción de Koru deja un rastro que puedes revisar.
        </p>
      </header>

      <ol className="mt-6 flex flex-1 flex-col gap-3 overflow-y-auto">
        {history.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <li className="flex gap-3 rounded-xl border border-sand bg-card p-4">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.bg)}>
        <Icon className={cn("h-4 w-4", meta.tint)} />
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-medium text-bark">{entry.title}</p>
          <span className="text-xs text-stone">{entry.time}</span>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-earth">{entry.detail}</p>
        {entry.reason && (
          <p className="mt-2 rounded-lg bg-warm-white px-3 py-2 text-xs leading-relaxed text-earth">
            <span className="font-semibold">Por qué: </span>
            {entry.reason}
          </p>
        )}
        {entry.energy ? (
          <p className="mt-2 text-xs font-medium text-moss">+{entry.energy} energía · raíz nueva</p>
        ) : null}
      </div>
    </li>
  );
}
