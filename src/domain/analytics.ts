/**
 * Koru Analytics — tracking simple de eventos clave para medir éxito del
 * Create feature y de la reopen de records.
 *
 * Estrategia:
 * - Los eventos se guardan en localStorage (koru.analytics.v1) como array JSON.
 * - Se exponen funciones para trackear y para consultar métricas.
 * - No se envía a un servidor (privacy-first, offline-capable).
 * - El CEO puede consultar las métricas via la consola del browser:
 *   `window.koruAnalytics.report()` → devuelve un resumen.
 *
 * Métricas clave (per CEO brief):
 * 1. Capture adoption: % de usuarios que crearon ≥1 item via Create en week 1
 * 2. Collections reopen rate: % de users que guardaron algo y reabrieron en 7 días
 * 3. Create→Chat ratio: items created via Create vs items saved via chat
 */

const STORAGE_KEY = "koru.analytics.v1";
const MAX_EVENTS = 500; // cap para no llenar localStorage

export type AnalyticsEvent = {
  type: string;
  ts: string; // ISO timestamp
  props?: Record<string, unknown>;
};

type AnalyticsStore = {
  events: AnalyticsEvent[];
  firstSeen: string;
  userId: string;
};

function load(): AnalyticsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        events: [],
        firstSeen: new Date().toISOString(),
        userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
    }
    return JSON.parse(raw) as AnalyticsStore;
  } catch {
    return { events: [], firstSeen: new Date().toISOString(), userId: "unknown" };
  }
}

function save(store: AnalyticsStore): void {
  try {
    // Cap events to MAX_EVENTS (keep most recent)
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(-MAX_EVENTS);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage might be full — silently drop
  }
}

/**
 * Track an analytics event. Safe to call from anywhere — no-op if localStorage
 * is unavailable.
 */
export function track(type: string, props?: Record<string, unknown>): void {
  if (typeof localStorage === "undefined") return;
  const store = load();
  store.events.push({ type, ts: new Date().toISOString(), props });
  save(store);
}

/**
 * Get a summary of key metrics for the CEO dashboard.
 */
export function getMetrics(): {
  userId: string;
  firstSeen: string;
  totalEvents: number;
  createCount: number;
  chatSaveCount: number;
  reopenCount: number;
  createToChatRatio: number;
  captureAdoption: boolean;
  reopenRate: number;
} {
  const store = load();
  const createEvents = store.events.filter(e => e.type === "create_record");
  const chatSaveEvents = store.events.filter(e => e.type === "save_record_via_chat");
  const reopenEvents = store.events.filter(e => e.type === "reopen_record");
  const createCount = createEvents.length;
  const chatSaveCount = chatSaveEvents.length;
  const reopenCount = reopenEvents.length;
  const totalSaved = createCount + chatSaveCount;
  const createToChatRatio = totalSaved > 0 ? createCount / totalSaved : 0;
  const captureAdoption = createCount > 0;
  // Reopen rate: si guardó algo y reabrió algo → 1.0, sino 0.0
  // (métrica simplificada — en producción habría que trackear por user+week)
  const reopenRate = totalSaved > 0 ? Math.min(1, reopenCount / totalSaved) : 0;
  return {
    userId: store.userId,
    firstSeen: store.firstSeen,
    totalEvents: store.events.length,
    createCount,
    chatSaveCount,
    reopenCount,
    createToChatRatio,
    captureAdoption,
    reopenRate,
  };
}

/**
 * Pretty-print metrics to console (for CEO/debugging).
 */
export function report(): void {
  const m = getMetrics();
  console.log("%c📊 Koru Analytics Report", "font-size:16px;font-weight:bold;color:#8363f9");
  console.log(`User: ${m.userId} (first seen: ${m.firstSeen})`);
  console.log(`Total events tracked: ${m.totalEvents}`);
  console.log(`%cCreate feature:`, "font-weight:bold");
  console.log(`  Items created via Create: ${m.createCount}`);
  console.log(`  Items saved via chat: ${m.chatSaveCount}`);
  console.log(`  Create→Chat ratio: ${(m.createToChatRatio * 100).toFixed(0)}%`);
  console.log(`  Capture adoption: ${m.captureAdoption ? "✅ Yes" : "❌ No"}`);
  console.log(`%cCollections:`, "font-weight:bold");
  console.log(`  Records reopened: ${m.reopenCount}`);
  console.log(`  Reopen rate: ${(m.reopenRate * 100).toFixed(0)}%`);
}

// Expose globally for CEO console access
if (typeof window !== "undefined") {
  (window as any).koruAnalytics = { track, getMetrics, report };
}
