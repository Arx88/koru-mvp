import { runWebNavigation } from "./web";
import type {
  AssistantAction,
  AssistantActionKind,
  AssistantActionPayload,
  KoruState,
  RouterResult,
  SemanticIntent,
  ToolCall,
  ToolPolicy,
  ToolResult,
  UiBlock,
} from "./types";

type ToolDefinition = {
  name: ToolCall["tool"];
  actionKind: AssistantActionKind;
  policy: ToolPolicy;
  webMode?: AssistantActionPayload["webMode"];
  buildPayload: (call: ToolCall, state?: KoruState) => AssistantActionPayload;
  execute: (call: ToolCall, index: number, state?: KoruState) => Promise<ToolResult>;
  pendingUiBlock: (call: ToolCall, route?: RouterResult) => UiBlock | null;
  resultToUiBlocks: (result: ToolResult, call: ToolCall, route?: RouterResult) => UiBlock[];
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toolId(call: ToolCall, index: number): string {
  return call.id ?? `${call.tool}_${index + 1}`;
}

function queryFrom(call: ToolCall): string {
  return asString(call.args.query) ?? asString(call.args.city) ?? asString(call.args.destination) ?? JSON.stringify(call.args);
}

function webPayload(call: ToolCall, mode: NonNullable<AssistantActionPayload["webMode"]>): AssistantActionPayload {
  const query = queryFrom(call);
  if (mode === "weather") {
    const city = asString(call.args.city) ?? query;
    return {
      webMode: "weather",
      title: "Clima",
      body: `Clima en ${city}`,
      searchQueries: [`clima ${city}`],
      researchCriteria: ["temperatura", "lluvia", "viento", "consejo practico"],
    };
  }
  if (mode === "shopping") {
    return {
      webMode: "shopping",
      title: "Comparativa",
      body: query,
      searchQueries: [query],
      researchCriteria: ["precio total", "entrega", "devoluciones", "confianza del vendedor"],
      externalStatus: "pending",
    };
  }
  if (mode === "traffic") {
    return {
      webMode: "traffic",
      title: "Ruta",
      body: query,
      searchQueries: [query],
      researchCriteria: ["origen", "destino", "duracion", "limitaciones"],
    };
  }
  return {
    webMode: mode,
    title: mode === "research" ? "Deep research" : mode === "world" ? "El mundo esta hablando de esto" : "Research",
    body: query,
    searchQueries: mode === "world"
      ? [
          `${query} ultimos 30 dias`,
          `${query} tendencias comunidad ultimos 30 dias`,
          `${query} noticias recientes impacto trabajo`,
        ]
      : [query],
    researchCriteria:
      mode === "research"
        ? ["fuentes diversas", "contraste", "evidencia", "sintesis accionable"]
        : mode === "world"
          ? ["ultimos 30 dias", "fuentes abiertas", "senales repetidas", "impacto para ti", "sin ruido viral sin evidencia"]
        : ["fecha", "fuente", "relevancia", "accion posible"],
  };
}

async function executeWeb(call: ToolCall, index: number, mode: NonNullable<AssistantActionPayload["webMode"]>): Promise<ToolResult> {
  const id = toolId(call, index);
  try {
    const result = await runWebNavigation(webPayload(call, mode));
    return {
      id,
      tool: call.tool,
      status: result.status === "verified" ? "ok" : result.status === "failed" ? "failed" : "partial",
      summary: result.recommendation,
      sources: result.sources,
      data: {
        externalStatus: result.status,
        verifiedAt: result.verifiedAt,
        summaryItems: result.summaryItems,
        comparisonItems: result.comparisonItems,
      },
    };
  } catch (error) {
    return {
      id,
      tool: call.tool,
      status: "failed",
      summary: error instanceof Error ? error.message : "No pude ejecutar la herramienta.",
    };
  }
}

function weatherBlock(result: ToolResult, call: ToolCall, route?: RouterResult): UiBlock {
  const summaryItems = result.data?.summaryItems as Array<{ label: string; value: string; detail?: string }> | undefined;
  return {
    type: "weather",
    title: "Clima",
    city: asString(call.args.city) ?? asString(route?.intent.slots?.city),
    now: summaryItems?.[0]?.value,
    range: summaryItems?.[1]?.value,
    rain: summaryItems?.[2]?.value,
    advice: result.summary,
    sourceStatus: result.data?.externalStatus as AssistantActionPayload["externalStatus"] | undefined ?? (result.status === "failed" ? "failed" : undefined),
    sources: result.sources,
  };
}

function researchBlock(
  result: ToolResult,
  mode: AssistantActionPayload["webMode"],
  title: string,
  followUpQuestion?: string,
): UiBlock {
  return {
    type: "research_sources",
    title,
    summary: result.summary,
    mode,
    sources: result.sources ?? [],
    sourceStatus: result.data?.externalStatus as AssistantActionPayload["externalStatus"] | undefined ?? (result.status === "failed" ? "failed" : undefined),
    followUpQuestion,
  };
}

function comparisonBlock(result: ToolResult): UiBlock {
  const comparisonItems = result.data?.comparisonItems as NonNullable<AssistantActionPayload["comparisonItems"]> | undefined;
  if (comparisonItems?.length) {
    return {
      type: "comparison",
      title: "Comparativa",
      items: comparisonItems,
      recommendation: result.summary,
      sources: result.sources,
    };
  }
  return researchBlock(result, "shopping", "Comparativa");
}

function localResult(call: ToolCall, index: number): ToolResult {
  return {
    id: toolId(call, index),
    tool: call.tool,
    status: "ok",
    summary: call.reason ?? "Accion local preparada.",
    data: call.args,
  };
}

function alarmTime(call: ToolCall): string | undefined {
  return asString(call.args.time) ?? asString(call.args.startsAt) ?? asString(call.args.hour);
}

export const TOOL_REGISTRY: Record<ToolCall["tool"], ToolDefinition> = {
  weather: {
    name: "weather",
    actionKind: "web_research",
    webMode: "weather",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Solo lee clima/fuentes publicas." },
    buildPayload: (call) => webPayload(call, "weather"),
    execute: (call, index) => executeWeb(call, index, "weather"),
    pendingUiBlock: (call) => ({
      type: "weather",
      title: "Clima",
      city: asString(call.args.city),
      sourceStatus: "pending",
      advice: "Tengo la consulta lista; necesito traer datos reales antes de aconsejar.",
    }),
    resultToUiBlocks: (result, call, route) => [weatherBlock(result, call, route)],
  },
  web_search: {
    name: "web_search",
    actionKind: "web_research",
    webMode: "news",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Busqueda informativa sin tocar cuentas ni compras." },
    buildPayload: (call) => webPayload(call, asString(call.args.mode) === "world" ? "world" : "news"),
    execute: (call, index) => executeWeb(call, index, asString(call.args.mode) === "world" ? "world" : "news"),
    pendingUiBlock: (call) => ({
      type: "research_sources",
      title: "Busqueda",
      summary: queryFrom(call),
      mode: asString(call.args.mode) === "world" ? "world" : "news",
      sources: [],
      sourceStatus: "pending",
    }),
    resultToUiBlocks: (result, call) => {
      const world = asString(call.args.mode) === "world";
      return [researchBlock(
        result,
        world ? "world" : "news",
        world ? "El mundo esta hablando de esto" : "Noticias",
        world ? "Quieres que te siga avisando cuando aparezcan senales utiles?" : "Quieres que lo siga mirando cuando aparezca algo importante?",
      )];
    },
  },
  deep_research: {
    name: "deep_research",
    actionKind: "web_research",
    webMode: "research",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Investigacion profunda informativa y trazable." },
    buildPayload: (call) => webPayload(call, "research"),
    execute: (call, index) => executeWeb(call, index, "research"),
    pendingUiBlock: (call) => ({
      type: "research_sources",
      title: "Deep research",
      summary: queryFrom(call),
      mode: "research",
      sources: [],
      sourceStatus: "pending",
    }),
    resultToUiBlocks: (result) => [researchBlock(result, "research", "Deep research")],
  },
  shopping_compare: {
    name: "shopping_compare",
    actionKind: "web_research",
    webMode: "shopping",
    policy: { requiresApproval: true, autoRun: false, risk: "external_side_effect", reason: "Puede abrir tiendas y orientar compras; requiere visto bueno." },
    buildPayload: (call) => webPayload(call, "shopping"),
    execute: (call, index) => executeWeb(call, index, "shopping"),
    pendingUiBlock: (call) => ({
      type: "research_sources",
      title: "Brief de comparativa",
      summary: "Puedo comparar precio total, entrega, devoluciones y confianza del vendedor. Lo hago con fuentes reales cuando lo apruebes.",
      mode: "shopping",
      sources: [],
      sourceStatus: "pending",
      followUpQuestion: queryFrom(call),
    }),
    resultToUiBlocks: (result) => [comparisonBlock(result)],
  },
  route_traffic: {
    name: "route_traffic",
    actionKind: "web_research",
    webMode: "traffic",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Consulta informativa de ruta/trafico." },
    buildPayload: (call) => webPayload(call, "traffic"),
    execute: (call, index) => executeWeb(call, index, "traffic"),
    pendingUiBlock: (call) => ({
      type: "research_sources",
      title: "Ruta",
      summary: queryFrom(call),
      mode: "traffic",
      sources: [],
      sourceStatus: "pending",
    }),
    resultToUiBlocks: (result) => [researchBlock(result, "traffic", "Ruta")],
  },
  calendar_reminder: {
    name: "calendar_reminder",
    actionKind: "reminder",
    policy: { requiresApproval: true, autoRun: false, risk: "local_write", reason: "Crea o modifica un recordatorio local." },
    buildPayload: (call) => ({ title: asString(call.args.title), dueHint: asString(call.args.dueText), body: asString(call.args.note) }),
    execute: async (call, index) => localResult(call, index),
    pendingUiBlock: (call) => ({
      type: "reminder",
      title: asString(call.args.title) ?? "Recordatorio",
      dueText: asString(call.args.dueText) ?? asString(call.args.dueHint),
      note: asString(call.args.note),
    }),
    resultToUiBlocks: (_result, call) => [{
      type: "reminder",
      title: asString(call.args.title) ?? "Recordatorio",
      dueText: asString(call.args.dueText) ?? asString(call.args.dueHint),
      note: asString(call.args.note),
    }],
  },
  alarm: {
    name: "alarm",
    actionKind: "alarm",
    policy: { requiresApproval: true, autoRun: false, risk: "local_write", reason: "Crea una alarma local y debe confirmarse." },
    buildPayload: (call) => ({ title: asString(call.args.title), startsAt: alarmTime(call), body: asString(call.args.note) }),
    execute: async (call, index) => localResult(call, index),
    pendingUiBlock: (call) => ({
      type: "alarm",
      title: asString(call.args.title) ?? "Alarma",
      time: alarmTime(call) ?? "sin hora",
      repeat: asString(call.args.repeat),
      note: asString(call.args.note),
    }),
    resultToUiBlocks: (_result, call) => [{
      type: "alarm",
      title: asString(call.args.title) ?? "Alarma",
      time: alarmTime(call) ?? "sin hora",
      repeat: asString(call.args.repeat),
      note: asString(call.args.note),
    }],
  },
  money_summary: {
    name: "money_summary",
    actionKind: "money_summary",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Resume datos ya guardados; no paga ni mueve dinero." },
    buildPayload: () => ({ title: "Dinero" }),
    execute: async (call, index, state) => {
      const expenses = (state?.records ?? []).filter((record) => record.kind === "expense" && typeof record.amount === "number");
      const total = expenses.reduce((sum, record) => sum + (record.amount ?? 0), 0);
      const currency = expenses.find((record) => record.currency)?.currency ?? "EUR";
      return {
        id: toolId(call, index),
        tool: call.tool,
        status: "ok",
        summary: expenses.length ? `Tenes ${total.toFixed(2)} ${currency} registrado en gastos recientes.` : "Todavia no tengo gastos registrados para resumir.",
        data: { total, count: expenses.length, currency },
      };
    },
    pendingUiBlock: () => null,
    resultToUiBlocks: (result) => {
      const total = typeof result.data?.total === "number" ? result.data.total : undefined;
      const currency = asString(result.data?.currency) ?? "EUR";
      const count = typeof result.data?.count === "number" ? result.data.count : undefined;
      return [{
        type: "money_summary",
        title: "Dinero",
        total,
        currency,
        summaryItems: [
          total !== undefined ? { label: "Total", value: `${total.toFixed(2)} ${currency}` } : undefined,
          count !== undefined ? { label: "Movimientos", value: String(count) } : undefined,
        ].filter(Boolean) as NonNullable<AssistantActionPayload["summaryItems"]>,
        recommendation: result.summary,
      }];
    },
  },
  memory_recall: {
    name: "memory_recall",
    actionKind: "structured_note",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Lee memoria local disponible." },
    buildPayload: () => ({ title: "Memoria" }),
    execute: async (call, index, state) => ({
      id: toolId(call, index),
      tool: call.tool,
      status: "ok",
      summary: (state?.memories ?? []).filter((memory) => memory.status === "confirmed").slice(0, 5).map((memory) => memory.text).join(" / ") || "No encontre memorias confirmadas relevantes.",
    }),
    pendingUiBlock: () => null,
    resultToUiBlocks: () => [],
  },
  match_live: {
    name: "match_live",
    actionKind: "web_research",
    webMode: "research",
    policy: { requiresApproval: false, autoRun: true, risk: "readonly", reason: "Lee resultados deportivos públicos (ESPN)." },
    buildPayload: (call) => ({ title: "Partido", query: asString(call.args.query) }),
    execute: async (call, index) => ({
      id: toolId(call, index),
      tool: call.tool,
      status: "ok",
      summary: "Resultado deportivo en vivo o final.",
    }),
    pendingUiBlock: () => null,
    resultToUiBlocks: () => [],
  },
};

export function getToolDefinition(tool: ToolCall["tool"]): ToolDefinition {
  return TOOL_REGISTRY[tool];
}

export function toolPolicyFor(tool: ToolCall["tool"]): ToolPolicy {
  return getToolDefinition(tool).policy;
}

export function splitToolCallsByPolicy(toolCalls: ToolCall[]): { executable: ToolCall[]; pending: ToolCall[] } {
  const executable: ToolCall[] = [];
  const pending: ToolCall[] = [];
  for (const call of toolCalls) {
    const policy = toolPolicyFor(call.tool);
    if (policy.autoRun && !policy.requiresApproval) executable.push(call);
    else pending.push(call);
  }
  return { executable, pending };
}

export async function executeRegisteredToolCall(call: ToolCall, index: number, state?: KoruState): Promise<ToolResult> {
  return getToolDefinition(call.tool).execute(call, index, state);
}

export function pendingBlocksForToolCalls(toolCalls: ToolCall[], route?: RouterResult): UiBlock[] {
  return toolCalls
    .map((call) => getToolDefinition(call.tool).pendingUiBlock(call, route))
    .filter((block): block is UiBlock => Boolean(block));
}

export function uiBlocksFromToolResults(route: RouterResult, results: ToolResult[]): UiBlock[] {
  const callsById = new Map(route.toolCalls.map((call, index) => [call.id ?? `${call.tool}_${index + 1}`, call]));
  return results.flatMap((result) => {
    const call = callsById.get(result.id) ?? route.toolCalls.find((item) => item.tool === result.tool) ?? { tool: result.tool, args: {} };
    return getToolDefinition(result.tool).resultToUiBlocks(result, call, route);
  });
}

export function approvalRequiredForUiBlock(block: UiBlock): boolean {
  if (block.type === "alarm" || block.type === "reminder" || block.type === "shopping_list" || block.type === "plan") return true;
  if (block.type === "comparison") return true;
  if (block.type === "research_sources") return block.mode === "shopping" || block.sourceStatus === "pending";
  return false;
}

export function actionKindForUiBlock(block: UiBlock): AssistantActionKind {
  if (block.type === "clarifying_question") return "clarifying_question";
  if (block.type === "research_sources" && block.mode === "world") return "world_signal";
  if (block.type === "proactive_signal" && block.category === "world") return "world_signal";
  if (block.type === "weather" || block.type === "comparison" || block.type === "research_sources" || block.type === "proactive_signal") return "web_research";
  if (block.type === "alarm") return "alarm";
  if (block.type === "reminder") return "reminder";
  if (block.type === "shopping_list") return "restock_note";
  if (block.type === "plan") return "day_plan";
  if (block.type === "money_summary") return "money_summary";
  if (block.type === "resource_bundle") return "file_bundle";
  return "structured_note";
}

export function shouldAutoRunAction(action: AssistantAction): boolean {
  if (
    action.payload.externalStatus === "verified" ||
    action.payload.externalStatus === "failed" ||
    action.payload.externalStatus === "partial" ||
    action.payload.externalStatus === "not_configured" ||
    action.payload.sources?.length
  ) return false;
  if (action.approvalRequired) return false;
  if (action.kind !== "web_research" && action.kind !== "world_signal") return false;
  return ["weather", "traffic", "news", "market", "world", "research"].includes(action.payload.webMode ?? "");
}

export function actionPolicySummary(intent: SemanticIntent): string {
  return `${intent.domain}:${intent.kind}`;
}
