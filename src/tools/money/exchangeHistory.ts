/**
 * Bloque Money — Histórico de divisas.
 * API: Frankfurter (sin key, datos BCE desde 1999).
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

type FrankfurterTimeSeries = {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Array<[string, number]>> | Record<string, Record<string, number>>;
};

export const exchangeHistory: ToolHandler = {
  definition: defineTool(
    "exchange_history",
    "Muestra la evolución histórica de una divisa contra otra en un período. Úsala para '¿cómo estaba el dólar hace un año?', 'evolución del euro vs peso en 2024', 'gráfico de USD/ARS último mes'. Datos del Banco Central Europeo desde 1999.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", description: "Moneda origen (ISO 4217, ej: USD)." },
        to: { type: "string", description: "Moneda destino (ISO 4217)." },
        startDate: { type: "string", description: "Fecha inicio YYYY-MM-DD." },
        endDate: { type: "string", description: "Fecha fin YYYY-MM-DD. Por defecto hoy." },
      },
      required: ["from", "to", "startDate"],
    },
  ),
  policy: policies.readonly("Lee histórico público del BCE."),
  async run(args) {
    const from = String(args.from ?? "").toUpperCase().trim();
    const to = String(args.to ?? "").toUpperCase().trim();
    const startDate = String(args.startDate ?? "").trim();
    const endDate = String(args.endDate ?? new Date().toISOString().slice(0, 10)).trim();

    if (from.length !== 3 || to.length !== 3) {
      return { type: "exchange_history", status: "failed", error: "Monedas deben ser de 3 letras." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { type: "exchange_history", status: "failed", error: "startDate debe ser YYYY-MM-DD." };
    }

    const cacheKey = `fxhist:${from}:${to}:${startDate}:${endDate}`;
    const rates = await cached<Record<string, number>>(cacheKey, ttls.reference, async () => {
      await limiters.frankfurter.acquire();
      const result = await fetchJson<FrankfurterTimeSeries>(
        `https://api.frankfurter.app/${startDate}..${endDate}?from=${from}&to=${to}`,
        { timeoutMs: 10_000 },
      );
      if (!result.ok) throw new Error(result.error);
      // Frankfurter devuelve {rates: {YYYY-MM-DD: {TO: rate}}}
      const raw = result.data.rates as Record<string, Record<string, number>>;
      const out: Record<string, number> = {};
      for (const [date, entry] of Object.entries(raw)) {
        if (entry && typeof entry[to] === "number") out[date] = entry[to];
      }
      return out;
    });

    const values = Object.values(rates);
    const dates = Object.keys(rates).sort();
    if (values.length === 0) {
      return { type: "exchange_history", status: "failed", error: `Sin datos para ${from}→${to} en ese período.` };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

    return {
      type: "exchange_history",
      status: "ok",
      from,
      to,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      firstRate: Number(first.toFixed(4)),
      lastRate: Number(last.toFixed(4)),
      minRate: Number(min.toFixed(4)),
      maxRate: Number(max.toFixed(4)),
      changePct: Number(changePct.toFixed(2)),
      samples: values.length,
      source: "Banco Central Europeo (vía Frankfurter)",
      sourceUrl: "https://www.frankfurter.app/",
    };
  },
};
