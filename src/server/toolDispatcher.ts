/**
 * Tool Dispatcher — extraído de koruBackend.ts (Task 11-PARTITION).
 *
 * Recibe el nombre + args de una tool call del LLM, enruta a la implementación
 * correspondiente (built-in o externa vía TOOL_BOX), y devuelve el resultado
 * normalizado como Record<string, unknown>.
 *
 * Sin cambios de comportamiento respecto al original. Las implementaciones
 * de cada tool (getWeather, runSearch, planFromState, etc.) siguen viviendo
 * en koruBackend.ts por ahora; este módulo solo contiene el dispatcher.
 */
import type { KoruState, UiBlock } from "../domain/types";
import type { ChatFn as ExtractorChatFn } from "../domain/structureExtractor";
import { TOOL_BOX } from "../tools/toolbox";
import { logger, dump } from "./logger";
import {
  cleanText,
  profileCityFromState,
  getWeather,
  runSearch,
  localReminderFromArgs,
  localAlarmFromArgs,
  planFromState,
  queryPersonalContextFromState,
  memoryCaptureFromArgs,
  personalCaptureFromArgs,
} from "./koruBackend";

export type ExecuteToolContext = {
  userInput: string;
  chatFn: ExtractorChatFn;
};

export type ExecuteToolResult = {
  result: Record<string, unknown>;
  deferredDataCard?: Promise<UiBlock | null>;
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: KoruState,
  extractorCtx?: ExecuteToolContext,
): Promise<ExecuteToolResult> {
  logger.info("executeTool", `Executing tool: ${name}`, { argsKeys: Object.keys(args) });
  let result: Record<string, unknown>;
  let deferredDataCard: Promise<UiBlock | null> | undefined;
  try {
    if (name === "weather") {
      // Resolver ciudad desde el perfil si el mensaje no la trae: la ciudad se
      // pregunta UNA vez en la vida, después Koru la sabe.
      const argsWithCity = cleanText(args.city) ? args : { ...args, city: profileCityFromState(state) ?? "" };
      result = await getWeather(argsWithCity) as unknown as Record<string, unknown>;
    }
    else if (name === "web_search") {
      // Task 15: si el input contiene "compara" o "vs", usar comparison_deep
      const combinedInput = String(args.__userInput ?? "") + " " + String(args.query ?? "");
      if (/compara/i.test(combinedInput) || /\b(?:vs|versus)\b/i.test(combinedInput)) {
        const handler = TOOL_BOX.get("comparison_deep");
        if (handler) {
          const runResult = await handler.run(
            { query: String(args.query ?? args.__userInput ?? "") },
            { userInput: String(args.__userInput ?? args.query ?? ""), state, chatFn: extractorCtx?.chatFn as never },
          ) as any;
          deferredDataCard = runResult?.deferredDataCard;
          result = { type: "comparison_deep", status: "ok" };
        } else {
          const searchData = await runSearch(args, false, extractorCtx);
          deferredDataCard = searchData.deferredDataCard;
          result = searchData as unknown as Record<string, unknown>;
        }
      } else {
        const searchData = await runSearch(args, false, extractorCtx);
        deferredDataCard = searchData.deferredDataCard;
        result = searchData as unknown as Record<string, unknown>;
      }
    }
    else if (name === "shopping_compare") {
      const combinedInput = String(args.__userInput ?? "") + " " + String(args.query ?? "");
      if (/compara/i.test(combinedInput) || /\b(?:vs|versus)\b/i.test(combinedInput)) {
        const handler = TOOL_BOX.get("comparison_deep");
        if (handler) {
          const runResult = await handler.run(
            { query: String(args.query ?? args.__userInput ?? ""), budget: String(args.budget ?? "") },
            { userInput: String(args.__userInput ?? args.query ?? ""), state, chatFn: extractorCtx?.chatFn as never },
          ) as any;
          deferredDataCard = runResult?.deferredDataCard;
          result = { type: "comparison_deep", status: "ok" };
        } else {
          result = await runSearch(args, true) as unknown as Record<string, unknown>;
        }
      } else {
        result = await runSearch(args, true) as unknown as Record<string, unknown>;
      }
    }
    else if (name === "route_traffic") result = await runSearch({ ...args, mode: "research", query: cleanText(args.query) || [cleanText(args.origin), cleanText(args.destination)].filter(Boolean).join(" a ") || cleanText(args.__userInput) }, false) as unknown as Record<string, unknown>;
    else if (name === "calendar_reminder") result = localReminderFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
    else if (name === "alarm") result = localAlarmFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
    else if (name === "plan_day") result = planFromState(state, args) as unknown as Record<string, unknown>;
    else if (name === "query_personal_context") result = queryPersonalContextFromState(state, args) as unknown as Record<string, unknown>;
    else if (name === "save_memory") result = memoryCaptureFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
    else if (name === "save_personal_item") result = personalCaptureFromArgs(args, cleanText(args.__userInput)) as unknown as Record<string, unknown>;
    else {
      // ── ToolBox externo (doc 09): tools nuevas viven en src/tools/ ──
      const handler = TOOL_BOX.get(name);
      if (handler) {
        const runResult = await handler.run({ ...args, __userInput: cleanText(args.__userInput) }, {
          userInput: cleanText(args.__userInput),
          state,
          chatFn: extractorCtx?.chatFn as never,
        });
        result = runResult as Record<string, unknown>;
        deferredDataCard = runResult.deferredDataCard;
      } else {
        logger.warn("executeTool", `Unknown tool: ${name}`);
        return { result: { type: "unknown", status: "failed", error: `Unknown tool ${name}` } };
      }
    }
  } catch (err: any) {
    // 🔴 FIX: si la tool crashea (HTTP error, timeout, etc), devolver status "no_data"
    // en lugar de dejar que el error se propague y cause "server-error" / "modelo no respondió".
    // El backend hará fallback a web_search automáticamente.
    logger.warn("executeTool", `Tool ${name} threw error`, { error: err?.message });
    result = { type: name, status: "no_data", error: err?.message ?? "Tool failed" };
  }
  logger.info("executeTool", `Tool ${name} result`, { result: dump(result, 500) });
  return { result, deferredDataCard };
}
