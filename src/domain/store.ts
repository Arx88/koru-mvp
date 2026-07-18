import { applyBackendTurnToState } from "./turn";
// Fase 2.14: brain.ts eliminado (motor client-side legacy).
// submitReflection se mantiene como stub que lanza error — el flujo
// activo usa runBackendAgentTurn via KoruProvider.submitEntry.
import { executeApprovedAction } from "./executor";
import { commitmentIdentityKey, mergeDueHint, uniqueCommitmentList } from "./commitments";
import { createDefaultRuntimeSettings, runFreeLlmEmbedding } from "./freellmapi";
import {
  clearLegacyState,
  clearPersistedState,
  getActiveUserId,
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
  // TIER S — nuevos tipos
  Plan,
  PlanStep,
  Checklist,
  ChecklistItem,
  Habit,
  HabitLog,
  Routine,
  ExercisePlan,
  ExerciseSession,
  WorkoutLog,
  ShoppingList,
  ShoppingItem,
  WellbeingLog,
  Person,
  UserProfile,
  UserPreferences,
  Decision,
  WeatherCache,
  UiBlock,
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

export function createInitialState(userId: string = "default"): KoruState {
  const now = nowIso();
  return {
    userId,
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
    language: "es",
    // 🔴 KORU 3.0 — preferences default con voz de Koru desactivada
    preferences: {
      theme: "light", fontScale: "medium", haptics: true, sounds: true,
      reducedMotion: false, highContrast: false,
      koruVoiceEnabled: false, koruVoiceRate: 1.0,
    },
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
    userId: parsed.userId ?? initial.userId, // 🔴 Multi-cuenta: preservar userId
    runtime,
    heartbeat: { ...initial.heartbeat, ...parsed.heartbeat },
    voicePreference: { ...initial.voicePreference, ...parsed.voicePreference },
    // 🔴 KORU 3.0 — merge preferences para no perder campos al cargar estado viejo
    preferences: { ...initial.preferences, ...parsed.preferences },
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
    const userId = getActiveUserId();
    const persisted = await readPersistedState(userId);
    if (persisted) return normalizeState({ ...persisted, userId });
    const legacy = normalizeState({ ...readLegacyState(), userId });
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

// Fase 2.14: submitReflection eliminado (usaba brain.ts que fue removido).
// El flujo activo usa runBackendAgentTurn via KoruProvider.submitEntry.
export async function submitReflection(
  _state: KoruState,
  _text: string,
  _transcriptSource: DailyEntry["transcriptSource"] = "typed",
  _history: KoruConversationMessage[] = [],
): Promise<{ state: KoruState; entry: DailyEntry; response: string }> {
  throw new Error("submitReflection is deprecated. Use runBackendAgentTurn via KoruProvider.submitEntry instead.");
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
    memories: state.memories.map((memory) => {
      if (memory.id !== id) return memory;
      // 🔴 P2 — push prior text to editHistory BEFORE mutating. Sólo si el
      // texto realmente cambió (evita entradas duplicadas al revertir al
      // mismo valor, etc.).
      const priorText = memory.text;
      const editHistory =
        priorText === cleanText
          ? memory.editHistory
          : [
              ...(memory.editHistory ?? []),
              {
                timestamp: now,
                field: "text" as const,
                before: priorText,
                after: cleanText,
              },
            ];
      return {
        ...memory,
        text: cleanText,
        confidence: Math.max(memory.confidence, 0.92),
        updatedAt: now,
        editHistory,
      };
    }),
    updatedAt: now,
  };
  saveState(next);
  return next;
}

/**
 * 🔴 P2 — Memory conflict resolution.
 * Marca `keepId` como confirmed (subiendo confidence) y `supersedeId` como
 * superseded. Lo invoca MemoryConflictResolver desde KoruProvider cuando el
 * usuario elige cuál de dos memorias contradictorias conservar.
 */
export function resolveMemoryConflict(
  state: KoruState,
  keepId: string,
  supersedeId: string,
): KoruState {
  if (keepId === supersedeId) return state;
  const now = nowIso();
  const next = {
    ...state,
    memories: state.memories.map((memory) => {
      if (memory.id === keepId) {
        return {
          ...memory,
          status: "confirmed" as const,
          confidence: Math.max(memory.confidence, 0.9),
          confirmedAt: now,
          updatedAt: now,
          useForSuggestions: memory.useForSuggestions ?? memory.sensitivity === "normal",
        };
      }
      if (memory.id === supersedeId) {
        return {
          ...memory,
          status: "superseded" as const,
          updatedAt: now,
        };
      }
      return memory;
    }),
    updatedAt: now,
  };
  next.stage = stageFor(next);
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

// ═══════════════════════════════════════════════════════════════
// TIER S — Nuevos reducers para entidades funcionales v2
// ═══════════════════════════════════════════════════════════════

// ─── Plans ───
export function createPlan(state: KoruState, title: string, steps: Omit<PlanStep, "id" | "order" | "done">[]): KoruState {
  const now = nowIso();
  const plan: Plan = {
    id: createId("plan"),
    title,
    steps: steps.map((s, i) => ({ ...s, id: createId("step"), order: i, done: false })),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const next = { ...state, plans: [plan, ...(state.plans ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

export function togglePlanStep(state: KoruState, planId: string, stepId: string): KoruState {
  const now = nowIso();
  let completedStepTitle: string | null = null;
  let completedPlanTitle: string | null = null;
  let allStepsDone = false;

  const plans = (state.plans ?? []).map(p => {
    if (p.id !== planId) return p;
    // 🔴 KORU 3.0 — detectar el step que se va a marcar como done
    // (antes del toggle) para crear una memory de actividad completada.
    const stepBeingToggled = p.steps.find(s => s.id === stepId);
    if (stepBeingToggled && !stepBeingToggled.done) {
      completedStepTitle = stepBeingToggled.title;
      completedPlanTitle = p.title;
    }
    const steps = p.steps.map(s =>
      s.id === stepId ? { ...s, done: !s.done, doneAt: !s.done ? now : undefined } : s
    );
    allStepsDone = steps.every(s => s.done);
    return { ...p, steps, status: allStepsDone ? "completed" as const : p.status, updatedAt: now };
  });

  // 🔴 KORU 3.0 — Crear memory cuando un step se completa.
  // Esto permite que Koru "recuerde" que actividades hizo el usuario,
  // para no volver a sugerirlas y para referenciarlas en futuras conversaciones.
  let memories = state.memories;
  let records = state.records;
  if (completedStepTitle && completedPlanTitle) {
    const memoryText = `Actividad completada: ${completedStepTitle} (del plan "${completedPlanTitle}")`;
    const newMemory: MemoryFact = {
      id: createId("mem"),
      kind: "task",
      text: memoryText,
      confidence: 0.95,
      sensitivity: "normal",
      status: "confirmed",
      rootQuote: completedStepTitle,
      useForSuggestions: true,
      createdAt: now,
      updatedAt: now,
      sourceEntryId: `plan_${planId}_step_${stepId}`,
    };
    memories = [newMemory, ...(state.memories ?? [])];

    // También crear un record de actividad completada
    const newRecord = {
      id: createId("rec"),
      domain: "work" as const,
      kind: "deadline" as const,
      title: `✓ ${completedStepTitle}`,
      value: completedStepTitle,
      notes: `Completado del plan: ${completedPlanTitle}`,
      collection: "Actividades completadas",
      tags: ["plan", "completado"],
      createdAt: now,
      updatedAt: now,
      sourceEntryId: `plan_${planId}_step_${stepId}`,
    };
    records = [newRecord, ...(state.records ?? [])];
  }

  const next = { ...state, plans, memories, records, updatedAt: now };
  saveState(next);
  return next;
}

export function archivePlan(state: KoruState, planId: string): KoruState {
  const now = nowIso();
  const plans = (state.plans ?? []).map(p =>
    p.id === planId ? { ...p, status: "archived" as const, archivedAt: now, updatedAt: now } : p
  );
  const next = { ...state, plans, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Checklists ───
export function createChecklist(state: KoruState, title: string, items: Omit<ChecklistItem, "id" | "order">[]): KoruState {
  const now = nowIso();
  const checklist: Checklist = {
    id: createId("checklist"),
    title,
    items: items.map((it, i) => ({ ...it, id: createId("citem"), order: i })),
    status: "active",
    createdAt: now,
  };
  const next = { ...state, checklists: [checklist, ...(state.checklists ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

export function toggleChecklistItem(state: KoruState, checklistId: string, itemId: string): KoruState {
  const now = nowIso();
  const checklists = (state.checklists ?? []).map(c => {
    if (c.id !== checklistId) return c;
    const items = c.items.map(it =>
      it.id === itemId ? { ...it, doneAt: it.doneAt ? undefined : now } : it
    );
    const allDone = items.every(it => it.doneAt);
    return { ...c, items, status: allDone ? "completed" as const : c.status, completedAt: allDone ? now : undefined };
  });
  const next = { ...state, checklists, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Habits ───
export function createHabit(state: KoruState, label: string, icon: string, cadence: Habit["cadence"], target: number, unit?: string, anchorTime?: string, id?: string): KoruState {
  const now = nowIso();
  const habit: Habit = {
    id: id ?? createId("habit"),
    label, icon, cadence, target, unit, anchorTime,
    active: true,
    createdAt: now,
  };
  const next = { ...state, habits: [habit, ...(state.habits ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

export function logHabit(state: KoruState, habitId: string, value: number): KoruState {
  const now = nowIso();
  const today = now.slice(0, 10);
  const log: HabitLog = {
    id: createId("hlog"),
    habitId,
    date: today,
    value,
    completedAt: now,
  };
  // Remove existing log for today if present (idempotent)
  const habitLogs = [
    log,
    ...(state.habitLogs ?? []).filter(l => !(l.habitId === habitId && l.date === today)),
  ].slice(0, 1000);
  const next = { ...state, habitLogs, updatedAt: now };
  saveState(next);
  return next;
}

export function computeStreak(habitId: string, logs: HabitLog[]): number {
  const habitLogs = logs.filter(l => l.habitId === habitId).sort((a, b) => b.date.localeCompare(a.date));
  if (habitLogs.length === 0) return 0;
  let streak = 0;
  let expectedDate = new Date().toISOString().slice(0, 10);
  for (const log of habitLogs) {
    if (log.date === expectedDate) {
      streak++;
      const d = new Date(expectedDate);
      d.setDate(d.getDate() - 1);
      expectedDate = d.toISOString().slice(0, 10);
    } else if (log.date < expectedDate) {
      break;
    }
  }
  return streak;
}

/**
 * 🔴 Pausa un hábito sin perder la racha. El streak se computa desde
 * HabitLog history (que queda intacto), así que al reanudar el hábito
 * vuelve a aparecer con su racha anterior. Sólo setea `active = false`
 * y limpia `archivedAt` (no es archive, es pause).
 */
export function pauseHabit(state: KoruState, habitId: string): KoruState {
  const now = nowIso();
  const habits = (state.habits ?? []).map(h =>
    h.id === habitId ? { ...h, active: false, archivedAt: undefined } : h
  );
  const next = { ...state, habits, updatedAt: now };
  saveState(next);
  return next;
}

/**
 * 🔴 Reanuda un hábito previamente pausado. Vuelve a `active = true` y
 * limpia cualquier `archivedAt`. La racha anterior (si quedó viva en
 * HabitLog history) sigue siendo computable.
 */
export function resumeHabit(state: KoruState, habitId: string): KoruState {
  const now = nowIso();
  const habits = (state.habits ?? []).map(h =>
    h.id === habitId ? { ...h, active: true, archivedAt: undefined } : h
  );
  const next = { ...state, habits, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Routines ───
export function createRoutine(state: KoruState, name: string, anchorTime: string, habitIds: string[], daysOfWeek: number[]): KoruState {
  const now = nowIso();
  const routine: Routine = {
    id: createId("routine"),
    name, anchorTime, habitIds, daysOfWeek,
    createdAt: now,
  };
  const next = { ...state, routines: [routine, ...(state.routines ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

// ─── ExercisePlans ───
export function createExercisePlan(state: KoruState, name: string, weeksTotal: number, sessions: Omit<ExerciseSession, "id" | "order">[]): KoruState {
  const now = nowIso();
  const plan: ExercisePlan = {
    id: createId("explan"),
    name, weeksTotal,
    sessions: sessions.map((s, i) => ({ ...s, id: createId("exsess"), order: i })),
    currentSessionIdx: 0,
    createdAt: now,
    status: "active",
  };
  const next = { ...state, exercisePlans: [plan, ...(state.exercisePlans ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

export function logWorkout(state: KoruState, planId: string, sessionId: string, exercises: WorkoutLog["exercises"], durationMin: number, kcal?: number): KoruState {
  const now = nowIso();
  const log: WorkoutLog = {
    id: createId("wlog"),
    planId, sessionId,
    date: now,
    exercises, durationMin, kcal,
  };
  // Advance currentSessionIdx
  const exercisePlans = (state.exercisePlans ?? []).map(p => {
    if (p.id !== planId) return p;
    const sessions = p.sessions.map(s => s.id === sessionId ? { ...s, completedAt: now } : s);
    const nextIdx = Math.min(p.currentSessionIdx + 1, sessions.length - 1);
    const allDone = sessions.every(s => s.completedAt);
    return { ...p, sessions, currentSessionIdx: nextIdx, status: allDone ? "completed" as const : p.status };
  });
  const next = { ...state, workoutLogs: [log, ...(state.workoutLogs ?? [])].slice(0, 200), exercisePlans, updatedAt: now };
  saveState(next);
  return next;
}

// ─── ShoppingLists ───
export function createShoppingList(state: KoruState, title: string, items: Omit<ShoppingItem, "id" | "order" | "checked">[], store?: string): KoruState {
  const now = nowIso();
  const list: ShoppingList = {
    id: createId("shoplist"),
    title, store,
    items: items.map((it, i) => ({ ...it, id: createId("sitem"), order: i, checked: false })),
    status: "active",
    createdAt: now,
  };
  const next = { ...state, shoppingLists: [list, ...(state.shoppingLists ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

export function toggleShoppingItem(state: KoruState, listId: string, itemId: string): KoruState {
  const now = nowIso();
  const shoppingLists = (state.shoppingLists ?? []).map(l => {
    if (l.id !== listId) return l;
    const items = l.items.map(it =>
      it.id === itemId ? { ...it, checked: !it.checked, checkedAt: !it.checked ? now : undefined } : it
    );
    const allChecked = items.every(it => it.checked);
    const totalSpent = items.filter(it => it.checked && it.price).reduce((sum, it) => sum + (it.price ?? 0), 0);
    return { ...l, items, totalSpent, status: allChecked ? "completed" as const : l.status, completedAt: allChecked ? now : undefined };
  });
  const next = { ...state, shoppingLists, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Wellbeing ───
export function logWellbeing(state: KoruState, metric: WellbeingLog["metric"], value: number, unit: string, source: WellbeingLog["source"] = "manual"): KoruState {
  const now = nowIso();
  const today = now.slice(0, 10);
  const log: WellbeingLog = {
    id: createId("wblog"),
    date: today,
    metric, value, unit, source,
  };
  // Replace existing log for today+metric
  const wellbeingLogs = [
    log,
    ...(state.wellbeingLogs ?? []).filter(l => !(l.date === today && l.metric === metric)),
  ].slice(0, 500);
  const next = { ...state, wellbeingLogs, updatedAt: now };
  saveState(next);
  return next;
}

// ─── People ───
export function addPerson(state: KoruState, name: string, relationship?: string, birthday?: string): KoruState {
  const now = nowIso();
  const person: Person = {
    id: createId("person"),
    name, relationship, birthday,
  };
  const next = { ...state, people: [person, ...(state.people ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

// ─── UserProfile ───
export function updateUserProfile(state: KoruState, profile: Partial<UserProfile>): KoruState {
  const now = nowIso();
  const next = { ...state, userProfile: { ...state.userProfile, ...profile }, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Preferences ───
export function updatePreferences(state: KoruState, prefs: Partial<UserPreferences>): KoruState {
  const now = nowIso();
  const defaults: UserPreferences = {
    theme: "light", fontScale: "medium", haptics: true, sounds: true,
    reducedMotion: false, highContrast: false,
    koruVoiceEnabled: false, koruVoiceRate: 1.0,
  };
  const next = { ...state, preferences: { ...defaults, ...state.preferences, ...prefs }, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Decisions ───
export function createDecision(state: KoruState, question: string, options: Decision["options"], factors: Decision["factors"], weights: Record<string, number>): KoruState {
  const now = nowIso();
  const decision: Decision = {
    id: createId("decision"),
    question, options, factors, weights,
    linkedMemoryIds: [],
    createdAt: now,
  };
  const next = { ...state, decisions: [decision, ...(state.decisions ?? [])], updatedAt: now };
  saveState(next);
  return next;
}

/**
 * 🔴 v4 — Registra el outcome de una decisión ya tomada (chosen option + 1-5
 * satisfaction). El reducer:
 *  1. Actualiza `Decision.outcome` con chosenOptionId/decidedAt/satisfaction1to5.
 *  2. Crea un Commitment de follow-up 90 días en el futuro para re-chequear
 *     la satisfacción real (el usuario puede cerrarlo antes si quiere).
 *  3. Crea un MemoryFact kind "preference" basado en la opción elegida.
 *     - satisfaction >= 4 → confianza alta (0.85), refuerza la preferencia.
 *     - satisfaction <= 2 → confianza baja (0.35), debilita la preferencia.
 *     - satisfaction 3    → confianza media (0.6), neutral.
 *
 * Idempotente: si la decisión ya tenía outcome, lo sobrescribe y NO crea
 * otro Commitment/MemoryFact (usa los linkedMemoryIds para encontrar el
 * previo y reemplazarlo, evitando duplicados).
 */
export function updateDecisionOutcome(
  state: KoruState,
  decisionId: string,
  outcome: {
    chosenOptionId: string;
    decidedAt: string;
    satisfaction1to5: number;
    notes?: string;
  },
): KoruState {
  const now = nowIso();
  const decisions = state.decisions ?? [];
  const decision = decisions.find((d) => d.id === decisionId);
  if (!decision) return state;

  // 1. Actualizar el outcome de la Decision.
  const updatedDecision: Decision = {
    ...decision,
    outcome: {
      chosenOptionId: outcome.chosenOptionId,
      decidedAt: outcome.decidedAt,
      satisfaction1to5: Math.max(1, Math.min(5, Math.round(outcome.satisfaction1to5))),
      notes: outcome.notes,
      followUpAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
  const nextDecisions = decisions.map((d) => (d.id === decisionId ? updatedDecision : d));

  // 2. Commitment de follow-up (90 días).
  const followUpCommitment: Commitment = {
    id: createId("commit"),
    title: `Follow-up decisión: ${decision.question.slice(0, 60)}`,
    dueHint: `follow-up decision ${decisionId}`,
    dueAt: updatedDecision.outcome!.followUpAt,
    status: "open",
    createdAt: now,
    sourceEntryId: decisionId,
  };

  // 3. MemoryFact kind "preference" basado en la opción elegida + satisfaction.
  const chosenOption = decision.options.find((o) => o.id === outcome.chosenOptionId);
  const satisfaction = updatedDecision.outcome!.satisfaction1to5;
  const confidence = satisfaction >= 4 ? 0.85 : satisfaction <= 2 ? 0.35 : 0.6;
  const verdict = satisfaction >= 4
    ? "buena experiencia"
    : satisfaction <= 2
      ? "mala experiencia"
      : "experiencia neutra";

  // Buscar un MemoryFact previo del mismo outcome (idempotencia: reemplazar).
  const prevMemoryId = decision.linkedMemoryIds.find((id) =>
    state.memories.some((m) => m.id === id && m.kind === "preference"),
  );
  const newMemory: MemoryFact = {
    id: prevMemoryId ?? createId("mem"),
    kind: "preference",
    text: chosenOption
      ? `Elegí "${chosenOption.label}" para "${decision.question}" — ${verdict} (${satisfaction}/5)`
      : `Decidí sobre "${decision.question}" — ${verdict} (${satisfaction}/5)`,
    confidence,
    sensitivity: "normal",
    status: "confirmed",
    createdAt: prevMemoryId ? (state.memories.find((m) => m.id === prevMemoryId)?.createdAt ?? now) : now,
    updatedAt: now,
    confirmedAt: now,
    rootQuote: chosenOption?.label,
    useForSuggestions: satisfaction >= 4,
    sourceEntryId: decisionId,
  };
  const nextMemories = prevMemoryId
    ? state.memories.map((m) => (m.id === prevMemoryId ? newMemory : m))
    : [newMemory, ...state.memories];

  // Vincular el nuevo MemoryFact a la decisión (si recién creado).
  const nextLinkedMemoryIds = prevMemoryId
    ? decision.linkedMemoryIds
    : [...decision.linkedMemoryIds, newMemory.id];
  const finalDecision: Decision = { ...updatedDecision, linkedMemoryIds: nextLinkedMemoryIds };
  const finalDecisions = nextDecisions.map((d) => (d.id === decisionId ? finalDecision : d));

  const next: KoruState = {
    ...state,
    decisions: finalDecisions,
    memories: nextMemories,
    commitments: [followUpCommitment, ...state.commitments],
    updatedAt: now,
  };
  saveState(next);
  return next;
}

// ─── Weather cache ───
export function updateWeatherCache(state: KoruState, cache: WeatherCache): KoruState {
  const now = nowIso();
  const next = { ...state, weatherCache: cache, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Brief ───
export function setLastBrief(state: KoruState, date: string, block?: UiBlock): KoruState {
  const now = nowIso();
  const next = { ...state, lastBriefDate: date, lastBriefBlock: block, updatedAt: now };
  saveState(next);
  return next;
}

// ─── Memory: forget (GDPR Art 17) ───
export function forgetMemory(state: KoruState, memoryId: string): KoruState {
  const now = nowIso();
  const memories = state.memories.filter(m => m.id !== memoryId);
  const next = { ...state, memories, updatedAt: now };
  saveState(next);
  return next;
}

// ─── P0 FIX: Snooze real para alarm/reminder ───
export function snoozeCommitment(state: KoruState, commitmentId: string, minutes: number): KoruState {
  const now = nowIso();
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const commitments = state.commitments.map(c =>
    c.id === commitmentId
      ? { ...c, dueAt: snoozeUntil, dueHint: `Pospuesto ${minutes} min`, remindedAt: undefined }
      : c
  );
  const next = { ...state, commitments, updatedAt: now };
  saveState(next);
  return next;
}
