/**
 * Bloque Money — Conversión de divisas.
 * Tool de prueba para validar el mecanismo del ToolBox end-to-end.
 * API: Frankfurter (sin key, datos del BCE, open source).
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

export const currencyConvert: ToolHandler = {
  definition: defineTool(
    "currency_convert",
    "Convierte un monto entre dos monedas usando la tasa de cambio actual del Banco Central Europeo (vía Frankfurter, open source). Úsala cuando el usuario pregunte cuánto equivale una cantidad en otra moneda, ej: '¿cuánto son 100 dólares en pesos?', '50 euros a yen', 'conversión USD a ARS'. Monedas comunes: USD, EUR, ARS, MXN, COP, CLP, GBP, JPY, BRL.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        amount: { type: "number", description: "Monto a convertir." },
        from: { type: "string", description: "Moneda origen (código ISO 4217, ej: USD, EUR, ARS)." },
        to: { type: "string", description: "Moneda destino (código ISO 4217)." },
      },
      required: ["amount", "from", "to"],
    },
  ),
  policy: policies.readonly("Lee tasas de cambio públicas del BCE."),
  async run(args) {
    const amount = Number(args.amount);
    const from = String(args.from ?? "").toUpperCase().trim();
    const to = String(args.to ?? "").toUpperCase().trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return { type: "currency_convert", status: "failed", error: "El monto debe ser un número positivo." };
    }
    if (!from || !to || from.length !== 3 || to.length !== 3) {
      return { type: "currency_convert", status: "failed", error: "Indicá monedas de 3 letras (ej: USD, EUR, ARS)." };
    }

    const cacheKey = `fx:${from}:${to}`;
    const rate = await cached<number>(cacheKey, ttls.currency, async () => {
      await limiters.frankfurter.acquire();
      const result = await fetchJson<FrankfurterResponse>(
        `https://api.frankfurter.app/latest?amount=${encodeURIComponent(amount)}&from=${from}&to=${to}`,
        { timeoutMs: 8_000 },
      );
      if (!result.ok) throw new Error(result.error);
      const rateValue = result.data!.rates?.[to];
      if (typeof rateValue !== "number") throw new Error(`No tengo tasa para ${from}→${to}.`);
      return rateValue;
    });

    // Frankfurter devuelve el resultado para el `amount` pedido; normalizamos a tasa unitaria.
    const converted = rate;
    const unitRate = converted / amount;

    return {
      type: "currency_convert",
      status: "ok",
      amount,
      from,
      to,
      converted: Number(converted.toFixed(2)),
      rate: Number(unitRate.toFixed(4)),
      source: "Banco Central Europeo (vía Frankfurter)",
      sourceUrl: "https://www.frankfurter.app/",
      note: `Tasa de referencia BCE. Puede diferir de la tasa de casa de cambio.`,
    };
  },
};
