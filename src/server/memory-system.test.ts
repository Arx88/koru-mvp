/**
 * 🔴 MEMORIA END-TO-END — tests de la cadena guardar ↔ usar ↔ archivar.
 *
 * Cubre los fixes de esta iteración:
 *  1. selectRelevantMemories: devuelve id + matching normalizado (acentos,
 *     stopwords) + bonus por confirmación (CEREBRO v2, sin hardcodeo).
 *  2. systemPrompt: las memorias viajan con su ID (para archiveMemoryIds)
 *     y las reglas de archivo/semántica existen.
 *  3. buildMessages: el LLM ve TODAS las memorias activas (hasta 30), no un
 *     pre-filtro keyword de 5.
 *  4. normalizeFinalPayload: archiveMemoryIds del path principal (raw) y del
 *     extractor (extractedRaw) se fusionan.
 *  5. applyBackendTurnToState: los archiveMemoryIds marcan memorias como
 *     superseded (la contradicción se resuelve de verdad).
 *  6. La deduplicación de candidatas sigue intacta.
 */
import { describe, expect, it } from "vitest";
import type { KoruState, MemoryFact, RelevantMemory } from "../domain/types";
import { createInitialState, selectRelevantMemories } from "../domain/store";
import { systemPrompt } from "./systemPrompt";
import { buildMessages } from "./koruBackend";
import { normalizeFinalPayload } from "./pipeline/finalizePayload";
import { applyBackendTurnToState } from "../domain/turn";

function memory(partial: Partial<MemoryFact> & { id: string; text: string }): MemoryFact {
  return {
    kind: "preference",
    confidence: 0.7,
    sensitivity: "normal",
    status: "candidate",
    useForSuggestions: true,
    rootQuote: "",
    createdAt: new Date().toISOString(),
    sourceEntryId: "entry_test",
    ...partial,
  };
}

function baseState(overrides: Partial<KoruState> = {}): KoruState {
  return { ...createInitialState(), ...overrides };
}

const turnRequest = {
  input: "que calor",
  history: [],
  state: baseState(),
  model: "test",
};

