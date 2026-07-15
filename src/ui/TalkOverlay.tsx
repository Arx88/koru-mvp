import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Image as ImageIcon, Leaf, Mic, MicOff, Paperclip, Plus } from "lucide-react";
import { createSpeechSession, getSpeechSupport } from "../domain/speech";
import { cn } from "../lib/utils";
import { useKoru, PHASE_ORDER, type KoruChatTurn, type KoruTurnItem } from "./KoruProvider";
import type { AgentActivityKind } from "../domain/agentKernel";
import { KoruSemanticCard } from "./chatCards";
import { KoruUnifiedCard } from "./cards/unified/KoruUnifiedCard";
import { CreateScreen } from "./create/CreateScreen";
import { KoruBackground, activityToBgState, type KoruBgState } from "./KoruBackground";
import { MemoryToast } from "./MemoryToast";
import { MorningBriefCard } from "./MorningBriefCard";

// TalkOverlay = réplica Stitch "Chat con Koru": paisaje nocturno ilustrado a
// pantalla completa, conversación anclada abajo con burbujas claras (usuario
// #F0F4FF / Koru #F8F4FA + avatar circular) y composer blanco con hoja (eco),
// campo "Habla con Koru..." y botón #7C5FF6. El estado "trabajando" es el
// panel claro de Stitch con la barra REAL sincronizada a las fases del
// pipeline, y el plan entregado se renderiza como la hoja "Tu Plan" (cards).

const KORU_AVATAR = "/stitch/avatar-chat.png";

// El diseño Stitch muestra las respuestas de Koru con un saludo corto en
// negrita violeta y el cuerpo debajo. El texto del backend es libre: si la
// primera línea/oración es corta y exclamativa la tratamos como encabezado.
function splitKoruText(text: string): { heading: string | null; body: string } {
  const newline = text.indexOf("\n");
  if (newline > 0 && newline <= 48) {
    const body = text.slice(newline + 1).trim();
    if (body) return { heading: text.slice(0, newline).trim(), body };
  }
  const match = text.match(/^(.{2,44}?[!¡?¿])\s+([\s\S]+)$/);
  if (match) return { heading: match[1].trim(), body: match[2].trim() };
  return { heading: null, body: text };
}

// Fase 2.8: memo para evitar re-renders globales durante streaming.
// Comparación por id + items length (suficiente para turnos de chat).
const TurnItemCard = memo(function TurnItemCard({
  item,
  onReview,
  onConfirmMemory,
  onPruneMemory,
  onCompleteCommitment,
  onSetWorldSignals,
}: {
  item: KoruTurnItem;
  onReview: (id: string, approve: boolean) => void;
  onConfirmMemory: (id: string) => void;
  onPruneMemory: (id: string) => void;
  onCompleteCommitment: (id: string) => void;
  onSetWorldSignals: (enabled: boolean) => void;
}) {
  return (
    <KoruSemanticCard
      item={item}
      handlers={{
        onReview,
        onConfirmMemory,
        onPruneMemory,
        onCompleteCommitment,
        onSetWorldSignals,
      }}
    />
  );
});

