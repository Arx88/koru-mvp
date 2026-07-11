/**
 * Bloque Money — Cotización de acción o índice bursátil.
 * API: Stooq (CSV sin key). Formato simple, fiable para datos de cierre.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchText } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

type StooqRow = {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function parseStooqCsv(csv: string): StooqRow | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const cols = lines[1].split(",");
  if (cols.length < 7) return null;
  return {
    symbol: cols[0],
    date: cols[1],
    open: Number(cols[2]),
    high: Number(cols[3]),
    low: Number(cols[4]),
    close: Number(cols[5]),
    volume: Number(cols[6]),
  };
}

export const stockQuote: ToolHandler = {
  definition: defineTool(
    "stock_quote",
    "Obtén la cotización actual (último cierre) de una acción o índice bursátil. Úsala cuando el usuario pregunte '¿cómo está Apple?', 'cierre del S&P 500', 'precio de Tesla', 'cómo cerró el Nasdaq'. Símbolos comunes: AAPL, MSFT, TSLA, GOOGL, ^SPX, ^NDX, ^DJI.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        symbol: { type: "string", description: "Símbolo bursátil (ej: AAPL, MSFT, TSLA, ^SPX, ^NDX)." },
      },
      required: ["symbol"],
    },
  ),
  policy: policies.readonly("Lee cotizaciones públicas."),
  async run(args) {
    const symbol = String(args.symbol ?? "").trim().toLowerCase();
    if (!symbol) return { type: "stock_quote", status: "failed", error: "Indicá el símbolo." };

    const cacheKey = `stock:${symbol}`;
    const row = await cached<StooqRow>(cacheKey, ttls.crypto, async () => {
      await limiters.stooq.acquire();
      // Stooq usa símbolos en minúscula para queries; ^SPX -> spx, AAPL -> aapl.us
      const stooqSym = symbol.replace(/^\^/, "");
      const result = await fetchText(
        `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`,
        { headers: { Accept: "text/csv" }, timeoutMs: 8_000 },
      );
      if (!result.ok) throw new Error(result.error);
      const parsed = parseStooqCsv(result.text!);
      if (!parsed) throw new Error("Respuesta Stooq inválida.");
      return parsed;
    });

    if (!Number.isFinite(row.close)) {
      return { type: "stock_quote", status: "failed", error: `Sin cotización para ${symbol}.` };
    }

    return {
      type: "stock_quote",
      status: "ok",
      symbol: symbol.toUpperCase(),
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume > 0 ? row.volume : undefined,
      source: "Stooq",
      sourceUrl: `https://stooq.com/q/?s=${symbol}`,
      note: "Precio de último cierre. Datos con leve retardo (15 min+).",
    };
  },
};
