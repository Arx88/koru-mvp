/**
 * 🔴 REGRESIÓN CARD BASURA (2026-09-15) — reclamo del usuario:
 * "si no puede mostrar algo debe decir que ahora no puede que intente más tarde,
 *  pero poner OTRA CARD de búsquedas genéricas mal hechas con resultados vacíos
 *  es lo peor que vi".
 *
 * Cuando un pedido de DATO falla (marcador, precio, clima) el sistema cae a
 * web_search como plan B. Esa búsqueda NO responde la pregunta: devuelve páginas
 * genéricas. Estos tests fijan que en ese caso NO haya card y que el mensaje sea
 * honesto; y que una búsqueda pedida por el usuario siga mostrando su card.
 */
import { describe, expect, it } from "vitest";
import { blocksFromToolResults } from "./blocksFromToolResults";
import { markFallbackSearch } from "./koruBackend";

const searchResult = (extra: Record<string, unknown> = {}) =>
  ({
    type: "search",
    mode: "research",
    title: "resultado Independiente San Lorenzo",
    summary: "",
    sources: [
      { title: "Club Atlético Independiente - Wikipedia", url: "https://es.wikipedia.org/wiki/Independiente", domain: "es.wikipedia.org", snippet: "club de fútbol argentino" },
      { title: "San Lorenzo de Almagro - Wikipedia", url: "https://es.wikipedia.org/wiki/San_Lorenzo", domain: "es.wikipedia.org", snippet: "club de fútbol argentino" },
    ],
    ...extra,
  }) as any;

const toolExecution = (result: any, tool = "web_search") => [{ tool, result } as any];

describe("markFallbackSearch — marca la búsqueda que es plan B", () => {
  it("marca el resultado de web_search con la tool que falló", () => {
    const searchResultObj = searchResult();
    const executions: any[] = [
      { id: "1", name: "match_live", result: { type: "match_live", status: "unavailable" } },
      { id: "2", name: "web_search", result: searchResultObj },
    ];
    markFallbackSearch(executions, "match_live");
    expect(searchResultObj.__fallbackFor).toBe("match_live");
    expect(executions[0].result.__fallbackFor).toBeUndefined();
  });

  it("no marca nada si la última ejecución no es web_search", () => {
    const other: any = { type: "plan", items: [] };
    markFallbackSearch([{ id: "1", name: "plan_day", result: other } as any], "match_live");
    expect(other.__fallbackFor).toBeUndefined();
  });
});

describe("card de búsqueda como plan B de una tool de dato", () => {
  it("fallback de match_live sin datos verificados → SIN card y reply honesto", () => {
    const result = searchResult({ __fallbackFor: "match_live" });
    const blocks = blocksFromToolResults(toolExecution(result), "como salio independiente con sanlorenzo", -180);

    expect(blocks.find(b => b.type === "deliverable")).toBeUndefined();
    expect(blocks).toHaveLength(0);
    expect(result.__forceHonestReply).toBe(true);
    expect(String(result.__honestReplyText)).toMatch(/no puedo/i);
    expect(String(result.__honestReplyText)).toMatch(/probá de nuevo/i);
  });

  it("fallback con datos estructurados verificados → SÍ muestra la card", () => {
    const result = searchResult({
      __fallbackFor: "match_live",
      extractedData: { title: "Marcadores", items: [{ label: "Independiente", value: "1" }] },
    });
    const blocks = blocksFromToolResults(toolExecution(result), "como salio independiente con sanlorenzo", -180);

    expect(blocks.find(b => b.type === "deliverable")).toBeDefined();
    expect(result.__forceHonestReply).toBeUndefined();
  });

  it("búsqueda pedida por el usuario → la card sigue apareciendo, con la CONSULTA como tema", () => {
    const result = searchResult();
    const blocks = blocksFromToolResults(toolExecution(result), "qué está pasando con la IA", -180);
    const card: any = blocks.find(b => b.type === "deliverable");

    expect(card).toBeDefined();
    // El tema es la consulta, no la etiqueta interna ("Busqueda") que el usuario
    // veía como "Encontré N fuentes sobre 'Busqueda'".
    expect(card.topic).toBe("resultado Independiente San Lorenzo");
    expect(JSON.stringify(card)).not.toContain("Busqueda");
  });

  it("fallback de una tool con contenido (recetas) → la card se mantiene", () => {
    const result = searchResult({ __fallbackFor: "recipe_find" });
    const blocks = blocksFromToolResults(toolExecution(result), "receta de milanesas", -180);

    expect(blocks.find(b => b.type === "deliverable")).toBeDefined();
    expect(result.__forceHonestReply).toBeUndefined();
  });
});

describe("match_live sin fuente disponible", () => {
  it("status \"unavailable\" → SIN card de partido y reply honesto del tool", () => {
    const result: any = {
      type: "match_live",
      status: "unavailable",
      query: "independiente san lorenzo",
      matches: [],
      note: "Ahora mismo no puedo consultar los resultados deportivos: las fuentes (ESPN y TheSportsDB) no están respondiendo. Probá de nuevo en unos minutos.",
    };
    const blocks = blocksFromToolResults(toolExecution(result, "match_live"), "como salio independiente con sanlorenzo", -180);

    expect(blocks).toHaveLength(0);
    expect(result.__forceHonestReply).toBe(true);
    expect(String(result.__honestReplyText)).toMatch(/Probá de nuevo en unos minutos/);
  });
});
