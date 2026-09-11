import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, label: string) {
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

async function seed(page: Page, energy: number, withMemory = false) {
  // Seed outside the mounted app so its startup persistence cannot overwrite the fixture.
  await page.goto("/favicon.svg");
  await page.evaluate(
    async ({ energy, withMemory }) => {
      const storePath = "/src/domain/store.ts",
        persistencePath = "/src/domain/persistence.ts";
      const { createInitialState } = await import(/* @vite-ignore */ storePath);
      const { writeLegacyState, writePersistedState } = await import(
        /* @vite-ignore */ persistencePath
      );
      const state = createInitialState();
      state.trustedEnergy = energy;
      state.totalEnergy = energy;
      state.heartbeat.enabled = false;
      if (withMemory)
        state.memories = [
          {
            id: "pocket-test",
            kind: "preference",
            text: "Me encanta el café con canela",
            confidence: 0.8,
            sensitivity: "normal",
            status: "candidate",
            createdAt: new Date().toISOString(),
            sourceEntryId: "test",
            rootQuote: "Mi café favorito lleva canela",
            useForSuggestions: true,
          },
        ];
      writeLegacyState(state);
      await writePersistedState(state);
    },
    { energy, withMemory },
  );
  await page.goto("/");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("michi.onboarded", "true");
    localStorage.setItem("michi.landscape", "17");
  });
  await page.goto("/");
});

