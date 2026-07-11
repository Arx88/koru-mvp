import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {

  await page.goto("http://127.0.0.1:5200/all-cards-preview.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  const height = await page.evaluate(() => document.documentElement.scrollHeight);

  const result = await page.screenshot({ path: "./all-cards-preview.png", fullPage: true });
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  await browser.close();
}
