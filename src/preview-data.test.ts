import { describe, expect, it } from "vitest";
import {
  CHAT_SCRIPT,
  CHAT_CATALOG,
  deriveCatalog,
  entriesForTag,
  blockTypes,
  blockSearchText,
  matchEntry,
  searchScript,
  type ChatEntry,
} from "./preview-data";

// ============================================================================
// PREVIEW DATA v5 — integridad del showcase completo del sistema de cards.
// El script es un contrato: si se rompe (tag sin categoría, contador mal,
// tipo sin cobertura), este test lo atrapa antes de que llegue al preview.
// ============================================================================

/** Los 56 tipos renderizables de UiBlock (domain/types.ts) que el showcase
 *  debe cubrir. "article" no es un UiBlock standalone (solo vive anidado en
 *  web_nav.results) por eso no está. v7.4: +day_info (¿qué día es hoy?). */
const EXPECTED_TYPES: string[] = [
  "activity_group",
  "activity_tracker",
  "alarm",
  "birthday_alarm",
  "birthday_calendar",
  "book_review",
  "clarifying_question",
  "comparison",
  "crypto_portfolio",
  "data_card",
  "data_ticker",
  "day_info",
  "decision_support",
  "deliverable",
  "delivery",
  "election_results",
  "election_vote",
  "exercise_plan",
  "forex",
  "generation",
  "health_reminder",
  "live_match",
  "market",
  "match_stats",
  "match_timeline",
  "memory",
  "money_summary",
  "morning_brief",
  "movie_review",
  "news_urgent",
  "outfit",
  "plan",
  "proactive_signal",
  "product_analysis",
  "recipe",
  "reminder",
  "research_sources",
  "resource_bundle",
  "restaurant_synthesis",
  "review_document",
  "review_quote",
  "review_score",
  "route_map",
  "route_timeline",
  "saved_record",
  "shopping_list",
  "smart_checklist",
  "social_interaction",
  "tennis_match",
  "transport_compare",
  "travel_plan",
  "travel_planner",
  "urgent_now",
  "weather",
  "web_nav",
  "wellbeing",
];

const catalogIds = () => CHAT_CATALOG.map((c) => c.id);

describe("preview-data · cobertura del sistema", () => {
  it("cubre los 55 tipos renderizables de UiBlock", () => {
    const covered = new Set(blockTypes(CHAT_SCRIPT));
    const missing = EXPECTED_TYPES.filter((t) => !covered.has(t));
    expect(missing).toEqual([]);
    expect(covered.size).toBe(EXPECTED_TYPES.length);
  });

  it("no hay tipos inesperados (typos de type en el script)", () => {
    const covered = new Set(blockTypes(CHAT_SCRIPT));
    const unexpected = [...covered].filter((t) => !EXPECTED_TYPES.includes(t));
    expect(unexpected).toEqual([]);
  });

  it("saved_record aparece exactamente 2 veces (router comprobante/bóveda) y el resto 1", () => {
    const counts = new Map<string, number>();
    for (const t of blockTypes(CHAT_SCRIPT)) counts.set(t, (counts.get(t) ?? 0) + 1);
    expect(counts.get("saved_record")).toBe(2);
    const others = [...counts.entries()].filter(([t]) => t !== "saved_record");
    for (const [t, n] of others) expect(n, `tipo ${t} repetido ${n} veces`).toBe(1);
  });
});

