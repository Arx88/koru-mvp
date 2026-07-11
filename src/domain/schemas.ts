import type {
  AssistantActionPayload,
  AssistantSource,
  LifeRecordKind,
  LifeDomain,
  ComposerResult,
  RouterResult,
  SemanticIntent,
  ToolCall,
  UiBlock,
} from "./types";

export class SchemaValidationError extends Error {
  readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(message);
    this.name = "SchemaValidationError";
    this.errors = errors;
  }
}

export type Validation<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: string[] };

const INTENT_DOMAINS: SemanticIntent["domain"][] = [
  "chat",
  "morning",
  "work",
  "money",
  "health",
  "home",
  "relationship",
  "interest",
  "research",
  "planning",
  "calendar",
];

const TOOL_NAMES: ToolCall["tool"][] = [
  "weather",
  "web_search",
  "deep_research",
  "shopping_compare",
  "route_traffic",
  "calendar_reminder",
  "alarm",
  "money_summary",
  "memory_recall",
];

const UI_BLOCK_TYPES = [
  "clarifying_question",
  "weather",
  "alarm",
  "reminder",
  "shopping_list",
  "plan",
  "comparison",
  "research_sources",
  "money_summary",
  "saved_record",
  "activity_group",
  "proactive_signal",
  "resource_bundle",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown, limit = 8): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return items.length ? items.slice(0, limit) : undefined;
}

function normalizeSources(value: unknown): AssistantSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((source) => ({
      title: asString(source.title) ?? "",
      url: asString(source.url) ?? "",
      domain: asString(source.domain) ?? "",
      snippet: asString(source.snippet),
    }))
    .filter((source) => source.title && source.url && source.domain)
    .slice(0, 8);
  return sources.length ? sources : undefined;
}

const LIFE_DOMAINS: LifeDomain[] = [
  "morning",
  "work",
  "money",
  "health",
  "relationship",
  "home",
  "interest",
  "capture",
];

const LIFE_RECORD_KINDS: LifeRecordKind[] = [
  "expense",
  "medication",
  "meal_inventory",
  "tool_link",
  "meeting_note",
  "deadline",
  "person_followup",
  "gift",
  "birthday",
  "home_task",
  "shopping_item",
  "idea",
  "recommendation",
  "medical_info",
  "sleep",
  "decision",
];

function normalizeSavedRecords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const domain = asString(item.domain);
      const kind = asString(item.kind);
      return {
        domain,
        kind,
        title: asString(item.title) ?? asString(item.value) ?? "",
        value: asString(item.value),
        amount: asNumber(item.amount),
        currency: asString(item.currency),
        person: asString(item.person),
        url: asString(item.url),
        dueHint: asString(item.dueHint),
        happenedAt: asString(item.happenedAt),
        notes: asString(item.notes),
        tags: asStringArray(item.tags),
      };
    })
    .filter((item) =>
      item.title &&
      item.domain &&
      LIFE_DOMAINS.includes(item.domain as LifeDomain) &&
      item.kind &&
      LIFE_RECORD_KINDS.includes(item.kind as LifeRecordKind),
    )
    .map((item) => ({
      ...item,
      domain: item.domain as LifeDomain,
      kind: item.kind as LifeRecordKind,
    }))
    .slice(0, 6);
}

function normalizeIntent(value: unknown, errors: string[]): SemanticIntent | null {
  const record = asRecord(value);
  if (!record) {
    errors.push("intent must be an object");
    return null;
  }
  const domain = asString(record.domain);
  const kind = asString(record.kind);
  if (!domain || !INTENT_DOMAINS.includes(domain as SemanticIntent["domain"])) {
    errors.push("intent.domain is invalid");
  }
  if (!kind) errors.push("intent.kind is required");
  if (errors.length) return null;
  return {
    domain: domain as SemanticIntent["domain"],
    kind: kind!,
    confidence: Math.max(0, Math.min(1, asNumber(record.confidence) ?? 0.5)),
    slots: asRecord(record.slots) ?? undefined,
    needsTool: typeof record.needsTool === "boolean" ? record.needsTool : undefined,
  };
}

