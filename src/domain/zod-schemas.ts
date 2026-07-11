/**
 * Fase 2.9 — Schemas zod para validación de respuestas del LLM.
 *
 * Reemplaza la validación manual de schemas.ts con zod (ya en dependencies).
 * Tipos + validación en un solo source of truth.
 *
 * Migración gradual: estos schemas conviven con schemas.ts legacy.
 * Las funciones nuevas usan zod; las viejas se migran cuando se toque su código.
 */
import { z } from "zod";

// ── Composer result (respuesta final del LLM) ───────────────────────
export const ComposerResultSchema = z.object({
  reply: z.string().min(1, "reply es requerido"),
  mascotState: z.string().catch("idle"),
  understanding: z.object({
    literalRequest: z.string().catch(""),
    userGoal: z.string().catch(""),
    confidence: z.number().min(0).max(1).catch(0.5),
  }).partial().optional(),
  suggestedActions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    kind: z.string(),
    requiresApproval: z.boolean().optional(),
    payload: z.record(z.unknown()).optional(),
  })).catch([]),
  memoryCandidates: z.array(z.object({
    kind: z.string(),
    text: z.string(),
    confidence: z.number().min(0).max(1).catch(0.5),
  }).passthrough()).catch([]),
  commitments: z.array(z.object({
    title: z.string(),
    dueHint: z.string().optional(),
    status: z.string().catch("open"),
  }).passthrough()).catch([]),
  records: z.array(z.record(z.unknown())).catch([]),
  uiBlocks: z.array(z.record(z.unknown())).catch([]),
}).passthrough();

export type ZodComposerResult = z.infer<typeof ComposerResultSchema>;

// ── Tool call (lo que el LLM devuelve cuando quiere ejecutar una tool) ──
export const ToolCallSchema = z.object({
  id: z.string().catch("call_unknown"),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string(),
  }),
});

export type ZodToolCall = z.infer<typeof ToolCallSchema>;

// ── Enhancement opportunity (propuesta del extractor) ───────────────
export const EnhancementOpportunitySchema = z.object({
  type: z.string(),
  confidence: z.number().min(0).max(1),
  label: z.string().optional(),
  question: z.string().optional(),
  action: z.object({
    mode: z.enum(["suggest", "ask", "auto"]),
    kind: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  }).partial().optional(),
}).passthrough();

export type ZodEnhancementOpportunity = z.infer<typeof EnhancementOpportunitySchema>;

// ── Helper: validar y parsear JSON del LLM con zod ──────────────────
export function parseJsonWithZod<T>(
  text: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "empty_response" };
  try {
    const raw = JSON.parse(trimmed);
    const result = schema.safeParse(raw);
    if (result.success) return { ok: true, value: result.data };
    return { ok: false, error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
  } catch {
    // Intentar extraer JSON de fenced code block
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced?.[1]) {
      try {
        const raw = JSON.parse(fenced[1]);
        const result = schema.safeParse(raw);
        if (result.success) return { ok: true, value: result.data };
        return { ok: false, error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
      } catch (e) {
        return { ok: false, error: `fenced_json_parse_error: ${e instanceof Error ? e.message : "unknown"}` };
      }
    }
    return { ok: false, error: "invalid_json" };
  }
}
