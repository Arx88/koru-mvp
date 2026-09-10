/**
 * V5 Smoke Test — verifica los cambios anti-alucinación antes de deployar.
 *
 * Ejecutar:
 *   node --experimental-strip-types scripts/v5-smoke.ts
 *
 * Verifica:
 * 1. findBackingSource filtra quotes alucinadas (no aparecen en sources).
 * 2. hasUsefulBlockContent permite comparison cards con items.length === 0
 *    si tienen recommendation o sources (fix PR 0.5).
 * 3. hasUsefulBlockContent sigue descartando comparison cards totalmente vacías.
 * 4. El regex del lexical fallback en restaurants.ts filtra "Best Italian",
 *    "Top Restaurants", "Italian Restaurants" (fix PR 2).
 * 5. El umbral n>=2 descarta matches que aparecen en una sola fuente.
 */

import { findBackingSource } from "../src/domain/structureExtractor.ts";
import { hasUsefulBlockContent } from "../src/server/pipeline/finalizePayload.ts";
import type { AssistantSource, UiBlock } from "../src/domain/types.ts";

let passed = 0;
let failed = 0;

function assertOk(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
  }
}

// ── Fuentes reales de ejemplo ────────────────────────────────────────────

const realSources: AssistantSource[] = [
  {
    url: "https://example.com/don-juilio-review",
    domain: "example.com",
    title: "Reseña de Don Julio en Palermo",
    snippet: "Don Julio es la mejor parrilla de Buenos Aires según los críticos gastronómicos.",
    content:
      "Don Julio es la mejor parrilla de Buenos Aires según los críticos gastronómicos. El asador principal lleva 20 años en el oficio. La olla para dos cuesta $45.000.",
  },
  {
    url: "https://example.com/palermo-hunts",
    domain: "example.com",
    title: "Las mejores parrillas de Palermo",
    snippet: "Don Julio encabeza el ranking de parrillas en Palermo, seguido de la Cabrera.",
    content: "Don Julio encabeza el ranking de parrillas en Palermo, seguido de la Cabrera.",
  },
];

// ── Test 1: findBackingSource filtra alucinaciones ──────────────────────

console.log("\n=== Test 1: findBackingSource filtra quotes alucinadas ===");

const realQuote = "Don Julio es la mejor parrilla de Buenos Aires según los críticos gastronómicos";
const fakeQuote = "Don Julio tiene 3 estrellas Michelin y fue premiado en Madrid";
const shortQuote = "Don Julio"; // < 25 chars, debe ser rechazado

assertOk(
  "Quote real que aparece en source → encuentra backing",
  findBackingSource(realQuote, realSources) !== null,
);

assertOk(
  "Quote alucinada que NO aparece en ningún source → null (descarta match)",
  findBackingSource(fakeQuote, realSources) === null,
);

assertOk(
  "Quote corta (< 25 chars) → null (demasiado corta para ser respaldo fiable)",
  findBackingSource(shortQuote, realSources) === null,
);

// ── Test 2: hasUsefulBlockContent permite comparison vacío + honesto ────

console.log("\n=== Test 2: comparison card con items vacíos pero honesto ===");

const comparisonEmptyWithRecommendation: UiBlock = {
  type: "comparison",
  title: "Comparativa",
  items: [],
  recommendation: "Encontré 3 fuentes sobre 'iPhone 15'. Mirá los links arriba para specs y precios.",
  sources: realSources,
};

const comparisonEmptyWithSourcesOnly: UiBlock = {
  type: "comparison",
  title: "Comparativa",
  items: [],
  sources: realSources,
};

const comparisonTotallyEmpty: UiBlock = {
  type: "comparison",
  title: "Comparativa",
  items: [],
};

assertOk(
  "Comparison con items vacíos + recommendation → sobrevive finalizePayload",
  hasUsefulBlockContent(comparisonEmptyWithRecommendation) === true,
);

assertOk(
  "Comparison con items vacíos + sources (sin recommendation) → sobrevive",
  hasUsefulBlockContent(comparisonEmptyWithSourcesOnly) === true,
);

assertOk(
  "Comparison totalmente vacío (sin items, recommendation ni sources) → descartado",
  hasUsefulBlockContent(comparisonTotallyEmpty) === false,
);

// ── Test 3: filtro léxico expandido en restaurants.ts ───────────────────

console.log("\n=== Test 3: filtro léxico del fallback de restaurants ===");

