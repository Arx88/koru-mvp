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

export interface LecturaChip {
  label: string;
  background?: string;
  color?: string;
}

export function LecturaShell({
  children,
  onClose,
  onBookmark,
  chip,
  ariaLabel = "Detalle de Koru",
}: {
  children: ReactNode;
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

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      io?.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="lcr" role="dialog" aria-modal="true" aria-label={ariaLabel} ref={rootRef}>
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
            {chip?.label ?? "Koru"}
          </span>
          {onBookmark ? (
            <button type="button" className="fab" aria-label="Guardar" onClick={onBookmark}>
              <Ic i={Bookmark} className="ic" />
            </button>
          ) : (
            <span className="fab-spacer" aria-hidden="true" />
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
