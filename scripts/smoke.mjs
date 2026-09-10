// Smoke test del harness: captura el preview y verifica que las cards rendericen.
import { chromium } from "playwright";

const OUT = "/home/z/my-project/download/koru-v4";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 400)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3500);

const errors = await page.evaluate(() => document.body.innerText.includes("Something went wrong") || document.body.innerText.includes("Error"));
console.log("Render error visible:", errors);
const cards = await page.locator(".kc").count();
console.log("Cards renderizadas:", cards);

await page.screenshot({ path: `${OUT}/00-harness-smoke.png` });
console.log("Screenshot:", `${OUT}/00-harness-smoke.png`);

await browser.close();