export function validateToolCall(value: unknown): Validation<ToolCall> {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["toolCall must be an object"] };
  const tool = asString(record.tool);
  if (!tool || !TOOL_NAMES.includes(tool as ToolCall["tool"])) errors.push("toolCall.tool is invalid");
  const args = asRecord(record.args) ?? {};
  if (tool === "weather" && !asString(args.city) && !asString(args.query)) errors.push("weather requires city or query");
  if ((tool === "web_search" || tool === "deep_research" || tool === "shopping_compare") && !asString(args.query)) {
    errors.push(`${tool} requires query`);
  }
  if (tool === "route_traffic" && !asString(args.query) && (!asString(args.origin) || !asString(args.destination))) {
    errors.push("route_traffic requires query or origin/destination");
  }
  if (tool === "alarm" && !asString(args.time) && !asString(args.startsAt) && !asString(args.hour)) {
    errors.push("alarm requires time");
  }
  if (tool === "calendar_reminder" && !asString(args.title)) errors.push("calendar_reminder requires title");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    warnings: [],
    value: {
      id: asString(record.id),
      tool: tool as ToolCall["tool"],
      args,
      reason: asString(record.reason),
    },
  };
}

function normalizePlanItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      time: asString(item.time),
      title: asString(item.title) ?? "",
      priority: asString(item.priority) as "Alta" | "Media" | "Baja" | undefined,
      icon: asString(item.icon) as "flag" | "book" | "move" | "message" | "calendar" | "money" | "heart" | "home" | undefined,
      durationMinutes: asNumber(item.durationMinutes),
      mode: asString(item.mode) as "focus" | "quick" | "admin" | "recovery" | undefined,
      rationale: asString(item.rationale),
    }))
    .filter((item) => item.title)
    .slice(0, 8);
}

export function validateUiBlock(value: unknown): Validation<UiBlock> {
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["uiBlock must be an object"] };
  const type = asString(record.type);
  if (!type || !UI_BLOCK_TYPES.includes(type as (typeof UI_BLOCK_TYPES)[number])) {
    return { ok: false, errors: ["uiBlock.type is unknown"] };
  }

  if (type === "clarifying_question") {
    const question = asString(record.question);
    if (!question) return { ok: false, errors: ["clarifying_question.question is required"] };
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        title: asString(record.title),
        question,
        expectedSlot: asString(record.expectedSlot),
        options: asStringArray(record.options),
      },
    };
  }

  if (type === "weather") {
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        title: asString(record.title),
        city: asString(record.city),
        now: asString(record.now),
        range: asString(record.range),
        rain: asString(record.rain),
        wind: asString(record.wind),
        advice: asString(record.advice),
        sourceStatus: asString(record.sourceStatus) as AssistantActionPayload["externalStatus"],
        sources: normalizeSources(record.sources),
      },
    };
  }

  if (type === "alarm") {
    const time = asString(record.time);
    if (!time) return { ok: false, errors: ["alarm.time is required"] };
    return { ok: true, warnings: [], value: { type, title: asString(record.title) ?? "Alarma", time, repeat: asString(record.repeat), note: asString(record.note) } };
  }

  if (type === "reminder") {
    const title = asString(record.title);
    if (!title) return { ok: false, errors: ["reminder.title is required"] };
    return { ok: true, warnings: [], value: { type, title, dueText: asString(record.dueText), note: asString(record.note) } };
  }

  if (type === "shopping_list") {
    const items = asStringArray(record.items);
    if (!items?.length) return { ok: false, errors: ["shopping_list.items is required"] };
    return { ok: true, warnings: [], value: { type, title: asString(record.title), items, dueText: asString(record.dueText), note: asString(record.note) } };
  }

  if (type === "plan") {
    const items = normalizePlanItems(record.items);
    if (!items.length) return { ok: false, errors: ["plan.items is required"] };
    return { ok: true, warnings: [], value: { type, title: asString(record.title), items, note: asString(record.note) } };
  }

  if (type === "comparison") {
    const items = Array.isArray(record.items)
      ? record.items
          .map(asRecord)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map((item) => ({
            title: asString(item.title) ?? "",
            price: asString(item.price),
            vendor: asString(item.vendor),
            url: asString(item.url),
            evidence: asString(item.evidence),
            score: asNumber(item.score),
          }))
          .filter((item) => item.title)
          .slice(0, 6)
      : [];
    if (!items.length) return { ok: false, errors: ["comparison.items is required"] };
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        title: asString(record.title),
        items,
        criteria: asStringArray(record.criteria),
        recommendation: asString(record.recommendation),
        sources: normalizeSources(record.sources),
      },
    };
  }

  if (type === "research_sources") {
    const summary = asString(record.summary);
    const sourceStatus = asString(record.sourceStatus) as AssistantActionPayload["externalStatus"] | undefined;
    const sources = normalizeSources(record.sources) ?? [];
    if (!summary) return { ok: false, errors: ["research_sources.summary is required"] };
    if (!sources.length && sourceStatus !== "pending" && sourceStatus !== "failed" && sourceStatus !== "not_configured") {
      return { ok: false, errors: ["research_sources needs sources or explicit non-verified sourceStatus"] };
    }
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        title: asString(record.title),
        summary,
        mode: asString(record.mode) as AssistantActionPayload["webMode"],
        sources,
        sourceStatus,
        followUpQuestion: asString(record.followUpQuestion),
      },
    };
  }

  if (type === "money_summary") {
    const summaryItems = Array.isArray(record.summaryItems)
      ? record.summaryItems
          .map(asRecord)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map((item) => ({ label: asString(item.label) ?? "", value: asString(item.value) ?? "", detail: asString(item.detail) }))
          .filter((item) => item.label && item.value)
          .slice(0, 8)
      : undefined;
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        title: asString(record.title),
        total: asNumber(record.total),
        currency: asString(record.currency),
        summaryItems,
        recommendation: asString(record.recommendation),
      },
    };
  }

  if (type === "saved_record") {
    const records = normalizeSavedRecords(record.records);
    if (!records.length) return { ok: false, errors: ["saved_record.records is required"] };
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        title: asString(record.title),
        records,
      },
    };
  }

  if (type === "proactive_signal") {
    const category = asString(record.category) as Extract<UiBlock, { type: "proactive_signal" }>["category"] | undefined;
    const title = asString(record.title);
    const body = asString(record.body);
    if (!category || !title || !body) return { ok: false, errors: ["proactive_signal requires category, title and body"] };
    return {
      ok: true,
      warnings: [],
      value: {
        type,
        category,
        severity: asString(record.severity) as Extract<UiBlock, { type: "proactive_signal" }>["severity"],
        title,
        body,
        timestampLabel: asString(record.timestampLabel),
        sourceStatus: asString(record.sourceStatus) as AssistantActionPayload["externalStatus"],
        actionLabel: asString(record.actionLabel),
        followUpQuestion: asString(record.followUpQuestion),
        sources: normalizeSources(record.sources),
      },
    };
  }

  if (type === "resource_bundle") {
    return { ok: false, errors: ["resource_bundle is produced by local artifact tools, not model composer"] };
  }

  if (type === "activity_group") {
    return { ok: false, errors: ["activity_group is produced by local activity tools, not model composer"] };
  }

  return { ok: false, errors: ["unsupported uiBlock"] };
}

