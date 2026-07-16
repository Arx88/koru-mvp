import { describe, it, expect } from "vitest";
import {
  weightedAdditive,
  takeTheBest,
  monteCarlo,
  computeDecision,
  sensitivityAnalysis,
  preMortem,
} from "./decisionEngine";
import { createInitialState } from "./store";
import type {
  Decision,
  DecisionFactor,
  DecisionOption,
  KoruState,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para construir options / factors / decisions
// ─────────────────────────────────────────────────────────────────────────────

function makeOption(
  id: string,
  label: string,
  factorScores: Record<string, number>,
): DecisionOption {
  return { id, label, factorScores };
}

function makeFactor(
  id: string,
  label: string,
  direction: DecisionFactor["direction"] = "higherIsBetter",
): DecisionFactor {
  return { id, label, direction };
}

function makeDecision(
  options: DecisionOption[],
  factors: DecisionFactor[],
  weights: Record<string, number>,
): Decision {
  return {
    id: "decision_test",
    question: "¿Qué opción conviene?",
    options,
    factors,
    weights,
    linkedMemoryIds: [],
    createdAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("decisionEngine — weightedAdditive", () => {
  it("normaliza scores a 0-1 con 2 options, 3 factors y pesos conocidos", () => {
    const options = [
      makeOption("A", "A", { f1: 10, f2: 5, f3: 0 }),
      makeOption("B", "B", { f1: 0, f2: 5, f3: 10 }),
    ];
    const factors = [
      makeFactor("f1", "Costo"),
      makeFactor("f2", "Calidad"),
      makeFactor("f3", "Velocidad"),
    ];
    const weights = { f1: 1, f2: 2, f3: 3 };

    const result = weightedAdditive(options, factors, weights);

    // denominator = sumWeights(6) * MAX_FACTOR_SCORE(10) = 60
    // A: 10*1 + 5*2 + 0*3 = 20 → 20/60 ≈ 0.3333
    // B: 0*1 + 5*2 + 10*3 = 40 → 40/60 ≈ 0.6667
    expect(result.A).toBeCloseTo(20 / 60, 5);
    expect(result.B).toBeCloseTo(40 / 60, 5);

    // Normalizado a 0-1
    expect(result.A).toBeGreaterThanOrEqual(0);
    expect(result.A).toBeLessThanOrEqual(1);
    expect(result.B).toBeGreaterThanOrEqual(0);
    expect(result.B).toBeLessThanOrEqual(1);
  });

  it("devuelve 0 para todos los options cuando los pesos suman 0", () => {
    const options = [
      makeOption("A", "A", { f1: 10 }),
      makeOption("B", "B", { f1: 5 }),
    ];
    const factors = [makeFactor("f1", "F1")];
    const weights = { f1: 0 };

    const result = weightedAdditive(options, factors, weights);
    expect(result.A).toBe(0);
    expect(result.B).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("decisionEngine — takeTheBest", () => {
  it("asigna 1.0 al ganador claro en el factor de mayor peso", () => {
    const options = [
      makeOption("A", "A", { top: 10, other: 0 }),
      makeOption("B", "B", { top: 5, other: 10 }),
    ];
    const factors = [
      makeFactor("top", "Factor principal"),
      makeFactor("other", "Factor secundario"),
    ];
    const weights = { top: 10, other: 1 };

    const result = takeTheBest(options, factors, weights);

    // El factor top (peso 10) decide: A tiene 10, B tiene 5 → A gana.
    expect(result.A).toBe(1.0);
    expect(result.B).toBe(0);
  });

  it("reparte el empate equitativamente cuando todos los factors empatan", () => {
    const options = [
      makeOption("A", "A", { f1: 5, f2: 5 }),
      makeOption("B", "B", { f1: 5, f2: 5 }),
      makeOption("C", "C", { f1: 5, f2: 5 }),
    ];
    const factors = [
      makeFactor("f1", "F1"),
      makeFactor("f2", "F2"),
    ];
    const weights = { f1: 1, f2: 1 };

    const result = takeTheBest(options, factors, weights);

    // Empate en todos → 1/n = 1/3 ≈ 0.3333
    expect(result.A).toBeCloseTo(1 / 3, 5);
    expect(result.B).toBeCloseTo(1 / 3, 5);
    expect(result.C).toBeCloseTo(1 / 3, 5);
  });

  it("devuelve 1/n para todos cuando no hay factors", () => {
    const options = [makeOption("A", "A", {}), makeOption("B", "B", {})];
    const factors: DecisionFactor[] = [];
    const weights: Record<string, number> = {};

    const result = takeTheBest(options, factors, weights);
    expect(result.A).toBeCloseTo(0.5, 5);
    expect(result.B).toBeCloseTo(0.5, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("decisionEngine — monteCarlo", () => {
  it("con 1000 simulaciones, las probabilidades suman ~1.0", () => {
    const options = [
      makeOption("A", "A", { f1: 10 }),
      makeOption("B", "B", { f1: 8 }),
    ];
    const factors = [makeFactor("f1", "F1")];
    const weights = { f1: 1 };

    const probabilities = monteCarlo(options, factors, weights, 1000);

    const sum = Object.values(probabilities).reduce((acc, p) => acc + p, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("con un claro favorito, su probabilidad es mayor que la del perdedor", () => {
    const options = [
      makeOption("A", "A", { f1: 10 }),
      makeOption("B", "B", { f1: 0 }),
    ];
    const factors = [makeFactor("f1", "F1")];
    const weights = { f1: 1 };

    const probabilities = monteCarlo(options, factors, weights, 1000);
    expect(probabilities.A).toBeGreaterThan(probabilities.B);
    expect(probabilities.A).toBeCloseTo(1.0, 1);
  });

  it("con 0 simulaciones devuelve 0 para cada option", () => {
    const options = [makeOption("A", "A", { f1: 1 }), makeOption("B", "B", { f1: 1 })];
    const factors = [makeFactor("f1", "F1")];
    const weights = { f1: 1 };

    const probabilities = monteCarlo(options, factors, weights, 0);
    expect(probabilities.A).toBe(0);
    expect(probabilities.B).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("decisionEngine — computeDecision", () => {
  it(" popula decision.result con scores, probabilidad, recomendación y CI", () => {
    const options = [
      makeOption("A", "A", { f1: 10, f2: 0 }),
      makeOption("B", "B", { f1: 0, f2: 10 }),
    ];
    const factors = [makeFactor("f1", "F1"), makeFactor("f2", "F2")];
    const weights = { f1: 1, f2: 1 };
    const decision = makeDecision(options, factors, weights);

    const state: KoruState = {
      ...createInitialState(),
      decisions: [decision],
    };

    const result = computeDecision(state, decision.id);

    expect(result.result).toBeDefined();
    expect(result.result?.recommendation).toBeTruthy();
    expect(result.result?.perOptionScore).toBeDefined();
    expect(result.result?.perOptionScore.A).toBeTypeOf("number");
    expect(result.result?.perOptionScore.B).toBeTypeOf("number");
    expect(result.result?.perOptionProbability).toBeDefined();
    expect(result.result?.perOptionProbability.A).toBeTypeOf("number");
    expect(result.result?.perOptionProbability.B).toBeTypeOf("number");
    expect(result.result?.confidenceInterval).toBeDefined();
    expect(result.result?.confidenceInterval?.length).toBe(2);
    const [low, high] = result.result!.confidenceInterval!;
    expect(low).toBeLessThanOrEqual(high);
  });

  it("lanza error cuando el decision no existe en el estado", () => {
    const state = createInitialState();
    expect(() => computeDecision(state, "no_existe")).toThrow(
      /decision not found/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("decisionEngine — sensitivityAnalysis", () => {
  it("detecta un flip cuando un cambio de peso cambia al ganador", () => {
    // Escenario:
    //  - Bajo los pesos originales (F2 pesado), A gana por tener F2=10.
    //  - Si multiplicamos el peso de F1 por ~11, B pasa a ganar (F1=10 pesa más).
    const options = [
      makeOption("A", "A", { F1: 0, F2: 10 }),
      makeOption("B", "B", { F1: 10, F2: 1 }),
    ];
    const factors = [
      makeFactor("F1", "Costo"),
      makeFactor("F2", "Beneficio"),
    ];
    const weights = { F1: 1, F2: 10 };
    const decision = makeDecision(options, factors, weights);

    const result = sensitivityAnalysis(decision, "F1", 1000);

    expect(result.wouldFlip).toBe(true);
    expect(result.newWinner).toBe("B");
  });

  it("no reporta flip cuando el cambio de peso no altera al ganador", () => {
    // A domina claramente en ambos factors; cambiar F1 no la destrona.
    const options = [
      makeOption("A", "A", { F1: 10, F2: 10 }),
      makeOption("B", "B", { F1: 1, F2: 1 }),
    ];
    const factors = [
      makeFactor("F1", "F1"),
      makeFactor("F2", "F2"),
    ];
    const weights = { F1: 1, F2: 1 };
    const decision = makeDecision(options, factors, weights);

    const result = sensitivityAnalysis(decision, "F1", 50);

    expect(result.wouldFlip).toBe(false);
    expect(result.newWinner).toBe("A");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("decisionEngine — preMortem", () => {
  it("devuelve 3 riesgos por option con 2 options", () => {
    const options = [
      makeOption("A", "A", { f1: 2, f2: 4, f3: 8, f4: 6 }),
      makeOption("B", "B", { f1: 9, f2: 1, f3: 3, f4: 7 }),
    ];
    const factors = [
      makeFactor("f1", "Costo"),
      makeFactor("f2", "Calidad"),
      makeFactor("f3", "Soporte"),
      makeFactor("f4", "Velocidad"),
    ];

    const result = preMortem(options, factors);

    expect(result).toHaveLength(2);
    expect(result[0].optionId).toBe("A");
    expect(result[0].risks).toHaveLength(3);
    expect(result[1].optionId).toBe("B");
    expect(result[1].risks).toHaveLength(3);

    // Cada riesgo sigue el template literal.
    for (const risk of result[0].risks) {
      expect(risk).toMatch(/^Riesgo: .* es bajo \(\d+\/10\) — podría ser un problema si .* es importante$/);
    }
  });

  it("ordena los risks por score ascendente (los más bajos primero)", () => {
    const options = [
      makeOption("A", "A", { f1: 5, f2: 2, f3: 8 }),
    ];
    const factors = [
      makeFactor("f1", "Costo"),
      makeFactor("f2", "Calidad"),
      makeFactor("f3", "Soporte"),
    ];

    const result = preMortem(options, factors);

    // Para A: scores ordenados asc → f2(2), f1(5), f3(8) → primeros 3 son esos.
    expect(result[0].risks[0]).toContain("Calidad");
    expect(result[0].risks[1]).toContain("Costo");
    expect(result[0].risks[2]).toContain("Soporte");
  });
});
