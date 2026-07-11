import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, Leaf, Mic, MicOff, Paperclip } from "lucide-react";
import { createSpeechSession, getSpeechSupport } from "../domain/speech";
import { cn } from "../lib/utils";
import { useKoru, PHASE_ORDER, type KoruChatTurn, type KoruTurnItem } from "./KoruProvider";
import type { AgentActivityKind } from "../domain/agentKernel";
import { KoruSemanticCard } from "./chatCards";

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
const WORKING_COPY: Partial<Record<AgentActivityKind, { title: string; subtitle: string }>> = {
  planning: { title: "Trabajando en tu plan...", subtitle: "Esto tomara solo unos segundos ✨" },
  searching: { title: "Armando tu informe...", subtitle: "Esto toma solo unos segundos ✨" },
  writing: { title: "Preparando tu documento...", subtitle: "Esto tomara solo unos segundos ✨" },
  comparing: { title: "Comparando opciones...", subtitle: "Esto tomara solo unos segundos ✨" },
};

type WorkingDeliverable = { kicker: string; progress?: number; phaseLabel?: string };

function WorkingPanel({ phase, kind, deliverable }: { phase: string | null; kind?: AgentActivityKind; deliverable?: WorkingDeliverable | null }) {
  const idx = phase ? (PHASE_ORDER as readonly string[]).indexOf(phase) : -1;
  const doneIdx = PHASE_ORDER.length - 1;
  // El entregable trae el % REAL del pipeline (deep_research); si no, se
  // aproxima por la fase emitida por el backend.
  const pct = deliverable?.progress != null
    ? Math.min(100, Math.max(0, Math.round(deliverable.progress)))
    : idx >= 0 ? Math.round(((idx + 1) / doneIdx) * 100) : null;
  const copy = deliverable
    ? {
        title: `Trabajando en ${deliverable.kicker.toLowerCase().startsWith("tu") ? deliverable.kicker.toLowerCase() : `tu ${deliverable.kicker.toLowerCase()}`}...`,
        subtitle: deliverable.phaseLabel ?? "Esto tomara solo unos segundos ✨",
      }
    : (kind && WORKING_COPY[kind]) ?? { title: "Trabajando...", subtitle: "Esto tomara solo unos segundos ✨" };

  return (
    <section className="koru-working-panel" role="status" aria-live="polite">
      <img src="/stitch/working-illustration.png" alt="" className="koru-working-illustration" />
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
      <p className="koru-working-motto">
        <svg fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="currentColor" />
        </svg>
        Cada paso cuenta, sigue asi
        <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" />
        </svg>
      </p>
    </section>
  );
}
export function TalkOverlay({ onClose }: { onClose: () => void }) {
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
  } = useKoru();
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechStatus] = useState(() => getSpeechSupport());
  const [micError, setMicError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const micErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechSession> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
    if (lastUserIdx === -1) return chatTurns; // aun sin interaccion: saludo inicial
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

    showMicError("");
    let finalAccumulated = "";

    const recognition = createSpeechSession({
      onFinalText: (text) => {
        finalAccumulated += (finalAccumulated ? " " : "") + text;
        setInterimText("");
      },
      onInterimText: setInterimText,
      onError: (message) => {
        showMicError(message);
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
      showMicError("Voz no disponible en este navegador.");
      return;
    }

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      showMicError(`No pude iniciar el microfono: ${err instanceof Error ? err.message : "error desconocido"}`);
      setIsListening(false);
    }
  }

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

  return (
    <div className="koru-chat-shell">
      <section className="koru-chat-screen" aria-label="Conversacion con Koru">
        <button type="button" onClick={onClose} aria-label="Volver" className="koru-back-button">
          <ChevronLeft size={22} />
        </button>
        <h1 className="koru-sr-heading">Koru</h1>

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

            {isListening && <ListeningBubble interimText={interimText} />}
          </div>
        </main>

        {processing && !isListening && (workingDeliverable || activity?.depth === "deep") ? (
          <WorkingPanel phase={phase} kind={activity?.kind} deliverable={workingDeliverable} />
        ) : (
          <footer className="koru-chat-footer">
            {processing && !isListening && activity && (
              <div className="koru-activity-hint" role="status" aria-live="polite">
                <span className="koru-activity-dot" />
                {activity.label}
              </div>
            )}
            {ephemeral && <p className="koru-footer-note">Modo efimero activo - esta charla no guardara memoria nueva</p>}
            {micError && <p className="koru-footer-error">{micError}</p>}

            <div className="koru-composer">
              <button
                type="button"
                onClick={() => setEphemeral(!ephemeral)}
                aria-label={ephemeral ? "Desactivar modo efimero" : "Activar modo efimero"}
                className={cn("koru-composer-icon", ephemeral && "is-active")}
              >
                <Leaf size={22} />
              </button>
              {/* Fase 2.1 — Subir nota de voz */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={transcribing || processing}
                aria-label="Subir nota de voz"
                className={cn("koru-composer-icon", transcribing && "is-active")}
              >
                <Paperclip size={22} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={onFileChange}
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
              {speechStatus.supported ? (
                <button
                  type="button"
                  onClick={inputText.trim() ? () => void handleTextSubmit() : toggleMic}
                  disabled={processing && !inputText.trim()}
                  aria-label={inputText.trim() ? "Enviar" : isListening ? "Terminar voz" : "Hablar"}
                  className={cn("koru-mic-button", isListening && "is-listening")}
                >
                  {inputText.trim() ? <ArrowUp size={24} /> : isListening ? <MicOff size={22} /> : <Mic size={22} />}
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
      </section>
    </div>
  );
}

