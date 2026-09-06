// Captura cards generales: clima, plan, informe + sus detalles.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/home/z/my-project/download/koru-v4";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 300)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 30000 });

// — Informe (deliverable) —
await page.click(".pv-chip:has-text('Informes')");
await page.waitForTimeout(3000);
const infoCard = page.locator(".kc").first();
await infoCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/10-informe-card.png` });
// medidas de altura para auditar compactness
const infoH = await infoCard.boundingBox();
console.log("INFORME card height:", infoH?.height);

await infoCard.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/11-informe-detail.png` });
const det = page.locator(".koru-roadmap-screen");
if (await det.count()) {
  // scroll real: el contenedor con overflow es .koru-roadmap-screen o el módulo body
  const scrollEl = det.locator(".koru-roadmap-modules").first();
  const tag = await scrollEl.evaluate((el) => el.tagName + "|" + getComputedStyle(el).overflowY);
  console.log("scroll container:", tag);
  await scrollEl.evaluate((el) => { el.scrollTop = 900; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/12-informe-detail-mid.png` });
  await det.locator("button.back").first().click();
  await page.waitForTimeout(700);
}

// — Clima —
await page.click(".pv-chip:has-text('Clima')");
await page.waitForTimeout(2500);
const weatherCard = page.locator(".kc").first();
await weatherCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/13-weather-card.png` });
const wH = await weatherCard.boundingBox();
console.log("WEATHER card height:", wH?.height);

await weatherCard.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/14-weather-detail.png` });
const det2 = page.locator(".koru-roadmap-screen");
if (await det2.count()) {
  await det2.locator(".koru-roadmap-modules").first().evaluate((el) => { el.scrollTop = 800; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/15-weather-detail-mid.png` });
  await det2.locator("button.back").first().click();
  await page.waitForTimeout(700);
}

// — Plan —
await page.click(".pv-chip:has-text('Día')");
await page.waitForTimeout(2500);
const planCard = page.locator(".kc").first();
await planCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/16-plan-card.png` });
const pH = await planCard.boundingBox();
console.log("PLAN card height:", pH?.height);

await planCard.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/17-plan-detail.png` });

await browser.close();
console.log("OK capturas generales");
