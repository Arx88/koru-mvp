import { expect, test } from "@playwright/test";

/**
 * Regresión del composer inalcanzable.
 *
 * `@media (min-width: 700px) { .koru-chat-screen { min-height: max(835px, 100svh) } }`
 * forzaba la pantalla a 835px de alto dentro de `.koru-chat-shell`, que es
 * `position: fixed; inset: 0` — o sea que mide exactamente el viewport. En
 * cualquier ventana de >=700px de ancho y <835px de alto (el "Desktop Chrome"
 * de Playwright mide 1280x720; también laptops y teléfonos en landscape) el
 * composer entero quedaba por debajo del borde inferior. Como el shell está
 * fijo y el body no scrollea, no había manera de alcanzar el botón de enviar:
 * la app quedaba inusable en desktop.
 *
 * El clic de Playwright falla si el elemento no está dentro del viewport, así
 * que estos tests son la red de seguridad real de ese fix.
 */

test.beforeEach(async ({ page }) => {
  await page.route("**/api/koru/turn", (route) => route.abort());
  await page.goto("/");
});

test("el composer queda dentro del viewport", async ({ page }) => {
  const composer = page.locator(".mx-composer");
  await expect(composer).toBeVisible();

  const medidas = await page.evaluate(() => {
    const composerEl = document.querySelector(".mx-composer");
    const shellEl = document.querySelector(".koru-chat-shell");
    if (!composerEl || !shellEl) return null;
    return {
      composerBottom: composerEl.getBoundingClientRect().bottom,
      shellBottom: shellEl.getBoundingClientRect().bottom,
      composerHeight: composerEl.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
    };
  });

  expect(medidas).not.toBeNull();
  // 1px de tolerancia por el redondeo subpixel de los bordes.
  expect(medidas!.composerHeight).toBeGreaterThan(0);
  expect(medidas!.composerBottom).toBeLessThanOrEqual(medidas!.viewportHeight + 1);
  expect(medidas!.shellBottom).toBeLessThanOrEqual(medidas!.viewportHeight + 1);
});

test("el botón de enviar se puede clickear y el mensaje sale", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "Mensaje para Michi" });
  await input.fill("hola");

  // Si el composer se sale del viewport, Playwright no puede clickear y falla acá.
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  await expect(page.locator("main").getByText("hola", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
});
