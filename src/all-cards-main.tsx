/**
 * all-cards-main — TODAS las cards de la app + TODOS sus extensibles en un
 * solo lugar navegable. Dos vistas, cada una 100% la de la app:
 *
 *   · Chat        → Stage de preview-main: réplica fiel del chat real con
 *                   los 55 tipos de UiBlock. Al tocar cualquier card se abre
 *                   su extensible REAL (KoruDetailScreen → interior Lectura
 *                   Visual registrado, o CollectionsScreen para guardados).
 *   · Interiores  → Gallery de lectura-gallery-main: los 40+ interiores
 *                   integrados del catálogo, cada uno con sus fixtures del
 *                   dominio. Tocar abre el interior fullscreen.
 *
 * El archivo se genera autocontenido (scripts/build-all-cards-html.mjs):
 * JS + CSS inlineados y los assets (/stitch, /koru-states) apuntando al
 * deploy live. Por eso los links del harness original (/preview.html,
 * /lectura.html) se interceptan y traducen a cambio de vista: en un
 * archivo único no existen esas rutas.
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MessagesSquare, LayoutGrid } from "lucide-react";
import { KoruProvider } from "./ui/KoruProvider";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Stage } from "./preview-main";
import { Gallery, CARDS } from "./lectura-gallery-main";
import { CHAT_SCRIPT } from "./preview-data";
import "./style.css";
import "./koru-motion.css";
import "./preview.css";
import "./lectura-gallery.css";
import "./all-cards.css";

type Mode = "chat" | "gallery";

const CARD_COUNT = CHAT_SCRIPT.filter((e) => e.kind === "card").length;
const INTERIOR_COUNT = CARDS.length;

const LIVE_CATALOG = "https://koru-mvp.onrender.com/lectura-visual.html";

function readInitialMode(): Mode {
  try {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash === "galeria" || hash === "gallery" || hash === "interiores") return "gallery";
    if (localStorage.getItem("koru.allcards.mode") === "gallery") return "gallery";
  } catch {
    /* file:// o storage bloqueado — default chat */
  }
  return "chat";
}

export function AllCardsPage() {
  const [mode, setMode] = useState<Mode>(readInitialMode);

  // Fondo correcto por vista (noche de la app para el chat, lavanda del
  // catálogo para la galería) + hash navegable + memoria de la última vista.
  useEffect(() => {
    const cl = document.body.classList;
    cl.remove("ac-mode--chat", "ac-mode--gallery");
    cl.add(mode === "chat" ? "ac-mode--chat" : "ac-mode--gallery");
    try {
      localStorage.setItem("koru.allcards.mode", mode);
      window.history.replaceState(null, "", mode === "chat" ? "#/chat" : "#/galeria");
    } catch {
      /* noop */
    }
  }, [mode]);

  // Links del harness original → vistas del archivo único. El catálogo de
  // diseño (lectura-visual.html) no vive en este bundle: abre el live.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href === "/preview.html" || href === "/lectura.html" || href === "/lectura-visual.html") {
        e.preventDefault();
        if (href === "/preview.html") setMode("chat");
        else if (href === "/lectura.html") setMode("gallery");
        else window.open(LIVE_CATALOG, "_blank", "noopener,noreferrer");
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className={`ac-app ac-view--${mode}`}>
      <header className="ac-bar">
        <img className="ac-logo" src="/stitch/avatar-wink.png" alt="Koru" width={30} height={30} />
        <div className="ac-title">
          <strong>Todas las cards de tu app</strong>
          <small>
            {CARD_COUNT} cards en el chat · {INTERIOR_COUNT} interiores extensibles · tocá cualquier card
          </small>
        </div>
        <div className="ac-switch" role="tablist" aria-label="Vistas del archivo">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "chat"}
            className={mode === "chat" ? "is-active" : ""}
            onClick={() => setMode("chat")}
          >
            <MessagesSquare size={14} aria-hidden="true" />
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "gallery"}
            className={mode === "gallery" ? "is-active" : ""}
            onClick={() => setMode("gallery")}
          >
            <LayoutGrid size={14} aria-hidden="true" />
            Interiores
          </button>
        </div>
      </header>
      {mode === "chat" ? <Stage /> : <Gallery showFooter={false} />}
    </div>
  );
}

// Bootstrap: monta solo con #root (los tests renderizan <AllCardsPage/> directo).
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <KoruProvider>
        <AllCardsPage />
      </KoruProvider>
    </ErrorBoundary>,
  );
}
