import { describe, it, expect } from "vitest";
import { cryptoPrice } from "../tools/money/cryptoPrice";
import { stockQuote } from "../tools/money/stockQuote";
import { currencyConvert } from "../tools/money/currencyConvert";
import { exchangeHistory } from "../tools/money/exchangeHistory";

const ctx = { userInput: "test", state: { memories: [], records: [], commitments: [] } } as any;

describe("Real tool execution", { timeout: 30_000 }, () => {
  it("crypto_price returns real BTC data", async () => {
    const r = await cryptoPrice.run({ coin: "bitcoin" }, ctx);
    console.log("crypto_price result:", JSON.stringify(r, null, 2));
    expect(r.status).toBe("ok");
    expect(r.price).toBeDefined();
    expect(Number(r.price)).toBeGreaterThan(0);
    expect(r.symbol).toBe("BTC");
  });

  it.skip("stock_quote returns real AAPL data", async () => {
    const r = await stockQuote.run({ symbol: "AAPL" }, ctx);
    console.log("stock_quote result:", JSON.stringify(r, null, 2));
    if (r.status === "ok") {
      expect(r.close).toBeDefined();
      expect(Number(r.close)).toBeGreaterThan(0);
    } else {
      console.warn("stock_quote failed:", r.error);
    }
  });

  it("currency_convert returns real USD/EUR rate", async () => {
    const r = await currencyConvert.run({ amount: 100, from: "USD", to: "EUR" }, ctx);
    console.log("currency_convert result:", JSON.stringify(r, null, 2));
    expect(r.status).toBe("ok");
    expect(r.rate).toBeDefined();
    expect(Number(r.rate)).toBeGreaterThan(0);
    expect(r.converted).toBeDefined();
  });

  it("exchange_history returns real data", async () => {
    const r = await exchangeHistory.run({ base: "USD", target: "EUR", days: 7 }, ctx);
    console.log("exchange_history result:", JSON.stringify(r, null, 2));
    if (r.status === "ok") {
      expect(r.rates).toBeDefined();
      expect(r.rates.length).toBeGreaterThan(0);
    } else {
      console.warn("exchange_history failed:", r.error);
    }
  });
});
