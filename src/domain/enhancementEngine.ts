/**
 * Enhancement Engine — Sistema nervioso determinista para gobernar oportunidades
 *
 * Este módulo NO es inteligente. NO decide frases finales. NO ejecuta acciones.
 * Su trabajo es:
 *   1. Recibir oportunidades abstractas propuestas por el Enhancement Extractor (LLM)
 *   2. Rankearlas por utilidad/contexto/riesgo/preferencias
 *   3. Aplicar policy gate determinista (permisos, boundaries, riesgo)
 *   4. Controlar ruido (máximo 1, no repetir, no redundante)
 *   5. Convertir las aprobadas en instrucciones para el Composer + acciones reales
 *
 * Determinismo bueno (seguridad/contrato):
 *   - permisos, riesgo, límites
 *   - no repetir nudges
 *   - máximo un +1
 *   - validar uiBlocks
 *   - no ejecutar acciones externas sin aprobación
 *   - no inventar fuentes
 */

import { foldAccents } from "./commitments";
import type {
  KoruState,
  UiBlock,
  ToolRisk,
} from "./types";
import type { RawOpportunity } from "./enhancementExtractor";

// ── Tipos ──────────────────────────────────────────────────────────

export type EnhancementAction =
  | { mode: "ask"; question: string; uiBlock?: UiBlock }
  | { mode: "suggest"; text: string; uiBlock?: UiBlock }
  | { mode: "auto"; text: string; uiBlock?: UiBlock }
  | { mode: "defer"; reason: string };

export type EnhancementCandidate = {
  id: string;
  title: string;
  rationale: string;
  userValue: "low" | "medium" | "high";
  confidence: number;
  risk: ToolRisk;
  action: EnhancementAction;
  evidence: Array<{
    source: "input" | "intent" | "record" | "memory" | "calendar" | "tool_result" | "history";
    detail: string;
  }>;
};

// ── Ranking determinista ───────────────────────────────────────────

export function scoreCandidate(candidate: EnhancementCandidate, state: KoruState): number {
  const valueMap = { low: 0.6, medium: 1.0, high: 1.4 };
  const value = valueMap[candidate.userValue];
  const confidence = candidate.confidence;

  const riskPenalty: Record<ToolRisk, number> = {
    readonly: 0,
    local_write: 0.3,
    external_side_effect: 0.8,
    financial: 1.2,
    destructive: 2.0,
  };

  const intrusionMap: Record<EnhancementAction["mode"], number> = {
    ask: 0.4,
    suggest: 0.2,
    auto: 0.0,
    defer: 0.0,
  };

  let base = value + confidence - riskPenalty[candidate.risk] - intrusionMap[candidate.action.mode];

  // Ajustar por historial de aprendizaje
  const pref = state.learningPreferences.find((p) => p.type === candidate.title);
  if (pref) {
    const total = pref.acceptedCount + pref.rejectedCount;
    if (total >= 2) {
      const ratio = pref.acceptedCount / total;
      if (ratio >= 0.75) {
        base += 0.5; // Usuario acepta mucho este tipo
      } else if (ratio <= 0.25) {
        base -= 1.0; // Usuario rechaza mucho este tipo
      } else if (pref.rejectedCount >= 3 && pref.acceptedCount === 0) {
        base -= 2.0; // Nunca aceptó, penalizar fuerte
      }
    }
  }

  return base;
}

export function rankEnhancements(candidates: EnhancementCandidate[], state: KoruState): EnhancementCandidate[] {
  return [...candidates]
    .map((c) => ({ ...c, _score: scoreCandidate(c, state) }))
    .sort((a, b) => b._score - a._score)
    .map((c) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _score, ...rest } = c;
      return rest;
    });
}

// ── Control de ruido determinista ──────────────────────────────────

