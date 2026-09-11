import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, CloudSun, MapPin, Lightbulb, ClipboardCheck, Image as ImageIcon,
  Leaf, Mic, MicOff, Paperclip, Plus, RotateCcw, Square, UserRound, X,
} from "lucide-react";
import { createSpeechSession, getSpeechSupport } from "../domain/speech";
import { stopSpeaking } from "../domain/koruVoice";
import { cn } from "../lib/utils";
import { useKoru, type KoruChatTurn, type KoruTurnItem } from "./KoruProvider";
import { KoruSemanticCard } from "./chatCards";
import { KoruUnifiedCard } from "./cards/unified/KoruUnifiedCard";
import { KoruBackground } from "./KoruBackground";
import { MichiHeaderV8, type MichiMenuAction } from "./michi/MichiHeaderV8";
import {
  BubbleShapes, MichiCat, MICHI_CAT_AVATAR, useMichiLandscape, useMichiUserAvatar,
} from "./michi/v8Shared";
import {
  MichiProgressDialog, MichiLandscapeDialog, MichiUserAvatarDialog, MichiResetDialog,
} from "./michi/MichiDialogs";
import { MemoryToast } from "./MemoryToast";
import { Suspense, lazy } from "react";
// 🔴 v3: Mis Colecciones code-split (igual que en KoruUnifiedCard).
const LazyCollectionsScreen = lazy(() =>
  import("./CollectionsScreen").then((m) => ({ default: m.CollectionsScreen })),
);
import { MorningBriefCard } from "./MorningBriefCard";
import { CreateScreen } from "./create/CreateScreen";
import { MichiResearchLoading } from "./michi/MichiResearchLoading";
import { lastKoruTurnIsStreaming } from "../domain/turn";
import { renderMarkdownBody, CopyButton } from "./MarkdownMessage";

// TalkOverlay = réplica Stitch "Chat con Koru": paisaje nocturno ilustrado a
// pantalla completa, conversación anclada abajo con burbujas claras (usuario
// #F0F4FF / Koru #F8F4FA + avatar circular) y composer blanco con hoja (eco),
// campo "Habla con Koru..." y botón #6D52F8. El estado "trabajando" es el
// panel claro de Stitch con la barra REAL sincronizada a las fases del
// pipeline, y el plan entregado se renderiza como la hoja "Tu Plan" (cards).

