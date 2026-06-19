/**
 * Pipeline Think → Act → Enrich → Learn
 *
 * Representa explícitamente las etapas de procesamiento de un turno conversacional.
 * Cada etapa recibe el output de la anterior, nunca un dump de estado crudo.
 */

import type { Commitment, LifeRecord, MemoryFact, UiBlock } from "./types";

export type KoruOperation =
  | "capture"      // guardar datos personales (link, gasto, idea, comida)
  | "query"        // consultar lo que ya guardó
  | "update"       // modificar algo existente
  | "execute"      // disparar una tool externa (clima, búsqueda)
  | "research"     // investigar sin guardar nada todavía
  | "advise"       // dar consejo basado en contexto propio
  | "chat";        // puramente conversacional (saludo, emoción, chitchat)

export interface KoruPerception {
  operation: KoruOperation;
  intent: string;            // e.g. "guardar link de IA"
  entities: Array<{ type: string; value: string; normalized: string }>;
  userGoal: string;
  unstatedNeeds: string[];
  assumptions: string[];
  confidence: number;
  isConversational: boolean; // true → puede saltear el Router LLM
}

export interface KoruPlan {
  needsTool: boolean;
  tools: Array<{ tool: string; args: Record<string, unknown>; reason: string }>;
  missingContext: Array<{ slot: string; question: string }>;
}

export interface KoruActResult {
  toolExecutions: Array<{
    id: string;
    tool: string;
    result: Record<string, unknown>;
  }>;
  stateMutations: {
    records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
    commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  };
}

export interface KoruEnrichment {
  reply: string;
  uiBlocks: UiBlock[];
  mascotState: string;
  suggestedActions: Array<{
    id: string;
    label: string;
    kind: string;
    requiresApproval: boolean;
    payload?: Record<string, unknown>;
  }>;
  skippedBecauseBoundary: string[]; // qué se omitió porque el usuario lo prohibió
}

export interface KoruLearning {
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
  commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  behaviorNotes: string[]; // notas sobre cómo se comportó el usuario este turno
}

export interface KoruPipeline {
  perception: KoruPerception;
  plan: KoruPlan;
  act: KoruActResult;
  enrichment: KoruEnrichment;
  learning: KoruLearning;
}

export type PipelineStage = "perceive" | "plan" | "act" | "enrich" | "learn";

/**
 * Determina si un input es puramente conversacional.
 * Si lo es, se puede saltear el Router y llamar directamente al Composer,
 * ahorrando una llamada LLM.
 */
export function isConversationalTurn(input: string): boolean {
  const clean = input.trim().toLowerCase().replace(/[¿¡.,;:!?]/g, "").replace(/\s+/g, " ");
  const conversationalPatterns = [
    /^hola$/,
    /^buen(?:os|as) (?:dias?|tardes?|noches?)$/,
    /^como (?:estas?|andas?|va|te va)$/,
    /^todo bien$/,
    /^que tal$/,
    /^gracias$/,
    /^ok$/,
    /^dale$/,
    /^adios$/,
    /^nos vemos$/,
    /^te (?:extrañe|extranie|extrano)$/,
    /^me siento (?:bien|mal|regular|cansado|feliz|triste)$/,
    /^hoy estoy (?:bien|mal|regular)$/,
  ];
  if (conversationalPatterns.some((pattern) => pattern.test(clean))) return true;

  // Frases muy cortas (<4 palabras) sin verbos de acción fuertes
  const actionVerbRoots = [
    "guarda", "guardar", "anota", "anotar", "recorda", "recordar",
    "busca", "buscar", "investiga", "investigar", "compra", "comprar",
    "compara", "comparar", "agenda", "agendar", "programa", "programar",
    "resumen", "total", "cuanto", "cuenta",
  ];
  const words = clean.split(/\s+/).filter(Boolean);
  const hasActionVerb = words.some((word) => {
    const w = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return actionVerbRoots.some((root) => w === root || w.startsWith(root));
  });
  if (words.length <= 3 && !hasActionVerb) return true;

  return false;
}

/**
 * Determina si un turno requiere tool externa (clima, web, tráfico).
 * Si no, puede saltear el Router LLM o hacer una sola llamada.
 */
export function needsExternalTool(perception: KoruPerception): boolean {
  if (perception.operation === "execute") return true;
  if (perception.operation === "research") return true;
  if (perception.intent.includes("clima")) return true;
  if (perception.intent.includes("trafico")) return true;
  if (perception.intent.includes("precio")) return true;
  return false;
}
