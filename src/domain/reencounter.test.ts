/**
 * Test de integración del reencuentro tras ausencia — ejercita la cadena
 * completa del server sin llamar a un LLM real:
 *
 * 1. buildMessages: historial con createdAt de hace 44 días + entries viejos
 *    → el system prompt del turno contiene el bloque de REENCUENTRO con los
 *    días exactos, los últimos temas y el digest de pendientes vencidos.
 *
 * 2. runProactiveCheck: lastSeen de hace 44 días, config sin API key real
 *    → la voz LLM falla y cae al fallback determinístico (el HECHO computado),
 *    que usa el userName real (no "Juan" hardcodeado) e incluye el digest.
 */
import { describe, expect, it } from "vitest";
import { buildMessages } from "../server/koruBackend";
import { runProactiveCheck } from "./proactiveEngine";
import { createInitialState } from "./store";
import type { KoruBackendTurnRequest } from "../server/koruBackend";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgoIso = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

function fakeConfig() {
  // Sin API key real: la voz LLM del proactive engine debe fallar y caer al
  // fallback determinístico. Base URL inalcanzable para forzar el fallo.
  return {
    nvidiaApiKey: "",
    nvidiaBaseUrl: "http://127.0.0.1:59999",
    nvidiaModel: "test-model",
    nvidiaFastModel: "test-model",
    openRouterKeys: [] as string[],
    openRouterFallbackModels: "",
    minimaxToken: "",
    bluesmindsKeys: [] as string[],
  } as any;
}

describe("Reencuentro tras ausencia — cadena completa del server", () => {
  it("buildMessages inyecta el bloque de reencuentro con 44 días y temas previos", () => {
    const state = createInitialState();
    state.userName = "Camila";
    state.entries = [
      { id: "e1", text: "que calor", sentiment: "neutral", createdAt: daysAgoIso(44), energyAwarded: 0 } as any,
    ];
    state.commitments = [
      { id: "c1", title: "Renovar pasaporte", dueHint: "", dueAt: daysAgoIso(20), status: "open", createdAt: daysAgoIso(50), sourceEntryId: "e1" } as any,
    ];

    const request: KoruBackendTurnRequest = {
      input: "hola, volví",
      state,
      history: [
        { role: "assistant" as const, content: "¿En qué te ayudo?", createdAt: daysAgoIso(44) },
        { role: "user" as const, content: "estoy armando koru, muchísima gestión", createdAt: daysAgoIso(44) },
      ],
    };

    const messages = buildMessages(request);
    const system = messages[0].content as string;

    // Bloque de reencuentro presente con el hecho exacto.
    expect(system).toContain("REENCUENTRO TRAS AUSENCIA");
    expect(system).toContain("44 días sin conversar");
    // Temas previos: el hilo que quedó colgado antes de la ausencia.
    expect(system).toContain("estoy armando koru, muchísima gestión");
    // Digest: pendientes vencidos DURANTE la ausencia.
    expect(system).toContain("Renovar pasaporte");
    // Guardas anti-manipulación en el prompt.
    expect(system).toContain("sin reproche");
    // El historial sigue intacto como mensajes (no solo contexto).
    expect(messages.some((m) => m.role === "user" && m.content === "hola, volví")).toBe(true);
  });

  it("buildMessages NO inyecta reencuentro cuando la sesión es continua", () => {
    const state = createInitialState();
    state.userName = "Camila";

    const request: KoruBackendTurnRequest = {
      input: "hola de nuevo",
      state,
      history: [
        { role: "user" as const, content: "recién hablamos", createdAt: daysAgoIso(0) },
      ],
    };

    const system = buildMessages(request)[0].content as string;
    expect(system).not.toContain("REENCUENTRO TRAS AUSENCIA");
  });

  it("runProactiveCheck genera el hecho de reencuentro con userName real (sin 'Juan' hardcodeado)", async () => {
    const state = createInitialState();
    state.userName = "Camila";
    state.commitments = [
      { id: "c1", title: "Renovar pasaporte", dueHint: "", dueAt: daysAgoIso(20), status: "open", createdAt: daysAgoIso(50), sourceEntryId: "e1" } as any,
    ];

    const message = await runProactiveCheck(
      state,
      fakeConfig(),
      Date.now() - 44 * DAY_MS,
    );

    expect(message).not.toBeNull();
    expect(message!.shouldShow).toBe(true);
    // El hecho computado: días exactos, no "Juan" pegado.
    expect(message!.reply).toContain("no entrabas hace 44 días");
    expect(message!.reply).toContain("Camila");
    expect(message!.reply).not.toContain("Juan");
    // Digest de pendientes vencidos durante la ausencia.
    expect(message!.reply).toContain("Renovar pasaporte");
    expect(message!.mascotState).toBe("worried");
  }, 60_000);

  it("runProactiveCheck NO genera mensaje de inactividad para ausencias cortas", async () => {
    const state = createInitialState();
    state.userName = "Camila";

    const message = await runProactiveCheck(
      state,
      fakeConfig(),
      Date.now() - 3 * DAY_MS,
    );

    // Sin memories de equipo/ciudad y con ausencia corta, no hay eventos
    // relevantes → nada que mostrar.
    expect(message).toBeNull();
  }, 60_000);
});
