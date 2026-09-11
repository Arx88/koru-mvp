import type { Page } from "@playwright/test";

export function researchChunk(phase = "thinking", progress: number | undefined = 15) {
  return {
    reply: "Estoy investigando tu pedido.",
    uiBlocks: [{ type: "deliverable", status: "working", kicker: "Tu Informe", title: "Tu investigación", topic: "Tu pedido", progress, phaseLabel: phase === "searching" ? "Consultando fuentes para tu informe" : phase === "planning" ? "Preparando la respuesta" : "Analizando tu pedido" }],
    understanding: { literalRequest: "Investigá este tema", userGoal: "Investigar", unstatedNeeds: [], assumptions: [], confidence: 1 },
    suggestedActions: [], memoryCandidates: [], commitments: [], records: [], toolResults: [],
    stateEvents: [{ kind: phase, label: phase }], mascotState: "working", provider: "bluesminds",
  };
}

export async function emitResearch(page: Page, chunk: unknown, done = false) {
  await page.evaluate(({ chunk, done }) => (window as any).__researchEmit(chunk, done), { chunk, done });
}

export async function openResearch(page: Page) {
  await page.clock.install({ time: new Date("2026-09-11T12:00:00") });
  await page.addInitScript(initial => {
    localStorage.setItem("koru.onboarded", "true");
    localStorage.setItem("michi.landscape", "17");
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      if (!url.includes("/api/koru/turn")) return original(input, init);
      return Promise.resolve(new Response(new ReadableStream({ start(controller) {
        const encode = (chunk: unknown) => new TextEncoder().encode(JSON.stringify(chunk) + "\n");
        (window as any).__researchEmit = (chunk: unknown, done: boolean) => { controller.enqueue(encode(chunk)); if (done) controller.close(); };
        (window as any).__researchFail = () => controller.error(new Error("Conexión de prueba interrumpida"));
        controller.enqueue(encode(initial));
      } }), { headers: { "Content-Type": "application/x-ndjson" } }));
    };
  }, researchChunk());
  await page.goto("/favicon.svg");
  await page.evaluate(async () => {
    const storePath = "/src/domain/store.ts", persistencePath = "/src/domain/persistence.ts";
    const { createInitialState } = await import(/* @vite-ignore */ storePath);
    const { writeLegacyState, writePersistedState } = await import(/* @vite-ignore */ persistencePath);
    const state = createInitialState(); state.heartbeat.enabled = false;
    state.userProfile = { name: "Juan" }; state.trustedEnergy = 119; state.totalEnergy = 119;
    writeLegacyState(state); await writePersistedState(state);
  });
  await page.goto("/");
  const input = page.getByPlaceholder("Habla con Michi...");
  await input.fill("¿Podés investigarlo por mí?");
  await input.press("Enter");
  await page.getByRole("heading", { name: "Estoy investigando para vos" }).waitFor();
}
