/**
 * 🐱 STICKERS DE ACTITUD — tests del sistema.
 *
 * Cubre:
 *  1. normalizeStickerId: valida ids del catálogo, normaliza variantes
 *     (mayúsculas, espacios, guión bajo) y descarta ids desconocidos.
 *  2. normalizeFinalPayload: el sticker viaja en la respuesta SOLO si es
 *     válido; ids inválidos se descartan en silencio (es opcional).
 *  3. systemPrompt: el catálogo completo viaja al LLM con las reglas de
 *     frecuencia (moderación, máx 1, sin emoji duplicado).
 *  4. Los 15 webp existen en public/assets/stickers (offline-first).
 */
import { describe, expect, it } from "vitest";
import type { KoruState } from "../domain/types";
import { createInitialState } from "../domain/store";
import { systemPrompt } from "./systemPrompt";
import { normalizeFinalPayload } from "./pipeline/finalizePayload";
import { STICKER_IDS, STICKER_HINTS, isValidStickerId, normalizeStickerId, stickerSrc } from "../domain/stickers";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function baseState(overrides: Partial<KoruState> = {}): KoruState {
  return { ...createInitialState(), ...overrides };
}

describe("1 · normalizeStickerId — validación del catálogo", () => {
  it("acepta los 15 ids del catálogo", () => {
    for (const id of STICKER_IDS) {
      expect(normalizeStickerId(id)).toBe(id);
    }
  });

  it("normaliza variantes que el LLM puede emitir", () => {
    expect(normalizeStickerId("HAHAHA")).toBe("hahaha");
    expect(normalizeStickerId(" tough guy ")).toBe("tough-guy");
    expect(normalizeStickerId("good_morning")).toBe("good-morning");
    expect(normalizeStickerId("So_Happy")).toBe("so-happy");
  });

  it("descarta ids desconocidos, null, números y strings vacíos", () => {
    expect(normalizeStickerId("patada")).toBeUndefined();
    expect(normalizeStickerId("")).toBeUndefined();
    expect(normalizeStickerId(null)).toBeUndefined();
    expect(normalizeStickerId(42)).toBeUndefined();
    expect(normalizeStickerId({ id: "hi" })).toBeUndefined();
  });

  it("isValidStickerId es type-guard sobre el catálogo", () => {
    expect(isValidStickerId("hi")).toBe(true);
    expect(isValidStickerId("no-existe")).toBe(false);
  });

  it("cada id tiene hint y src resoluble", () => {
    for (const id of STICKER_IDS) {
      expect(STICKER_HINTS[id].length).toBeGreaterThan(3);
      expect(stickerSrc(id)).toBe(`/assets/stickers/${id}.webp`);
    }
  });
});

describe("2 · normalizeFinalPayload — el sticker viaja si es válido", () => {
  it("sticker válido pasa a la respuesta", () => {
    const response = normalizeFinalPayload(
      { reply: "Jajaja tremendo gol.", mascotState: "happy", sticker: "hahaha", uiBlocks: [] },
      "mirá este gol",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.sticker).toBe("hahaha");
  });

  it("sticker inválido se descarta en silencio (undefined, no error)", () => {
    const response = normalizeFinalPayload(
      { reply: "Hola!", mascotState: "happy", sticker: "patada_voladora", uiBlocks: [] },
      "hola",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.sticker).toBeUndefined();
  });

  it("sin sticker → undefined (retro-compatible con turnos viejos)", () => {
    const response = normalizeFinalPayload(
      { reply: "Madrid está a 27°.", mascotState: "happy", uiBlocks: [] },
      "clima",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.sticker).toBeUndefined();
  });

  it("normaliza variantes (Good Morning → good-morning)", () => {
    const response = normalizeFinalPayload(
      { reply: "Buen día, arranquemos.", mascotState: "happy", sticker: "Good Morning", uiBlocks: [] },
      "buen dia",
      [],
      undefined,
      undefined,
      baseState(),
    );
    expect(response.sticker).toBe("good-morning");
  });
});

describe("3 · systemPrompt — el LLM conoce los stickers y las reglas", () => {
  const prompt = systemPrompt(new Date().toISOString(), baseState(), []);

  it("lista los 15 stickers con su id", () => {
    for (const id of STICKER_IDS) {
      expect(prompt).toContain(`"${id}"`);
    }
  });

  it("incluye las reglas de moderación", () => {
    expect(prompt).toContain("STICKERS");
    expect(prompt).toContain("momentos FUERTES");
    expect(prompt).toContain("MÁXIMO 1 por reply");
    expect(prompt).toContain("NO pongas también emoji");
  });

  it("el formato de respuesta final incluye el campo sticker", () => {
    expect(prompt).toContain('"sticker":"<id opcional>"');
  });
});

describe("4 · assets — los 15 webp existen (offline-first)", () => {
  it("public/assets/stickers tiene los 15 archivos", () => {
    for (const id of STICKER_IDS) {
      const p = resolve(__dirname, "../../public/assets/stickers", `${id}.webp`);
      expect(existsSync(p)).toBe(true);
      const size = readFileSync(p).length;
      // sanity: entre 10KB y 80KB (512px q82)
      expect(size).toBeGreaterThan(10_000);
      expect(size).toBeLessThan(80_000);
    }
  });
});