export function filterEnhancements(
  candidates: EnhancementCandidate[],
  state: KoruState,
  maxVisible = 1,
): EnhancementCandidate[] {
  const ranked = rankEnhancements(candidates, state);
  const kept: EnhancementCandidate[] = [];

  for (const candidate of ranked) {
    if (kept.length >= maxVisible) break;

    // Score mínimo
    if (scoreCandidate(candidate, state) < 1.5) continue;

    // No duplicar tipo de acción
    if (kept.some((k) => k.title === candidate.title)) continue;

    // Si el usuario ya rechazó este tipo de boundary, respetar
    const rejectedBoundaries = state.memories.filter(
      (m) => m.kind === "boundary" && m.status === "confirmed",
    );
    if (rejectedBoundaries.some((b) => foldAccents(b.text).includes(foldAccents(candidate.title)))) continue;

    // Fase 1.13 (auditoría A15): umbral era 2, demasiado reactivo — 2 turnos
    // puramente conversacionales bloqueaban TODOS los ask mode. Subir a 4
    // para requerir un patrón claro de "el usuario no está aceptando nada"
    // antes de silenciar enhancements. DailyEntry no expone si el enhancement
    // fue propuesto vs aceptado, así que solo subimos el umbral.
    const recentIgnored = state.entries
      .slice(0, 10)
      .filter((e) => e.actionIds.length === 0 && e.memoryIds.length === 0)
      .length;
    if (recentIgnored >= 4 && candidate.action.mode === "ask") continue;

    kept.push(candidate);
  }

  return kept;
}

// ── Conversión: RawOpportunity → EnhancementCandidate ──────────────

export function opportunityToCandidate(opportunity: RawOpportunity, index: number): EnhancementCandidate {
  const id = `enh_${index}_${Math.random().toString(36).slice(2, 6)}`;

  // El LLM ya pensó la pregunta contextualizada. El Engine solo la gobierna.
  // NO mapeamos tipos a acciones deterministas. Usamos la pregunta del LLM tal cual.
  // CRÍTICO: readonly sin uiBlock real es solo texto. No decimos "hecho" si no hicimos nada.
  let action: EnhancementAction;
  if (!opportunity.contextualQuestion || opportunity.contextualQuestion.trim().length < 10) {
    action = { mode: "defer", reason: "El LLM no generó una pregunta contextualizada específica." };
  } else if (opportunity.risk === "readonly" && !opportunity.metadata?.uiBlock) {
    // readonly sin acción real: sugerir, no auto-ejecutar
    action = { mode: "suggest", text: opportunity.contextualQuestion };
  } else if (opportunity.risk === "readonly") {
    action = { mode: "auto", text: opportunity.contextualQuestion };
  } else if (opportunity.requiresApproval) {
    action = { mode: "ask", question: opportunity.contextualQuestion };
  } else {
    action = { mode: "suggest", text: opportunity.contextualQuestion };
  }

  // Determinar userValue basado en confianza y riesgo (no en tipo)
  let userValue: EnhancementCandidate["userValue"];
  if (opportunity.confidence >= 0.85 && opportunity.risk === "readonly") {
    userValue = "high";
  } else if (opportunity.confidence >= 0.75) {
    userValue = "high";
  } else if (opportunity.confidence >= 0.7) {
    userValue = "medium";
  } else {
    userValue = "low";
  }

  return {
    id,
    title: opportunity.type,
    rationale: opportunity.rationale,
    userValue,
    confidence: opportunity.confidence,
    risk: opportunity.risk,
    action,
    evidence: [
      { source: "input", detail: `Oportunidad detectada por LLM: ${opportunity.type}` },
    ],
  };
}

// ── Motor principal determinista ───────────────────────────────────

export function generateEnhancements(
  opportunities: RawOpportunity[],
  state: KoruState,
): EnhancementCandidate[] {
  const candidates = opportunities
    .map((o, i) => opportunityToCandidate(o, i))
    .filter((c) => c.confidence >= 0.65 && c.action.mode !== "defer");

  return filterEnhancements(candidates, state, 1);
}

// ── Prompt para Composer ───────────────────────────────────────────

export function enhancementPrompt(candidates: EnhancementCandidate[]): string {
  if (!candidates.length) return "";

  const lines = candidates.map((c) => {
    if (c.action.mode === "ask") {
      return `- Después de cumplir el pedido principal, preguntá: "${c.action.question}" (razón: ${c.rationale})`;
    }
    if (c.action.mode === "suggest") {
      return `- Después de cumplir, sugerí: "${c.action.text}" (razón: ${c.rationale})`;
    }
    if (c.action.mode === "auto") {
      return `- Después de cumplir, hacelo directo: "${c.action.text}" (razón: ${c.rationale})`;
    }
    return "";
  });

  return [
    "Instrucción de valor adicional (+1): después de responder el pedido principal, agregá UN SOLO extra contextual que sea útil.",
    ...lines,
    "Reglas del +1: no hagas preguntas antes de cumplir el pedido principal. El extra viene DESPUÉS. Si no aplica, no lo menciones.",
  ].join("\n");
}
