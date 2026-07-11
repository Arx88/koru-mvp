/**
 * Bloque Money — Precio de criptomonedas.
 * API: CoinGecko Demo (key gratuita sin tarjeta, 30 req/min).
 * Sin key funciona con endpoints públicos básicos (más limitado).
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

type CoinGeckoResponse = {
  id: string;
  symbol: string;
  name: string;
  market_data?: {
    current_price?: Record<string, number>;
    market_cap?: Record<string, number>;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    high_24h?: Record<string, number>;
    low_24h?: Record<string, number>;
  };
};

export const cryptoPrice: ToolHandler = {
  definition: defineTool(
    "crypto_price",
    "Obtén el precio actual y métricas de mercado de una criptomoneda (BTC, ETH, SOL, etc.). Úsala cuando el usuario pregunte '¿a cuánto está BTC?', 'precio de ETH', 'cómo está Solana hoy'. Devuelve precio, market cap y variación 24h/7d.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        coin: { type: "string", description: "Ticker o nombre de la cripto (ej: bitcoin, ethereum, solana, BTC, ETH, SOL)." },
        vsCurrency: { type: "string", description: "Moneda en que se cotiza. Default USD.", default: "usd" },
      },
      required: ["coin"],
    },
  ),
  policy: policies.readonly("Lee precios públicos de cripto."),
  async run(args) {
    const raw = String(args.coin ?? "").trim().toLowerCase();
    const vs = String(args.vsCurrency ?? "usd").toLowerCase().trim();
    if (!raw) return { type: "crypto_price", status: "failed", error: "Indicá la cripto." };

    // Mapear tickers comunes a IDs de CoinGecko.
    const tickerMap: Record<string, string> = {
      btc: "bitcoin", eth: "ethereum", sol: "solana", ada: "cardano", dot: "polkadot",
      link: "chainlink", matic: "matic-network", avax: "avalanche-2", doge: "dogecoin",
      xrp: "ripple", ltc: "litecoin", bnb: "binancecoin", usdt: "tether", usdc: "usd-coin",
    };
    const coinId = tickerMap[raw] ?? raw;

    const cacheKey = `crypto:${coinId}:${vs}`;
    const data = await cached<CoinGeckoResponse>(cacheKey, ttls.crypto, async () => {
      await limiters.coingecko.acquire();
      const result = await fetchJson<CoinGeckoResponse>(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
        { timeoutMs: 10_000 },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data as CoinGeckoResponse;
    });

    const md = data.market_data;
    if (!md) return { type: "crypto_price", status: "failed", error: `Sin market_data para ${coinId}.` };

    const price = md.current_price?.[vs];
    if (typeof price !== "number") {
      return { type: "crypto_price", status: "failed", error: `No tengo precio de ${raw} en ${vs}. Probá con USD.` };
    }

    return {
      type: "crypto_price",
      status: "ok",
      coin: data.name,
      symbol: (data.symbol ?? raw).toUpperCase(),
      price,
      currency: vs.toUpperCase(),
      marketCap: md.market_cap?.[vs],
      change24hPct: typeof md.price_change_percentage_24h === "number" ? Number(md.price_change_percentage_24h.toFixed(2)) : undefined,
      change7dPct: typeof md.price_change_percentage_7d === "number" ? Number(md.price_change_percentage_7d.toFixed(2)) : undefined,
      high24h: md.high_24h?.[vs],
      low24h: md.low_24h?.[vs],
      source: "CoinGecko",
      sourceUrl: `https://www.coingecko.com/en/coins/${coinId}`,
    };
  },
};