describe("1 · selectRelevantMemories — recuperación híbrida", () => {
  it("devuelve el id de la memoria (antes no viajaba → no se podía archivar)", () => {
    const memories = [memory({ id: "mem_1", text: "Le encanta el sushi." })];
    const result = selectRelevantMemories(memories, "donde como sushi hoy", 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe("mem_1");
  });

  it("matchea sin importar acentos ni mayúsculas (normalización NFD)", () => {
    const memories = [memory({ id: "mem_sushi", text: "Le encanta el sushi fresco." })];
    const result = selectRelevantMemories(memories, "SUSHÍ y sashimi", 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe("mem_sushi");
  });

  it("las stopwords no generan falsos matches (que/como/para no puntúan)", () => {
    // La función RANKEA (todas las activas viajan al LLM por diseño), así que
    // el assertion correcto es de ORDEN: la memoria con overlap real va
    // primera; la que solo comparte stopwords queda última.
    const memories = [
      memory({ id: "mem_cine", text: "Le gusta ir al cine." }),
      memory({ id: "mem_cena", text: "Cena temprano los domingos." }),
    ];
    const result = selectRelevantMemories(memories, "que hago para cenar", 5);
    expect(result.length).toBe(2);
    // "cenar" ↔ "cena" (match léxico real) rankea arriba de "cine"
    expect(result[0].id).toBe("mem_cena");
  });

  it("una confirmada rankea por encima de una candidata igual de matcheada", () => {
    const memories = [
      memory({ id: "mem_cand", text: "Corre los domingos.", status: "candidate", confidence: 0.8 }),
      memory({ id: "mem_conf", text: "Corre los domingos en el parque.", status: "confirmed", confidence: 0.8 }),
    ];
    const result = selectRelevantMemories(memories, "cuando corres los domingos", 5);
    expect(result[0].id).toBe("mem_conf");
  });
});

describe("2 · systemPrompt — IDs + reglas de archivo", () => {
  it("cada memoria viaja con su id en la línea del prompt", () => {
    const relevant: RelevantMemory[] = [
      { id: "mem_abc", text: "Le encanta el sushi.", kind: "preference", confidence: 0.8 },
    ];
    const prompt = systemPrompt(new Date().toISOString(), baseState(), relevant);
    expect(prompt).toContain("mem_abc [preference] Le encanta el sushi.");
  });

  it("incluye las reglas de archivo por contradicción (archiveMemoryIds)", () => {
    const prompt = systemPrompt(new Date().toISOString(), baseState(), []);
    expect(prompt).toContain("archiveMemoryIds");
    expect(prompt).toContain("CONTRADICE");
  });

  it("instruye el vínculo semántico (que calor ↔ helado)", () => {
    const prompt = systemPrompt(new Date().toISOString(), baseState(), []);
    expect(prompt).toContain("vínculo semántico");
    expect(prompt).toContain("que calor");
  });
});

describe("3 · buildMessages — el LLM ve todas las memorias activas", () => {
  it("con 12 memorias activas, las 12 viajan en el system prompt (no solo 5)", () => {
    const memories = Array.from({ length: 12 }, (_, i) =>
      memory({ id: `mem_${i}`, text: `Dato ${i} sobre el usuario.` }),
    );
    const request = { ...turnRequest, state: baseState({ memories }) };
    const messages = buildMessages(request);
    const system = messages[0]?.content ?? "";
    const listed = (system.match(/^- mem_\d+ /gm) ?? []).length;
    expect(listed).toBe(12);
  });

  it("las memorias rechazadas/archivadas NO viajan", () => {
    const memories = [
      memory({ id: "mem_ok", text: "Le gusta el café." }),
      memory({ id: "mem_rej", text: "Le gusta el té.", status: "rejected" }),
      memory({ id: "mem_arch", text: "Vivía en Lima.", status: "superseded" }),
    ];
    const request = { ...turnRequest, state: baseState({ memories }) };
    const messages = buildMessages(request);
    const system = messages[0]?.content ?? "";
    expect(system).toContain("mem_ok");
    expect(system).not.toContain("mem_rej");
    expect(system).not.toContain("mem_arch");
  });

  it("más de 30 activas → se recorta a 30 (budget de tokens)", () => {
    const memories = Array.from({ length: 40 }, (_, i) =>
      memory({ id: `mem_${i}`, text: `Dato ${i}.` }),
    );
    const request = { ...turnRequest, state: baseState({ memories }) };
    const messages = buildMessages(request);
    const system = messages[0]?.content ?? "";
    const listed = (system.match(/^- mem_\d+ /gm) ?? []).length;
    expect(listed).toBe(30);
  });
});

describe("4 · normalizeFinalPayload — fusión de archiveMemoryIds", () => {
  it("toma los ids del raw (path principal) Y del extractor (extractedRaw)", () => {
    const response = normalizeFinalPayload(
      {
        reply: "Entendido, pastas entonces.",
        archiveMemoryIds: ["mem_from_raw"],
        uiBlocks: [],
      },
      "dejé el sushi",
      [],
      { archiveMemoryIds: ["mem_from_extractor"] },
      undefined,
      baseState(),
    );
    expect(response.archiveMemoryIds).toContain("mem_from_raw");
    expect(response.archiveMemoryIds).toContain("mem_from_extractor");
  });

  it("filtra basura (no-string, vacío) y limita a 10", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `mem_${i}`);
    const response = normalizeFinalPayload(
      { reply: "ok", archiveMemoryIds: [...ids, "", 42, null], uiBlocks: [] },
      "x",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.archiveMemoryIds?.length).toBe(10);
    expect(response.archiveMemoryIds?.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("sin archiveMemoryIds en ningún lado → array vacío (no undefined)", () => {
    const response = normalizeFinalPayload({ reply: "hola", uiBlocks: [] }, "hola", [], undefined, undefined, baseState());
    expect(response.archiveMemoryIds).toEqual([]);
  });
});

describe("5 · applyBackendTurnToState — la contradicción se resuelve", () => {
  it("archiveMemoryIds marca la memoria vieja como superseded", () => {
    const state = baseState({
      memories: [memory({ id: "mem_sushi", text: "Le encanta el sushi." })],
    });
    const result = applyBackendTurnToState(state, "dejé de comer sushi", "typed", {
      reply: "Entendido, pastas sin TACC.",
      uiBlocks: [],
      suggestedActions: [],
      understanding: { literalRequest: "dejé de comer sushi", userGoal: "actualizar preferencia", unstatedNeeds: [], assumptions: [], confidence: 0.9 },
      memoryCandidates: [
        { kind: "preference", text: "Prefiere pastas sobre sushi.", confidence: 0.85, sensitivity: "normal", status: "candidate", useForSuggestions: true },
      ],
      archiveMemoryIds: ["mem_sushi"],
      commitments: [],
      records: [],
      toolResults: [],
      stateEvents: [],
      provider: "nvidia",
      model: "test",
    });
    const sushi = result.state.memories.find((m) => m.id === "mem_sushi");
    expect(sushi?.status).toBe("superseded");
    const pasta = result.state.memories.find((m) => /pastas/i.test(m.text));
    expect(pasta?.status).toBe("candidate");
  });

  it("la deduplicación exacta sigue funcionando (no duplica la misma memoria)", () => {
    const state = baseState({
      memories: [memory({ id: "mem_1", text: "Le encanta el sushi." })],
    });
    const result = applyBackendTurnToState(state, "me encanta el sushi", "typed", {
      reply: "Ya lo tenía anotado.",
      uiBlocks: [],
      suggestedActions: [],
      understanding: { literalRequest: "x", userGoal: "x", unstatedNeeds: [], assumptions: [], confidence: 0.9 },
      memoryCandidates: [
        { kind: "preference", text: "Le encanta el sushi.", confidence: 0.9, sensitivity: "normal", status: "candidate", useForSuggestions: true },
      ],
      commitments: [],
      records: [],
      toolResults: [],
      stateEvents: [],
      provider: "nvidia",
      model: "test",
    });
    expect(result.state.memories.filter((m) => /sushi/i.test(m.text)).length).toBe(1);
  });
});
