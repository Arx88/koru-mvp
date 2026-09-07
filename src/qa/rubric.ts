/**
 * QA Rubric — motor de calificación de calidad de Koru.
 *
 * Un SOLO motor para tres contextos:
 *   1. Unit (Vitest/jsdom): interiores Lectura + mini cards con fixtures reales.
 *   2. Showcase (Vitest): respuestas del CHAT_SCRIPT de preview-data.
 *   3. Live (scripts/qa-live.ts contra koru-mvp.onrender.com): el DOM REAL de
 *      producción se mide dentro del navegador y se califica acá.
 *
 * Califica por categoría con métricas medibles en el DOM renderizado:
 *   - Contenido (35%): palabras, datos específicos, especificidad del texto.
 *   - Funcionalidad (30%): interactivos, controles con estado, CTAs accionables.
 *   - UX/UI (35%): jerarquía, variedad visual, iconos, accesibilidad, feedback.
 *
 * Puntaje 0–100 y veredicto contra expectativas generales de usuario:
 *   superra ≥ 85 · cumple 70–84 · bajo < 70
 *
 * Flags críticos (expectativa dura de usuario):
 *   - contenido-vacio : texto insuficiente ⇒ veredicto "bajo"
 *   - sin-datos       : cero datos específicos ⇒ Contenido ≤ 45
 *   - sin-interaccion : cero elementos interactivos ⇒ overall ≤ 55
 *   - placeholder     : texto genérico/simulado detectado ⇒ overall ≤ 50
 *
 * Este archivo NO importa nada en runtime: es compatible con
 * `node --experimental-strip-types` para el pase en vivo (sin build).
 */

export type Verdict = "supera" | "cumple" | "bajo";

export interface DomMetrics {
  /** Palabras totales del texto renderizado. */
  words: number;
  /** Palabras distintas (≥3 caracteres, casefold). Medible de especificidad. */
  uniqueWords: number;
  /** Números con unidad, horas, fechas y monedas encontrados en el texto. */
  dataPoints: number;
  /** Botones, links, inputs y roles interactivos. */
  interactive: number;
  /** Interactivos con estado real (aria-pressed/expanded/checked, inputs…). */
  stateful: number;
  /** Labels de CTA accionables distintos (Ver/Guardar/Posponer…). */
  ctaLabels: number;
  /** h1–h6 y [role=heading]. */
  headings: number;
  /** svg + img (riqueza visual). */
  icons: number;
  /** Clases CSS distintas (variedad visual del interior). */
  distinctClasses: number;
  /** Atributos de accesibilidad (aria-*, role, alt, title, tabindex). */
  a11yBits: number;
  /** Elementos con estado visible (pressed/expanded/skeleton/empty/loading). */
  feedbackStates: number;
  /** Apariciones de texto genérico/simulado (lorem/placeholder/todo…). */
  placeholders: number;
}

export type Scope = "interior" | "mini" | "live-card" | "live-interior";

export type CategoryKey = "contenido" | "funcionalidad" | "uxui";

export interface CategoryScore {
  key: CategoryKey;
  score: number;
  subs: Record<string, number>;
}

export interface CardGrade {
  scope: Scope;
  type: string;
  label: string;
  metrics: DomMetrics;
  categories: CategoryScore[];
  overall: number;
  verdict: Verdict;
  flags: string[];
  weakest: string[];
}

export interface ResponseMetrics {
  replyWords: number;
  dataMentions: number;
  /** Frases de error duro (bug percibido por el usuario). */
  hardErrors: string[];
  /** Frases de vacío honesto ("no encontré…"): responden, pero no cumplen. */
  softEmpty: string[];
  blockScores: number[];
  blockTypes: string[];
}

export interface ResponseGrade {
  label: string;
  metrics: ResponseMetrics;
  score: number;
  verdict: Verdict;
  flags: string[];
}

export interface SystemSummary {
  total: number;
  byVerdict: Record<Verdict, number>;
  avgOverall: number;
  avgByCategory: Record<CategoryKey, number>;
  /** Proporción de items con veredicto ≥ "cumple". */
  passRate: number;
  systemVerdict: Verdict;
}

