import type { AssistantPlanItem, AssistantSource, Commitment, LifeRecord, MemoryFact, UiBlock } from "../../domain/types";

export type WeatherData = {
  type: "weather";
  city: string;
  now?: string;
  range?: string;
  rain?: string;
  wind?: string;
  advice: string;
  sources: AssistantSource[];
};

export type SearchData = {
  type: "search";
  mode: "news" | "research" | "shopping" | "world";
  title: string;
  summary: string;
  sources: AssistantSource[];
  comparisonItems?: NonNullable<Extract<UiBlock, { type: "comparison" }>["items"]>;
  deferredDataCard?: Promise<UiBlock | null>;
};

export type PlanData = {
  type: "plan";
  title: string;
  items: AssistantPlanItem[];
  context: string[];
};

export type LocalActionData = {
  type: "local_action";
  requiresApproval: boolean;
  block: UiBlock;
  commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
};

export type PersonalQueryData = {
  type: "personal_query";
  block: UiBlock;
};

export type MemoryCaptureData = {
  type: "memory_capture";
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
};

export type PersonalCaptureData = {
  type: "personal_capture";
  block: UiBlock;
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  commitments?: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  memoryCandidates?: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
};

export type BuiltinToolResult =
  | WeatherData
  | SearchData
  | PlanData
  | LocalActionData
  | PersonalQueryData
  | MemoryCaptureData
  | PersonalCaptureData;

export type ToolExecution = {
  id: string;
  name: string;
  result: Record<string, unknown>;
};

export type BuiltinToolContext = {
  state: Record<string, unknown>;
  userInput: string;
  chatFn?: (messages: Array<{ role: string; content: string }>) => Promise<string>;
};

export interface BuiltinToolHandler {
  name: string;
  run(args: Record<string, unknown>, ctx: BuiltinToolContext): Promise<BuiltinToolResult & { deferredDataCard?: Promise<UiBlock | null> }>;
}
