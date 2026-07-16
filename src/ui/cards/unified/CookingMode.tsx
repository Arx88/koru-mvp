import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ═══════════════════════════════════════════════════════════════════════════
//  CookingMode — overlay full-screen que guía al usuario paso a paso por una
//  receta. z-index 300, fondo lila gradient, tipografía Bricolage Grotesque
//  para el número de paso (48px), timer con auto-advance, haptic feedback en
//  cada avance y dispatch de `koru-card-action` con action "cooking_progress"
//  al cerrar (para futura persistencia del progreso).
//
//  Las steps vienen del UiBlock `recipe` (block.steps: Array<{step, text}>).
//  Opcionalmente pueden traer `timerSec` si el dominio se extiende; cuando
//  existe, se muestra un countdown que auto-avanza al llegar a 0.
// ═══════════════════════════════════════════════════════════════════════════

export type CookingStep = {
  step: number;
  text: string;
  /** Segundos opcionales para un timer en este paso. */
  timerSec?: number;
};

type StepStatus = "pending" | "current" | "done";

export interface CookingModeProps {
  /** Título de la receta (para el header del overlay). */
  title: string;
  /** Pasos a recorrer. */
  steps: CookingStep[];
  /** El UiBlock original (recipe) — se incluye en el CustomEvent de progreso. */
  block?: unknown;
  /** Cierra el overlay (lo desmonta del caller). */
  onClose: () => void;
}

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* noop */
    }
  }
}

