import { useMichiProgress } from "./useMichiProgress";
/** Cabecera compartida, paisaje y progreso de la aventura de Michi. */

import { useEffect, useRef, useState } from "react";
import {
  Menu, Star, Sparkle, MessageCircle, PawPrint, Palette, ChevronRight,
  Signal, Wifi, BatteryFull, Home, Brain, History, Settings,
} from "lucide-react";
import { MichiCat } from "./v8Shared";

export type MichiMenuAction =
  | "progress" | "landscape" | "avatares" | "hoy" | "memoria" | "historial" | "configuracion";

function useClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
  );
  useEffect(() => {
    const id = window.setInterval(
      () => setTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })),
      15_000,
    );
    return () => window.clearInterval(id);
  }, []);
  return time;
}

/* Su widget .level — pill violeta + XP + caption */
export function MichiLevel({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
  const { level, inLevel } = useMichiProgress();
  return (
    <button
      type="button"
      className={`mx-level ${compact ? "mx-level-compact" : ""}`}
      onClick={onClick}
      aria-label="Ver mi progreso"
    >
      <span className="mx-lvl-label">
        <Star fill="#ffe24b" className="mx-gold-star" size={18} />
        <span>Nivel {level}</span>
        {compact && <ChevronRight size={21} />}
      </span>
      <span className="mx-xp-track">
        <span style={{ width: `${inLevel}%` }} />
      </span>
      {!compact && <span className="mx-xp-cap">{inLevel} / 100 XP</span>}
    </button>
  );
}

export function MichiHeaderV8({ onMenuAction, onAvatares }: {
  onMenuAction: (action: MichiMenuAction) => void;
  onAvatares: () => void;
}) {
  const time = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const go = (action: MichiMenuAction) => {
    setMenuOpen(false);
    onMenuAction(action);
  };

  return (
    <header className="mx-header">
      <div className="mx-statusbar" aria-hidden="true">
        <span className="mx-statusbar-time">{time}</span>
        <span className="mx-statusbar-icons">
          <Signal size={19} fill="white" />
          <Wifi size={18} />
          <BatteryFull size={25} />
        </span>
      </div>
      <div className="mx-headermain">
        <button type="button" className="mx-brandav" aria-label="Ver colección de avatares" onClick={onAvatares} style={{ border: 0, background: "none", padding: 0 }}>
          <MichiCat />
          <span className="mx-dot-on" />
        </button>
        <div className="mx-brand">
          <h1>
            Michi
            <Sparkle fill="white" />
          </h1>
          <span>
            Siempre aquí para ti <Sparkle fill="white" size={13} />
          </span>
        </div>
        <MichiLevel onClick={() => go("progress")} />
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            className="mx-menubtn"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu />
          </button>
          {menuOpen && (
            <>
              <div className="mx-menu" role="menu">
                <div className="mx-menu-greeting">
                  Tu pequeño mundo <Sparkle size={17} fill="#ffe24b" />
                </div>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => { setMenuOpen(false); }}>
                  <MessageCircle /> Conversar con Michi <span className="mx-menu-activedot" />
                </button>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => { setMenuOpen(false); onAvatares(); }}>
                  <PawPrint /> Mis avatares <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => go("progress")}>
                  <Star /> Mi progreso <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => go("landscape")}>
                  <Palette /> Cambiar paisaje <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
                <div className="mx-menu-sep" />
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => go("hoy")}>
                  <Home /> Hoy <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => go("memoria")}>
                  <Brain /> Memoria <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => go("historial")}>
                  <History /> Historial <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
                <button type="button" role="menuitem" className="mx-menu-item" onClick={() => go("configuracion")}>
                  <Settings /> Ajustes <ChevronRight size={16} className="mx-menu-endicon" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
