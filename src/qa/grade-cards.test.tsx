/**
 * QA Grading — el sistema de calificación como suite ejecutable.
 *
 * GATE DE CALIDAD: ninguna card ni respuesta puede quedar por debajo de
 * "cumple" (70/100). Cada futuro cambio que empobrezca una card rompe la
 * suite con un mensaje accionable (flags + métricas + puntos débiles).
 *
 * Tres planos calificados con la MISMA rúbrica (src/qa/rubric.ts):
 *   1. Interiores Lectura (fullscreen) — 39+ casos con fixtures reales.
 *   2. Mini cards del chat (KoruUnifiedCard) — todos los tipos del
 *      CHAT_SCRIPT (55 tipos, datos reales de preview).
 *   3. Respuestas del chat — cada turno (reply + cards) contra la
 *      expectativa de usuario: cards ricas, reply sustancial, datos
 *      concretos, sin errores.
 *
 * Con QA_REPORT_DIR seteado (npm run qa:grade) escribe el informe completo
 * JSON + Markdown con el veredicto por card y el veredicto del sistema.
 */
import { afterAll, describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render } from "@testing-library/react";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { KoruProvider } from "../ui/KoruProvider";
import { lecturaInteriorFor, type LecturaInteriorProps } from "../ui/cards/lectura";
import * as FIXTURES from "../ui/cards/lectura/fixtures";
import { KoruUnifiedCard } from "../ui/cards/unified/KoruUnifiedCard";
import { CHAT_SCRIPT, type ChatEntry } from "../preview-data";
import type { UiBlock } from "../domain/types";
import { measureDom, measureText } from "./measure";
import {
  ERROR_PHRASES_HARD,
  ERROR_PHRASES_SOFT,
  scoreCard,
  scoreResponse,
  type CardGrade,
  type ResponseGrade,
} from "./rubric";
import { buildReport, writeReport } from "./report";

const noop = () => {};
const ALL_CARDS: CardGrade[] = [];
const ALL_RESPONSES: ResponseGrade[] = [];
const MINI_BY_TYPE = new Map<string, CardGrade>();

const explain = (g: { flags: string[]; weakest: string[] }) =>
  `flags=${g.flags.join(",") || "—"} · débil=${g.weakest.join(",") || "—"}`;

// ───────────────────────── casos: interiores desde fixtures ─────────────────────────

const fixtureEntries = Object.entries(FIXTURES).filter(
  ([, v]) => v != null && typeof v === "object" && typeof (v as UiBlock).type === "string",
) as Array<[string, UiBlock]>;

const interiorCases: Array<{
  name: string;
  block: UiBlock;
  Comp: ComponentType<LecturaInteriorProps<any>>;
}> = fixtureEntries
  .map(([name, block]) => {
    const Comp = lecturaInteriorFor(block);
    return Comp ? { name, block, Comp } : null;
  })
  .filter((c): c is { name: string; block: UiBlock; Comp: ComponentType<LecturaInteriorProps<any>> } =>
    Boolean(c),
  );

describe.each(interiorCases)("qa/interior: $name", ({ name, block, Comp }) => {
  it("≥ 70 — cumple expectativas generales de usuario", () => {
    render(<Comp block={block} onClose={noop} onSave={noop} onExportPdf={noop} />);
    const metrics = measureDom(document.body);
    const grade = scoreCard("interior", block.type, name, metrics);
    ALL_CARDS.push(grade);
    expect(
      grade.overall,
      `${name} [${block.type}] ${grade.overall}/100 (${grade.verdict}) · ${explain(grade)} · metrics=${JSON.stringify(metrics)}`,
    ).toBeGreaterThanOrEqual(70);
  });
});

// ───────────────────────── casos: mini cards del chat real ─────────────────────────

const blocksByType = new Map<string, UiBlock>();
for (const e of CHAT_SCRIPT) {
  if (e.kind === "card") blocksByType.set(e.block.type, e.block);
}
const miniCases = [...blocksByType.entries()].map(([type, block]) => ({ type, block }));

describe.each(miniCases)("qa/mini: $type", ({ type, block }) => {
  it("≥ 70 — cumple expectativas generales de usuario", () => {
    // Mismo árbol real del preview/chat: KoruProvider + ErrorBoundary.
    const { unmount } = render(
      <ErrorBoundary>
        <KoruProvider>
          <KoruUnifiedCard block={block} />
        </KoruProvider>
      </ErrorBoundary>,
    );
    const metrics = measureDom(document.body);
    const grade = scoreCard("mini", type, type, metrics);
    ALL_CARDS.push(grade);
    MINI_BY_TYPE.set(type, grade);
    unmount();
    expect(
      grade.overall,
      `${type} ${grade.overall}/100 (${grade.verdict}) · ${explain(grade)} · metrics=${JSON.stringify(metrics)}`,
    ).toBeGreaterThanOrEqual(70);
  });
});

// ───────────────────────── casos: respuestas del chat ─────────────────────────

