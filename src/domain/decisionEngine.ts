// Decision support engine — implements WADD, TTB, and Monte Carlo algorithms
// for multi-criteria decision analysis

import type {
  Decision,
  DecisionFactor,
  DecisionOption,
  KoruState,
} from "./types";

/**
 * Maximum value a factor score can take. Factor scores are expressed on a
 * 0-10 scale (mirrored by the pre-mortem template "({score}/10)"), so WADD
 * normalizes against this ceiling to land in the 0-1 range.
 */
const MAX_FACTOR_SCORE = 10;

/** Weight blending constants for the combined score. */
const WEIGHT_WADD = 0.4;
const WEIGHT_TTB = 0.2;
const WEIGHT_MC = 0.4;

/**
 * Weighted Additive (WADD).
 *
 * For each option compute sum(score * weight) over all factors, then divide
 * by (sum of weights × max possible score) to normalize to 0-1. Missing
 * scores and missing weights default to 0.
 */
export function weightedAdditive(
  options: DecisionOption[],
  factors: DecisionFactor[],
  weights: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  const sumWeights = factors.reduce(
    (sum, factor) => sum + (weights[factor.id] ?? 0),
    0,
  );
  const denominator = sumWeights * MAX_FACTOR_SCORE;

  for (const option of options) {
    let raw = 0;
    for (const factor of factors) {
      const score = option.factorScores[factor.id] ?? 0;
      const weight = weights[factor.id] ?? 0;
      raw += score * weight;
    }
    result[option.id] = denominator > 0 ? raw / denominator : 0;
  }

  return result;
}

/**
 * Take The Best (TTB) — lexicographic heuristic.
 *
 * Factors are evaluated in descending weight order. For each factor we look
 * only at the currently tied candidates and pick the best score (respecting
 * direction). The first factor that yields a single best option decides the
 * winner (1.0); everyone else gets 0. If every factor ties, the surviving
 * candidates share the win equally.
 */
export function takeTheBest(
  options: DecisionOption[],
  factors: DecisionFactor[],
  weights: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const option of options) result[option.id] = 0;

  if (options.length === 0) return result;

  // No factors → everyone ties equally.
  if (factors.length === 0) {
    const equal = 1 / options.length;
    for (const option of options) result[option.id] = equal;
    return result;
  }

  const sortedFactors = [...factors].sort(
    (a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0),
  );

  let candidates: DecisionOption[] = [...options];

  for (const factor of sortedFactors) {
    if (candidates.length <= 1) break;

    const scores = candidates.map((o) => o.factorScores[factor.id] ?? 0);
    const best =
      factor.direction === "higherIsBetter"
        ? Math.max(...scores)
        : Math.min(...scores);

    const winners = candidates.filter(
      (o) => (o.factorScores[factor.id] ?? 0) === best,
    );

    if (winners.length === 1) {
      result[winners[0].id] = 1.0;
      return result;
    }

    candidates = winners;
  }

  // All factors exhausted with surviving tied candidates → share equally.
  const equal = 1 / candidates.length;
  for (const option of candidates) result[option.id] = equal;
  return result;
}

type MonteCarloInternal = {
  probabilities: Record<string, number>;
  /** WADD score of the winning option in each simulation — feeds the CI. */
  winningScores: number[];
};

function runMonteCarlo(
  options: DecisionOption[],
  factors: DecisionFactor[],
  weights: Record<string, number>,
  simulations: number,
): MonteCarloInternal {
  const probabilities: Record<string, number> = {};
  const winningScores: number[] = [];
  for (const option of options) probabilities[option.id] = 0;

  if (options.length === 0 || simulations <= 0) {
    return { probabilities, winningScores };
  }

  const sumWeights = factors.reduce(
    (sum, factor) => sum + (weights[factor.id] ?? 0),
    0,
  );
  const denominator = sumWeights * MAX_FACTOR_SCORE;

  // No signal (no factors or zero weights) → spread probability uniformly.
  if (denominator <= 0) {
    const equal = 1 / options.length;
    for (const option of options) probabilities[option.id] = equal;
    return { probabilities, winningScores };
  }

  for (let i = 0; i < simulations; i += 1) {
    let bestOption: DecisionOption | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      let raw = 0;
      for (const factor of factors) {
        const score = option.factorScores[factor.id] ?? 0;
        // Uniform noise in [0.9, 1.1) → ±10% perturbation.
        const noise = 1 + (Math.random() * 0.2 - 0.1);
        const weight = weights[factor.id] ?? 0;
        raw += score * noise * weight;
      }
      const normalized = raw / denominator;
      if (normalized > bestScore) {
        bestScore = normalized;
        bestOption = option;
      }
    }

    if (bestOption) {
      probabilities[bestOption.id] += 1;
      winningScores.push(bestScore);
    }
  }

  for (const option of options) {
    probabilities[option.id] /= simulations;
  }

  return { probabilities, winningScores };
}

/**
 * Monte Carlo simulation.
 *
 * Each simulation perturbs every factor score with ±10% uniform noise,
 * recomputes WADD, and credits a win to the option with the highest score.
 * Returns each option's win probability (wins / simulations).
 */
