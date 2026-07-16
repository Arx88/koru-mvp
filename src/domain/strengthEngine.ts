// ============================================================================
// strengthEngine — Cálculo de 1RM (Epley), delta de fuerza y estimación de
// calorías (MET) para planes de entrenamiento. Cálculo puro, sin API.
//
//  • calculate1RM(weight, reps)     — fórmula de Epley: weight * (1 + reps/30)
//  • calculateStrengthDelta(...)    — compara 1RM del último workout vs uno
//                                      de hace 4 semanas para el mismo ejercicio
//  • estimateKcal(...)              — MET * userWeightKg * (durationMin / 60)
//                                      con tabla estática de ~50 ejercicios
// ============================================================================

import type { WorkoutLog, ExerciseSet } from "./types";

// ─── 1RM (Epley) ────────────────────────────────────────────────────────────

/**
 * Calcula el 1RM (One-Repetition Maximum) usando la fórmula de Epley:
 *   1RM = weight * (1 + reps / 30)
 *
 * Devuelve 0 si weight ≤ 0 o reps ≤ 0. Para reps = 1, devuelve el peso
 * tal cual (1 * weight = weight, que coincide con la fórmula).
 */
export function calculate1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// ─── Strength delta ────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const FOUR_WEEKS_MS = 28 * DAY_MS;
const TWO_WEEKS_PADDING_MS = 7 * DAY_MS; // ventana de aceptación alrededor de "hace 4 semanas"

export type StrengthDelta = {
  deltaPct: number;
  current1RM: number;
  previous1RM: number;
};

/**
 * Para un ejercicio por nombre, busca el 1RM del workout más reciente en
 * `currentLogs` y el 1RM del workout más cercano a 4 semanas atrás en
 * `historicalLogs`. Devuelve el delta porcentual:
 *   deltaPct = (current1RM - previous1RM) / previous1RM * 100
 *
 * Si no hay histórico o el 1RM previo es 0, deltaPct = 0.
 */
export function calculateStrengthDelta(
  currentLogs: WorkoutLog[],
  historicalLogs: WorkoutLog[],
  exerciseName: string,
): StrengthDelta {
  const current1RM = best1RMForExercise(currentLogs, exerciseName);
  const previous1RM = best1RMForExerciseAroundFourWeeksAgo(historicalLogs, exerciseName);
  let deltaPct = 0;
  if (previous1RM > 0 && current1RM > 0) {
    deltaPct = ((current1RM - previous1RM) / previous1RM) * 100;
  }
  return { deltaPct, current1RM, previous1RM };
}

/**
 * Encuentra el mejor set (mayor 1RM Epley) para un ejercicio en una lista
 * de workouts. Devuelve 0 si no hay coincidencias.
 */
function best1RMForExercise(logs: WorkoutLog[], exerciseName: string): number {
  const needle = exerciseName.trim().toLowerCase();
  let best = 0;
  for (const log of logs) {
    for (const ex of log.exercises ?? []) {
      if (!ex) continue;
      if (ex.exercise.trim().toLowerCase() !== needle) continue;
      if (typeof ex.weight !== "number" || ex.weight <= 0) continue;
      const onerm = calculate1RM(ex.weight, ex.reps);
      if (onerm > best) best = onerm;
    }
  }
  return best;
}

/**
 * Busca el 1RM de un ejercicio en workouts que ocurrieron hace ~4 semanas
 * (con una ventana de ±7 días para no perder datos por días de diferencia).
 */
function best1RMForExerciseAroundFourWeeksAgo(
  logs: WorkoutLog[],
  exerciseName: string,
): number {
  const needle = exerciseName.trim().toLowerCase();
  const now = Date.now();
  const targetMs = now - FOUR_WEEKS_MS;
  let best = 0;
  for (const log of logs) {
    const t = Date.parse(log.date);
    if (!Number.isFinite(t)) continue;
    if (Math.abs(t - targetMs) > TWO_WEEKS_PADDING_MS) continue;
    for (const ex of log.exercises ?? []) {
      if (!ex) continue;
      if (ex.exercise.trim().toLowerCase() !== needle) continue;
      if (typeof ex.weight !== "number" || ex.weight <= 0) continue;
      const onerm = calculate1RM(ex.weight, ex.reps);
      if (onerm > best) best = onerm;
    }
  }
  return best;
}

// ─── kcal estimation (MET) ─────────────────────────────────────────────────

/**
 * Tabla estática de MET (Metabolic Equivalent of Task) para ~50 ejercicios
 * comunes. Valores aproximados para entrenamiento de fuerza / cardio.
 * Fuente: Compendium of Physical Activities (adaptado).
 */
