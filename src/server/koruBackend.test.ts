import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runKoruBackendTurn, personalCaptureFromArgs } from "./koruBackend";
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

  it("blocksFromToolResults converts election tool results into election_results", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "web_search",
      arguments: { query: "elecciones argentina" },
      result: {
        type: "election_data",
        title: "Elecciones 2025",
        status: "Escrutinio 92%",
        items: [
          { name: "Martínez", percent: "42.3%", detail: "12.847 mesas", done: true, color: "bg-emerald-500" },
        ],
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "election_results",
      title: "Elecciones 2025",
      status: "Escrutinio 92%",
      items: [{ name: "Martínez", percent: "42.3%" }],
    });
  });

  it("blocksFromToolResults converts election_vote tool result", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "election_vote",
      arguments: { question: "¿Aprobás?" },
      result: {
        type: "election_vote",
        question: "¿Aprobás?",
        subtitle: "Reforma laboral",
        options: [{ label: "Sí", sub: "Flex" }, { label: "No", sub: "Vigente" }],
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "election_vote",
      question: "¿Aprobás?",
      subtitle: "Reforma laboral",
    });
  });

  it("blocksFromToolResults converts data_ticker tool result", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "web_search",
      arguments: { query: "datos elecciones" },
      result: {
        type: "data_ticker",
        items: [{ label: "Votos", value: "28.4M" }],
        alert: "Diferencia 7.2 pp",
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "data_ticker",
      items: [{ label: "Votos", value: "28.4M" }],
      alert: "Diferencia 7.2 pp",
    });
  });

  it("blocksFromToolResults converts match_schedule into match_timeline", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "match_schedule",
      arguments: { team: "Boca" },
      result: {
        type: "match_schedule",
        team: "Boca",
        matches: [{ date: "2025-06-30", opponent: "River", competition: "Liga", venue: "La Bombonera" }],
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({ type: "match_timeline" });
  });

  it("blocksFromToolResults converts match_live into live_match", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "match_live",
      arguments: { match: "Boca vs River" },
      result: {
        type: "match_live",
        homeName: "Boca",
        awayName: "River",
        homeScore: 2,
        awayScore: 1,
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "live_match",
      homeTeam: { name: "Boca", score: 2 },
      awayTeam: { name: "River", score: 1 },
    });
  });

  it("blocksFromToolResults converts crypto_price into crypto_portfolio", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "crypto_price",
      arguments: { coin: "Bitcoin" },
      result: {
        type: "crypto_price",
        symbol: "BTC",
        coin: "Bitcoin",
        price: 64230,
        currency: "USD",
        change24hPct: 2.4,
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "crypto_portfolio",
      items: [{ symbol: "BTC", name: "Bitcoin" }],
    });
  });

  it("blocksFromToolResults converts currency_convert into forex", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "currency_convert",
      arguments: { from: "EUR", to: "USD" },
      result: {
        type: "currency_convert",
        from: "EUR",
        to: "USD",
        rate: 1.0854,
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "forex",
      items: [{ pair: "EUR/USD", rate: "1.0854" }],
    });
  });

  it("blocksFromToolResults converts route_traffic into route_timeline", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const execution = {
      tool: "route_traffic",
      arguments: { from: "Olivos", to: "Centro" },
      result: {
        type: "route_traffic",
        eta: "18 min",
        items: [{ label: "Girá a la izquierda", detail: "Av. Corrientes", color: "bg-emerald-500" }],
      },
    };
    const blocks = blocksFromToolResults([execution as any]);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatchObject({
      type: "route_timeline",
      eta: "18 min",
    });
  });

  it("blocksFromToolResults passes through product_analysis, smart_checklist, outfit, review types", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const executions = [
      { tool: "shopping_compare", arguments: {}, result: { type: "product_analysis", title: "Cafetera", specs: [{ label: "Precio", value: "$89" }] } },
      { tool: "shopping_compare", arguments: {}, result: { type: "smart_checklist", title: "Benchmark", items: [{ label: "A", checked: true }] } },
      { tool: "shopping_compare", arguments: {}, result: { type: "outfit", specs: [{ emoji: "☕", label: "Precio", value: "$89" }] } },
      { tool: "shopping_compare", arguments: {}, result: { type: "review_score", items: [{ emoji: "🎧", score: "9.2", label: "Calidad", color: "emerald" }] } },
      { tool: "web_search", arguments: {}, result: { type: "review_document", title: "Sony", body: "Cancelación top" } },
      { tool: "web_search", arguments: {}, result: { type: "review_quote", sourceName: "TechKoru", quote: "Rey de la cancelación" } },
    ];
    const blocks = blocksFromToolResults(executions as any);
    expect(blocks.map((b: any) => b.type)).toEqual([
      "product_analysis",
      "smart_checklist",
      "outfit",
      "review_score",
      "review_document",
      "review_quote",
    ]);
  });

  it("blocksFromToolResults passes through birthday and social_interaction blocks", async () => {
    const { blocksFromToolResults } = await import("./koruBackend");
    const executions = [
      { tool: "save_personal_item", arguments: {}, result: { type: "birthday_calendar", month: "Junio 2025", highlightedDay: 12 } },
      { tool: "save_personal_item", arguments: {}, result: { type: "birthday_alarm", name: "Cumpleaños Ana", countdown: "08" } },
      { tool: "save_personal_item", arguments: {}, result: { type: "social_interaction", name: "Ana", event: "Cumpleaños" } },
    ];
    const blocks = blocksFromToolResults(executions as any);
    expect(blocks.map((b: any) => b.type)).toEqual(["birthday_calendar", "birthday_alarm", "social_interaction"]);
  });
});

describe("personalCaptureFromArgs new UiBlock types", () => {
  it("creates birthday_calendar block", () => {
    const capture = personalCaptureFromArgs({ uiBlockType: "birthday_calendar", title: "Ana", person: "Ana", highlightedDay: 15 }, "cumple de Ana");
    expect(capture.block).toMatchObject({
      type: "birthday_calendar",
      highlightedDay: 15,
    });
    expect(capture.records?.[0].kind).toBe("birthday");
  });

  it("creates birthday_alarm block", () => {
    const capture = personalCaptureFromArgs({ uiBlockType: "birthday_alarm", title: "Ana", person: "Ana", countdown: "5", unit: "días" }, "cumple de Ana");
    expect(capture.block).toMatchObject({
      type: "birthday_alarm",
      name: "Cumpleaños Ana",
      countdown: "5",
    });
  });

  it("creates social_interaction block", () => {
    const capture = personalCaptureFromArgs({ uiBlockType: "social_interaction", title: "Ana", person: "Ana", event: "Cumpleaños", remaining: "Faltan 5 días", gifts: ["Libro"] }, "cumple de Ana");
    expect(capture.block).toMatchObject({
      type: "social_interaction",
      name: "Ana",
      date: "12 jul",
      remaining: "Faltan 5 días",
    });
  });
});
