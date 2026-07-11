/**
 * Heartbeat Proactivo — Nudges inteligentes basados en contexto
 *
 * Reglas:
 * - Solo 1 nudge proactivo por ciclo.
 * - No repetir el mismo nudge en 20h.
 * - Solo dentro de horas activas y con capacidad diaria.
 * - Prioridad: alta = evita problemas reales; media = mejora día; baja = no se muestra.
 */

import { foldAccents } from "./commitments";
import type { KoruState, ProactiveNudge } from "./types";

type NudgeDraft = Omit<ProactiveNudge, "id" | "createdAt">;

function wasRecentlyNudged(state: KoruState, sourceId: string, now: Date): boolean {
  const cutoff = now.getTime() - 1000 * 60 * 60 * 20; // 20 horas
  return state.nudges.some((n) => n.sourceId === sourceId && new Date(n.createdAt).getTime() > cutoff);
}

function wakeUpHour(state: KoruState): number | null {
  const wakeMemory = state.memories.find((m) =>
    m.status === "confirmed" &&
    m.kind === "routine" &&
    /\b(despertar|despierto|levanto|me levanto|alarma).*\b(6|7|8|9|5)\b/i.test(m.text)
  );
  if (!wakeMemory) return null;
  const match = wakeMemory.text.match(/\b(5|6|7|8|9)\b/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function fanTeam(state: KoruState): string | null {
  const teamMemory = state.memories.find((m) =>
    m.status === "confirmed" &&
    /\b(fan|hincha|soy de|equipo|boca|river|barcelona|real madrid|juventus|milan|inter|psg|bayern|liverpool|manchester|chelsea|arsenal)\b/i.test(m.text)
  );
  if (!teamMemory) return null;
  const match = teamMemory.text.match(/\b(Boca|River|Barcelona|Real Madrid|Juventus|Milan|Inter|PSG|Bayern|Liverpool|Manchester City|Manchester United|Chelsea|Arsenal)\b/i);
  return match ? match[1] : null;
}

function lastEntriesEnergy(state: KoruState): "low" | "medium" | "high" {
  const recent = state.entries.slice(0, 5);
  if (recent.length < 2) return "medium";
  const lowCount = recent.filter((e) => e.energyAwarded < 10).length;
  if (lowCount >= 3) return "low";
  if (lowCount >= 1) return "medium";
  return "high";
}

// ── Generadores de nudges proactivos ───────────────────────────────

function weatherWakeUpNudge(state: KoruState, now: Date): NudgeDraft | null {
  const wakeHour = wakeUpHour(state);
  if (wakeHour === null) return null;
  // Solo entre la hora de despertar y wakeHour + 30 min
  const currentHour = now.getUTCHours();
  const currentMin = now.getUTCMinutes();
  if (currentHour !== wakeHour || currentMin > 30) return null;
  if (wasRecentlyNudged(state, "weather-wakeup", now)) return null;

  return {
    title: "Buen día",
    body: "¿Querés que consulte el clima para que salgas preparado?",
    reason: "Hora de despertar detectada en rutina",
    priority: "medium",
    source: "heartbeat",
    sourceId: "weather-wakeup",
  };
}

function meetingTrafficNudge(state: KoruState, now: Date): NudgeDraft | null {
  const upcomingMeeting = state.calendarEvents.find((e) => {
    if (!e.location) return false;
    const start = new Date(e.startsAt);
    const diffMin = (start.getTime() - now.getTime()) / (1000 * 60);
    return diffMin > 15 && diffMin <= 45;
  });
  if (!upcomingMeeting) return null;
  if (wasRecentlyNudged(state, `traffic-${upcomingMeeting.id}`, now)) return null;

  return {
    title: "Salí con tiempo",
    body: `Tenés "${upcomingMeeting.title}" en ${upcomingMeeting.location} dentro de poco. ¿Querés que revise el tráfico?`,
    reason: "Reunión con ubicación próxima",
    priority: "high",
    source: "heartbeat",
    sourceId: `traffic-${upcomingMeeting.id}`,
  };
}

function energyPauseNudge(state: KoruState, now: Date): NudgeDraft | null {
  const energy = lastEntriesEnergy(state);
  if (energy !== "low") return null;
  // Solo entre las 14:00 y 18:00 (siesta/tarde)
  const hour = now.getHours();
  if (hour < 14 || hour > 18) return null;
  if (wasRecentlyNudged(state, "energy-pause", now)) return null;

  return {
    title: "¿Una pausa?",
    body: "Veo que venís con poca energía. Un respiro de 10 minutos puede cambiar la tarde.",
    reason: "Energía baja detectada en últimas entradas",
    priority: "medium",
    source: "heartbeat",
    sourceId: "energy-pause",
  };
}

function sportsResultNudge(state: KoruState, now: Date): NudgeDraft | null {
  const team = fanTeam(state);
  if (!team) return null;
  // Solo los fines de semana o si hay memoria reciente de partido
  const day = now.getDay(); // 0 = dom, 6 = sab
  if (day !== 0 && day !== 6) {
    // O si hay un evento de calendario con el nombre del equipo
    const hasMatchToday = state.calendarEvents.some((e) => foldAccents(e.title).includes(foldAccents(team)));
    if (!hasMatchToday) return null;
  }
  if (wasRecentlyNudged(state, `sports-${team}`, now)) return null;

  return {
    title: `¿Cómo le fue a ${team}?`,
    body: "Si jugó hoy, puedo buscar el resultado y dejártelo listo.",
    reason: `Interés detectado: seguís a ${team}`,
    priority: "low",
    source: "heartbeat",
    sourceId: `sports-${team}`,
  };
}

function routineReminderNudge(state: KoruState, now: Date): NudgeDraft | null {
  // Si hay una rutina médica (medicación, ejercicio) y no se registró hoy
  const routineMem = state.memories.find((m) =>
    m.status === "confirmed" &&
    m.kind === "routine" &&
    /\b(medicación|pastilla|ejercicio|gimnasio|correr|meditar|leer)\b/i.test(m.text) &&
    !wasRecentlyNudged(state, `routine-${m.id}`, now)
  );
  if (!routineMem) return null;

  const hour = now.getUTCHours();
  const routineHourMatch = routineMem.text.match(/\b(7|8|9|10|11|12|13|14|15|16|17|18|19|20|21):?(00|30)?\b/);
  if (routineHourMatch) {
    const routineHour = parseInt(routineHourMatch[1], 10);
    if (Math.abs(hour - routineHour) > 1) return null;
  }

  return {
    title: "Rutina de hoy",
    body: `Recordá que tenés en tu rutina: "${routineMem.text}". ¿Ya lo hiciste?`,
    reason: "Rutina confirmada sin registro hoy",
    priority: "medium",
    source: "heartbeat",
    sourceId: `routine-${routineMem.id}`,
  };
}

// ── Motor principal ────────────────────────────────────────────────

export function buildProactiveNudges(state: KoruState, now = new Date()): NudgeDraft[] {
  const candidates = [
    weatherWakeUpNudge(state, now),
    meetingTrafficNudge(state, now),
    energyPauseNudge(state, now),
    sportsResultNudge(state, now),
    routineReminderNudge(state, now),
  ].filter((n): n is NudgeDraft => Boolean(n));

  // Rankear: alta > media > baja
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = candidates.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Filtrar lows: nunca se muestran como nudges proactivos
  const effectiveCandidates = sorted.filter((n) => n.priority !== "low");

  // Máximo 1 nudge proactivo por ciclo para no molestar
  return effectiveCandidates.slice(0, 1);
}
