import { describe, expect, it } from "vitest";
import { blocksFromToolResults } from "../server/koruBackend";
import { cryptoPrice } from "../tools/money/cryptoPrice";
import { stockQuote } from "../tools/money/stockQuote";
import { currencyConvert } from "../tools/money/currencyConvert";
import { matchSchedule } from "../tools/sports/football";
import type { UiBlock } from "./types";

function logResult(label: string, result: Record<string, unknown>) {
  console.log(`\n[${label}] Tool result:`, JSON.stringify(result, null, 2));
}
function logBlock(label: string, block: UiBlock) {
  console.log(`\n[${label}] UiBlock:`, JSON.stringify(block, null, 2));
}

type ToolCase = {
  name: string;
  run: () => Promise<Record<string, unknown>>;
  expectedType: UiBlock["type"];
  resultChecks: (r: Record<string, unknown>) => void;
};

const cases: ToolCase[] = [
  {
    name: "crypto_price",
    run: async () => cryptoPrice.run({ coin: "bitcoin" }, { userInput: "bitcoin", state: { memories: [], records: [], commitments: [], stage: "greeting", runtime: {} } }),
    expectedType: "crypto_portfolio",
    resultChecks: (r) => {
      expect(r.status).toBe("ok");
      expect(typeof r.price).toBe("number");
      expect(r.price).toBeGreaterThan(0);
      expect(typeof r.change24hPct).toBe("number");
    },
  },
  {
    name: "stock_quote",
    run: async () => stockQuote.run({ symbol: "AAPL" }, { userInput: "AAPL", state: { memories: [], records: [], commitments: [], stage: "greeting", runtime: {} } }),
    expectedType: "market",
    resultChecks: (r) => {
      expect(r.status).toBe("ok");
      expect(typeof r.close).toBe("number");
      expect(r.close).toBeGreaterThan(0);
      expect(r.symbol).toBe("AAPL");
    },
  },
  {
    name: "currency_convert",
    run: async () => currencyConvert.run({ amount: 100, from: "USD", to: "EUR" }, { userInput: "convert", state: { memories: [], records: [], commitments: [], stage: "greeting", runtime: {} } }),
    expectedType: "forex",
    resultChecks: (r) => {
      expect(r.status).toBe("ok");
      expect(typeof r.converted).toBe("number");
      expect(typeof r.rate).toBe("number");
      expect(r.converted).toBeGreaterThan(0);
      expect(r.rate).toBeGreaterThan(0);
    },
  },
  {
    name: "match_schedule",
    run: async () => matchSchedule.run({ team: "Real Madrid" }, { userInput: "Real Madrid", state: { memories: [], records: [], commitments: [], stage: "greeting", runtime: {} } }),
    expectedType: "match_timeline",
    resultChecks: (r) => {
      expect(r.status).toBe("ok");
      expect(Array.isArray(r.matches)).toBe(true);
    },
  },
];

describe.skip("Backend tools end-to-end", () => {
  it.each(cases)("$name returns real data and maps to correct UiBlock type", async ({ name, run, expectedType, resultChecks }) => {
    let result: Record<string, unknown>;
    try {
      result = await run();
    } catch (err: any) {
      throw new Error(`Tool ${name} failed: ${err?.message ?? String(err)}`);
    }
    logResult(name, result);
    resultChecks(result);
    const toolExecution = { id: `test_${name}`, name, result };
    const blocks = blocksFromToolResults([toolExecution]);
    expect(blocks.length).toBeGreaterThan(0);
    const block = blocks[0];
    logBlock(name, block);
    expect(block.type).toBe(expectedType);
    console.log(`\nOK ${name}: type="${block.type}" matches expected "${expectedType}"`);
  });
});
