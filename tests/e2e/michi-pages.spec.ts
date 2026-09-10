import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, label: string) {
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("koru.onboarded", "true");
    localStorage.setItem("michi.landscape", "17");
  });
  await page.goto("/");
});

test("secondary pages fit the viewport and return to the chat", async ({ page }) => {
  for (const [label, close] of [["Memoria", "Volver al chat"], ["Historial", "Volver al chat"], ["Hoy", "Hablar con Michi"], ["Ajustes", "Cerrar ajustes"]]) {
    await navigate(page, label);
    await expect(page.locator(".mx-page-backdrop")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: close, exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toBeVisible();
  }
});

test("Create saves a note that can be found in Collections", async ({ page }) => {
  await navigate(page, "Hoy");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Crear", exact: true });
  await editor.getByText("Nota", { exact: true }).click();
  await editor.getByPlaceholder("Ej: Idea para el proyecto").fill("Prueba visual MICHI");
  await editor.getByPlaceholder("Escribí lo que quieras recordar...").fill("Una nota guardada desde la nueva interfaz.");
  await editor.getByRole("button", { name: /Guardar/ }).click();
  await expect(editor.getByRole("heading", { name: "¿Qué querés crear?" })).toBeVisible();
  await editor.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole("region", { name: "Hoy — Michi" })).toBeVisible();
  await page.getByRole("button", { name: "Guardados", exact: true }).click();
  await page.getByRole("dialog", { name: "Mis colecciones" }).getByRole("button", { name: /Notas 1 guardado/ }).click();
  await expect(page.getByText("Prueba visual MICHI", { exact: true }).first()).toBeVisible();
});

test("all 15 personal avatars load and the choice survives a reload", async ({ page }) => {
  await navigate(page, "Mis avatares");
  await page.getByRole("button", { name: /Tu avatar de conversación/ }).click();
  const picker = page.getByRole("dialog", { name: "¿Con quién hablo hoy?" });
  await expect(picker.locator(".mx-personal-grid button")).toHaveCount(15);
  for (const img of await picker.locator(".mx-personal-grid img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await picker.getByRole("button", { name: "Elegir Explorador", exact: true }).click();
  await page.reload();
  await navigate(page, "Mis avatares");
  await page.getByRole("button", { name: /Tu avatar de conversación/ }).click();
  await expect(page.getByRole("button", { name: "Elegir Explorador", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion removes page entrance animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await navigate(page, "Memoria");
  expect(await page.locator(".mx-page-content").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
});
