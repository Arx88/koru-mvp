import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/koru-ai/v1/chat/completions", (route) => route.abort());
  await page.route("**/koru-web/search", async (route) => {
    const body = route.request().postDataJSON() as { mode?: string; queries?: string[] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "verified",
        verifiedAt: "2026-06-17T10:00:00.000Z",
        sources: [
          {
            title: body.mode === "news"
              ? "IA aplicada al trabajo: reporte actualizado"
              : body.mode === "world"
                ? "Senales recientes sobre IA y trabajo"
                : body.mode === "weather"
                  ? "Clima actual en Madrid"
                  : "Cafetera compacta con entrega",
            url: "https://example.com/fuente-1",
            domain: "example.com",
            snippet: `Resultado para ${body.queries?.[0] ?? "consulta"}`,
          },
          {
            title: "Comparativa independiente",
            url: "https://example.com/fuente-2",
            domain: "example.com",
            snippet: "Incluye criterios y fecha de publicacion.",
          },
        ],
        comparisonItems: body.mode === "shopping"
          ? [
              {
                title: "Cafetera compacta",
                vendor: "example.com",
                url: "https://example.com/fuente-1",
                evidence: "Entrega disponible segun fuente.",
                score: 88,
              },
            ]
          : undefined,
        summaryItems: body.mode === "news" || body.mode === "world"
          ? [{ label: "Principal", value: body.mode === "world" ? "Senales recientes sobre IA y trabajo" : "IA aplicada al trabajo: reporte actualizado", detail: "example.com" }]
          : undefined,
        recommendation: "Abrí fuentes reales y dejé evidencia para revisar antes de decidir.",
      }),
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("koru-local-first");
  });
  await page.reload();
});

test("chat executes web navigation with verified sources after approval", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Buscame cafeteras con buena relacion precio entrega manana");

  await expect(chat.getByRole("button", { name: /Preparar busqueda/i })).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Listo para abrir fuentes reales/i)).toBeVisible();
  await expect(chat.getByText(/Cafetera compacta con entrega/i)).toHaveCount(0);

  await chat.getByRole("button", { name: /Preparar busqueda/i }).click();

  await expect(chat.getByText(/Fuentes verificadas|Verificado/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Cafetera compacta con entrega/i)).toBeVisible();
  await expect(chat.getByText(/Comparativa independiente/i)).toBeVisible();
  await expect(chat.getByRole("link", { name: /Cafetera compacta example\.com/i })).toBeVisible();
});

test("plain greeting feels like a usable chat, not an emotional template", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "hola");

  await expect(chat.getByText(/Estoy aca.*pendientes|Queres que veamos pendientes/i).last()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Gracias por contarmelo|No hace falta convertirlo|Lo dejamos asi/i)).toHaveCount(0);
  await expect(chat.getByText(/Un segundo, lo ordeno/i)).toHaveCount(0);
  await expect(chat.getByRole("button", { name: /Aplicar plan|Preparar busqueda|Guardar nota/i })).toHaveCount(0);
});

test("greeting plus weather feels fast and keeps the next task conversation intact", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Hola Koru, que clima hace?");

  await expect(chat.getByText(/En que ciudad|ciudad/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Gracias por contarmelo|No hace falta convertirlo|Un segundo, lo ordeno/i)).toHaveCount(0);

  await sendComposer(page, input, "Madrid");

  await expect(chat.locator('[data-web-mode="weather"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Buscando clima ahora|Clima actual en Madrid|open-meteo/i).first()).toBeVisible({ timeout: 30_000 });

  await sendComposer(page, input, "Tengo que llamar a Ana manana");
  await expect(chat.getByText(/Ana/i).last()).toBeVisible({ timeout: 30_000 });

  await sendComposer(page, input, "No se que hacer hoy");
  await expect(chat.getByText(/Ana|pendiente|Plan|primer paso real/i).last()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Consultar clima real en No se que hacer hoy/i)).toHaveCount(0);
  await expect(chat.locator('[data-web-mode="weather"]')).toHaveCount(1);
});

