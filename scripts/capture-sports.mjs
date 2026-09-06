// Captura cards deportivas + detalles (match y tennis).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/home/z/my-project/download/koru-v4";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 300)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 30000 });

// Filtro deportes
await page.click(".pv-chip:has-text('Deportes')");
await page.waitForTimeout(3500);

// Card 1: el clásico
const matchCard = page.locator(".kc").first();
await matchCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/01-match-card.png` });

// Abrir detail del clásico
await matchCard.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/02-match-detail-hero.png` });
const detail = page.locator(".koru-roadmap-screen");
if (await detail.count()) {
  const body = detail.locator(".koru-roadmap-modules");
  await body.evaluate((el) => (el.scrollTop = 700));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-match-detail-mid.png` });
  await body.evaluate((el) => (el.scrollTop = 1600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/04-match-detail-pitch.png` });
  // volver
  await detail.locator("button.back").first().click();
  await page.waitForTimeout(800);
}

// Card 2: tenis (la segunda card del feed deportes)
const tennisCard = page.locator(".kc").nth(1);
await tennisCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/05-tennis-card.png` });

await tennisCard.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/06-tennis-detail.png` });
const detail2 = page.locator(".koru-roadmap-screen");
if (await detail2.count()) {
  const body = detail2.locator(".koru-roadmap-modules");
  await body.evaluate((el) => (el.scrollTop = 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/07-tennis-detail-mid.png` });
}

await browser.close();
console.log("OK capturas deportes");
