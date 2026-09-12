import { WorldObject } from "./michi/WorldObject";
import { Bell, Heart, Sparkles, CalendarDays, ChevronRight, Zap } from "lucide-react";
import { useState } from "react";
import { useKoru, type HistoryEntry } from "./KoruProvider";
import { cn } from "../lib/utils";
import { localDateISO, shiftDateISO } from "../domain/localDate";

const KIND_META = {
  "check-in": { icon: Bell, tint: "text-gold", bg: "bg-gold/15" },
  memoria: { icon: Heart, tint: "text-moss", bg: "bg-moss/15" },
  cierre: { icon: Sparkles, tint: "text-forest", bg: "bg-forest/10" },
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
    <div className="mx-page-content mw-history flex h-full flex-col px-6 pb-4 pt-8">
      <header className="animate-rise">
        <span className="mw-eyebrow">PASO A PASO CON MICHI</span>
        <img className="mh-header-art" src="/assets/michi-cards/history.webp" alt="" width="400" height="400" />
        <h1 className="font-serif text-2xl text-bark">Historial</h1>
        <p className="mt-1 text-sm text-earth">
          Lo que hicimos juntos, un día a la vez.
        </p>
      </header>

      {history.length === 0 ? (
        <div className="mx-empty mt-10 flex flex-col items-center gap-3 rounded-xl border border-sand bg-card p-8 text-center">
          <WorldObject kind="history" />
          <p className="text-[15px] font-medium text-bark">Todavía no hay actividad</p>
          <p className="max-w-[26ch] text-sm leading-snug text-earth">
            Tus charlas, los recuerdos que confirmes y las acciones completadas van a dejar su huellita acá.
          </p>
        </div>
      ) : (
        <ol className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.date}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-stone">
                <CalendarDays size={21} /><strong>{dayLabel(group.date)}</strong><span>{group.entries.length} {group.entries.length === 1 ? "actividad" : "actividades"}</span>
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
  const [expanded, setExpanded] = useState(false);
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <li className={`mx-history-card mh-history-row is-${entry.kind}`}>
      <button type="button" className="mh-history-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.bg)}>
        <Icon className={cn("h-4 w-4", meta.tint)} />
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-medium text-bark">{entry.title}</p>
          <span className="text-xs text-stone">{entry.time}</span>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-earth">{entry.detail}</p>
        <span className="mh-history-tag">{entry.kind === "check-in" ? "Rutina diaria" : entry.kind === "memoria" ? "Recuerdo guardado" : "Acción completada"}</span>
        {/* 🔴 FIX: antes decía "+14 energía · raíz nueva" para TODO — energía
            inventada y raíces que no se crearon. Solo el energyAwarded REAL
            de los check-ins se muestra, sin claims falsos. */}
        {entry.kind === "check-in" && entry.energy ? (
          <span className="mh-energy"><Zap size={14} fill="currentColor" />+{entry.energy} energía</span>
        ) : null}
      </div>
      <ChevronRight className="mh-history-chevron" size={20} />
      </button>
      {expanded && <div className="mh-history-detail"><p>{entry.detail}</p>{entry.reason && <p><strong>Por qué: </strong>{entry.reason}</p>}<small>{dayLabel(entry.date)} · {entry.time}</small></div>}
    </li>
  );
}
