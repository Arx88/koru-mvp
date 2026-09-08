/**
 * 🔴 FIX INDICADOR ÚNICO (2026-09-09) — test de regresión.
 *
 * Queja del usuario: "hay múltiples mensajes de PROCESANDO en simultáneo".
 * En vivo se veían: TypingDots "Procesando…" + footer hint "Pensando…" al
 * mismo tiempo (actividades quick), y "Procesando…" + WorkingPanel
 * "Sumergiéndome en tu búsqueda…" + "Buscando..." (actividades deep).
 *
 * Regla nueva: EXACTAMENTE UN indicador visible en cada momento:
 *   - Sin actividad (recién enviado) → TypingDots "Procesando…".
 *   - Actividad quick → TypingDots con el label rotativo de la actividad
 *     (el footer hint se eliminó — era el duplicado).
 *   - Actividad deep / deliverable working → WorkingPanel (TypingDots oculto).
 *   - Turno streamteando → el propio turno comunica; TypingDots oculto.
 */
import { describe, expect, it } from "vitest";
import type { AgentActivity } from "../domain/agentKernel";

type DotsContext = {
  processing: boolean;
  isListening: boolean;
  workingDeliverable: unknown;
  hasStreamingKoruTurn: boolean;
  activity: AgentActivity | null;
};

/** Misma condición que el bloque TypingDots de TalkOverlay. */
function showTypingDots(ctx: DotsContext): boolean {
  return ctx.processing && !ctx.isListening && !ctx.workingDeliverable
    && !ctx.hasStreamingKoruTurn && ctx.activity?.depth !== "deep";
}

/** Misma condición que el panel WorkingPanel de TalkOverlay. */
function showWorkingPanel(ctx: DotsContext): boolean {
  return ctx.processing && !ctx.isListening
    && (Boolean(ctx.workingDeliverable) || ctx.activity?.depth === "deep");
}

const quickActivity: AgentActivity = { kind: "thinking", label: "Pensando esto…", depth: "quick" };
const deepActivity: AgentActivity = { kind: "searching", label: "Buscando información…", depth: "deep" };

describe("indicador único: TypingDots vs WorkingPanel vs footer", () => {
  it("recién enviado (sin actividad) → solo TypingDots 'Procesando…'", () => {
    const ctx = { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: null };
    expect(showTypingDots(ctx)).toBe(true);
    expect(showWorkingPanel(ctx)).toBe(false);
  });

  it("actividad quick → TypingDots con label rotativo, SIN WorkingPanel (el hint del footer se eliminó)", () => {
    const ctx = { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: quickActivity };
    expect(showTypingDots(ctx)).toBe(true);
    expect(showWorkingPanel(ctx)).toBe(false);
  });

  it("actividad deep (búsqueda) → WorkingPanel SOLITO, TypingDots oculto (fin de 'Procesando…' + 'Sumergiéndome…')", () => {
    const ctx = { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: deepActivity };
    expect(showTypingDots(ctx)).toBe(false);
    expect(showWorkingPanel(ctx)).toBe(true);
  });

  it("deliverable working → WorkingPanel, TypingDots oculto", () => {
    const ctx = { processing: true, isListening: false, workingDeliverable: { kicker: "Tu búsqueda", progress: 15 }, hasStreamingKoruTurn: false, activity: deepActivity };
    expect(showTypingDots(ctx)).toBe(false);
    expect(showWorkingPanel(ctx)).toBe(true);
  });

  it("turno streamteando → el turno comunica, sin dots ni panel", () => {
    const ctx = { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: true, activity: quickActivity };
    expect(showTypingDots(ctx)).toBe(false);
  });

  it("invariant: nunca hay dots Y panel a la vez (los dos indicadores simultáneos)", () => {
    const states: DotsContext[] = [
      { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: null },
      { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: quickActivity },
      { processing: true, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: deepActivity },
      { processing: true, isListening: false, workingDeliverable: { kicker: "x" }, hasStreamingKoruTurn: false, activity: deepActivity },
      { processing: true, isListening: false, workingDeliverable: { kicker: "x" }, hasStreamingKoruTurn: true, activity: null },
      { processing: false, isListening: false, workingDeliverable: null, hasStreamingKoruTurn: false, activity: null },
    ];
    for (const ctx of states) {
      expect(showTypingDots(ctx) && showWorkingPanel(ctx)).toBe(false);
    }
  });
});
