import { analyzeReflection } from "./brain";
import { applyBackendTurnToState } from "./turn";
// analyzeReflection/submitReflection are kept for tests and legacy callers.
// New code should use the backend agent flow via KoruProvider/sendMessage.
import { executeApprovedAction } from "./actions";
import { commitmentIdentityKey, mergeDueHint, uniqueCommitmentList } from "./commitments";
import { createDefaultRuntimeSettings, runFreeLlmEmbedding } from "./freellmapi";
import {
  clearLegacyState,
  clearPersistedState,
  readLegacyState,
  readPersistedState,
  writeLegacyState,
  writePersistedState,
} from "./persistence";
import type { LearningPreference, RelevantMemory } from "./types";
import { koruSoulCapsule } from "./soul";
import { dueAtFromText, nextDueAtFromRecurrence } from "./time";
import type {
  CalendarEvent,
  Commitment,
  KoruConversationMessage,
  DailyEntry,
  EnergyEvent,
  HeartbeatSettings,
  AssistantAction,
  KoruStage,
  KoruState,
  LifeRecord,
  ModelCall,
  MemoryFact,
  ProactiveNudge,
  RuntimeSettings,
  VoicePreference,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function createDefaultHeartbeat(): HeartbeatSettings {
  return {
    enabled: true,
    activeStartHour: 8,
    activeEndHour: 21,
    maxNudgesPerDay: 3,
    dailyNudgeCount: 0,
  };
}

function dedupeCommitments(commitments: Commitment[]): Commitment[] {
  const openByKey = new Map<string, Commitment>();
  const resolved: Commitment[] = [];

  for (const commitment of commitments) {
    if (commitment.status !== "open") {
      resolved.push(commitment);
      continue;
    }
    const key = commitmentIdentityKey(commitment);
    const existing = openByKey.get(key);
    if (!existing) {
      openByKey.set(key, commitment);
      continue;
    }
    openByKey.set(key, {
      ...existing,
      dueHint: mergeDueHint(existing.dueHint, commitment.dueHint),
      dueAt: existing.dueAt ?? commitment.dueAt,
      recurrence: existing.recurrence ?? commitment.recurrence,
    });
  }

  return [...openByKey.values(), ...resolved];
}

export function createInitialState(): KoruState {
  const now = nowIso();
  return {
    stage: "seed",
    trustedEnergy: 0,
    totalEnergy: 0,
    createdAt: now,
    updatedAt: now,
    voicePreference: koruSoulCapsule.defaults,
    runtime: createDefaultRuntimeSettings(),
    heartbeat: createDefaultHeartbeat(),
    memories: [],
    commitments: [],
    actions: [],
    calendarEvents: [],
    records: [],
    entries: [],
    energyEvents: [],
    nudges: [],
    modelCalls: [],
    ephemeralMode: false,
    durableMemoryEnabled: true,
    actionPreparationEnabled: true,
    worldSignalsEnabled: false,
    learningPreferences: [],
  };
}

function normalizeState(parsed?: Partial<KoruState> | null): KoruState {
  const initial = createInitialState();
  const envRuntime = createDefaultRuntimeSettings();
  if (!parsed) return initial;
  const runtime = { ...initial.runtime, ...parsed.runtime };
  if (envRuntime.openModelEnabled) {
    runtime.openModelEnabled = true;
    runtime.openModelBaseUrl = envRuntime.openModelBaseUrl;
    runtime.openModelApiKey = envRuntime.openModelApiKey;
    runtime.openModelModel = envRuntime.openModelModel;
  }
  if (envRuntime.freeLlmApiEnabled) {
    runtime.freeLlmApiEnabled = true;
    runtime.freeLlmApiBaseUrl = envRuntime.freeLlmApiBaseUrl;
    runtime.freeLlmApiKey = envRuntime.freeLlmApiKey;
    runtime.freeLlmApiModel = envRuntime.freeLlmApiModel;
    runtime.embeddingsEnabled = envRuntime.embeddingsEnabled;
  }
  return {
    ...initial,
    ...parsed,
    runtime,
    heartbeat: { ...initial.heartbeat, ...parsed.heartbeat },
    voicePreference: { ...initial.voicePreference, ...parsed.voicePreference },
    memories: (parsed.memories ?? []).map((memory) => ({
      useForSuggestions: memory.useForSuggestions ?? memory.sensitivity === "normal",
      ...memory,
    })),
    commitments: dedupeCommitments((parsed.commitments ?? []).map((commitment) => ({
      ...commitment,
      dueAt: commitment.dueAt ?? dueAtFromText(`${commitment.title} ${commitment.dueHint}`, new Date(commitment.createdAt ?? Date.now())),
    }))),
    actions: parsed.actions ?? [],
    calendarEvents: parsed.calendarEvents ?? [],
    records: parsed.records ?? [],
    entries: parsed.entries ?? [],
    energyEvents: parsed.energyEvents ?? [],
    nudges: parsed.nudges ?? [],
    modelCalls: parsed.modelCalls ?? [],
  } as KoruState;
}

export function loadState(): KoruState {
  return normalizeState(readLegacyState());
}

export async function loadPersistedState(): Promise<KoruState> {
  try {
    const persisted = await readPersistedState();
    if (persisted) return normalizeState(persisted);
    const legacy = normalizeState(readLegacyState());
    await writePersistedState(legacy);
    return legacy;
  } catch {
    return loadState();
  }
}

export function saveState(state: KoruState): void {
  const snapshot = normalizeState({ ...state, updatedAt: nowIso() });
  writeLegacyState(snapshot);
  void writePersistedState(snapshot).catch(() => undefined);
}

function saveEphemeralSessionSnapshot(previous: KoruState, current: KoruState): void {
  saveState({
    ...current,
    memories: previous.memories,
    commitments: previous.commitments,
    actions: previous.actions,
    calendarEvents: previous.calendarEvents,
    records: previous.records,
    entries: previous.entries,
    energyEvents: previous.energyEvents,
    nudges: previous.nudges,
    modelCalls: previous.modelCalls,
    totalEnergy: previous.totalEnergy,
    trustedEnergy: previous.trustedEnergy,
    stage: previous.stage,
  });
}

export function resetState(): KoruState {
  const state = createInitialState();
  clearLegacyState();
  void clearPersistedState().catch(() => undefined);
  saveState(state);
  return state;
}

export function stageFor(state: Pick<KoruState, "trustedEnergy" | "memories" | "entries">): KoruStage {
  const confirmed = state.memories.filter((memory) => memory.status === "confirmed").length;
  if (state.trustedEnergy >= 360 && confirmed >= 10 && state.entries.length >= 5) return "garden";
  if (state.trustedEnergy >= 220 && confirmed >= 7 && state.entries.length >= 3) return "born";
  if (state.trustedEnergy >= 130 && confirmed >= 4) return "roots";
  if (state.trustedEnergy >= 45 || confirmed >= 2) return "sprout";
  return "seed";
}

export function applyTurnResultToState(
  state: KoruState,
  text: string,
  transcriptSource: DailyEntry["transcriptSource"],
  result: Parameters<typeof applyBackendTurnToState>[3],
): ReturnType<typeof applyBackendTurnToState> {
  return applyBackendTurnToState(state, text, transcriptSource, result);
}

/**
 * @deprecated Use the backend agent flow via KoruProvider.sendMessage instead.
 * Kept for tests and legacy callers.
 */
export async function submitReflection(
  state: KoruState,
  text: string,
  transcriptSource: DailyEntry["transcriptSource"] = "typed",
  history: KoruConversationMessage[] = [],
): Promise<{ state: KoruState; entry: DailyEntry; response: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("Koru necesita que le cuentes algo para poder ordenarlo.");
  }

  const analysisState = state.ephemeralMode || !state.durableMemoryEnabled
    ? { ...state, ephemeralMode: true }
    : state;
  const startedAt = performance.now();
  const analysis = await analyzeReflection(cleanText, analysisState, history);
  const latencyMs = Math.round(performance.now() - startedAt);
  const createdAt = nowIso();
  const entryId = createId("entry");
  const memories: MemoryFact[] = analysis.memoryCandidates.map((candidate) => ({
    ...candidate,
    useForSuggestions: candidate.useForSuggestions ?? candidate.sensitivity === "normal",
    id: createId("mem"),
    createdAt,
    sourceEntryId: entryId,
  }));
  const existingCommitmentsByKey = new Map(
    state.commitments
      .filter((commitment) => commitment.status === "open")
      .map((commitment) => [commitmentIdentityKey(commitment), commitment]),
  );
  const incomingCommitments = uniqueCommitmentList(analysis.commitments);
  const dueHintUpdates = new Map<string, string>();
  const dueAtUpdates = new Map<string, string>();
  const recurrenceUpdates = new Map<string, Commitment["recurrence"]>();
  const commitments: Commitment[] = incomingCommitments
    .filter((commitment) => {
      const key = commitmentIdentityKey(commitment);
      const existing = existingCommitmentsByKey.get(key);
      if (existing) {
        const mergedDueHint = mergeDueHint(existing.dueHint, commitment.dueHint);
        if (mergedDueHint !== existing.dueHint) dueHintUpdates.set(existing.id, mergedDueHint);
        if (!existing.dueAt && commitment.dueAt) dueAtUpdates.set(existing.id, commitment.dueAt);
        if (!existing.recurrence && commitment.recurrence) recurrenceUpdates.set(existing.id, commitment.recurrence);
        return false;
      }
      existingCommitmentsByKey.set(key, {
        ...commitment,
        id: key,
        createdAt,
        sourceEntryId: entryId,
      });
      return true;
    })
    .map((commitment) => ({
      ...commitment,
      id: createId("commit"),
      createdAt,
      sourceEntryId: entryId,
    }));
  const actions: AssistantAction[] = state.actionPreparationEnabled
    ? analysis.actionProposals.map((action) => ({
        ...action,
        id: createId("act"),
        createdAt,
        sourceEntryId: entryId,
      }))
    : [];
  const records: LifeRecord[] = analysis.records.map((record) => ({
    ...record,
    id: createId("rec"),
    createdAt,
    sourceEntryId: entryId,
  }));
  const nudges: ProactiveNudge[] = analysis.nudges.map((nudge) => ({
    ...nudge,
    id: createId("nudge"),
    createdAt,
  }));
  const shouldPersistEntry = !state.ephemeralMode;
  const energyEvent: EnergyEvent = {
    id: createId("energy"),
    createdAt,
    source: state.ephemeralMode ? "ephemeral_reflection" : "daily_reflection",
    points: analysis.energyAwarded,
    explanation: state.ephemeralMode
      ? "Entrada sin memoria permanente."
      : "Entrada ordenada con cosas utiles para volver a mirar.",
  };
  const providerFellBack = analysis.model?.startsWith("fallback-after-") ?? false;
  const modelCall: ModelCall = {
    id: createId("call"),
    createdAt,
    taskType: "reflection_analysis",
    provider: analysis.provider,
    model: analysis.model,
    success: !providerFellBack,
    latencyMs,
    summary: providerFellBack
      ? `Proveedor no disponible; use fallback local. ${analysis.memoryCandidates.length} memoria(s), ${incomingCommitments.length} pendiente(s), ${analysis.actionProposals.length} accion(es)`
      : `${analysis.memoryCandidates.length} memoria(s), ${incomingCommitments.length} pendiente(s), ${analysis.actionProposals.length} accion(es)`,
  };
  const entry: DailyEntry = {
    id: entryId,
    text: cleanText,
    createdAt,
    summary: analysis.summary,
    transcriptSource,
    energyAwarded: analysis.energyAwarded,
    sentiment: analysis.sentiment,
    memoryIds: memories.map((memory) => memory.id),
    commitmentIds: commitments.map((commitment) => commitment.id),
    actionIds: actions.map((action) => action.id),
    recordIds: records.map((record) => record.id),
    activeMemoryIds: analysis.activeMemoryIds,
    brainProvider: analysis.provider,
    brainModel: analysis.model,
  };
  const next: KoruState = {
    ...state,
    totalEnergy: state.totalEnergy + analysis.energyAwarded,
    trustedEnergy: state.trustedEnergy + Math.round(analysis.energyAwarded * (state.ephemeralMode ? 0.35 : 0.6)),
    entries: shouldPersistEntry ? [entry, ...state.entries] : state.entries,
    memories: [...memories, ...state.memories],
    commitments: [
      ...commitments,
      ...state.commitments.map((commitment) =>
        ({
          ...commitment,
          dueHint: dueHintUpdates.get(commitment.id) ?? commitment.dueHint,
          dueAt: dueAtUpdates.get(commitment.id) ?? commitment.dueAt,
          recurrence: recurrenceUpdates.get(commitment.id) ?? commitment.recurrence,
        }),
      ),
    ],
    actions: [...actions, ...state.actions],
    records: [...records, ...state.records].slice(0, 500),
    nudges: [...nudges, ...state.nudges],
    energyEvents: shouldPersistEntry ? [energyEvent, ...state.energyEvents] : state.energyEvents,
    modelCalls: shouldPersistEntry ? [modelCall, ...state.modelCalls].slice(0, 120) : state.modelCalls,
    updatedAt: createdAt,
  };
  next.stage = stageFor(next);
  if (state.ephemeralMode) {
    saveEphemeralSessionSnapshot(state, next);
  } else {
    saveState(next);
  }
  return { state: next, entry, response: analysis.response };
}