export const EXERCISE_MET: Record<string, number> = {
  // ── Fuerza / pesas (MET ≈ 3-6) ──
  sentadilla: 5,
  squat: 5,
  "peso muerto": 6,
  deadlift: 6,
  bench_press: 5,
  "press de banca": 5,
  "press militar": 5,
  "military_press": 5,
  "shoulder_press": 5,
  "press de hombros": 5,
  remos: 5,
  row: 5,
  "remo con barra": 5,
  "remo con mancuerna": 4,
  dominadas: 8,
  pullups: 8,
  "lagartijas": 8,
  flexiones: 8,
  pushups: 8,
  zancadas: 5,
  lunges: 5,
  peso: 4,
  "elevacion de piernas": 4,
  "plancha abdominal": 4,
  plank: 4,
  "prensa de piernas": 4,
  "leg_press": 4,
  curl_biceps: 3,
  "curl de biceps": 3,
  "curl martillo": 3,
  triceps: 3,
  "extension de triceps": 3,
  "copa de triceps": 3,
  "elevacion lateral": 3,
  "elevacion frontal": 3,
  "pectoral fly": 4,
  "hip thrust": 5,
  "puente de gluteos": 4,
  "abdominales": 4,
  crunches: 4,
  "elevacion de gemelos": 3,
  calves: 3,
  "rotacion de hombros": 3,
  "face pulls": 3,
  "kettlebell swing": 6,
  "kettlebell": 5,
  "battle ropes": 10,
  "box jump": 8,
  "saltos al cajon": 8,

  // ── Cardio (MET ≈ 6-12) ──
  correr: 9,
  running: 9,
  trote: 8,
  jogging: 8,
  caminar: 3,
  walking: 3,
  bicicleta: 7,
  cycling: 7,
  spinning: 8,
  eliptico: 5,
  eliptical: 5,
  "escalador": 8,
  stair_climber: 8,
  remar: 7,
  rowing: 7,
  natacion: 8,
  swimming: 8,
  saltar: 10,
  "saltar soga": 11,
  burpees: 10,
  hiit: 8,
  "mountain climbers": 8,
  "escaladores": 8,

  // ── Funcional / movilidad ──
  yoga: 3,
  pilates: 3,
  estiramiento: 2,
  stretching: 2,
  movilidad: 3,
};

/**
 * MET por defecto cuando el ejercicio no está en la tabla. Conservador:
 * equipara a entrenamiento de fuerza moderado.
 */
const DEFAULT_MET = 5;

/**
 * Normaliza un nombre de ejercicio para lookup en la tabla MET.
 *   • lowercase
 *   • sin acentos
 *   • múltiples espacios → uno solo
 *   • trim
 */
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lookup de MET para un ejercicio por nombre. Intenta match exacto primero,
 * luego match parcial (si el nombre normalizado contiene o es contenido por
 * una key de la tabla). Si no hay match, devuelve DEFAULT_MET.
 */
export function metFor(exerciseName: string): number {
  const needle = normalizeExerciseName(exerciseName);
  if (!needle) return DEFAULT_MET;
  // 1) Match exacto.
  if (EXERCISE_MET[needle] != null) return EXERCISE_MET[needle];
  // 2) Match parcial: el needle contiene una key o viceversa.
  for (const key of Object.keys(EXERCISE_MET)) {
    if (needle.includes(key) || key.includes(needle)) {
      return EXERCISE_MET[key];
    }
  }
  return DEFAULT_MET;
}

/**
 * Estima el gasto calórico de un ejercicio usando la fórmula MET:
 *   kcal = MET * userWeightKg * (durationMin / 60)
 *
 * Si no se pasa `durationMin`, se estima a partir de sets × reps × 3s por
 * rep (con un floor de 1 min). Si no se pasa `userWeightKg`, se asume 70kg.
 */
export function estimateKcal(
  exerciseName: string,
  sets: number,
  reps: number,
  weight: number,
  durationMin: number,
  userWeightKg: number,
): number {
  const met = metFor(exerciseName);
  const massKg = userWeightKg > 0 ? userWeightKg : 70;
  let minutes = durationMin;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    // Heurística: ~3s por rep, sumar 60s de descanso total entre series.
    const workSec = Math.max(1, sets) * Math.max(1, reps) * 3;
    minutes = workSec / 60 + Math.max(0, sets - 1);
  }
  const kcal = met * massKg * (minutes / 60);
  // Si weight = 0 (ejercicio sin peso como planchas), el costo MET ya está
  // capturado en la fórmula (no depende del weight levantado).
  void weight; // weight no se usa en la fórmula MET (esfuerzo relativo al usuario).
  return Math.max(0, Math.round(kcal));
}

/**
 * Estima el costo calórico total de una sesión (suma de todos sus ejercicios).
 */
export function estimateSessionKcal(
  exercises: ExerciseSet[],
  userWeightKg: number,
): number {
  let total = 0;
  for (const ex of exercises ?? []) {
    if (!ex) continue;
    const durationMin = ex.durationSec ? ex.durationSec / 60 : 0;
    const kcal = estimateKcal(
      ex.exercise,
      ex.sets ?? 0,
      ex.reps ?? 0,
      ex.weight ?? 0,
      durationMin,
      userWeightKg,
    );
    total += kcal;
  }
  return total;
}