export function monteCarlo(
  options: DecisionOption[],
  factors: DecisionFactor[],
  weights: Record<string, number>,
  simulations: number = 10000,
): Record<string, number> {
  return runMonteCarlo(options, factors, weights, simulations).probabilities;
}

/** Picks the option id with the highest combined score. */
function pickWinner(
  options: DecisionOption[],
  combined: Record<string, number>,
): string {
  if (options.length === 0) return "";
  let winner = options[0].id;
  let best = combined[winner] ?? -Infinity;
  for (const option of options) {
    const score = combined[option.id] ?? -Infinity;
    if (score > best) {
      best = score;
      winner = option.id;
    }
  }
  return winner;
}

/** Linear-interpolated percentile of a numeric array. Returns 0 if empty. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const frac = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * frac;
}

type AlgorithmRun = {
  wadd: Record<string, number>;
  ttb: Record<string, number>;
  mc: Record<string, number>;
  combined: Record<string, number>;
  winningScores: number[];
};

/** Runs WADD, TTB and Monte Carlo and blends them into a combined score map. */
function runAllAlgorithms(
  options: DecisionOption[],
  factors: DecisionFactor[],
  weights: Record<string, number>,
  simulations: number = 10000,
): AlgorithmRun {
  const wadd = weightedAdditive(options, factors, weights);
  const ttb = takeTheBest(options, factors, weights);
  const mcRun = runMonteCarlo(options, factors, weights, simulations);

  const combined: Record<string, number> = {};
  for (const option of options) {
    combined[option.id] =
      (wadd[option.id] ?? 0) * WEIGHT_WADD +
      (ttb[option.id] ?? 0) * WEIGHT_TTB +
      (mcRun.probabilities[option.id] ?? 0) * WEIGHT_MC;
  }

  return {
    wadd,
    ttb,
    mc: mcRun.probabilities,
    combined,
    winningScores: mcRun.winningScores,
  };
}

/**
 * Compute a decision stored in KoruState.
 *
 * Runs all three algorithms, blends them (WADD 0.4 + TTB 0.2 + MC 0.4),
 * writes the result back onto the decision object, and returns it.
 * The confidence interval is the 5th–95th percentile of the winning option's
 * WADD score across all Monte Carlo simulations.
 */
export function computeDecision(
  state: KoruState,
  decisionId: string,
): Decision {
  const decision = (state.decisions ?? []).find((d) => d.id === decisionId);
  if (!decision) {
    throw new Error(`computeDecision: decision not found: ${decisionId}`);
  }

  const { options, factors, weights } = decision;
  const { combined, mc, winningScores } = runAllAlgorithms(
    options,
    factors,
    weights,
  );

  const recommendation = pickWinner(options, combined);
  const low = percentile(winningScores, 5);
  const high = percentile(winningScores, 95);

  decision.result = {
    perOptionScore: combined,
    perOptionProbability: mc,
    recommendation,
    confidenceInterval: [low, high] as [number, number],
  };

  return decision;
}

/**
 * Sensitivity analysis.
 *
 * Adjusts the weight of `factorId` by `deltaPct` (e.g. +20 = +20%), recomputes
 * the combined scoring, and reports whether the recommendation would flip and
 * the new winner. The original winner is read from `decision.result` when
 * available; otherwise it is recomputed from the original weights.
 */
export function sensitivityAnalysis(
  decision: Decision,
  factorId: string,
  deltaPct: number,
): { wouldFlip: boolean; newWinner: string } {
  const originalWinner =
    decision.result?.recommendation ??
    pickWinner(
      decision.options,
      runAllAlgorithms(
        decision.options,
        decision.factors,
        decision.weights,
      ).combined,
    );

  const adjustedWeights: Record<string, number> = { ...decision.weights };
  const currentWeight = adjustedWeights[factorId] ?? 0;
  adjustedWeights[factorId] = currentWeight * (1 + deltaPct / 100);

  const { combined } = runAllAlgorithms(
    decision.options,
    decision.factors,
    adjustedWeights,
  );
  const newWinner = pickWinner(decision.options, combined);

  return {
    wouldFlip: newWinner !== originalWinner,
    newWinner,
  };
}

/**
 * Pre-mortem — for each option, surface the 3 factors where it scores lowest
 * (raw score, regardless of direction) and emit a template-based risk string.
 *
 * The template is literal (no LLM): "Riesgo: {factor.label} es bajo
 * ({score}/10) — podría ser un problema si {factor.label} es importante".
 */
export function preMortem(
  options: DecisionOption[],
  factors: DecisionFactor[],
): Array<{ optionId: string; risks: string[] }> {
  return options.map((option) => {
    const sorted = [...factors].sort((a, b) => {
      const sa = option.factorScores[a.id] ?? 0;
      const sb = option.factorScores[b.id] ?? 0;
      return sa - sb;
    });

    const lowest = sorted.slice(0, 3);
    const risks = lowest.map((factor) => {
      const score = option.factorScores[factor.id] ?? 0;
      return `Riesgo: ${factor.label} es bajo (${score}/10) — podría ser un problema si ${factor.label} es importante`;
    });

    return { optionId: option.id, risks };
  });
}