test("shopping reminder becomes a home shopping item and useful action", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Acordame que tengo que comprar huevos");

  await expect(chat.getByText(/Comprar huevos/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Lista de compras/i).first()).toBeVisible();
  await expect(chat.getByText(/shopping item|compras/i).first()).toBeVisible();
  await expect(chat.getByRole("button", { name: /Guardar nota|Dejar visible/i }).first()).toBeVisible();
  await expect(chat.getByRole("button", { name: /Aplicar plan/i })).toHaveCount(0);
});

test("decision support shows a clear vote instead of only metrics", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Anota gasto de 100 euros en supermercado");
  await expect(chat.getByText(/100.*EUR|100.*supermercado/i).first()).toBeVisible({ timeout: 30_000 });

  await sendComposer(page, input, "Puedo permitirme comprar una silla de 90 euros?");

  await expect(chat.getByText(/Mi voto/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Yo esperaria|Yo avanzaria|Me falta un dato/i).first()).toBeVisible();
  await expect(chat.getByText(/gastos registrados en los ultimos 7 dias|historial de gastos/i).first()).toBeVisible();
});

test("news request creates a semantic web module with real-source state", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Buscame noticias relevantes para mi trabajo en inteligencia artificial");

  await expect(chat.getByText(/Noticias|Radar de noticias/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Fuentes verificadas|Verificado/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByRole("link", { name: /IA aplicada al trabajo/i })).toBeVisible();
  await expect(chat.getByRole("button", { name: /Preparar busqueda/i })).toHaveCount(0);
});

test("weather asks one missing datum and continues when user answers city", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Que clima hace?");

  await expect(chat.getByText(/En que ciudad|ciudad/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByRole("button", { name: /Usar brief|Aplicar plan/i })).toHaveCount(0);

  await sendComposer(page, input, "Madrid");

  await expect(chat.getByText(/Clima/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Clima actual en Madrid/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Cafetera compacta/i)).toHaveCount(0);
  await expect(chat.getByRole("button", { name: /Preparar busqueda/i })).toHaveCount(0);

  await sendComposer(page, input, "No se que hacer hoy");
  await expect(chat.getByText(/Encontrar el primer paso real/i).last()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Consultar clima real en No se que hacer hoy/i)).toHaveCount(0);
});

test("world signal uses a dedicated card and source flow", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "El mundo esta hablando de esto en IA, te enteraste?");

  await expect(chat.getByText(/El mundo|Mundo/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByRole("link", { name: /Senales recientes/i })).toBeVisible();
  await chat.getByRole("button", { name: /Seguir radar/i }).click();
  await expect(chat.getByText(/Te voy a traer este radar/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Volver/i }).click();
  await page.getByRole("button", { name: /Permisos/i }).click();
  await expect(page.getByRole("switch", { name: /Radar del mundo/i })).toBeVisible();
});

async function completeOnboarding(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /o escribir/i }).click();
  await page.getByPlaceholder(/Tu nombre/i).fill("Alex");
  await page.getByPlaceholder(/trabajo con clientes/i).fill("Trabajo con clientes por la manana");
  await page.getByPlaceholder(/me cuesta arrancar/i).fill("Me cuesta arrancar con muchas cosas abiertas");
  await page.getByPlaceholder(/reducir carga mental/i).fill("Quiero reducir carga mental");
  await page.getByRole("button", { name: /Guardar/i }).first().click();
  await page.getByRole("button", { name: /Guardar/i }).nth(1).click();
  await page.getByRole("button", { name: /Guardar/i }).nth(2).click();
  await page.getByRole("button", { name: /Confirmar y continuar/i }).click();
  await page.getByRole("button", { name: /Entrar a mi/i }).click();
}

async function sendComposer(page: import("@playwright/test").Page, input: import("@playwright/test").Locator, text: string) {
  await input.fill(text);
  await page.getByRole("button", { name: /Enviar/i }).click();
}

