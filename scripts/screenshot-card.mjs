import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const browser = await chromium.launch({ headless: true });

// Screenshot 1: Actual rendered card from dev server
const page1 = await browser.newPage();
await page1.setViewportSize({ width: 480, height: 1200 });
await page1.goto('http://127.0.0.1:5200/all-cards-preview.html', { waitUntil: 'networkidle' });
await page1.waitForTimeout(3000);

const card1 = page1.locator('[data-ui-block="restaurant_deep_search"]').first();
const count1 = await card1.count();

if (count1 > 0) {
  await card1.screenshot({ path: join(rootDir, 'restaurant-card-check.png') });
} else {
  // fallback: screenshot full page
  await page1.screenshot({ path: join(rootDir, 'restaurant-card-check.png'), fullPage: true });
}

// Screenshot 2: Reference HTML file
const page2 = await browser.newPage();
await page2.setViewportSize({ width: 480, height: 1200 });
const refPath = 'http://127.0.0.1:5200/deephungry-sintesis.html';
await page2.goto(refPath, { waitUntil: 'networkidle' });
await page2.waitForTimeout(2000);

// The reference has 2 cards in a .space-y-8, screenshot the first one
const firstCard = page2.locator('.space-y-8 > div').first();
const count2 = await firstCard.count();

if (count2 > 0) {
  await firstCard.screenshot({ path: join(rootDir, 'restaurant-card-reference.png') });
}

await browser.close();
