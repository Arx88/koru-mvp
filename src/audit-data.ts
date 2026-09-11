/**
 * AUDIT-DATA — mapa completo de fixtures para la auditoría del 100% de las cards.
 *
 * Fuentes (en orden de precedencia):
 * 1. CHAT_SCRIPT (preview-data.ts) — fixtures en contexto de conversación real
 * 2. fixtures.ts (lectura) — fixtures del catálogo Lectura Visual (interiores a medida)
 * 3. EXTRA_BLOCKS — fixtures a mano para tipos sin cobertura
 *
 * El harness de auditoría (audit-main.tsx) renderiza UNA card por vez vía
 * ?type=<block_type> y el script de captura itera AUDIT_LIST.
 */
import type { UiBlock } from "./domain/types";
import { CHAT_SCRIPT } from "./preview-data";
import * as F from "./ui/cards/lectura/fixtures";

type AuditEntry = { type: string; block: UiBlock; source: string };

const byType = new Map<string, AuditEntry>();

// ── 1. CHAT_SCRIPT (contexto de chat real) ─────────────────────────────────
for (const e of CHAT_SCRIPT as any[]) {
  if (e?.kind === "card" && e?.block?.type) {
    if (!byType.has(e.block.type)) {
      byType.set(e.block.type, { type: e.block.type, block: e.block as UiBlock, source: "preview-data (script de chat)" });
    }
  }
}

// ── 2. fixtures.ts (catálogo Lectura Visual) ───────────────────────────────
const lecturaFixtures: Array<{ block: UiBlock; name: string }> = [
  { block: F.weatherBlock, name: "weatherBlock" },
  { block: F.planBlock, name: "planBlock" },
  { block: F.outfitBlock, name: "outfitBlock" },
  { block: F.liveMatchBlock, name: "liveMatchBlock" },
  { block: F.newsUrgentBlock, name: "newsUrgentBlock" },
  { block: F.restaurantBlock, name: "restaurantBlock" },
  { block: F.recipeBlock, name: "recipeBlock" },
  { block: F.movieBlock, name: "movieBlock" },
  { block: F.bookBlock, name: "bookBlock" },
  { block: F.alarmBlock, name: "alarmBlock" },
  { block: F.checklistBlock, name: "checklistBlock" },
  { block: F.briefBlock, name: "briefBlock" },
  { block: F.healthBlock, name: "healthBlock" },
  { block: F.marketBlock, name: "marketBlock" },
  { block: F.cryptoBlock, name: "cryptoBlock" },
  { block: F.forexBlock, name: "forexBlock" },
  { block: F.moneyBlock, name: "moneyBlock" },
  { block: F.tickerBlock, name: "tickerBlock" },
  { block: F.routeTimelineBlock, name: "routeTimelineBlock" },
  { block: F.routeMapBlock, name: "routeMapBlock" },
  { block: F.transportBlock, name: "transportBlock" },
  { block: F.deliveryBlock, name: "deliveryBlock" },
  { block: F.bcalBlock, name: "bcalBlock" },
  { block: F.balarmBlock, name: "balarmBlock" },
  { block: F.socialBlock, name: "socialBlock" },
  { block: F.comparisonBlock, name: "comparisonBlock" },
  { block: F.productBlock, name: "productBlock" },
  { block: F.reviewScoreBlock, name: "reviewScoreBlock" },
  { block: F.travelPlanBlock, name: "travelPlanBlock" },
  { block: F.savedRecordBlock, name: "savedRecordBlock" },
  { block: F.vaultBlock, name: "vaultBlock" },
  { block: F.memoryBlock, name: "memoryBlock" },
  { block: F.researchSourcesBlock, name: "researchSourcesBlock" },
  { block: F.reviewDocumentBlock, name: "reviewDocumentBlock" },
  { block: F.resourceBundleBlock, name: "resourceBundleBlock" },
  { block: F.electionResultsBlock, name: "electionResultsBlock" },
  { block: F.electionVoteBlock, name: "electionVoteBlock" },
  { block: F.matchTimelineBlock, name: "matchTimelineBlock" },
  { block: F.matchStatsBlock, name: "matchStatsBlock" },
  { block: F.deliverableBlock, name: "deliverableBlock" },
];
for (const f of lecturaFixtures) {
  if (f.block?.type && !byType.has(f.block.type)) {
    byType.set(f.block.type, { type: f.block.type, block: f.block, source: `fixtures.ts (${f.name})` });
  }
}

// ── 3. EXTRA — tipos sin cobertura de las dos fuentes ─────────────────────
// (cobertura verificada por src/test/audit-coverage.test.ts: 56/56 tipos
// reales de UiBlock. NOTA: "article" NO es un tipo top-level — es un campo
// de research_sources.results; auditado como riesgo de robustez aparte.)

export const AUDIT_BLOCKS: AuditEntry[] = [...byType.values()];
export const AUDIT_LIST = AUDIT_BLOCKS.map((e) => e.type);
export function auditBlockFor(type: string): AuditEntry | undefined {
  return AUDIT_BLOCKS.find((e) => e.type === type);
}
