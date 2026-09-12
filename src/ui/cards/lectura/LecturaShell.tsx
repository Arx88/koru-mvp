/**
 * LecturaShell — marco fullscreen compartido de los interiores Lectura Visual.
 *
 * Port del chrome del catálogo: overlay lavanda con blobs, readbar de
 * progreso, topnav (volver · chip de dominio · guardar), scroller con
 * reveal (.rv → .in vía IntersectionObserver, fallback visible sin IO)
 * y cierre con Escape. Cada interior aporta su .lcr-panel como children.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Bookmark } from "lucide-react";
import { Ic } from "./Ic";
import "./lectura.css";
import "./michi-details.css";

export interface LecturaChip {
  label: string;
  background?: string;
  color?: string;
}

export function LecturaShell({
  children,
  variant,
  onClose,
  onBookmark,
  chip,
  ariaLabel = "Detalle de Michi",
}: {
  children: ReactNode;
  variant?: "news" | "football" | "tennis";
  onClose: () => void;
  onBookmark?: () => void;
  chip?: LecturaChip;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = root.querySelector<HTMLElement>(".lcr-screen");
    if (!scroller) return;

    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      setProgress(max > 8 ? Math.min(100, (scroller.scrollTop / max) * 100) : 0);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add("in");
          });
        },
        { root: scroller, threshold: 0.08 },
      );
      root.querySelectorAll(".rv").forEach((el) => io?.observe(el));
    } else {
      // sin IO (tests) todo visible de entrada
      root.querySelectorAll(".rv").forEach((el) => el.classList.add("in"));
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    if (variant) root.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopImmediatePropagation(); event.preventDefault(); onClose(); }
      if (variant && event.key === "Tab") {
        const focusable = [...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')].filter(el => !el.hidden);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey, true);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      io?.disconnect();
      window.removeEventListener("keydown", onKey, true);
      if (variant && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose, variant]);

  return createPortal(
    <div className={`lcr ${variant ? `michi-detail md-${variant}` : ""}`} role="dialog" aria-modal="true" aria-label={ariaLabel} ref={rootRef}>
      <div className="readbar" style={{ width: `${progress}%` }} aria-hidden="true" />
      <div className="lcr-screen">
        <div className="topnav">
          <button type="button" className="fab" aria-label="Volver" onClick={onClose}>
            <Ic i={ArrowLeft} className="ic" />
          </button>
          <span
            className="kchip"
            style={
              chip?.background
                ? { background: chip.background, color: chip.color ?? "#fff" }
                : undefined
            }
          >
            {chip?.label ?? "Michi"}
          </span>
          {onBookmark ? (
            <button type="button" className="fab" aria-label="Guardar" onClick={onBookmark}>
              <Ic i={Bookmark} className="ic" />
            </button>
          ) : (
            <span className="fab-spacer" aria-hidden="true" />
          )}
        </div>
        {variant && variant !== "news" && <div className="md-sport-hero"><img src={`/assets/art-${variant === "tennis" ? "08" : "06"}.webp`} alt="" /><span>Michi en la cancha</span></div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
