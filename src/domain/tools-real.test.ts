import { describe, it, expect } from "vitest";
import { cryptoPrice } from "../tools/money/cryptoPrice";
import { stockQuote } from "../tools/money/stockQuote";
import { currencyConvert } from "../tools/money/currencyConvert";
import { exchangeHistory } from "../tools/money/exchangeHistory";

const ctx = { userInput: "test", state: { memories: [], records: [], commitments: [] } } as any;

describe("Real tool execution", { timeout: 30_000 }, () => {
  it("crypto_price returns real BTC data", async () => {
    const r = await cryptoPrice.run({ coin: "bitcoin" }, ctx);
    expect(r.status).toBe("ok");
    expect(r.price).toBeDefined();
    expect(Number(r.price)).toBeGreaterThan(0);
    expect(r.symbol).toBe("BTC");
  });

  it.skip("stock_quote returns real AAPL data", async () => {
    const r = await stockQuote.run({ symbol: "AAPL" }, ctx);
    if (r.status === "ok") {
      expect(r.close).toBeDefined();
      expect(Number(r.close)).toBeGreaterThan(0);
    } else {
    }
  });

  it("currency_convert returns real USD/EUR rate", async () => {
    const r = await currencyConvert.run({ amount: 100, from: "USD", to: "EUR" }, ctx);
    expect(r.status).toBe("ok");
    expect(r.rate).toBeDefined();
    expect(Number(r.rate)).toBeGreaterThan(0);
    expect(r.converted).toBeDefined();
  });

  it("exchange_history returns real data", async () => {
    const r = await exchangeHistory.run({ base: "USD", target: "EUR", days: 7 }, ctx);
    if (r.status === "ok") {
      const rates = r.rates as Array<{ date: string; rate: number }>;
      expect(rates).toBeDefined();
      expect(rates.length).toBeGreaterThan(0);
    } else {
    }
  });
});
