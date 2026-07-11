import { cryptoPrice } from "../src/tools/money/cryptoPrice";
import { currencyConvert } from "../src/tools/money/currencyConvert";
import { exchangeHistory } from "../src/tools/money/exchangeHistory";

const ctx = { userInput: "test", state: { memories: [], records: [], commitments: [] } } as any;

async function main() {
  console.log("=== cryptoPrice (bitcoin) ===");
  const r1 = await cryptoPrice.run({ coin: "bitcoin" }, ctx);
  console.log(JSON.stringify(r1, null, 2));

  console.log("\n=== currencyConvert (100 USD → EUR) ===");
  const r2 = await currencyConvert.run({ amount: 100, from: "USD", to: "EUR" }, ctx);
  console.log(JSON.stringify(r2, null, 2));

  console.log("\n=== exchangeHistory (USD→EUR, 7d) ===");
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const r3 = await exchangeHistory.run({ from: "USD", to: "EUR", startDate: sevenDaysAgo, endDate: today }, ctx);
  console.log(JSON.stringify(r3, null, 2));
}

main().catch(console.error);