function KoruTurnBubble({
  turn,
  onReview,
  onConfirmMemory,
  onPruneMemory,
  onCompleteCommitment,
  onSetWorldSignals,
}: {
  turn: KoruChatTurn;
  onReview: (id: string, approve: boolean) => void;
  onConfirmMemory: (id: string) => void;
  onPruneMemory: (id: string) => void;
  onCompleteCommitment: (id: string) => void;
  onSetWorldSignals: (enabled: boolean) => void;
}) {
  const { heading, body } = splitKoruText(turn.text);
  return (
    <div className="koru-message is-koru">
      <div className="koru-row">
        <div className="koru-avatar">
          <img src={KORU_AVATAR} alt="Koru" />
        </div>
        <div className="koru-bubble ai-bubble">
          {heading && <h3 className="koru-bubble-heading">{heading}</h3>}
          <p className="koru-message-text">{body}</p>
        </div>
      </div>
      {turn.items && turn.items.length > 0 && (
        <div className="koru-cards-row">
          {turn.items.map((item) => (
            <TurnItemCard
              key={item.id}
              item={item}
              onReview={onReview}
              onConfirmMemory={onConfirmMemory}
              onPruneMemory={onPruneMemory}
              onCompleteCommitment={onCompleteCommitment}
              onSetWorldSignals={onSetWorldSignals}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserTurnBubble({ turn }: { turn: KoruChatTurn }) {
  return (
    <div className="koru-message is-user">
      <div className="koru-bubble user-bubble">
        <p className="koru-message-text">{turn.text}</p>
      </div>
    </div>
  );
}

function ListeningBubble({ interimText }: { interimText: string }) {
  return (
    <div className="koru-message is-koru">
      <div className="koru-row">
        <div className="koru-avatar">
          <img src={KORU_AVATAR} alt="Koru" />
        </div>
        <div className="koru-bubble ai-bubble">
          <p className="koru-message-text">{interimText || "Te escucho..."}</p>
        </div>
      </div>
    </div>
  );
}

// Panel "Trabajando..." (réplica Stitch, paso 3 de flujo-informe-aoe2.html):
// reemplaza al composer SOLO cuando la actividad es "deep" (investigacion o
// plan reales, no un dato en vivo). El % es REAL: sale de la fase emitida
// por el backend (thinking → searching → comparing → planning → saving →
// done). El titulo se adapta a que esta armando Koru.
// Incluye chips de fases visuales (como en el demo pantalla 2):
// ✓ Entendí el pedido | ✓ Busqué 4 fuentes | ● Comparando datos | Redactar informe
const WORKING_COPY: Partial<Record<AgentActivityKind, { title: string; subtitle: string }>> = {
  planning: { title: "Tejiendo tu plan…", subtitle: "Cada nudo en su lugar ✨" },
  searching: { title: "Saliendo a explorar…", subtitle: "Vuelvo con lo que encuentre 🌎" },
  writing: { title: "Escribiendo con calma…", subtitle: "Palabra por palabra ✍️" },
  comparing: { title: "Cruzando opciones…", subtitle: "Pesando lo que importa 🤝" },
};

// 🔴 Voz mágica para el motto inferior del WorkingPanel.
// Rota aleatoriamente para que se sienta vivo, no mecánico.
const MAGIC_MOTTOS = [
  "Cada paso cuenta. Seguís bien.",
  "Me llevo tu pedido en serio 🌿",
  "Sin apuro, pero sin pausa.",
  "Lo que vale no se apura.",
  "Acá estamos, dale que sale.",
  "El camino se hace caminando.",
  "Ya lo tengo casi, aguantá.",
  "Tu paciencia se nota. Gracias.",
];

// Mapeo de fase interna → label visible + icono Material Symbols.
// El demo muestra 4 chips: Entendí, Busqué, Comparando, Redactar.
/** 🔴 FIX UX: Icono ilustrado según el tipo de tarea para el WorkingPanel */
function getTaskIllustration(kicker?: string, kind?: string): string {
  const k = (kicker ?? "").toLowerCase();
  if (k.includes("pel") || k.includes("movie")) return "/stitch/icons/search-web.png";
  if (k.includes("receta") || k.includes("recipe") || k.includes("comida")) return "/stitch/icons/wellness.png";
  if (k.includes("clima") || k.includes("weather")) return "/stitch/icons/search-web.png";
  if (k.includes("partido") || k.includes("match") || k.includes("deport")) return "/stitch/icons/sports.png";
  if (k.includes("libro") || k.includes("book")) return "/stitch/icons/search-knowledge.png";
  if (k.includes("búsqueda") || k.includes("search") || k.includes("web")) return "/stitch/icons/search-web.png";
  if (k.includes("informe") || k.includes("reporte") || k.includes("investigaci")) return "/stitch/icons/tech-analysis.png";
  if (k.includes("plan")) return "/stitch/icons/tasks.png";
  if (k.includes("cotiz") || k.includes("dolar") || k.includes("crypto") || k.includes("finanz")) return "/stitch/icons/finance.png";
  if (k.includes("compar") || k.includes("compr") || k.includes("shop")) return "/stitch/icons/shopping.png";
  if (k.includes("viaje") || k.includes("travel") || k.includes("ruta")) return "/stitch/icons/travel.png";
  return "/stitch/working-illustration.png";
}

// 🔴 FIX UX: chips de progreso DINÁMICOS según el tipo de tarea.
// Cada tipo de tool tiene sus propios pasos específicos, no genéricos.
// Esto sigue la idea de la imagen del usuario: "Leí tus mensajes" → "Detecté 12 tareas" → etc.
const TASK_PHASES: Record<string, Array<{ phase: string; label: string; icon: string }>> = {
  // Informes / deep research
  informe: [
    { phase: "thinking", label: "Entendí el pedido", icon: "check_circle" },
    { phase: "searching", label: "Buscando fuentes", icon: "travel_explore" },
    { phase: "comparing", label: "Cruzando datos", icon: "compare_arrows" },
    { phase: "planning", label: "Redactando informe", icon: "edit_note" },
  ],
  // Películas
  pelicula: [
    { phase: "thinking", label: "Identificando la película", icon: "movie" },
    { phase: "searching", label: "Buscando en TMDB y Wikipedia", icon: "travel_explore" },
    { phase: "comparing", label: "Cruzando datos", icon: "compare_arrows" },
    { phase: "planning", label: "Armando la ficha", icon: "edit_note" },
  ],
  // Recetas
  receta: [
    { phase: "thinking", label: "Buscando la receta", icon: "restaurant" },
    { phase: "searching", label: "Consultando fuentes", icon: "travel_explore" },
    { phase: "comparing", label: "Organizando ingredientes", icon: "kitchen" },
    { phase: "planning", label: "Armando la receta", icon: "edit_note" },
  ],
  // Clima
  clima: [
    { phase: "thinking", label: "Detectando tu ciudad", icon: "location_on" },
    { phase: "searching", label: "Consultando el clima", icon: "cloud" },
    { phase: "planning", label: "Preparando el reporte", icon: "wb_sunny" },
  ],
  // Deportes
  deportes: [
    { phase: "thinking", label: "Identificando el equipo", icon: "sports_soccer" },
    { phase: "searching", label: "Buscando el resultado", icon: "travel_explore" },
    { phase: "planning", label: "Armando el resumen", icon: "sports_score" },
  ],
  // Búsqueda web
  web: [
    { phase: "thinking", label: "Entendiendo tu búsqueda", icon: "check_circle" },
    { phase: "searching", label: "Buscando en la web", icon: "travel_explore" },
    { phase: "comparing", label: "Filtrando resultados", icon: "filter_list" },
    { phase: "planning", label: "Preparando respuesta", icon: "edit_note" },
  ],
  // Libros
  libro: [
    { phase: "thinking", label: "Identificando el libro", icon: "menu_book" },
    { phase: "searching", label: "Buscando en fuentes", icon: "travel_explore" },
    { phase: "planning", label: "Armando la ficha", icon: "edit_note" },
  ],
  // Default (genérico)
  default: [
    { phase: "thinking", label: "Entendí el pedido", icon: "check_circle" },
    { phase: "searching", label: "Buscando información", icon: "travel_explore" },
    { phase: "comparing", label: "Procesando datos", icon: "compare_arrows" },
    { phase: "planning", label: "Preparando respuesta", icon: "edit_note" },
  ],
};

/** Determina qué set de chips usar según el kicker del deliverable o el activity kind */
function getTaskPhases(kicker?: string, kind?: string): Array<{ phase: string; label: string; icon: string }> {
  const k = (kicker ?? "").toLowerCase();
  if (k.includes("informe") || k.includes("reporte") || k.includes("investigaci")) return TASK_PHASES.informe;
  if (k.includes("pel") || k.includes("movie") || k.includes("film")) return TASK_PHASES.pelicula;
  if (k.includes("receta") || k.includes("recipe") || k.includes("comida")) return TASK_PHASES.receta;
  if (k.includes("clima") || k.includes("weather") || k.includes("tiempo")) return TASK_PHASES.clima;
  if (k.includes("partido") || k.includes("match") || k.includes("deport")) return TASK_PHASES.deportes;
  if (k.includes("libro") || k.includes("book")) return TASK_PHASES.libro;
  if (k.includes("búsqueda") || k.includes("search") || k.includes("web")) return TASK_PHASES.web;
  if (kind === "searching") return TASK_PHASES.web;
  if (kind === "saving") return TASK_PHASES.default;
  return TASK_PHASES.default;
}

type WorkingDeliverable = { kicker: string; progress?: number; phaseLabel?: string };

function WorkingPanel({ phase, kind, deliverable, onCancel }: { phase: string | null; kind?: AgentActivityKind; deliverable?: WorkingDeliverable | null; onCancel?: () => void }) {
  const idx = phase ? (PHASE_ORDER as readonly string[]).indexOf(phase) : -1;
  const doneIdx = PHASE_ORDER.length - 1;
  const pct = deliverable?.progress != null
    ? Math.min(100, Math.max(0, Math.round(deliverable.progress)))
    : idx >= 0 ? Math.round(((idx + 1) / doneIdx) * 100) : null;

  // 🔴 FIX UX: usar chips dinámicos según el tipo de tarea
  const taskChips = getTaskPhases(deliverable?.kicker, kind);

  // 🔴 Voz mágica — el título del deliverable no dice "Trabajando en..." (frío),
  // sino que abraza con una frase cálida + nombre del deliverable.
  const kicker = deliverable?.kicker?.toLowerCase() ?? "";
  const friendlyTitle = deliverable
    ? `Sumergiéndome en ${kicker.startsWith("tu") ? kicker : `tu ${kicker}`}…`
    : null;

  const copy = deliverable
    ? {
        title: friendlyTitle ?? "Trabajando…",
        subtitle: deliverable.phaseLabel ?? "Me llevo esto en serio 🌿",
      }
    : kind === "searching"
      ? { title: "Sumergiéndome en tu búsqueda…", subtitle: "Buscando… 🌎" }
      : (kind && WORKING_COPY[kind]) ?? { title: "Trabajando…", subtitle: "Me llevo esto en serio 🌿" };

  const phaseIdx = phase ? (PHASE_ORDER as readonly string[]).indexOf(phase) : -1;
  const chips = taskChips.map((chip, i) => {
    if (phaseIdx < 0) return { ...chip, status: "pending" as const };
    if (i < phaseIdx) return { ...chip, status: "done" as const };
    if (i === phaseIdx) return { ...chip, status: "active" as const };
    return { ...chip, status: "pending" as const };
  });

  // 🔴 Motto mágico rotativo — se elige uno al azar al render para que se
  // sienta vivo, no como una frase repetida mecánicamente.
  const motto = MAGIC_MOTTOS[Math.floor(Math.random() * MAGIC_MOTTOS.length)];

  return (
    <section className="koru-working-panel" role="status" aria-live="polite">
      <div className="koru-working-avatar">
        <img src={KORU_AVATAR} alt="Koru" />
      </div>
      <img src={getTaskIllustration(deliverable?.kicker, kind)} alt="" className="koru-working-illustration" />
      <div className="koru-working-copy">
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>
      <div className="koru-working-progress">
        <div
          className="koru-progress"
          role="progressbar"
          aria-label="Progreso del plan"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
        >
          {pct === null ? (
            <span className="koru-progress-bar is-indeterminate" />
          ) : (
            <span className="koru-progress-bar" style={{ width: `${pct}%` }} />
          )}
        </div>
        {pct !== null && <span className="koru-working-pct">{pct}%</span>}
      </div>
      {/* Chips de fases — réplica exacta del demo pantalla 2 */}
      <div className="koru-working-chips">
        {chips.map((chip, i) => (
          <span key={i} className={`koru-working-chip is-${chip.status}`}>
            {chip.status === "done" ? (
              <span className="material-symbols-outlined koru-working-chip-icon is-done">check_circle</span>
            ) : chip.status === "active" ? (
              <span className="koru-working-chip-dot" />
            ) : (
              <span className="material-symbols-outlined koru-working-chip-icon is-pending">{chip.icon}</span>
            )}
            {chip.label}
          </span>
        ))}
      </div>
      <p className="koru-working-motto">
        <svg fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="currentColor" />
        </svg>
        {motto}
        <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" />
        </svg>
      </p>
      {/* 🔴 v2: botón Cancelar para que el usuario pueda interrumpir tareas deep */}
      {onCancel && (
        <button type="button" className="koru-working-cancel" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </section>
  );
}
export function TalkOverlay({ onClose, onNavigate, onboarding, onOnboardingComplete }: { onClose: () => void; onNavigate?: (tab: "hoy" | "memoria" | "historial" | "configuracion") => void; onboarding?: boolean; onOnboardingComplete?: (name: string, facts?: string[]) => void }) {
  const {
    chatTurns,
    sendMessage,
    reviewAction,
    confirmMemory,
    pruneMemory,
    completeCommitment,
    setWorldSignals,
    processing,
    activity,
    phase,
    ephemeral,
    setEphemeral,
    memoryToast,
    dismissMemoryToast,
    morningBrief,
    dismissMorningBrief,
    memories,
    history,
    showInstallPrompt,
    installApp,
    dismissInstallPrompt,
    online,
    queueOfflineMessage,
    userName,
    language,
    reopenedRecord,
    reopenRecord,
  } = useKoru();
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // 🔴 v2: coachmark para Create — se muestra después del 2do mensaje del usuario
  const [showCreateCoachmark, setShowCreateCoachmark] = useState(() => {
    return localStorage.getItem("koru.createCoachmarkSeen") !== "true";
  });
  const [wheelOpen, setWheelOpen] = useState(false);

  // 🔴 v2: disparar coachmark después del 2do mensaje del usuario
  useEffect(() => {
    const userMessageCount = chatTurns.filter(t => t.role === "user").length;
    if (userMessageCount >= 2 && showCreateCoachmark && !processing && !wheelOpen) {
      const timer = setTimeout(() => setShowCreateCoachmark(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [chatTurns, showCreateCoachmark, processing, wheelOpen]);

  function dismissCreateCoachmark() {
    setShowCreateCoachmark(false);
    localStorage.setItem("koru.createCoachmarkSeen", "true");
  }
  const [interimText, setInterimText] = useState("");
  const [speechStatus] = useState(() => getSpeechSupport());
  const [micError, setMicError] = useState("");

  // ===== Estado del fondo dinámico =====
  // Detecta el estado actual (trabajando, buscando, memoria, etc.) y lo pasa al KoruBackground.
  // Trackea idle para activar "durmiendo" solo tras 5 min de inactividad real.
  //
  // BUG FIX: El idle timer NO arranca desde el montaje del componente.
  // Arranca desde la ÚLTIMA interacción real del usuario (mensaje enviado,
  // typing en el input, o procesando una respuesta).
  // Mientras el usuario no haya interactuado, no se considera "idle" —
  // está en "escuchando" (esperando input), no "durmiendo".
  const [idleMs, setIdleMs] = useState(0);
  const lastInteractionRef = useRef<number | null>(null); // null = sin interacción aún
  const hasChatStarted = chatTurns.length > 0;

  // Reset del idle timer cuando hay actividad real del usuario
  useEffect(() => {
    // Solo marcamos interacción si hay chat, o está procesando, o está escuchando voz
    if (chatTurns.length > 0 || processing || isListening) {
      lastInteractionRef.current = Date.now();
    }
  }, [chatTurns.length, processing, isListening]);

  // Reset también cuando el usuario escribe (input cambia de vacío a algo)
  useEffect(() => {
    if (inputText.trim().length > 0) {
      lastInteractionRef.current = Date.now();
    }
  }, [inputText]);

  // Tick cada 5s para recalcular idle (no cada 1s — menos renders)
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastInteractionRef.current === null) {
        setIdleMs(0);
      } else {
        setIdleMs(Date.now() - lastInteractionRef.current);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const lastUserText = useMemo(() => {
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      if (chatTurns[i].role === "user") return chatTurns[i].text;
    }
    return undefined;
  }, [chatTurns]);
  const bgState: KoruBgState = useMemo(
    () => activityToBgState(activity?.kind, processing, isListening, lastUserText, idleMs, hasChatStarted),
    [activity?.kind, processing, isListening, lastUserText, idleMs, hasChatStarted],
  );
  const [transcribing, setTranscribing] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [wheelActive, setWheelActive] = useState<string | null>(null);
  // 🔴 Estado para el modal de guardar informe
  const [saveModal, setSaveModal] = useState<{ title: string; subtitle?: string; blockData: any } | null>(null);
  const [saveFolderMode, setSaveFolderMode] = useState(false);
  // Onboarding conversacional: "greeting" → "waiting_for_name" → "done"
  const [onboardingPhase, setOnboardingPhase] = useState<"greeting" | "waiting_for_name" | "done">(
    onboarding ? "greeting" : "done"
  );
  const onboardingPhaseRef = useRef(onboardingPhase);
  onboardingPhaseRef.current = onboardingPhase;
  const micErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<ReturnType<typeof createSpeechSession> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelOverlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const turnCountRef = useRef(chatTurns.length);

  // Fase 1 (audit visual): auto-dismiss del error de micrófono tras 4s.
  // Antes el error "No pude transcribir: not-allowed" se quedaba pegado en
  // el footer compitiendo con el composer. Ahora se limpia solo.
  const showMicError = useCallback((message: string) => {
    if (micErrorTimerRef.current) clearTimeout(micErrorTimerRef.current);
    setMicError(message);
    micErrorTimerRef.current = setTimeout(() => setMicError(""), 4000);
  }, []);

  // UX Stitch: NO es un chat con historial. Es interaccion inmediata de un solo
  // turno: en pantalla solo vive el intercambio ACTUAL (ultimo mensaje del
  // usuario + la respuesta de Koru a ese mensaje). Al decir algo nuevo, lo
  // anterior desaparece. El registro completo queda en Historial.
  const visibleTurns = useMemo(() => {
    let lastUserIdx = -1;
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      if (chatTurns[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return chatTurns;
    return chatTurns.slice(lastUserIdx);
  }, [chatTurns]);

  // Entregable en curso (informe/investigación): su bloque "working" trae el
  // progreso REAL del pipeline. Mientras exista, el composer cede el lugar al
  // panel "Trabajando en tu informe".
  const workingDeliverable = useMemo(() => {
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      const turn = chatTurns[i];
      if (turn.role !== "koru") continue;
      for (const item of turn.items ?? []) {
        const block = item.uiBlock;
        if (block?.type === "deliverable" && block.status === "working") {
          return { kicker: block.kicker, progress: block.progress, phaseLabel: block.phaseLabel };
        }
      }
      break; // solo el último turno de Koru cuenta
    }
    return null;
  }, [chatTurns]);

  // ── Sugerencias de temas: extrae topics de los user turns anteriores ──
  // Solo aparecen si hay charla previa (más de 1 user turn en el historial completo).
  // Cada pill muestra un icono según la categoría detectada + el topic recortado.
  type SuggestionPill = { id: string; icon: string; topic: string; turnId: string };

  const suggestionPills = useMemo<SuggestionPill[]>(() => {
    // Recorrer TODOS los chatTurns (no solo visibleTurns) para encontrar temas anteriores
    const userTurns = chatTurns.filter(t => t.role === "user");
    if (userTurns.length < 1) return [];

    // Tomar los últimos 5 user turns (incluyendo el más reciente)
    const recentUserTurns = userTurns.slice(-5);
    if (recentUserTurns.length === 0) return [];

    return recentUserTurns
      .map(turn => {
        const text = turn.text.trim();
        if (text.length < 3) return null;

        // Detectar categoría por palabras clave
        const lower = text.toLowerCase();
        let icon = "chat";
        let topic = text.length > 30 ? text.slice(0, 28).trimEnd() + "…" : text;

        if (/clima|tiempo|lluvia|temperatura|fr[ií]o|calor/.test(lower)) {
          icon = "cloud";
          // Extraer ciudad si existe
          const cityMatch = text.match(/en\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/);
          topic = cityMatch ? `Clima en ${cityMatch[1]}` : "Clima";
        } else if (/espa[ñn]a|argentina|brasil|francia|madrid|boca|river|partido|gano|salio|como (le fue|salio|va)/i.test(lower)) {
          icon = "sports_soccer";
          topic = text.length > 25 ? text.slice(0, 23).trimEnd() + "…" : text;
        } else if (/gasto|gast[ée]|anota|compr[ée]|caf[ée]|almuerzo|cena|pesos|dolares|\$\d/.test(lower)) {
          icon = "savings";
          topic = text.length > 25 ? text.slice(0, 23).trimEnd() + "…" : text;
        } else if (/informe|investig|busc[áa]|noticias|qui[ée]n|qu[eé] pas|cu[áa]l es/.test(lower)) {
          icon = "search";
          topic = text.length > 25 ? text.slice(0, 23).trimEnd() + "…" : text;
        } else if (/record[áa]|pendiente|tarea|alarm|despert/.test(lower)) {
          icon = "task_alt";
          topic = text.length > 25 ? text.slice(0, 23).trimEnd() + "…" : text;
        }

        return { id: turn.id, icon, topic, turnId: turn.id };
      })
      .filter((p): p is SuggestionPill => p !== null)
      .reverse(); // más reciente primero
  }, [chatTurns]);

  // ── Wheel: long-press detection ──
  // Mantener presionado 500ms en cualquier parte del chat (no en composer/buttons)
  // abre el wheel radial. Soltar fuera del wheel = cancelar.
  // 🔴 FIX: tolerar movimiento del dedo hasta 10px (antes cualquier touchmove cancelaba)
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleLongPressStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // No activar si se está procesando o grabando
    if (processing || isRecording || wheelOpen) return;
    // No activar si el touch empieza en un botón o input
    const target = e.target as HTMLElement;
    if (target.closest("button, input, textarea, .koru-composer, .koru-back-button, .koru-suggestion-pill, .koru-wheel-overlay")) return;

    // Registrar posición inicial para detectar si es scroll vs long-press
    const clientX = "touches" in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;
    longPressStartPos.current = { x: clientX ?? 0, y: clientY ?? 0 };

    longPressTimerRef.current = setTimeout(() => {
      setWheelOpen(true);
      setWheelActive(null);
      longPressStartPos.current = null;
      // Haptic feedback si está disponible
      if ("vibrate" in navigator) navigator.vibrate(30);
    }, 500);
  }, [processing, isRecording, wheelOpen]);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPos.current = null;
  }, []);

  // 🔴 FIX: en vez de cancelar con cualquier touchmove, tolerar hasta 10px
  // (si el dedo se mueve más de 10px, es scroll → cancelar long-press)
  const handleLongPressTouchMove = useCallback((e: React.TouchEvent) => {
    if (!longPressStartPos.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - longPressStartPos.current.x;
    const dy = touch.clientY - longPressStartPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 10) {
      handleLongPressCancel();
    }
  }, [handleLongPressCancel]);

  const handleWheelSelect = useCallback((option: string) => {
    setWheelOpen(false);
    setWheelActive(null);
    handleLongPressCancel();

    // Navegar a la pantalla correspondiente
    if (option === "memory" && onNavigate) {
      onNavigate("memoria");
    } else if (option === "history" && onNavigate) {
      onNavigate("historial");
    } else if (option === "home" && onNavigate) {
      onNavigate("hoy");
    } else if (option === "settings" && onNavigate) {
      onNavigate("configuracion");
    } else if (option === "create") {
      // 🔴 v2: opción Crear en el Wheel — abre CreateScreen
      setShowCreate(true);
    }
    // "close" = solo cierra el wheel (ya hecho arriba)
  }, [onNavigate, handleLongPressCancel]);

  // Touch move dentro del wheel: detectar qué opción está bajo el dedo
  const handleWheelTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const overlay = wheelOverlayRef.current;
    if (!overlay) return;

    // Encontrar qué opción está bajo el dedo
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const option = el?.closest("[data-wheel-option]") as HTMLElement | null;
    if (option) {
      setWheelActive(option.dataset.wheelOption ?? null);
    } else {
      setWheelActive(null);
    }
  }, []);

  // Touch end en el OVERLAY (no en una opción): 
  // - Si wheelActive tiene valor → seleccionar (el dedo estaba sobre una opción al soltar)
  // - Si no → cerrar sin seleccionar (el dedo estaba fuera del wheel)
  // IMPORTANTE: este handler NO debe interferir con taps directos en los botones,
  // por eso los botones tienen su propio onTouchEnd que llama a stopPropagation.
  const handleWheelTouchEnd = useCallback(() => {
    if (wheelActive) {
      handleWheelSelect(wheelActive);
    } else {
      setWheelOpen(false);
      setWheelActive(null);
    }
  }, [wheelActive, handleWheelSelect]);

  // Handler para tap directo en una opción (mobile + desktop):
  // - onTouchEnd: dispara en mobile cuando levantás el dedo sobre el botón
  //   Llamamos a handleWheelSelect directamente. stopPropagation evita que
  //   el handleWheelTouchEnd del overlay cancele la selección.
  // - onClick: dispara en desktop.
  const handleOptionTap = useCallback((option: string) => {
    handleWheelSelect(option);
  }, [handleWheelSelect]);

  const handleOptionTouchEnd = useCallback((e: React.TouchEvent, option: string) => {
    e.preventDefault();  // evitar que disparó también el click sintético del browser
    e.stopPropagation(); // evitar que el overlay cierre sin seleccionar
    handleWheelSelect(option);
  }, [handleWheelSelect]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // 🔴 Listener para guardar informe desde el detail screen
  useEffect(() => {
    const onSaveDeliverable = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSaveModal({ title: detail.title, subtitle: detail.subtitle, blockData: detail.blockData });
    };
    window.addEventListener("koru-save-deliverable", onSaveDeliverable as EventListener);
    return () => window.removeEventListener("koru-save-deliverable", onSaveDeliverable as EventListener);
  }, []);

  // 🔴 PDF export v2 — escucha el evento disparado por el detail screen,
  // envía los turnos al backend que ahora devuelve un PDF binario real (puppeteer),
  // y lo descarga automáticamente como archivo .pdf.
  // Dos modos: 'chat' (toda la conversación) o 'deliverable' (solo el bloque actual).
  useEffect(() => {
    const downloadPdf = async (endpoint: string, payload: any, filename: string) => {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const contentType = resp.headers.get("Content-Type") || "";
      // Si el backend devolvió PDF binario, descargamos directo
      if (contentType.includes("application/pdf")) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }
      // Fallback: el backend devolvió HTML (puppeteer falló) — abrir en nueva pestaña
      const html = await resp.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const onExportPdf = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const title = detail?.blockTitle || "Conversación con Koru";
      const blockData = detail?.blockData;
      try {
        // 🔴 Si viene blockData, exportamos SOLO ese deliverable (modo limpio para compartir)
        if (blockData) {
          await downloadPdf("/api/koru/export-deliverable", {
            block: blockData,
            title,
            userName,
            language,
            generatedAt: new Date().toISOString(),
          }, `koru-${(title || "deliverable").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now()}.pdf`);
          return;
        }
        // 🔴 Si no, exportamos la conversación completa (últimos 50 turns)
        const turns = chatTurns
          .filter((t) => t.text && t.text.trim().length > 0)
          .slice(-50)
          .map((t) => ({
            role: t.role === "koru" ? "koru" : "user",
            text: t.text,
            createdAt: t.createdAt,
            items: t.items?.map((it) => ({
              type: it.uiBlock?.type,
              title: (it.uiBlock as any)?.title,
              subtitle: (it.uiBlock as any)?.subtitle,
              note: (it.uiBlock as any)?.note,
              items: (it.uiBlock as any)?.items,
              sources: (it.uiBlock as any)?.sources,
              summaryItems: (it.uiBlock as any)?.summaryItems,
              homeTeam: (it.uiBlock as any)?.homeTeam,
              awayTeam: (it.uiBlock as any)?.awayTeam,
              homeScore: (it.uiBlock as any)?.homeScore,
              awayScore: (it.uiBlock as any)?.awayScore,
              status: (it.uiBlock as any)?.status,
              timeline: (it.uiBlock as any)?.timeline,
              items2: (it.uiBlock as any)?.items2 || (it.uiBlock as any)?.items,
              price: (it.uiBlock as any)?.price,
              change24h: (it.uiBlock as any)?.change24h,
              sparkline: (it.uiBlock as any)?.sparkline,
            })),
          }));
        await downloadPdf("/api/koru/export-pdf", {
          title,
          userName,
          language,
          turns,
          generatedAt: new Date().toISOString(),
        }, `koru-conversacion-${Date.now()}.pdf`);
      } catch (err) {
        console.error("[export-pdf]", err);
        alert("No se pudo generar el PDF. Intentá de nuevo.");
      }
    };
    window.addEventListener("koru-export-pdf", onExportPdf as EventListener);
    return () => window.removeEventListener("koru-export-pdf", onExportPdf as EventListener);
  }, [chatTurns, userName, language]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (processing || isListening) {
      node.scrollTop = node.scrollHeight;
      return;
    }
    const previousCount = turnCountRef.current;
    turnCountRef.current = chatTurns.length;
    if (chatTurns.length > previousCount) {
      // 🔴 FIX: scrollear al final para mostrar la card completa + CTA
      // Delay para esperar a que las cards se rendericen
      setTimeout(() => {
        if (node) {
          node.scrollTop = node.scrollHeight;
        }
      }, 300);
    }
  }, [chatTurns, processing, isListening, interimText]);

  useEffect(() => {
    if (!speechStatus.supported) inputRef.current?.focus();
  }, [speechStatus.supported]);

  // ── Proactive Engine: al abrir la app, chequear si hay algo que decir ──
  // El engine corre en el server, lee las memories del usuario y decide si
  // hay un evento relevante (partido, lluvia, pendiente, cumpleaños).
  // Si lo hay, genera un mensaje CON PERSONALIDAD y lo muestra como primer turn.
  const proactiveCheckedRef = useRef(false);
  useEffect(() => {
    if (proactiveCheckedRef.current) return;
    if (onboarding) return;
    proactiveCheckedRef.current = true;

    const lastSeen = parseInt(localStorage.getItem("koru.lastSeen") ?? "0", 10) || Date.now();

    (async () => {
      try {
        // 🔴 FIX CRÍTICO: enviar el state REAL del usuario, no hardcoded vacío.
        // Esto desbloquea todos los triggers del proactive engine.
        const stateToSend = {
          memories: (memories ?? []).filter((m: any) => m.status === "confirmed" || m.status === "candidate").slice(0, 20).map((m: any) => ({ kind: m.kind, text: m.text })),
          commitments: [],
          records: [],
          userName: (history?.[0] as any)?.userName ?? "",
        };

        const res = await fetch("/api/koru/proactive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: stateToSend,
            lastSeen,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.shouldShow && data.reply) {
          const proactiveTurn: KoruChatTurn = {
            id: `proactive_${Date.now()}`,
            role: "koru",
            text: data.reply,
            createdAt: new Date().toISOString(),
            status: "done",
            mascotState: data.mascotState ?? "happy",
          };
          window.dispatchEvent(new CustomEvent("koru:proactive", { detail: proactiveTurn }));
        }
      } catch {
        // silent
      }
    })();

    localStorage.setItem("koru.lastSeen", String(Date.now()));
  }, [onboarding]);

  const submitText = useCallback(async (text: string, source: "typed" | "speech") => {
    const clean = text.trim();
    if (!clean) return;

    // Onboarding conversacional: interceptar el nombre
    if (onboardingPhaseRef.current === "waiting_for_name") {
      // El usuario respondió su nombre. Guardarlo y completar onboarding.
      const name = clean.length > 30 ? clean.slice(0, 30).trim() : clean;
      // Capitalizar primera letra
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      setOnboardingPhase("done");
      onOnboardingComplete?.(capitalizedName);
      return; // NO enviar al backend — es el nombre, no un mensaje normal
    }

    await sendMessage(clean, source);

    // Después del primer mensaje del usuario en modo onboarding, pasar a "waiting_for_name"
    if (onboarding && onboardingPhaseRef.current === "greeting") {
      // Esperar a que Koru responda, entonces preguntar el nombre
      // Usamos un timeout para dar tiempo a que llegue la respuesta del backend
      setTimeout(() => {
        setOnboardingPhase("waiting_for_name");
      }, 3000);
    }
  }, [sendMessage, onboarding, onOnboardingComplete]);

  const handleTextSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    // 🔴 Offline cache — if browser is offline, queue the message instead of
    // attempting a network call that will fail. It will auto-replay on reconnect.
    if (!online) {
      await queueOfflineMessage(text);
      return;
    }
    await submitText(text, "typed");
  }, [inputText, submitText, online, queueOfflineMessage]);

  const handleReview = useCallback((id: string, approve: boolean) => {
    reviewAction(id, approve);
  }, [reviewAction]);

  // Fase FIX: grabar audio con MediaRecorder API (funciona en todos los navegadores)
  // en lugar de SpeechRecognition que solo funciona en Chrome/Edge.
  // Graba → convierte a base64 → manda a /api/koru/asr → transcribe → envía como mensaje.
  const toggleMediaRecorder = useCallback(async () => {
    if (isRecording) {
      // Detener grabación
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Iniciar grabación
    showMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          if (!base64) {
            showMicError("No pude procesar el audio grabado.");
            return;
          }
          setTranscribing(true);
          showMicError("Transcribiendo audio...");
          try {
            const res = await fetch("/api/koru/asr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_base64: base64 }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as { text?: string };
            const text = (data.text ?? "").trim();
            if (!text) {
              showMicError("No pude transcribir el audio.");
              return;
            }
            await submitText(text, "typed");
          } catch (err) {
            showMicError(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      showMicError(`No pude acceder al micrófono: ${err instanceof Error ? err.message : "permiso denegado"}`);
    }
  }, [isRecording, showMicError, submitText]);

  // Fase 2.1 — Subir nota de voz: transcribe audio via /api/koru/asr y lo
  // manda como mensaje normal. Permite grabar audios largos sin SpeechRecognition
  // en vivo (que tiene timeout ~60s y no funciona en todos los navegadores).
  const handleAudioUpload = useCallback(async (file: File) => {
    if (!file) return;
    if (transcribing || processing) return;
    setTranscribing(true);
    showMicError("Transcribiendo audio...");
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(buf)),
      );
      const res = await fetch("/api/koru/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: base64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (!text) {
        showMicError("No pude transcribir el audio.");
        return;
      }
      await submitText(text, "typed");
    } catch (err) {
      showMicError(`Error de transcripción: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setTranscribing(false);
    }
  }, [transcribing, processing, showMicError, submitText]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleAudioUpload(file);
    e.target.value = "";
  }, [handleAudioUpload]);

  // Fase 3.8 — Subir imagen: analiza con VLM (OCR, descripción, etc.)
  // y manda el resultado como mensaje normal.
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) return;
    if (analyzingImage || processing) return;
    setAnalyzingImage(true);
    showMicError("Analizando imagen...");
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetch("/api/koru/vlm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (!text) {
        showMicError("No pude analizar la imagen.");
        return;
      }
      await submitText(text, "typed");
    } catch (err) {
      showMicError(`Error de análisis: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setAnalyzingImage(false);
    }
  }, [analyzingImage, processing, showMicError, submitText]);

  const onImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImageUpload(file);
    e.target.value = "";
  }, [handleImageUpload]);

  return (
    <div className="koru-chat-shell" role="dialog" aria-modal="true" aria-label="Conversacion con Koru">
      <section
        className="koru-chat-screen"
        aria-label="Conversacion con Koru"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressCancel}
        onTouchMove={handleLongPressTouchMove}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressCancel}
        onMouseLeave={handleLongPressCancel}
      >
        {/* Fondo dinámico — cambia según el estado de Koru */}
        <KoruBackground state={bgState} />

        {/* 🔴 Memory toast: aparece cuando Koru aprende algo del usuario */}
        {memoryToast && (
          <MemoryToast
            key={memoryToast.id}
            kind={memoryToast.kind}
            text={memoryToast.text}
            onDismiss={dismissMemoryToast}
          />
        )}

        {/* 🔴 Morning brief: aparece al abrir la app por la mañana */}
        {morningBrief && (
          <MorningBriefCard
            brief={morningBrief}
            onStart={() => {
              dismissMorningBrief();
            }}
          />
        )}

        {/* 🔴 PWA install prompt */}
        {showInstallPrompt && (
          <div className="koru-install-prompt" role="dialog" aria-label="Instalar Koru">
            <div className="koru-install-prompt-content">
              <div className="koru-install-prompt-icon">
                <span className="material-symbols-outlined">install_mobile</span>
              </div>
              <div className="koru-install-prompt-text">
                <strong>Instalá Koru</strong>
                <p>Acceso rápido desde tu pantalla de inicio</p>
              </div>
              <div className="koru-install-prompt-actions">
                <button type="button" onClick={() => void installApp()} className="koru-install-prompt-accept">Instalar</button>
                <button type="button" onClick={dismissInstallPrompt} className="koru-install-prompt-dismiss">Ahora no</button>
              </div>
            </div>
          </div>
        )}

        {/* 🔴 FIX: back-button eliminado — el wheel (long-press) es la única navegación */}
        <h1 className="koru-sr-heading">Koru</h1>

        {/* Suggestion Pills — temas de conversaciones anteriores */}
        {suggestionPills.length > 0 && !processing && (
          <div className="koru-suggestion-bar">
            {suggestionPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                className="koru-suggestion-pill"
                onClick={() => {
                  // Tap en pill = reenviar ese mensaje como nuevo turno
                  // (alternativa más simple: scroll al turno, pero como solo
                  // mostramos el último intercambio, reenviar es más útil)
                  const originalTurn = chatTurns.find(t => t.id === pill.turnId);
                  if (originalTurn) {
                    submitText(originalTurn.text, "typed");
                  }
                }}
              >
                <span className="material-symbols-outlined">{pill.icon}</span>
                {pill.topic}
              </button>
            ))}
          </div>
        )}

        <main ref={scrollRef} className="koru-chat-scroll">
          <div className="koru-thread">
            {visibleTurns.map((turn) =>
              turn.role === "user" ? (
                <UserTurnBubble key={turn.id} turn={turn} />
              ) : (
                <KoruTurnBubble
                  key={turn.id}
                  turn={turn}
                  onReview={handleReview}
                  onConfirmMemory={confirmMemory}
                  onPruneMemory={pruneMemory}
                  onCompleteCommitment={completeCommitment}
                  onSetWorldSignals={setWorldSignals}
                />
              ),
            )}

            {/* 🔴 Typing indicator — tres puntos animados cuando Koru está procesando */}
            {processing && !isListening && !workingDeliverable && activity?.kind !== "searching" && activity?.depth !== "deep" && (
              <div className="koru-message is-koru">
                <div className="koru-row">
                  <div className="koru-avatar">
                    <img src={KORU_AVATAR} alt="Koru" />
                  </div>
                  <div className="koru-bubble ai-bubble">
                    <div className="koru-typing-indicator">
                      <span className="koru-typing-dot" />
                      <span className="koru-typing-dot" />
                      <span className="koru-typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Onboarding conversacional — greeting con chips */}
            {onboarding && onboardingPhase === "greeting" && !processing && (
              <div className="koru-message is-koru">
                <div className="koru-row">
                  <div className="koru-avatar">
                    <img src={KORU_AVATAR} alt="Koru" />
                  </div>
                  <div className="koru-bubble ai-bubble">
                    <h3 className="koru-bubble-heading">Hola, soy Koru 🌿</h3>
                    <p className="koru-message-text">Tu asistente personal. Puedo ayudarte con clima, gastos, recordatorios, búsquedas y mucho más.</p>
                    <p className="koru-message-text" style={{ marginTop: 8, fontWeight: 600 }}>¿Qué necesitás hoy?</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                      {[
                        { icon: "cloud", text: "¿Qué tiempo hace?" },
                        { icon: "savings", text: "Anota un gasto" },
                        { icon: "search", text: "Buscá algo" },
                        { icon: "sports_soccer", text: "¿Cómo salió España?" },
                      ].map((chip) => (
                        <button
                          key={chip.text}
                          type="button"
                          onClick={() => submitText(chip.text, "typed")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 12px",
                            borderRadius: 999,
                            background: "rgba(131, 99, 249, 0.12)",
                            color: "#523A9E",
                            fontSize: 12,
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#8363F9" }}>{chip.icon}</span>
                          {chip.text}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Onboarding conversacional — pregunta del nombre */}
            {onboarding && onboardingPhase === "waiting_for_name" && !processing && (
              <div className="koru-message is-koru">
                <div className="koru-row">
                  <div className="koru-avatar">
                    <img src={KORU_AVATAR} alt="Koru" />
                  </div>
                  <div className="koru-bubble ai-bubble">
                    <h3 className="koru-bubble-heading">Por cierto, ¿cómo te llamo? 😊</h3>
                    <p className="koru-message-text">Así puedo personalizar mis respuestas y recordarte cosas más fácil.</p>
                  </div>
                </div>
              </div>
            )}

            {isListening && <ListeningBubble interimText={interimText} />}
          </div>
        </main>

        {/* WorkingPanel: REPLAZA el footer cuando hay tarea deep o searching.
            No se muestra el composer/input mientras Koru trabaja. */}
        {processing && !isListening && (workingDeliverable || activity?.depth === "deep" || activity?.kind === "searching") ? (
          <WorkingPanel phase={phase} kind={activity?.kind} deliverable={workingDeliverable} />
        ) : (
        <footer className="koru-chat-footer">
          {processing && !isListening && activity && !(workingDeliverable || activity?.depth === "deep" || activity?.kind === "searching") && (
            <div className="koru-activity-hint" role="status" aria-live="polite">
              <span className="koru-activity-dot" />
              {activity.label}
            </div>
          )}
            {/* 🔴 Offline cache — banner shown when browser loses connectivity */}
            {!online && (
              <p className="koru-footer-error" role="status" aria-live="polite">
                Sin conexión. Tus mensajes se guardan y se envían automáticamente al volver.
              </p>
            )}
            {ephemeral && <p className="koru-footer-note">Modo efimero activo - esta charla no guardara memoria nueva</p>}
            {micError && <p className="koru-footer-error">{micError}</p>}

            {/* 🔴 Quick actions — chips de sugerencias rápidas cuando el input está vacío */}
            {!inputText.trim() && !processing && !isListening && !isRecording && (
              <div className="koru-quick-actions">
                {[
                  { icon: "wb_sunny", text: "¿Qué tal el día?" },
                  { icon: "sports_soccer", text: "¿Cómo salió España?" },
                  { icon: "restaurant", text: "Receta" },
                  { icon: "savings", text: "Bitcoin" },
                  { icon: "calendar_today", text: "Mi día" },
                ].map((chip) => (
                  <button
                    key={chip.text}
                    type="button"
                    className="koru-quick-action"
                    onClick={() => {
                      setInputText(chip.text);
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="material-symbols-outlined">{chip.icon}</span>
                    {chip.text}
                  </button>
                ))}
              </div>
            )}

            <div className="koru-composer">
              {/* 🔴 v2: coachmark para Create — aparece después del 2do mensaje */}
              {showCreateCoachmark && (
                <div className="koru-create-coachmark" role="dialog" aria-label="Tip: Crear">
                  <div className="koru-create-coachmark-bubble">
                    <span className="material-symbols-outlined">tips_and_updates</span>
                    <div className="koru-create-coachmark-text">
                      <strong>¿Querés anotar algo rápido?</strong>
                      <span>Tocá el <strong>+</strong> abajo para crear notas, listas, gastos y más.</span>
                    </div>
                    <button
                      type="button"
                      className="koru-create-coachmark-close"
                      aria-label="Cerrar"
                      onClick={dismissCreateCoachmark}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="koru-create-coachmark-arrow" />
                </div>
              )}
              {/* 🔴 Composer: ephemeral (toggle rápido) + crear + adjuntar + input + mic/send */}
              <button
                type="button"
                onClick={() => setEphemeral(!ephemeral)}
                aria-label={ephemeral ? "Desactivar modo efimero" : "Activar modo efimero"}
                className={cn("koru-composer-icon", ephemeral && "is-active")}
              >
                <Leaf size={20} />
              </button>
              {/* 🔴 v2: botón + para crear contenido estructurado (Nota/Lista/Gasto/Enlace) */}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                aria-label="Crear"
                className="koru-composer-icon koru-composer-create"
              >
                <Plus size={20} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={transcribing || processing || analyzingImage}
                aria-label="Adjuntar archivo"
                className={cn("koru-composer-icon", (transcribing || analyzingImage) && "is-active")}
              >
                <Paperclip size={20} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type.startsWith("image/")) {
                    onImageChange(e);
                  } else {
                    onFileChange(e);
                  }
                }}
                className="hidden"
              />
              <div className="koru-composer-field">
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleTextSubmit();
                    }
                  }}
                  placeholder="Habla con Koru..."
                  disabled={processing}
                  className="koru-composer-input"
                />
              </div>
              {speechStatus.supported || true ? (
                <button
                  type="button"
                  onClick={inputText.trim() ? () => void handleTextSubmit() : toggleMediaRecorder}
                  disabled={processing && !inputText.trim()}
                  aria-label={inputText.trim() ? "Enviar" : isRecording ? "Detener grabación" : "Hablar"}
                  className={cn("koru-mic-button", isRecording && "is-listening")}
                >
                  {inputText.trim() ? <ArrowUp size={22} /> : isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleTextSubmit()}
                  disabled={!inputText.trim() || processing}
                  aria-label="Enviar"
                  className="koru-mic-button"
                >
                  <ArrowUp size={24} />
                </button>
              )}
            </div>
          </footer>
        )}

        {/* Wheel Overlay — long-press navigation */}
        {wheelOpen && (
          <div
            ref={wheelOverlayRef}
            className="koru-wheel-overlay"
            onTouchMove={handleWheelTouchMove}
            onTouchEnd={handleWheelTouchEnd}
            onMouseDown={(e) => {
              // Click fuera del wheel = cancelar
              if (e.target === e.currentTarget) {
                setWheelOpen(false);
                setWheelActive(null);
              }
            }}
          >
            <div className="koru-wheel-container">
              <div className="koru-wheel-hint">
                <span className="material-symbols-outlined">touch_app</span>
                Deslizá y soltá sobre una opción
              </div>

              <button
                type="button"
                className="koru-wheel-center"
                aria-label="Crear"
                onClick={(e) => {
                  e.stopPropagation();
                  setWheelOpen(false);
                  setWheelActive(null);
                  handleLongPressCancel();
                  setShowCreate(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setWheelOpen(false);
                  setWheelActive(null);
                  handleLongPressCancel();
                  setShowCreate(true);
                }}
              >
                <span className="material-symbols-outlined">add_circle</span>
                <span>Crear</span>
              </button>

              <div
                className={`koru-wheel-option top ${wheelActive === "memory" ? "active" : ""}`}
                data-wheel-option="memory"
                onMouseEnter={() => setWheelActive("memory")}
                onClick={() => handleOptionTap("memory")}
                onTouchEnd={(e) => handleOptionTouchEnd(e, "memory")}
              >
                <span className="material-symbols-outlined">neurology</span>
                <span className="wheel-label">Memoria</span>
              </div>

              <div
                className={`koru-wheel-option right ${wheelActive === "history" ? "active" : ""}`}
                data-wheel-option="history"
                onMouseEnter={() => setWheelActive("history")}
                onClick={() => handleOptionTap("history")}
                onTouchEnd={(e) => handleOptionTouchEnd(e, "history")}
              >
                <span className="material-symbols-outlined">history</span>
                <span className="wheel-label">Historial</span>
              </div>

              <div
                className={`koru-wheel-option bottom ${wheelActive === "home" ? "active" : ""}`}
                data-wheel-option="home"
                onMouseEnter={() => setWheelActive("home")}
                onClick={() => handleOptionTap("home")}
                onTouchEnd={(e) => handleOptionTouchEnd(e, "home")}
              >
                <span className="material-symbols-outlined">home</span>
                <span className="wheel-label">Home</span>
              </div>

              <div
                className={`koru-wheel-option left ${wheelActive === "settings" ? "active" : ""}`}
                data-wheel-option="settings"
                onMouseEnter={() => setWheelActive("settings")}
                onClick={() => handleOptionTap("settings")}
                onTouchEnd={(e) => handleOptionTouchEnd(e, "settings")}
              >
                <span className="material-symbols-outlined">settings</span>
                <span className="wheel-label">Ajustes</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 🔴 Modal de Guardar Informe — elegir carpeta o "Que Koru se encargue" */}
      {saveModal && (
        <div
          className="koru-save-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSaveModal(null); }}
        >
          <div className="koru-save-modal">
            <h2 className="koru-save-title">Guardar informe</h2>
            <p className="koru-save-subtitle">{saveModal.title}</p>

            <div className="koru-save-options">
              <button
                className="koru-save-option koru-save-option-koru"
                onClick={() => {
                  // "Que Koru se encargue" — guardar con colección automática
                  const block = saveModal.blockData;
                  const collection = block?.topic || block?.kicker || "Informes";
                  // Disparar save como record
                  window.dispatchEvent(new CustomEvent("koru-save-record", {
                    detail: {
                      title: saveModal.title,
                      collection: `Koru · ${collection}`,
                      kind: "idea",
                      notes: saveModal.subtitle,
                    }
                  }));
                  setSaveModal(null);
                }}
              >
                <span className="material-symbols-outlined">eco</span>
                <div>
                  <strong>Que Koru se encargue</strong>
                  <small>Koru agrupa por tema automáticamente</small>
                </div>
              </button>

              <button
                className="koru-save-option"
                onClick={() => setSaveFolderMode(true)}
              >
                <span className="material-symbols-outlined">create_new_folder</span>
                <div>
                  <strong>Elegir carpeta</strong>
                  <small>Poné el nombre que quieras</small>
                </div>
              </button>

              {/* 🔴 v2: input inline para nombre de carpeta (reemplaza prompt()) */}
              {saveFolderMode && (
                <div className="koru-save-folder-input">
                  <input
                    type="text"
                    placeholder="Nombre de la carpeta"
                    defaultValue="Informes"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          window.dispatchEvent(new CustomEvent("koru-save-record", {
                            detail: {
                              title: saveModal.title,
                              collection: val,
                              kind: "idea",
                              notes: saveModal.subtitle,
                            }
                          }));
                          setSaveModal(null);
                          setSaveFolderMode(false);
                        }
                      } else if (e.key === "Escape") {
                        setSaveFolderMode(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="koru-save-folder-confirm"
                    onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement);
                      const val = input?.value.trim();
                      if (val) {
                        window.dispatchEvent(new CustomEvent("koru-save-record", {
                          detail: {
                            title: saveModal.title,
                            collection: val,
                            kind: "idea",
                            notes: saveModal.subtitle,
                          }
                        }));
                        setSaveModal(null);
                        setSaveFolderMode(false);
                      }
                    }}
                  >
                    <span className="material-symbols-outlined">check</span>
                  </button>
                </div>
              )}
            </div>

            <button className="koru-save-cancel" onClick={() => { setSaveModal(null); setSaveFolderMode(false); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 🔴 v2: CreateScreen — modal para crear Nota/Lista/Gasto/Enlace sin LLM */}
      {showCreate && (
        <CreateScreen onClose={() => setShowCreate(false)} />
      )}

      {/* 🔴 v2: reopenedRecord — reabre el bloque original de un record guardado */}
      {reopenedRecord?.sourceBlock && (
        <KoruUnifiedCard
          block={reopenedRecord.sourceBlock}
          // 🔴 key forzado para que se monte fresh cada vez
          key={`reopened-${reopenedRecord.id}`}
        />
      )}
    </div>
  );
}

