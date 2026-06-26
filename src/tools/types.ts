import type { KoruState, UiBlock, AssistantSource } from "../../domain/types";

/**
 * Contrato del ToolBox de Koru.
 *
 * Cada tool implementa este contrato. Las tools viven aisladas en `src/tools/`
 * y se registran centralmente en `toolbox.ts`. El motor de Koru (`koruBackend.ts`)
 * consume estas tools vía los 2 puntos quirúrgicos definidos en el doc 09:
 *   - TOOL_DEFINITIONS (lo que el LLM "ve")
 *   - executeTool dispatcher (lo que ejecuta la tool elegida)
 *
 * El motor (`runKoruBackendTurn`, `callProvider`, fallbacks, streaming, Semantic
 * Router, composición de respuesta) queda intacto: este contrato está diseñado
 * para que el dispatcher solo necesite un lookup `Map<string, ToolHandler>`.
 */

/** Contexto de ejecución que recibe cada tool. */
export type ToolRunContext = {
  /** Texto original del usuario (para capturas, sanity, etc.). */
  userInput: string;
  /** Estado actual de Koru (memorias, records, commitments). */
  state: KoruState;
  /** Señal de cancelación si el usuario cierra el chat mientras corre la tool. */
  signal?: AbortSignal;
  /** Callback opcional para emitir notas de progreso durante tools largas. */
  onProgress?: (note: string) => void;
  /**
   * Función de chat para llamar a un LLM local (Ollama) cuando la tool lo necesite
   * (summarize, translate, NER, etc.). Si no hay Ollama disponible, es undefined.
   * El contrato del callback sigue el de `structureExtractor.ChatFn`.
   */
  chatFn?: (messages: { role: string; content: string }[], opts: { temperature: number; maxTokens: number }) => Promise<{ content: string }>;
};

/** Resultado que devuelve una tool. Es un objeto plano que el motor envuelve. */
export type ToolRunResult = Record<string, unknown> & {
  /**
   * Para tools que leen la web con datos extraídos: promesa diferida de un
   * `data_card` validado anti-alucinación. El motor la resuelve en paralelo
   * con la composición del reply. Reutiliza `structureExtractor`.
   */
  deferredDataCard?: Promise<UiBlock | null>;
  /** Fuentes respaldatorias (para anti-alucinación y trazabilidad). */
  sources?: AssistantSource[];
};

/** Política de seguridad. Sigue el sistema de `toolRegistry.ts`. */
export type ToolPolicy = {
  /** Nivel de riesgo. */
  risk: "readonly" | "local_write" | "external_side_effect" | "financial" | "destructive";
  /** Si requiere aprobación explícita del usuario antes de ejecutarse. */
  requiresApproval: boolean;
  /** Si puede ejecutarse automáticamente (sin intervención). */
  autoRun: boolean;
  /** Razón legible de la política (se muestra en auditoría). */
  reason: string;
};

/** Definición OpenAI-function-style que se envía al LLM. */
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
};

/** Contrato que toda tool del ToolBox implementa. */
export interface ToolHandler {
  /** Esquema que ve el LLM (en español, con variantes léxicas en la descripción). */
  definition: ToolDefinition;
  /** Política de seguridad aplicable. */
  policy: ToolPolicy;
  /** Ejecuta la tool dados los argumentos parseados por el LLM. */
  run(args: Record<string, unknown>, ctx: ToolRunContext): Promise<ToolRunResult>;
}

/** Helpers para construir definiciones de forma concisa. */
export function defineTool(
  name: string,
  description: string,
  parameters: object,
): ToolDefinition {
  return { type: "function", function: { name, description, parameters } };
}

/** Helper para políticas comunes. */
export const policies = {
  /** Solo lee datos externos/públicos. Ej: weather, wikipedia. */
  readonly: (reason: string): ToolPolicy => ({ risk: "readonly", requiresApproval: false, autoRun: true, reason }),
  /** Modifica datos locales del usuario. Ej: save_memory, create_task. */
  localWrite: (reason: string, opts: { requiresApproval?: boolean } = {}): ToolPolicy => ({
    risk: "local_write",
    requiresApproval: opts.requiresApproval ?? true,
    autoRun: opts.requiresApproval === false,
    reason,
  }),
  /** Efecto externo reversible. Ej: web_search (gasta cuota), open_url. */
  externalSideEffect: (reason: string, opts: { requiresApproval?: boolean; autoRun?: boolean } = {}): ToolPolicy => ({
    risk: "external_side_effect",
    requiresApproval: opts.requiresApproval ?? true,
    autoRun: opts.autoRun ?? false,
    reason,
  }),
  /** Alto riesgo: borra/sobrescribe. Ej: file_write, shell_run. */
  destructive: (reason: string): ToolPolicy => ({ risk: "destructive", requiresApproval: true, autoRun: false, reason }),
} as const;
