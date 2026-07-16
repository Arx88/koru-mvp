// ============================================================================
// stressEngine — Inferencia de nivel de estrés a partir de señales de
// bienestar (sleep, HRV, mood) y rachas de hábitos. Cálculo puro, sin API.
//
// Algoritmo (documentado en docs/superpowers/plans):
//   • Base score: 50
//   • Sleep deficit:  sleep < 6h → +15;  sleep < 5h → +25
//   • HRV drop:       hrv < 40ms  → +15
//                     (o hrv < 80% del promedio de los últimos 7 días → +15)
//   • Mood:           si el sentimiento reciente es "heavy" o "busy" → +10
//   • Streak break:   si alguna racha de hábito se cortó en los últimos 3 días → +10
//
// Score final:
//   < 40  → "bajo"
//   40-70 → "medio"
//   > 70  → "alto"
//
// `factors` lista los aportes legibles (ej.: "Dormiste 5.2h (ideal: 7h+)").
// ============================================================================

import type { WellbeingLog, DailyEntry, Habit, HabitLog } from "./types";
import { computeStreak } from "./store";

export type StressLevel = "bajo" | "medio" | "alto";

export type StressInference = {
  level: StressLevel;
  score: number;
  factors: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateDay(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Promedio de los valores numéricos de un arreglo (ignora NaN/undefined).
 */
function avg(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Busca el valor más reciente de una métrica en los logs (por fecha desc).
 * Devuelve { value, log } o null si no hay muestras.
 */
function latestMetric(
  logs: WellbeingLog[],
  metric: WellbeingLog["metric"],
): { value: number; log: WellbeingLog } | null {
  const filtered = logs
    .filter((l) => l.metric === metric)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  if (filtered.length === 0) return null;
  const top = filtered[0];
  if (!Number.isFinite(top.value)) return null;
  return { value: top.value, log: top };
}

/**
 * Promedio de una métrica en los últimos `days` días (inclusive la fecha del
 * log más reciente). Devuelve null si no hay muestras suficientes.
 */
function averageMetricOverDays(
  logs: WellbeingLog[],
  metric: WellbeingLog["metric"],
  days: number,
): number | null {
  const filtered = logs.filter((l) => l.metric === metric);
  if (filtered.length === 0) return null;
  const sorted = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));
  const cutoffMs = parseDateDay(sorted[0].date) - days * DAY_MS;
  const window = sorted.filter((l) => parseDateDay(l.date) >= cutoffMs);
  return avg(window.map((l) => l.value));
}

/**
 * Devuelve los entries de los últimos `days` días (ordenados por fecha desc).
 */
function recentEntries(entries: DailyEntry[], days: number): DailyEntry[] {
  if (entries.length === 0) return [];
  const sorted = entries.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cutoffMs = Date.parse(sorted[0].createdAt) - days * DAY_MS;
  return sorted.filter((e) => Date.parse(e.createdAt) >= cutoffMs);
}

/**
 * Chequea si la racha de algún hábito se cortó en los últimos `days` días.
 * Una racha "se corta" si el último log del hábito fue hace más de 1 día
 * (i.e. no hay log hoy ni ayer para un hábito activo). Para evitar falsos
 * positivos, sólo consideramos hábitos que tenían al menos una racha de 2+
 * días antes del corte.
 */
function anyStreakBrokeRecently(
  habits: Habit[],
  habitLogs: HabitLog[],
  days: number,
): { broke: boolean; habitLabel?: string } {
  if (habits.length === 0 || habitLogs.length === 0) return { broke: false };
  const today = todayISO();
  const cutoff = parseDateDay(today) - days * DAY_MS;
  for (const h of habits) {
    if (!h.active) continue;
    const logs = habitLogs
      .filter((l) => l.habitId === h.id)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
    if (logs.length === 0) continue;
    const lastLogMs = parseDateDay(logs[0].date);
    if (!Number.isFinite(lastLogMs)) continue;
    // Si el último log fue en la ventana [cutoff, hoy-2d], la racha se cortó.
    const twoDaysAgoMs = parseDateDay(today) - 1 * DAY_MS;
    if (lastLogMs >= cutoff && lastLogMs < twoDaysAgoMs) {
      // Verificamos que hubiera una racha previa (al menos 2 logs consecutivos)
      // para no reportar "corte" cuando simplemente nunca se hizo.
      const streakBefore = computeStreak(h.id, logs.slice(1));
      if (streakBefore >= 2) {
        return { broke: true, habitLabel: h.label };
      }
    }
  }
  return { broke: false };
}

/**
 * Infiere el nivel de estrés del usuario a partir de WellbeingLogs + DailyEntries
 * (y opcionalmente Habits + HabitLogs para el factor de racha cortada).
 *
 * El algoritmo es heurístico y determinista (sin API). Devuelve score 0-100,
 * nivel "bajo" | "medio" | "alto", y la lista de factores que contribuyeron.
 */
export function inferStressLevel(
  logs: WellbeingLog[],
  entries: DailyEntry[],
  habits?: Habit[],
  habitLogs?: HabitLog[],
): StressInference {
  let score = 50;
  const factors: string[] = [];

  // ─── Sleep deficit ──────────────────────────────────────────────────────
  const sleep = latestMetric(logs, "sleep");
  if (sleep) {
    const hours = sleep.value;
    if (hours < 5) {
      score += 25;
      factors.push(`Dormiste ${hours.toFixed(1)}h (ideal: 7h+)`);
    } else if (hours < 6) {
      score += 15;
      factors.push(`Dormiste ${hours.toFixed(1)}h (ideal: 7h+)`);
    }
  }

  // ─── HRV drop ───────────────────────────────────────────────────────────
  const hrv = latestMetric(logs, "hrv");
  if (hrv) {
    const sevenDayAvg = averageMetricOverDays(logs, "hrv", 7);
    let dropped = false;
    if (hrv.value < 40) {
      dropped = true;
      factors.push(`HRV bajo: ${Math.round(hrv.value)}ms`);
    } else if (sevenDayAvg != null && sevenDayAvg > 0 && hrv.value < sevenDayAvg * 0.8) {
      dropped = true;
      factors.push(
        `HRV cayó: ${Math.round(hrv.value)}ms (7d avg: ${Math.round(sevenDayAvg)}ms)`,
      );
    }
    if (dropped) score += 15;
  }

  // ─── Mood (sentiment de entries recientes) ──────────────────────────────
  const recent = recentEntries(entries, 3);
  const heavyOrBusy = recent.filter(
    (e) => e.sentiment === "heavy" || e.sentiment === "busy",
  );
  if (heavyOrBusy.length > 0) {
    score += 10;
    const sentimentLabel = heavyOrBusy[0].sentiment === "heavy" ? "heavy" : "busy";
    factors.push(`Ánimo ${sentimentLabel} en ${heavyOrBusy.length} entrada(s) reciente(s)`);
  }

  // ─── Streak break ───────────────────────────────────────────────────────
  if (habits && habits.length > 0 && habitLogs && habitLogs.length > 0) {
    const broke = anyStreakBrokeRecently(habits, habitLogs, 3);
    if (broke.broke) {
      score += 10;
      factors.push(`Racha de ${broke.habitLabel ?? "hábito"} cortada`);
    }
  }

  // Clamp 0-100.
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level: StressLevel = score < 40 ? "bajo" : score <= 70 ? "medio" : "alto";
  return { level, score, factors };
}