export const RUBRIC_VERSION = "1.0.0";
export const VERDICT_SUPERA_MIN = 85;
export const VERDICT_CUMPLE_MIN = 70;
export const CATEGORY_WEIGHTS: Record<CategoryKey, number> = {
  contenido: 0.35,
  funcionalidad: 0.3,
  uxui: 0.35,
};

/** Frases que el usuario percibe como FALLA del sistema. */
export const ERROR_PHRASES_HARD: string[] = [
  "tuve un problema",
  "tengo un problema",
  "algo salió mal",
  "error al",
  "ocurrió un error",
  "ocurrio un error",
  "inténtalo de nuevo",
  "intentalo de nuevo",
  "no se pudo",
  "no pudo completar",
];

/** Frases de vacío honesto: la respuesta existe pero no entrega valor. */
export const ERROR_PHRASES_SOFT: string[] = [
  "no conseguí",
  "no consegui",
  "no encontré",
  "no encontre",
  "no tengo datos",
  "sin resultados",
];

/**
 * Umbrales por scope, calibrados contra el CONTRATO DE DISEÑO aprobado
 * (public/lectura-visual.html — los ejemplos que el usuario aprobó):
 *   - alarma ~86 palabras de contenido real · clima ~65 · forex ~108.
 * El target default (100) exige el nivel del catálogo mediano; las cards
 * compactas POR DISEÑO (aviso/anotación, no informe) tienen el target del
 * ejemplo compacto del propio catálogo. Funcionalidad y UX/UI se exigen
 * IGUAL en ambos: es donde el usuario nota "sin funciones".
 */
export interface ScopeTargets {
  words: number;
  data: number;
  interactive: number;
  stateful: number;
  cta: number;
  headings: number;
  classes: number;
  icons: number;
  a11y: number;
  /** Mínimo absoluto de palabras antes de declarar la card vacía. */
  minWords: number;
}

export const INTERIOR_TARGETS: ScopeTargets = {
  words: 100,
  data: 8,
  interactive: 6,
  stateful: 2,
  cta: 2,
  headings: 3,
  classes: 12,
  icons: 4,
  a11y: 5,
  minWords: 25,
};

export const MINI_TARGETS: ScopeTargets = {
  words: 35,
  data: 3,
  interactive: 2,
  stateful: 1,
  cta: 1,
  headings: 1,
  classes: 5,
  icons: 2,
  a11y: 3,
  minWords: 10,
};

/**
 * Cards compactas POR DISEÑO (aviso/anotación). Basado en el catálogo:
 * la card de alarma aprobada tiene ~86 palabras, la de clima ~65. Para
 * estos tipos el umbral de contenido es el del ejemplo compacto; todo lo
 * demás se exige igual (interacción, datos, UX).
 */
const COMPACT_TYPES: ReadonlySet<string> = new Set([
  "alarm",
  "birthday_alarm",
  "health_reminder",
  "morning_brief",
  "saved_record",
  "social_interaction",
  "delivery",
  "review_document",
  "reminder",
  "smart_checklist",
]);

export function isCompactCard(type: string): boolean {
  return COMPACT_TYPES.has(type);
}

// ─────────────────────────── helpers puros ───────────────────────────

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
const lin = (value: number, target: number): number => clamp((value / target) * 100);
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function verdictOf(score: number): Verdict {
  if (score >= VERDICT_SUPERA_MIN) return "supera";
  if (score >= VERDICT_CUMPLE_MIN) return "cumple";
  return "bajo";
}

/** Especificidad: proporción de palabras distintas. Captura texto repetitivo/genérico. */
function specificity(words: number, uniqueWords: number): number {
  if (words < 30) return 80; // textos cortos: el ratio es ruido, no castigar.
  const ratio = uniqueWords / Math.max(1, words);
  return clamp((ratio / 0.62) * 100);
}

// ─────────────────────────── calificación de cards ───────────────────────────

