/**
 * Registry central del ToolBox de Koru.
 *
 * Punto único de registro de las tools NUEVAS (las builtin viven en el motor
 * y se resuelven vía sus ramas if/else existentes; este toolbox solo añade).
 *
 * El motor (`koruBackend.ts`) consume:
 *   - `ALL_TOOL_DEFINITIONS` → para enviar al LLM (qué tools existen)
 *   - `TOOL_BOX` → para ejecutar tools no-builtin (cómo se corren)
 *
 * Añadir una tool nueva = crear el archivo + registrarlo aquí.
 * No se toca el motor.
 */

import type { ToolHandler, ToolDefinition } from "./types";
import { moneyTools } from "./money";
import { sportsTools } from "./sports";
import { foodTools } from "./food";
import { travelTools } from "./travel";
import { trendingTools } from "./trending";
import { peopleTools } from "./people";
import { appsTools } from "./apps";
import { docsTools } from "./docs";
import { knowledgeTools } from "./knowledge";
import { healthTools } from "./health";
import { utilsTools } from "./utils";

/** Lista maestra de todas las tools NUEVAS disponibles. */
const allHandlers: ToolHandler[] = [
  ...moneyTools,
  ...sportsTools,
  ...foodTools,
  ...travelTools,
  ...trendingTools,
  ...peopleTools,
  ...appsTools,
  ...docsTools,
  ...knowledgeTools,
  ...healthTools,
  ...utilsTools,
];

/** Mapa nombre → handler. El dispatcher de executeTool lo consulta para tools no-builtin. */
export const TOOL_BOX: Map<string, ToolHandler> = new Map(
  allHandlers.map((handler) => [handler.definition.function.name, handler]),
);

/** Definiciones que el LLM "ve" (además de las builtin del motor). */
export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = allHandlers.map((h) => h.definition);

/** Helper para registrar una tool en runtime (uso avanzado / tests). */
export function registerTool(handler: ToolHandler): void {
  TOOL_BOX.set(handler.definition.function.name, handler);
  const exists = ALL_TOOL_DEFINITIONS.find((d) => d.function.name === handler.definition.function.name);
  if (!exists) ALL_TOOL_DEFINITIONS.push(handler.definition);
}

/** Helper para inspección: lista de tools nuevas con su política. */
export function listTools(): Array<{ name: string; risk: string; requiresApproval: boolean; autoRun: boolean }> {
  return Array.from(TOOL_BOX.values()).map((h) => ({
    name: h.definition.function.name,
    risk: h.policy.risk,
    requiresApproval: h.policy.requiresApproval,
    autoRun: h.policy.autoRun,
  }));
}
