/**
 * Bloque Money — Histórico de precios de producto, reseñas de producto,
 * verificación de presupuesto, desglose por categoría.
 * Locales + reutilizan records del usuario.
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import type { LifeRecord } from "../../domain/types";

// ─── price_history ──────────────────────────────────────────────────────────
export const priceHistory: ToolHandler = {
  definition: defineTool(
    "price_history",
    "Muestra el histórico de precios que Koru registró para un producto (cuando el usuario lo anotó antes). Úsala cuando el usuario pregunte '¿cómo varió el precio de X?', 'historial de precios de Y'. Lee records tipo 'shopping_item' o 'expense' que coincidan.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto a buscar en el histórico." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee histórico local de precios."),
  async run(args, ctx: ToolRunContext) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "price_history", status: "failed", error: "Indicá el producto." };
    const matches = (ctx.state.records ?? [])
      .filter((r) => (r.kind === "shopping_item" || r.kind === "expense") && r.title.toLowerCase().includes(q) && typeof r.amount === "number")
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(-15)
      .map((r) => ({ date: r.createdAt.slice(0, 10), title: r.title, amount: r.amount, currency: r.currency ?? "EUR" }));
    if (matches.length === 0) {
      return { type: "price_history", status: "ok", query: args.query, samples: [], note: "Todavía no registraste precios de ese producto. Empezá a anotarlos cuando los veas." };
    }
    const amounts = matches.map((m) => m.amount);
    return {
      type: "price_history",
      status: "ok",
      query: args.query,
      samples: matches,
      first: amounts[0],
      last: amounts[amounts.length - 1],
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      changePct: amounts[0] > 0 ? Number((((amounts[amounts.length - 1] - amounts[0]) / amounts[0]) * 100).toFixed(2)) : 0,
    };
  },
};

// ─── product_review ─────────────────────────────────────────────────────────
export const productReview: ToolHandler = {
  definition: defineTool(
    "product_review",
    "Lee reseñas de un producto en varias fuentes y sintetiza pros/contras reales. Úsala cuando el usuario diga '¿qué opinan de X?', 'reseñas de Y', 'vale la pena Z'. Cruza reseñas de tiendas y foros.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto (ej: 'DJI Mini 4 Pro', 'GoPro Hero 12')." },
      },
      required: ["query"],
    },
  ),
  policy: policies.externalSideEffect("Lee reseñas web del producto.", { autoRun: true, requiresApproval: false }),
  async run(args) {
    // Delegar a web_search del motor con modo research. El structureExtractor valida.
    return {
      type: "product_review",
      status: "delegate",
      delegateTo: "web_search",
      query: `${args.query} reseñas pros contras opiniones`,
      mode: "research",
      note: "Se enruta a web_search del motor, que scrapea y valida con structureExtractor.",
    };
  },
};

// ─── budget_check ───────────────────────────────────────────────────────────
export const budgetCheck: ToolHandler = {
  definition: defineTool(
    "budget_check",
    "Verifica cuánto del presupuesto mensual de una categoría ya se gastó y avisa si se acerca al límite. Úsala cuando el usuario pregunte '¿cuánto me queda de presupuesto de comida?', 'cómo voy con el límite de transporte'. Compara gastos del mes contra memorias tipo 'goal' de presupuesto.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string", description: "Categoría a verificar (ej: 'comida', 'transporte')." },
      },
      required: ["category"],
    },
  ),
  policy: policies.readonly("Compara gastos vs presupuesto guardado."),
  async run(args, ctx: ToolRunContext) {
    const category = String(args.category ?? "").trim().toLowerCase();
    if (!category) return { type: "budget_check", status: "failed", error: "Indicá categoría." };

    // Buscar presupuesto en memorias.
    const budgetMemory = (ctx.state.memories ?? []).find(
      (m) => m.kind === "goal" && m.status === "confirmed" && m.text.toLowerCase().includes("presupuesto") && m.text.toLowerCase().includes(category),
    );
    if (!budgetMemory) {
      return { type: "budget_check", status: "ok", category, hasBudget: false, note: `No tengo presupuesto guardado para "${category}". Establecelo con budget_set.` };
    }
    // Extraer monto del texto de la memory.
    const amountMatch = budgetMemory.text.match(/(\d+(?:[.,]\d+)?)/);
    const limit = amountMatch ? Number(amountMatch[1].replace(",", ".")) : 0;
    if (limit <= 0) {
      return { type: "budget_check", status: "ok", category, hasBudget: true, note: "Tengo un presupuesto guardado pero no pude leer el monto." };
    }

    // Sumar gastos del mes en esa categoría.
    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const spent = (ctx.state.records ?? [])
      .filter((r) => {
        if (r.kind !== "expense" || typeof r.amount !== "number") return false;
        const created = new Date(r.createdAt).getTime();
        return Number.isFinite(created) && created >= now - monthMs && r.title.toLowerCase().includes(category);
      })
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const remaining = limit - spent;
    const status = pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";

    return {
      type: "budget_check",
      status: "ok",
      category,
      hasBudget: true,
      limit,
      spent: Number(spent.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      pctUsed: Number(pct.toFixed(1)),
      budgetStatus: status,
      note: status === "exceeded"
        ? `Te pasaste del presupuesto de ${category}.`
        : status === "warning"
          ? `Cerca del límite de ${category}: ${pct.toFixed(0)}% usado.`
          : `Vas bien con ${category}: ${pct.toFixed(0)}% del presupuesto.`,
    };
  },
};

// ─── expense_by_category ────────────────────────────────────────────────────
export const expenseByCategory: ToolHandler = {
  definition: defineTool(
    "expense_by_category",
    "Desglosa los gastos del mes por categoría (comida, transporte, ocio, etc.) agrupando por tags o palabras del título. Úsala cuando el usuario pregunte 'en qué gasto más?', 'desglose de gastos por tipo', 'cómo se reparten mis gastos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["week", "month"], default: "month" },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Analiza gastos guardados."),
  async run(args, ctx: ToolRunContext) {
    const period = String(args.period ?? "month");
    const days = period === "week" ? 7 : 30;
    const now = Date.now();
    const since = now - days * 24 * 60 * 60 * 1000;
    const expenses = (ctx.state.records ?? []).filter((r) => {
      if (r.kind !== "expense" || typeof r.amount !== "number") return false;
      const created = new Date(r.createdAt).getTime();
      return Number.isFinite(created) && created >= since;
    });

    if (expenses.length === 0) {
      return { type: "expense_by_category", status: "ok", period, categories: [], note: "Sin gastos en el período." };
    }

    const categoryKeywords: Record<string, string[]> = {
      "Comida": ["comida", "super", "mercado", "almuerzo", "cena", "desayuno", "cafe", "restaurant", "heladera", "yerba", "leche", "pan"],
      "Transporte": ["transporte", "gasolina", "subte", "colectivo", "taxi", "uber", "tren", "nafta", "estacionamiento"],
      "Ocio": ["ocio", "cine", "streaming", "netflix", "spotify", "juego", "bar", "cerveza", "salida"],
      "Hogar": ["hogar", "alquiler", "luz", "agua", "gas", "internet", "limpieza", "detergente"],
      "Salud": ["salud", "farmacia", "medicamento", "medico", "dentista", "clinica"],
      "Otros": [],
    };

    const totals = new Map<string, { amount: number; count: number }>();
    for (const e of expenses) {
      const text = `${e.title} ${(e.tags ?? []).join(" ")}`.toLowerCase();
      let matched = "Otros";
      for (const [cat, kws] of Object.entries(categoryKeywords)) {
        if (kws.some((kw) => text.includes(kw))) { matched = cat; break; }
      }
      const cur = (e.currency ?? "EUR").toUpperCase();
      const key = `${matched}|${cur}`;
      const existing = totals.get(key) ?? { amount: 0, count: 0 };
      existing.amount += e.amount ?? 0;
      existing.count += 1;
      totals.set(key, existing);
    }

    const categories = Array.from(totals.entries())
      .map(([key, v]) => {
        const [category, currency] = key.split("|");
        return { category, currency, total: Number(v.amount.toFixed(2)), count: v.count };
      })
      .sort((a, b) => b.total - a.total);

    return { type: "expense_by_category", status: "ok", period, categories };
  },
};