export function scoreCard(
  scope: Scope,
  type: string,
  label: string,
  metrics: DomMetrics,
): CardGrade {
  const isInterior = scope === "interior" || scope === "live-interior";
  const base = isInterior ? INTERIOR_TARGETS : MINI_TARGETS;
  const compact = isCompactCard(type);
  const t: ScopeTargets = compact && isInterior
    ? { ...base, words: 65, data: 4, interactive: 5, stateful: 1, headings: 2 }
    : base;
  const flags: string[] = [];

  // ── Contenido ──
  const subWords = lin(metrics.words, t.words);
  const subData = lin(metrics.dataPoints, t.data);
  const subSpec = specificity(metrics.words, metrics.uniqueWords);
  let contenido = 0.45 * subWords + 0.4 * subData + 0.15 * subSpec;
  if (metrics.dataPoints === 0) {
    contenido = Math.min(contenido, 45);
    flags.push("sin-datos");
  }
  if (metrics.words < t.minWords) flags.push("contenido-vacio");

  // ── Funcionalidad ──
  const subInt = lin(metrics.interactive, t.interactive);
  const subCta = lin(metrics.ctaLabels, t.cta);
  // Minis: la card entera ES el botón (abre el interior). Los controles con
  // estado viven adentro, no en el resumen del chat: peso casi nulo y piso
  // alto para no castigar el patrón correcto de la app.
  const isMini = scope === "mini" || scope === "live-card";
  const subState = isMini
    ? metrics.stateful > 0
      ? 100
      : 60
    : lin(metrics.stateful, t.stateful);
  const funcionalidad = isMini
    ? 0.6 * subInt + 0.3 * subCta + 0.1 * subState
    : 0.5 * subInt + 0.3 * subState + 0.2 * subCta;
  if (metrics.interactive === 0) flags.push("sin-interaccion");

  // ── UX/UI ──
  const subHead = lin(metrics.headings, t.headings);
  const subVar = lin(metrics.distinctClasses, t.classes);
  const subIcons = lin(metrics.icons, t.icons);
  const subA11y = lin(metrics.a11yBits, t.a11y);
  const subFeed = metrics.feedbackStates > 0 ? 100 : 40;
  const uxui = 0.2 * subHead + 0.24 * subVar + 0.16 * subIcons + 0.24 * subA11y + 0.16 * subFeed;
  if (metrics.placeholders > 0) flags.push("placeholder");

  const categories: CategoryScore[] = [
    {
      key: "contenido",
      score: clamp(contenido),
      subs: { palabras: subWords, datos: subData, especificidad: subSpec },
    },
    {
      key: "funcionalidad",
      score: clamp(funcionalidad),
      subs: { interactivos: subInt, estado: subState, ctas: subCta },
    },
    {
      key: "uxui",
      score: clamp(uxui),
      subs: {
        jerarquia: subHead,
        variedad: subVar,
        iconos: subIcons,
        accesibilidad: subA11y,
        feedback: subFeed,
      },
    },
  ];

  let overall = clamp(
    CATEGORY_WEIGHTS.contenido * contenido +
      CATEGORY_WEIGHTS.funcionalidad * funcionalidad +
      CATEGORY_WEIGHTS.uxui * uxui,
  );

  if (flags.includes("sin-interaccion")) overall = Math.min(overall, 55);
  if (flags.includes("placeholder")) overall = Math.min(overall, 50);
  if (flags.includes("contenido-vacio")) overall = 0;

  // Sub-métricas débiles (<60) para el informe accionable.
  const weakest: string[] = [];
  for (const cat of categories) {
    for (const [name, value] of Object.entries(cat.subs)) {
      if (value < 60) weakest.push(`${cat.key}.${name}`);
    }
  }

  return {
    scope,
    type,
    label,
    metrics,
    categories,
    overall,
    verdict: verdictOf(overall),
    flags,
    weakest,
  };
}

// ─────────────────────────── calificación de respuestas ───────────────────────────

/**
 * Una respuesta de chat se califica por lo que el usuario RECIBE:
 * la card es la respuesta. El puntaje parte del promedio de las cards del
 * turno y el reply honesto con datos lo puede llevar a SUPERA. Sin cards,
 * un reply largo y sustancial puede cumplir; corto y sin cards, no.
 */
