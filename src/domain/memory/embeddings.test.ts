import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  computeConfidence,
  shouldArchive,
} from "./embeddings";
import type { MemoryFact } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makeMemory(opts: {
  id?: string;
  rootQuote?: string;
  createdAt: string;
  updatedAt?: string;
}): MemoryFact {
  return {
    id: opts.id ?? "mem_test",
    kind: "preference",
    text: "texto de la memoria",
    confidence: 0.7,
    sensitivity: "normal",
    status: "confirmed",
    createdAt: opts.createdAt,
    updatedAt: opts.updatedAt,
    rootQuote: opts.rootQuote,
    sourceEntryId: "entry_test",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// cosineSimilarity
// ─────────────────────────────────────────────────────────────────────────────

describe("embeddings — cosineSimilarity", () => {
  it("vectores idénticos → 1.0", () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  it("vectores ortogonales → 0.0", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it("vectores opuestos → -1.0", () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it("vectores vacíos → 0", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("vectores de distinta longitud usa el menor largo (sin NaN)", () => {
    const a = [1, 0, 0];
    const b = [1, 0];
    // Recorta a 2 dim: dot=1, |a|=1, |b|=1 → 1.0
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence
// ─────────────────────────────────────────────────────────────────────────────

describe("embeddings — computeConfidence (base y decay)", () => {
  it("memoria explícita (con rootQuote) arranca en 0.8", () => {
    const memory = makeMemory({
      rootQuote: "Usuario dijo: me gusta el café",
      createdAt: isoFromNow(0),
    });
    expect(computeConfidence(memory)).toBeCloseTo(0.8, 5);
  });

  it("memoria inferida (sin rootQuote) arranca en 0.5", () => {
    const memory = makeMemory({
      createdAt: isoFromNow(0),
    });
    expect(computeConfidence(memory)).toBeCloseTo(0.5, 5);
  });

  it("memoria inferida de 6 meses → decae 0.12 (0.5 - 0.12 = 0.38)", () => {
    const sixMonthsAgo = isoFromNow(-6 * MS_PER_MONTH);
    const memory = makeMemory({ createdAt: sixMonthsAgo });
    const confidence = computeConfidence(memory);
    // 0.5 - 0.02*6 = 0.38
    expect(confidence).toBeCloseTo(0.38, 2);
    // Verificamos el delta exacto del decaimiento.
    expect(0.5 - confidence).toBeCloseTo(0.12, 2);
  });

  it("memoria explícita de 6 meses → decae 0.12 (0.8 - 0.12 = 0.68)", () => {
    const sixMonthsAgo = isoFromNow(-6 * MS_PER_MONTH);
    const memory = makeMemory({
      rootQuote: "dijo algo",
      createdAt: sixMonthsAgo,
    });
    const confidence = computeConfidence(memory);
    expect(confidence).toBeCloseTo(0.68, 2);
    expect(0.8 - confidence).toBeCloseTo(0.12, 2);
  });

  it("memoria reciente con updatedAt en los últimos 7 días → +0.1 refresh", () => {
    const memory = makeMemory({
      rootQuote: "dijo algo",
      createdAt: isoFromNow(-3 * MS_PER_MONTH), // 3 meses, decay = 0.06
      updatedAt: isoFromNow(-2 * MS_PER_DAY), // 2 días → refresh
    });
    // 0.8 - 0.06 + 0.1 = 0.84
    expect(computeConfidence(memory)).toBeCloseTo(0.84, 2);
  });

  it("clamp inferior a 0.1 para memorias muy antiguas", () => {
    const veryOld = isoFromNow(-100 * MS_PER_MONTH);
    const memory = makeMemory({ createdAt: veryOld });
    // 0.5 - 0.02*100 = 0.5 - 2.0 = -1.5 → clamp a 0.1
    expect(computeConfidence(memory)).toBe(0.1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shouldArchive
// ─────────────────────────────────────────────────────────────────────────────

describe("embeddings — shouldArchive", () => {
  it("memoria inferida de 30 meses → archived=true (confidence<0.3 AND age>24)", () => {
    const memory = makeMemory({
      createdAt: isoFromNow(-30 * MS_PER_MONTH),
    });
    // 0.5 - 0.6 = -0.1 → clamp 0.1 (< 0.3 ✓), age = 30 > 24 ✓
    expect(computeConfidence(memory)).toBeLessThan(0.3);
    expect(shouldArchive(memory)).toBe(true);
  });

  it("memoria inferida de 6 meses → archived=false (age<24)", () => {
    const memory = makeMemory({
      createdAt: isoFromNow(-6 * MS_PER_MONTH),
    });
    // confidence ≈ 0.38, age = 6 → no cumple age>24
    expect(shouldArchive(memory)).toBe(false);
  });

  it("memoria explícita de 6 meses → archived=false (confidence>=0.3)", () => {
    const memory = makeMemory({
      rootQuote: "algo",
      createdAt: isoFromNow(-6 * MS_PER_MONTH),
    });
    // confidence ≈ 0.68 → no cumple confidence<0.3
    expect(shouldArchive(memory)).toBe(false);
  });

  it("memoria inferida reciente → archived=false (age≈0)", () => {
    const memory = makeMemory({
      createdAt: isoFromNow(0),
    });
    // confidence ≈ 0.5, age ≈ 0
    expect(shouldArchive(memory)).toBe(false);
  });

  it("memoria explícita antigua con refresh reciente → archived=false", () => {
    // 25 meses, pero con updatedAt hoy → +0.1 refresh
    const memory = makeMemory({
      rootQuote: "algo",
      createdAt: isoFromNow(-25 * MS_PER_MONTH),
      updatedAt: isoFromNow(-MS_PER_DAY), // ayer
    });
    // 0.8 - 0.5 + 0.1 = 0.4 → not < 0.3 → false (aunque age > 24)
    expect(computeConfidence(memory)).toBeGreaterThanOrEqual(0.3);
    expect(shouldArchive(memory)).toBe(false);
  });
});