export function confirmMemory(state: KoruState, id: string): KoruState {
  const now = nowIso();
  const next = {
    ...state,
    memories: state.memories.map((memory) =>
      memory.id === id
        ? {
            ...memory,
            status: "confirmed" as const,
            confidence: Math.max(memory.confidence, 0.9),
            confirmedAt: now,
            updatedAt: now,
            useForSuggestions: memory.useForSuggestions ?? memory.sensitivity === "normal",
          }
        : memory,
    ),
    trustedEnergy: state.trustedEnergy + 18,
    updatedAt: now,
  };
  next.stage = stageFor(next);
  if (state.ephemeralMode) {
    saveEphemeralSessionSnapshot(state, next);
  } else {
    saveState(next);
  }
  return next;
}

export function rejectMemory(state: KoruState, id: string): KoruState {
  const now = nowIso();
  const next = {
    ...state,
    memories: state.memories.map((memory) =>
      memory.id === id ? { ...memory, status: "rejected" as const, updatedAt: now } : memory,
    ),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function updateMemoryText(state: KoruState, id: string, text: string): KoruState {
  const cleanText = text.trim();
  if (!cleanText) return state;
  const now = nowIso();
  const next = {
    ...state,
    memories: state.memories.map((memory) =>
      memory.id === id
        ? {
            ...memory,
            text: cleanText,
            confidence: Math.max(memory.confidence, 0.92),
            updatedAt: now,
          }
        : memory,
    ),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function toggleMemorySuggestions(state: KoruState, id: string): KoruState {
  const now = nowIso();
  const next = {
    ...state,
    memories: state.memories.map((memory) =>
      memory.id === id
        ? { ...memory, useForSuggestions: memory.useForSuggestions === false ? true : false, updatedAt: now }
        : memory,
    ),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function completeCommitment(state: KoruState, id: string): KoruState {
  const now = nowIso();
  const next = {
    ...state,
    commitments: state.commitments.map((commitment) =>
      commitment.id === id
        ? commitment.recurrence
          ? { ...commitment, dueAt: nextDueAtFromRecurrence(commitment.dueAt, commitment.recurrence), remindedAt: undefined, status: "open" as const }
          : { ...commitment, status: "done" as const }
        : commitment,
    ),
    trustedEnergy: state.trustedEnergy + 12,
    updatedAt: now,
  };
  next.stage = stageFor(next);
  saveState(next);
  return next;
}

function updateLearningPreference(
  state: KoruState,
  type: string | undefined,
  accepted: boolean,
): LearningPreference[] {
  if (!type) return state.learningPreferences;
  const now = nowIso();
  const existing = state.learningPreferences.find((p) => p.type === type);
  if (existing) {
    return state.learningPreferences.map((p) =>
      p.type === type
        ? {
            ...p,
            acceptedCount: accepted ? p.acceptedCount + 1 : p.acceptedCount,
            rejectedCount: accepted ? p.rejectedCount : p.rejectedCount + 1,
            lastInteractionAt: now,
          }
        : p,
    );
  }
  return [
    ...state.learningPreferences,
    {
      type,
      acceptedCount: accepted ? 1 : 0,
      rejectedCount: accepted ? 0 : 1,
      lastInteractionAt: now,
    },
  ];
}

function enhancementTypeFromAction(action?: { payload?: Record<string, unknown> }): string | undefined {
  if (!action?.payload) return undefined;
  const type = action.payload.enhancementType;
  return typeof type === "string" ? type : undefined;
}

export function rejectAction(state: KoruState, id: string): KoruState {
  const now = nowIso();
  const action = state.actions.find((item) => item.id === id);
  const type = enhancementTypeFromAction(action);
  const next = {
    ...state,
    actions: state.actions.map((action) =>
      action.id === id ? { ...action, status: "rejected" as const, updatedAt: now } : action,
    ),
    learningPreferences: updateLearningPreference(state, type, false),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function approveAndExecuteAction(state: KoruState, id: string): KoruState {
  const action = state.actions.find((item) => item.id === id);
  if (!action || action.status === "executed" || action.status === "rejected") return state;

  const now = nowIso();
  const type = enhancementTypeFromAction(action);
  const execution = executeApprovedAction(
    state,
    { ...action, status: "approved", updatedAt: now },
    createId,
    now,
  );
  const done = new Set(execution.commitmentIdsDone);
  const existingKeys = new Set(state.commitments.map((commitment) => commitmentIdentityKey(commitment)));
  const newCommitments = execution.commitments.filter((commitment) => {
    const key = commitmentIdentityKey(commitment);
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
  const next = {
    ...state,
    actions: state.actions.map((item) => (item.id === id ? execution.action : item)),
    learningPreferences: updateLearningPreference(state, type, true),
    commitments: [
      ...newCommitments,
      ...state.commitments.map((commitment) =>
        done.has(commitment.id)
          ? commitment.recurrence
            ? { ...commitment, dueAt: nextDueAtFromRecurrence(commitment.dueAt, commitment.recurrence), remindedAt: undefined, status: "open" as const }
            : { ...commitment, status: "done" as const }
          : commitment,
      ),
    ],
    calendarEvents: [...execution.calendarEvents, ...state.calendarEvents]
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 200),
    nudges: [...execution.nudges, ...state.nudges].slice(0, 80),
    trustedEnergy: state.trustedEnergy + 14,
    energyEvents: [
      {
        id: createId("energy"),
        createdAt: now,
        source: "action_executed",
        points: 14,
        explanation: "Koru preparo una accion aprobada.",
      },
      ...state.energyEvents,
    ],
    updatedAt: now,
  };
  next.stage = stageFor(next);
  saveState(next);
  return next;
}

export function dismissNudge(state: KoruState, id: string): KoruState {
  const now = nowIso();
  const next = {
    ...state,
    nudges: state.nudges.map((nudge) => (nudge.id === id ? { ...nudge, dismissed: true } : nudge)),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function updateUserName(state: KoruState, userName: string): KoruState {
  const next = { ...state, userName: userName.trim() || undefined, updatedAt: nowIso() };
  saveState(next);
  return next;
}

export function addOnboardingMemories(state: KoruState, facts: string[]): KoruState {
  const cleaned = Array.from(new Set(facts.map((fact) => fact.trim()).filter((fact) => fact.length > 4))).slice(0, 4);
  if (!cleaned.length || state.ephemeralMode || !state.durableMemoryEnabled) return state;
  const now = nowIso();
  const existing = new Set(state.memories.map((memory) => memory.text.toLowerCase()));
  const memories: MemoryFact[] = cleaned
    .filter((fact) => !existing.has(fact.toLowerCase()))
    .map((fact) => ({
      id: createId("mem"),
      kind: "profile",
      text: fact,
      confidence: 0.9,
      sensitivity: "normal",
      status: "confirmed",
      createdAt: now,
      confirmedAt: now,
      updatedAt: now,
      rootQuote: fact,
      useForSuggestions: true,
      sourceEntryId: "onboarding",
    }));
  if (!memories.length) return state;
  const next = {
    ...state,
    memories: [...memories, ...state.memories],
    trustedEnergy: state.trustedEnergy + memories.length * 18,
    updatedAt: now,
  };
  next.stage = stageFor(next);
  saveState(next);
  return next;
}

export function updateVoicePreference(
  state: KoruState,
  key: keyof VoicePreference,
  value: number,
): KoruState {
  const next = {
    ...state,
    voicePreference: {
      ...state.voicePreference,
      [key]: Math.max(0, Math.min(10, Math.round(value))),
    },
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export function toggleEphemeralMode(state: KoruState): KoruState {
  const next = { ...state, ephemeralMode: !state.ephemeralMode, updatedAt: nowIso() };
  saveState(next);
  return next;
}

export function setDurableMemoryEnabled(state: KoruState, enabled: boolean): KoruState {
  const next = {
    ...state,
    durableMemoryEnabled: enabled,
    ephemeralMode: enabled ? false : true,
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export function setHeartbeatEnabled(state: KoruState, enabled: boolean): KoruState {
  const next = {
    ...state,
    heartbeat: {
      ...state.heartbeat,
      enabled,
    },
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export function setWorldSignalsEnabled(state: KoruState, enabled: boolean): KoruState {
  const next = {
    ...state,
    worldSignalsEnabled: enabled,
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export function setActionPreparationEnabled(state: KoruState, enabled: boolean): KoruState {
  const next = { ...state, actionPreparationEnabled: enabled, updatedAt: nowIso() };
  saveState(next);
  return next;
}

export function updateRuntimeSettings(state: KoruState, patch: Partial<RuntimeSettings>): KoruState {
  const next = {
    ...state,
    runtime: {
      ...state.runtime,
      ...patch,
      freeLlmApiBaseUrl: patch.freeLlmApiBaseUrl?.trim() ?? state.runtime.freeLlmApiBaseUrl,
      freeLlmApiKey: patch.freeLlmApiKey?.trim() ?? state.runtime.freeLlmApiKey,
      freeLlmApiModel: patch.freeLlmApiModel?.trim() ?? state.runtime.freeLlmApiModel,
      openModelBaseUrl: patch.openModelBaseUrl?.trim() ?? state.runtime.openModelBaseUrl,
      openModelApiKey: patch.openModelApiKey?.trim() ?? state.runtime.openModelApiKey,
      openModelModel: patch.openModelModel?.trim() ?? state.runtime.openModelModel,
    },
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export async function hydrateMemoryEmbedding(state: KoruState, id: string): Promise<KoruState> {
  const memory = state.memories.find((item) => item.id === id);
  if (!memory || memory.status !== "confirmed" || memory.embedding?.length) return state;
  const startedAt = performance.now();
  try {
    const result = await runFreeLlmEmbedding(state.runtime, memory.text);
    const now = nowIso();
    const next = {
      ...state,
      memories: state.memories.map((item) =>
        item.id === id
          ? {
              ...item,
              embedding: result.embedding,
              embeddingModel: result.model ?? result.provider ?? "freellmapi",
              updatedAt: now,
            }
          : item,
      ),
      modelCalls: [
        {
          id: createId("call"),
          createdAt: now,
          taskType: "embedding" as const,
          provider: "freellmapi" as const,
          model: result.model ?? result.provider,
          success: true,
          latencyMs: Math.round(performance.now() - startedAt),
          summary: `Embedding para memoria ${id}`,
        },
        ...state.modelCalls,
      ].slice(0, 120),
      updatedAt: now,
    };
    saveState(next);
    return next;
  } catch {
    const now = nowIso();
    const next = {
      ...state,
      modelCalls: [
        {
          id: createId("call"),
          createdAt: now,
          taskType: "embedding" as const,
          provider: "freellmapi" as const,
          success: false,
          latencyMs: Math.round(performance.now() - startedAt),
          summary: `Embedding pendiente para memoria ${id}`,
        },
        ...state.modelCalls,
      ].slice(0, 120),
      updatedAt: now,
    };
    saveState(next);
    return next;
  }
}

export function addCalendarEvents(
  state: KoruState,
  events: Array<Omit<CalendarEvent, "id" | "createdAt">>,
): KoruState {
  const now = nowIso();
  const existingKeys = new Set(
    state.calendarEvents.map((event) => `${event.sourceRef ?? ""}|${event.title}|${event.startsAt}`),
  );
  const nextEvents = events
    .map((event) => ({
      ...event,
      id: createId("cal"),
      createdAt: now,
    }))
    .filter((event) => {
      const key = `${event.sourceRef ?? ""}|${event.title}|${event.startsAt}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
  const next = {
    ...state,
    calendarEvents: [...nextEvents, ...state.calendarEvents]
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 200),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function removeCalendarEvent(state: KoruState, id: string): KoruState {
  const next = {
    ...state,
    calendarEvents: state.calendarEvents.filter((event) => event.id !== id),
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export function updateHeartbeatSettings(
  state: KoruState,
  patch: Partial<HeartbeatSettings>,
): KoruState {
  const next = {
    ...state,
    heartbeat: {
      ...state.heartbeat,
      ...patch,
      activeStartHour: Math.max(0, Math.min(23, Math.round(patch.activeStartHour ?? state.heartbeat.activeStartHour))),
      activeEndHour: Math.max(0, Math.min(23, Math.round(patch.activeEndHour ?? state.heartbeat.activeEndHour))),
      maxNudgesPerDay: Math.max(1, Math.min(6, Math.round(patch.maxNudgesPerDay ?? state.heartbeat.maxNudgesPerDay))),
    },
    updatedAt: nowIso(),
  };
  saveState(next);
  return next;
}

export function applyHeartbeatNudges(
  state: KoruState,
  nudges: Array<Omit<ProactiveNudge, "id" | "createdAt">>,
  runAt = new Date(),
): KoruState {
  const now = runAt.toISOString();
  const day = now.slice(0, 10);
  const countToday = state.heartbeat.dailyNudgeDate === day ? state.heartbeat.dailyNudgeCount : 0;
  const allowed = Math.max(0, state.heartbeat.maxNudgesPerDay - countToday);
  const existingKeys = new Set(
    state.nudges
      .filter((nudge) => !nudge.dismissed)
      .map((nudge) => `${nudge.source ?? "brain"}|${nudge.sourceId ?? ""}|${nudge.title}`),
  );
  const fresh = nudges
    .filter((nudge) => {
      const key = `${nudge.source ?? "heartbeat"}|${nudge.sourceId ?? ""}|${nudge.title}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    })
    .slice(0, allowed)
    .map((nudge) => ({
      ...nudge,
      id: createId("nudge"),
      createdAt: now,
    }));
  const remindedIds = new Set(fresh.filter((nudge) => nudge.source === "commitment" && nudge.sourceId).map((nudge) => nudge.sourceId));
  const next = {
    ...state,
    heartbeat: {
      ...state.heartbeat,
      lastRunAt: now,
      dailyNudgeDate: day,
      dailyNudgeCount: countToday + fresh.length,
    },
    nudges: [...fresh, ...state.nudges].slice(0, 80),
    commitments: state.commitments.map((commitment) =>
      remindedIds.has(commitment.id) ? { ...commitment, remindedAt: now } : commitment,
    ),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function recordModelCall(state: KoruState, call: Omit<ModelCall, "id" | "createdAt">): KoruState {
  const now = nowIso();
  const next = {
    ...state,
    modelCalls: [{ ...call, id: createId("call"), createdAt: now }, ...state.modelCalls].slice(0, 120),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

export function exportState(state: KoruState): string {
  return JSON.stringify({ ...state, updatedAt: nowIso() }, null, 2);
}

export function importState(raw: string): KoruState {
  const parsed = JSON.parse(raw) as Partial<KoruState>;
  const next = {
    ...normalizeState(parsed),
    updatedAt: nowIso(),
  } as KoruState;
  saveState(next);
  return next;
}

export function selectRelevantMemories(
  memories: MemoryFact[],
  input: string,
  maxResults = 5,
): RelevantMemory[] {
  const inputWords = new Set(
    input.toLowerCase().split(/\W+/).filter(w => w.length > 3),
  );

  if (inputWords.size === 0) return [];

  const scored = memories
    .filter(m => m.status === "confirmed" || m.status === "candidate")
    .map(m => {
      const textLower = m.text.toLowerCase();
      const matchCount = Array.from(inputWords).filter(w => textLower.includes(w)).length;
      const createdTime = new Date(m.createdAt).getTime();
      const recencyBonus = !isNaN(createdTime) && Date.now() - createdTime < 7 * 24 * 60 * 60 * 1000 ? 0.2 : 0;
      const score = matchCount * 0.5 + recencyBonus + (m.confidence ?? 0.7) * 0.3;
      return { memory: m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ memory }) => ({
      text: memory.text,
      kind: memory.kind,
      confidence: memory.confidence ?? 0.7,
    }));

  return scored;
}