interface Turn {
  label: string;
  replyText: string;
  blocks: UiBlock[];
}

function turnsOf(script: ChatEntry[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;
  for (const e of script) {
    if (e.kind === "user") {
      current = { label: e.text, replyText: "", blocks: [] };
      turns.push(current);
    } else if (e.kind === "text") {
      if (!current) {
        current = { label: "(saludo inicial)", replyText: "", blocks: [] };
        turns.push(current);
      }
      current.replyText += (current.replyText ? " " : "") + e.text;
    } else {
      if (!current) {
        current = { label: "(cards del arranque)", replyText: "", blocks: [] };
        turns.push(current);
      }
      if (e.intro) current.replyText += (current.replyText ? " " : "") + e.intro;
      current.blocks.push(e.block);
    }
  }
  return turns;
}

const turns = turnsOf(CHAT_SCRIPT);

describe.each(turns.map((t, i) => ({ ...t, i })))("qa/respuesta $i: $label", ({ i, label, replyText, blocks }) => {
  it("≥ 70 — respuesta que cumple expectativas de usuario", () => {
    const m = measureText(replyText);
    const lower = replyText.toLowerCase();
    const hardErrors = ERROR_PHRASES_HARD.filter((p) => lower.includes(p));
    const softEmpty = ERROR_PHRASES_SOFT.filter((p) => lower.includes(p));
    const blockScores = blocks
      .map((b) => MINI_BY_TYPE.get(b.type)?.overall ?? null)
      .filter((n): n is number => n != null);
    const grade = scoreResponse(label || `turno ${i}`, {
      replyWords: m.words,
      dataMentions: m.dataPoints,
      hardErrors,
      softEmpty,
      blockScores,
      blockTypes: blocks.map((b) => b.type),
    });
    ALL_RESPONSES.push(grade);
    expect(
      grade.score,
      `turno ${i} "${label}" ${grade.score}/100 (${grade.verdict}) · flags=${grade.flags.join(",") || "—"} · reply=${m.words}p/${m.dataPoints}datos · cards=${blocks.map((b) => b.type).join("+") || "—"}`,
    ).toBeGreaterThanOrEqual(70);
  });
});

// ───────────────────────── veredicto del sistema ─────────────────────────

describe("qa/sistema", () => {
  it("cobertura: ≥ 39 interiores registrados y calificados", () => {
    expect(interiorCases.length).toBeGreaterThanOrEqual(39);
    expect(ALL_CARDS.filter((g) => g.scope === "interior").length).toBe(interiorCases.length);
  });

  it("cobertura: ≥ 50 tipos de mini card calificados (catálogo completo)", () => {
    expect(miniCases.length).toBeGreaterThanOrEqual(50);
    expect(ALL_CARDS.filter((g) => g.scope === "mini").length).toBe(miniCases.length);
  });

  it("cobertura: ≥ 30 respuestas calificadas", () => {
    expect(turns.length).toBeGreaterThanOrEqual(30);
    expect(ALL_RESPONSES.length).toBe(turns.length);
  });

  it("cero contenido simulado/placeholder en cards", () => {
    const flagged = ALL_CARDS.filter((g) => g.metrics.placeholders > 0);
    expect(flagged.map((g) => `${g.scope}:${g.label}`)).toEqual([]);
  });

  it("veredicto global del sistema ≥ CUMPLE (passRate 100%)", () => {
    const bajo = ALL_CARDS.filter((g) => g.verdict === "bajo");
    expect(bajo.map((g) => `${g.scope}:${g.label} → ${g.overall}/100 ${g.flags.join(",")}`)).toEqual([]);
    const respBajo = ALL_RESPONSES.filter((g) => g.verdict === "bajo");
    expect(respBajo.map((g) => `${g.label} → ${g.score}/100 ${g.flags.join(",")}`)).toEqual([]);
  });
});

// ───────────────────────── informe persistente ─────────────────────────

afterAll(() => {
  const dir = process.env.QA_REPORT_DIR;
  if (dir && ALL_CARDS.length > 0) {
    const report = buildReport(
      "src/qa/grade-cards.test.tsx · Vitest + jsdom · fixtures y CHAT_SCRIPT reales",
      ALL_CARDS,
      ALL_RESPONSES,
    );
    const paths = writeReport(dir, report);
    const { byVerdict, avgOverall, systemVerdict } = report.cardSummary;
    console.log(
      `[qa] cards ${ALL_CARDS.length} → supera ${byVerdict.supera} · cumple ${byVerdict.cumple} · bajo ${byVerdict.bajo} · promedio ${avgOverall}/100 · sistema ${systemVerdict.toUpperCase()}`,
    );
    console.log(
      `[qa] respuestas ${ALL_RESPONSES.length} → promedio ${report.responseSummary.avg}/100 · ${report.responseSummary.verdict.toUpperCase()}`,
    );
    console.log(`[qa] informe: ${paths.join(" · ")}`);
  }
});
