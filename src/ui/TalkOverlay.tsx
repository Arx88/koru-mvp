import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Heart,
  Mic,
  MicOff,
  Send,
  Sparkles,
} from "lucide-react";
import { createSpeechSession, getSpeechSupport } from "../domain/speech";
import { cn } from "../lib/utils";
import { useKoru, type KoruChatTurn, type KoruTurnItem } from "./KoruProvider";
import { KoruSemanticCard } from "./chatCards";
import type { MascotState } from "./KoruMascot";
import type { AgentActivity } from "../domain/agentKernel";

type KoruTheme = "light" | "dark";

const THEME_STORAGE_KEY = "koru.chat.theme.v1";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function readTheme(): KoruTheme {
  try {
    const forced = document.documentElement.dataset.koruTheme;
    if (forced === "dark" || forced === "light") return forced;
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function statusText(items?: KoruTurnItem[]): string {
  const actions = items?.filter((item) => item.kind === "action") ?? [];
  const hasMemory = items?.some((item) => item.kind === "memory");
  const hasQuestion = actions.some((item) => item.actionKind === "clarifying_question");
  const hasReviewable = actions.some((item) => item.status === "proposed" && ![
    "clarifying_question",
    "structured_note",
    "money_summary",
    "morning_brief",
    "decision_support",
  ].includes(item.actionKind ?? ""));
  const hasVerifiedSources = actions.some((item) => item.sources?.length || item.externalStatus === "verified");
  const hasSavedRecord = actions.some((item) => item.actionKind === "structured_note" || item.uiBlock?.type === "saved_record");
  if (hasQuestion) return "Pidiendo contexto";
  if (hasReviewable) return "Listo para revisar";
  if (hasVerifiedSources) return "Fuentes verificadas";
  if (hasSavedRecord) return "Guardado";
  if (actions.length) return "Listo";
  if (hasMemory) return "Guardando contexto";
  return "";
}

function headerStatus(processing: boolean, listening: boolean, items: KoruChatTurn[], activity?: AgentActivity | null): string {
  if (listening) return "Koru esta escuchando...";
  if (processing) return activity?.label ?? "Koru esta trabajando...";
  const hasOpenAction = items.some((turn) =>
    turn.items?.some((item) =>
      item.kind === "action" &&
      item.status === "proposed" &&
      ![
        "clarifying_question",
        "structured_note",
        "money_summary",
        "morning_brief",
        "decision_support",
      ].includes(item.actionKind ?? ""),
    ),
  );
  if (hasOpenAction) return "Listo para revisar";
  return "Koru esta contigo";
}

function mascotForState(
  processing: boolean,
  listening: boolean,
  items: KoruChatTurn[],
  mascotState?: MascotState,
): string {
  if (items.some((turn) => turn.status === "error")) return "/images/koru-states/mistake.png";
  if (listening) return "/images/koru-states/thinking.png";
  if (processing) return "/images/koru-states/working.png";

  const lastTurn = items[items.length - 1];
  const emotionalState = mascotState || lastTurn?.mascotState;
  if (emotionalState) {
    const stateMap: Record<string, string> = {
      idle: "/images/koru-states/idle.png",
      thinking: "/images/koru-states/thinking.png",
      working: "/images/koru-states/working.png",
      happy: "/images/koru-states/happy.png",
      tired: "/images/koru-states/tired.png",
      sleeping: "/images/koru-states/sleeping.png",
      mistake: "/images/koru-states/mistake.png",
      planning: "/images/koru-states/planning.png",
      "product-search": "/images/koru-states/product-search.png",
      building: "/images/koru-states/building.png",
      cooking: "/images/koru-states/cooking.png",
      "thinking-2": "/images/koru-states/thinking-2.png",
      celebrating: "/images/koru-states/happy.png",
      worried: "/images/koru-states/thinking-2.png",
      affectionate: "/images/koru-states/happy.png",
      curious: "/images/koru-states/thinking.png",
    };
    if (stateMap[emotionalState]) return stateMap[emotionalState];
  }

  const lastAction = [...items].reverse().flatMap((turn) => turn.items ?? []).find((item) => item.kind === "action");
  if (lastAction?.actionKind === "web_research") return "/images/koru-states/product-search.png";
  if (lastAction?.actionKind === "file_bundle") return "/images/koru-states/building.png";
  if (lastAction?.actionKind === "structured_note") return "/images/koru-states/happy.png";
  if (lastAction?.actionKind === "money_summary" || lastAction?.actionKind === "decision_support") return "/images/koru-states/thinking-2.png";
  if (lastAction?.actionKind === "morning_brief" || lastAction?.actionKind === "meeting_brief") return "/images/koru-states/planning.png";
  if (lastAction?.actionKind === "day_plan" || lastAction?.actionKind === "daily_brief") return "/images/koru-states/planning.png";
  if (lastAction?.actionKind === "clarifying_question") return "/images/koru-states/thinking-2.png";
  if (lastAction?.actionKind === "draft_message") return "/images/koru-states/cooking.png";
  if (lastAction?.actionKind === "calendar_event" || lastAction?.actionKind === "reminder" || lastAction?.actionKind === "restock_note") {
    return "/images/koru-states/working.png";
  }
  if (lastAction?.status === "executed") return "/images/koru-states/happy.png";
  return "/images/koru-states/idle.png";
}

function TurnItemCard({
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
}

function KoruTurnBubble({
  turn,
  onReview,
  onLike,
  onConfirmMemory,
  onPruneMemory,
  onCompleteCommitment,
  onSetWorldSignals,
}: {
  turn: KoruChatTurn;
  onReview: (id: string, approve: boolean) => void;
  onLike: (id: string) => void;
  onConfirmMemory: (id: string) => void;
  onPruneMemory: (id: string) => void;
  onCompleteCommitment: (id: string) => void;
  onSetWorldSignals: (enabled: boolean) => void;
}) {
  const status = statusText(turn.items);
  return (
    <div className="koru-message is-koru">
      <div className="koru-bubble ai-bubble">
        <p className="koru-message-text">{turn.text}</p>
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
      <div className="koru-meta-row">
        {status && <span>{status}</span>}
        <span>{timeLabel(turn.createdAt)}</span>
        {turn.liked && (
          <button
            type="button"
            onClick={() => onLike(turn.id)}
            aria-label="Quitar me gusta"
            className="koru-like is-liked"
          >
            <Heart size={14} className="fill-current" />
          </button>
        )}
      </div>
    </div>
  );
}

function UserTurnBubble({ turn }: { turn: KoruChatTurn }) {
  return (
    <div className="koru-message is-user">
      <div className="koru-bubble user-bubble">
        <p className="koru-message-text">{turn.text}</p>
      </div>
      <div className="koru-user-meta">
        <span>{timeLabel(turn.createdAt)}</span>
        <Check size={13} />
      </div>
    </div>
  );
}

function ProcessingBubble({ listening, interimText, activity }: { listening: boolean; interimText: string; activity?: AgentActivity | null }) {
  return (
    <div className="koru-message is-koru">
      <div className="koru-bubble ai-bubble">
        <p className="koru-action-title">
          <Sparkles size={16} />
          <span>{listening ? interimText || "Te escucho..." : activity?.label ?? "Lo miro."}</span>
        </p>
      </div>
    </div>
  );
}
export function TalkOverlay({ onClose }: { onClose: () => void }) {
  const {
    chatTurns,
    sendMessage,
    reviewAction,
    toggleTurnLike,
    confirmMemory,
    pruneMemory,
    completeCommitment,
    setWorldSignals,
    processing,
    activity,
    ephemeral,
    setEphemeral,
  } = useKoru();
  const [theme, setTheme] = useState<KoruTheme>(() => readTheme());
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechStatus] = useState(() => getSpeechSupport());
  const [micError, setMicError] = useState("");
  const recognitionRef = useRef<ReturnType<typeof createSpeechSession> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const turnCountRef = useRef(chatTurns.length);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("es", { day: "numeric", month: "long" }),
    [],
  );
  const visibleTurns = useMemo(() => {
    const hasUserTurn = chatTurns.some((turn) => turn.role === "user");
    if (!hasUserTurn) return chatTurns;
    return chatTurns.filter((turn, index) => !(index === 0 && turn.role === "koru" && !turn.items?.length));
  }, [chatTurns]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        setTheme((current) => (current === "light" ? "dark" : "light"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme persistence is best-effort.
    }
  }, [theme]);

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
      const userTurns = node.querySelectorAll<HTMLElement>(".koru-message.is-user");
      const lastUserTurn = userTurns[userTurns.length - 1];
      node.scrollTop = Math.max(0, (lastUserTurn?.offsetTop ?? node.scrollHeight) - 72);
    }
  }, [chatTurns, processing, isListening, interimText]);

  useEffect(() => {
    if (!speechStatus.supported) inputRef.current?.focus();
  }, [speechStatus.supported]);

  const submitText = useCallback(async (text: string, source: "typed" | "speech") => {
    const clean = text.trim();
    if (!clean) return;
    await sendMessage(clean, source);
  }, [sendMessage]);

  const handleTextSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    await submitText(text, "typed");
  }, [inputText, submitText]);

  const handleReview = useCallback((id: string, approve: boolean) => {
    reviewAction(id, approve);
  }, [reviewAction]);

  function toggleMic() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    setMicError("");
    let finalAccumulated = "";

    const recognition = createSpeechSession({
      onFinalText: (text) => {
        finalAccumulated += (finalAccumulated ? " " : "") + text;
        setInterimText("");
      },
      onInterimText: setInterimText,
      onError: (message) => {
        setMicError(message);
        setIsListening(false);
        recognitionRef.current = null;
      },
      onEnd: () => {
        setIsListening(false);
        recognitionRef.current = null;
        const text = finalAccumulated.trim();
        if (text) {
          void submitText(text, "speech");
        }
      },
    });

    if (!recognition) {
      setMicError("Voz no disponible en este navegador.");
      return;
    }

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setMicError(`No pude iniciar el microfono: ${err instanceof Error ? err.message : "error desconocido"}`);
      setIsListening(false);
    }
  }

  return (
    <div className="koru-chat-shell" data-koru-theme={theme}>
      <section className="koru-chat-screen" aria-label="Conversacion con Koru">
        <header className="koru-chat-header">
          <button type="button" onClick={onClose} aria-label="Volver" className="koru-back-button">
            <ChevronLeft size={22} />
          </button>
          <div className="koru-header-center">
            <img src={mascotForState(processing, isListening, visibleTurns, visibleTurns[visibleTurns.length - 1]?.mascotState)} alt="Koru" className="koru-header-mascot-image" />
            <h1 className="koru-sr-heading">Koru</h1>
            <div className="koru-status">
              <span className="koru-status-dot" />
              <span>{headerStatus(processing, isListening, visibleTurns, activity)}</span>
            </div>
          </div>
          <div className="koru-header-divider" />
        </header>

        <main ref={scrollRef} className="koru-chat-scroll">
          <div className="koru-top-fade" />
          <div className="koru-date-pill">Hoy, {todayLabel}</div>

          <div className="koru-thread">
            {visibleTurns.map((turn) =>
              turn.role === "user" ? (
                <UserTurnBubble key={turn.id} turn={turn} />
              ) : (
                <KoruTurnBubble
                  key={turn.id}
                  turn={turn}
                  onReview={handleReview}
                  onLike={toggleTurnLike}
                  onConfirmMemory={confirmMemory}
                  onPruneMemory={pruneMemory}
                  onCompleteCommitment={completeCommitment}
                  onSetWorldSignals={setWorldSignals}
                />
              ),
            )}

            {(processing || isListening) && <ProcessingBubble listening={isListening} interimText={interimText} activity={activity} />}
          </div>
        </main>

        <footer className="koru-chat-footer">
          {ephemeral && <p className="koru-footer-note">Modo efimero activo - esta charla no guardara memoria nueva</p>}
          {micError && <p className="koru-footer-error">{micError}</p>}

          <div className="koru-composer">
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
              placeholder="Escribe tu mensaje..."
              disabled={processing}
              className="koru-composer-input"
            />
            <div className="koru-composer-actions">
              <button
                type="button"
                onClick={() => setEphemeral(!ephemeral)}
                aria-label={ephemeral ? "Desactivar modo efimero" : "Activar modo efimero"}
                className={cn("koru-composer-icon", ephemeral && "is-active")}
              >
                <Sparkles size={21} />
              </button>
              {speechStatus.supported ? (
                <button
                  type="button"
                  onClick={inputText.trim() ? () => void handleTextSubmit() : toggleMic}
                  disabled={processing && !inputText.trim()}
                  aria-label={inputText.trim() ? "Enviar" : isListening ? "Terminar voz" : "Hablar"}
                  className={cn("koru-mic-button", isListening && "is-listening")}
                >
                  {inputText.trim() ? <Send size={18} /> : isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleTextSubmit()}
                  disabled={!inputText.trim() || processing}
                  aria-label="Enviar"
                  className="koru-mic-button"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

