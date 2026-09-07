/**
 * QA Report — ensambla y persiste el informe de calificación.
 *
 * Escribe qa-report.json + qa-report.md cuando QA_REPORT_DIR está seteado
 * (npm run qa:grade / scripts/qa-grade.sh). En CI sin la variable, no toca
 * el filesystem: los gates son los `expect` de la suite.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CardGrade, ResponseGrade, SystemSummary, Verdict } from "./rubric";
import {
  RUBRIC_VERSION,
  summarize as summarizeCards,
  summarizeResponses,
  type ResponseSummary,
} from "./rubric";

export interface QaReport {
  generatedAt: string;
  rubricVersion: string;
  suite: string;
  cards: CardGrade[];
  responses: ResponseGrade[];
  cardSummary: SystemSummary;
  responseSummary: ResponseSummary;
}

const emojiOf = (v: Verdict): string =>
  v === "supera" ? "SUPERA" : v === "cumple" ? "CUMPLE" : "BAJO";

export function buildReport(
  suite: string,
  cards: CardGrade[],
  responses: ResponseGrade[],
): QaReport {
  return {
    generatedAt: new Date().toISOString(),
    rubricVersion: RUBRIC_VERSION,
    suite,
    cards,
    responses,
    cardSummary: summarizeCards(cards),
    responseSummary: summarizeResponses(responses),
  };
}

export function markdownReport(r: QaReport): string {
  const lines: string[] = [];
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));

  lines.push("# QA Koru — Informe de calificación de calidad");
  lines.push("");
  lines.push(`- Generado: ${r.generatedAt}`);
  lines.push(`- Rúbrica: v${r.rubricVersion} · suite: \`${r.suite}\``);
  lines.push(
    `- Escala: contenido 35% · funcionalidad 30% · UX/UI 35% → 0–100 · supera ≥ 85 · cumple 70–84 · bajo < 70`,
  );
  lines.push("");

  // ── veredicto del sistema ──
  const cs = r.cardSummary;
  lines.push("## Veredicto del sistema");
  lines.push("");
  lines.push(
    `| ámbito | total | supera | cumple | bajo | pass | promedio | veredicto |`,
  );
  lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
  const passPct = (n: number) => `${Math.round(n * 100)}%`;
  lines.push(
    `| cards | ${cs.total} | ${cs.byVerdict.supera} | ${cs.byVerdict.cumple} | ${cs.byVerdict.bajo} | ${passPct(cs.passRate)} | ${cs.avgOverall}/100 | **${emojiOf(cs.systemVerdict)}** |`,
  );
  const rs = r.responseSummary;
  lines.push(
    `| respuestas | ${rs.total} | ${rs.byVerdict.supera} | ${rs.byVerdict.cumple} | ${rs.byVerdict.bajo} | ${passPct(rs.passRate)} | ${rs.avg}/100 | **${emojiOf(rs.verdict)}** |`,
  );
  lines.push("");
  lines.push(
    `Promedio por categoría (cards): contenido **${cs.avgByCategory.contenido}** · funcionalidad **${cs.avgByCategory.funcionalidad}** · UX/UI **${cs.avgByCategory.uxui}**`,
  );
  lines.push("");

  // ── cards por scope ──
  const scopes: Array<[string, string]> = [
    ["interior", "Interiores Lectura (fullscreen)"],
    ["mini", "Mini cards en chat (KoruUnifiedCard)"],
    ["live-card", "Mini cards EN VIVO (producción)"],
    ["live-interior", "Interiores EN VIVO (producción)"],
  ];
  for (const [scope, title] of scopes) {
    const rows = r.cards.filter((c) => c.scope === scope);
    if (!rows.length) continue;
    lines.push(`## ${title} (${rows.length})`);
    lines.push("");
    lines.push(`| card | contenido | funcionalidad | ux/ui | total | veredicto | flags |`);
    lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
    for (const c of rows) {
      const cats = c.categories;
      const get = (k: string) => cats.find((x) => x.key === k)?.score ?? 0;
      lines.push(
        `| ${pad(c.label, 26)} | ${pad(String(get("contenido")), 3)} | ${pad(String(get("funcionalidad")), 3)} | ${pad(String(get("uxui")), 3)} | ${pad(String(c.overall), 3)} | ${pad(emojiOf(c.verdict), 7)} | ${c.flags.join(", ") || "—"} |`,
      );
    }
    lines.push("");
  }

  // ── respuestas ──
  if (r.responses.length) {
    lines.push(`## Respuestas de chat (${r.responses.length})`);
    lines.push("");
    lines.push(`| turno | cards | reply | score | veredicto | flags |`);
    lines.push(`| --- | --- | --- | --- | --- | --- |`);
    for (const g of r.responses) {
      lines.push(
        `| ${pad(g.label.slice(0, 34), 34)} | ${g.metrics.blockTypes.join("+") || "—"} | ${g.metrics.replyWords}p | ${g.score}/100 | ${pad(emojiOf(g.verdict), 7)} | ${g.flags.join(", ") || "—"} |`,
      );
    }
    lines.push("");
  }

  // ── más débiles ──
  const weak = [...r.cards].sort((a, b) => a.overall - b.overall).slice(0, 8);
  lines.push("## Cards más débiles (accionable)");
  lines.push("");
  for (const c of weak) {
    lines.push(
      `- **${c.label}** (${c.scope}) ${c.overall}/100 · débil en: ${c.weakest.slice(0, 4).join(", ") || "—"}${c.flags.length ? ` · flags: ${c.flags.join(", ")}` : ""}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function writeReport(dir: string, report: QaReport): string[] {
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, "qa-report.json");
  const mdPath = join(dir, "qa-report.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  writeFileSync(mdPath, markdownReport(report), "utf-8");
  return [jsonPath, mdPath];
}
