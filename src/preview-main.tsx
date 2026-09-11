import { useCallback, useEffect, useMemo, useRef, useState, memo, type ReactNode } from "react";
import { migrateLocalStorageNamespace } from "./domain/namespaceMigration";
import { createRoot } from "react-dom/client";
import { Leaf, Plus, Paperclip, Mic, Search, X, Play, Pause, FastForward } from "lucide-react";
import type { UiBlock } from "./domain/types";
import { KoruProvider } from "./ui/KoruProvider";
import { KoruUnifiedCard } from "./ui/cards/unified/KoruUnifiedCard";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { CHAT_SCRIPT, CHAT_CATALOG, entriesForTag, searchScript, type ChatEntry } from "./preview-data";
import "./style.css";
import "./michi-cards.css";
import "./koru-motion.css";
import "./preview.css";

// ============================================================================
// PREVIEW v6 — RÉPLICA FIEL DEL CHAT REAL DE KORU (TalkOverlay) + showcase
// FUNCIONAL del sistema completo de cards.
//
// Mismos tokens, mismo layout, mismas burbujas y mismo fondo de video que la
// app en producción. El showcase ahora es navegable y verificable:
//   · Chips de categoría (catálogo DERIVADO del script, contadores reales)
//   · Búsqueda en la conversación (acentos insensibles, busca dentro de blocks)
//   · Controles de reproducción: pausa, velocidad, "mostrar todo", progreso
//   · Auto-scroll inteligente: solo sigue el hilo si estás cerca del final
//   · Reloj real en la status bar
// El script cubre los 55 tipos renderizables de UiBlock (ver preview-data.ts).
// ============================================================================

const KORU_AVATAR = "/stitch/michi-avatar.png";

// ── Utilidades ─────────────────────────────────────────────────────────────
const SPEEDS: Array<{ label: string; ms: number }> = [
  { label: "1×", ms: 520 },
  { label: "2×", ms: 260 },
  { label: "4×", ms: 130 },
];

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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
          <img src={KORU_AVATAR} alt="Michi" />
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
          <img src={KORU_AVATAR} alt="Michi" />
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

/** Entry del script memoizado: los objetos del script son estables (módulo),
 *  así los increments de `visible` no re-renderizan entries ya montados. */
const ScriptEntry = memo(function ScriptEntry({ e }: { e: ChatEntry }) {
  if (e.kind === "user") return <UserTurn text={e.text} />;
  if (e.kind === "text") {
    return (
      <KoruTurn>
        <p className="koru-message-text">{e.text}</p>
      </KoruTurn>
    );
  }
  return (
    <KoruTurn>
      {e.intro && <p className="koru-message-text" style={{ marginBottom: 10 }}>{e.intro}</p>}
      <KoruUnifiedCard block={e.block as UiBlock} />
    </KoruTurn>
  );
});

// ── Feed del chat: reveal progresivo + filtro + búsqueda ───────────────────
// El timer de auto-advance vive en Phone (dueño del estado `visible`); este
// componente es presentacional + scroll inteligente.
function ChatFeed({
  entries,
  visible,
  browseMode,
  paused,
}: {
  entries: ChatEntry[];
  visible: number;
  browseMode: boolean;
  paused: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Auto-scroll inteligente: seguimos el hilo SOLO si el usuario está cerca
  // del final; si está leyendo más arriba, no le robamos el scroll.
  useEffect(() => {
    const el = feedRef.current;
    if (!el || !stickToBottom.current) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    } else {
      // Fallback: entornos sin scrollTo (jsdom, navegadores viejos)
      el.scrollTop = el.scrollHeight;
    }
  }, [visible, entries]);

  const onScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);

  const shown = browseMode ? entries : entries.slice(0, visible);
  const showTyping = !browseMode && !paused && visible < entries.length;

  return (
    <main
      ref={feedRef}
      className="koru-chat-scroll"
      onScroll={onScroll}
      role="log"
      aria-label="Conversación con Michi"
    >
      <div className="koru-thread">
        <WelcomeTurn />
        {shown.map((e, i) => (
          <ScriptEntry key={i} e={e} />
        ))}
        {showTyping && <TypingBubble />}
        {browseMode && entries.length === 0 && (
          <KoruTurn>
            <p className="koru-message-text">
              Nada por acá con ese filtro. Probá con «clima», «boca», «dólar» o tocá «Todo».
            </p>
          </KoruTurn>
        )}
      </div>
    </main>
  );
}

