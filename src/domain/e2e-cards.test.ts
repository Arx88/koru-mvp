import { describe, test, expect, afterAll } from "vitest";
import { runKoruBackendTurn, type ProviderConfig } from "../server/koruBackend";
import type { KoruState } from "./types";

function createInitialState(): KoruState {
  const now = new Date().toISOString();
  return {
    stage: "seed",
    trustedEnergy: 0,
    totalEnergy: 0,
    createdAt: now,
    updatedAt: now,
    voicePreference: { warmth: 7, directness: 6, humor: 3, detail: 5, proactivity: 3 },
    runtime: {
      freeLlmApiBaseUrl: "",
      freeLlmApiKey: "",
      freeLlmApiModel: "",
      freeLlmApiEnabled: false,
      embeddingsEnabled: false,
      openModelBaseUrl: "",
      openModelApiKey: "",
      openModelModel: "",
      openModelEnabled: false,
    },
    heartbeat: {
      enabled: true,
      activeStartHour: 8,
      activeEndHour: 21,
      maxNudgesPerDay: 3,
      dailyNudgeCount: 0,
    },
    memories: [],
    commitments: [],
    actions: [],
    calendarEvents: [],
    records: [],
    entries: [],
    energyEvents: [],
    nudges: [],
    modelCalls: [],
    ephemeralMode: false,
    durableMemoryEnabled: true,
    actionPreparationEnabled: true,
    worldSignalsEnabled: false,
    learningPreferences: [],
  };
}

const config: ProviderConfig = {
  nvidiaApiKey: "dummy",
  nvidiaBaseUrl: "http://172.23.144.1:11434",
  nvidiaModel: "llama3.1:8b",
  openRouterKeys: [],
  openRouterModels: [],
};

const state = createInitialState();

