import { upcomingCalendarEvents } from "./calendar";
import { foldAccents } from "./commitments";
import { buildProactiveNudges } from "./heartbeatProactive";
import { dueLabel } from "./time";
import type { KoruState, ProactiveNudge } from "./types";
import { localDateISO } from "./localDate";

type NudgeDraft = Omit<ProactiveNudge, "id" | "createdAt">;

/* ── Estado "ya mostrado" de un nudge ──────────────────────────────────────
 * 🔴 FIX SPAM (2026-09-13): el marcado era reescribir el `title` a
 * "[proactive_shown] …". Dos consecuencias medidas en producción:
 *  1. El prefijo se filtraba a los widgets y había que limpiarlo a mano en
 *     CADA consumidor (Home, prioridades).
 *  2. El marcado corría dentro de un updater de React → con StrictMode se
 *     aplicaba dos veces y quedaba "[proactive_shown] [proactive_shown] …".
 * Ahora el marcado es el campo `shownAt` (idempotente). El prefijo viejo se
 * sigue reconociendo para no revivir nudges ya mostrados en estados
 * persistidos por versiones anteriores.
 */
export const SHOWN_TITLE_PREFIX = "[proactive_shown]";

/**
 * Clave estable de un nudge. NUNCA incluir el `title`: el título cambia con el
 * tiempo para el MISMO commitment ("Que no se pierda" → "Esto es para hoy" →
 * "Esto quedó pendiente"), así que meter el título en la clave hacía que cada
 * variante entrara como nudge nuevo.
 */
export function nudgeDedupeKey(nudge: Pick<ProactiveNudge, "source" | "sourceId">): string {
  return `${nudge.source ?? "brain"}|${nudge.sourceId ?? ""}`;
}

export function isNudgeShown(nudge: Pick<ProactiveNudge, "title" | "shownAt">): boolean {
  return Boolean(nudge.shownAt) || (nudge.title ?? "").startsWith(SHOWN_TITLE_PREFIX);
}

export function stripShownMarker(title: string): string {
  return (title ?? "").replace(/^\[proactive_shown\]\s*/i, "");
}

/**
 * El nudge que corresponde inyectar en el chat: el primero pendiente. Un nudge
 * descartado o ya mostrado (`shownAt`) no se vuelve a inyectar NUNCA.
 *
 * 🔴 FIX SPAM (2026-09-13): antes esto era "el primero cuyo título no empiece
 * con [proactive_shown]" + dedupe por "mismo texto en los últimos 6 turnos del
 * chat". Cuando el texto salía de esa ventana, el MISMO mensaje volvía al chat.
 * Reproducido en producción: 6 turnos de chat y el nudge "Esto quedó pendiente /
 * Llamar al dentista" reapareció (13ª vez).
 */
export function pickNudgeToInject(nudges: ProactiveNudge[] | undefined): ProactiveNudge | undefined {
  return (nudges ?? []).find((nudge) => !nudge.dismissed && !isNudgeShown(nudge));
}

function sameDay(a: Date, b: Date): boolean {
  // 🔴 FIX: fecha LOCAL (antes UTC → "hoy" saltaba de día tras ~21:00 en LATAM)
  return localDateISO(a) === localDateISO(b);
}