describe("preview-data · integridad del script", () => {
  it("cada entry tiene un tag que existe en el catálogo", () => {
    const ids = new Set(catalogIds());
    for (const e of CHAT_SCRIPT) {
      expect(ids.has(e.tag), `tag desconocido: ${e.tag}`).toBe(true);
    }
  });

  it("los contadores del catálogo se derivan del script (cero drift)", () => {
    for (const cat of CHAT_CATALOG) {
      if (cat.id === "all") {
        expect(cat.count).toBe(CHAT_SCRIPT.length);
        continue;
      }
      const real = CHAT_SCRIPT.filter((e) => e.tag === cat.id).length;
      expect(cat.count, `contador de ${cat.id}`).toBe(real);
      expect(cat.count).toBeGreaterThan(0);
    }
  });

  it("el catálogo no deja categorías del script sin declarar", () => {
    const declared = new Set(CHAT_CATALOG.map((c) => c.id));
    for (const tag of new Set(CHAT_SCRIPT.map((e) => e.tag))) {
      expect(declared.has(tag), `tag ${tag} sin categoría declarada`).toBe(true);
    }
  });

  it("los turns de usuario y los textos no vienen vacíos", () => {
    for (const e of CHAT_SCRIPT) {
      if (e.kind === "card") continue;
      expect((e as { text: string }).text.trim().length).toBeGreaterThan(2);
    }
  });

  it("deriveCatalog funciona sobre scripts arbitrarios", () => {
    const mini: ChatEntry[] = [
      { kind: "user", tag: "dia", text: "hola" },
      { kind: "card", tag: "dia", block: { type: "reminder", title: "x" } },
      { kind: "user", tag: "dinero", text: "plata" },
    ];
    const cat = deriveCatalog(mini);
    const byId = new Map(cat.map((c) => [c.id, c]));
    expect(byId.get("all")?.count).toBe(3);
    expect(byId.get("dia")?.count).toBe(2);
    expect(byId.get("dinero")?.count).toBe(1);
    expect(byId.get("ocio")?.count).toBe(0);
  });
});

describe("preview-data · helpers de navegación", () => {
  it("entriesForTag filtra por tag y null devuelve todo", () => {
    expect(entriesForTag(CHAT_SCRIPT, null)).toHaveLength(CHAT_SCRIPT.length);
    expect(entriesForTag(CHAT_SCRIPT, "all")).toHaveLength(CHAT_SCRIPT.length);
    const deportes = entriesForTag(CHAT_SCRIPT, "deportes");
    expect(deportes.length).toBeGreaterThan(0);
    expect(deportes.every((e) => e.tag === "deportes")).toBe(true);
  });

  it("matchEntry busca sin importar acentos ni mayúsculas", () => {
    const dolar = searchScript(CHAT_SCRIPT, "DÓLAR");
    expect(dolar.length).toBeGreaterThan(0);
    expect(dolar.some((e) => e.kind === "card" && e.block.type === "forex")).toBe(true);

    const boca = searchScript(CHAT_SCRIPT, "boca");
    expect(boca.some((e) => e.kind === "card" && e.block.type === "match_timeline")).toBe(true);
  });

  it("matchEntry encuentra texto DENTRO de los blocks (no solo intros)", () => {
    // "lavadora" vive dentro de datosLuz (data_card), no en ningún turno de usuario.
    const hits = searchScript(CHAT_SCRIPT, "lavadora");
    expect(hits.some((e) => e.kind === "card" && e.block.type === "data_card")).toBe(true);
  });

  it("matchEntry con query vacía matchea todo", () => {
    expect(matchEntry(CHAT_SCRIPT[0], "")).toBe(true);
    expect(matchEntry(CHAT_SCRIPT[0], "   ")).toBe(true);
  });

  it("una query sin resultados devuelve lista vacía (estado vacío del preview)", () => {
    expect(searchScript(CHAT_SCRIPT, "zxqxqinexistente")).toEqual([]);
  });

  it("blockSearchText recolecta strings del block hasta profundidad 2", () => {
    const reminder = { type: "reminder", title: "Llamar al dentista", note: "Confirmar turno" };
    expect(blockSearchText(reminder as never)).toContain("dentista");
    // El clásico: los nombres de equipos viven a profundidad 1-2 del block.
    const clasico = CHAT_SCRIPT.find(
      (e): e is Extract<ChatEntry, { kind: "card" }> => e.kind === "card" && e.block.type === "live_match",
    );
    expect(clasico).toBeDefined();
    expect(blockSearchText(clasico!.block).toLowerCase()).toContain("bernabéu");
  });
});