test("onboarding flow completes into home screen", async ({ page }) => {
  await expect(page.getByText("Soy Koru")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hablar con Koru/i })).toBeVisible();
  await completeOnboarding(page);
  await expect(page.getByRole("button", { name: /Hablar con Koru/i })).toBeVisible();
});

test("chat asks for context first and then executes a real plan", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });

  await expect(page.getByRole("heading", { name: "Koru" })).toBeVisible();
  await expect(chat.getByText(/Hola, Alex.*Cu[eé]ntame c[oó]mo est[aá]s/i)).toBeVisible();

  await sendComposer(page, page.getByPlaceholder(/Escribe tu mensaje/i), "Tengo muchas cosas en la cabeza y no se por donde empezar");

  await expect(chat.getByText(/Encontrar el primer paso real/i)).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/bloque corto|energia|energ/i).first()).toBeVisible();
  await expect(chat.getByRole("button", { name: /Aplicar plan/i })).toHaveCount(0);

  await sendComposer(page, page.getByPlaceholder(/Escribe tu mensaje/i), "Tengo que lanzar Koru, hablar con mi socio, preparar una demo y comparar proveedores");

  await expect(chat.getByRole("button", { name: /Aplicar plan/i })).toBeVisible({ timeout: 30_000 });
  await expect(chat.locator('[data-ui-block="plan"] .koru-stitch-plan-copy strong').filter({ hasText: /^Lanzar Koru$/ })).toBeVisible();
  await expect(chat.locator('[data-ui-block="plan"] .koru-stitch-plan-copy strong').filter({ hasText: /^Preparar una demo$/ })).toBeVisible();

  await chat.getByRole("button", { name: /Aplicar plan/i }).click();
  await expect(chat.getByText(/Plan aplicado/i).first()).toBeVisible();
});