function formatRelativeDay(date: Date, now: Date): string {
  if (sameDay(date, now)) return "hoy";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(date, tomorrow)) return "mañana";
  return new Intl.DateTimeFormat("es", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function formatShortTime(value: string): string {
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isWithinActiveHours(state: KoruState, now: Date): boolean {
  if (!state.heartbeat.enabled) return false;
  const hour = now.getHours();
  const start = state.heartbeat.activeStartHour;
  const end = state.heartbeat.activeEndHour;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function hasFreshRun(state: KoruState, now: Date): boolean {
  if (!state.heartbeat.lastRunAt) return false;
  const lastRun = new Date(state.heartbeat.lastRunAt).getTime();
  return now.getTime() - lastRun < 1000 * 60 * 25;
}

function hasDailyCapacity(state: KoruState, now: Date): boolean {
  const today = localDateISO(now);
  const count = state.heartbeat.dailyNudgeDate === today ? state.heartbeat.dailyNudgeCount : 0;
  return count < state.heartbeat.maxNudgesPerDay;
}

function dueHintPriority(dueHint: string): ProactiveNudge["priority"] {
  const lower = foldAccents(dueHint);
  if (/\bhoy|urgente|ahora\b/.test(lower)) return "high";
  if (/\bmanana|reunion\b/.test(lower)) return "medium";
  return "low";
}

function shouldNudgeCommitment(commitment: KoruState["commitments"][number], now: Date): boolean {
  if (commitment.status !== "open") return false;
  if (commitment.remindedAt && commitment.dueAt && new Date(commitment.remindedAt).getTime() >= new Date(commitment.dueAt).getTime()) {
    return false;
  }
  if (commitment.dueAt) {
    const due = new Date(commitment.dueAt);
    if (Number.isNaN(due.getTime())) return false;
    const windowStart = now.getTime() + 1000 * 60 * 60 * 2;
    return due.getTime() <= windowStart;
  }
  return /\bhoy|manana|urgente|reunion\b/i.test(foldAccents(commitment.dueHint));
}

function commitmentNudges(state: KoruState, now: Date): NudgeDraft[] {
  return state.commitments
    .filter((commitment) => shouldNudgeCommitment(commitment, now))
    .slice(0, 3)
    .map((commitment) => {
      const overdue = commitment.dueAt ? new Date(commitment.dueAt).getTime() < now.getTime() : false;
      return {
        title: overdue ? "Esto quedó pendiente" : foldAccents(commitment.dueHint).includes("hoy") ? "Esto es para hoy" : "Que no se pierda",
        body: commitment.title,
        reason: commitment.dueAt ? `Recordatorio: ${dueLabel(commitment.dueAt, commitment.dueHint, now)}` : `Pendiente abierto: ${commitment.dueHint}`,
        priority: overdue ? "high" : commitment.dueAt ? "medium" : dueHintPriority(commitment.dueHint),
        source: "commitment",
        sourceId: commitment.id,
      };
    });
}

function calendarNudges(state: KoruState, now: Date): NudgeDraft[] {
  return upcomingCalendarEvents(state.calendarEvents, now, 30)
    .slice(0, 2)
    .map((event) => {
      const startsAt = new Date(event.startsAt);
      const relative = formatRelativeDay(startsAt, now);
      return {
        title: `${event.title}`,
        body: `${relative} ${formatShortTime(event.startsAt)}${event.location ? ` · ${event.location}` : ""}`,
        reason: "Evento del calendario",
        priority: sameDay(startsAt, now) ? "high" : "medium",
        source: "calendar",
        sourceId: event.id,
      };
    });
}

export function buildHeartbeatNudges(state: KoruState, now = new Date()): NudgeDraft[] {
  if (!isWithinActiveHours(state, now) || !hasDailyCapacity(state, now) || hasFreshRun(state, now)) {
    return [];
  }

  const commitment = commitmentNudges(state, now);
  const calendar = calendarNudges(state, now);
  const proactive = buildProactiveNudges(state, now);

  // Proactivos primero si son high priority, sino después de commitments
  const sorted = [...proactive, ...commitment, ...calendar].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return sorted.slice(0, state.heartbeat.maxNudgesPerDay);
}

export function heartbeatStatusLabel(state: KoruState, now = new Date()): string {
  if (!state.heartbeat.enabled) return "En silencio";
  if (!isWithinActiveHours(state, now)) return "Fuera de hora";
  if (!hasDailyCapacity(state, now)) return "Por hoy alcanza";
  return "Atento";
}