export function CookingMode({ title, steps, block, onClose }: CookingModeProps) {
  const total = steps.length;

  // El paso actual (índice 0-based). Arranca en 0 salvo que no haya steps.
  const [current, setCurrent] = useState(0);
  // Estado por paso: "pending" | "current" | "done".
  const [statuses, setStatuses] = useState<StepStatus[]>(() =>
    steps.map((_, i) => (i === 0 ? "current" : "pending")),
  );
  // Timer
  const [remaining, setRemaining] = useState<number>(steps[0]?.timerSec ?? 0);
  const [paused, setPaused] = useState(false);
  // Confirmación de salida
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Ref al timer para limpiarlo en unmount / cambio de paso.
  const intervalRef = useRef<number | null>(null);

  const currentStep = steps[current];
  const hasTimer = typeof currentStep?.timerSec === "number" && (currentStep?.timerSec ?? 0) > 0;

  // Avanza al siguiente paso. Marca el actual como done y, si hay siguiente,
  // lo marca como current. Si es el último, emite el evento de progreso y
  // llama onClose.
  const advance = useCallback(() => {
    setCurrent((prev) => {
      const nextIdx = prev + 1;
      setStatuses((prevStatuses) => {
        const copy = [...prevStatuses];
        copy[prev] = "done";
        if (nextIdx < total) copy[nextIdx] = "current";
        return copy;
      });
      if (nextIdx >= total) {
        // Llegamos al final: dispatch + close.
        const finalStatuses = statuses.slice();
        finalStatuses[prev] = "done";
        window.dispatchEvent(
          new CustomEvent("koru-card-action", {
            detail: {
              action: "cooking_progress",
              title,
              blockType: "recipe",
              blockData: block,
              stepStates: finalStatuses,
              currentStep: prev,
              completed: true,
            },
          }),
        );
        vibrate(15);
        // Cerrar en el próximo tick para que el dispatch se procese primero.
        setTimeout(() => onClose(), 0);
        return prev;
      }
      // Reset timer para el nuevo paso.
      setRemaining(steps[nextIdx]?.timerSec ?? 0);
      setPaused(false);
      vibrate(15);
      return nextIdx;
    });
  }, [total, steps, statuses, title, block, onClose]);

  // Retrocede al paso anterior. No cambia los statuses ya hechos (siguen
  // "done") — sólo mueve `current` y resetea el timer.
  const goBack = useCallback(() => {
    setCurrent((prev) => {
      if (prev <= 0) return prev;
      const newIdx = prev - 1;
      setRemaining(steps[newIdx]?.timerSec ?? 0);
      setPaused(false);
      vibrate(15);
      return newIdx;
    });
  }, [steps]);

  // Timer tick: cada 1s decrementa `remaining`. Al llegar a 0, auto-advance.
  useEffect(() => {
    if (!hasTimer || paused) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Auto-advance cuando llega a 0.
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Defer advance para evitar setState-during-render.
          setTimeout(() => advance(), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasTimer, paused, current, advance]);

  // ESC abre confirmación de salida (no cierra directo).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Progreso para la barra (0..1).
  const progress = useMemo(() => {
    if (total <= 1) return 1;
    return (current + 1) / total;
  }, [current, total]);

  // Confirmación de salida: dispara el evento cooking_progress con el estado
  // parcial y luego onClose.
  const handleClose = useCallback(() => {
    const partial = statuses.slice();
    // marca el actual como "current" (no done) salvo que sea el último.
    window.dispatchEvent(
      new CustomEvent("koru-card-action", {
        detail: {
          action: "cooking_progress",
          title,
          blockType: "recipe",
          blockData: block,
          stepStates: partial,
          currentStep: current,
          completed: current >= total - 1 && partial[current] === "done",
        },
      }),
    );
    onClose();
  }, [statuses, current, total, title, block, onClose]);

  if (total === 0) {
    // Sin pasos — cerrar de inmediato (no debería ocurrir, defensive).
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Modo cocina — ${title}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "linear-gradient(180deg, #f0dbff 0%, #f8f9ff 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        color: "#1a1a2e",
      }}
    >
      {/* ── Header: close X + título compacto ───────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 18px",
          paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="Salir del modo cocina"
          onClick={() => setConfirmOpen(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "1px solid rgba(131, 99, 249, 0.18)",
            background: "rgba(255, 255, 255, 0.7)",
            color: "#4648d4",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#8363f9", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Modo cocina
          </p>
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "#1a1a2e",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {title}
          </h2>
        </div>
      </header>

      {/* ── Progress bar (step N of total) ─────────────────────────────── */}
      <div style={{ padding: "0 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5f8c" }}>
            Paso {current + 1} de {total}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4648d4" }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div
          aria-hidden
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(131, 99, 249, 0.15)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #8363f9, #4648d4)",
              borderRadius: 999,
              transition: "width 320ms ease",
            }}
          />
        </div>
      </div>

      {/* ── Cuerpo: número de paso grande + texto ──────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
          }}
        >
          <span
            aria-hidden
            style={{
              fontFamily: '"Bricolage Grotesque", Georgia, serif',
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1,
              color: "#4648d4",
              letterSpacing: -1,
            }}
          >
            {String(current + 1).padStart(2, "0")}
          </span>
          <span
            aria-hidden
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#8363f9",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Paso
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            lineHeight: 1.45,
            color: "#1a1a2e",
          }}
        >
          {currentStep?.text}
        </p>

        {/* Timer (si el paso trae timerSec) */}
        {hasTimer && (
          <div
            style={{
              marginTop: 6,
              padding: "18px 20px",
              borderRadius: 20,
              background: "rgba(255, 255, 255, 0.7)",
              border: "1px solid rgba(131, 99, 249, 0.18)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8363f9", letterSpacing: 0.6, textTransform: "uppercase" }}>
              {paused ? "Pausado" : "En curso"}
            </span>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", Georgia, serif',
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1,
                color: remaining <= 5 && !paused ? "#e8593c" : "#4648d4",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(remaining)}
            </span>
            <button
              type="button"
              onClick={() => {
                setPaused((p) => !p);
                vibrate(10);
              }}
              style={{
                marginTop: 2,
                background: paused ? "#4648d4" : "rgba(70, 72, 212, 0.12)",
                color: paused ? "#fff" : "#4648d4",
                border: "none",
                borderRadius: 999,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {paused ? "play_arrow" : "pause"}
              </span>
              {paused ? "Reanudar" : "Pausar"}
            </button>
          </div>
        )}

        {/* Pasos completados (mini-summary) */}
        {current > 0 && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: 14,
              borderTop: "1px solid rgba(131, 99, 249, 0.14)",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {steps.map((s, i) => (
              <span
                key={i}
                title={`Paso ${s.step}`}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background:
                    statuses[i] === "done"
                      ? "#22a06b"
                      : i === current
                        ? "#4648d4"
                        : "rgba(131, 99, 249, 0.2)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer: Anterior / Siguiente ───────────────────────────────── */}
      <footer
        style={{
          padding: "14px 18px",
          paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          gap: 10,
          flexShrink: 0,
          background: "rgba(255, 255, 255, 0.6)",
          borderTop: "1px solid rgba(131, 99, 249, 0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={current === 0}
          style={{
            flex: 1,
            padding: "14px 12px",
            borderRadius: 14,
            border: "1px solid rgba(70, 72, 212, 0.18)",
            background: "rgba(255, 255, 255, 0.8)",
            color: "#4648d4",
            fontSize: 14,
            fontWeight: 700,
            cursor: current === 0 ? "not-allowed" : "pointer",
            opacity: current === 0 ? 0.5 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Anterior
        </button>
        <button
          type="button"
          onClick={advance}
          style={{
            flex: 1.4,
            padding: "14px 12px",
            borderRadius: 14,
            border: "none",
            background: "linear-gradient(135deg, #8363f9, #4648d4)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(131, 99, 249, 0.32)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {current >= total - 1 ? "Terminar" : "Siguiente"}
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {current >= total - 1 ? "check" : "arrow_forward"}
          </span>
        </button>
      </footer>

      {/* ── Confirmación de salida ─────────────────────────────────────── */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="¿Salir del modo cocina?"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(20, 16, 40, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 22,
            zIndex: 310,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 340,
              background: "#fff",
              borderRadius: 22,
              padding: 22,
              boxShadow: "0 24px 60px rgba(40, 20, 80, 0.3)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: "rgba(232, 89, 60, 0.12)",
                color: "#e8593c",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>logout</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1a2e" }}>
              ¿Salir del modo cocina?
            </h3>
            <p style={{ margin: "8px 0 18px", fontSize: 13, color: "#6b5f8c", lineHeight: 1.45 }}>
              Guardaremos tu progreso hasta el paso {current + 1} de {total} para que puedas retomarlo después.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(107, 95, 140, 0.22)",
                  background: "transparent",
                  color: "#6b5f8c",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Seguir cocinando
              </button>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#e8593c",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export default CookingMode;
