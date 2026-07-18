import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AssistantAction,
  UiBlock,
  DailyEntry,
  HeartbeatSettings,
  KoruState,
  KoruStage,
  LifeRecord,
  LifeDomain,
  LifeRecordKind,
  MascotState,
  MemoryFact,
  CommitmentStatus,
  // TIER S — nuevos tipos para los reducers de store
  PlanStep,
  ChecklistItem,
  Habit,
  ExerciseSession,
  WorkoutLog,
  ShoppingItem,
  WellbeingLog,
  UserProfile,
  UserPreferences,
  Decision,
  WeatherCache,
  ProactiveNudge,
  Attachment,
} from "../domain/types";
import {
  applyHeartbeatNudges,
  addOnboardingMemories,
  approveAndExecuteAction,
  completeCommitment,
  confirmMemory as confirmMemoryInStore,
  createId,
  createInitialState,
  dismissNudge,
  exportState,
  loadPersistedState,
  rejectAction,
  rejectMemory,
  resetState,
  saveState,
  setActionPreparationEnabled,
  setDurableMemoryEnabled,
  setHeartbeatEnabled,
  setWorldSignalsEnabled,
  toggleMemorySuggestions,
  toggleEphemeralMode,
  updateHeartbeatSettings,
  updateMemoryText,
  // TIER S — nuevos reducers (importados con sufijo *Reducer para evitar colisión
  // con los wrappers del mismo nombre que exponemos vía KoruContext).
  createPlan as createPlanReducer,
  togglePlanStep as togglePlanStepReducer,
  archivePlan as archivePlanReducer,
  createChecklist as createChecklistReducer,
  toggleChecklistItem as toggleChecklistItemReducer,
  createHabit as createHabitReducer,
  logHabit as logHabitReducer,
  pauseHabit as pauseHabitReducer,
  resumeHabit as resumeHabitReducer,
  computeStreak as computeStreakReducer,
  createRoutine as createRoutineReducer,
  createExercisePlan as createExercisePlanReducer,
  logWorkout as logWorkoutReducer,
  createShoppingList as createShoppingListReducer,
  toggleShoppingItem as toggleShoppingItemReducer,
  logWellbeing as logWellbeingReducer,
  addPerson as addPersonReducer,
  updateUserProfile as updateUserProfileReducer,
  updatePreferences as updatePreferencesReducer,
  createDecision as createDecisionReducer,
  updateDecisionOutcome as updateDecisionOutcomeReducer,
  updateWeatherCache as updateWeatherCacheReducer,
  setLastBrief as setLastBriefReducer,
  forgetMemory as forgetMemoryReducer,
  snoozeCommitment as snoozeCommitmentReducer,
  resolveMemoryConflict as resolveMemoryConflictReducer,
} from "../domain/store";
import { computeDecision } from "../domain/decisionEngine";
import { runBackendAgentTurn } from "../domain/backendAgentClient";
import { buildHeartbeatNudges } from "../domain/heartbeat";
import { runWebNavigation, webResultToPayload } from "../domain/web";
import { dueLabel } from "../domain/time";
import { inferActivity, type AgentActivity } from "../domain/agentKernel";
import { shouldAutoRunAction } from "../domain/toolRegistry";
import { checkDueReminders, syncScheduledReminders, scheduleReminderNotification, schedulePreciseTimeout, requestNotificationPermission } from "./NotificationManager";
import { speak, isVoiceEnabled, setVoiceEnabled, stopSpeaking } from "../domain/koruVoice";
import { actionToTurnItem, applyBackendTurnToState, type KoruTurnItem, type KoruChatTurn } from "../domain/turn";
// Fase 2.6: audit extraído a módulo propio
import { auditEnabled, auditSessionId, writeAuditEvent, auditStateSnapshot, auditTurnItems, auditStateDelta } from "./audit";
// Fase 2.6: adapters extraídos a módulo propio
import { stageForEnergy as stageForEnergyImpl, domainStageToNew, domainStatusToMemoryStatus, domainKindToCategory, greetingTurn, readChatTurns, saveChatTurns, patchUiBlockWithWebResult, actionConfirmationText, CHAT_STORAGE_KEY } from "./adapters";
// 🔴 Offline cache — IndexedDB-backed 24h rolling window + offline message queue
import { cacheTurn, isOnline, onOnlineStatusChange, enqueueOfflineMessage, readOfflineQueue, dequeueOfflineMessage, type CachedTurn } from "../domain/offlineCache";
// 🔴 v2: Analytics — tracking de Create adoption + reopen rate
import { track as analyticsTrack } from "../domain/analytics";
// 🔴 P2 — Memory conflict resolution modal
import { MemoryConflictResolver } from "./MemoryConflictResolver";
export type { KoruTurnItem, KoruChatTurn };

export type Stage = "semilla" | "brote" | "raices" | "nacimiento" | "jardin";

export type MemoryStatus = "reciente" | "confirmada" | "dudosa" | "importante" | "sensible" | "archived" | "superseded" | "rejected";

export type MemoryCategory =
  | "rutina" | "trabajo" | "relacion" | "preferencia" | "objetivo" | "salud";

export type Priority = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
  kind?: "commitment" | "action" | "nudge";
};

export type Memory = {
  id: string;
  text: string;
  status: MemoryStatus;
  category: MemoryCategory;
  origin: string;
  savedOn: string;
  useForSuggestions: boolean;
};

export type HistoryEntry = {
  id: string;
  time: string;
  kind: "check-in" | "memoria" | "cierre";
  title: string;
  detail: string;
  reason?: string;
  energy?: number;
};

export type Permission = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};


export const STAGE_META: Record<Stage, { label: string; meaning: string; capability: string; minEnergy: number }> = {
  semilla: { label: "Semilla", meaning: "Koru acaba de llegar", capability: "Escucha, resume y ordena", minEnergy: 0 },
  brote: { label: "Brote", meaning: "Ya te entiendo lo suficiente", capability: "Reconoce tu rutina y objetivos", minEnergy: 31 },
  raices: { label: "Raíces", meaning: "Tengo contexto para ayudar mejor", capability: "Detecta patrones y hace follow-ups", minEnergy: 90 },
  nacimiento: { label: "Nacimiento", meaning: "Nací para acompañarte", capability: "Proactividad fina, con tu permiso", minEnergy: 160 },
  jardin: { label: "Jardín vivo", meaning: "Tu jardín se cuida solo", capability: "Memoria editable, autonomía completa", minEnergy: 260 },
};

const STAGE_ORDER: Stage[] = ["semilla", "brote", "raices", "nacimiento", "jardin"];

// Fase 2.6: audit + adapters + storage extraídos a ./audit.ts y ./adapters.ts

export function stageForEnergy(energy: number): Stage {
  return stageForEnergyImpl(energy, STAGE_META);
}

// Koru 2.0: fases reales del pipeline (emitidas por el backend en stateEvents).
// Se usan para la píldora de estado ("Creando rutina…") y la barra de progreso.
export const PHASE_ORDER = ["thinking", "searching", "comparing", "planning", "saving", "done"] as const;
export const PHASE_LABEL: Record<string, string> = {
  thinking: "Pensando…",
  searching: "Buscando…",
  comparing: "Comparando…",
  planning: "Creando rutina…",
  saving: "Guardando…",
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 P2 — Memory conflict detection (pure helper).
// Dada una memoria nueva y la lista de memorias existentes, devuelve la
// primera memoria existente que contradice a la nueva:
//   1. Mismo `kind`.
//   2. Comparten 3+ palabras significativas (>4 chars, sin stopwords ni
//      acentos) → "overlapping keywords".
//   3. Los textos NO son substring uno del otro (si lo son, no hay
//      contradicción real, sólo una expansión).
//   4. Sólo memorias activas (candidate/confirmed) — no superseded/archived.
// ═══════════════════════════════════════════════════════════════════════════

// Stopwords mínimas en ES/EN para no contar "que", "de", "the", etc. como
// keywords significativas. La lista es intencionalmente corta — el filtro
// principal es la longitud > 4 chars.
const CONFLICT_STOPWORDS = new Set([
  "para", "por", "con", "pero", "como", "this", "that", "with", "from",
  "have", "they", "their", "there", "where", "when", "what", "which",
]);

function normalizeWordList(text: string): Set<string> {
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 4 && !CONFLICT_STOPWORDS.has(w));
  return new Set(norm);
}

