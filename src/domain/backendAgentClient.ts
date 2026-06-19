import type {
  Commitment,
  KoruConversationMessage,
  KoruState,
  LifeRecord,
  MascotState,
  MemoryFact,
  ToolResult,
  UiBlock,
} from "./types";

export type KoruUnderstanding = {
  literalRequest: string;
  userGoal: string;
  unstatedNeeds: string[];
  assumptions: string[];
  confidence: number;
};

export type KoruSuggestedAction = {
  id: string;
  label: string;
  kind: "save" | "remind" | "watch" | "compare_more" | "approve" | "calendar" | "research";
  requiresApproval: boolean;
  payload?: Record<string, unknown>;
};

export type KoruBackendTurnResponse = {
  reply: string;
  uiBlocks: UiBlock[];
  suggestedActions: KoruSuggestedAction[];
  understanding: KoruUnderstanding;
  memoryCandidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[];
  commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[];
  records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[];
  toolResults: ToolResult[];
  stateEvents: Array<{ kind: "thinking" | "searching" | "comparing" | "planning" | "saving" | "done"; label: string }>;
  mascotState?: MascotState;
  provider: "nvidia" | "openrouter";
  model?: string;
  fallbackReason?: string;
};

export class KoruBackendAgentError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "KoruBackendAgentError";
    this.status = status;
  }
}

async function postAgentTurn(body: unknown, timeoutMs: number): Promise<KoruBackendTurnResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/koru/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as KoruBackendTurnResponse & { error?: string };
    if (!response.ok) {
      throw new KoruBackendAgentError(data.error ?? `Koru backend respondio ${response.status}`, response.status);
    }
    if (!data.reply || !data.understanding) {
      throw new KoruBackendAgentError("Koru backend devolvio una respuesta incompleta.");
    }
    return data;
  } catch (error) {
    if (error instanceof KoruBackendAgentError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new KoruBackendAgentError("El agente tardo demasiado en responder.");
    }
    throw new KoruBackendAgentError(error instanceof Error ? error.message : "No pude contactar el agente.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function runBackendAgentTurn(
  input: string,
  state: KoruState,
  history: KoruConversationMessage[],
): Promise<KoruBackendTurnResponse> {
  return postAgentTurn({ input, state, history }, 75_000);
}
