import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Leaf, Plus, Paperclip, Mic } from "lucide-react";
import type { UiBlock } from "./domain/types";
import { KoruProvider } from "./ui/KoruProvider";
import { KoruUnifiedCard } from "./ui/cards/unified/KoruUnifiedCard";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { CHAT_SCRIPT, type ChatEntry } from "./preview-data";
import "./style.css";
import "./koru-motion.css";
import "./preview.css";

// ============================================================================
// PREVIEW v5 — RÉPLICA FIEL DEL CHAT REAL DE KORU (TalkOverlay)
// Mismos tokens, mismo layout, mismas burbujas, mismo composer y mismo fondo
// de video que la app en producción. Lo ÚNICO rediseñado son las cards.
// ============================================================================

const KORU_AVATAR = "/stitch/avatar-chat.png";

function StatusBar() {
  return (
    <div className="pv-statusbar">
      <span className="pv-statusbar-time">9:41</span>
      <div className="pv-statusbar-notch" />
      <div className="pv-statusbar-icons">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="white" opacity="0.9"><path d="M1 8.5c1.8-2 3.9-3 6-3s4.2 1 6 3l-1.4 1.4c-1.3-1.5-2.9-2.3-4.6-2.3s-3.3.8-4.6 2.3L1 8.5Z"/><path d="M4.9 5.2C6 4.4 7.2 4 8.5 4s2.5.4 3.6 1.2l1-1.6C11.7 2.6 10.2 2 8.5 2S5.3 2.6 3.9 3.6l1 1.6Z"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="white" opacity="0.9"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.3" y="4.5" width="3" height="6.5" rx="1"/><rect x="8.6" y="2" width="3" height="9" rx="1"/><rect x="12.9" y="0" width="3" height="11" rx="1" opacity="0.4"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" opacity="0.9"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="white" strokeOpacity="0.5"/><rect x="2" y="2" width="15" height="7.5" rx="1.8" fill="white"/><path d="M23 4v4c1-.3 1.5-1 1.5-2s-.5-1.7-1.5-2Z" fill="white" fillOpacity="0.6"/></svg>
      </div>
    </div>
  );
}

// ── Burbujas EXACTAS de la app real (style.css 407-500 + tokens :root) ──────
function UserTurn({ text }: { text: string }) {
  return (
    <div className="koru-message is-user">
      <div className="koru-bubble">
        <p className="koru-message-text">{text}</p>
      </div>
    </div>
  );
}

function KoruTurn({ children }: { children: ReactNode }) {
  return (
    <div className="koru-message is-koru">
      <div className="koru-row">
        <div className="koru-avatar">
          <img src={KORU_AVATAR} alt="Koru" />
        </div>
        <div className="koru-bubble ai-bubble">{children}</div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
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
  );
}

// ── Chat con auto-scroll y entrada progresiva ──────────────────────────────
function ChatFeed() {
  const feedRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(0);
  const entries = useMemo<ChatEntry[]>(() => CHAT_SCRIPT, []);

  useEffect(() => {
    if (visible >= entries.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), visible === 0 ? 400 : 520);
    return () => clearTimeout(t);
  }, [visible, entries.length]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [visible]);

  const showTyping = visible < entries.length;

  return (
    <main ref={feedRef} className="koru-chat-scroll">
      <div className="koru-thread">
        <WelcomeTurn />
        {entries.slice(0, visible).map((e, i) => {
          if (e.kind === "user") return <UserTurn key={i} text={e.text} />;
          if (e.kind === "text") {
            return (
              <KoruTurn key={i}>
                <p className="koru-message-text">{e.text}</p>
              </KoruTurn>
            );
          }
          return (
            <KoruTurn key={i}>
              {e.intro && <p className="koru-message-text" style={{ marginBottom: 10 }}>{e.intro}</p>}
              <KoruUnifiedCard block={e.block as UiBlock} />
            </KoruTurn>
          );
        })}
        {showTyping && <TypingBubble />}
      </div>
    </main>
  );
}

// ── Footer: quick actions + composer BLANCO réplica exacta ─────────────────
function ChatFooter() {
  return (
    <footer className="koru-chat-footer">
      <div className="koru-quick-actions">
        <button type="button" className="koru-quick-action">
          <span className="material-symbols-outlined">cloud</span>
          ¿Qué tiempo hace?
        </button>
        <button type="button" className="koru-quick-action">
          <span className="material-symbols-outlined">sports_soccer</span>
          ¿Cómo salió España?
        </button>
        <button type="button" className="koru-quick-action">
          <span className="material-symbols-outlined">explore</span>
          Planificame el día
        </button>
      </div>
      <div className="koru-composer">
        <button type="button" aria-label="Modo efímero" className="koru-composer-icon">
          <Leaf size={20} />
        </button>
        <button type="button" aria-label="Crear" className="koru-composer-icon koru-composer-create">
          <Plus size={20} />
        </button>
        <button type="button" aria-label="Adjuntar archivo" className="koru-composer-icon">
          <Paperclip size={20} />
        </button>
        <div className="koru-composer-field">
          <input placeholder="Habla con Koru..." readOnly className="koru-composer-input" />
        </div>
        <button type="button" aria-label="Hablar" className="koru-mic-button">
          <Mic size={22} />
        </button>
      </div>
    </footer>
  );
}