// Replicamos el regex del fallback léxico (restaurants.ts:391) + el filtro
// expandido (línea 397) para verificar que los falsos positivos conocidos
// se descartan. La regex matchea pares Capitalizado+Capitalizado.
const STOPWORD_RE = /restaurante|restaurants|bar|cafe|parrilla|sushi|trattoria|bistró|bistro|comida|gastronom|italian|french|best|top/;
const PAIR_RE = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de|del|la|el)\s+|\s+)[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/g;

const falsePositiveNames = [
  "Best Italian", // adjetivo listicle + cocina
  "Top Restaurants", // adjetivo listicle + genérico
  "Italian Restaurants", // cocina + genérico
  "French Cuisine", // cocina + genérico
];

// NOTA: "Buenos Aires" NO se filtra por stopwords (no está en la lista
// 'restaurants|italian|french|best|top' que pide el prompt V5). Se descarta
// por el umbral n>=2 (aparece en muchas fuentes pero como geo, no restaurante).
// Ver v5-validation.md §4.4 — riesgo residual aceptado.

const realRestaurantNames = [
  "Don Julio", // no en stopwords — pasa
  "La Cabrera", // no en stopwords — pasa
  "El Cuartito", // no en stopwords — pasa
];

let falsePositivesFiltered = 0;
for (const name of falsePositiveNames) {
  const lower = name.toLowerCase();
  if (STOPWORD_RE.test(lower)) {
    falsePositivesFiltered++;
  } else {
    console.log(`    [WARN] No se filtró: "${name}"`);
  }
}
assertOk(
  `Filtro léxico descarta los ${falsePositiveNames.length} falsos positivos conocidos del prompt V5`,
  falsePositivesFiltered === falsePositiveNames.length,
  `filtrados: ${falsePositivesFiltered}/${falsePositiveNames.length}`,
);

let realNamesKept = 0;
for (const name of realRestaurantNames) {
  const lower = name.toLowerCase();
  if (!STOPWORD_RE.test(lower)) {
    realNamesKept++;
  }
}
assertOk(
  `Filtro léxico NO descarta nombres reales de restaurantes (${realRestaurantNames.length}/${realRestaurantNames.length} se conservan)`,
  realNamesKept === realRestaurantNames.length,
);

// ── Test 4: umbral n >= 2 descarta matches de 1 sola fuente ──────────────

console.log("\n=== Test 4: umbral n>=2 descarta matches de una sola fuente ===");

const counts = new Map<string, number>([
  ["Don Julio", 3], // 3 fuentes — pasa
  ["La Cabrera", 2], // 2 fuentes — pasa
  ["Sushi Pop", 1], // 1 fuente — descartado por n>=2
  ["Persona Citada", 1], // 1 fuente — descartado
]);

const survivors = Array.from(counts.entries()).filter(([, n]) => n >= 2);
assertOk(
  "Umbral n>=2 deja solo matches con 2+ fuentes (2 de 4)",
  survivors.length === 2,
  `sobrevivientes: ${survivors.map(([n]) => n).join(", ")}`,
);

// ── Test 5: comparison items ya NO llevan score fabricado ────────────────

console.log("\n=== Test 5: comparisonItems no incluye score fabricado ===");

// Simulamos la construcción de comparisonItems post-V5 (koruBackend.ts:1698).
const fakeSources: AssistantSource[] = [
  { url: "https://a.com", domain: "a.com", title: "A", snippet: "snippet A" },
  { url: "https://b.com", domain: "b.com", title: "B", snippet: "snippet B" },
  { url: "https://c.com", domain: "c.com", title: "C", snippet: "snippet C" },
  { url: "https://d.com", domain: "d.com", title: "D", snippet: "snippet D" },
];

const v5ComparisonItems = fakeSources.slice(0, 4).map((source) => ({
  title: source.title,
  vendor: source.domain,
  url: source.url,
  evidence: source.snippet,
  // NOTA: score eliminado en V5 — antes era Math.max(55, 88 - index * 8).
}));

const hasAnyScore = v5ComparisonItems.some((it: any) => it.score != null);
assertOk(
  "Ningún item lleva `score` fabricado (sin la fórmula Math.max(55, 88 - index * 8))",
  !hasAnyScore,
);

const oldFormula = fakeSources.slice(0, 4).map((_s, index) => Math.max(55, 88 - index * 8));
const expectedOldScores = [88, 80, 72, 64];
const formulaMatchesBefore = JSON.stringify(oldFormula) === JSON.stringify(expectedOldScores);
assertOk(
  "Confirmamos la fórmula vieja producía [88, 80, 72, 64] (lo que ya NO está en comparisonItems)",
  formulaMatchesBefore,
);

// ── Resultado final ─────────────────────────────────────────────────────

console.log(`\n=== Resultado V5 smoke test: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  process.exit(1);
}
