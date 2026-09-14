/**
 * 🔴 FIX (2026-09-14) — "el informe habla del tema ANTERIOR".
 *
 * Bug en vivo (captura del usuario): pidió un informe sobre la IA en la última
 * semana y Michi entregó "Tu informe sobre El BTC está en USD está terminado.
 * Lo investigué en 24 fuentes."
 *
 * Causa: en `explicitDeliverableTopic`, la guarda de correferencia se disparaba
 * con CUALQUIER artículo (`/…\bla|el|lo\b/`), así que un tema autosuficiente
 * como "la IA en la última semana" era reemplazado por una frase capitalizada
 * sacada del historial ("El BTC está en USD 77…").
 *
 * Lo que se protege acá:
 *  1. Un tema con contenido propio (sigla, nombre propio, sustantivo) NUNCA se
 *     pisa con el historial — el informe es del tema PEDIDO.
 *  2. La correferencia sigue funcionando cuando el tema ES una referencia vacía
 *     ("esa película", "eso"), y ya no depende de la posición del input actual
 *     en el historial (el viejo `slice(-6, -1)` descartaba el turno inmediato).
 *  3. Sin antecedente, devuelve null (cae al flujo normal que pide aclaración)
 *     en vez de inventar un informe sobre "esa película" literal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  explicitDeliverableTopic,
  isBareReference,
  runKoruBackendTurn,
  type KoruBackendTurnResponse,
  type ProviderConfig,
} from "./koruBackend";
import { createInitialState } from "../domain/store";
import type { KoruConversationMessage } from "../domain/types";

/**
 * Historial del caso reportado: el usuario venía hablando del BTC y Michi
 * respondió último (lo normal). El viejo `slice(-6, -1)` descartaba justamente
 * el último turno y la correferencia tomaba "El BTC está en USD 77...".
 */
const btcHistory: KoruConversationMessage[] = [
  { role: "user", content: "¿El BTC está en USD?" },
  { role: "assistant", content: "El BTC está en USD 77.796,41. Te dejé la cotización con variación 24h en la tarjeta." },
  { role: "user", content: "¿y el ethereum?" },
  { role: "assistant", content: "El ethereum está en 2.100 USD." },
];

describe("explicitDeliverableTopic — el tema PEDIDO manda", () => {
  it("no pisa el tema pedido con el del mensaje anterior (informe de IA ≠ informe del BTC)", () => {
    const topic = explicitDeliverableTopic("hacé un informe sobre la IA en la última semana", btcHistory);
    expect(topic).toBe("la IA en la última semana");
    expect(topic ?? "").not.toMatch(/btc|ethereum/i);
  });

  it("no pisa el tema ni con un historial largo donde el tema viejo se repite", () => {
    const long: KoruConversationMessage[] = [
      ...btcHistory,
      { role: "user", content: "¿y solana?" },
      { role: "assistant", content: "Solana está en 180 USD." },
    ];
    const topic = explicitDeliverableTopic("haceme un informe sobre el sueño y la memoria", long);
    expect(topic).toBe("el sueño y la memoria");
  });

  it("mantiene el tema cuando trae nombre propio o sustantivo, aunque el historial hable de otra cosa", () => {
    expect(explicitDeliverableTopic("haceme un informe sobre la Revolución Francesa", btcHistory))
      .toBe("la Revolución Francesa");
    expect(explicitDeliverableTopic("hacé un informe sobre el Mundial 2026", btcHistory))
      .toBe("el Mundial 2026");
    expect(explicitDeliverableTopic("investigá todo sobre la dieta keto", btcHistory))
      .toBe("la dieta keto");
  });

  it("no dispara informe si el mensaje no lo pide", () => {
    expect(explicitDeliverableTopic("¿cómo salió Boca?", btcHistory)).toBeNull();
    expect(explicitDeliverableTopic("hola Michi, ¿todo bien?", btcHistory)).toBeNull();
  });

  it("resuelve una referencia vacía contra el historial", () => {
    const history: KoruConversationMessage[] = [
      { role: "user", content: "quiero ver la película Dune" },
    ];
    expect(explicitDeliverableTopic("haceme un informe de esa película", history)).toBe("película Dune");
  });

  it("resuelve 'eso' aunque el historial NO incluya el input actual (off-by-one viejo)", () => {
    // El historial termina en el turno inmediatamente anterior: el viejo
    // `slice(-6, -1)` lo descartaba y resolvía a un tema aún más viejo.
    const history: KoruConversationMessage[] = [
      { role: "user", content: "estuve leyendo sobre la crisis de los tulipanes" },
      { role: "assistant", content: "Qué tema interesante." },
    ];
    const topic = explicitDeliverableTopic("haceme un informe de eso", history);
    expect(topic).toMatch(/tulipanes/i);
  });

  it("referencia vacía sin antecedente → null (no inventa un informe del texto literal)", () => {
    expect(explicitDeliverableTopic("haceme un informe de eso", [])).toBeNull();
    expect(explicitDeliverableTopic("haceme un informe de eso")).toBeNull();
  });
});

describe("runKoruBackendTurn — el informe arranca con el tema PEDIDO (turno entero)", () => {
  const config: ProviderConfig = {
    nvidiaApiKey: "fake-key",
    nvidiaBaseUrl: "https://api.nvidia.com",
    nvidiaModel: "model",
    openRouterKeys: [],
    openRouterModels: [],
  };

  beforeEach(() => {
    // Proveedor mockeado: devuelve los JSON que el pipeline espera (sub-queries
    // y síntesis). Las búsquedas web también pasan por fetch → devuelven basura
    // y el flujo cae a "0 fuentes", pero el CHUNK de trabajo ya salió emitido.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    queries: ["ia panorama", "ia historia", "ia noticias", "ia datos"],
                    sections: [],
                  }),
                },
              },
            ],
            model: "model",
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("el primer chunk de trabajo y la respuesta final hablan del tema pedido, no del anterior", async () => {
    const chunks: KoruBackendTurnResponse[] = [];
    const result = await runKoruBackendTurn(
      {
        input: "hacé un informe sobre la IA en la última semana",
        history: btcHistory,
        state: createInitialState(),
      },
      config,
      (chunk) => chunks.push(chunk),
    );

    const working = chunks.find((c) =>
      c.uiBlocks?.some((b) => b.type === "deliverable" && b.status === "working"),
    );
    const deliverable = working?.uiBlocks?.find((b) => b.type === "deliverable");
    expect(deliverable && "topic" in deliverable ? deliverable.topic : undefined)
      .toBe("la IA en la última semana");
    expect(working?.reply ?? "").toMatch(/IA en la última semana/i);
    expect(working?.reply ?? "").not.toMatch(/btc|ethereum|solana/i);

    // La respuesta final (informe entregado o pedido de aclaración) tampoco
    // puede hablar del tema viejo.
    expect(result.reply ?? "").not.toMatch(/btc|ethereum|solana/i);
  });
});

describe("isBareReference — referencia vacía vs tema con contenido", () => {
  it("detecta referencias vacías", () => {
    for (const bare of ["eso", "esto", "esa película", "ese libro", "el informe de eso", "lo mismo", "la de antes"]) {
      expect(isBareReference(bare), bare).toBe(true);
    }
  });

  it("no marca como referencia un tema con contenido propio", () => {
    for (const real of [
      "la IA en la última semana",
      "El BTC está en USD",
      "la Revolución Francesa",
      "el Mundial 2026",
      "la dieta keto",
      "Tic Tac Mich",
    ]) {
      expect(isBareReference(real), real).toBe(false);
    }
  });
});
