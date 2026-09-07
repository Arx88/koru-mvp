import { describe, it, expect, vi } from "vitest";

// El fallback web debe ser deterministic en test: mockeamos el scraper para
// devolver vacío (así el tool cae al honesto). El happy path del fallback
// (web devuelve fuentes) se prueba con su propio caso mocked.
vi.mock("../shared/scrapers", () => ({
  searchAndEnrich: vi.fn(async () => []),
  searchAndEnrichWithFallback: vi.fn(async () => []),
  usableSources: vi.fn((sources: unknown[]) => sources),
  searchDuckDuckGo: vi.fn(async () => []),
  fetchPageContent: vi.fn(async () => ""),
  mentions: vi.fn(() => true),
}));

import { buildGdeltTopicQueries, newsTopic } from "../trending/trending";
import { enrichCaptureBlocks, expenseCategory } from "../../server/pipeline/enrichCaptureBlocks";
import { normalizeFinalPayload } from "../../server/pipeline/finalizePayload";
import type { UiBlock, KoruState, LifeRecord } from "../../domain/types";

// ─── buildGdeltTopicQueries ─────────────────────────────────────────────────
describe("buildGdeltTopicQueries", () => {
  it("cita el tema como frase y agrega variante sin acentos", () => {
    const qs = buildGdeltTopicQueries("tecnología");
    expect(qs[0]).toBe('"tecnología" sourcelang:spa');
    expect(qs).toContain('"tecnologia" sourcelang:spa');
    expect(qs).toContain('"tecnología"');
  });

  it("tema sin acentos: frase citada + versión sin filtro de idioma", () => {
    const qs = buildGdeltTopicQueries("inteligencia artificial");
    expect(qs[0]).toBe('"inteligencia artificial" sourcelang:spa');
    expect(qs).toContain('"inteligencia artificial"');
    expect(qs).toHaveLength(2);
  });

  it("recorta espacios", () => {
    expect(buildGdeltTopicQueries("  cafe  ")[0]).toBe('"cafe" sourcelang:spa');
  });
});

// ─── newsTopic: fallback honesto cuando no hay cobertura ────────────────────
describe("newsTopic tool (fallback honesto)", () => {
  it("devuelve __forceHonestReply cuando GDELT y web no devuelven nada", async () => {
    // Poblamos el cache de GDELT con [] para forzar el camino sin cobertura
    // sin tocar la red: el cache key es el query con el que se buscaría.
    const { cached } = await import("../shared/cache");
    for (const q of buildGdeltTopicQueries("tema-x-inexistente")) {
      await cached(`news_topic:${q.toLowerCase()}`, 1, async () => [] as never);
    }
    // Y también forzamos el fallback web a vacío cacheando su resultado.
    // (searchAndEnrich usa cache interno distinto; el try/catch de la tool
    // tolera que falle la red — en el entorno de test sin red cae al honesto.)
    const r = await newsTopic.run({ topic: "tema-x-inexistente" }, { userInput: "test", state: { records: [] } } as never);
    expect(r.type).toBe("news_topic");
    expect((r as { __forceHonestReply?: boolean }).__forceHonestReply).toBe(true);
    expect((r as { __honestReplyText?: string }).__honestReplyText).toContain("tema-x-inexistente");
  }, 30_000);

  it("topic vacío → failed sin __forceHonestReply", async () => {
    const r = await newsTopic.run({}, { userInput: "test" } as never);
    expect(r.status).toBe("failed");
    expect((r as { __forceHonestReply?: boolean }).__forceHonestReply).toBeUndefined();
  });

  it("GDELT vacío + web con fuentes → devuelve artículos de la web real (fallback)", async () => {
    // Cambiamos el mock para que la búsqueda web devuelva fuentes reales.
    const { searchAndEnrich } = await import("../shared/scrapers");
    vi.mocked(searchAndEnrich).mockResolvedValueOnce([
      { title: "Las 5 novedades de tech", url: "https://ejemplo.com/tech", domain: "ejemplo.com", snippet: "Resumen de la nota." },
    ] as never);
    for (const q of buildGdeltTopicQueries("tecnología-y-web")) {
      await (await import("../shared/cache")).cached(`news_topic:${q.toLowerCase()}`, 1, async () => [] as never);
    }
    const r = await newsTopic.run({ topic: "tecnología-y-web" }, { userInput: "test", state: { records: [] } } as never);
    expect(r.type).toBe("news_topic");
    expect(r.status).toBe("ok");
    const res = r as { source?: string; articles?: Array<{ title?: string; url?: string; domain?: string }> };
    expect(res.source).toBe("web");
    expect(res.articles?.length).toBe(1);
    expect(res.articles?.[0].url).toBe("https://ejemplo.com/tech");
    expect((r as { __forceHonestReply?: boolean }).__forceHonestReply).toBeUndefined();
  });
});

// ─── expenseCategory ─────────────────────────────────────────────────────────
describe("expenseCategory", () => {
  it("clasifica café, transporte, supermercado", () => {
    expect(expenseCategory("café y medialunas")).toBe("Café y snacks");
    expect(expenseCategory("uber a la oficina")).toBe("Transporte");
    expect(expenseCategory("compra en el super")).toBe("Supermercado");
  });
  it("sin match → Otros", () => {
    expect(expenseCategory("algo raro")).toBe("Otros");
  });
});

// ─── enrichCaptureBlocks ─────────────────────────────────────────────────────
type RecordDraft = Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">;

function expenseDraft(title: string, amount: number, currency = "EUR"): RecordDraft {
  return { domain: "money", kind: "expense", title, value: title, amount, currency };
}

function stateWith(records: RecordDraft[]): KoruState {
  return {
    memories: [], commitments: [], actions: [], calendarEvents: [], records,
    entries: [], energyEvents: [], nudges: [], modelCalls: [], learningPreferences: [],
  } as unknown as KoruState;
}