test("chat turns saved life records into activity modules", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Anota gasto de 12 euros en supermercado");

  await expect(chat.locator('[data-ui-block="saved_record"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/Gasto anotado/i).first()).toBeVisible();
  await expect(chat.getByText(/12.*EUR|12.*supermercado/i).first()).toBeVisible();
  await expect(chat.getByText(/Detect[eé] datos reutilizables|Los orden[eé] por [aá]rea|Los dej[eé] visibles|dato reutilizable/i)).toHaveCount(0);

  await sendComposer(page, input, "Pague 8 euros de farmacia hoy");
  await expect(chat.getByText(/farmacia/i).first()).toBeVisible({ timeout: 30_000 });

  await sendComposer(page, input, "Cuanto gaste esta semana?");

  await expect(chat.getByText(/Dinero/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText("20.00 EUR", { exact: true })).toBeVisible();

  await sendComposer(page, input, "Tengo arroz, pollo y huevos en casa");
  await expect(chat.getByText(/arroz/i).first()).toBeVisible({ timeout: 30_000 });

  await sendComposer(page, input, "Que tengo para comer en casa?");
  await expect(chat.getByText(/Actividad/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/pollo/i).first()).toBeVisible();
});

test("real user journey keeps memory, tasks and useful cards across sessions", async ({ page }) => {
  test.setTimeout(75_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Prefiero que me des un primer paso chico cuando estoy trabado.");
  await expect(chat.getByRole("button", { name: /Guardar/i }).first()).toBeVisible({ timeout: 30_000 });
  await chat.getByRole("button", { name: /Guardar/i }).first().click();

  await sendComposer(page, input, "Tengo que mandar presupuesto hoy, preparar una demo y llamar a Ana manana.");
  await expect(chat.getByRole("button", { name: /Aplicar plan/i })).toBeVisible({ timeout: 30_000 });
  await expect(chat.locator('[data-ui-block="plan"] .koru-stitch-plan-row')).toHaveCount(3);

  await sendComposer(page, input, "Anota gasto de 25 euros en farmacia");
  await expect(chat.getByText(/25.*EUR|farmacia/i).first()).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const reloadedChat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const reloadedInput = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, reloadedInput, "No se por donde empezar hoy");
  await expect(reloadedChat.getByText(/primer paso|Plan|presupuesto|Ana|demo/i).last()).toBeVisible({ timeout: 30_000 });
  await expect(reloadedChat.getByText(/No hace falta convertirlo|Gracias por contarmelo asi/i)).toHaveCount(0);

  await sendComposer(page, reloadedInput, "Cuanto gaste esta semana?");
  await expect(reloadedChat.getByText(/25.00 EUR|25.*EUR/i).first()).toBeVisible({ timeout: 30_000 });

  await sendComposer(page, reloadedInput, "Hagamos cierre de mes: que aprendiste de mi forma de trabajar?");
  await expect(reloadedChat.getByText(/primer paso chico|trabado|memoria|pendientes/i).last()).toBeVisible({ timeout: 30_000 });
});

test("permissions screen shows autonomy boundaries", async ({ page }) => {
  await completeOnboarding(page);

  await page.getByRole("button", { name: /Permisos/i }).click();
  await expect(page.getByRole("heading", { name: "Permisos" })).toBeVisible();
  await expect(page.getByText(/Koru no se alimenta de secretos/i)).toBeVisible();
  await expect(page.getByRole("switch", { name: /Memoria duradera/i })).toBeVisible();
});

test("memory garden opens with plant cards", async ({ page }) => {
  await completeOnboarding(page);

  await page.getByRole("button", { name: /Memoria/i }).click();
  await expect(page.getByRole("heading", { name: "Mi jardín" })).toBeVisible();
});

test("mobile viewport remains usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
  await expect(page.getByText("Soy Koru")).toBeVisible();
});

// ─── Task 8: E2E for personalized replies, mascotState, and memory ────────────────

test("reply is personalized and not a canned phrase", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Hola, soy Alex");

  const reply = await chat.locator(".koru-message.is-koru .koru-message-text").last().textContent({ timeout: 10_000 });

  // Verify it is NOT a hardcoded phrase from the old soul.ts
  expect(reply).not.toBe("Guardado.");
  expect(reply).not.toBe("Te dejo el numero y el criterio, sin vueltas.");
  expect(reply).not.toBe("Te bajo esto a algo manejable.");
  expect(reply).not.toBe("Estoy aca para seguir.");
  expect(reply).not.toBe("Claro. Lo miro y te dejo solo lo importante.");
  // Must be a real response longer than 10 chars
  expect(reply?.length ?? 0).toBeGreaterThan(10);
});

test("mascot reflects emotional mascotState on celebration", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  await sendComposer(page, input, "Me ascendieron en el trabajo!");

  // Mascot should reflect a celebrating state (happy.png for celebrating or happy mascotState)
  const mascotSrc = await chat.locator(".koru-header-mascot-image").getAttribute("src", { timeout: 10_000 });
  expect(mascotSrc).toContain("happy");
});

test("reply references saved memories", async ({ page }) => {
  test.setTimeout(45_000);
  await completeOnboarding(page);
  await page.getByRole("button", { name: /Hablar con Koru/i }).click();
  const chat = page.getByRole("region", { name: /Conversacion con Koru/i });
  const input = page.getByPlaceholder(/Escribe tu mensaje/i);

  // Save a memory about family
  await sendComposer(page, input, "Mi mama se llama Rosa y vive en Mendoza");
  await expect(chat.getByText(/mama|Rosa|Mendoza/i).first()).toBeVisible({ timeout: 10_000 });

  // Ask about weekend plans — the reply should reference the saved memory
  await sendComposer(page, input, "A quien le deberia llamar este finde?");
  const reply = await chat.locator(".koru-message.is-koru .koru-message-text").last().textContent({ timeout: 10_000 });

  expect(reply?.toLowerCase()).toMatch(/rosa|mendoza|mama/);
});
