import { Bell, Leaf, MoonStar, Sprout } from "lucide-react";
import { useKoru, type HistoryEntry } from "./KoruProvider";
import { cn } from "../lib/utils";
import { localDateISO, shiftDateISO } from "../domain/localDate";

const KIND_META = {
  "check-in": { icon: Bell, tint: "text-gold", bg: "bg-gold/15" },
  memoria: { icon: Leaf, tint: "text-moss", bg: "bg-moss/15" },
  cierre: { icon: MoonStar, tint: "text-forest", bg: "bg-forest/10" },
} as const;

/** Etiqueta del día: Hoy / Ayer / fecha corta. */
function dayLabel(date: string): string {
  const today = localDateISO();
  if (date === today) return "Hoy";
  if (date === shiftDateISO(today, -1)) return "Ayer";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" });
}

export function HistoryScreen() {
  const { history } = useKoru();

  // 🔴 FIX (2026-09-09): el Historial no tenía estado vacío (quedaba en blanco
  // bajo el header) ni fechas — solo hh:mm mezclando días distintos.
  // Ahora: agrupado por día con etiqueta (Hoy/Ayer/fecha) + empty state honesto.
  const groups: Array<{ date: string; entries: HistoryEntry[] }> = [];
  for (const entry of history) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) {
      last.entries.push(entry);
    } else {
      groups.push({ date: entry.date, entries: [entry] });
    }
  }

  return (
    <div className="flex h-full flex-col px-6 pb-4 pt-8">
      <header className="animate-rise">
        <h1 className="font-serif text-2xl text-bark">Historial</h1>
        <p className="mt-1 text-sm text-earth">
          Cada acción de Michi deja un rastro que podés revisar.
        </p>
      </header>

      {history.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-sand bg-card p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand/40">
            <Sprout className="h-6 w-6 text-earth" />
          </span>
          <p className="text-[15px] font-medium text-bark">Todavía no hay actividad</p>
          <p className="max-w-[26ch] text-sm leading-snug text-earth">
            Cuando hagas check-ins, confirmes memorias o ejecutes acciones de Michi, van a aparecer acá.
          </p>
        </div>
      ) : (
        <ol className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.date}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-stone">
                {dayLabel(group.date)}
              </p>
              <ul className="flex flex-col gap-3">
                {group.entries.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
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
        {/* 🔴 FIX: antes decía "+14 energía · raíz nueva" para TODO — energía
            inventada y raíces que no se crearon. Solo el energyAwarded REAL
            de los check-ins se muestra, sin claims falsos. */}
        {entry.kind === "check-in" && entry.energy ? (
          <p className="mt-2 text-xs font-medium text-moss">+{entry.energy} energía</p>
        ) : null}
      </div>
    </li>
  );
}