export function validateUiBlocks(value: unknown, limit = 4): UiBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(validateUiBlock)
    .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
    .map((result) => result.value)
    .slice(0, limit);
}

export function validateRouterResult(value: unknown): Validation<RouterResult> {
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["router result must be an object"] };
  const errors: string[] = [];
  const intent = normalizeIntent(record.intent, errors);
  if (!intent) return { ok: false, errors };
  const missingContext = Array.isArray(record.missingContext)
    ? record.missingContext
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          slot: asString(item.slot) ?? "context",
          question: asString(item.question) ?? "",
        }))
        .filter((item) => item.question)
        .slice(0, 3)
    : undefined;
  const toolCallResults = Array.isArray(record.toolCalls) ? record.toolCalls.map(validateToolCall) : [];
  const invalidToolCalls = toolCallResults.filter((result): result is Extract<typeof result, { ok: false }> => !result.ok);
  if (invalidToolCalls.length) {
    return { ok: false, errors: invalidToolCalls.flatMap((result) => result.errors) };
  }
  const toolCalls = toolCallResults
    .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
    .map((result) => result.value)
    .slice(0, 4);
  const directUiBlocks = validateUiBlocks(record.directUiBlocks);
  return {
    ok: true,
    warnings: [],
    value: {
      intent,
      missingContext: missingContext?.length ? missingContext : undefined,
      toolCalls,
      directReply: asString(record.directReply),
      directUiBlocks,
    },
  };
}

export function validateComposerResult(value: unknown): Validation<ComposerResult> {
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["composer result must be an object"] };
  const reply = asString(record.reply);
  if (!reply) return { ok: false, errors: ["composer.reply is required"] };
  return {
    ok: true,
    warnings: [],
    value: {
      reply,
      uiBlocks: validateUiBlocks(record.ui_blocks ?? record.uiBlocks),
    },
  };
}

export function parseJsonObjectStrict(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new SchemaValidationError("Empty model response", ["empty_response"]);
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    throw new SchemaValidationError("Model response is not valid JSON", ["invalid_json"]);
  }
}
