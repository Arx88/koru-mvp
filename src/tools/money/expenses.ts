/**
 * Bloque Money — Anotar gasto, resumen, alerta, presupuesto, suscripción.
 * Todas locales (leen/escriben el KoruState del usuario). Sin API externa.
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import type { LifeRecord } from "../../domain/types";

// ─── expense_track ──────────────────────────────────────────────────────────
export const expenseTrack: ToolHandler = {
  definition: defineTool(
    "expense_track",
    "Registra un gasto del usuario con monto, moneda, categoría y nota. Úsala cuando el usuario diga 'gasté 25 en cena', 'anota 50 de gasolina', 'gaste 120 euros en super'. El gasto se guarda como record tipo 'expense'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Descripción del gasto (ej: 'Cena', 'Gasolina')." },
        amount: { type: "number", description: "Monto." },
        currency: { type: "string", description: "Moneda (ej: EUR, USD, ARS). Default EUR." },
        note: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["title", "amount"],
    },
  ),
  policy: policies.localWrite("Guarda gasto del usuario."),
  async run(args, ctx: ToolRunContext) {
    const title = String(args.title ?? "").trim();
    const amount = Number(args.amount);
    const currency = String(args.currency ?? "EUR").toUpperCase().trim();
    if (!title || !Number.isFinite(amount)) {
      return { type: "expense_track", status: "failed", error: "Necesito título y monto." };
    }
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "money",
      kind: "expense",
      title,
      amount,
      currency,
      notes: args.note ? String(args.note) : undefined,
      tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
    };
    return {
      type: "expense_track",
      status: "ok",
      block: { type: "saved_record", title: "Gasto anotado", records: [record] },
      records: [record],
    };
  },
};

// ─── expense_summary ────────────────────────────────────────────────────────
function expensesByPeriod(records: LifeRecord[], periodDays: number) {
  const now = Date.now();
  const since = now - periodDays * 24 * 60 * 60 * 1000;
  return records.filter((r) => {
    if (r.kind !== "expense" || typeof r.amount !== "number") return false;
    const created = new Date(r.createdAt).getTime();
    return Number.isFinite(created) && created >= since;
  });
}

export const expenseSummary: ToolHandler = {
  definition: defineTool(
    "expense_summary",
    "Resume los gastos guardados del usuario por período (hoy, semana, mes) con totales, moneda y desglose. Úsala cuando el usuario pregunte '¿cuánto gasté esta semana?', 'gastos del mes', 'total de hoy'. Lee los records tipo 'expense' ya guardados.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["today", "week", "month"], description: "Período a resumir. Default week." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee gastos guardados del usuario."),
  async run(args, ctx: ToolRunContext) {
    const period = String(args.period ?? "week");
    const days = period === "today" ? 1 : period === "month" ? 30 : 7;
    const expenses = expensesByPeriod(ctx.state.records ?? [], days);
    if (expenses.length === 0) {
      return {
        type: "expense_summary",
        status: "ok",
        period,
        total: 0,
        currency: "EUR",
        count: 0,
        summaryItems: [],
        block: { type: "money_summary", title: `Sin gastos en ${period === "today" ? "hoy" : period === "week" ? "la semana" : "el mes"}`, recommendation: "Todavía no anotaste gastos en este período." },
      };
    }
    // Agrupar por moneda.
    const byCurrency = new Map<string, number>();
    for (const e of expenses) {
      const cur = (e.currency ?? "EUR").toUpperCase();
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (e.amount ?? 0));
    }
    const primaryCurrency = byCurrency.keys().next().value ?? "EUR";
    const total = byCurrency.get(primaryCurrency) ?? 0;
    const summaryItems = expenses.slice(0, 10).map((e) => ({
      label: e.title,
      value: `${e.amount ?? 0} ${e.currency ?? primaryCurrency}`,
      detail: e.notes,
    }));
    return {
      type: "expense_summary",
      status: "ok",
      period,
      total: Number(total.toFixed(2)),
      currency: primaryCurrency,
      count: expenses.length,
      summaryItems,
      block: {
        type: "money_summary",
        title: `Gastos ${period === "today" ? "de hoy" : period === "week" ? "de la semana" : "del mes"}`,
        total: Number(total.toFixed(2)),
        currency: primaryCurrency,
        summaryItems,
        recommendation: `${expenses.length} movimiento(s). ${byCurrency.size > 1 ? "Varias monedas: revisá detalle." : ""}`,
      },
    };
  },
};

// ─── expense_alert ──────────────────────────────────────────────────────────
export const expenseAlert: ToolHandler = {
  definition: defineTool(
    "expense_alert",
    "Detecta gastos atípicos del usuario comparando contra su promedio histórico. Úsala cuando el usuario pregunte '¿gasté algo raro?', 'hay algún gasto inusual?'. Devuelve los gastos que superan el promedio en más del doble.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["week", "month"], description: "Ventana a analizar. Default month." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Analiza gastos guardados."),
  async run(args, ctx: ToolRunContext) {
    const period = String(args.period ?? "month");
    const days = period === "week" ? 7 : 30;
    const expenses = expensesByPeriod(ctx.state.records ?? [], days).filter((e) => typeof e.amount === "number");
    if (expenses.length < 3) {
      return { type: "expense_alert", status: "ok", anomalies: [], note: "Pocos gastos para detectar anomalías." };
    }
    const amounts = expenses.map((e) => e.amount ?? 0);
    const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length;
    const threshold = Math.max(avg * 2, avg + 20);
    const anomalies = expenses
      .filter((e) => (e.amount ?? 0) > threshold)
      .map((e) => ({ title: e.title, amount: e.amount, currency: e.currency, note: `${((e.amount ?? 0) / avg).toFixed(1)}x el promedio (${avg.toFixed(2)} ${e.currency})` }));
    return {
      type: "expense_alert",
      status: "ok",
      period,
      average: Number(avg.toFixed(2)),
      threshold: Number(threshold.toFixed(2)),
      anomalies,
    };
  },
};

// ─── budget_set ─────────────────────────────────────────────────────────────
export const budgetSet: ToolHandler = {
  definition: defineTool(
    "budget_set",
    "Establece un presupuesto mensual para una categoría o gasto total. Úsala cuando el usuario diga 'poneme 400 de comida este mes', 'límite de 1000 de gastos'. Se guarda como memory para que Koru avise al acercarse al límite.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string", description: "Categoría o nombre del presupuesto (ej: 'comida', 'total', 'transporte')." },
        limit: { type: "number", description: "Monto límite mensual." },
        currency: { type: "string", default: "EUR" },
      },
      required: ["category", "limit"],
    },
  ),
  policy: policies.localWrite("Guarda presupuesto como memory."),
  async run(args) {
    const category = String(args.category ?? "").trim();
    const limit = Number(args.limit);
    const currency = String(args.currency ?? "EUR").toUpperCase();
    if (!category || !Number.isFinite(limit)) {
      return { type: "budget_set", status: "failed", error: "Indicá categoría y límite." };
    }
    return {
      type: "budget_set",
      status: "ok",
      category,
      limit,
      currency,
      memoryCandidates: [{
        kind: "goal" as const,
        text: `Presupuesto mensual de ${category}: ${limit} ${currency}`,
        confidence: 0.95,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: `${category} ${limit} ${currency}`,
        useForSuggestions: true,
      }],
    };
  },
};

// ─── subscription_reminder ──────────────────────────────────────────────────
export const subscriptionReminder: ToolHandler = {
  definition: defineTool(
    "subscription_reminder",
    "Programa un recordatorio para una suscripción o cobro recurrente (Netflix, Spotify, gimnasio). Úsala cuando el usuario diga 'avisame antes de que cobren Spotify', 'recordame la cuota del gym cada mes'. Crea un commitment recurrente.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre de la suscripción (ej: 'Netflix')." },
        amount: { type: "number" },
        currency: { type: "string", default: "EUR" },
        dueText: { type: "string", description: "Fecha del próximo cobro (ej: 'el 15', 'cada 1ro')." },
        recurrence: { type: "string", enum: ["daily", "weekly", "monthly"], default: "monthly" },
      },
      required: ["name", "dueText"],
    },
  ),
  policy: policies.localWrite("Crea recordatorio de suscripción."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const dueText = String(args.dueText ?? "").trim();
    if (!name || !dueText) return { type: "subscription_reminder", status: "failed", error: "Indicá nombre y fecha." };
    const recurrence = String(args.recurrence ?? "monthly") as "daily" | "weekly" | "monthly";
    const amount = args.amount;
    const currency = String(args.currency ?? "EUR").toUpperCase();
    return {
      type: "subscription_reminder",
      status: "ok",
      commitments: [{
        title: `${name}${typeof amount === "number" ? ` (${amount} ${currency})` : ""}`,
        dueHint: dueText,
        recurrence,
        status: "open" as const,
      }],
      records: [{
        domain: "money" as const,
        kind: "expense" as const,
        title: name,
        amount: typeof amount === "number" ? amount : undefined,
        currency,
        dueHint: dueText,
        notes: `Suscripción ${recurrence}`,
      }],
    };
  },
};

// ─── tax_estimate ───────────────────────────────────────────────────────────
export const taxEstimate: ToolHandler = {
  definition: defineTool(
    "tax_estimate",
    "Estima el IVA o impuesto sobre un monto. Úsala cuando el usuario pregunte '¿cuánto IVA tiene este producto?', 'IVA de 100 euros', 'precio con impuesto'. Default IVA 21% (España).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        amount: { type: "number", description: "Monto base." },
        rate: { type: "number", description: "Tasa de impuesto en %. Default 21." },
        currency: { type: "string", default: "EUR" },
        mode: { type: "string", enum: ["add", "extract"], description: "add: suma impuesto al base; extract: desglosa desde monto con impuesto incluido. Default add." },
      },
      required: ["amount"],
    },
  ),
  policy: policies.readonly("Cálculo local."),
  async run(args) {
    const amount = Number(args.amount);
    const rate = Number(args.rate ?? 21);
    const currency = String(args.currency ?? "EUR").toUpperCase();
    const mode = String(args.mode ?? "add");
    if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
      return { type: "tax_estimate", status: "failed", error: "Monto y tasa deben ser números." };
    }
    if (mode === "extract") {
      const base = amount / (1 + rate / 100);
      const tax = amount - base;
      return { type: "tax_estimate", status: "ok", mode, gross: Number(amount.toFixed(2)), base: Number(base.toFixed(2)), tax: Number(tax.toFixed(2)), rate, currency };
    }
    const tax = amount * (rate / 100);
    return { type: "tax_estimate", status: "ok", mode, base: Number(amount.toFixed(2)), tax: Number(tax.toFixed(2)), gross: Number((amount + tax).toFixed(2)), rate, currency };
  },
};

// ─── inflation_data ─────────────────────────────────────────────────────────
export const inflationData: ToolHandler = {
  definition: defineTool(
    "inflation_data",
    "Obtiene el dato oficial de inflación (IPC) de un país. Úsala cuando el usuario pregunte '¿cómo está la inflación en Argentina?', 'IPC de España'. Datos de FRED (Federal Reserve Economic Data).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        country: { type: "string", description: "País (ej: 'Argentina', 'España', 'United States')." },
      },
      required: ["country"],
    },
  ),
  policy: policies.readonly("Lee IPC público de FRED."),
  async run(args) {
    const country = String(args.country ?? "").trim();
    if (!country) return { type: "inflation_data", status: "failed", error: "Indicá país." };
    // FRED es complejo de usar sin key aquí; devolvemos dato estructurado + nota.
    // Para una implementación real se usaría FRED API con key gratuita.
    return {
      type: "inflation_data",
      status: "not_configured",
      country,
      note: "Para datos de inflación oficiales, configurala fuente (FRED API key gratuita) en .env. Mientras tanto podés consultar https://fred.stlouisfed.org o el INE/BCRA de tu país.",
      sourceUrl: "https://fred.stlouisfed.org/categories/9",
    };
  },
};

// ─── price_compare_product ──────────────────────────────────────────────────
// Reutiliza el shopping_compare del motor (que ya tiene anti-alucinación vía structureExtractor).
// Es un alias semántico para el LLM.
export const priceCompareProduct: ToolHandler = {
  definition: defineTool(
    "price_compare_product",
    "Compara precios de un producto en varias tiendas online y ordena por precio total (incluyendo envío cuando es visible). Úsala cuando el usuario diga '¿dónde compro más barato X?', 'mejor precio de Y'. Lee reseñas y destacados de cada tienda. Reusa la lógica de shopping_compare del motor con anti-alucinación.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto a comparar (ej: 'AirPods Pro 2', 'iPhone 15 128GB')." },
        budget: { type: "string" },
      },
      required: ["query"],
    },
  ),
  policy: policies.externalSideEffect("Compara precios en tiendas reales.", { requiresApproval: true }),
  async run(args, ctx: ToolRunContext) {
    // Delegar al web_search del motor con modo shopping. El dispatcher builtin lo resuelve.
    // Esta tool es un punto de entrada semántico; el motor ya tiene la implementación.
    return {
      type: "price_compare_product",
      status: "delegate",
      delegateTo: "shopping_compare",
      query: String(args.query ?? ""),
      note: "Esta petición se enruta a shopping_compare del motor, que ya tiene scraping multi-tienda + anti-alucinación.",
      userInput: ctx.userInput,
    };
  },
};