// ── Suggestion pills (patrón real de la app) → acceso directo a propuestas ─
function SuggestionBar() {
  return (
    <div className="koru-suggestion-bar">
      <a href="/propuesta-a.html" className="koru-suggestion-pill">
        <span className="material-symbols-outlined">auto_awesome</span>
        Propuesta
        <span className="topic">A · Lectura Visual</span>
      </a>
      <a href="/propuesta-b-full.html" className="koru-suggestion-pill">
        <span className="material-symbols-outlined">record_voice_over</span>
        Propuesta
        <span className="topic">B · Koru te Cuenta</span>
      </a>
    </div>
  );
}

// ── Burbuja de bienvenida: explica el showcase + botones a las propuestas ──
function WelcomeTurn() {
  return (
    <KoruTurn>
      <p className="koru-message-text">
        ¡Hola Arx! Bienvenido al showcase de los nuevos diseños.
        Deslizá para ver las cards rediseñadas en el chat y tocá cualquiera
        para abrir su interior. Para el rediseño del interior completo,
        te preparé dos propuestas y el catálogo completo:
      </p>
      <div className="pv-welcome-actions">
        <a className="pv-welcome-btn" href="/propuesta-a.html">
          <span className="material-symbols-outlined">auto_awesome</span>
          <span className="pv-welcome-btn-text">
            <strong>Propuesta A</strong>
            <small>Lectura Visual · estilo revista · modo claro</small>
          </span>
          <span className="material-symbols-outlined pv-welcome-go">chevron_right</span>
        </a>
        <a className="pv-welcome-btn" href="/propuesta-b-full.html">
          <span className="material-symbols-outlined">record_voice_over</span>
          <span className="pv-welcome-btn-text">
            <strong>Propuesta B</strong>
            <small>Koru te Cuenta · momentos firma · modo claro</small>
          </span>
          <span className="material-symbols-outlined pv-welcome-go">chevron_right</span>
        </a>
        <a className="pv-welcome-btn" href="/lectura-visual.html">
          <span className="material-symbols-outlined">style</span>
          <span className="pv-welcome-btn-text">
            <strong>Catálogo completo</strong>
            <small>Lectura Visual · las 31 cards reales</small>
          </span>
          <span className="material-symbols-outlined pv-welcome-go">chevron_right</span>
        </a>
      </div>
    </KoruTurn>
  );
}

// ── Fondo de video REAL de la app (estado "escuchando") ────────────────────
function BgVideo() {
  return (
    <div className="koru-bg-stack" aria-hidden="true">
      <video
        className="koru-bg-layer is-active"
        src="/koru-states/estado-trabajando.mp4"
        poster="/stitch/chat-bg.png"
        autoPlay
        muted
        loop
        playsInline
      />
    </div>
  );
}

// ── Phone = koru-chat-screen real, 100% fiel (shell + tokens de la app) ────
function Phone() {
  return (
    <div className="pv-stage-screen">
      <div className="koru-chat-shell" role="dialog" aria-label="Conversación con Koru">
        <div className="koru-chat-screen">
          <StatusBar />
          <BgVideo />
          <SuggestionBar />
          <ChatFeed />
          <ChatFooter />
        </div>
      </div>
    </div>
  );
}

// ── Stage mínimo: el teléfono ES la estrella. Links discretos abajo. ───────
function Stage() {
  return (
    <div className="pv-stage">
      <Phone />
      <nav className="pv-links" aria-label="Propuestas de interior">
        <a href="/propuesta-a.html" target="_blank" rel="noreferrer">A · Lectura Visual</a>
        <span className="pv-links-sep">·</span>
        <a href="/propuesta-b-full.html" target="_blank" rel="noreferrer">B · Koru te Cuenta (completa)</a>
      </nav>
    </div>
  );
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
try {
  localStorage.setItem("koru.onboarded", "true");
  localStorage.setItem("koru.username", "Arx");
  localStorage.setItem("koru.language", "es");
  localStorage.removeItem("koru.installDismissed");
} catch { /* noop */ }

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary>
    <KoruProvider>
      <Stage />
    </KoruProvider>
  </ErrorBoundary>,
);