const categories: Array<{
  name: string;
  prompts: string[];
  expectedBlockTypes: string[];
  /** Categorias no cubiertas por ejemplos del Semantic Router; aceptamos respuesta conversacional si no hay blocks. */
  routerMayMiss?: boolean;
}> = [
  {
    name: "weather",
    prompts: ["¿que tiempo hace en Buenos Aires?", "¿necesito paraguas?"],
    expectedBlockTypes: ["weather"],
  },
  {
    name: "restaurant",
    prompts: ["donde cenar en Madrid", "quiero una parrilla en Palermo"],
    expectedBlockTypes: ["restaurant_synthesis", "web_nav", "data_card"],
  },
  {
    name: "match_schedule",
    prompts: ["cuando juega boca", "partidos de manana"],
    expectedBlockTypes: ["web_nav", "data_card", "live_match"],
    routerMayMiss: true,
  },
  {
    name: "crypto_price",
    prompts: ["cuanto esta bitcoin", "como va ethereum"],
    expectedBlockTypes: ["market", "web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "nutrition_calc",
    prompts: ["cuantas calorias tiene un plato de pollo", "nutricion del arroz"],
    expectedBlockTypes: ["web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "trending_twitter",
    prompts: ["que es tendencia", "top twitter hoy"],
    expectedBlockTypes: ["web_nav", "data_card", "proactive_signal"],
    routerMayMiss: true,
  },
  {
    name: "flight_search",
    prompts: ["vuelos a barcelona", "quiero ir a madrid en avion"],
    expectedBlockTypes: ["web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "hotel_search",
    prompts: ["hotel en madrid", "donde alojarme en paris"],
    expectedBlockTypes: ["web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "travel_itinerary",
    prompts: ["planifica mi viaje a londres", "que hacer 3 dias en roma"],
    expectedBlockTypes: ["web_nav", "data_card", "travel_planner"],
    routerMayMiss: true,
  },
  {
    name: "news_urgent",
    prompts: ["ultimas noticias argentina", "que paso hoy en el mundo"],
    expectedBlockTypes: ["research_sources", "web_nav", "data_card"],
  },
  {
    name: "world_signal",
    prompts: ["senales del mundo", "que onda el mercado"],
    expectedBlockTypes: ["proactive_signal", "web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "person_info",
    prompts: ["quien es messi", "info de maradona"],
    expectedBlockTypes: ["web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "news_topic",
    prompts: ["noticias de tecnologia", "ultimas noticias de deportes"],
    expectedBlockTypes: ["research_sources", "web_nav", "data_card"],
  },
  {
    name: "trending_youtube",
    prompts: ["que es viral en youtube", "top videos"],
    expectedBlockTypes: ["web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "trending_github",
    prompts: ["tendencias github", "repos trending"],
    expectedBlockTypes: ["web_nav", "data_card"],
    routerMayMiss: true,
  },
  {
    name: "currency_convert",
    prompts: ["convertir 100 pesos a dolares", "cambio euro"],
    expectedBlockTypes: ["web_nav", "data_card", "market"],
    routerMayMiss: true,
  },
];

const results: Record<
  string,
  Array<{
    prompt: string;
    success: boolean;
    reply: string;
    uiBlockTypes: string[];
    uiBlockCount: number;
    toolResults: Array<{ tool?: string; status?: string }>;
    fallbackReason?: string;
    provider?: string;
    model?: string;
    durationMs?: number;
    error?: string;
  }>
> = {};

for (const category of categories) {
  describe.skip(`E2E card: ${category.name}`, () => {
    for (const prompt of category.prompts) {
      test(
        `${category.name}: "${prompt}"`,
        { timeout: 120_000 },
        async () => {
          const start = Date.now();
          const log: (typeof results)[string][number] = {
            prompt,
            success: false,
            reply: "",
            uiBlockTypes: [],
            uiBlockCount: 0,
            toolResults: [],
            fallbackReason: undefined,
            provider: undefined,
            model: undefined,
            durationMs: 0,
            error: undefined,
          };
          try {
            const result = await runKoruBackendTurn(
              { input: prompt, history: [], state },
              config,
            );
            const duration = Date.now() - start;
            log.durationMs = duration;
            log.provider = result.provider;
            log.model = result.model;
            log.reply = result.reply ?? "";
            log.fallbackReason = result.fallbackReason;
            log.uiBlockTypes = result.uiBlocks?.map((b) => b.type) ?? [];
            log.uiBlockCount = result.uiBlocks?.length ?? 0;
            log.toolResults =
              result.toolResults?.map((t) => ({
                tool: t.tool,
                status: t.status,
              })) ?? [];

            // Criterios de éxito
            const nonEmptyReply = Boolean(result.reply?.trim().length);
            const notRateLimited =
              result.fallbackReason !== "rate-limit" &&
              !result.fallbackReason?.includes("rate-limit");
            const noException = !result.fallbackReason?.includes("exception");
            const hasAnyBlock = (result.uiBlocks?.length ?? 0) > 0;
            const hasExpectedBlockType = result.uiBlocks?.some((b) =>
              category.expectedBlockTypes.includes(b.type),
            );
            const acceptableForRouterMiss = category.routerMayMiss && !hasAnyBlock;
            const timedOut = duration > 90_000;

            log.success =
              nonEmptyReply &&
              notRateLimited &&
              noException &&
              (hasExpectedBlockType || acceptableForRouterMiss) &&
              !timedOut;

            if (!log.success) {
              const reasons: string[] = [];
              if (!nonEmptyReply) reasons.push("reply vacío");
              if (notRateLimited === false) reasons.push("rate-limit");
              if (noException === false) reasons.push("excepción");
              if (!hasExpectedBlockType && !acceptableForRouterMiss) reasons.push(`block type inesperado: ${log.uiBlockTypes.join(", ") || "(ninguno)"}`);
            if (acceptableForRouterMiss) reasons.push("router no detectó categoría (respuesta conversacional)");
              if (timedOut) reasons.push(`timeout (${duration}ms > 90s)`);
              log.error = reasons.join("; ");
            }

            // Construir expectation helpful para el runner
            expect(result.reply).toBeTruthy();
            expect(result.reply?.trim().length).toBeGreaterThan(0);
            expect(result.uiBlocks).toBeTruthy();
            expect(
              result.uiBlocks?.some((b) =>
                category.expectedBlockTypes.includes(b.type),
              ),
            ).toBe(true);
            expect(
              result.fallbackReason !== "rate-limit" &&
                !result.fallbackReason?.includes("rate-limit"),
            ).toBe(true);
          } catch (err: any) {
            const duration = Date.now() - start;
            log.durationMs = duration;
            log.error = err?.message ?? String(err);
            log.success = false;
            // Loguear pero no fallar el suite — el test individual marca error.
            throw err;
          } finally {
            if (!results[category.name]) results[category.name] = [];
            results[category.name].push(log);
          }
        },
      );
    }
  });
}

afterAll(async () => {
  const report = {
    timestamp: new Date().toISOString(),
    model: config.nvidiaModel,
    provider: "ollama",
    baseUrl: config.nvidiaBaseUrl,
    summary: categories.map((cat) => {
      const catResults = results[cat.name] ?? [];
      const successes = catResults.filter((r) => r.success).length;
      return {
        category: cat.name,
        total: catResults.length,
        passed: successes,
        failed: catResults.length - successes,
        prompts: catResults,
      };
    }),
  };

  const fs = await import("fs");
  const path = "/mnt/c/Users/juanp/.kimchi/docs/resultado-e2e-tools.json";
  fs.mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(report, null, 2), "utf-8");
  console.log("\n=== E2E Report written to", path, "===");
  console.log(
    "Total:",
    report.summary.reduce((a, b) => a + b.total, 0),
    "Passed:",
    report.summary.reduce((a, b) => a + b.passed, 0),
    "Failed:",
    report.summary.reduce((a, b) => a + b.failed, 0),
  );
});
