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
  provider: "nvidia" | "openrouter" | "minimax" | "bluesminds";
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

async function postAgentTurn(
  body: unknown,
  timeoutMs: number,
  onChunk?: (chunk: KoruBackendTurnResponse) => void,
): Promise<KoruBackendTurnResponse> {
  const controller = new AbortController();
  // Con streaming, timeoutMs es una ventana de INACTIVIDAD, no un tope total:
  // cada chunk recibido la resetea. Un informe (deep_research) puede tardar
  // 3-4 min legítimos bajo rate-limits, pero mientras streamee progreso el
  // turno sigue vivo. Abortamos solo si el server se queda mudo.
  let timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const resetIdleTimeout = () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  };
  try {
    const payload = onChunk ? { ...(body as Record<string, unknown>), stream: true } : body;
    const response = await fetch("/api/koru/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/x-ndjson") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastChunk: KoruBackendTurnResponse | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetIdleTimeout();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as KoruBackendTurnResponse;
            lastChunk = chunk;
            onChunk?.(chunk);
          } catch {
            /* skip invalid line */
          }
        }
      }
      if (!lastChunk) {
        throw new KoruBackendAgentError("No se recibio ningun chunk del stream.");
      }
      return lastChunk;
    }

    const data = (await response.json().catch(() => ({}))) as KoruBackendTurnResponse & { error?: string };
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
  model?: string,
  onChunk?: (chunk: KoruBackendTurnResponse) => void,
): Promise<KoruBackendTurnResponse> {
  // Sin streaming: evita OOM en el server dev. El onChunk se llama
  // una sola vez con el resultado final.
  return postAgentTurn({ input, state, history, model }, 180_000, undefined);
}
