import { describe, expect, it } from "vitest";
import { extractStructuredData, findBackingSource } from "./structureExtractor";
import type { AssistantSource } from "./types";

// Sources REALES capturados de web_search (de captured-sources.json, query "dólar").
const REAL_SOURCES: AssistantSource[] = [
  {
    title: "Cotización Dólar Oficial - Junio 2026 | Dólar Histórico",
    url: "https://dolarhistorico.com/dolar-oficial",
    domain: "dolarhistorico.com",
    snippet:
      "El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra y $1.481,94 para la venta. La variación de la cotiza",
  },
  {
    title: "Cotización del dólar, dólar blue y mayorista - El Cronista",
    url: "https://cronista.com",
    domain: "cronista.com",
    snippet:
      "Cotización del dólar, dólar blue y mayorista Dólar hoy Argentina en vivo: cotización Banco Nación, mercado mayorista, dólar blue y dólar mep y ccl.",
  },
];

// ── Tests del validador: findBackingSource ─────────────────────────

describe("findBackingSource", () => {
  it("acepta cita que aparece literalmente en un source", () => {
    const quote = "El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra";
    const backing = findBackingSource(quote, REAL_SOURCES);
    expect(backing).not.toBeNull();
    expect(backing?.domain).toBe("dolarhistorico.com");
  });

  it("acepta cita con diferencias menores de acentos y puntuación", () => {
    const quote = "El Dolar Oficial finalizo el mes de Junio del 2026 con una cotizacion de $1.432,05 para la compra.";
    const backing = findBackingSource(quote, REAL_SOURCES);
    expect(backing).not.toBeNull();
  });

  it("RECHAZA cita inventada que no aparece en ningún source", () => {
    // Esto simula exactamente el caso "Boca 0-1 Universidad Católica": dato alucinado.
    const quote = "Boca Juniors perdió 0-1 contra Universidad Católica el 29 de mayo por la Libertadores";
    const backing = findBackingSource(quote, REAL_SOURCES);
    expect(backing).toBeNull();
  });

  it("RECHAZA cita demasiado corta (podría matchear por azar)", () => {
    const backing = findBackingSource("3-0", REAL_SOURCES);
    expect(backing).toBeNull();
  });

  it("RECHAZA cuando la cita no está en ningún source", () => {
    const quote = "El precio del oro alcanzó un récord histórico de U$D 5.000 la onza en lo que va del mes.";
    const backing = findBackingSource(quote, REAL_SOURCES);
    expect(backing).toBeNull();
  });

  it("devuelve null si no hay sources", () => {
    const backing = findBackingSource("cualquier frase larga que no tiene dónde respaldarse realmente", []);
    expect(backing).toBeNull();
  });
});

// ── Tests del extractor completo (con chatFn mock) ─────────────────

describe("extractStructuredData", () => {
  it("acepta items respaldados y rechaza items alucinados en la misma llamada", async () => {
    // El LLM "propone" 3 items: 2 respaldados (reales) y 1 alucinado.
    const chatFn = async () => ({
      content: JSON.stringify({
        title: "Cotización del dólar",
        items: [
          {
            label: "Dólar oficial compra",
            value: "$1.432,05",
            detail: "precio de compra",
            quote: "El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra",
          },
          {
            label: "Dólar oficial venta",
            value: "$1.481,94",
            // Cita LITERAL del source (no reescritura). El validador la exige exacta.
            quote: "El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra y $1.481,94 para la venta",
          },
          {
            label: "Dólar blue",
            value: "$1.600",
            quote: "El dólar blue cerró hoy a $1.600 en el mercado paralelo de Buenos Aires", // ALUCINADO
          },
        ],
      }),
    });

    const result = await extractStructuredData({
      userInput: "¿cuál es el precio del dólar hoy?",
      sources: REAL_SOURCES,
      chatFn,
    });

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2); // el 3ero (alucinado) se rechaza
    expect(result!.items[0].value).toBe("$1.432,05");
    expect(result!.items[0].sourceDomain).toBe("dolarhistorico.com");
    expect(result!.items[1].value).toBe("$1.481,94");
    // El item alucinado no debe aparecer
    expect(result!.items.find((i) => i.value === "$1.600")).toBeUndefined();
  });

  it("devuelve null si TODOS los items son alucinados", async () => {
    const chatFn = async () => ({
      content: JSON.stringify({
        title: "Resultados",
        items: [
          {
            label: "España",
            value: "3-0",
            quote: "España goleó 3-0 a Arabia Saudita en el partido inaugural del Mundial 2026", // no está en sources
          },
        ],
      }),
    });

    const result = await extractStructuredData({
      userInput: "mundial",
      sources: REAL_SOURCES,
      chatFn,
    });

    expect(result).toBeNull(); // todo rechazado → null → cae a texto plano
  });

  it("devuelve null si el LLM devuelve items vacío", async () => {
    const chatFn = async () => ({ content: JSON.stringify({ title: "Sin datos", items: [] }) });
    const result = await extractStructuredData({
      userInput: "algo que no está",
      sources: REAL_SOURCES,
      chatFn,
    });
    expect(result).toBeNull();
  });

  it("devuelve null si no hay sources usables", async () => {
    const chatFn = async () => ({ content: JSON.stringify({ title: "x", items: [] }) });
    const result = await extractStructuredData({
      userInput: "test",
      sources: [],
      chatFn,
    });
    expect(result).toBeNull();
  });

  it("devuelve null si el LLM falla (JSON inválido)", async () => {
    const chatFn = async () => ({ content: "esto no es json {{{" });
    const result = await extractStructuredData({
      userInput: "test",
      sources: REAL_SOURCES,
      chatFn,
    });
    expect(result).toBeNull();
  });

  it("es agnóstico al proveedor: solo depende de chatFn inyectada", async () => {
    // No importa qué proveedor haya detrás: el extractor funciona con cualquier chatFn.
    const miniMaxStyle = async () => ({ content: JSON.stringify({ title: "T", items: [{ label: "L", value: "$1.432,05", quote: "El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra" }] }) });
    const result = await extractStructuredData({ userInput: "dolar", sources: REAL_SOURCES, chatFn: miniMaxStyle });
    expect(result).not.toBeNull();
  });

  it("pela bloques <think> de modelos de razonamiento antes de parsear", async () => {
    // Modelos como MiniMax-M, DeepSeek-R1, Qwen3 emiten <think>...</think> antes del JSON.
    // El extractor debe ignorar el razonamiento y quedarse con el JSON válido.
    const chatFn = async () => ({
      content: `<think>El usuario pide el dólar. Veo en la fuente: $1.432,05 compra y $1.481,94 venta. Voy a extraer esos.</think>
{"title":"Cotización del dólar oficial","items":[{"label":"Dólar oficial compra","value":"$1.432,05","quote":"El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra"},{"label":"Dólar oficial venta","value":"$1.481,94","quote":"El Dólar Oficial finalizó el mes de Junio del 2026 con una cotización de $1.432,05 para la compra y $1.481,94 para la venta"}]}`,
    });
    const result = await extractStructuredData({
      userInput: "¿cuál es el precio del dólar hoy?",
      sources: REAL_SOURCES,
      chatFn,
    });
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].value).toBe("$1.432,05");
    expect(result!.items[1].value).toBe("$1.481,94");
  });
});
