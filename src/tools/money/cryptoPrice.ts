/**
 * Bloque Money — Precio de criptomonedas.
 * API: CoinGecko (primary) → Binance (fallback) → CoinCap (fallback 2).
 * Sin key funciona con endpoints públicos básicos.
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

type BinanceTicker = {
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  quoteVolume?: string;
};

type CoinCapAsset = {
  data?: {
    id?: string;
    symbol?: string;
    name?: string;
    priceUsd?: string;
    changePercent24Hr?: string;
    marketCapUsd?: string;
  };
};

const TICKER_MAP: Record<string, string> = {
  btc: "bitcoin", eth: "ethereum", sol: "solana", ada: "cardano", dot: "polkadot",
  link: "chainlink", matic: "matic-network", avax: "avalanche-2", doge: "dogecoin",
  xrp: "ripple", ltc: "litecoin", bnb: "binancecoin", usdt: "tether", usdc: "usd-coin",
};

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  btc: "BTCUSDT", eth: "ETHUSDT", sol: "SOLUSDT", ada: "ADAUSDT", dot: "DOTUSDT",
  link: "LINKUSDT", matic: "MATICUSDT", avax: "AVAXUSDT", doge: "DOGEUSDT",
  xrp: "XRPUSDT", ltc: "LTCUSDT", bnb: "BNBUSDT",
};

const COINCAP_MAP: Record<string, string> = {
  btc: "bitcoin", eth: "ethereum", sol: "solana", ada: "cardano", dot: "polkadot",
  link: "chainlink", matic: "polygon", avax: "avalanche-2", doge: "dogecoin",
  xrp: "ripple", ltc: "litecoin", bnb: "binance-coin",
};

const NAME_MAP: Record<string, string> = {
  btc: "Bitcoin", eth: "Ethereum", sol: "Solana", ada: "Cardano", dot: "Polkadot",
  link: "Chainlink", matic: "Polygon", avax: "Avalanche", doge: "Dogecoin",
  xrp: "XRP", ltc: "Litecoin", bnb: "BNB", usdt: "Tether", usdc: "USD Coin",
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

    const ticker = raw in TICKER_MAP ? raw : Object.keys(TICKER_MAP).find(k => TICKER_MAP[k] === raw) ?? raw;
    const coinId = TICKER_MAP[ticker] ?? TICKER_MAP[raw] ?? raw;
    const displayName = NAME_MAP[ticker] ?? NAME_MAP[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
    const symbol = ticker.toUpperCase();

    // 🔴 KIMI v7 — Try CoinGecko first, then Binance, then CoinCap
    const cacheKey = `crypto:${coinId}:${vs}`;

    // 1. Try CoinGecko
    try {
      const data = await cached<CoinGeckoResponse>(cacheKey, ttls.crypto, async () => {
        await limiters.coingecko.acquire();
        const result = await fetchJson<CoinGeckoResponse>(
          `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
          { timeoutMs: 8_000 },
        );
        if (!result.ok) throw new Error(result.error);
        return result.data as CoinGeckoResponse;
      });

      const md = data.market_data;
      if (md) {
        const price = md.current_price?.[vs];
        if (typeof price === "number") {
          return {
            type: "crypto_price",
            status: "ok",
            coin: data.name,
            symbol: (data.symbol ?? symbol).toUpperCase(),
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
        }
      }
    } catch {
      // CoinGecko failed (rate limit, timeout, etc.) — try Binance
    }

    // 2. Try Binance (no API key needed, high rate limit)
    const binanceSymbol = BINANCE_SYMBOL_MAP[ticker] ?? BINANCE_SYMBOL_MAP[raw];
    if (binanceSymbol) {
      try {
        const result = await fetchJson<BinanceTicker>(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
          { timeoutMs: 8_000 },
        );
        if (result.ok && result.data) {
          const d = result.data;
          const price = parseFloat(d.lastPrice ?? "0");
          if (price > 0) {
            return {
              type: "crypto_price",
              status: "ok",
              coin: displayName,
              symbol,
              price,
              currency: "USD",
              marketCap: undefined,
              change24hPct: d.priceChangePercent ? Number(parseFloat(d.priceChangePercent).toFixed(2)) : undefined,
              change7dPct: undefined,
              high24h: d.highPrice ? parseFloat(d.highPrice) : undefined,
              low24h: d.lowPrice ? parseFloat(d.lowPrice) : undefined,
              source: "Binance",
              sourceUrl: `https://www.binance.com/en/trade/${binanceSymbol}`,
            };
          }
        }
      } catch {
        // Binance failed — try CoinCap
      }
    }

    // 3. Try CoinCap (no API key needed)
    const coincapId = COINCAP_MAP[ticker] ?? COINCAP_MAP[raw];
    if (coincapId) {
      try {
        const result = await fetchJson<CoinCapAsset>(
          `https://api.coincap.io/v2/assets/${coincapId}`,
          { timeoutMs: 8_000 },
        );
        if (result.ok && result.data?.data) {
          const d = result.data.data;
          const price = parseFloat(d.priceUsd ?? "0");
          if (price > 0) {
            return {
              type: "crypto_price",
              status: "ok",
              coin: d.name ?? displayName,
              symbol: (d.symbol ?? symbol).toUpperCase(),
              price,
              currency: "USD",
              marketCap: d.marketCapUsd ? parseFloat(d.marketCapUsd) : undefined,
              change24hPct: d.changePercent24Hr ? Number(parseFloat(d.changePercent24Hr).toFixed(2)) : undefined,
              change7dPct: undefined,
              high24h: undefined,
              low24h: undefined,
              source: "CoinCap",
              sourceUrl: `https://coincap.io/assets/${coincapId}`,
            };
          }
        }
      } catch {
        // CoinCap failed
      }
    }

    return { type: "crypto_price", status: "failed", error: `No pude obtener el precio de ${displayName}. Las APIs de precio están saturadas.` };
  },
};