export function scoreResponse(label: string, metrics: ResponseMetrics): ResponseGrade {
  const flags: string[] = [];
  const hasBlocks = metrics.blockScores.length > 0;
  const blockAvg = hasBlocks ? avg(metrics.blockScores) : metrics.replyWords >= 40 ? 70 : 15;
  if (!hasBlocks && metrics.replyWords < 40) flags.push("sin-cards");

  const replyPart = lin(metrics.replyWords, 16);
  const dataPart = lin(metrics.dataMentions, 2);
  const honestPart = metrics.hardErrors.length ? 0 : metrics.softEmpty.length ? 55 : 100;

  if (metrics.hardErrors.length) flags.push("error-hard");
  if (metrics.softEmpty.length) flags.push("sin-resultados");
  if (hasBlocks && metrics.replyWords < 8) flags.push("reply-muda");

  // Bonus de respuesta conversada: datos + reply + honestidad.
  const bonus = (replyPart + dataPart + honestPart) / 3;
  // Sin cards: el reply ES el entregable. El umbral de sustancia
  // conversacional es 10 palabras (una respuesta hablada que cumple);
  // con datos concretos y honestidad puede llegar a SUPERA.
  const noBlockReplyPart = lin(metrics.replyWords, 10);
  let score = hasBlocks
    ? clamp(Math.max(blockAvg, blockAvg * 0.55 + bonus * 0.45))
    : clamp(0.6 * noBlockReplyPart + 0.15 * dataPart + 0.25 * honestPart);

  // El usuario percibe error = falla, sea cual sea la card.
  if (metrics.hardErrors.length) score = Math.min(score, 25);
  // Vacío honesto: no engaña, pero no cumple la expectativa.
  if (metrics.softEmpty.length) score = Math.min(score, 60);

  return { label, metrics, score, verdict: verdictOf(score), flags };
}

// ─────────────────────────── resumen de sistema ───────────────────────────

export interface ResponseSummary {
  total: number;
  byVerdict: Record<Verdict, number>;
  avg: number;
  passRate: number;
  verdict: Verdict;
}

export function summarizeResponses(grades: ResponseGrade[]): ResponseSummary {
  const byVerdict: Record<Verdict, number> = { supera: 0, cumple: 0, bajo: 0 };
  for (const g of grades) byVerdict[g.verdict]++;
  const passRate = grades.length ? (byVerdict.cumple + byVerdict.supera) / grades.length : 0;
  const mean = avg(grades.map((g) => g.score));
  const verdict: Verdict =
    passRate >= 1 && mean >= 80 ? "supera" : passRate >= 0.95 ? "cumple" : "bajo";
  return { total: grades.length, byVerdict, avg: Math.round(mean), passRate, verdict };
}

export function summarize(grades: CardGrade[]): SystemSummary {
  const byVerdict: Record<Verdict, number> = { supera: 0, cumple: 0, bajo: 0 };
  for (const g of grades) byVerdict[g.verdict]++;
  const avgOverall = Math.round(avg(grades.map((g) => g.overall)));
  const avgByCategory: Record<CategoryKey, number> = {
    contenido: Math.round(
      avg(grades.map((g) => g.categories.find((c) => c.key === "contenido")?.score ?? 0)),
    ),
    funcionalidad: Math.round(
      avg(grades.map((g) => g.categories.find((c) => c.key === "funcionalidad")?.score ?? 0)),
    ),
    uxui: Math.round(avg(grades.map((g) => g.categories.find((c) => c.key === "uxui")?.score ?? 0))),
  };
  const passRate = grades.length ? (byVerdict.cumple + byVerdict.supera) / grades.length : 0;
  // Expectativa general de usuario a nivel sistema: TODO debe cumplir (100%),
  // y para "superar" además promedio ≥ 80.
  const systemVerdict: Verdict =
    passRate >= 1 && avgOverall >= 80 ? "supera" : passRate >= 1 ? "cumple" : "bajo";
  return { total: grades.length, byVerdict, avgOverall, avgByCategory, passRate, systemVerdict };
}
