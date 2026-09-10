// Captura las propuestas A/B: cada tab + scroll medio, @2x.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/home/z/my-project/download/koru-propuestas";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200)); });

const file = process.argv[2] ?? "propuesta-a.html";
const tag = process.argv[3] ?? "a";
const url = `http://localhost:3000/${file}`;
console.log("Abriendo", url);

await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1400);

// El stage centra el teléfono: recortamos el frame .phone para capturas full-screen del interior.
const phone = page.locator(".phone");
const tabs = ["Informe", "Clima", "Plan", "Clásico"];
const ids = ["info", "clima", "plan", "match"];

for (let i = 0; i < tabs.length; i++) {
  const isOn = i === 0;
  if (!isOn) {
    await page.click(`.tab:has-text('${tabs[i]}')`);
    await page.waitForTimeout(900);
  }
  // top
  await phone.screenshot({ path: `${OUT}/${tag}-1-${ids[i]}-top.png` });
  // mid (scroll dentro del screen)
  await page.evaluate(() => { document.getElementById("screen").scrollTop = 640; });
  await page.waitForTimeout(650);
  await phone.screenshot({ path: `${OUT}/${tag}-2-${ids[i]}-mid.png` });
  // bottom
  await page.evaluate(() => { document.getElementById("screen").scrollTop = 99999; });
  await page.waitForTimeout(650);
  await phone.screenshot({ path: `${OUT}/${tag}-3-${ids[i]}-end.png` });
}

// Captura de página completa (stage con header y footer) para contexto
await page.evaluate(() => { document.getElementById("screen").scrollTop = 0; });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 430, height: 932 });
await page.screenshot({ path: `${OUT}/${tag}-stage.png` });

await browser.close();
console.log("OK capturas →", OUT);
