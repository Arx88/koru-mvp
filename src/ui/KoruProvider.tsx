import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AssistantAction,
  UiBlock,
  DailyEntry,
  KoruState,
  KoruStage,
  LifeRecord,
  LifeDomain,
  LifeRecordKind,
  MascotState,
  MemoryFact,
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
  updateMemoryText,
} from "../domain/store";
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

type KoruContextValue = {
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
  createRecord: (input: { title: string; collection: string; notes?: string; url?: string; kind?: string; sourceBlock?: UiBlock }) => Promise<LifeRecord>;
  updateRecord: (id: string, patch: Partial<LifeRecord>) => void;
  deleteRecord: (id: string) => void;
  reopenRecord: (record: LifeRecord) => void;
  reopenedRecord: LifeRecord | null;
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

        // 🔴 Morning Brief: si es mañana y no se mostró hoy, generar
        const now = new Date();
        const hour = now.getHours();
        const today = now.toISOString().slice(0, 10);
        const lastBriefDate = localStorage.getItem("koru.lastBriefDate");
        if (hour >= 5 && hour <= 11 && lastBriefDate !== today) {
          try {
            const stateForBrief = {
              memories: (persisted.memories ?? []).filter((m: any) => m.status === "confirmed" || m.status === "candidate").slice(0, 10).map((m: any) => ({ kind: m.kind, text: m.text })),
              commitments: (persisted.commitments ?? []).filter((c: any) => c.status === "open").slice(0, 5).map((c: any) => ({ title: c.title, dueHint: c.dueHint, dueAt: c.dueAt })),
              userName: persisted.userName ?? "",
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
                setMorningBrief(data.brief);
                localStorage.setItem("koru.lastBriefDate", data.date ?? today);
              }
            }
          } catch {
            // silent — brief is optional
          }
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

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
    sourceBlock?: UiBlock;
  }): Promise<LifeRecord> {
    const kindMap: Record<string, LifeRecordKind> = {
      note: "idea",
      idea: "idea",
      lista: "shopping_item",
      shopping: "shopping_item",
      gasto: "expense",
      expense: "expense",
      enlace: "tool_link",
      bookmark: "tool_link",
      receta: "idea",
      reminder: "deadline",
    };
    const kind = (kindMap[input.kind ?? "note"] ?? "idea") as LifeRecordKind;
    const domain: LifeDomain = input.kind === "gasto" ? "money" : "capture";
    const newRecord: LifeRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      domain,
      kind,
      title: input.title.trim(),
      collection: input.collection.trim() || "Notas",
      notes: input.notes,
      url: input.url,
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

  const value = useMemo<KoruContextValue>(() => ({
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
  }), [energy, roots, stage, userName, onboarded, ephemeral, priorities, memories, history, domainState.records, permissions, processing, activity, phase, chatTurns, selectedModel, memoryToast, morningBrief, showInstallPrompt, installPromptEvent, voiceEnabled, language, online, reopenedRecord]);

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
      // 🔴 Toast de confirmación (usa el mismo mecanismo que memory toast)
      setMemoryToast({ id: newRecord.id, kind: "saved", text: `Guardado en ${collection}` });
      setTimeout(() => setMemoryToast(null), 2500);
    };
    window.addEventListener("koru-save-record", onSaveRecord as EventListener);
    return () => window.removeEventListener("koru-save-record", onSaveRecord as EventListener);
  }, []);

  return <KoruContext.Provider value={value}>{children}</KoruContext.Provider>;
}

export function useKoru() {
  const ctx = useContext(KoruContext);
  if (!ctx) throw new Error("useKoru must be used within KoruProvider");
  return ctx;
}

