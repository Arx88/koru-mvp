import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { UiBlock } from "./domain/types";
import { KoruProvider } from "./ui/KoruProvider";
import { KoruUnifiedCard } from "./ui/cards/unified/KoruUnifiedCard";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { CHAT_CATALOG, CHAT_SCRIPT, type ChatEntry } from "./preview-data";
import "./style.css";
import "./koru-motion.css";
import "./preview.css";

// ============================================================================
// PREVIEW HARNESS v4 — Koru MVP
// Stage oscuro + phone frame 430px con el chat REAL de Koru (fondo, avatar,
// tipografía y cards reales del repo). El catálogo vive en preview-data.ts.
// ============================================================================

function StatusBar() {
  return (
    <div className="pv-statusbar">
      <span className="pv-statusbar-time">9:41</span>
      <div className="pv-statusbar-notch" />
      <div className="pv-statusbar-icons">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="white" opacity="0.9"><path d="M1 8.5c1.8-2 3.9-3 6-3s4.2 1 6 3l-1.4 1.4c-1.3-1.5-2.9-2.3-4.6-2.3s-3.3.8-4.6 2.3L1 8.5Z"/><path d="M4.9 5.2C6 4.4 7.2 4 8.5 4s2.5.4 3.6 1.2l1-1.6C11.7 2.6 10.2 2 8.5 2S5.3 2.6 3.9 3.6l1 1.6Z"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="white" opacity="0.9"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.3" y="4.5" width="3" height="6.5" rx="1"/><rect x="8.6" y="2" width="3" height="9" rx="1"/><rect x="12.9" y="0" width="3" height="11" rx="1" opacity="0.4"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" opacity="0.9"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="white" stroke-opacity="0.5"/><rect x="2" y="2" width="15" height="7.5" rx="1.8" fill="white"/><path d="M23 4v4c1-.3 1.5-1 1.5-2s-.5-1.7-1.5-2Z" fill="white" fill-opacity="0.6"/></svg>
      </div>
    </div>
  );
}

function ChatHeader({ filter, setFilter }: { filter: string; setFilter: (v: string) => void }) {
  return (
    <div className="pv-chat-header">
      <div className="pv-chat-header-row">
        <div className="pv-koru-avatar">
          <img src="/stitch/avatar-chat.png" alt="Koru" />
        </div>
        <div className="pv-chat-header-copy">
          <div className="pv-chat-header-name">Koru</div>
          <div className="pv-chat-header-status"><i className="pv-presence-dot" />acá, escuchándote</div>
        </div>
      </div>
      <div className="pv-filter-row">
        {CHAT_CATALOG.map((c) => (
          <button
            key={c.id}
            className={"pv-chip" + (filter === c.id ? " active" : "")}
            onClick={() => setFilter(c.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{c.icon}</span>
            {c.label}
            <b>{c.count}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return <div className="pv-user-bubble"><span>{text}</span></div>;
}

function KoruBubble({ children }: { children: ReactNode }) {
  return (
    <div className="pv-koru-bubble">
      <div className="pv-koru-bubble-avatar">
        <img src="/stitch/avatar-wink.png" alt="" />
      </div>
      <div className="pv-koru-bubble-body">{children}</div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="pv-koru-bubble">
      <div className="pv-koru-bubble-avatar"><img src="/stitch/avatar-chat.png" alt="" /></div>
      <div className="pv-koru-bubble-body">
        <div className="pv-typing"><span /><span /><span /></div>
      </div>
    </div>
  );
}

// ── Chat con auto-scroll y entrada progresiva ──────────────────────────────
function ChatFeed({ filter }: { filter: string }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const entries = useMemo<ChatEntry[]>(
    () => CHAT_SCRIPT.filter((e) => filter === "all" || e.tag === filter),
    [filter],
  );
  const [visible, setVisible] = useState(0);

  useEffect(() => setVisible(0), [filter]);

  useEffect(() => {
    if (visible >= entries.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), visible === 0 ? 150 : 420);
    return () => clearTimeout(t);
  }, [visible, entries.length]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [visible]);

  const showTyping = visible < entries.length;
  const rendered = entries.slice(0, visible);

  return (
    <div className="pv-feed" ref={feedRef}>
      {rendered.map((e, i) => {
        if (e.kind === "user") return <UserBubble key={i} text={e.text} />;
        if (e.kind === "text") {
          return (
            <KoruBubble key={i}>
              <p className="pv-koru-text">{e.text}</p>
            </KoruBubble>
          );
        }
        return (
          <KoruBubble key={i}>
            {e.intro && <p className="pv-koru-text">{e.intro}</p>}
            <KoruUnifiedCard block={e.block as UiBlock} />
          </KoruBubble>
        );
      })}
      {showTyping && <TypingIndicator />}
      <div className="pv-feed-spacer" />
    </div>
  );
}

function Composer() {
  return (
    <div className="pv-composer">
      <div className="pv-composer-input">
        <span className="material-symbols-outlined">mic</span>
        <input placeholder="Pedile algo a Koru…" readOnly />
        <span className="material-symbols-outlined">send</span>
      </div>
    </div>
  );
}

function Phone() {
  const [filter, setFilter] = useState("all");
  return (
    <div className="pv-phone">
      <StatusBar />
      <ChatHeader filter={filter} setFilter={setFilter} />
      <ChatFeed filter={filter} />
      <Composer />
    </div>
  );
}

// ── Stage ───────────────────────────────────────────────────────────────────
function Stage() {
  return (
    <div className="pv-stage">
      <header className="pv-stage-header">
        <div className="pv-stage-title">
          <img src="/favicon.svg" alt="" className="pv-stage-logo" />
          <div>
            <h1>Koru · Preview de Cards</h1>
            <p>v4 — sistema real de cards · fondo, avatar y tipografías reales del repo</p>
          </div>
        </div>
        <div className="pv-stage-badges">
          <span className="pv-badge">{CHAT_SCRIPT.filter((e) => e.kind === "card").length} cards</span>
          <span className="pv-badge">{CHAT_CATALOG.length} categorías</span>
        </div>
      </header>
      <Phone />
      <footer className="pv-stage-footer">
        Tocá cualquier card para abrir su <b>Informe Extenso</b> — el detail screen real de la app.
      </footer>
    </div>
  );
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
// Estado limpio para el provider real (sin chat viejo persistido).
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
