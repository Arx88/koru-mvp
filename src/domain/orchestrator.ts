import { buildActionProposalsLocal } from "./actions";
import { foldAccents } from "./commitments";
import { dueAtFromText, dueLabel } from "./time";
import { runFreeLlmChat, runOpenModelChat } from "./freellmapi";
import { extractShoppingItems } from "./intent";
import { rememberedLocation } from "./agentKernel";
import {
  parseJsonObjectStrict,
  validateComposerResult,
  validateRouterResult,
  type Validation,
} from "./schemas";
import {
  actionKindForUiBlock,
  approvalRequiredForUiBlock,
  executeRegisteredToolCall,
  pendingBlocksForToolCalls,
  splitToolCallsByPolicy,
  uiBlocksFromToolResults,
} from "./toolRegistry";
import type {
  AssistantActionPayload,
  BrainProvider,
  KoruTurnResult,
  KoruConversationMessage,
  KoruState,
  MemoryFact,
  RouterResult,
  SemanticIntent,
  ToolCall,
  ToolResult,
  UiBlock,
} from "./types";

type RouteDecision = RouterResult;

export type OrchestratedTurn = KoruTurnResult;

function sentenceCase(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function routePrompt(state: KoruState, activeMemories: MemoryFact[]) {
  const memories = activeMemories.length
    ? activeMemories.map((memory) => `- ${memory.text}`).join("\n")
    : "- ninguna memoria activa relevante";
  const commitments = state.commitments
    .filter((item) => item.status === "open")
    .slice(0, 10)
    .map((item) => `- ${item.title} (${item.dueHint})`)
    .join("\n") || "- ninguno";
  const records = state.records
    .slice(0, 12)
    .map((item) => `- ${item.domain}/${item.kind}: ${item.value ?? item.title}`)
    .join("\n") || "- ninguno";
  return [
    "Eres el router semantico de Koru. No eres la respuesta final salvo que NO hagan falta herramientas.",
    "Devuelve SOLO JSON valido. No markdown.",
    "Objetivo: entender significado, continuidad e intencion. No dependas de palabras exactas.",
    "Si falta un dato minimo, usa missingContext y un ui block clarifying_question.",
    "Si hacen falta datos reales, pide toolCalls y NO inventes reply final.",
    "Herramientas disponibles: weather, web_search, deep_research, shopping_compare, route_traffic, calendar_reminder, alarm, money_summary, memory_recall.",
    "UI blocks disponibles: clarifying_question, weather, alarm, reminder, shopping_list, plan, comparison, research_sources, money_summary, saved_record.",
    "Alarmas y recordatorios son acciones locales que requieren confirmacion; clasificalas claramente como alarm/reminder, no como compras.",
    "Una lista de compras solo se usa cuando el usuario quiere comprar/agregar alimentos o articulos al hogar.",
    "Schema:",
    '{"intent":{"domain":"chat|morning|work|money|health|home|relationship|interest|research|planning|calendar","kind":"...","confidence":0.0,"slots":{},"needsTool":false},"missingContext":[{"slot":"city","question":"En que ciudad?"}],"toolCalls":[{"tool":"weather","args":{"city":"Madrid"},"reason":"..."}],"directReply":"...","directUiBlocks":[]}',
    "",
    "Memorias relevantes:",
    memories,
    "",
    "Pendientes abiertos:",
    commitments,
    "",
    "Datos registrados:",
    records,
  ].join("\n");
}

function composerPrompt() {
  return [
    "Eres Koru componiendo la respuesta final al usuario.",
    "Devuelve SOLO JSON valido con { reply, ui_blocks }.",
    "Tono: cercano, natural, util, breve cuando el pedido es simple. Nada de frases de proceso tipo 'te leo' o 'un segundo'.",
    "No muestres razonamiento interno. No metas un bloque si no suma.",
    "Si hay resultados de tools, usa esos datos y marca limitaciones con naturalidad.",
    "Para clima: una frase corta + weather block. Para compras: criterio y comparison block. Para alarmas/reminders: confirmacion breve + block correspondiente.",
    "Nunca inventes fuentes, precios, clima, trafico o dinero.",
  ].join("\n");
}

function messagesWithHistory(
  system: string,
  history: KoruConversationMessage[],
  input: string,
  extraUser?: string,
) {
  return [
    { role: "system" as const, content: system },
    ...history.slice(-10).map((turn) => ({
      role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: turn.content,
    })),
    { role: "user" as const, content: extraUser ? `${input}\n\n${extraUser}` : input },
  ];
}

async function callModelJson(
  provider: Exclude<BrainProvider, "local">,
  state: KoruState,
  messages: ReturnType<typeof messagesWithHistory>,
  maxTokens = 1200,
) {
  const result =
    provider === "open-model"
      ? await runOpenModelChat(state.runtime, messages, {
          temperature: 0.15,
          maxTokens,
          responseFormat: { type: "json_object" },
        })
      : await runFreeLlmChat(state.runtime, messages, { temperature: 0.15, maxTokens });
  return { content: result.content, model: result.model ?? result.routedVia ?? undefined };
}

async function callValidatedJson<T>(
  provider: Exclude<BrainProvider, "local">,
  state: KoruState,
  messages: ReturnType<typeof messagesWithHistory>,
  validate: (value: unknown) => Validation<T>,
  schemaName: string,
  maxTokens = 1200,
): Promise<{ value: T; model?: string }> {
  const first = await callModelJson(provider, state, messages, maxTokens);
  let parsed: unknown;
  let errors: string[] = [];
  try {
    parsed = parseJsonObjectStrict(first.content);
    const validated = validate(parsed);
    if (validated.ok) return { value: validated.value, model: first.model };
    errors = validated.errors;
  } catch (error) {
    errors = [error instanceof Error ? error.message : "invalid_json"];
  }

  const repairMessages = [
    {
      role: "system" as const,
      content: [
        "Repara la respuesta para que sea SOLO JSON valido.",
        "No expliques nada. No agregues markdown.",
        `Debe cumplir exactamente el contrato ${schemaName}.`,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "Errores de validacion:",
        errors.join("\n"),
        "",
        "Respuesta original:",
        first.content,
      ].join("\n"),
    },
  ];
  const repaired = await callModelJson(provider, state, repairMessages, maxTokens);
  const repairedParsed = parseJsonObjectStrict(repaired.content);
  const repairedValidation = validate(repairedParsed);
  if (!repairedValidation.ok) {
    throw new Error(`Invalid ${schemaName}: ${repairedValidation.errors.join("; ")}`);
  }
  return { value: repairedValidation.value, model: repaired.model ?? first.model };
}

function looksLikeGreeting(input: string): boolean {
  const clean = foldAccents(input).toLowerCase().replace(/[^\p{L}0-9]+/gu, " ").trim();
  const greetings = ["hola", "hola koru", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches"];
  return greetings.includes(clean) || greetings.some(g => clean.startsWith(g + " "));
}

function parseTime(input: string): string | undefined {
  const match = /\b(?:a\s+las\s+|para\s+las\s+)?(\d{1,2})(?::|\.|h)?(\d{2})?\b/i.exec(input);
  if (!match) return undefined;
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return undefined;
  const minute = match[2] ? Number(match[2]) : 0;
  if (minute < 0 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isMoneySummaryRequest(input: string): boolean {
  const lower = foldAccents(input);
  if (/\b(anota(?:r)?\s+gasto|registre|registrar|guardar|guarda)\b/i.test(lower)) return false;
  if (/\b(gaste|gaste|pague|pague)\b/i.test(lower) && !/\b(cuanto|resumen|total|llevo)\b/i.test(lower)) return false;
  return /\b(cuanto\s+(?:llevo\s+)?gaste|cuanto\s+gaste|gastos?\s+esta\s+semana|resumen\s+de\s+gastos|total\s+gastado|cuanto\s+llevo\s+gastado|como\s+voy\s+de\s+dinero|resumen\s+de\s+dinero)\b/i.test(lower);
}

function reminderTitle(input: string): string {
  return sentenceCase(
    input
      .replace(/^\s*(recordame que|recuerdame que|acordame que|recordame|recuerdame|acordame|no me dejes olvidar que|no me dejes olvidar|tengo que|debo|necesito)\s+/i, "")
      .replace(/\b(hoy|manana|mañana|a las \d{1,2}(?::\d{2})?|por la manana|por la mañana|por la tarde|por la noche)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ) || "Recordatorio";
}

function looksLikeReminder(input: string): boolean {
  const lower = foldAccents(input);
  if (/\b(alarma|despertador|temporizador|timer|comprar|compra|lista del super|supermercado)\b/i.test(lower)) return false;
  if (!/\b(recordame|recuerdame|acordame|avisame|avísame|no me dejes olvidar)\b/i.test(lower)) return false;
  return /\b(hoy|manana|mañana|a las \d{1,2}|por la manana|por la mañana|por la tarde|por la noche|en \d{1,2} horas?)\b/i.test(lower);
}

function lastAssistantText(history: KoruConversationMessage[]): string {
  return [...history].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
}

function looksLikeSlotAnswer(input: string): boolean {
  const clean = foldAccents(input)
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(alarma|despertador|recordame|recuerdame|acordame|comprar|compara|comparame|anota|gaste|pague|llevo|campera|abrigo|paraguas|que|hacer)\b/i.test(clean)) {
    return false;
  }
  return clean.length > 1 && clean.split(/\s+/).length <= 4;
}

function rememberedLocationFromHistory(history: KoruConversationMessage[]): string | undefined {
  for (const turn of [...history].reverse()) {
    const text = turn.content;
    const explicit = /\b(?:clima|tiempo|temperatura)\b.*\b(?:en|para|de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][\p{L}\s-]{2,40})/iu.exec(text)?.[1];
    if (explicit) return explicit.trim().replace(/[?.!,;:]+$/g, "");
    const weatherBlockCity = /\bClima\s+en\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][\p{L}\s-]{2,40})/iu.exec(text)?.[1];
    if (weatherBlockCity) return weatherBlockCity.trim().replace(/[?.!,;:]+$/g, "");
  }
  return undefined;
}

function planBlockFromLocal(input: string, state: KoruState): UiBlock | null {
  const local = buildActionProposalsLocal(input, [], "calm", state);
  const plan = local.find((action) => action.kind === "day_plan" && action.payload.planItems?.length);
  if (!plan?.payload.planItems?.length) return null;
  return {
    type: "plan",
    title: plan.payload.title ?? plan.title,
    items: plan.payload.planItems,
    note: plan.body,
  };
}

function fallbackRouteIsStronger(fallback: RouteDecision, candidate: RouteDecision): boolean {
  if (
    fallback.intent.kind === "shopping_compare" &&
    fallback.directUiBlocks?.some((block) => block.type === "research_sources" && block.sourceStatus === "pending") &&
    candidate.toolCalls.some((call) => call.tool === "shopping_compare")
  ) {
    return true;
  }
  const fallbackHasWork =
    fallback.toolCalls.length > 0 ||
    Boolean(fallback.directUiBlocks?.length) ||
    Boolean(fallback.missingContext?.length);
  const candidateIsGeneric =
    candidate.toolCalls.length === 0 &&
    !candidate.directUiBlocks?.length &&
    !candidate.missingContext?.length &&
    candidate.intent.domain === "chat";
  return fallbackHasWork && candidateIsGeneric;
}

function localRoute(input: string, state: KoruState, history: KoruConversationMessage[] = []): RouteDecision {
  const lower = foldAccents(input);
  const baseIntent: SemanticIntent = { domain: "chat", kind: "conversation", confidence: 0.58, needsTool: false };
  const lastAssistant = foldAccents(lastAssistantText(history));
  const userName = state.userName?.trim();

  if (looksLikeSlotAnswer(input) && /\b(en que ciudad|ciudad|clima)\b/i.test(lastAssistant)) {
    return {
      intent: { domain: "research", kind: "weather", confidence: 0.84, slots: { city: input.trim() }, needsTool: true },
      toolCalls: [{ tool: "weather", args: { city: input.trim() }, reason: "Continuacion de una pregunta de clima." }],
    };
  }

  if (looksLikeGreeting(input)) {
    return {
      intent: { domain: "chat", kind: "greeting", confidence: 0.9, needsTool: false },
      toolCalls: [],
      directReply: `Hola${userName ? `, ${userName}` : ""}. Estoy aca. Podemos ver pendientes, resolver algo rapido o guardar una idea.`,
      directUiBlocks: [],
      forceLocal: true,
    };
  }

  if (/\b(alarma|despertador|despertame|avisame a las)\b/i.test(lower)) {
    const time = parseTime(lower);
    if (!time) {
      return {
        intent: { domain: "calendar", kind: "alarm", confidence: 0.86, needsTool: false },
        missingContext: [{ slot: "time", question: "A que hora?" }],
        toolCalls: [],
        directReply: "Dale. Necesito la hora.",
        directUiBlocks: [{ type: "clarifying_question", question: "A que hora?", expectedSlot: "time" }],
        forceLocal: true,
      };
    }
    return {
      intent: { domain: "calendar", kind: "alarm", confidence: 0.9, slots: { time }, needsTool: true },
      toolCalls: [{ tool: "alarm", args: { time, title: "Alarma" }, reason: "Crear una alarma local requiere aprobacion." }],
      directReply: `Listo, te preparo la alarma de ${time}.`,
      forceLocal: true,
    };
  }

  if (/\b(clima|temperatura|lluvia|que me pongo|que ponerme|campera|abrigo|paraguas|chaqueta|llevo\s+(?:campera|abrigo|paraguas|chaqueta))\b/i.test(lower)) {
    const city =
      /\b(?:en|para|de)\s+([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1][\p{L}\s-]{2,40})/iu.exec(input)?.[1]?.trim() ??
      rememberedLocationFromHistory(history) ??
      rememberedLocation(state);
    if (!city) {
      return {
        intent: { domain: "research", kind: "weather", confidence: 0.86, needsTool: false },
        missingContext: [{ slot: "city", question: "En que ciudad?" }],
        toolCalls: [],
        directReply: `${userName ? `Hola, ${userName}. ` : ""}Si, claro. En que ciudad?`,
        directUiBlocks: [{ type: "clarifying_question", title: "Clima", question: "En que ciudad?", expectedSlot: "city" }],
      };
    }
    return {
      intent: { domain: "research", kind: "weather", confidence: 0.86, slots: { city }, needsTool: true },
      toolCalls: [{ tool: "weather", args: { city }, reason: "Consultar clima real." }],
      directReply: "Claro, lo miro.",
    };
  }

  if (isMoneySummaryRequest(input)) {
    return {
      intent: { domain: "money", kind: "money_summary", confidence: 0.86, slots: { query: input }, needsTool: true },
      toolCalls: [{ tool: "money_summary", args: { query: input }, reason: "Resumir gastos registrados sin mover dinero." }],
      directReply: "Te resumo lo registrado.",
    };
  }

  const shoppingItems = extractShoppingItems(input);
  if (shoppingItems.length) {
    return {
      intent: { domain: "home", kind: "shopping_list", confidence: 0.82, slots: { items: shoppingItems }, needsTool: false },
      toolCalls: [],
      directReply: `Lo dejo en compras: ${shoppingItems.join(", ")}.`,
      directUiBlocks: [{ type: "shopping_list", title: "Lista de compras", items: shoppingItems }],
      forceLocal: true,
    };
  }

  if (/\b(anota(?:r)?\s+gasto|gaste|gast[eé]|pague|pagu[eé])\b/i.test(lower)) {
    return {
      intent: { domain: "money", kind: "expense_capture", confidence: 0.86, slots: { query: input }, needsTool: false },
      toolCalls: [],
      directReply: "Anotado.",
      directUiBlocks: [],
      forceLocal: true,
    };
  }

  if (looksLikeReminder(input)) {
    const title = reminderTitle(input);
    const dueAt = dueAtFromText(input);
    const dueText = dueAt ? dueLabel(dueAt) : /\bmanana|mañana\b/i.test(lower) ? "mañana" : "sin fecha";
    return {
      intent: { domain: "calendar", kind: "reminder", confidence: 0.86, slots: { title, dueText, dueAt }, needsTool: true },
      toolCalls: [{ tool: "calendar_reminder", args: { title, dueText, startsAt: dueAt }, reason: "Crear un recordatorio local requiere aprobacion." }],
      directReply: `Lo preparo como recordatorio: ${title}.`,
    };
  }

  const localPlan = planBlockFromLocal(input, state);
  if (localPlan) {
    return {
      intent: { domain: "planning", kind: "day_prioritization", confidence: 0.84, needsTool: false },
      toolCalls: [],
      directReply: "Te lo ordeno en pasos concretos para que puedas empezar sin reconstruir todo.",
      directUiBlocks: [localPlan],
    };
  }

  if (/\b(no se que hacer|no se por donde|que hago|pendientes|prioridad|ordenar|organizar)\b/i.test(lower)) {
    const local = buildActionProposalsLocal(input, [], "calm");
    const plan = local.find((action) => action.kind === "day_plan");
    const question = local.find((action) => action.kind === "clarifying_question");
    return {
      intent: { domain: "planning", kind: "day_prioritization", confidence: 0.72, needsTool: false },
      toolCalls: [],
      directReply: question ? "Vamos a encontrar el primer paso real. Necesito un poco de contexto." : "Te ordeno lo mas accionable para empezar.",
      directUiBlocks: plan?.payload.planItems?.length
        ? [{ type: "plan", title: "Plan de hoy", items: plan.payload.planItems }]
        : [{
            type: "clarifying_question",
            question: question?.payload.questions?.[0] ?? "Que tres cosas te estan rondando?",
            expectedSlot: "pending_tasks",
            options: question?.payload.questions?.slice(1),
          }],
    };
  }

  if (/\b(puedo permitirme|me conviene|decidir|decision|vale la pena|comprarlo|comprar esto|permitir)\b/i.test(lower)) {
    return {
      intent: { domain: "money", kind: "decision_support", confidence: 0.82, slots: { query: input }, needsTool: false },
      toolCalls: [],
      directReply: "Te ayudo a decidir con lo que ya tengo guardado, sin convertirlo en compra.",
      directUiBlocks: [],
    };
  }

  if (/\b(compara|comparame|precio|precios|comprar|producto|auriculares|notebook|celular)\b/i.test(lower)) {
    return {
      intent: { domain: "research", kind: "shopping_compare", confidence: 0.78, slots: { query: input }, needsTool: true },
      toolCalls: [{ tool: "shopping_compare", args: { query: input }, reason: "Comparar productos exige fuentes reales y aprobacion previa." }],
      directReply: "Puedo compararlo con fuentes reales. Lo dejo listo para que lo apruebes antes de abrir tiendas.",
    };
  }

  if (/\b(noticias|investiga|busca|buscame|deep research|busqueda profunda|que esta pasando|el mundo|tendencias)\b/i.test(lower)) {
    const deep = /\b(deep research|busqueda profunda|investigacion profunda)\b/i.test(lower);
    const world = /\b(el mundo|se esta hablando|estan hablando|te enteraste|tendencias|que esta pasando)\b/i.test(lower);
    return {
      intent: { domain: "research", kind: world ? "world_signal" : deep ? "deep_research" : "web_search", confidence: 0.75, slots: { query: input, mode: world ? "world" : undefined }, needsTool: true },
      toolCalls: [{ tool: world ? "web_search" : deep ? "deep_research" : "web_search", args: { query: input, mode: world ? "world" : undefined }, reason: world ? "Traer senales recientes verificables." : "Buscar informacion real." }],
    };
  }

  return { intent: baseIntent, toolCalls: [], directReply: "Te sigo. Decime si queres que lo guardemos, lo pensemos juntos o lo transformemos en un paso concreto.", directUiBlocks: [] };
}

function composeLocal(
  route: RouteDecision,
  toolResults: ToolResult[],
  executedToolCalls: ToolCall[] = [],
  pendingToolCalls: ToolCall[] = [],
  model?: string,
  fallbackReason?: string,
): OrchestratedTurn {
  const resultBlocks = uiBlocksFromToolResults(route, toolResults);
  const pendingBlocks = pendingBlocksForToolCalls(pendingToolCalls, route);
  const blocks = route.directUiBlocks?.length ? route.directUiBlocks : [...resultBlocks, ...pendingBlocks];
  const reply =
    route.directReply ??
    (toolResults.length
      ? toolResults[0]?.summary || "Listo, traje resultados reales y deje la evidencia visible."
      : pendingToolCalls.length
        ? "Lo dejo listo para tu aprobacion antes de tocar nada."
        : "Te sigo. Lo podemos convertir en accion, memoria o busqueda.");
  return {
    reply,
    intent: route.intent,
    uiBlocks: blocks,
    toolCalls: route.toolCalls,
    executedToolCalls,
    pendingToolCalls,
    toolResults,
    model,
    fallbackReason,
  };
}

export async function orchestrateTurn(params: {
  input: string;
  state: KoruState;
  provider: BrainProvider;
  activeMemories: MemoryFact[];
  history?: KoruConversationMessage[];
}): Promise<OrchestratedTurn> {
  const fallbackRoute = localRoute(params.input, params.state, params.history ?? []);
  if (params.provider === "local" || fallbackRoute.forceLocal) {
    const { executable, pending } = splitToolCallsByPolicy(fallbackRoute.toolCalls);
    const toolResults = await Promise.all(executable.map((call, index) => executeRegisteredToolCall(call, index, params.state)));
    return composeLocal(fallbackRoute, toolResults, executable, pending, undefined, fallbackRoute.forceLocal ? "local-force" : "local-json-router");
  }

  let model: string | undefined;
  let route = fallbackRoute;
  let fallbackReason: string | undefined;
  try {
    const routed = await callValidatedJson(
      params.provider,
      params.state,
      messagesWithHistory(routePrompt(params.state, params.activeMemories), params.history ?? [], params.input),
      validateRouterResult,
      "RouterResult",
      1200,
    );
    model = routed.model;
    route = routed.value;
    if (fallbackRouteIsStronger(fallbackRoute, route)) {
      route = fallbackRoute;
      fallbackReason = "local-route-was-more-specific";
    }
  } catch (error) {
    fallbackReason = error instanceof Error ? `router-fallback: ${error.message}` : "router-fallback";
    route = fallbackRoute;
  }

  if (route.missingContext?.length && !route.directUiBlocks?.length) {
    route = {
      ...route,
      toolCalls: [],
      directReply: route.directReply ?? route.missingContext[0].question,
      directUiBlocks: [{
        type: "clarifying_question",
        question: route.missingContext[0].question,
        expectedSlot: route.missingContext[0].slot,
      }],
    };
  }

  const { executable, pending } = splitToolCallsByPolicy(route.toolCalls);
  const toolResults = await Promise.all(executable.map((call, index) => executeRegisteredToolCall(call, index, params.state)));
  const pendingBlocks = pendingBlocksForToolCalls(pending, route);

  if (!toolResults.length && (route.directReply || route.directUiBlocks?.length || pendingBlocks.length)) {
    const directRoute = pendingBlocks.length && !route.directUiBlocks?.length
      ? { ...route, directUiBlocks: pendingBlocks }
      : route;
    return composeLocal(directRoute, toolResults, executable, pending, model, fallbackReason);
  }

  try {
    const composed = await callValidatedJson(
      params.provider,
      params.state,
      messagesWithHistory(
        composerPrompt(),
        params.history ?? [],
        params.input,
        [
          "Decision del router:",
          JSON.stringify(route),
          "",
          "Resultados de herramientas:",
          JSON.stringify(toolResults),
        ].join("\n"),
      ),
      validateComposerResult,
      "ComposerResult",
      1600,
    );
    model = composed.model ?? model;
    const resultBlocks = uiBlocksFromToolResults(route, toolResults);
    const blocks = composed.value.uiBlocks.length ? composed.value.uiBlocks : [...resultBlocks, ...pendingBlocks];
    return {
      reply: composed.value.reply,
      intent: route.intent,
      uiBlocks: blocks,
      toolCalls: route.toolCalls,
      executedToolCalls: executable,
      pendingToolCalls: pending,
      toolResults,
      model,
      fallbackReason,
    };
  } catch (error) {
    const reason = error instanceof Error ? `composer-fallback: ${error.message}` : "composer-fallback";
    return composeLocal(route, toolResults, executable, pending, model, fallbackReason ?? reason);
  }
}

function titleForBlock(block: UiBlock): string {
  if (block.type === "clarifying_question") return block.title ?? "Necesito un dato";
  if (block.type === "weather") return block.title ?? "Clima";
  if (block.type === "alarm") return block.title;
  if (block.type === "reminder") return block.title;
  if (block.type === "shopping_list") return block.title ?? "Lista de compras";
  if (block.type === "plan") return block.title ?? "Plan";
  if (block.type === "comparison") return block.title ?? "Comparativa";
  if (block.type === "research_sources") return block.title ?? "Fuentes";
  if (block.type === "money_summary") return block.title ?? "Dinero";
  if (block.type === "web_nav") return block.title ?? "Web Navigation";
  return ("title" in block ? block.title : undefined) ?? "Guardado";
}

function payloadForBlock(block: UiBlock, intent: SemanticIntent): AssistantActionPayload {
  const payload: AssistantActionPayload = {
    title: titleForBlock(block),
    uiBlock: block,
    semanticIntent: intent,
  };
  if (block.type === "clarifying_question") {
    payload.questions = [block.question];
    payload.missingContext = block.expectedSlot ? [block.expectedSlot] : undefined;
  }
  if (block.type === "weather") {
    payload.webMode = "weather";
    payload.searchQueries = block.city ? [`clima ${block.city}`] : undefined;
    payload.researchCriteria = ["temperatura", "lluvia", "viento", "consejo practico"];
    payload.summaryItems = [
      block.now ? { label: "Ahora", value: block.now, detail: block.city } : undefined,
      block.range ? { label: "Hoy", value: block.range } : undefined,
      block.rain ? { label: "Lluvia", value: block.rain } : undefined,
      block.wind ? { label: "Viento", value: block.wind } : undefined,
    ].filter(Boolean) as NonNullable<AssistantActionPayload["summaryItems"]>;
    payload.sources = block.sources;
    payload.recommendation = block.advice;
    payload.externalStatus = block.sourceStatus ?? (block.sources?.length ? "verified" : undefined);
  }
  if (block.type === "alarm") {
    payload.startsAt = block.time;
    payload.dueHint = block.repeat;
    payload.body = block.note;
  }
  if (block.type === "reminder") {
    payload.dueHint = block.dueText;
    payload.body = block.note;
  }
  if (block.type === "shopping_list") {
    payload.note = block.items.join(", ");
    payload.records = block.items.map((item) => ({
      domain: "home",
      kind: "shopping_item",
      title: sentenceCase(item),
      value: item,
      tags: ["compras", "casa"],
    }));
  }
  if (block.type === "plan") payload.planItems = block.items;
  if (block.type === "comparison") {
    payload.webMode = "shopping";
    payload.searchQueries = intent.slots?.query ? [String(intent.slots.query)] : undefined;
    payload.researchCriteria = block.criteria ?? ["precio", "entrega", "devoluciones", "confianza"];
    payload.comparisonItems = block.items;
    payload.sources = block.sources;
    payload.recommendation = block.recommendation;
  }
  if (block.type === "research_sources") {
    payload.webMode = block.mode;
    payload.searchQueries = intent.slots?.query ? [String(intent.slots.query)] : undefined;
    payload.researchCriteria = block.mode === "shopping"
      ? ["precio total", "entrega", "devoluciones", "confianza del vendedor"]
      : ["fuente", "fecha", "credibilidad", "relevancia"];
    payload.sources = block.sources;
    payload.recommendation = block.summary;
    payload.externalStatus = block.sourceStatus ?? (block.sources.length ? "verified" : undefined);
  }
  if (block.type === "money_summary") {
    payload.totalAmount = block.total;
    payload.currency = block.currency;
    payload.summaryItems = block.summaryItems;
    payload.recommendation = block.recommendation;
  }
  if (block.type === "saved_record") payload.records = block.records;
  return payload;
}

export function uiBlocksToActionProposals(uiBlocks: UiBlock[], intent: SemanticIntent) {
  return uiBlocks.map((block) => {
    const kind = actionKindForUiBlock(block);
    const approvalRequired = approvalRequiredForUiBlock(block);
    return {
      kind,
      title: titleForBlock(block),
      body: block.type === "clarifying_question" ? block.question : "Listo para revisar.",
      status: "proposed" as const,
      approvalRequired,
      payload: payloadForBlock(block, intent),
    };
  });
}
