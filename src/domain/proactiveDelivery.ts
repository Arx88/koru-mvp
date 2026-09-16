import type { KoruState } from "./types";
import { localDateISO } from "./localDate";

export function canDeliverProactive(state: KoruState, now: Date): boolean {
  if (!state.heartbeat.enabled || !state.worldSignalsEnabled || state.voicePreference?.proactivity === 0) return false;
  if (remainingProactiveCapacity(state, now) <= 0) return false;
  const hour = now.getHours();
  const { dndStartHour: start, dndEndHour: end } = state.preferences ?? {};
  if (start != null && end != null && start !== end &&
    (start < end ? hour >= start && hour < end : hour >= start || hour < end)) return false;
  const { activeStartHour, activeEndHour } = state.heartbeat;
  return activeStartHour === activeEndHour || (activeStartHour < activeEndHour
    ? hour >= activeStartHour && hour < activeEndHour
    : hour >= activeStartHour || hour < activeEndHour);
}

export function remainingProactiveCapacity(state: KoruState, now: Date): number {
  const count = state.heartbeat.dailyNudgeDate === localDateISO(now) ? state.heartbeat.dailyNudgeCount : 0;
  return Math.max(0, state.heartbeat.maxNudgesPerDay - count);
}

export interface ShownProactive {
  key: string;
  shownAt: number;
}

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function reserveProactiveDelivery(
  stored: string | null,
  key: string,
  now: number,
  dailyCapacity = 1,
): { allowed: boolean; shown: ShownProactive[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored ?? "[]");
  } catch {
    parsed = [];
  }
  const shown: ShownProactive[] = Array.isArray(parsed)
    ? parsed.filter((item): item is ShownProactive =>
      item !== null && typeof item === "object" &&
      typeof item.key === "string" && typeof item.shownAt === "number" &&
      Number.isFinite(item.shownAt) && item.shownAt > now - RETENTION_MS,
    ).slice(-20)
    : [];
  const today = localDateISO(new Date(now));
  const todayCount = shown.filter(item => localDateISO(new Date(item.shownAt)) === today).length;
  const recent = shown.some(item => now - item.shownAt < 25 * 60 * 1000);
  if (shown.some(item => item.key === key) || recent || todayCount >= dailyCapacity) return { allowed: false, shown };
  return { allowed: true, shown: [...shown, { key, shownAt: now }].slice(-20) };
}
