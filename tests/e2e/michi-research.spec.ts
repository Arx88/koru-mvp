import { expect, test } from "@playwright/test";
import { emitResearch, openResearch, researchChunk } from "./helpers/research";

test("research is one illustrated panel in the conversation and keeps the composer available", async ({ page }) => {
  await openResearch(page);
  await expect(page.locator(".mr-research")).toHaveCount(1);
  await expect(page.locator(".koru-working-dock, .mx-typing-row, .koru-card-skeleton")).toHaveCount(0);
  const bar = page.getByRole("progressbar", { name: "Progreso de la tarea" });
  await expect(bar).toHaveAttribute("aria-valuenow", "15");
  expect(await page.locator(".mr-art img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  const input = page.getByPlaceholder("Habla con Michi...");
  await expect(input).toBeEnabled();
  await input.fill("También tené en cuenta los costos");
  await expect(input).toHaveValue("También tené en cuenta los costos");
  await page.clock.fastForward(36_000);
  await expect(bar).toHaveAttribute("aria-valuenow", "15");
  await expect(page.locator(".mr-hint")).toContainText("Sigo trabajando");
  await emitResearch(page, researchChunk("searching", 48));
  await expect(bar).toHaveAttribute("aria-valuenow", "48");
  await expect(page.locator(".mr-steps li").nth(1)).toHaveAttribute("aria-current", "step");
  await emitResearch(page, researchChunk("planning", 86));
  await expect(page.locator(".mr-steps li").nth(2)).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".mr-steps .is-done")).toHaveCount(2);
  const final = { ...researchChunk("done", 100), reply: "Tu investigación está lista para leer.", uiBlocks: [{ type: "deliverable", status: "ready", kicker: "Tu Informe", title: "Guía de investigación", subtitle: "El resumen de tu pedido", topic: "Tu pedido", progress: 100, categories: [], metrics: [], sources: [], sections: [{ title: "Lo principal", body: "Esta es la respuesta de prueba." }] }], mascotState: "happy" };
  await emitResearch(page, final, true);
  await expect(page.locator(".mr-research")).toHaveCount(0);
  await expect(page.getByText("Tu investigación está lista para leer.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Abrir GUÍA DE INVESTIGACIÓN$/ })).toBeVisible();
});

test("a failed stream removes the loading and leaves the composer usable", async ({ page }) => {
  await openResearch(page);
  await page.evaluate(() => (window as any).__researchFail());
  await expect(page.locator(".mr-research")).toHaveCount(0);
  await expect(page.getByText(/No pude contactar bien al agente ahora/)).toBeVisible();
  await expect(page.getByPlaceholder("Habla con Michi...")).toBeEnabled();
  await expect(page.locator(".koru-card-skeleton")).toHaveCount(0);
});

test("missing progress is indeterminate and fits 320px with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openResearch(page);
  const chunk = researchChunk("searching");
  delete chunk.uiBlocks[0].progress;
  await emitResearch(page, chunk);
  const bar = page.getByRole("progressbar", { name: "Progreso de la tarea" });
  await expect(bar).not.toHaveAttribute("aria-valuenow");
  await expect(page.locator(".mr-percent")).toHaveText("En curso");
  expect(await page.locator(".mr-art img").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  const bounds = await page.locator(".mr-panel").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByPlaceholder("Habla con Michi...")).toBeVisible();
});
