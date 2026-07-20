/**
 * Bloque Money — Precio de criptomonedas.
 * API chain: CoinGecko → Binance → Coinbase → KuCoin → OKX → Kraken
 * Todas gratuitas, sin API key necesaria.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

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

const KUCOIN_SYMBOL_MAP: Record<string, string> = {
  btc: "BTC-USDT", eth: "ETH-USDT", sol: "SOL-USDT", ada: "ADA-USDT", dot: "DOT-USDT",
  link: "LINK-USDT", matic: "MATIC-USDT", avax: "AVAX-USDT", doge: "DOGE-USDT",
  xrp: "XRP-USDT", ltc: "LTC-USDT", bnb: "BNB-USDT",
};

const OKX_SYMBOL_MAP: Record<string, string> = {
  btc: "BTC-USDT", eth: "ETH-USDT", sol: "SOL-USDT", ada: "ADA-USDT", dot: "DOT-USDT",
  link: "LINK-USDT", matic: "MATIC-USDT", avax: "AVAX-USDT", doge: "DOGE-USDT",
  xrp: "XRP-USDT", ltc: "LTC-USDT",
};

const KRAKEN_SYMBOL_MAP: Record<string, string> = {
  btc: "XBTUSD", eth: "ETHUSD", sol: "SOLUSD", ada: "ADAUSD", dot: "DOTUSD",
  link: "LINKUSD", avax: "AVAXUSD", doge: "XDGUSD", xrp: "XRPUSD", ltc: "LTCUSD",
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

    const cacheKey = `crypto:${coinId}:${vs}`;

    // Helper to normalize result
    const makeResult = (price: number, change24hPct: number | undefined, source: string, sourceUrl: string, extra?: Record<string, unknown>) => ({
      type: "crypto_price" as const,
      status: "ok" as const,
      coin: displayName,
      symbol,
      price,
      currency: vs.toUpperCase(),
      change24hPct: typeof change24hPct === "number" ? Number(change24hPct.toFixed(2)) : undefined,
      source,
      sourceUrl,
      ...extra,
    });

    // 1. CoinGecko (ricos datos)
    try {
      const data = await cached<any>(cacheKey, ttls.crypto, async () => {
        await limiters.coingecko.acquire();
        const result = await fetchJson<any>(
          `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
          { timeoutMs: 8_000 },
        );
        if (!result.ok) throw new Error(result.error);
        return result.data;
      });
      const md = data.market_data;
      if (md?.current_price?.[vs]) {
        return makeResult(md.current_price[vs], md.price_change_percentage_24h, "CoinGecko", `https://www.coingecko.com/en/coins/${coinId}`, {
          marketCap: md.market_cap?.[vs],
          change7dPct: typeof md.price_change_percentage_7d === "number" ? Number(md.price_change_percentage_7d.toFixed(2)) : undefined,
          high24h: md.high_24h?.[vs],
          low24h: md.low_24h?.[vs],
        });
      }
    } catch { /* CoinGecko failed */ }

    // 2. Binance (alta rate limit, sin key)
    const binanceSymbol = BINANCE_SYMBOL_MAP[ticker];
    if (binanceSymbol) {
      try {
        const result = await fetchJson<any>(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
          { timeoutMs: 8_000 },
        );
        if (result.ok && result.data) {
          const d = result.data;
          const price = parseFloat(d.lastPrice ?? "0");
          if (price > 0) {
            return makeResult(price, d.priceChangePercent ? parseFloat(d.priceChangePercent) : undefined, "Binance", `https://www.binance.com/en/trade/${binanceSymbol}`, {
              high24h: d.highPrice ? parseFloat(d.highPrice) : undefined,
              low24h: d.lowPrice ? parseFloat(d.lowPrice) : undefined,
              volume24h: d.quoteVolume ? parseFloat(d.quoteVolume) : undefined,
            });
          }
        }
      } catch { /* Binance failed */ }
    }

    // 3. Coinbase (free, no key)
    try {
      const result = await fetchJson<any>(
        `https://api.coinbase.com/v2/prices/${symbol}-${vs.toUpperCase()}/spot`,
        { timeoutMs: 8_000 },
      );
      if (result.ok && result.data?.data?.amount) {
        const price = parseFloat(result.data.data.amount);
        if (price > 0) {
          return makeResult(price, undefined, "Coinbase", `https://www.coinbase.com/price/${symbol.toLowerCase()}`);
        }
      }
    } catch { /* Coinbase failed */ }

    // 4. KuCoin (free, no key)
    const kucoinSymbol = KUCOIN_SYMBOL_MAP[ticker];
    if (kucoinSymbol) {
      try {
        const result = await fetchJson<any>(
          `https://api.kucoin.com/api/v1/market/stats?symbol=${kucoinSymbol}`,
          { timeoutMs: 8_000 },
        );
        if (result.ok && result.data?.data) {
          const d = result.data.data;
          const price = parseFloat(d.last ?? d.buy ?? "0");
          if (price > 0) {
            const changeRate = parseFloat(d.changeRate ?? "0") * 100;
            return makeResult(price, changeRate, "KuCoin", `https://www.kucoin.com/trade/${kucoinSymbol}`, {
              high24h: d.high ? parseFloat(d.high) : undefined,
              low24h: d.low ? parseFloat(d.low) : undefined,
              volume24h: d.volValue ? parseFloat(d.volValue) : undefined,
            });
          }
        }
      } catch { /* KuCoin failed */ }
    }

    // 5. OKX (free, no key)
    const okxSymbol = OKX_SYMBOL_MAP[ticker];
    if (okxSymbol) {
      try {
        const result = await fetchJson<any>(
          `https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`,
          { timeoutMs: 8_000 },
        );
        if (result.ok && result.data?.data?.[0]) {
          const d = result.data.data[0];
          const price = parseFloat(d.last ?? "0");
          if (price > 0) {
            const open24h = parseFloat(d.open24h ?? "0");
            const change24hPct = open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined;
            return makeResult(price, change24hPct, "OKX", `https://www.okx.com/trade-spot/${okxSymbol.toLowerCase()}`, {
              high24h: d.high24h ? parseFloat(d.high24h) : undefined,
              low24h: d.low24h ? parseFloat(d.low24h) : undefined,
            });
          }
        }
      } catch { /* OKX failed */ }
    }

    // 6. Kraken (free, no key)
    const krakenSymbol = KRAKEN_SYMBOL_MAP[ticker];
    if (krakenSymbol) {
      try {
        const result = await fetchJson<any>(
          `https://api.kraken.com/0/public/Ticker?pair=${krakenSymbol}`,
          { timeoutMs: 8_000 },
        );
        if (result.ok && result.data?.result) {
          const keys = Object.keys(result.data.result);
          if (keys.length > 0) {
            const d = result.data.result[keys[0]];
            const price = parseFloat(d.c?.[0] ?? "0");
            if (price > 0) {
              const open = parseFloat(d.o?.[0] ?? "0");
              const change24hPct = open > 0 ? ((price - open) / open) * 100 : undefined;
              return makeResult(price, change24hPct, "Kraken", `https://www.kraken.com/prices/${symbol.toLowerCase()}`, {
                high24h: d.h?.[0] ? parseFloat(d.h[0]) : undefined,
                low24h: d.l?.[0] ? parseFloat(d.l[0]) : undefined,
                volume24h: d.v?.[0] ? parseFloat(d.v[0]) : undefined,
              });
            }
          }
        }
      } catch { /* Kraken failed */ }
    }

    return {
      type: "crypto_price",
      status: "failed",
      symbol,
      coin: displayName,
      error: `No pude obtener el precio de ${displayName}. Todas las APIs están saturadas.`,
    };
  },
};