// ── TopBar: chips de categoría + controles de reproducción ──────────────────
function TopBar({
  activeTag,
  onTag,
  total,
  visible,
  paused,
  onTogglePause,
  speedIdx,
  onCycleSpeed,
  onRevealAll,
  browseMode,
}: {
  activeTag: string;
  onTag: (id: string) => void;
  total: number;
  visible: number;
  paused: boolean;
  onTogglePause: () => void;
  speedIdx: number;
  onCycleSpeed: () => void;
  onRevealAll: () => void;
  browseMode: boolean;
}) {
  return (
    <div className="pv-topbar">
      <div className="pv-chips" role="tablist" aria-label="Categorías del showcase">
        {CHAT_CATALOG.map((c) => {
          const active = c.id === activeTag;
          return (
            <button
              key={c.id}
              type="button"
              className={`pv-chip${active ? " is-active" : ""}`}
              aria-pressed={active}
              role="tab"
              aria-selected={active}
              onClick={() => onTag(c.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{c.icon}</span>
              {c.label}
              <span className="pv-chip-count">{c.count}</span>
            </button>
          );
        })}
      </div>
      <div className="pv-ctrl">
        <button
          type="button"
          className="pv-ctrl-btn"
          onClick={onTogglePause}
          aria-label={paused ? "Reanudar avance" : "Pausar avance"}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          type="button"
          className="pv-ctrl-btn"
          onClick={onCycleSpeed}
          aria-label={`Velocidad de avance (${SPEEDS[speedIdx].label})`}
        >
          <FastForward size={14} />
          <span>{SPEEDS[speedIdx].label}</span>
        </button>
        {!browseMode && (
          <button type="button" className="pv-ctrl-btn" onClick={onRevealAll}>
            Mostrar todo
          </button>
        )}
        <span className="pv-ctrl-progress" aria-live="polite">
          {browseMode ? `${total} en pantalla` : `${visible} / ${total}`}
        </span>
      </div>
    </div>
  );
}

// ── Footer: quick actions funcionales + búsqueda en la conversación ─────────
function ChatFooter({ onQuickAsk, query, onQuery }: { onQuickAsk: (tag: string) => void; query: string; onQuery: (q: string) => void }) {
  return (
    <footer className="koru-chat-footer">
      <div className="koru-quick-actions">
        <button type="button" className="koru-quick-action" onClick={() => onQuickAsk("dia")}>
          <span className="material-symbols-outlined">today</span>
          Mi día
        </button>
        <button type="button" className="koru-quick-action" onClick={() => onQuickAsk("deportes")}>
          <span className="material-symbols-outlined">sports_soccer</span>
          ¿Cómo va el clásico?
        </button>
        <button type="button" className="koru-quick-action" onClick={() => onQuickAsk("dinero")}>
          <span className="material-symbols-outlined">wallet</span>
          ¿A cuánto el dólar?
        </button>
        <button type="button" className="koru-quick-action" onClick={() => onQuickAsk("memoria")}>
          <span className="material-symbols-outlined">psychology</span>
          ¿Qué me guardaste?
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
          <span className="pv-search-ic" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            placeholder="Buscar en la conversación…"
            className="koru-composer-input"
            value={query}
            onChange={(ev) => onQuery(ev.target.value)}
            aria-label="Buscar en la conversación"
            type="search"
          />
          {query && (
            <button type="button" className="pv-clear" onClick={() => onQuery("")} aria-label="Limpiar búsqueda">
              <X size={15} />
            </button>
          )}
        </div>
        <button type="button" aria-label="Hablar" className="koru-mic-button">
          <Mic size={22} />
        </button>
      </div>
    </footer>
  );
}

// ── Burbuja de bienvenida: acceso al showcase completo ──────────────────────
function WelcomeTurn() {
  return (
    <KoruTurn>
      <p className="koru-message-text">
        ¡Hola Arx! Bienvenido al showcase del sistema completo: una conversación
        con los <strong>55 tipos de card</strong> que Michi sabe renderizar.
        Deslizá para verlas llegar, filtrá por categoría arriba o buscá
        («clima», «boca», «dólar»…) y tocá cualquier card para abrir su interior.
      </p>
      <div className="pv-welcome-actions">
        <a className="pv-welcome-btn" href="/lectura.html">
          <span className="material-symbols-outlined">style</span>
          <span className="pv-welcome-btn-text">
            <strong>Galería de interiores</strong>
            <small>Las 40 cards integradas, una por una</small>
          </span>
          <span className="material-symbols-outlined pv-welcome-go">chevron_right</span>
        </a>
        <a className="pv-welcome-btn" href="/lectura-visual.html">
          <span className="material-symbols-outlined">auto_awesome</span>
          <span className="pv-welcome-btn-text">
            <strong>Catálogo de diseño</strong>
            <small>La especificación visual de referencia</small>
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

// ── Status bar con reloj real ───────────────────────────────────────────────
function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const hhmm = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="pv-statusbar">
      <span className="pv-statusbar-time">{hhmm}</span>
      <div className="pv-statusbar-notch" />
      <div className="pv-statusbar-icons">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="white" opacity="0.9"><path d="M1 8.5c1.8-2 3.9-3 6-3s4.2 1 6 3l-1.4 1.4c-1.3-1.5-2.9-2.3-4.6-2.3s-3.3.8-4.6 2.3L1 8.5Z"/><path d="M4.9 5.2C6 4.4 7.2 4 8.5 4s2.5.4 3.6 1.2l1-1.6C11.7 2.6 10.2 2 8.5 2S5.3 2.6 3.9 3.6l1 1.6Z"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="white" opacity="0.9"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.3" y="4.5" width="3" height="6.5" rx="1"/><rect x="8.6" y="2" width="3" height="9" rx="1"/><rect x="12.9" y="0" width="3" height="11" rx="1" opacity="0.4"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" opacity="0.9"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="white" strokeOpacity="0.5"/><rect x="2" y="2" width="15" height="7.5" rx="1.8" fill="white"/><path d="M23 4v4c1-.3 1.5-1 1.5-2s-.5-1.7-1.5-2Z" fill="white" fillOpacity="0.6"/></svg>
      </div>
    </div>
  );
}

// ── Phone = koru-chat-screen real + topbar del showcase ─────────────────────
function Phone() {
  const [activeTag, setActiveTag] = useState("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);

  const browseMode = activeTag !== "all" || query.trim() !== "";

  const entries = useMemo(
    () => searchScript(entriesForTag(CHAT_SCRIPT, activeTag), query),
    [activeTag, query],
  );

  const speedMs = SPEEDS[speedIdx].ms;

  // Auto-advance SOLO en modo showcase (sin filtro ni búsqueda) y sin pausa.
  useEffect(() => {
    if (browseMode || paused || visible >= entries.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), visible === 0 ? 400 : speedMs);
    return () => clearTimeout(t);
  }, [visible, entries.length, browseMode, paused, speedMs]);

  const revealAll = useCallback(() => setVisible(CHAT_SCRIPT.length), []);
  const onTag = useCallback((id: string) => { setActiveTag(id); }, []);
  const quickAsk = useCallback((tag: string) => {
    setActiveTag(tag);
    setQuery("");
  }, []);

  return (
    <div className="pv-stage-screen">
      <div className="koru-chat-shell" role="dialog" aria-label="Conversación con Michi">
        <div className="koru-chat-screen">
          <StatusBar />
          <BgVideo />
          <TopBar
            activeTag={activeTag}
            onTag={onTag}
            total={entries.length}
            visible={visible}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            speedIdx={speedIdx}
            onCycleSpeed={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
            onRevealAll={revealAll}
            browseMode={browseMode}
          />
          <ChatFeed
            entries={entries}
            visible={visible}
            browseMode={browseMode}
            paused={paused}
          />
          <ChatFooter onQuickAsk={quickAsk} query={query} onQuery={setQuery} />
        </div>
      </div>
    </div>
  );
}

// ── Stage mínimo: el teléfono ES la estrella. Links discretos abajo. ───────
export function Stage() {
  return (
    <div className="pv-stage">
      <Phone />
      <nav className="pv-links" aria-label="Vistas del showcase">
        <a href="/lectura.html" target="_blank" rel="noreferrer">Galería de interiores</a>
        <span className="pv-links-sep">·</span>
        <a href="/lectura-visual.html" target="_blank" rel="noreferrer">Catálogo de diseño</a>
      </nav>
    </div>
  );
}

// ── Bootstrap (monta solo si hay #root: los tests renderizan <Stage/> directo) ─
try {
  localStorage.setItem("michi.onboarded", "true");
  localStorage.setItem("michi.username", "Arx");
  localStorage.setItem("michi.language", "es");
  localStorage.removeItem("michi.installDismissed");
} catch { /* noop */ }

const rootEl = document.getElementById("root");
if (rootEl) {
// 🐱 Migración de namespace koru.* → michi.* (localStorage compartido con la app).
migrateLocalStorageNamespace();
  const root = createRoot(rootEl);
  root.render(
    <ErrorBoundary>
      <KoruProvider>
        <Stage />
      </KoruProvider>
    </ErrorBoundary>,
  );
}
