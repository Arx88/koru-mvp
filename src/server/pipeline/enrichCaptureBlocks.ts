/**
 * Enrich Capture Blocks — enriquecimiento DETERMINISTA de los UiBlocks de
 * captura (money_summary / saved_record) con datos REALES.
 *
 * Por qué existe: el pipeline real producía blocks de 3-5 campos (ej:
 * money_summary con solo {title, total, currency}), mientras que los
 * interiores de lectura esperan summaryItems (stack bar + categorías),
 * recommendation (nota) y métricas. El resultado eran cards "básicas" en la
 * app real aunque el sistema de UI fuera rico.
 *
 * Regla de oro (anti-simulación): SOLO se usan datos reales — los records
 * creados en este turno (del tool result) y el historial del usuario
 * (state.records). Nada se inventa: si no hay historial, la card queda
 * honesta con el gasto actual; si hay historial, se agregan totales del día
 * y desglose por categoría derivados de esos records reales.
 */
import type { KoruState, UiBlock, LifeRecord } from "../../domain/types";

type RecordDraft = Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">;

/**
 * Reglas de categoría por keyword — etiquetado determinista de texto real
 * (título/notas del expense). No fabrica datos: solo clasifica lo que existe.
 */
const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/caf[eé]|coffee|medialun|croissant|tostad|latte|espresso|flat white|capuchin/i, "Café y snacks"],
  [/almuerzo|cena|restaur|parrill|pizza|sushi|hamburg|empanad|delivery|pedid|takeaway|ramen|pasta/i, "Restaurantes"],
  [/super|mercado|verdul|carnic|fruter|despensa|kiosco/i, "Supermercado"],
  [/transport|subte|colectivo|uber|taxi|cabify|bolt|nafta|gasolina|tren|estacion|peaje|didi/i, "Transporte"],
  [/farmac|medic|medicament|dentist|m[eé]dic|an[aá]lisis/i, "Salud"],
  [/cine|teatro|concierto|entrada|show|libro|librer|revista|museo/i, "Ocio"],
  [/alquiler|luz|agua|gas|internet|servicio|mudanza|plomer|electricist|internet|m[oó]vil|tel[eé]fono/i, "Hogar"],
  [/ropa|camisa|zapat|calzado|tienda|moda|jean|remera|abrigo/i, "Ropa"],
  [/gym|gimnasio|fitness|yoga|pilates|piscina|masaje/i, "Bienestar"],
  [/regalo|cumple|flores|chocolat/i, "Regalos"],
];

export function expenseCategory(text: string): string {
  const t = text || "";
  for (const [re, label] of CATEGORY_RULES) if (re.test(t)) return label;
  return "Otros";
}

function isToday(isoLike?: string): boolean {
  if (!isoLike) return false;
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function recordIsToday(r: RecordDraft): boolean {
  // Sin createdAt (drafts del turno) se asume "ahora" — es el dato recién creado.
  if (!("createdAt" in r) || !(r as { createdAt?: unknown }).createdAt) return true;
  return isToday(String((r as { createdAt?: unknown }).createdAt));
}

function parseAmount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return undefined;
}

function fmtMoney(n: number, currency?: string): string {
  const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
  return currency ? `${num} ${currency}` : num;
}

/**
 * Enriquece los blocks de captura de un turno. Devuelve una NUEVA lista.
 * - money_summary sin summaryItems → se agregan ítems por categoría usando
 *   el gasto del turno + los gastos reales de HOY del state (agrupados).
 * - money_summary sin recommendation → nota con total del día real.
 * - saved_record → records ya vienen del capture; se completa title si falta.
 */
export function enrichCaptureBlocks(
  blocks: UiBlock[],
  turnRecords: RecordDraft[],
  state: KoruState | undefined,
): UiBlock[] {
  const expenseRecords = (Array.isArray(turnRecords) ? turnRecords : []).filter(
    (r) => r && r.kind === "expense",
  );
  const historyExpenses = (Array.isArray(state?.records) ? state!.records : []).filter(
    (r) => r && r.kind === "expense" && r.amount != null,
  );
  const currencyHint =
    expenseRecords.find((r) => r.currency)?.currency ??
    historyExpenses.find((r) => r.currency)?.currency ??
    undefined;

  return blocks.map((block) => {
    if (block.type !== "money_summary") return block;

    const enriched: UiBlock = { ...block };

    // 1) summaryItems: gasto actual + agrupado real de HOY por categoría.
    if (!enriched.summaryItems?.length) {
      const items: Array<{ label: string; value: string; detail?: string }> = [];

      // Gasto(s) del turno — categorías derivadas del texto real.
      for (const r of expenseRecords.slice(0, 4)) {
        if (r.amount == null) continue;
        items.push({
          label: expenseCategory(`${r.title ?? ""} ${r.notes ?? ""}`),
          value: fmtMoney(r.amount, r.currency ?? enriched.currency ?? currencyHint),
          detail: (r.title ?? "").slice(0, 80) || undefined,
        });
      }

      // Historial de HOY (records reales del state) agrupado por categoría.
      const todayGroups = new Map<string, { total: number; count: number }>();
      for (const r of historyExpenses) {
        if (!recordIsToday(r as RecordDraft)) continue;
        const cat = expenseCategory(`${r.title ?? ""} ${r.notes ?? ""}`);
        const amt = parseAmount(r.amount) ?? 0;
        const g = todayGroups.get(cat) ?? { total: 0, count: 0 };
        g.total += amt;
        g.count += 1;
        todayGroups.set(cat, g);
      }
      for (const [label, g] of todayGroups) {
        // No duplicar la categoría si ya viene del gasto del turno.
        if (items.some((it) => it.label === label)) continue;
        items.push({
          label,
          value: fmtMoney(g.total, enriched.currency ?? currencyHint),
          detail: `${g.count} movimiento${g.count > 1 ? "s" : ""} de hoy`,
        });
      }

      if (items.length) enriched.summaryItems = items.slice(0, 6);
    }

    // 2) total: si vino undefined pero hay gasto real del turno, usarlo.
    if (enriched.total == null) {
      const amt = expenseRecords.find((r) => r.amount != null)?.amount;
      if (amt != null) {
        enriched.total = amt;
        enriched.currency = enriched.currency ?? expenseRecords.find((r) => r.amount != null)?.currency ?? currencyHint;
      }
    }

    // 3) recommendation honesta con contexto del día (solo si hay datos).
    if (!enriched.recommendation) {
      const dayTotal =
        historyExpenses.filter((r) => recordIsToday(r as RecordDraft)).reduce((sum, r) => sum + (parseAmount(r.amount) ?? 0), 0) +
        expenseRecords.reduce((sum, r) => sum + (parseAmount(r.amount) ?? 0), 0);
      const dayCount =
        historyExpenses.filter((r) => recordIsToday(r as RecordDraft)).length + expenseRecords.length;
      if (dayCount > 0 && dayTotal > 0) {
        enriched.recommendation = `Hoy: ${fmtMoney(dayTotal, enriched.currency ?? currencyHint)} en ${dayCount} movimiento${dayCount > 1 ? "s" : ""}`;
      }
    }

    return enriched;
  });
}