describe("enrichCaptureBlocks", () => {
  it("money_summary shallow → summaryItems del gasto real + total", () => {
    const block: UiBlock = { type: "money_summary", title: "Gasto anotado", total: 1500, currency: "ARS" };
    const out = enrichCaptureBlocks([block], [expenseDraft("Café y medialunas", 1500, "ARS")], undefined);
    expect(out[0].type).toBe("money_summary");
    const money = out[0] as Extract<UiBlock, { type: "money_summary" }>;
    expect(money.summaryItems?.length).toBeGreaterThan(0);
    expect(money.summaryItems?.[0].label).toBe("Café y snacks");
    expect(money.summaryItems?.[0].value).toContain("1500"); // formato es-ES/ICU-dependiente: solo el monto
    expect(money.total).toBe(1500);
  });

  it("agrega categorías de HOY del historial real, agrupadas", () => {
    const block: UiBlock = { type: "money_summary", title: "Gasto anotado", total: 12, currency: "EUR" };
    const history = [
      expenseDraft("café de la mañana", 3.5, "EUR"),
      expenseDraft("otro café", 2.5, "EUR"),
      expenseDraft("uber centro", 10, "EUR"),
      expenseDraft("cena de ayer", 40, "EUR"), // no es de hoy → no debería entrar
    ];
    // La record de ayer lleva createdAt de ayer.
    (history[3] as { createdAt?: string }).createdAt = new Date(Date.now() - 86400000 * 2).toISOString();
    const out = enrichCaptureBlocks([block], [expenseDraft("medialunas", 12, "EUR")], stateWith(history));
    const money = out[0] as Extract<UiBlock, { type: "money_summary" }>;
    const labels = (money.summaryItems ?? []).map((i) => i.label);
    expect(labels).toContain("Café y snacks"); // la del turno (no duplicada)
    expect(labels).toContain("Transporte"); // del historial de hoy
    expect(labels).not.toContain("Restaurantes"); // ayer queda afuera
    const transporte = money.summaryItems?.find((i) => i.label === "Transporte");
    expect(transporte?.value).toContain("10");
    expect(transporte?.detail).toContain("1 movimiento");
  });

  it("recommendation con total real del día cuando falta", () => {
    const block: UiBlock = { type: "money_summary", title: "Gasto anotado", total: 20, currency: "EUR" };
    const out = enrichCaptureBlocks([block], [expenseDraft("pizza", 20, "EUR")], stateWith([expenseDraft("café", 4, "EUR")]));
    const money = out[0] as Extract<UiBlock, { type: "money_summary" }>;
    expect(money.recommendation).toMatch(/Hoy: 24/);
    expect(money.recommendation).toContain("2 movimientos");
  });

  it("no inventa summaryItems si no hay expenses (card queda honesta)", () => {
    const block: UiBlock = { type: "money_summary", title: "Gasto anotado", total: 100, currency: "EUR" };
    const out = enrichCaptureBlocks([block], [], stateWith([]));
    const money = out[0] as Extract<UiBlock, { type: "money_summary" }>;
    expect(money.summaryItems).toBeUndefined();
    expect(money.recommendation).toBeUndefined();
  });

  it("blocks que no son money_summary pasan intactos", () => {
    const block: UiBlock = { type: "reminder", title: "Llamar a Juan", dueText: "mañana 10am" };
    const out = enrichCaptureBlocks([block], [expenseDraft("x", 1)], stateWith([]));
    expect(out[0]).toBe(block);
  });

  it("deriva total del gasto del turno cuando el block no lo trae", () => {
    const block: UiBlock = { type: "money_summary", title: "Gasto anotado" };
    const out = enrichCaptureBlocks([block], [expenseDraft("libro", 25, "EUR")], undefined);
    const money = out[0] as Extract<UiBlock, { type: "money_summary" }>;
    expect(money.total).toBe(25);
    expect(money.currency).toBe("EUR");
  });
});

// ─── normalizeFinalPayload: reply honesto + integración enrichment ──────────
describe("normalizeFinalPayload integración", () => {
  it("tools sin blocks ni datos → reply honesto 'Busqué, pero no conseguí'", () => {
    const res = normalizeFinalPayload(
      { reply: "", uiBlocks: [] },
      "noticias de tecnología",
      [{ id: "t1", name: "news_topic", result: { type: "news_topic", status: "ok", topic: "tecnología", articles: [], source: "GDELT" } as never } as never],
      undefined,
      undefined,
      stateWith([]),
    );
    expect(res.reply).toContain("Busqué, pero no conseguí");
    expect(res.uiBlocks).toHaveLength(0);
  });

  it("money_summary del tool se enriquece end-to-end con state", () => {
    const capture = {
      type: "personal_capture",
      block: { type: "money_summary", title: "Gasto anotado", total: 1500, currency: "ARS" },
      records: [expenseDraft("café y medialunas", 1500, "ARS")],
    };
    const res = normalizeFinalPayload(
      { reply: "Listo, anoté el gasto.", uiBlocks: [] },
      "anotá $1500 de café",
      [{ id: "t1", name: "save_personal_item", result: capture as never } as never],
      undefined,
      undefined,
      stateWith([expenseDraft("taxi", 800, "ARS")]),
    );
    expect(res.uiBlocks.length).toBeGreaterThan(0);
    const money = res.uiBlocks.find((b) => b.type === "money_summary") as Extract<UiBlock, { type: "money_summary" }> | undefined;
    expect(money).toBeDefined();
    expect(money?.summaryItems?.length).toBeGreaterThan(0);
    expect((money?.summaryItems ?? []).map((i) => i.label)).toContain("Transporte");
  });
});
