import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runKoruBackendTurn } from "./koruBackend";
import { createInitialState } from "../domain/store";
import type { ProviderConfig, KoruBackendTurnRequest } from "./koruBackend";

describe("runKoruBackendTurn conversational flow", () => {
  const config: ProviderConfig = {
    nvidiaApiKey: "fake-key",
    nvidiaBaseUrl: "https://api.nvidia.com",
    nvidiaModel: "model",
    openRouterKeys: [],
    openRouterModels: [],
  };

  const baseRequest: KoruBackendTurnRequest = {
    input: "gasté 18€ en farmacia",
    history: [],
    state: createInitialState(),
  };

  let fetchMock: ReturnType<typeof vi.fn>;
  let fetchCallCount = 0;

  beforeEach(() => {
    fetchCallCount = 0;
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      fetchCallCount++;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const messages = body.messages as Array<{ role: string; content: string }> | undefined;
      const anyContent = messages?.map((m) => m.content).join(" ") ?? "";

      // Si es el extractor (system prompt de extractor), devolver oportunidades
      if (anyContent.includes("detector de oportunidades")) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ opportunities: [{ type: "health_followup", confidence: 0.85, contextualQuestion: "¿Querés que prepare alarmas para las tomas?", risk: "readonly", priority: "medium", requiresApproval: false, rationale: "Gasto en farmacia detectado" }] }) } }],
          model: "model",
        }), { status: 200 });
      }

      // Respuesta conversacional simple (sin tool calls)
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Entendido, anotado el gasto." } }],
        model: "model",
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a reply for a conversational turn", async () => {
    const result = await runKoruBackendTurn(
      { ...baseRequest, input: "Hola, ¿cómo estás?" },
      config,
    );
    expect(result.reply).toBeTruthy();
    expect(result.fallbackReason).toBe("conversational-fast-path");
  });

  it("injects enhancement on conversational burnout turn", async () => {
    const result = await runKoruBackendTurn(
      { ...baseRequest, input: "estoy quemado" },
      config,
    );
    expect(result.reply).toBeTruthy();
    expect(result.suggestedActions?.length ?? 0).toBeGreaterThan(0);
    const action = result.suggestedActions?.[0];
    expect(action?.label).toContain("alarmas");
  });

  it("does not duplicate the same enhancement type", async () => {
    const result = await runKoruBackendTurn(
      { ...baseRequest, input: "estoy quemado" },
      config,
    );
    const types = new Set(result.suggestedActions?.map((a) => a.kind));
    expect(types.size).toBe(result.suggestedActions?.length ?? 0);
  });
});
