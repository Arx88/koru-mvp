import { foldAccents } from "./commitments";

export type RecurrenceRule = "daily" | "weekly" | "monthly";

function setTime(base: Date, hour: number, minute = 0): Date {
  const result = new Date(base);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function recurrenceFromText(text: string): RecurrenceRule | undefined {
  const lower = foldAccents(text);
  if (/\b(todos los dias|cada dia|diario|diariamente)\b/i.test(lower)) return "daily";
  if (/\b(cada semana|semanal|todos los lunes|todos los martes|todos los miercoles|todos los jueves|todos los viernes)\b/i.test(lower)) return "weekly";
  if (/\b(cada mes|mensual)\b/i.test(lower)) return "monthly";
  return undefined;
}

export function timeStringFromText(value: string): string | undefined {
  const match = /\b(?:a\s+las|las)\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(foldAccents(value));
  if (!match) return undefined;
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = match[2] ? Math.max(0, Math.min(59, Number(match[2]))) : 0;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function timeFromText(text: string): { hour: number; minute: number } | undefined {
  const lower = foldAccents(text);
  const explicit = /\b(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(lower);
  if (explicit) {
    const hour = Number(explicit[1]);
    const minute = explicit[2] ? Number(explicit[2]) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }
  if (/\bpor la manana|a la manana|temprano\b/i.test(lower)) return { hour: 8, minute: 0 };
  if (/\bmediodia|medio dia\b/i.test(lower)) return { hour: 12, minute: 0 };
  if (/\bpor la tarde|a la tarde\b/i.test(lower)) return { hour: 17, minute: 0 };
  if (/\bpor la noche|a la noche\b/i.test(lower)) return { hour: 21, minute: 0 };
  return undefined;
}

export function dueAtFromText(text: string, now = new Date()): string | undefined {
  const lower = foldAccents(text);
  const time = timeFromText(text) ?? { hour: 9, minute: 0 };
  const due = new Date(now);

  if (/\bmanana\b/i.test(lower)) {
    due.setDate(due.getDate() + 1);
    return setTime(due, time.hour, time.minute).toISOString();
  }

  if (/\bhoy|ahora|urgente\b/i.test(lower)) {
    const today = setTime(due, time.hour, time.minute);
    if (today.getTime() <= now.getTime()) {
      today.setHours(now.getHours() + 1, 0, 0, 0);
    }
    return today.toISOString();
  }

  const inHours = /\ben\s+(\d{1,2})\s+horas?\b/i.exec(lower);
  if (inHours) {
    due.setHours(due.getHours() + Number(inHours[1]));
    return due.toISOString();
  }

  if (recurrenceFromText(text)) {
    const recurring = setTime(due, time.hour, time.minute);
    if (recurring.getTime() <= now.getTime()) recurring.setDate(recurring.getDate() + 1);
    return recurring.toISOString();
  }

  return undefined;
}

export function nextDueAtFromRecurrence(dueAt: string | undefined, recurrence: RecurrenceRule | undefined): string | undefined {
  if (!dueAt || !recurrence) return undefined;
  const next = new Date(dueAt);
  if (Number.isNaN(next.getTime())) return undefined;
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

export function dueLabel(dueAt: string | undefined, fallback = "sin fecha", now = new Date()): string {
  if (!dueAt) return fallback;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return fallback;
  const date = due.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day =
    date === today
      ? "hoy"
      : date === tomorrow.toISOString().slice(0, 10)
        ? "mañana"
        : new Intl.DateTimeFormat("es", { weekday: "short", day: "2-digit", month: "short" }).format(due);
  return `${day} ${new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(due)}`;
}