function isSubstring(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function detectMemoryConflictInState(
  newMemory: MemoryFact,
  existingMemories: MemoryFact[],
): MemoryFact | null {
  if (!newMemory?.text || existingMemories.length === 0) return null;
  const newWords = normalizeWordList(newMemory.text);
  if (newWords.size < 1) return null;
  for (const existing of existingMemories) {
    if (!existing || existing.id === newMemory.id) continue;
    if (existing.kind !== newMemory.kind) continue;
    // Sólo memorias vivas (candidate / confirmed) cuentan como conflicto.
    if (existing.status !== "candidate" && existing.status !== "confirmed") continue;
    const existingWords = normalizeWordList(existing.text);
    if (existingWords.size === 0) continue;
    let overlap = 0;
    for (const w of newWords) {
      if (existingWords.has(w)) overlap++;
    }
    if (overlap < 3) continue;
    // Si los textos son substring uno del otro, no hay contradicción real.
    if (isSubstring(existing.text, newMemory.text)) continue;
    return existing;
  }
  return null;
}

type KoruContextValue = {
  // 🔴 v2: state completo expuesto para que screens (Home, etc.) lean slices
  // no cubiertos por los helpers específicos (commitments, calendarEvents,
  // habits, habitLogs, wellbeingLogs, weatherCache, userProfile, nudges…).
  state: KoruState;
  energy: number;
  roots: number;
  stage: Stage;
  userName: string;
  onboarded: boolean;
  ephemeral: boolean;
  priorities: Priority[];
  memories: Memory[];
  history: HistoryEntry[];
  records: LifeRecord[];
  permissions: Permission[];
  processing: boolean;
  activity: AgentActivity | null;
  phase: string | null;
  chatTurns: KoruChatTurn[];
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  completeOnboarding: (name: string, facts?: string[]) => void;
  togglePriority: (id: string) => void;
  confirmMemory: (id: string) => void;
  pruneMemory: (id: string) => void;
  editMemory: (id: string, text: string) => void;
  toggleMemoryUse: (id: string) => void;
  completeCommitment: (id: string) => void;
  togglePermission: (id: string) => void;
  setEphemeral: (v: boolean) => void;
  // Fase 1 (C6): logRitual era un no-op — eliminado del contexto y de la API.
  submitEntry: (text: string, transcriptSource?: DailyEntry["transcriptSource"], history?: KoruChatTurn[]) => Promise<{ response: string; items: KoruTurnItem[]; state: KoruState; mascotState?: MascotState }>;
  sendMessage: (text: string, transcriptSource?: DailyEntry["transcriptSource"]) => Promise<KoruChatTurn | null>;
  reviewAction: (id: string, approve: boolean) => KoruTurnItem | null;
  toggleTurnLike: (id: string) => void;
  dismissNudge: (id: string) => void;
  setWorldSignals: (enabled: boolean) => void;
  // 🔴 Memory toast: aparece cuando Koru aprende algo del usuario
  memoryToast: { id: string; kind: string; text: string } | null;
  dismissMemoryToast: () => void;
  // 🔴 Morning brief
  morningBrief: any | null;
  dismissMorningBrief: () => void;
  // 🔴 PWA install
  showInstallPrompt: boolean;
  installApp: () => Promise<void>;
  dismissInstallPrompt: () => void;
  // 🔴 Voice (TTS)
  voiceEnabled: boolean;
  toggleVoice: () => void;
  speakReply: (text: string) => void;
  stopVoice: () => void;
  // 🔴 i18n — preferred UI/reply language
  language: "es" | "en";
  setLanguage: (lang: "es" | "en") => void;
  // 🔴 Offline cache — browser online status + offline message queue
  online: boolean;
  queueOfflineMessage: (text: string) => Promise<void>;
  // 🔴 v2: Create flow — alta/baja/modificación de records sin pasar por LLM
  createRecord: (input: { title: string; collection: string; notes?: string; url?: string; kind?: string; tags?: string[]; sourceBlock?: UiBlock; attachments?: Attachment[] }) => Promise<LifeRecord>;
  updateRecord: (id: string, patch: Partial<LifeRecord>) => void;
  deleteRecord: (id: string) => void;
  reopenRecord: (record: LifeRecord) => void;
  reopenedRecord: LifeRecord | null;
  // 🔴 TIER S — nuevos reducers del store (planes, checklists, hábitos, etc.)
  createPlan: (title: string, steps: Omit<PlanStep, "id" | "order" | "done">[]) => void;
  togglePlanStep: (planId: string, stepId: string) => void;
  archivePlan: (planId: string) => void;
  createChecklist: (title: string, items: Omit<ChecklistItem, "id" | "order">[]) => void;
  toggleChecklistItem: (checklistId: string, itemId: string) => void;
  createHabit: (label: string, icon: string, cadence: Habit["cadence"], target: number, unit?: string, anchorTime?: string) => string;
  logHabit: (habitId: string, value: number) => void;
  pauseHabit: (habitId: string) => void;
  resumeHabit: (habitId: string) => void;
  computeStreak: (habitId: string) => number;
  createRoutine: (name: string, anchorTime: string, habitIds: string[], daysOfWeek: number[]) => void;
  createExercisePlan: (name: string, weeksTotal: number, sessions: Omit<ExerciseSession, "id" | "order">[]) => void;
  logWorkout: (planId: string, sessionId: string, exercises: WorkoutLog["exercises"], durationMin: number, kcal?: number) => void;
  createShoppingList: (title: string, items: Omit<ShoppingItem, "id" | "order" | "checked">[], store?: string) => void;
  toggleShoppingItem: (listId: string, itemId: string) => void;
  logWellbeing: (metric: WellbeingLog["metric"], value: number, unit: string, source?: WellbeingLog["source"]) => void;
  addPerson: (name: string, relationship?: string, birthday?: string) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  createDecision: (question: string, options: Decision["options"], factors: Decision["factors"], weights: Record<string, number>) => Decision;
  updateDecisionOutcome: (decisionId: string, outcome: { chosenOptionId: string; decidedAt: string; satisfaction1to5: number; notes?: string }) => void;
  updateWeatherCache: (cache: WeatherCache) => void;
  setLastBrief: (date: string, block?: UiBlock) => void;
  forgetMemory: (memoryId: string) => void;
  snoozeCommitment: (commitmentId: string, minutes: number) => void;
  // 🔴 P2 — Memory conflict resolution
  detectMemoryConflict: (newMemory: MemoryFact) => MemoryFact | null;
  pendingMemoryConflict: { oldMemory: MemoryFact; newMemory: MemoryFact } | null;
  resolveMemoryConflict: (keepId: string, supersedeId: string) => void;
  dismissMemoryConflict: () => void;
  // 🔴 SettingsScreen integrada — wrappers para ajustes que antes estaban dispersos
  updateHeartbeat: (patch: Partial<HeartbeatSettings>) => void;
  exportData: () => void;
  deleteAllData: () => void;
};

const KoruContext = createContext<KoruContextValue | null>(null);

export function KoruProvider({ children }: { children: ReactNode }) {
  const [domainState, setDomainState] = useState<KoruState>(() => createInitialState());
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("koru.onboarded") === "true");
  const [userName, setUserName] = useState(() => localStorage.getItem("koru.username") ?? "");
  const [processing, setProcessing] = useState(false);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  // 🔴 Memory toast: se setea cuando llegan memoryCandidates nuevos y se limpia con dismissMemoryToast
  const [memoryToast, setMemoryToast] = useState<{ id: string; kind: string; text: string } | null>(null);
  // 🔴 Morning brief state
  const [morningBrief, setMorningBrief] = useState<any | null>(null);
  // 🔴 PWA install prompt
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  // 🔴 Voice (TTS)
  const [voiceEnabled, setVoiceEnabledState] = useState(() => localStorage.getItem("koru.voiceEnabled") === "true");
  const [phase, setPhase] = useState<string | null>(null);
  const [chatTurns, setChatTurns] = useState<KoruChatTurn[]>(() => readChatTurns(localStorage.getItem("koru.username") ?? ""));
  // Clave versionada (v2): la clave vieja "koru.selected-model" quedaba pegada con
  // modelos de prueba (ej. llama3.1:8b) y pisaba silenciosamente al proveedor
  // principal (BlueSminds) en CADA turno. v2 arranca en Automático para todos;
  // elegir un modelo vuelve a ser una decisión explícita del usuario.
  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    localStorage.removeItem("koru.selected-model");
    return localStorage.getItem("koru.selected-model.v2") ?? null;
  });
  // 🔴 i18n — preferred language. Persisted in localStorage so the LLM and UI honor it.
  const [language, setLanguageState] = useState<"es" | "en">(() => {
    const stored = localStorage.getItem("koru.language");
    return stored === "en" ? "en" : "es";
  });
  // 🔴 Offline cache — track browser online/offline status
  const [online, setOnline] = useState<boolean>(() => isOnline());
  // Ref to latest sendMessage — lets the offline-queue drain call the current closure.
  const sendMessageRef = useRef<((text: string) => Promise<unknown>) | null>(null);
  // 🔴 v2: record reabiertos desde Collections — renderizan el bloque original
  const [reopenedRecord, setReopenedRecord] = useState<LifeRecord | null>(null);
  const domainStateRef = useRef(domainState);
  const chatTurnsRef = useRef(chatTurns);
  // 🔴 Morning brief scheduler — deduplicación: si ya dispatcheamos el nudge
  // "Buenos días" para hoy (puede pasar cuando loadPersistedState sobreescribe
  // state.lastBriefDate justo después de que ya lo seteamos), no repetir.
  const lastBriefNudgeDateRef = useRef<string | null>(null);

  // 🔴 P2 — Memory conflict resolution. Cuando detectMemoryConflict encuentra
  // una contradicción entre una memoria nueva y una existente, seteamos
  // `pendingMemoryConflict` y el modal <MemoryConflictResolver> se monta
  // encima de todo. resolveMemoryConflict(keepId, supersedeId) despacha el
  // reducer del store y limpia el estado.
  const [pendingMemoryConflict, setPendingMemoryConflict] = useState<{
    oldMemory: MemoryFact;
    newMemory: MemoryFact;
  } | null>(null);

  function commitDomainState(next: KoruState | ((prev: KoruState) => KoruState)) {
    setDomainState((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: KoruState) => KoruState)(prev) : next;
      domainStateRef.current = resolved;
      return resolved;
    });
  }

  function commitChatTurns(next: KoruChatTurn[] | ((prev: KoruChatTurn[]) => KoruChatTurn[])) {
    setChatTurns((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: KoruChatTurn[]) => KoruChatTurn[])(prev) : next;
      chatTurnsRef.current = resolved;
      return resolved;
    });
  }

  useEffect(() => {
    domainStateRef.current = domainState;
  }, [domainState]);

  // 🔴 i18n — sync UI language into domainState so the backend LLM honors it
  useEffect(() => {
    commitDomainState((prev) => (prev.language === language ? prev : { ...prev, language }));
  }, [language]);

  // 🔴 PWA install prompt listener
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      // Show after 30s if not dismissed
      const dismissed = localStorage.getItem("koru.installDismissed");
      if (!dismissed) {
        setTimeout(() => setShowInstallPrompt(true), 30_000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    chatTurnsRef.current = chatTurns;
  }, [chatTurns]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("koruAudit") !== "1" || params.get("reset") !== "1") return;
      const sessionId = `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("koru.audit.enabled", "1");
      sessionStorage.setItem("koru.audit.session", sessionId);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem("koru.onboarded");
      localStorage.removeItem("koru.username");
      const fresh = resetState();
      commitDomainState(fresh);
      setOnboarded(false);
      setUserName("");
      commitChatTurns([greetingTurn()]);
      params.delete("reset");
      const cleanQuery = params.toString();
      const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", cleanUrl);
      writeAuditEvent({
        type: "audit_reset",
        note: "Koru browser memory, onboarding and chat reset for manual audit.",
        state: auditStateSnapshot(fresh),
      });
    } catch {
      // Audit reset is best-effort and should not block the app.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPersistedState().then(async (persisted) => {
      if (!cancelled) {
        const nudges = buildHeartbeatNudges(persisted);
        commitDomainState(nudges.length > 0 ? applyHeartbeatNudges(persisted, nudges) : persisted);
        // 🔴 Sincronizar reminders con notificaciones del navegador
        const userId = persisted.userId ?? "default";
        syncScheduledReminders(persisted.commitments ?? [], userId);
        // Check overdue reminders on app load
        checkDueReminders(userId);

        // 🔴 Morning Brief: si es mañana y no se mostró hoy, generar.
        // 🔴 TIER S: check usa `state.lastBriefDate` (vía persisted.lastBriefDate)
        // como fuente de verdad, con fallback a localStorage para sesiones que
        // todavía no tienen el campo en el store. Esto cumple el contrato del
        // reducer setLastBrief: otras pantallas pueden inspeccionar si ya se
        // mostró hoy leyendo state.lastBriefDate sin tocar localStorage.
        const now = new Date();
        const hour = now.getHours();
        const today = now.toISOString().slice(0, 10);
        const lastBriefDate = persisted.lastBriefDate ?? localStorage.getItem("koru.lastBriefDate");
        if (hour >= 5 && hour <= 11 && lastBriefDate !== today) {
          try {
            // 🔴 FULL state: el endpoint necesita calendarEvents (eventos de
            // hoy), commitments (deadlines debidos hoy), weatherCache, entries
            // (último sentimiento) y memories (contexto de personalidad) para
            // generar un brief completo. Mandamos el estado completo y dejamos
            // que el endpoint filtre lo necesario.
            const stateForBrief = {
              userName: persisted.userName ?? "",
              memories: (persisted.memories ?? [])
                .filter((m: any) => m.status === "confirmed" || m.status === "candidate")
                .slice(0, 10)
                .map((m: any) => ({ kind: m.kind, text: m.text })),
              commitments: (persisted.commitments ?? [])
                .filter((c: any) => c.status === "open")
                .slice(0, 20)
                .map((c: any) => ({ title: c.title, dueHint: c.dueHint, dueAt: c.dueAt, status: c.status })),
              calendarEvents: (persisted.calendarEvents ?? []).slice(0, 20).map((e: any) => ({
                title: e.title,
                startsAt: e.startsAt,
                location: e.location,
              })),
              weatherCache: persisted.weatherCache ?? undefined,
              entries: (persisted.entries ?? []).slice(-3).map((e: any) => ({
                text: e.text,
                sentiment: e.sentiment,
                createdAt: e.createdAt,
              })),
              lastBriefDate,
            };
            const res = await fetch("/api/koru/morning-brief", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state: stateForBrief }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.shouldShow && data.brief) {
                const brief = data.brief;
                // 🔴 Construir morning_brief UiBlock desde el brief del LLM.
                // El LLM devuelve { greeting, items: [{icon, label, value}], reflection }.
                // El UiBlock morning_brief requiere items con {icon, iconColor, label, value, variant?}.
                // La reflection se appendea como un item destacado (variant: "highlight").
                const uiItems: Array<{
                  icon: string;
                  iconColor: string;
                  label: string;
                  value: string;
                  variant?: "default" | "highlight";
                }> = (Array.isArray(brief.items) ? brief.items : [])
                  .filter((it: any) => it && typeof it === "object")
                  .map((it: any, idx: number) => ({
                    icon: String(it.icon ?? "wb_sunny"),
                    iconColor: idx === 0 ? "#6ee7b7" : "#a99be0",
                    label: String(it.label ?? ""),
                    value: String(it.value ?? ""),
                    variant: "default" as const,
                  }));
                if (brief.reflection) {
                  uiItems.push({
                    icon: "lightbulb",
                    iconColor: "#fbbf24",
                    label: "Reflexión",
                    value: String(brief.reflection),
                    variant: "highlight" as const,
                  });
                }
                const briefBlock: UiBlock = {
                  type: "morning_brief",
                  greeting: String(brief.greeting ?? ""),
                  items: uiItems,
                };
                // 🔴 Backwards-compat: MorningBriefCard espera un shape legacy
                // (greeting + weather/tasks/memoryHighlight/suggestion). Mapeamos
                // los items del nuevo brief a los campos legacy para que la
                // card vieja siga renderizando algo útil.
                const legacyBrief = {
                  greeting: String(brief.greeting ?? ""),
                  weather: (brief.items ?? []).find((it: any) => /clima|weather/i.test(String(it.label ?? "")))?.value ?? "",
                  tasks: (brief.items ?? [])
                    .filter((it: any) => /pendiente|deadline|tarea|evento|commit/i.test(String(it.label ?? "")))
                    .map((it: any) => `${it.label}: ${it.value}`),
                  memoryHighlight: (brief.items ?? []).find((it: any) => /memoria|memory/i.test(String(it.label ?? "")))?.value ?? "",
                  suggestion: brief.reflection ?? "",
                };
                setMorningBrief(legacyBrief);
                localStorage.setItem("koru.lastBriefDate", data.date ?? today);
                // 🔴 TIER S: persistir el brief en el store (state.lastBriefDate
                // + state.lastBriefBlock) vía el reducer setLastBrief. Así
                // otras pantallas pueden inspeccionar si ya se mostró hoy sin
                // leer localStorage directamente.
                commitDomainState((prev) => setLastBriefReducer(prev, data.date ?? today, briefBlock));
              }
            }
            // 🔴 Si el endpoint devuelve error (res.ok = false) o data.shouldShow
            // es false, no hacemos nada acá — el useEffect de abajo (morning
            // brief scheduler sin LLM) se encarga del fallback al simple nudge.
          } catch {
            // silent — brief is optional. El scheduler sin LLM hace el fallback.
          }
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  // 🔴 Morning brief scheduler (sin LLM) — se ejecuta en mount y cada vez que
  // `state.lastBriefDate` cambia. Si es de mañana (5-11h) y todavía no se
  // mostró el brief hoy, dispatchea un nudge proactivo "Buenos días" y marca
  // `lastBriefDate = today` para no repetir.
  //
  // A diferencia del useEffect de arriba (que llama a /api/koru/morning-brief
  // y genera el brief real con un LLM), este efecto es best-effort: solo
  // muestra el saludo y deja el flag. Si el backend responde con un brief
  // completo, ese flujo (asíncrono) lo reemplaza / enriquece.
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    const today = now.toISOString().slice(0, 10);
    // Solo dentro de la ventana matutina.
    if (hour < 5 || hour > 11) return;
    // Si ya se mostró el brief hoy (según state.lastBriefDate), no repetir.
    if (domainState.lastBriefDate === today) return;
    // 🔴 Deduplicación: loadPersistedState() puede sobreescribir
    // state.lastBriefDate con el valor persistido (ej. undefined o ayer)
    // DESPUÉS de que ya dispatcheamos el nudge en este mount. Sin este
    // guard, dispararíamos dos "Buenos días" seguidos.
    if (lastBriefNudgeDateRef.current === today) return;
    lastBriefNudgeDateRef.current = today;

    const nudge: ProactiveNudge = {
      id: createId("nudge"),
      title: "Buenos días",
      body: "Tu brief matutino está listo. Tocá para revisar el día.",
      reason: "morning-brief",
      priority: "medium",
      createdAt: new Date().toISOString(),
      source: "brain",
      sourceId: `morning-brief-${today}`,
    };

    // Inyectar el nudge en state.nudges — el heartbeat (60s) lo convertirá en
    // chat turn en su próximo tick. También inyectamos un chat turn directo
    // para que el saludo aparezca de inmediato, sin esperar al heartbeat.
    commitDomainState((prev) => ({
      ...prev,
      nudges: [...(prev.nudges ?? []), nudge],
    }));

    const proactiveTurn: KoruChatTurn = {
      id: `proactive_brief_${Date.now()}`,
      role: "koru",
      text: `${nudge.title}\n${nudge.body}`,
      createdAt: new Date().toISOString(),
      status: "done" as const,
      mascotState: "happy" as const,
    };
    commitChatTurns((prev) => [...prev, proactiveTurn].slice(-120));

    // Marcar como hecho para no repetir hoy. setLastBrief internally calls
    // setLastBriefReducer + saveState, así que también persiste en localStorage.
    setLastBrief(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainState.lastBriefDate]);

  useEffect(() => {
    const runHeartbeat = () => {
      // 🔴 Proactividad: check due reminders y disparar notificaciones
      const userId = domainStateRef.current?.userId ?? "default";
      const { fired, overdue } = checkDueReminders(userId);
      if (fired.length > 0 || overdue.length > 0) {
        console.log("[Koru] Reminders fired:", fired.length, "overdue:", overdue.length);
      }

      commitDomainState((prev) => {
        const nudges = buildHeartbeatNudges(prev);
        return nudges.length > 0 ? applyHeartbeatNudges(prev, nudges) : prev;
      });

      // 🔴 MENSAJES PROACTIVOS EN EL CHAT
      // Si hay nudges nuevos, inyectarlos como mensajes de Koru en el chat.
      // Esto hace que Koru "hable" proactivamente, no solo muestre items invisibles.
      const state = domainStateRef.current;
      if (state && !state.ephemeralMode) {
        const activeNudges = (state.nudges ?? []).filter(n =>
          !n.dismissed && !n.title.startsWith("[proactive_shown]")
        );
        if (activeNudges.length > 0) {
          // Solo inyectar 1 mensaje proactivo por heartbeat tick (no spamear)
          const nudge = activeNudges[0];
          const proactiveTurn: KoruChatTurn = {
            id: `proactive_hb_${Date.now()}`,
            role: "koru",
            text: nudge.title + (nudge.body ? `\n${nudge.body}` : ""),
            createdAt: new Date().toISOString(),
            status: "done" as const,
            mascotState: "happy" as const,
          };
          // Marcar como mostrado para no repetir
          commitDomainState((prev) => ({
            ...prev,
            nudges: (prev.nudges ?? []).map(n =>
              n.id === nudge.id ? { ...n, title: `[proactive_shown] ${n.title}` } : n
            ),
          }));
          commitChatTurns((prev) => [...prev, proactiveTurn].slice(-120));
        }
      }
    };
    // Fase 2.12: pausar heartbeat cuando el tab no está visible.
    // Antes corría cada 60s sin importar si el usuario estaba mirando.
    // Ahora se pausa al ocultar el tab y reanuda al volver, ahorrando CPU.
    let timer = window.setInterval(runHeartbeat, 60_000);
    const onVisibilityChange = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        // Al volver, ejecutar inmediatamente y reiniciar el intervalo
        runHeartbeat();
        timer = window.setInterval(runHeartbeat, 60_000);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    saveChatTurns(chatTurns, !domainState.ephemeralMode);
    // 🔴 Offline cache — also persist last turn to IndexedDB for 24h rolling window.
    // This is best-effort and async; we don't await.
    if (!domainState.ephemeralMode && chatTurns.length > 0) {
      const last = chatTurns[chatTurns.length - 1];
      const userId = domainStateRef.current?.userId ?? "default";
      const cached: CachedTurn = {
        id: `${last.createdAt}_${last.role}`,
        userId,
        role: last.role === "koru" ? "koru" : "user",
        text: last.text,
        createdAt: last.createdAt,
        items: last.items as unknown[] | undefined,
        mascotState: last.mascotState,
        language,
      };
      cacheTurn(cached).catch(() => { /* best-effort */ });
    }
  }, [chatTurns, domainState.ephemeralMode, language]);

  // 🔴 KORU 3.0 — TTS: cuando koruVoiceEnabled está activo y llega un nuevo
  // turno de Koru con texto, reproducirlo con SpeechSynthesis del navegador.
  // Solo se reproduce el ÚLTIMO turno (no re-reproduce al cargar historial).
  const lastSpokenTurnRef = useRef<string | null>(null);
  useEffect(() => {
    const prefs = domainStateRef.current?.preferences;
    if (!prefs?.koruVoiceEnabled) {
      lastSpokenTurnRef.current = null;
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (chatTurns.length === 0) return;
    const lastTurn = chatTurns[chatTurns.length - 1];
    if (lastTurn.role !== "koru") return;
    if (lastTurn.text.trim().length < 2) return;
    // No repetir el mismo turno
    if (lastSpokenTurnRef.current === lastTurn.id) return;
    lastSpokenTurnRef.current = lastTurn.id;
    // Cancelar cualquier síntesis anterior
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lastTurn.text);
    utterance.lang = language === "en" ? "en-US" : "es-ES";
    utterance.rate = prefs.koruVoiceRate ?? 1.0;
    utterance.pitch = 1.0;
    // Intentar usar una voz en español si está disponible
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith("es"));
    if (spanishVoice) utterance.voice = spanishVoice;
    window.speechSynthesis.speak(utterance);
  }, [chatTurns, language]);

  // 🔴 Offline cache — subscribe to online/offline events
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((nextOnline) => {
      setOnline(nextOnline);
      // When coming back online, drain the offline queue (best-effort replay)
      if (nextOnline) {
        const userId = domainStateRef.current?.userId ?? "default";
        readOfflineQueue(userId).then(async (queue) => {
          for (const msg of queue) {
            // Re-submit each queued message; if it succeeds, dequeue it.
            try {
              await sendMessageRef.current?.(msg.text);
              await dequeueOfflineMessage(msg.id);
            } catch {
              // If still failing, leave it queued for the next retry.
              break;
            }
          }
        }).catch(() => { /* best-effort */ });
      }
    });
    return unsubscribe;
  }, []);

  // ── Escuchar mensajes proactivos del engine ──
  useEffect(() => {
    const onProactive = (e: Event) => {
      const turn = (e as CustomEvent).detail as KoruChatTurn;
      if (turn && turn.text) {
        commitChatTurns((prev) => [...prev, turn].slice(-120));
      }
    };
    window.addEventListener("koru:proactive", onProactive);
    return () => window.removeEventListener("koru:proactive", onProactive);
  }, []);

  const energy = domainState.trustedEnergy;
  const roots = domainState.memories.filter((m) => m.status === "confirmed").length;
  const stage = domainStageToNew(domainState.stage);
  const ephemeral = domainState.ephemeralMode;

  const priorities: Priority[] = useMemo(() => {
    const actionItems = domainState.actions
      .filter((a) => a.status === "executed")
      .slice(0, 1)
      .map((a) => ({
        id: a.id,
        label: a.title,
        detail: a.result,
        done: true,
        kind: "action" as const,
      }));
    const nudgeItems = domainState.nudges
      .filter((nudge) => !nudge.dismissed)
      .slice(0, 2)
      .map((nudge) => ({
        id: nudge.id,
        label: nudge.title,
        detail: nudge.body || nudge.reason,
        done: false,
        kind: "nudge" as const,
      }));
    const commitments = domainState.commitments
      .filter((c) => c.status === "open")
      .map((c) => ({
        id: c.id,
        label: c.title,
        detail: dueLabel(c.dueAt, c.dueHint),
        done: false,
        kind: "commitment" as const,
      }))
      .slice(0, Math.max(0, 5 - actionItems.length - nudgeItems.length));
    return [...actionItems, ...nudgeItems, ...commitments];
  }, [domainState.actions, domainState.commitments, domainState.nudges]);

  const memories: Memory[] = useMemo(() =>
    domainState.memories
      .filter((m) => m.status !== "rejected")
      .map((m) => ({
        id: m.id,
        text: m.text,
        status: domainStatusToMemoryStatus(m),
        category: domainKindToCategory(m.kind),
        origin: m.rootQuote || "Extraído de tu conversación reciente.",
        useForSuggestions: m.useForSuggestions !== false,
        savedOn: m.status === "confirmed" && m.confirmedAt
          ? `Confirmado · ${new Date(m.confirmedAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}`
          : m.status === "candidate"
            ? "Por confirmar · pendiente"
            : `Reciente · ${new Date(m.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}`,
      })),
  [domainState.memories]);

  const history: HistoryEntry[] = useMemo(() => {
    const entries: HistoryEntry[] = [];
    for (const entry of domainState.entries.slice(0, 20)) {
      entries.push({
        id: entry.id,
        time: new Date(entry.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
        kind: "check-in",
        title: "Check-in",
        detail: entry.summary || entry.text.slice(0, 100),
        reason: entry.sentiment === "heavy" ? "Estado cargado" : entry.sentiment === "good" ? "Estado positivo" : "Rutina diaria",
        energy: entry.energyAwarded,
      });
    }
    for (const action of domainState.actions.filter((a) => a.status === "executed").slice(0, 20)) {
      entries.push({
        id: action.id,
        time: new Date(action.executedAt ?? action.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
        kind: "cierre",
        title: action.title,
        detail: action.result ?? action.body,
        reason: "Accion aprobada y ejecutada por Koru",
        energy: 14,
      });
    }
    return entries.slice(0, 30);
  }, [domainState.actions, domainState.entries]);

  const permissions: Permission[] = useMemo(() => [
    {
      id: "perm1",
      title: "Memoria duradera",
      description: "Guardar lo que aprende de ti, siempre editable.",
      enabled: domainState.durableMemoryEnabled && !domainState.ephemeralMode,
    },
    { id: "perm2", title: "Check-ins suaves", description: "Recordatorios proactivos en horas activas.", enabled: domainState.heartbeat.enabled },
    { id: "perm3", title: "Acciones autónomas", description: "Preparar borradores y eventos (requiere aprobación).", enabled: domainState.actionPreparationEnabled },
    { id: "perm-world", title: "Radar del mundo", description: "Traer señales recientes cuando puedan servirte.", enabled: domainState.worldSignalsEnabled },
    { id: "perm4", title: "Modo efímero", description: "No guardar memoria de esta sesión.", enabled: domainState.ephemeralMode },
  ], [domainState.actionPreparationEnabled, domainState.durableMemoryEnabled, domainState.ephemeralMode, domainState.heartbeat.enabled, domainState.worldSignalsEnabled]);

  function completeOnboarding(name: string, facts: string[] = []) {
    const cleanName = name.trim() || "amigo";
    const previousState = domainStateRef.current;
    setUserName(cleanName);
    setOnboarded(true);
    localStorage.setItem("koru.onboarded", "true");
    localStorage.setItem("koru.username", cleanName);
    commitChatTurns((prev) => {
      if (prev.length === 0) return [greetingTurn(cleanName)];
      if (prev.length === 1 && prev[0].role === "koru") {
        return [{ ...prev[0], text: `Hola, ${cleanName}. Cuéntame cómo estás.` }];
      }
      return prev;
    });
    commitDomainState((prev) => {
      const withName = { ...prev, userName: cleanName };
      const next = facts.length ? addOnboardingMemories(withName, facts) : withName;
      if (!facts.length) saveState(next);
      writeAuditEvent({
        type: "onboarding_completed",
        name: cleanName,
        facts,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(previousState, next),
      });
      return next;
    });
  }

  function togglePriority(id: string) {
    commitDomainState((prev) => {
      if (prev.nudges.some((nudge) => nudge.id === id && !nudge.dismissed)) {
        return dismissNudge(prev, id);
      }
      return completeCommitment(prev, id);
    });
  }

  function completeCommitmentInChat(id: string) {
    commitDomainState((prev) => {
      const next = completeCommitment(prev, id);
      writeAuditEvent({
        type: "commitment_completed",
        commitmentId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) =>
          item.id === id && item.kind === "commitment" ? { ...item, status: "executed", tag: "Hecho" } : item,
        ),
      })),
    );
    const confirmation: KoruChatTurn = {
      id: createId("turn"),
      role: "koru",
      text: "Listo. Lo marco como hecho y lo saco de tu carga mental.",
      createdAt: new Date().toISOString(),
      status: "done",
    };
    commitChatTurns((prev) => [...prev, confirmation].slice(-120));
  }

  function confirmMemory(id: string) {
    commitDomainState((prev) => {
      const next = confirmMemoryInStore(prev, id);
      writeAuditEvent({
        type: "memory_confirmed",
        memoryId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) =>
          item.id === id && item.kind === "memory" ? { ...item, status: "confirmed", tag: "Guardado" } : item,
        ),
      })),
    );
  }

  function pruneMemory(id: string) {
    commitDomainState((prev) => {
      const next = rejectMemory(prev, id);
      writeAuditEvent({
        type: "memory_rejected",
        memoryId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) =>
          item.id === id && item.kind === "memory" ? { ...item, status: "rejected", tag: "Soltado" } : item,
        ),
      })),
    );
  }

  function editMemory(id: string, text: string) {
    commitDomainState((prev) => {
      const next = updateMemoryText(prev, id, text);
      writeAuditEvent({
        type: "memory_edited",
        memoryId: id,
        text,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((item) => (item.id === id && item.kind === "memory" ? { ...item, text } : item)),
      })),
    );
  }

  function toggleMemoryUse(id: string) {
    commitDomainState((prev) => {
      const next = toggleMemorySuggestions(prev, id);
      writeAuditEvent({
        type: "memory_usage_toggled",
        memoryId: id,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
  }

  // 🔴 P2 — Memory conflict detection. Recibe una memoria nueva y devuelve la
  // primera memoria existente que la contradice (mismo kind + 3+ keywords
  // compartidas + textos no substring). Delega al helper puro
  // `detectMemoryConflictInState`. Lo llama submitEntry() cuando llegan
  // memoryCandidates nuevos desde el backend.
  function detectMemoryConflict(newMemory: MemoryFact): MemoryFact | null {
    return detectMemoryConflictInState(newMemory, domainStateRef.current.memories);
  }

  // 🔴 P2 — Resuelve un conflicto: keeper → confirmed, otra → superseded.
  // Limpia el estado del modal. Si keepId === supersedeId (no debería pasar)
  // es no-op.
  function resolveMemoryConflict(keepId: string, supersedeId: string) {
    commitDomainState((prev) => {
      const next = resolveMemoryConflictReducer(prev, keepId, supersedeId);
      writeAuditEvent({
        type: "memory_conflict_resolved",
        keepId,
        supersedeId,
        state: auditStateSnapshot(next),
        delta: auditStateDelta(prev, next),
      });
      return next;
    });
    setPendingMemoryConflict(null);
  }

  function dismissMemoryConflict() {
    setPendingMemoryConflict(null);
  }

  function togglePermission(id: string) {
    if (id === "perm1") {
      commitDomainState((prev) => setDurableMemoryEnabled(prev, !(prev.durableMemoryEnabled && !prev.ephemeralMode)));
      return;
    }
    if (id === "perm2") {
      commitDomainState((prev) => setHeartbeatEnabled(prev, !prev.heartbeat.enabled));
      return;
    }
    if (id === "perm3") {
      commitDomainState((prev) => setActionPreparationEnabled(prev, !prev.actionPreparationEnabled));
      return;
    }
    if (id === "perm-world") {
      setWorldSignals(!domainStateRef.current.worldSignalsEnabled);
      return;
    }
    if (id === "perm4" || id === "ephemeral") {
      setEphemeral(!domainStateRef.current.ephemeralMode);
    }
  }

  function setWorldSignals(enabled: boolean) {
    commitDomainState((prev) => {
      const next = setWorldSignalsEnabled(prev, enabled);
      writeAuditEvent({
        type: "world_signals_toggled",
        enabled,
        state: auditStateSnapshot(next),
      });
      return next;
    });
    appendKoruConfirmation(
      enabled
        ? "Listo. Te voy a traer este radar solo cuando haya senales utiles."
        : "Listo. No te lo traigo proactivamente por ahora.",
    );
  }

  function setEphemeral(v: boolean) {
    if (v !== domainStateRef.current.ephemeralMode) {
      if (!v) {
        commitChatTurns([greetingTurn(userName)]);
      }
      commitDomainState((prev) => {
        const next = toggleEphemeralMode(prev);
        const resolved = !next.ephemeralMode && !next.durableMemoryEnabled ? setDurableMemoryEnabled(next, true) : next;
        writeAuditEvent({
          type: "ephemeral_mode_toggled",
          enabled: resolved.ephemeralMode,
          state: auditStateSnapshot(resolved),
        });
        return resolved;
      });
    }
  }

  // Fase 1 (C6): logRitual eliminado — era un no-op.

  // 🔴 i18n — set preferred UI/reply language. Persisted + synced to domainState
  // via the useEffect above so the backend LLM sees it on the next turn.
  function setLanguage(lang: "es" | "en") {
    setLanguageState(lang);
    localStorage.setItem("koru.language", lang);
  }

  // 🔴 Offline cache — queue a message that was typed while offline.
  // It will be replayed automatically when the browser comes back online.
  async function queueOfflineMessage(text: string) {
    const userId = domainStateRef.current?.userId ?? "default";
    await enqueueOfflineMessage(userId, text);
  }

  // 🔴 v2: Create flow — CRUD de records directo (sin LLM, sin network, sin demora)
  async function createRecord(input: {
    title: string;
    collection: string;
    notes?: string;
    url?: string;
    kind?: string;
    tags?: string[];
    sourceBlock?: UiBlock;
    attachments?: Attachment[];
  }): Promise<LifeRecord> {
    const kindMap: Record<string, LifeRecordKind> = {
      // Legacy aliases (backward compat con llamadas existentes)
      note: "idea",
      lista: "shopping_item",
      shopping: "shopping_item",
      gasto: "expense",
      enlace: "tool_link",
      bookmark: "tool_link",
      receta: "idea",
      reminder: "deadline",
      // 🔴 v2: pass-through directo de LifeRecordKind válidos.
      // CreateScreen v2 ahora pasa el LifeRecordKind exacto en vez de un alias.
      idea: "idea",
      expense: "expense",
      tool_link: "tool_link",
      recommendation: "recommendation",
      decision: "decision",
      deadline: "deadline",
      medication: "medication",
      meal_inventory: "meal_inventory",
      meeting_note: "meeting_note",
      person_followup: "person_followup",
      gift: "gift",
      birthday: "birthday",
      home_task: "home_task",
      shopping_item: "shopping_item",
      medical_info: "medical_info",
      sleep: "sleep",
    };
    const kind = (kindMap[input.kind ?? "idea"] ?? "idea") as LifeRecordKind;
    const domain: LifeDomain = kind === "expense" ? "money" : "capture";
    const newRecord: LifeRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      domain,
      kind,
      title: input.title.trim(),
      collection: input.collection.trim() || "Notas",
      notes: input.notes,
      url: input.url,
      tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
      attachments: input.attachments && input.attachments.length > 0 ? input.attachments : undefined,
      amount: kind === "expense" ? parseFloat(input.notes ?? "0") || undefined : undefined,
      currency: kind === "expense" ? "ARS" : undefined,
      createdAt: new Date().toISOString(),
      sourceEntryId: "manual_create",
      sourceBlock: input.sourceBlock,
    };
    commitDomainState((prev) => {
      const next = { ...prev, records: [...prev.records, newRecord] };
      saveState(next);
      return next;
    });
    setMemoryToast({ id: newRecord.id, kind: "saved", text: `Creado en ${newRecord.collection}` });
    setTimeout(() => setMemoryToast(null), 2500);
    // 🔴 v2: analytics — track Create adoption
    analyticsTrack("create_record", { kind: input.kind, collection: newRecord.collection });
    return newRecord;
  }

  function updateRecord(id: string, patch: Partial<LifeRecord>) {
    commitDomainState((prev) => {
      const next = {
        ...prev,
        records: prev.records.map((r) => (r.id === id ? { ...r, ...patch, id } : r)),
      };
      saveState(next);
      return next;
    });
  }

  function deleteRecord(id: string) {
    commitDomainState((prev) => {
      const next = { ...prev, records: prev.records.filter((r) => r.id !== id) };
      saveState(next);
      return next;
    });
  }

  function reopenRecord(record: LifeRecord) {
    setReopenedRecord(record);
    // 🔴 v2: analytics — track reopen rate
    analyticsTrack("reopen_record", { hasSourceBlock: !!record.sourceBlock, collection: record.collection });
  }

  async function submitEntry(
    text: string,
    transcriptSource: DailyEntry["transcriptSource"] = "typed",
    history: KoruChatTurn[] = chatTurnsRef.current,
  ) {
    setProcessing(true);
    let koruTurnId: string | null = null;
    // Trackea los items creados durante el stream para preservar sus ids al
    // reemplazar con el resultado final. Sin esto, el resultado final crea items
    // con ids nuevos → el WebNavCardA se desmonta/remonta → pierde su estado
    // (animación de progreso, visibleCount) → reinicia a "Iniciando búsqueda...".
    const streamedItemsByType = new Map<string, KoruTurnItem>();
    try {
      const previousState = domainStateRef.current;
      const domainHistory = history
        .filter((turn) => turn.text.trim().length > 0)
        .slice(-12)
        .map((turn) => ({
          role: turn.role === "koru" ? ("assistant" as const) : ("user" as const),
          content: turn.text,
          createdAt: turn.createdAt,
        }));
      const agentResult = await runBackendAgentTurn(text, previousState, domainHistory, selectedModel ?? undefined, (chunk) => {
        // Fase real del pipeline: tomamos el último stateEvent para la píldora/barra.
        if (chunk.stateEvents?.length) {
          const last = chunk.stateEvents[chunk.stateEvents.length - 1];
          setPhase(last.kind === "done" ? null : last.kind);
        }
        const blocksToItems = (blocks: UiBlock[]): KoruTurnItem[] =>
          blocks.map((block) => ({
            id: createId("item"),
            kind: "action" as const,
            tag: block.type,
            text: (block as any).title ?? (block as any).query ?? "",
            status: "working" as const,
            uiBlock: block,
          }));
        if (!koruTurnId) {
          koruTurnId = createId("turn");
          const koruTurn: KoruChatTurn = {
            id: koruTurnId,
            role: "koru",
            text: chunk.reply,
            createdAt: new Date().toISOString(),
            items: blocksToItems(chunk.uiBlocks),
            status: "working" as const,
            mascotState: chunk.mascotState ?? "working",
          };
          (koruTurn.items ?? []).forEach((it) => { if (it.uiBlock?.type) streamedItemsByType.set(it.uiBlock.type, it); });
          commitChatTurns((prev) => [...prev, koruTurn].slice(-120));
        } else {
          const isDone = chunk.stateEvents?.some((e) => e.kind === "done");
          commitChatTurns((prev) =>
            prev.map((turn) => {
              if (turn.id !== koruTurnId) return turn;
              const existingItems = turn.items ?? [];
              const newBlocks = chunk.uiBlocks ?? [];
              // Merge por TIPO de block (no por índice). Así, si el orden cambia
              // entre chunks (ej: aparece un data_card antes que el web_nav),
              // cada item mantiene su identidad y estado (animación de progreso,
              // contadores internos). Antes se matcheaba por idx, lo que hacía
              // que un cambio de orden desmontara el componente y reiniciara la
              // animación ("Iniciando búsqueda..." colgado).
              const consumedExisting = new Set<string>();
              const mergedItems: KoruTurnItem[] = newBlocks.map((block) => {
                const existing = existingItems.find(
                  (it) => it.uiBlock?.type === block.type && !consumedExisting.has(it.uiBlock!.type),
                );
                if (existing) {
                  consumedExisting.add(existing.uiBlock!.type);
                  return { ...existing, uiBlock: block, text: (block as any).title ?? (block as any).query ?? "" };
                }
                return {
                  id: createId("item"),
                  kind: "action" as const,
                  tag: block.type,
                  text: (block as any).title ?? (block as any).query ?? "",
                  status: "working" as const,
                  uiBlock: block,
                };
              });
              mergedItems.forEach((it) => { if (it.uiBlock?.type) streamedItemsByType.set(it.uiBlock.type, it); });
              return {
                ...turn,
                text: chunk.reply,
                items: mergedItems,
                mascotState: chunk.mascotState ?? turn.mascotState,
                status: isDone ? ("done" as const) : ("working" as const),
              };
            }),
          );
        }
      });
      const result = applyBackendTurnToState(previousState, text, transcriptSource, agentResult);
      commitDomainState(result.state);

      // 🔴 Wire weather cache: si el backend devolvió un UiBlock de weather (tool
      // `weather_forecast` o `weather` legacy) con datos completos, actualizamos el
      // weatherCache del KoruState. El reducer existe en store.ts pero no tenía
      // caller — este es el puente entre tool result y el home widget de clima.
      const weatherBlock = (agentResult.uiBlocks ?? []).find(
        (b): b is Extract<UiBlock, { type: "weather" }> => b.type === "weather",
      );
      if (
        weatherBlock &&
        typeof weatherBlock.city === "string" &&
        weatherBlock.city.trim().length > 0 &&
        typeof weatherBlock.now === "string"
      ) {
        updateWeatherCache({
          city: weatherBlock.city,
          fetchedAt: weatherBlock.verifiedAt ?? new Date().toISOString(),
          payload: {
            now: weatherBlock.now,
            condition: weatherBlock.condition ?? "",
            hourly: weatherBlock.hourly,
            daily: weatherBlock.daily,
          },
        });
      }

      // 🔴 Programar notificaciones para nuevos commitments con dueAt
      const newCommitments = (result.state.commitments ?? []).filter(
        (c) => c.dueAt && !previousState.commitments?.find((pc) => pc.id === c.id)
      );
      if (newCommitments.length > 0) {
        const userId = result.state.userId ?? "default";
        for (const c of newCommitments) {
          scheduleReminderNotification(c as any, userId);
          // 🔴 NUEVO: programar setTimeout preciso para que la notificación
          // dispare EXACTO cuando llega la hora, no en el próximo heartbeat tick.
          schedulePreciseTimeout(c.id, c.dueAt!, c.title, userId);
        }
        // 🔴 Request notification permission — best effort
        requestNotificationPermission().catch(() => {});
      }

      // 🔴 P2 — Memory conflict detection. Comparar las memorias NUEVAS de
      // este turno (las que están en result.state pero no en previousState)
      // contra las memorias PREEXISTENTES (previousState.memories). Si
      // detectamos conflicto, abrimos el modal. Sólo un conflicto a la vez
      // (el primero) para no abrumar al usuario.
      if (!previousState.ephemeralMode && previousState.durableMemoryEnabled) {
        const prevIds = new Set(previousState.memories.map((m) => m.id));
        const addedMemories = (result.state.memories ?? []).filter(
          (m) => !prevIds.has(m.id) && (m.status === "candidate" || m.status === "confirmed"),
        );
        for (const fresh of addedMemories) {
          const conflicting = detectMemoryConflictInState(fresh, previousState.memories);
          if (conflicting) {
            setPendingMemoryConflict({ oldMemory: conflicting, newMemory: fresh });
            break;
          }
        }
      }
      if (koruTurnId) {
        // Preservar ids de los items del stream: si el resultado final tiene un item
        // del mismo tipo que uno ya renderizado en el stream, mantener su id (e
        // identidad de React) para no desmontar/remontar el componente y perder su
        // estado interno (animación de progreso del WebNavCardA, visibleCount, etc.).
        const consumedTypes = new Set<string>();
        const stableItems = result.items.map((item) => {
          const type = item.uiBlock?.type ?? item.tag;
          if (type && !consumedTypes.has(type)) {
            const streamed = streamedItemsByType.get(type);
            if (streamed) {
              consumedTypes.add(type);
              return { ...item, id: streamed.id };
            }
          }
          return item;
        });
        commitChatTurns((prev) =>
          prev.map((turn) =>
            turn.id === koruTurnId
              ? { ...turn, text: agentResult.reply, items: stableItems, status: "done" as const, mascotState: agentResult.mascotState ?? "idle" }
              : turn,
          ),
        );
        // 🔴 Voice: si voice está activado, Koru habla la respuesta
        if (voiceEnabled && agentResult.reply) {
          speak(agentResult.reply);
        }
        // 🔴 Memory toast: si hay memoryCandidates en la respuesta, mostrar toast.
        // Buscar en memoryCandidates top-level Y dentro de toolResults (save_memory tool).
        const topCandidates = (agentResult.memoryCandidates ?? []);
        const toolCandidates = (agentResult.toolResults ?? []).flatMap((tr: any) => {
          const data = tr.data;
          if (data?.type === "memory_capture" && Array.isArray(data.memoryCandidates)) return data.memoryCandidates;
          if (data?.type === "personal_capture" && Array.isArray(data.memoryCandidates)) return data.memoryCandidates;
          return [];
        });
        const allCandidates = [...topCandidates, ...toolCandidates].filter(
          (m: any) => m && typeof m.text === "string" && m.text.length > 4,
        );
        if (allCandidates.length > 0 && !previousState.ephemeralMode && previousState.durableMemoryEnabled) {
          const first = allCandidates[0];
          // Solo mostrar si NO existe ya una memoria con el mismo texto (deduplicación visual)
          const normalizedNew = first.text.toLowerCase().replace(/[áéíóú]/g, (m: string) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[m]!)).replace(/[^a-z0-9\s]/g, "").trim();
          const alreadyExists = previousState.memories.some((existing: any) => {
            const norm = existing.text.toLowerCase().replace(/[áéíóú]/g, (m: string) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[m]!)).replace(/[^a-z0-9\s]/g, "").trim();
            return norm === normalizedNew;
          });
          if (!alreadyExists) {
            setMemoryToast({
              id: `toast_${Date.now()}`,
              kind: first.kind,
              text: first.text,
            });
            // Auto-dismiss después de 6 segundos
            setTimeout(() => {
              setMemoryToast((current) => (current?.text === first.text ? null : current));
            }, 6000);
          }
        }
      }
      writeAuditEvent({
        type: "turn_analyzed",
        engine: "backend_agent_loop",
        input: text,
        transcriptSource,
        historyUsed: domainHistory,
        response: agentResult.reply,
        understanding: agentResult.understanding,
        suggestedActions: agentResult.suggestedActions,
        toolResults: agentResult.toolResults,
        provider: agentResult.provider,
        model: agentResult.model,
        fallbackReason: agentResult.fallbackReason,
        items: auditTurnItems(result.items),
        state: auditStateSnapshot(result.state),
        delta: auditStateDelta(previousState, result.state),
      });
      return { response: agentResult.reply, items: result.items, state: result.state, mascotState: agentResult.mascotState, koruTurnId };
    } finally {
      setProcessing(false);
      setActivity(null);
      setPhase(null);
    }
  }

  async function sendMessage(text: string, transcriptSource: DailyEntry["transcriptSource"] = "typed") {
    const cleanText = text.trim();
    if (!cleanText) return null;
    const previousState = domainStateRef.current;
    const userTurn: KoruChatTurn = {
      id: createId("turn"),
      role: "user",
      text: cleanText,
      createdAt: new Date().toISOString(),
      status: "done",
    };
    const historyBeforeUser = chatTurnsRef.current;
    commitChatTurns((prev) => [...prev, userTurn].slice(-120));
    writeAuditEvent({
      type: "user_message",
      turn: userTurn,
      transcriptSource,
      historyBeforeUser: historyBeforeUser.map((turn) => ({
        id: turn.id,
        role: turn.role,
        text: turn.text,
        createdAt: turn.createdAt,
        status: turn.status,
        items: auditTurnItems(turn.items),
      })),
      stateBefore: auditStateSnapshot(previousState),
    });
    setActivity(inferActivity(cleanText));
    try {
      const result = await submitEntry(cleanText, transcriptSource, historyBeforeUser);
      let koruTurn: KoruChatTurn | undefined;
      if (!result.koruTurnId) {
        koruTurn = {
          id: createId("turn"),
          role: "koru",
          text: result.response,
          createdAt: new Date().toISOString(),
          items: result.items,
          status: "done",
          mascotState: result.mascotState ?? "idle",
        };
        commitChatTurns((prev) => [...prev, koruTurn!].slice(-120));
        writeAuditEvent({
          type: "koru_message",
          turn: {
            id: koruTurn.id,
            role: koruTurn.role,
            text: koruTurn.text,
            createdAt: koruTurn.createdAt,
            status: koruTurn.status,
            items: auditTurnItems(koruTurn.items),
          },
          stateAfter: auditStateSnapshot(result.state),
        });
      } else {
        commitChatTurns((prev) =>
          prev.map((turn) => {
            if (turn.id !== result.koruTurnId) return turn;
            const existingItems = turn.items ?? [];
            const mergedItems: KoruTurnItem[] = result.items.map((newItem, idx) => {
              const existing = existingItems[idx];
              if (existing && existing.uiBlock?.type === newItem.uiBlock?.type) {
                return { ...newItem, id: existing.id };
              }
              return newItem;
            });
            return { ...turn, items: mergedItems, status: "done" as const, mascotState: result.mascotState ?? "idle" };
          }),
        );
        koruTurn = chatTurnsRef.current.find((t) => t.id === result.koruTurnId);
        writeAuditEvent({
          type: "koru_message",
          turn: {
            id: result.koruTurnId,
            role: "koru",
            text: result.response,
            createdAt: new Date().toISOString(),
            status: "done",
            items: auditTurnItems(result.items),
          },
          stateAfter: auditStateSnapshot(result.state),
        });
      }
      const autoWebAction = result.state.actions
        .filter((action) => !previousState.actions.some((existing) => existing.id === action.id))
        .find(shouldAutoRunAction);
      if (autoWebAction) {
        window.setTimeout(() => runReadonlyWebAction(autoWebAction), 0);
      }
      return koruTurn ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallo desconocido del agente.";
      const errorTurn: KoruChatTurn = {
        id: createId("turn"),
        role: "koru",
        text: `No pude contactar bien al agente ahora. No voy a inventarte una respuesta. Detalle: ${message}`,
        createdAt: new Date().toISOString(),
        status: "error",
      };
      commitChatTurns((prev) => [...prev, errorTurn].slice(-120));
      writeAuditEvent({
        type: "turn_error",
        input: cleanText,
        error: message,
        turn: errorTurn,
        state: auditStateSnapshot(domainStateRef.current),
      });
      setActivity(null);
      return errorTurn;
    }
  }

  // 🔴 Offline cache — keep sendMessageRef current so the offline-queue drain
  // (subscribed once on mount) can call the latest closure.
  useEffect(() => {
    sendMessageRef.current = async (text: string) => { await sendMessage(text); };
  });

  function replaceActionInChat(item: KoruTurnItem) {
    commitChatTurns((prev) =>
      prev.map((turn) => ({
        ...turn,
        items: turn.items?.map((existing) => (existing.id === item.id ? item : existing)),
      })),
    );
  }

  function appendKoruConfirmation(text: string) {
    const confirmation: KoruChatTurn = {
      id: createId("turn"),
      role: "koru",
      text,
      createdAt: new Date().toISOString(),
      status: "done",
    };
    commitChatTurns((prev) => [...prev, confirmation].slice(-120));
    writeAuditEvent({
      type: "koru_confirmation",
      turn: confirmation,
      state: auditStateSnapshot(domainStateRef.current),
    });
  }

  function runReadonlyWebAction(original: AssistantAction): KoruTurnItem {
    // Dato en vivo (clima/trafico/mercado) = quick, sin panel largo. Un
    // informe/investigacion real (webMode "research", o web_research sin
    // modo puntual) = deep, se gana el panel "Trabajando...". Ver
    // flujo-informe-aoe2.html pasos 3 (informe) vs 7 (clima).
    const webMode = original.payload.webMode;
    const isQuickSignal = webMode === "weather" || webMode === "traffic" || webMode === "market";
    const isDeepResearch = webMode === "research" || (original.kind === "web_research" && !webMode);
    setActivity({
      kind: "searching",
      depth: isQuickSignal ? "quick" : isDeepResearch ? "deep" : "quick",
      label: isDeepResearch
        ? "Es un tema para investigar a fondo. Dame unos segundos."
        : original.kind === "world_signal"
          ? "Busco senales reales."
          : "Consulto fuentes reales.",
    });
    const now = new Date().toISOString();
    const approvedAction: AssistantAction = {
      ...original,
      status: "approved",
      updatedAt: now,
    };
    commitDomainState((prev) => {
      const exists = prev.actions.some((action) => action.id === original.id);
      const next = {
        ...prev,
        actions: exists
          ? prev.actions.map((action) => (action.id === original.id ? approvedAction : action))
          : [approvedAction, ...prev.actions],
        updatedAt: now,
      };
      saveState(next);
      return next;
    });
    const waitingItem = actionToTurnItem(approvedAction);
    replaceActionInChat(waitingItem);

    void (async () => {
      try {
        const result = await runWebNavigation(original.payload);
        const webPayload = webResultToPayload(result);
        const nextUiBlock = patchUiBlockWithWebResult(approvedAction, webPayload);
        const finishedAt = new Date().toISOString();
        const patchedAction: AssistantAction = {
          ...approvedAction,
          payload: {
            ...approvedAction.payload,
            ...webPayload,
            uiBlock: nextUiBlock ?? approvedAction.payload.uiBlock,
          },
          result: result.recommendation,
          status: "executed",
          updatedAt: finishedAt,
          executedAt: finishedAt,
        };
        const patchedItem = actionToTurnItem(patchedAction);
        commitDomainState((prev) => {
          const next = {
            ...prev,
            actions: prev.actions.map((action) => (action.id === original.id ? patchedAction : action)),
            updatedAt: finishedAt,
          };
          saveState(next);
          writeAuditEvent({
            type: "readonly_web_action_finished",
            action: {
              id: patchedAction.id,
              kind: patchedAction.kind,
              title: patchedAction.title,
              status: patchedAction.status,
              result: patchedAction.result,
              payload: patchedAction.payload,
            },
            item: auditTurnItems([patchedItem])[0],
            state: auditStateSnapshot(next),
            delta: auditStateDelta(prev, next),
          });
          return next;
        });
        replaceActionInChat(patchedItem);
      } finally {
        setActivity(null);
      }
    })();
    return waitingItem;
  }

  function reviewAction(id: string, approve: boolean): KoruTurnItem | null {
    const currentState = domainStateRef.current;
    const original = currentState.actions.find((action) => action.id === id);
    if (approve && (original?.kind === "web_research" || original?.kind === "world_signal")) {
      return runReadonlyWebAction(original);
    }

    const nextState = approve ? approveAndExecuteAction(currentState, id) : rejectAction(currentState, id);
    const reviewed = nextState.actions.find((action) => action.id === id);
    if (!reviewed) return null;
    commitDomainState(nextState);
    const item = actionToTurnItem(reviewed);
    replaceActionInChat(item);
    writeAuditEvent({
      type: "action_reviewed",
      actionId: id,
      approved: approve,
      item: auditTurnItems([item])[0],
      state: auditStateSnapshot(nextState),
      delta: auditStateDelta(currentState, nextState),
    });
    appendKoruConfirmation(approve ? actionConfirmationText(item) : "Lo suelto. No hice nada con eso.");

    return item;
  }

  function toggleTurnLike(id: string) {
    commitChatTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, liked: !turn.liked } : turn)));
  }

  // ─── TIER S — wrappers sobre los nuevos reducers del store ───
  // Cada wrapper toma los mismos params que el reducer (menos `state`, que viene
  // del contexto), invoca al reducer con el estado previo y commitea el resultado
  // via commitDomainState (que a su vez persiste con saveState, ya llamado dentro
  // de cada reducer). computeStreak es una función pura sin estado: lee
  // habitLogs del domainStateRef actual.
  function createPlan(title: string, steps: Omit<PlanStep, "id" | "order" | "done">[]) {
    commitDomainState((prev) => createPlanReducer(prev, title, steps));
  }
  function togglePlanStep(planId: string, stepId: string) {
    commitDomainState((prev) => togglePlanStepReducer(prev, planId, stepId));
  }
  function archivePlan(planId: string) {
    commitDomainState((prev) => archivePlanReducer(prev, planId));
  }
  function createChecklist(title: string, items: Omit<ChecklistItem, "id" | "order">[]) {
    commitDomainState((prev) => createChecklistReducer(prev, title, items));
  }
  function toggleChecklistItem(checklistId: string, itemId: string) {
    commitDomainState((prev) => toggleChecklistItemReducer(prev, checklistId, itemId));
  }
  function createHabit(label: string, icon: string, cadence: Habit["cadence"], target: number, unit?: string, anchorTime?: string): string {
    // 🔴 TIER S: devolvemos el id del hábito recién creado para que callers
    // (ej. CreateScreen rutina template) puedan encadenar createRoutine con
    // el habitId. Generamos el id acá y lo pasamos al reducer (que acepta un
    // id opcional) para garantizar consistencia entre lo que se persiste y lo
    // que devolvemos, sin depender del timing del batch de React.
    const habitId = createId("habit");
    commitDomainState((prev) => createHabitReducer(prev, label, icon, cadence, target, unit, anchorTime, habitId));
    return habitId;
  }
  function logHabit(habitId: string, value: number) {
    commitDomainState((prev) => logHabitReducer(prev, habitId, value));
  }
  function pauseHabit(habitId: string) {
    commitDomainState((prev) => pauseHabitReducer(prev, habitId));
    setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Hábito pausado — tu racha se conserva" });
    setTimeout(() => setMemoryToast(null), 2500);
  }
  function resumeHabit(habitId: string) {
    commitDomainState((prev) => resumeHabitReducer(prev, habitId));
    setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Hábito reanudado ✓" });
    setTimeout(() => setMemoryToast(null), 2000);
  }
  function computeStreak(habitId: string): number {
    return computeStreakReducer(habitId, domainStateRef.current.habitLogs ?? []);
  }
  function createRoutine(name: string, anchorTime: string, habitIds: string[], daysOfWeek: number[]) {
    commitDomainState((prev) => createRoutineReducer(prev, name, anchorTime, habitIds, daysOfWeek));
  }
  function createExercisePlan(name: string, weeksTotal: number, sessions: Omit<ExerciseSession, "id" | "order">[]) {
    commitDomainState((prev) => createExercisePlanReducer(prev, name, weeksTotal, sessions));
  }
  function logWorkout(planId: string, sessionId: string, exercises: WorkoutLog["exercises"], durationMin: number, kcal?: number) {
    commitDomainState((prev) => logWorkoutReducer(prev, planId, sessionId, exercises, durationMin, kcal));
  }
  function createShoppingList(title: string, items: Omit<ShoppingItem, "id" | "order" | "checked">[], store?: string) {
    commitDomainState((prev) => createShoppingListReducer(prev, title, items, store));
  }
  function toggleShoppingItem(listId: string, itemId: string) {
    commitDomainState((prev) => toggleShoppingItemReducer(prev, listId, itemId));
  }
  function logWellbeing(metric: WellbeingLog["metric"], value: number, unit: string, source?: WellbeingLog["source"]) {
    commitDomainState((prev) => logWellbeingReducer(prev, metric, value, unit, source));
  }
  function addPerson(name: string, relationship?: string, birthday?: string) {
    commitDomainState((prev) => addPersonReducer(prev, name, relationship, birthday));
  }
  function updateUserProfile(profile: Partial<UserProfile>) {
    commitDomainState((prev) => updateUserProfileReducer(prev, profile));
  }
  function updatePreferences(prefs: Partial<UserPreferences>) {
    commitDomainState((prev) => updatePreferencesReducer(prev, prefs));
  }
  function createDecision(question: string, options: Decision["options"], factors: Decision["factors"], weights: Record<string, number>): Decision {
    // 🔴 GAP-2: el motor de decisión (computeDecision) se invoca acá,
    // dentro del wrapper, para que la decisión persistida quede con su
    // `result` ya poblado (recommendation + confidenceInterval + scores).
    // El reducer original (createDecisionReducer) sólo persiste la decisión
    // "en crudo"; nosotros construimos el objeto, lo computamos, y luego
    // commiteamos el estado resultante. Devolvemos la Decision al caller
    // (CreateScreen) para que pueda invocar computeDecision explícitamente
    // sobre la decisión recién creada — cumpliendo el contrato GAP-2.
    const now = new Date().toISOString();
    const decision: Decision = {
      id: createId("decision"),
      question,
      options,
      factors,
      weights,
      linkedMemoryIds: [],
      createdAt: now,
    };
    const prev = domainStateRef.current;
    const nextState: KoruState = {
      ...prev,
      decisions: [decision, ...(prev.decisions ?? [])],
      updatedAt: now,
    };
    // El motor muta `decision.result` in-place.
    try {
      computeDecision(nextState, decision.id);
    } catch {
      // best-effort: si el motor falla (ej. opciones vacías), la decisión
      // se persiste igual sin result — el usuario puede re-computar luego.
    }
    saveState(nextState);
    commitDomainState(nextState);
    return decision;
  }
  function updateWeatherCache(cache: WeatherCache) {
    commitDomainState((prev) => updateWeatherCacheReducer(prev, cache));
  }
  function updateDecisionOutcome(
    decisionId: string,
    outcome: { chosenOptionId: string; decidedAt: string; satisfaction1to5: number; notes?: string },
  ) {
    commitDomainState((prev) => updateDecisionOutcomeReducer(prev, decisionId, outcome));
  }
  function setLastBrief(date: string, block?: UiBlock) {
    commitDomainState((prev) => setLastBriefReducer(prev, date, block));
  }
  function forgetMemory(memoryId: string) {
    commitDomainState((prev) => forgetMemoryReducer(prev, memoryId));
  }
  function snoozeCommitment(commitmentId: string, minutes: number) {
    commitDomainState((prev) => snoozeCommitmentReducer(prev, commitmentId, minutes));
  }

  // 🔴 SettingsScreen integrada — wrappers que antes faltaban en el provider.
  // - updateHeartbeat: ajusta horas activas / maxNudgesPerDay / enabled.
  // - exportData: descarga un JSON con todo el estado del usuario.
  // - deleteAllData: reinicia el estado a createInitialState() y limpia flags locales.
  function updateHeartbeat(patch: Partial<HeartbeatSettings>) {
    commitDomainState((prev) => updateHeartbeatSettings(prev, patch));
  }
  function exportData() {
    try {
      const json = exportState(domainStateRef.current);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `koru-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // best-effort: loguear y no romper la UI
      console.error("[Koru] exportData failed", err);
    }
  }
  function deleteAllData() {
    const fresh = resetState();
    commitDomainState(() => fresh);
    try {
      localStorage.removeItem("koru.username");
      localStorage.removeItem("koru.onboarded");
    } catch {
      /* noop */
    }
  }

  const value = useMemo<KoruContextValue>(() => ({
    state: domainState,
    energy,
    roots,
    stage,
    userName,
    onboarded,
    ephemeral,
    priorities,
    memories,
    history,
    records: domainState.records,
    permissions,
    processing,
    activity,
    phase,
    chatTurns,
    selectedModel,
    setSelectedModel,
    completeOnboarding,
    togglePriority,
    confirmMemory,
    pruneMemory,
    editMemory,
    toggleMemoryUse,
    completeCommitment: completeCommitmentInChat,
    togglePermission,
    setEphemeral,
    submitEntry,
    sendMessage,
    reviewAction,
    toggleTurnLike,
    setWorldSignals,
    dismissNudge: (id: string) => commitDomainState((prev) => dismissNudge(prev, id)),
    memoryToast,
    dismissMemoryToast: () => setMemoryToast(null),
    morningBrief,
    dismissMorningBrief: () => setMorningBrief(null),
    showInstallPrompt,
    installApp: async () => {
      if (installPromptEvent) {
        installPromptEvent.prompt();
        await installPromptEvent.userChoice;
        setInstallPromptEvent(null);
        setShowInstallPrompt(false);
      }
    },
    dismissInstallPrompt: () => {
      setShowInstallPrompt(false);
      localStorage.setItem("koru.installDismissed", "1");
    },
    voiceEnabled,
    toggleVoice: () => {
      const next = !voiceEnabled;
      setVoiceEnabledState(next);
      setVoiceEnabled(next);
      localStorage.setItem("koru.voiceEnabled", String(next));
      if (!next) stopSpeaking();
    },
    speakReply: (text: string) => {
      if (voiceEnabled) speak(text);
    },
    stopVoice: () => stopSpeaking(),
    language,
    setLanguage,
    online,
    queueOfflineMessage,
    createRecord,
    updateRecord,
    deleteRecord,
    reopenRecord,
    reopenedRecord,
    // 🔴 TIER S — nuevos reducers del store
    createPlan,
    togglePlanStep,
    archivePlan,
    createChecklist,
    toggleChecklistItem,
    createHabit,
    logHabit,
    pauseHabit,
    resumeHabit,
    computeStreak,
    createRoutine,
    createExercisePlan,
    logWorkout,
    createShoppingList,
    toggleShoppingItem,
    logWellbeing,
    addPerson,
    updateUserProfile,
    updatePreferences,
    createDecision,
    updateDecisionOutcome,
    updateWeatherCache,
    setLastBrief,
    forgetMemory,
    snoozeCommitment,
    // 🔴 P2 — Memory conflict resolution
    detectMemoryConflict,
    pendingMemoryConflict,
    resolveMemoryConflict,
    dismissMemoryConflict,
    // 🔴 SettingsScreen integrada
    updateHeartbeat,
    exportData,
    deleteAllData,
  }), [energy, roots, stage, userName, onboarded, ephemeral, priorities, memories, history, domainState, domainState.records, permissions, processing, activity, phase, chatTurns, selectedModel, memoryToast, morningBrief, showInstallPrompt, installPromptEvent, voiceEnabled, language, online, reopenedRecord, pendingMemoryConflict]);

  // 🔴 v2: Listener para guardar record desde el detail screen (botón Guardar informe)
  // CAMBIO: ya NO pasa por el LLM (5-15s de espera + contaminación del chat).
  // Ahora escribe directo en domainState.records + persiste via saveState.
  useEffect(() => {
    const onSaveRecord = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const title = String(detail?.title ?? "").trim();
      const collection = String(detail?.collection ?? detail?.subtitle ?? "Informes").trim() || "Informes";
      if (!title) return;
      const newRecord: LifeRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        domain: "personal" as LifeDomain,
        kind: "idea" as LifeRecordKind,
        title,
        collection,
        notes: detail?.notes,
        url: detail?.url,
        createdAt: new Date().toISOString(),
        sourceEntryId: "manual_save",
        sourceBlock: detail?.blockData, // 🔴 persistir el bloque original para reabrir
      };
      commitDomainState((prev) => {
        const next = { ...prev, records: [...prev.records, newRecord] };
        saveState(next);
        return next;
      });
      // 🔴 TIER S: si el bloque guardado es un "plan", también persistimos un
      // Plan durable en el store (state.plans) vía createPlan — habilita
      // togglePlanStep, archivePlan, etc. desde el detail screen reabierto.
      if (detail?.blockData?.type === "plan" && Array.isArray(detail.blockData.items)) {
        const planItems = (detail.blockData.items as Array<{ title: string; time?: string; priority?: string; icon?: string; durationMinutes?: number; mode?: string; done?: boolean; detail?: string; phase?: string; estimatedDays?: number }>)
          .map(it => ({
            title: it.title,
            detail: it.detail ?? it.time,
            icon: it.icon,
            time: it.time,
            durationMinutes: it.durationMinutes,
            priority: it.priority === "Alta" ? "alta" : it.priority === "Media" ? "media" : it.priority === "Baja" ? "baja" : undefined,
            phase: it.phase,
            estimatedDays: it.estimatedDays,
          }));
        if (planItems.length > 0) {
          commitDomainState((prev) =>
            createPlanReducer(prev, title || "Plan", planItems as Omit<PlanStep, "id" | "order" | "done">[])
          );
        }
      }
      // 🔴 TIER S: si el bloque guardado es "weather", actualizamos el cache
      // de clima (state.weatherCache) vía updateWeatherCache — así HomeScreen
      // muestra el dato fresco sin tener que re-fetchear.
      if (detail?.blockData?.type === "weather" && detail.blockData.city) {
        const w = detail.blockData;
        const cache: WeatherCache = {
          city: String(w.city ?? ""),
          fetchedAt: w.verifiedAt ?? new Date().toISOString(),
          payload: {
            now: String(w.now ?? ""),
            condition: String(w.condition ?? ""),
            hourly: w.hourly as WeatherCache["payload"]["hourly"],
            daily: w.daily as WeatherCache["payload"]["daily"],
          },
        };
        commitDomainState((prev) => updateWeatherCacheReducer(prev, cache));
      }
      // 🔴 Toast de confirmación (usa el mismo mecanismo que memory toast)
      setMemoryToast({ id: newRecord.id, kind: "saved", text: `Guardado en ${collection}` });
      setTimeout(() => setMemoryToast(null), 2500);
      // 🔴 v2: analytics — track chat save (vs Create save)
      analyticsTrack("save_record_via_chat", { collection, hasSourceBlock: !!detail?.blockData });
    };
    window.addEventListener("koru-save-record", onSaveRecord as EventListener);
    return () => window.removeEventListener("koru-save-record", onSaveRecord as EventListener);
  }, []);

  // 🔴 v2: listener para acciones inline de cards (alarm/reminder complete/snooze/dismiss)
  useEffect(() => {
    const onCardAction = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const action = detail?.action as string;
      const blockData = detail?.blockData;
      // 🔴 Para alarm/reminder, marcar el commitment como completo si hay action=complete
      if (action === "complete" || action === "dismiss") {
        // Buscar el commitment que matchea el título del block
        const title = blockData?.title ?? blockData?.hero?.title;
        if (title) {
          commitDomainState((prev) => {
            const next = { ...prev, commitments: prev.commitments.map(c =>
              c.title === title ? { ...c, status: (action === "complete" ? "done" : "dismissed") as CommitmentStatus } : c
            ) };
            saveState(next);
            return next;
          });
        }
        setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: action === "complete" ? "Listo ✓" : "Apagado" });
        setTimeout(() => setMemoryToast(null), 2000);
      } else if (action === "snooze") {
        // 🔴 P0 FIX: Snooze real — usa el reducer snoozeCommitment (no mutación
        // inline del estado). El reducer reagenda dueAt = ahora + minutes y
        // limpia remindedAt. Persistencia y audit quedan a cargo del reducer.
        const title = blockData?.title ?? blockData?.hero?.title;
        const snoozeMinutes = Number(detail?.minutes ?? 10) || 10;
        if (title) {
          const prev = domainStateRef.current;
          const commitment = prev.commitments.find(c => c.title === title);
          if (commitment) {
            commitDomainState(snoozeCommitmentReducer(prev, commitment.id, snoozeMinutes));
          }
        }
        setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: `Postergado ${snoozeMinutes} min ✓` });
        setTimeout(() => setMemoryToast(null), 2000);
      } else if (action === "toggle_step") {
        // 🔴 TIER S: toggle de un step de Plan desde KoruDetailScreen.
        // detail trae planId + stepId (sintéticos, derivados del título del
        // bloque). Si no existe un Plan durable con ese id, lo creamos desde
        // el blockData (tipo "plan") para que el toggle sea efectivo.
        const planId = String(detail?.planId ?? "");
        const stepId = String(detail?.stepId ?? "");
        if (planId && stepId) {
          const prev = domainStateRef.current;
          const exists = (prev.plans ?? []).some(p => p.id === planId);
          let state = prev;
          if (!exists && blockData?.type === "plan" && Array.isArray(blockData.items)) {
            // Auto-crear el Plan durable desde el UiBlock para que el toggle
            // tenga efecto. Los stepIds se generan con la misma convención de
            // slug que planFallback en presentation.ts.
            const steps = (blockData.items as Array<{ title: string; time?: string; priority?: string; icon?: string; durationMinutes?: number; mode?: string; done?: boolean }>)
              .map((it, i) => ({
                title: it.title,
                detail: it.time,
                icon: it.icon,
                time: it.time,
                durationMinutes: it.durationMinutes,
                priority: it.priority === "Alta" ? "alta" : it.priority === "Media" ? "media" : it.priority === "Baja" ? "baja" : undefined,
                // El id del step debe matchear el sintético que generó planFallback.
                // planFallback usa `step_${slug(it.title)}_${i}` — pero el reducer
                // createPlan genera sus propios ids. Para que el toggle funcione,
                // overrideamos el id del step con el sintético antes de crear.
                // ⚠️ createPlan no acepta ids custom, así que dejamos que genere
                // los suyos y luego hacemos un patch in-place para que coincidan.
              }));
            // Usar createPlanReducer y luego parchear los step ids para que
            // coincidan con los sintéticos que viene dispatchando la UI.
            void steps; // steps se pasa al reducer abajo
            const created = createPlanReducer(state, blockData.title || "Plan", steps as Omit<PlanStep, "id" | "order" | "done">[]);
            // Parchear el plan recién creado: reemplazar sus step ids por los
            // sintéticos, para que el toggle posterior los encuentre.
            const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "untitled";
            const createdPlans = created.plans ?? [];
            const patchedPlans = createdPlans.map(p =>
              p.id === (createdPlans[0]?.id ?? "")
                ? {
                    ...p,
                    id: planId, // overridear el id del plan con el sintético
                    steps: p.steps.map((s, i) => ({
                      ...s,
                      id: `step_${slug(s.title)}_${i}`,
                    })),
                  }
                : p
            );
            state = { ...created, plans: patchedPlans };
            saveState(state);
            commitDomainState(state);
          }
          // Ahora sí, toggle del step (sea que existía o acaba de crearse).
          commitDomainState(togglePlanStepReducer(state, planId, stepId));
        }
      } else if (action === "toggle_shopping") {
        // 🔴 TIER S: toggle de un ShoppingItem desde KoruDetailScreen.
        const listId = String(detail?.listId ?? "");
        const itemId = String(detail?.itemId ?? "");
        if (listId && itemId) {
          const prev = domainStateRef.current;
          const exists = (prev.shoppingLists ?? []).some(l => l.id === listId);
          let state = prev;
          if (!exists && blockData?.type === "shopping_list" && Array.isArray(blockData.items)) {
            // Auto-crear la ShoppingList durable desde el UiBlock.
            const items = (blockData.items as string[]).map(it => ({ name: it }));
            const created = createShoppingListReducer(state, blockData.title || "Lista", items, undefined);
            // Parchear: overridear el id de la lista y los item ids para que
            // coincidan con los sintéticos (itemId = nombre del item).
            const createdLists = created.shoppingLists ?? [];
            const patchedLists = createdLists.map(l =>
              l.id === (createdLists[0]?.id ?? "")
                ? {
                    ...l,
                    id: listId,
                    items: l.items.map(it => ({ ...it, id: it.name })),
                  }
                : l
            );
            state = { ...created, shoppingLists: patchedLists };
            saveState(state);
            commitDomainState(state);
          }
          commitDomainState(toggleShoppingItemReducer(state, listId, itemId));
        }
      } else if (action === "toggle_checklist") {
        // 🔴 TIER S: toggle de un ChecklistItem desde KoruDetailScreen.
        const checklistId = String(detail?.checklistId ?? "");
        const itemId = String(detail?.itemId ?? "");
        if (checklistId && itemId) {
          const prev = domainStateRef.current;
          const exists = (prev.checklists ?? []).some(c => c.id === checklistId);
          let state = prev;
          if (!exists && blockData?.type === "smart_checklist" && Array.isArray(blockData.items)) {
            // Auto-crear el Checklist durable desde el UiBlock.
            const items = (blockData.items as Array<{ label: string; checked?: boolean }>)
              .map((it, i) => ({ label: it.label, urgency: "normal" as const, doneAt: it.checked ? new Date().toISOString() : undefined }));
            const created = createChecklistReducer(state, blockData.title || "Checklist", items);
            // Parchear ids para que coincidan con los sintéticos.
            const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "untitled";
            const createdChecklists = created.checklists ?? [];
            const patchedChecklists = createdChecklists.map(c =>
              c.id === (createdChecklists[0]?.id ?? "")
                ? {
                    ...c,
                    id: checklistId,
                    items: c.items.map((it, i) => ({ ...it, id: `citem_${slug(it.label)}_${i}` })),
                  }
                : c
            );
            state = { ...created, checklists: patchedChecklists };
            saveState(state);
            commitDomainState(state);
          }
          commitDomainState(toggleChecklistItemReducer(state, checklistId, itemId));
        }
      } else if (action === "archive_plan") {
        // 🔴 TIER S: archivar un Plan desde un botón inline.
        const planId = String(detail?.planId ?? "");
        if (planId) {
          commitDomainState((prev) => archivePlanReducer(prev, planId));
          setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Plan archivado ✓" });
          setTimeout(() => setMemoryToast(null), 2000);
        }
      } else if (action === "create_routine") {
        // 🔴 TIER S: crear una Routine durable desde una card-action inline.
        // detail trae name, anchorTime, habitIds (string[]), daysOfWeek (number[]).
        // El reducer createRoutine ancla hábitos existentes a un horario + días.
        const name = String(detail?.name ?? "").trim() || "Rutina";
        const anchorTime = String(detail?.anchorTime ?? "08:00");
        const habitIds: string[] = Array.isArray(detail?.habitIds)
          ? (detail.habitIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0)
          : [];
        const daysOfWeek: number[] = Array.isArray(detail?.daysOfWeek)
          ? (detail.daysOfWeek as unknown[]).filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
          : [0, 1, 2, 3, 4, 5, 6];
        commitDomainState((prev) => createRoutineReducer(prev, name, anchorTime, habitIds, daysOfWeek));
        setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Rutina creada ✓" });
        setTimeout(() => setMemoryToast(null), 2000);
      } else if (action === "log_workout") {
        // 🔴 TIER S: marcar una sesión de entrenamiento como completada.
        // detail trae planId + sessionId + exercises + durationMin + kcal (opcional).
        // Exercises se extrae del detail si está presente (array de ExerciseSet);
        // si no viene, caemos a [] para no bloquear el log.
        const planId = String(detail?.planId ?? "");
        const sessionId = String(detail?.sessionId ?? "");
        const exercises = Array.isArray(detail?.exercises)
          ? (detail.exercises as WorkoutLog["exercises"])
          : [];
        const durationMin = Number(detail?.durationMin ?? 30) || 30;
        const kcal = detail?.kcal != null ? Number(detail.kcal) : undefined;
        if (planId && sessionId) {
          commitDomainState((prev) =>
            logWorkoutReducer(prev, planId, sessionId, exercises, durationMin, kcal)
          );
          setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Entrenamiento registrado ✓" });
          setTimeout(() => setMemoryToast(null), 2000);
        }
      } else if (action === "reserve") {
        // 🔴 v3: abrir reserveUrl del top match del restaurant_synthesis block.
        // El blockData es el UiBlock completo; matches[].reserveUrl viene de Google Places.
        const matches = blockData?.matches as Array<{ reserveUrl?: string }> | undefined;
        const reserveUrl = matches?.find((m) => typeof m?.reserveUrl === "string")?.reserveUrl;
        if (reserveUrl) {
          try {
            window.open(reserveUrl, "_blank", "noopener,noreferrer");
            setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Abriendo reserva…" });
            setTimeout(() => setMemoryToast(null), 2000);
          } catch {
            setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "No se pudo abrir el enlace" });
            setTimeout(() => setMemoryToast(null), 2500);
          }
        }
      } else if (action === "create_commitment") {
        // 🔴 P2 — Crear un Commitment genérico desde una card-action inline.
        // Hoy lo usa el botón "Alerta de precio" de PriceHistoryChart para
        // fijar un target de precio; el dueHint queda como "precio baja a X".
        // detail trae title + dueHint (+ opcionalmente url/asin/target).
        const title = String(detail?.title ?? "Recordatorio").trim();
        const dueHint = String(detail?.dueHint ?? "").trim();
        if (title) {
          commitDomainState((prev) => {
            const now = new Date().toISOString();
            const newCommitment = {
              id: createId("commit"),
              title,
              dueHint: dueHint || "próximamente",
              status: "open" as CommitmentStatus,
              createdAt: now,
              sourceEntryId: createId("entry"),
            };
            const next = {
              ...prev,
              commitments: [newCommitment, ...prev.commitments],
              updatedAt: now,
            };
            saveState(next);
            return next;
          });
          setMemoryToast({ id: `action_${Date.now()}`, kind: "saved", text: "Alerta creada ✓" });
          setTimeout(() => setMemoryToast(null), 2000);
        }
      }
    };
    window.addEventListener("koru-card-action", onCardAction as EventListener);
    return () => window.removeEventListener("koru-card-action", onCardAction as EventListener);
  }, []);

  return (
    <>
      <KoruContext.Provider value={value}>{children}</KoruContext.Provider>
      {pendingMemoryConflict && (
        <MemoryConflictResolver
          oldMemory={pendingMemoryConflict.oldMemory}
          newMemory={pendingMemoryConflict.newMemory}
          onResolve={(keepId, supersedeId) => resolveMemoryConflict(keepId, supersedeId)}
          onClose={() => dismissMemoryConflict()}
        />
      )}
    </>
  );
}

export function useKoru() {
  const ctx = useContext(KoruContext);
  if (!ctx) throw new Error("useKoru must be used within KoruProvider");
  return ctx;
}

