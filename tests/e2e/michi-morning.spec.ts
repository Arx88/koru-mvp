import { expect, test } from "@playwright/test";
import { openMorning } from "./helpers/morning";

test("morning dialog shows verified weather and keeps keyboard focus inside", async ({ page }) => {
  await openMorning(page);
  const dialog = page.getByRole("dialog", { name: "Buenos días," });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("6%", { exact: true })).toBeVisible();
  await expect(dialog.getByText("km/h", { exact: true })).toBeVisible();
  await expect(dialog.locator(".mm-temperature")).toContainText("23°");
  await expect(dialog.locator(".mm-weather-stat").last()).toContainText("4");
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 20);
  expect(Math.abs(bounds!.x + bounds!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  expect(bounds!.y).toBeGreaterThanOrEqual(16);
  await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Shift+Tab"); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await dialog.getByRole("button", { name: "Empezar el día" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toBeVisible();
});

test("long greetings, plans and memories remain reachable on a short mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openMorning(page, { crowded: true });
  const dialog = page.getByRole("dialog", { name: /^Buenos días/ });
  await expect(dialog.getByText("6%", { exact: true })).toBeVisible();
  await dialog.locator("summary").click();
  await expect(dialog.getByText("Te gusta empezar la mañana con un paseo tranquilo.")).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(16);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(552);
  await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Empezar el día" }).click();
  await expect(dialog).not.toBeVisible();
});

test("absent weather metrics remain absent and the dialog can be postponed", async ({ page }) => {
  await openMorning(page, { missing: true });
  const dialog = page.getByRole("dialog", { name: "Buenos días," });
  await expect(dialog.getByText("Sin datos", { exact: true })).toHaveCount(3);
  await expect(dialog.getByText("0%", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Más tarde" }).click();
  await expect(dialog).not.toBeVisible();
});

test("an unavailable forecast keeps the greeting usable and Escape dismisses it", async ({ page }) => {
  await openMorning(page, { offline: true });
  const dialog = page.getByRole("dialog", { name: "Buenos días," });
  await expect(dialog.getByRole("status")).toContainText("Ahora no pude consultar");
  await expect(dialog.locator(".mm-weather")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("no city needs no forecast and reduced motion is respected", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let forecastCalls = 0;
  page.on("request", request => { if(request.url().includes("open-meteo.com")) forecastCalls++; });
  await openMorning(page, { city: "" });
  const dialog = page.getByRole("dialog", { name: "Buenos días," });
  await expect(dialog.getByRole("status")).toContainText("Agrega tu ciudad");
  expect(forecastCalls).toBe(0);
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await dialog.getByRole("button", { name: "Cerrar saludo" }).click();
  await expect(dialog).not.toBeVisible();
});