test("all 28 companions load, locked choices stay locked, unlocked choices persist", async ({
  page,
}) => {
  await seed(page, 4400);
  await navigate(page, "Mis avatares");
  await expect(page.locator(".mx-grid .mx-tile")).toHaveCount(28);
  for (const img of await page.locator(".mx-grid .mx-tile img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page
    .getByRole("button", {
      name: "Astronauta, se desbloquea en el nivel 50",
      exact: true,
    })
    .click();
  const locked = page.getByRole("dialog", {
    name: "Un nuevo amigo te espera",
    exact: true,
  });
  await expect(locked).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(locked).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Pirata, disponible para equipar",
      exact: true,
    })
    .click();
  // El banner del avatar equipado es una ilustración completa (incluye al gato),
  // por eso llega como background-image del hero de la colección.
  await expect(page.locator(".mx-banner")).toHaveCSS(
    "background-image",
    /banner-companion-01\.webp/,
  );
  await page
    .getByRole("button", { name: "Volver al chat", exact: true })
    .click();
  await expect(page.locator(".mx-cat img").first()).toHaveAttribute(
    "src",
    "/assets/michi-world/companion-01.webp",
  );
  await page.reload();
  await navigate(page, "Mis avatares");
  await expect(
    page.getByRole("button", { name: "Pirata, en uso", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the profile saves profile and people, while cancel leaves the profile intact", async ({
  page,
}) => {
  await navigate(page, "Ajustes");
  await page.getByRole("button", { name: "Expandir sección Perfil", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar mi perfil", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Juan");
  await page.getByLabel("Ciudad", { exact: true }).fill("Madrid");
  await page.getByLabel("Cumpleaños", { exact: true }).fill("1994-03-21");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Juan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar mi perfil", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("No guardar");
  await page
    .getByRole("button", { name: "Cancelar edición", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agregar persona", exact: true })
    .click();
  await page.getByLabel("Nombre de la persona", { exact: true }).fill("Luna");
  await page.getByLabel("Relación", { exact: true }).fill("Amiga");
  await page
    .getByRole("button", { name: "Guardar persona", exact: true })
    .click();
  await page.reload();
  await navigate(page, "Ajustes");
  await page.getByRole("button", { name: "Expandir sección Perfil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Juan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Madrid", { exact: true })).toBeVisible();
  await expect(page.getByText("Luna", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Editar mi perfil", exact: true })
    .click();
  await expect(page.getByLabel("Cumpleaños", { exact: true })).toHaveValue(
    "1994-03-21",
  );
});

test("memories can be edited, confirmed, searched, excluded and forgotten", async ({
  page,
}) => {
  await seed(page, 99, true);
  await navigate(page, "Memoria");
  await page
    .getByRole("button", { name: /Me encanta el café con canela/ })
    .click();
  const detail = page.getByRole("dialog", { name: "Lo que Michi recuerda" });
  await detail
    .getByLabel("Editar memoria")
    .fill("Mi café favorito lleva avena");
  await detail
    .getByRole("button", { name: "Guardar cambio", exact: true })
    .click();
  await detail.getByRole("checkbox").uncheck();
  await expect(detail.getByRole("checkbox")).not.toBeChecked();
  await detail
    .getByRole("button", { name: "Confirmar recuerdo", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardados", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Mi café favorito lleva avena/ }),
  ).toBeVisible();
  await page.getByLabel("Buscar recuerdos").fill("inexistente");
  await expect(page.getByText("No aparece por acá")).toBeVisible();
  await page.getByLabel("Buscar recuerdos").fill("");
  await page
    .getByRole("button", { name: "Volver al chat", exact: true })
    .click();
  await navigate(page, "Mis avatares");
  await expect(page.locator(".mx-banner-level")).toContainText("Nivel 2");
  await page
    .getByRole("button", { name: "Volver al chat", exact: true })
    .click();
  await page.reload();
  await navigate(page, "Memoria");
  await page
    .getByRole("button", { name: /Mi café favorito lleva avena/ })
    .click();
  await expect(detail.getByRole("checkbox")).not.toBeChecked();
  await detail
    .getByRole("button", { name: "Olvidar este recuerdo", exact: true })
    .click();
  await detail.getByRole("button", { name: "Conservar", exact: true }).click();
  await expect(detail).toBeVisible();
  await detail
    .getByRole("button", { name: "Olvidar este recuerdo", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Sí, olvidar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Mi café favorito lleva avena/ }),
  ).toHaveCount(0);
});


test("settings keeps its hero clear and saves appearance choices", async ({ page }) => {
  await navigate(page, "Ajustes");
  const hero = await page.locator(".mi-settings-hero").boundingBox();
  const firstCard = await page.locator('[data-section="perfil"]').boundingBox();
  expect(firstCard!.y).toBeGreaterThanOrEqual(hero!.y + hero!.height - 4);
  const titleSize = await page.getByRole("heading", { name: "Ajustes", exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.getByRole("button", { name: "Grande", exact: true }).click();
  await expect.poll(() => page.getByRole("heading", { name: "Ajustes", exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(titleSize);
  await expect(page.getByRole("button", { name: "Grande", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("switch", { name: "Voz de Michi", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Voz de Michi", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Cerrar ajustes", exact: true }).click();
  await page.reload();
  await navigate(page, "Ajustes");
  await expect(page.getByRole("button", { name: "Grande", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("switch", { name: "Voz de Michi", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Buscar ajustes", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar en ajustes", exact: true }).fill("idioma");
  await expect(page.getByRole("button", { name: "Expandir sección Idioma", exact: true })).toBeVisible();
  await expect(page.locator('[data-section="perfil"]')).toHaveCount(0);
});


test("morning startup preserves saved progress and memories across reloads", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T07:30:00"));
  await page.route("**/api/michi/morning-brief", route => route.fulfill({ json: { shouldShow: false } }));
  await seed(page, 4400, true);
  await navigate(page, "Mis avatares");
  await expect(page.locator(".mx-banner-level")).toContainText("Nivel 45");
  await page.reload();
  await navigate(page, "Mis avatares");
  await expect(page.locator(".mx-banner-level")).toContainText("Nivel 45");
  await page.getByRole("button", { name: "Volver al chat", exact: true }).click();
  await navigate(page, "Memoria");
  await expect(page.getByRole("button", { name: /Me encanta el café con canela/ })).toBeVisible();
});
