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
      const input = messages?.find(m => m.role === "user")?.content ?? "";

      // Si es el extractor (system prompt de extractor), devolver oportunidades
      if (anyContent.includes("detector de oportunidades")) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ opportunities: [{ type: "health_followup", confidence: 0.85, contextualQuestion: "¿Querés que prepare alarmas para las tomas?", risk: "readonly", priority: "medium", requiresApproval: false, rationale: "Gasto en farmacia detectado" }] }) } }],
          model: "model",
        }), { status: 200 });
      }

      // Respuesta conversacional simple (sin tool calls) como JSON
      const suggestedActions = input.includes("quemado") || input.includes("estresado")
        ? [{ id: "enh_1", label: "Preparar alarmas", kind: "alarm", requiresApproval: true }]
        : [];

      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ reply: "Entendido, anotado el gasto.", understanding: { literalRequest: input, userGoal: "anotar gasto", confidence: 0.8 }, mascotState: "idle", suggestedActions }) } }],
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
    expect(result.fallbackReason).toBe("first-call");
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

  it("blocksFromToolResults converts research search into web_nav", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "web_search",
      arguments: { query: "test" },
      result: {
        type: "search",
        title: "Tendencias de diseño",
        mode: "research",
        summary: "Resumen",
        sources: [
          { title: "Art 1", url: "https://a.com/1", domain: "a.com", snippet: "snip" },
          { title: "Art 2", url: "https://b.com/2", domain: "b.com" },
        ],
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "web_nav",
      title: "Tendencias de diseño",
      status: "complete",
      results: [
        { title: "Art 1", source: "a.com", url: "https://a.com/1", type: "page", snippet: "snip" },
        { title: "Art 2", source: "b.com", url: "https://b.com/2", type: "page" },
      ],
    });
  });
});