// 🐱 Michi (antes Koru) — avatar del gato 3D naranja (diseño v7)
const KORU_AVATAR = MICHI_CAT_AVATAR;

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
  userAvatar,
  onReview,
  onConfirmMemory,
  onPruneMemory,
  onCompleteCommitment,
  onSetWorldSignals,
}: {
  turn: KoruChatTurn;
  userAvatar: string;
  onReview: (id: string, approve: boolean) => void;
  onConfirmMemory: (id: string) => void;
  onPruneMemory: (id: string) => void;
  onCompleteCommitment: (id: string) => void;
  onSetWorldSignals: (enabled: boolean) => void;
}) {
  const { heading, body } = splitKoruText(turn.text);
  // La investigación en curso tiene un único panel en el hilo; no duplicar
  // su estado con una burbuja vacía o un esqueleto de la futura tarjeta.
  const hasWorkingDeliverable = (turn.items ?? []).some(
    (it) => it.uiBlock?.type === "deliverable" && (it.uiBlock as { status?: string }).status === "working",
  );
  const showBubble = !hasWorkingDeliverable && Boolean(heading || body);
  const turnDone = turn.status !== "working";
  const visibleItems = turn.items?.filter(item => !(item.uiBlock?.type === "deliverable" && item.uiBlock.status === "working"));
  if (!showBubble && !visibleItems?.length) return null;
  return (
    <div className="mx-group">
      <div className="mx-row from-koru">
        <MichiCat sparkle={turn.id === "welcome-michi"} />
        {showBubble && (
          <div className="mx-bubble mx-koru">
            {heading && <p className="mx-heading">{heading}</p>}
            {/* 🔴 UX: render de markdown (listas, negritas, links) */}
            <div className="mx-text">{renderMarkdownBody(body)}</div>
            {/* 🐱 v7.6 — firma ✦ ELIMINADA: "símbolo raro" al final de TODOS los
                mensajes. Sin adorno, como su referencia. */}
          </div>
        )}
      </div>
      {/* 🔴 UX: copiar mensaje — icono fantasma 28px discreto (v7.6) */}
      {showBubble && turnDone && (heading || body) && <div className="mx-copy"><CopyButton text={turn.text} /></div>}
      {visibleItems && visibleItems.length > 0 && (
        <div className="mx-cards">
          {visibleItems.map((item) => (
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

function UserTurnBubble({ turn, userAvatar }: { turn: KoruChatTurn; userAvatar: string }) {
  // 🐱 v8 — porte 1:1 del usuario: burbuja lavanda con silueta Bézier
  // (bubble-user) + meta con avatar 41px, hora y ✓✓ en blanco.
  const time = (() => {
    try {
      const d = new Date(turn.createdAt);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  })();
  return (
    <div className="mx-group">
      <div className="mx-row from-user">
        <div className="mx-bubble mx-user">
          <p className="mx-text">{turn.text}</p>
        </div>
        <div className="mx-usermeta">
          <img src={userAvatar} alt="Tu avatar" />
          <span>
            {time}{" "}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-label="Mensaje enviado">
              <path d="M2 12l4 4L11 7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 12l4 4L20 7" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" transform="translate(3,5)" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function ListeningBubble({ interimText }: { interimText: string }) {
  return (
    <div className="mx-group">
      <div className="mx-row from-koru">
        <MichiCat />
        <div className="mx-bubble mx-koru">
          <p className="mx-text">{interimText || "Te escucho..."}</p>
        </div>
      </div>
    </div>
  );
}

export function TalkOverlay({ onClose, onNavigate, onAvatares, onboarding, onOnboardingComplete }: { onClose: () => void; onNavigate?: (tab: "hoy" | "memoria" | "historial" | "configuracion") => void; onAvatares?: () => void; onboarding?: boolean; onOnboardingComplete?: (name: string, facts?: string[]) => void }) {
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
    confirmMemoryToast,
    rejectMemoryToast,
    collectionsView,
    openCollections,
    closeCollections,
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
    state: koruDomainState,
    updatePreferences,
    resetChat,
  } = useKoru();
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // 🔴 v2: coachmark para Create — se muestra después del 2do mensaje del usuario
  const [showCreateCoachmark, setShowCreateCoachmark] = useState(() => {
    return localStorage.getItem("michi.createCoachmarkSeen") !== "true";
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
    localStorage.setItem("michi.createCoachmarkSeen", "true");
  }
  const [interimText, setInterimText] = useState("");
  const [speechStatus] = useState(() => getSpeechSupport());
  const [micError, setMicError] = useState("");

  // ===== 🐱 v7.5 — Voz de Michi: pill "Silenciar" visible mientras habla =====
  // Queja del usuario: "tiene la voz activa sin que yo la haya activado, ni
  // siquiera veo cómo desactivarlo en settings". Ahora: (1) la voz arranca
  // OFF por defecto y el flag legacy quedó reseteado (KoruProvider), (2) el
  // toggle vive en Ajustes → Apariencia (buscable por "voz"), y (3) si está
  // hablando, esta pill flotante da un botón de silencio INMEDIATO.
  const voiceOn = koruDomainState?.preferences?.koruVoiceEnabled === true;
  const [michiSpeaking, setMichiSpeaking] = useState(false);
  useEffect(() => {
    if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setMichiSpeaking(false);
      return;
    }
    const id = window.setInterval(() => {
      try {
        setMichiSpeaking(window.speechSynthesis.speaking || window.speechSynthesis.pending);
      } catch {
        setMichiSpeaking(false);
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [voiceOn]);

  // ===== 🐱 v8 — Estado del design system del usuario =====
  // Paisaje (auto por franja horaria + override persistido) y avatar del
  // usuario (user-reference.webp por defecto, elegible desde el popover +).
  const { activeArt, override: landscapeOverride, chooseLandscape } = useMichiLandscape();
  const { userAvatar, chooseUserAvatar } = useMichiUserAvatar();
  const [modal, setModal] = useState<
    "progress" | "landscape" | "user-avatar" | "reset" | null
  >(null);
  // Categoría seleccionada del composer (su .category-chip .selected)
  const [category, setCategory] = useState("Clima");
  const [optsOpen, setOptsOpen] = useState(false);

  const lastUserText = useMemo(() => {
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      if (chatTurns[i].role === "user") return chatTurns[i].text;
    }
    return undefined;
  }, [chatTurns]);
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
  // 🐱 v7.6 — Infinite scroll: "pegado al fondo" mientras el usuario no
  // scrollee arriba a leer el historial (≤140px del fondo = stick).
  const stickToBottomRef = useRef(true);

  // Fase 1 (audit visual): auto-dismiss del error de micrófono tras 4s.
  // Antes el error "No pude transcribir: not-allowed" se quedaba pegado en
  // el footer compitiendo con el composer. Ahora se limpia solo.
  const showMicError = useCallback((message: string) => {
    if (micErrorTimerRef.current) clearTimeout(micErrorTimerRef.current);
    setMicError(message);
    micErrorTimerRef.current = setTimeout(() => setMicError(""), 4000);
  }, []);

  // 🐱 v7.6 — INFINITE SCROLL como el demo (estilo-v2.html): TODO el
  // historial de la conversación (hasta 120 turns persistidos) vive en el
  // feed y se recorre scrolleando hacia arriba. Antes: "respuesta única" —
  // solo se veía el ÚLTIMO intercambio y el resto del historial (con SUS
  // CARDS incluidas) desaparecía al enviar un mensaje nuevo. Ese slice era
  // la causa #1 de la queja "las cards no salen": se renderizaban bien y
  // luego el slice las ocultaba del feed.
  const visibleTurns = chatTurns;

  // El entregable aporta el progreso emitido por la tarea. El panel vive
  // dentro del hilo y mantiene el composer disponible.
  const workingDeliverable = useMemo(() => {
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      const turn = chatTurns[i];
      if (turn.role !== "koru") continue;
      for (const item of turn.items ?? []) {
        const block = item.uiBlock;
        if (block?.type === "deliverable" && block.status === "working") {
          return { id: turn.id, kicker: block.kicker, progress: block.progress, phaseLabel: block.phaseLabel };
        }
      }
      break; // solo el último turno de Koru cuenta
    }
    return null;
  }, [chatTurns]);

  // 🔴 FIX PROCESANDO MÚLTIPLE (bug en vivo 2026-09-08): mientras el turno de
  // Koru ya está streamteando (status "working" con texto/cards visibles), el
  // TypingDots "Procesando…" NO debe duplicarse abajo — el propio turno ya
  // comunica actividad ("Buscando X…", notas "Buscando información…" de los
  // items, WorkingPanel). El TypingDots queda reservado para el intervalo real
  // previo al primer chunk (enviado → primera señal del backend).
  const hasStreamingKoruTurn = useMemo(() => lastKoruTurnIsStreaming(chatTurns), [chatTurns]);

  // ── Sugerencias de temas: extrae topics de los user turns anteriores ──
  // Solo aparecen si hay charla previa (más de 1 user turn en el historial completo).
  // Cada pill muestra un icono según la categoría detectada + el topic recortado.
  type SuggestionPill = { id: string; icon: string; topic: string; turnId: string };

  const suggestionPills = useMemo<SuggestionPill[]>(() => {
    // Recorrer TODOS los chatTurns (no solo visibleTurns) para encontrar temas anteriores
    const userTurns = chatTurns.filter(t => t.role === "user");
    // 🔴 FIX (bug en vivo 2026-09-08): el último user turn es la pregunta que
    // el usuario ACABA de mandar — mostrarla como chip arriba duplica el
    // mensaje en pantalla y se lee como UI rota. Los chips son para VOLVER a
    // temas anteriores, así que excluimos el turno más reciente.
    const olderUserTurns = userTurns.slice(0, -1);
    if (olderUserTurns.length < 1) return [];

    // Tomar los últimos 4 user turns anteriores al actual
    const recentUserTurns = olderUserTurns.slice(-4);
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
    if (target.closest("button, input, textarea, .koru-composer, .koru-suggestion-pill, .koru-wheel-overlay")) return;

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
      if (event.key === "Escape") {
        // 🐱 v8 — si hay una UI superpuesta abierta (menú del header, modal
        // del design system, wheel, coachmark o CreateScreen), Escape la
        // cierra a ELLA — no al chat entero (onClose tiraba el overlay y
        // dejaba al usuario en "Hoy" sin querer).
        const overlayOpen = document.querySelector(
          ".mx-menu, .mx-dialog-overlay, .koru-wheel-overlay, .koru-save-overlay, .mx-opts, .koru-create-coachmark",
        );
        if (overlayOpen) {
          // 🐱 v8.1 — el coachmark de Crear es un tip informativo sin handler
          // propio de Escape: si es lo único abierto, Escape lo descarta
          // (antes quedaba totalmente tragado y el usuario no podía salir).
          if (overlayOpen.classList.contains("koru-create-coachmark") && showCreateCoachmark) {
            dismissCreateCoachmark();
          }
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, showCreateCoachmark, dismissCreateCoachmark]);

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
      const title = detail?.blockTitle || "Conversación con Michi";
      const blockData = detail?.blockData;
      try {
        // 🔴 Si viene blockData, exportamos SOLO ese deliverable (modo limpio para compartir)
        if (blockData) {
          await downloadPdf("/api/michi/export-deliverable", {
            block: blockData,
            title,
            userName,
            language,
            generatedAt: new Date().toISOString(),
          }, `michi-${(title || "deliverable").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now()}.pdf`);
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
        await downloadPdf("/api/michi/export-pdf", {
          title,
          userName,
          language,
          turns,
          generatedAt: new Date().toISOString(),
        }, `michi-conversacion-${Date.now()}.pdf`);
      } catch (err) {
        console.error("[export-pdf]", err);
        alert("No se pudo generar el PDF. Intentá de nuevo.");
      }
    };
    window.addEventListener("koru-export-pdf", onExportPdf as EventListener);
    return () => window.removeEventListener("koru-export-pdf", onExportPdf as EventListener);
  }, [chatTurns, userName, language]);

  // 🐱 v7.6 — Auto-scroll INTELIGENTE para infinite scroll:
  // · Montaje: con historial restaurado, anclar abajo (mensaje más reciente)
  // · Mientras procesa/streaming: seguir abajo SOLO si el usuario está pegado
  //   al fondo. Si scrolleó arriba a leer el historial, NO lo arrastramos.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const jump = () => { node.scrollTop = node.scrollHeight; };
    jump();
    const t = setTimeout(jump, 350); // re-anclaje tras fonts/cards/images
    return () => clearTimeout(t);
  }, []);

  // 🐱 v7.6 — Trackear "pegado al fondo": stick = a ≤140px del final.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => {
      stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 140;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const previousCount = turnCountRef.current;
    turnCountRef.current = chatTurns.length;
    const grew = chatTurns.length > previousCount;
    if ((processing || isListening || grew) && stickToBottomRef.current) {
      // Delay para esperar a que las cards se rendericen (layout final)
      const t = setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, processing ? 120 : 300);
      return () => clearTimeout(t);
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

    const lastSeen = parseInt(localStorage.getItem("michi.lastSeen") ?? "0", 10) || Date.now();

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

        const res = await fetch("/api/michi/proactive", {
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

    localStorage.setItem("michi.lastSeen", String(Date.now()));
  }, [onboarding]);

  const submitText = useCallback(async (text: string, source: "typed" | "speech") => {
    const clean = text.trim();
    if (!clean) return;
    // 🐱 v7.6 — Al enviar, pegarse al fondo (aunque estuviera arriba leyendo):
    // el propio mensaje del usuario lo baja. Como WhatsApp/Telegram.
    stickToBottomRef.current = true;

    // Onboarding conversacional: interceptar el nombre
    if (onboardingPhaseRef.current === "waiting_for_name") {
      // 🔴 FIX (2026-09-09): antes CUALQUIER texto se guardaba verbatim como
      // nombre ("no quiero decirte", "dale dale" → perfil con nombre basura
      // persistido). Ahora: solo se acepta si parece un nombre (letras, sin
      // frases largas, sin interjecciones); si no, se usa "amigo" y el texto
      // va al chat normal.
      const NAME_BLOCKLIST = new Set([
        "dale", "jaja", "jeje", "nada", "ok", "okay", "si", "sí", "no", "nope",
        "hm", "mmm", "vos", "yo", "que", "quien", "como", "callate", "cállate",
      ]);
      const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
      const looksLikeName =
        /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,30}$/.test(clean) &&
        !/\s.{0,30}\b(no|sos|callate|cállate|porque|quiero|decir)\b/i.test(clean) &&
        words.length > 0 &&
        !words.some(w => NAME_BLOCKLIST.has(w));
      if (looksLikeName) {
        const name = clean.length > 30 ? clean.slice(0, 30).trim() : clean;
        // Capitalizar primera letra
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        setOnboardingPhase("done");
        onOnboardingComplete?.(capitalizedName);
        return; // NO enviar al backend — es el nombre, no un mensaje normal
      }
      // No parece un nombre → completar con el fallback y seguir la
      // conversación real (el mensaje se procesa como chat normal).
      setOnboardingPhase("done");
      onOnboardingComplete?.("amigo");
      // NO return: cae al sendMessage de abajo con el texto original.
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
  // Graba → convierte a base64 → manda a /api/michi/asr → transcribe → envía como mensaje.
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
            const res = await fetch("/api/michi/asr", {
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

  // Fase 2.1 — Subir nota de voz: transcribe audio via /api/michi/asr y lo
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
      const res = await fetch("/api/michi/asr", {
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
      const res = await fetch("/api/michi/vlm", {
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
    <div className="koru-chat-shell" role="dialog" aria-modal="true" aria-label="Conversación con Michi">
      <section
        className="koru-chat-screen"
        aria-label="Conversación con Michi"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressCancel}
        onTouchMove={handleLongPressTouchMove}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressCancel}
        onMouseLeave={handleLongPressCancel}
      >
        {/* 🐱 v8 — Definiciones de formas Bézier (burbujas + composer) del usuario */}
        <BubbleShapes />

        {/* 🐱 v8 — Fondo: paisaje del usuario (auto por hora o elegido a mano) */}
        <KoruBackground activeArt={activeArt} />

        {/* 🐱 v8 — Header del usuario: status bar + Michi + nivel/XP + menú */}
        <MichiHeaderV8
          onMenuAction={(action) => {
            if (action === "progress") setModal("progress");
            else if (action === "landscape") setModal("landscape");
            else if (action === "avatares") onAvatares?.();
            else onNavigate?.(action);
          }}
          onAvatares={() => onAvatares?.()}
        />

        {/* 🔴 Memory toast: aparece cuando Michi aprende algo del usuario.
            * Para guardados (Crear / Guardar card) ofrece "Ver" → Mis Colecciones. */}
        {memoryToast && (
          <MemoryToast
            key={memoryToast.id}
            kind={memoryToast.kind}
            text={memoryToast.text}
            onDismiss={dismissMemoryToast}
            memoryId={memoryToast.id.startsWith("toast_") ? undefined : memoryToast.id}
            onConfirm={confirmMemoryToast}
            onReject={rejectMemoryToast}
            collection={memoryToast.collection}
            onOpenCollections={openCollections}
          />
        )}

        {/* 🔴 Morning brief: aparece al abrir la app por la mañana */}
        {morningBrief && (
          <MorningBriefCard
            brief={morningBrief}
            city={koruDomainState.userProfile?.location || koruDomainState.userProfile?.homeCity || koruDomainState.weatherCache?.city}
            onLater={dismissMorningBrief}
            onStart={() => {
              dismissMorningBrief();
            }}
          />
        )}

        <h1 className="koru-sr-heading">Michi</h1>

        {/* 🔴 v7.4 — Suggestion Pills ELIMINADAS a pedido del usuario:
            los chips de conversación bajo la barra de XP/Michi ensuciaban la
            parte superior del chat. Las sugerencias útiles viven abajo
            (koru-quick-actions junto al composer). suggestionPills (memo) y
            su CSS quedan sin uso — retirados del render. */}

        <main ref={scrollRef} className="koru-chat-scroll">
          <div className="koru-thread">
            {visibleTurns.map((turn) =>
              turn.role === "user" ? (
                <UserTurnBubble key={turn.id} turn={turn} userAvatar={userAvatar} />
              ) : (
                <KoruTurnBubble
                  key={turn.id}
                  turn={turn}
                  userAvatar={userAvatar}
                  onReview={handleReview}
                  onConfirmMemory={confirmMemory}
                  onPruneMemory={pruneMemory}
                  onCompleteCommitment={completeCommitment}
                  onSetWorldSignals={setWorldSignals}
                />
              ),
            )}

            {/* 🔴 Typing indicator — tres puntos animados cuando Koru está procesando.
                Kimi audit: reemplazamos los puntos sueltos por <TypingDots> con la
                voz mágica "Lo estoy oliendo…" para que el usuario sienta que Koru
                está presente, no esperando en frío.
                🔴 FIX INDICADOR ÚNICO (2026-09-09): los puntos NUNCA coexisten con
                el WorkingPanel (actividades deep: "Sumergiéndome en tu búsqueda…"
                + "Procesando…" al mismo tiempo = la queja del usuario) ni con el
                footer hint. El label rotativo de la actividad ("Pensando esto…",
                "Buscando información…") vive AHORA en los propios puntos — un solo
                indicador visible en todo momento. */}
            {processing && !isListening && !workingDeliverable && !hasStreamingKoruTurn && activity?.depth !== "deep" && (
              <div className="mx-typing-row">
                <MichiCat size={36} />
                <div className="mx-typing" aria-label="Michi está escribiendo">
                  <i /><i /><i />
                </div>
              </div>
            )}

            {/* Onboarding conversacional — greeting (🔴 v7.4: chips de conversación
                ELIMINADOS a pedido — el onboarding queda texto limpio; las sugerencias
                rotativas viven abajo, junto al composer) */}
            {onboarding && onboardingPhase === "greeting" && !processing && (
              <div className="mx-group">
                <div className="mx-row from-koru">
                  <MichiCat sparkle />
                  <div className="mx-bubble mx-koru">
                    <p className="mx-heading">Hola, soy Michi 🐱</p>
                    <div className="mx-text">Tu asistente personal. Puedo ayudarte con clima, gastos, recordatorios, búsquedas y mucho más.</div>
                    <div className="mx-text" style={{ marginTop: 6, fontWeight: 800 }}>¿Qué necesitás hoy?</div>
                  </div>
                </div>
              </div>
            )}

            {/* Onboarding conversacional — pregunta del nombre */}
            {onboarding && onboardingPhase === "waiting_for_name" && !processing && (
              <div className="mx-group">
                <div className="mx-row from-koru">
                  <MichiCat />
                  <div className="mx-bubble mx-koru">
                    <p className="mx-heading">Por cierto, ¿cómo te llamo? 😊</p>
                    <div className="mx-text">Así puedo personalizar mis respuestas y recordarte cosas más fácil.</div>
                  </div>
                </div>
              </div>
            )}

            {processing && !isListening && (workingDeliverable || activity?.depth === "deep") && (
              <MichiResearchLoading key={workingDeliverable?.id ?? "pending-research"} phase={phase} kind={activity?.kind} deliverable={workingDeliverable} />
            )}

            {isListening && <ListeningBubble interimText={interimText} />}
          </div>
        </main>

        <footer className="koru-chat-footer" data-voice-on={voiceOn ? "1" : "0"} data-speaking={michiSpeaking ? "1" : "0"}>
            {/* 🔴 Offline cache — banner shown when browser loses connectivity */}
            {!online && (
              <p className="koru-footer-error" role="status" aria-live="polite">
                Sin conexión. Tus mensajes se guardan y se envían automáticamente al volver.
              </p>
            )}
            {ephemeral && <p className="koru-footer-note">Modo efímero activo — esta charla no guardará memoria nueva</p>}
            {micError && <p className="koru-footer-error">{micError}</p>}

            {/* 🐱 v7.5 — Voz en vivo: pill con silencio inmediato mientras
                Michi habla (la respuesta a "no veo cómo desactivarlo"). */}
            {michiSpeaking && (
              <div className="koru-voice-live" role="status" aria-live="polite">
                <span className="koru-voice-eq" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <span className="koru-voice-live-label">Michi está hablando</span>
                <button
                  type="button"
                  className="koru-voice-live-btn"
                  onClick={() => {
                    stopSpeaking();
                    setMichiSpeaking(false);
                  }}
                >
                  Silenciar
                </button>
                <button
                  type="button"
                  className="koru-voice-live-off"
                  aria-label="Desactivar la voz de Michi en ajustes"
                  title="Desactivar la voz para siempre"
                  onClick={() => {
                    stopSpeaking();
                    setMichiSpeaking(false);
                    updatePreferences({ koruVoiceEnabled: false });
                  }}
                >
                  <span className="material-symbols-outlined">voice_over_off</span>
                </button>
              </div>
            )}

            {/* 🔴 PWA install prompt — 🐱 v8.1 FIX SOLAPAMIENTO: antes era
                position:fixed bottom:16px y flotaba ENCIMA de los chips de
                sugerencia y del composer (VLM audit). Ahora vive en el flujo
                del footer, encima de los chips: el footer cede su lugar y nada
                se solapa por construcción. */}
            {showInstallPrompt && (
              <div className="koru-install-prompt" role="dialog" aria-label="Instalar Michi">
                <div className="koru-install-prompt-content">
                  <div className="koru-install-prompt-icon">
                    <span className="material-symbols-outlined">install_mobile</span>
                  </div>
                  <div className="koru-install-prompt-text">
                    <strong>Instalá Michi</strong>
                    <p>Acceso rápido desde tu pantalla de inicio</p>
                  </div>
                  <div className="koru-install-prompt-actions">
                    <button type="button" onClick={() => void installApp()} className="koru-install-prompt-accept">Instalar</button>
                    <button type="button" onClick={dismissInstallPrompt} className="koru-install-prompt-dismiss">Ahora no</button>
                  </div>
                </div>
              </div>
            )}

            {/* 🐱 v8 — Chips de categoría del usuario (Clima / Lugares / Ideas /
                Tareas): chips blancos rotados con iconos violeta; el seleccionado
                queda con gradiente violeta. En su demo eran respuestas fijas —
                acá cada chip dispara el mensaje al agente REAL de Michi. */}
            <nav className="mx-chips" aria-label="Temas para conversar">
              {([
                ["Clima", CloudSun, "¿Cómo está el clima hoy?"],
                ["Lugares", MapPin, "¿Qué lugares me recomendás para salir?"],
                ["Ideas", Lightbulb, "Dame ideas para hoy"],
                ["Tareas", ClipboardCheck, "¿Qué tareas tengo pendientes hoy?"],
              ] as const).map(([name, Icon, preset]) => (
                <button
                  key={name}
                  type="button"
                  className={`mx-chip ${category === name ? "selected" : ""}`}
                  onClick={() => {
                    setCategory(name);
                    if (!online) {
                      void queueOfflineMessage(preset);
                      return;
                    }
                    void submitText(preset, "typed");
                  }}
                >
                  <Icon size={19} />
                  <span>{name}</span>
                </button>
              ))}
            </nav>

            {/* 🔴 v2: coachmark para Create — aparece después del 2do mensaje.
                🐱 v8.1 FIX SOLAPAMIENTO: antes era position:absolute bottom:100%
                DENTRO del form composer y su burbuja tapaba los chips de
                sugerencia (VLM audit). Ahora es elemento de flujo del footer,
                entre los chips y el composer: la flecha sigue apuntando al botón
                + y nada queda cubierto. */}
            {showCreateCoachmark && !processing && (
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

            {/* 🐱 v8 — Composer del usuario: forma orgánica (clipPath
                composer-shape), botones redondos violeta (radial #aa89ff →
                #5d3ee7) e input pastilla #e9efff. El + abre el popover de
                opciones (Mi avatar / Nueva conversación / Crear / Adjuntar /
                Modo efímero) con el estilo .composer-options. */}
            <form
              className="mx-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void handleTextSubmit();
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  type="button"
                  className="mx-round mx-add"
                  aria-label="Más opciones"
                  aria-expanded={optsOpen}
                  onClick={() => setOptsOpen((v) => !v)}
                >
                  {optsOpen ? <X /> : <Plus />}
                </button>
                {optsOpen && (
                  <div className="mx-opts" role="menu">
                    <button type="button" onClick={() => { setOptsOpen(false); setModal("user-avatar"); }}>
                      <UserRound size={19} /> Mi avatar
                    </button>
                    <button type="button" onClick={() => { setOptsOpen(false); setShowCreate(true); }}>
                      <Plus size={19} /> Crear nota, lista o gasto
                    </button>
                    <button
                      type="button"
                      disabled={transcribing || analyzingImage}
                      onClick={() => { setOptsOpen(false); fileInputRef.current?.click(); }}
                    >
                      <Paperclip size={19} /> Adjuntar archivo
                    </button>
                    <button type="button" onClick={() => { setOptsOpen(false); setEphemeral(!ephemeral); }} style={ephemeral ? { background: "#e7f9ef" } : undefined}>
                      <Leaf size={19} /> {ephemeral ? "Desactivar modo efímero" : "Modo efímero"}
                    </button>
                    <button type="button" onClick={() => { setOptsOpen(false); setModal("reset"); }}>
                      <RotateCcw size={19} /> Nueva conversación
                    </button>
                  </div>
                )}
              </div>
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
                placeholder={isRecording ? "Grabando… te escucho" : "Habla con Michi..."}
                aria-label="Mensaje para Michi"
                maxLength={1500}
                autoComplete="off"
              />
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
              <button
                type={inputText.trim() ? "submit" : "button"}
                onClick={inputText.trim() ? undefined : toggleMediaRecorder}
                aria-label={inputText.trim() ? "Enviar mensaje" : isRecording ? "Detener grabación" : "Dictar mensaje"}
                className={`mx-round ${isRecording ? "mx-listening" : ""}`}
              >
                {inputText.trim() ? <ArrowUp /> : isRecording ? <Square size={20} fill="white" /> : <Mic />}
              </button>
            </form>
          </footer>

        {/* 🐱 v8 — Modales del design system del usuario (progreso / paisaje /
            avatar personal / nueva conversación) */}
        {modal === "progress" && <MichiProgressDialog onClose={() => setModal(null)} />}
        {modal === "landscape" && (
          <MichiLandscapeDialog
            active={activeArt}
            override={landscapeOverride}
            onChoose={(n) => chooseLandscape(n)}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "user-avatar" && (
          <MichiUserAvatarDialog
            userAvatar={userAvatar}
            onChoose={chooseUserAvatar}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "reset" && <MichiResetDialog onConfirm={resetChat} onClose={() => setModal(null)} />}

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
                      collection: `Michi · ${collection}`,
                      kind: "idea",
                      notes: saveModal.subtitle,
                    }
                  }));
                  setSaveModal(null);
                }}
              >
                <span className="material-symbols-outlined">eco</span>
                <div>
                  <strong>Que Michi se encargue</strong>
                  <small>Michi agrupa por tema automáticamente</small>
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

      {/* 🔴 v2: CreateScreen — modal para crear Nota/Lista/Gasto/Enlace sin LLM. */}
      {showCreate && (
          <CreateScreen
            onClose={() => setShowCreate(false)}
            // 🔴 AI-assist — delega al backend /api/michi/ai-assist, que usa el
            // mismo LLM client que el chat principal (callProvider) con timeout
            // de 10s. Si el LLM falla, el endpoint devuelve { suggestions: [] }
            // y el botón simplemente no muestra sugerencias (graceful degrade).
            onAiAssist={async (template, title) => {
              try {
                const res = await fetch("/api/michi/ai-assist", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ template, title }),
                });
              if (!res.ok) return { suggestions: [] };
              const data = await res.json();
              const suggestions = Array.isArray(data?.suggestions)
                ? data.suggestions.filter(
                    (s: any) => s && typeof s.field === "string" && typeof s.value === "string",
                  )
                : [];
              return { suggestions };
            } catch {
              // Red caída o error inesperado — no rompemos el CreateScreen.
              return { suggestions: [] };
            }
          }}
          />
      )}

      {/* 🔴 v2: reopenedRecord — reabre el bloque original de un record guardado */}
      {reopenedRecord?.sourceBlock && (
        <KoruUnifiedCard
          block={reopenedRecord.sourceBlock}
          // 🔴 key forzado para que se monte fresh cada vez
          key={`reopened-${reopenedRecord.id}`}
        />
      )}

      {/* 🔴 v3: Mis Colecciones como pantalla global — abrible desde el toast
          * "Ver" (y desde cualquier punto futuro). focusCollection deja al
          * usuario dentro de la colección correcta. */}
      {collectionsView && (
        <Suspense fallback={null}>
          <LazyCollectionsScreen
            focusCollection={collectionsView.collection}
            onClose={closeCollections}
          />
        </Suspense>
      )}
    </div>
  );
}

