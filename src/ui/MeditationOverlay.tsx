import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ═══════════════════════════════════════════════════════════════════════════
//  MeditationOverlay — overlay full-screen (z-index 300) que guía una sesión
//  de respiración / meditación. Fondo lavender suave con aurora blobs, círculo
//  que respira (4s inhale / 4s exhale) usando `koru-breathe` ampliado, timer
//  countdown (default 5 min) y haptic pulse en cada ciclo de respiración.
//
//  Al terminar (timer llega a 0 o el usuario toca "Terminar"), dispatcha
//  `koru-card-action` con action "meditation_complete" y la duración efectiva
//  en segundos (para futura persistencia en wellbeing logs).
// ═══════════════════════════════════════════════════════════════════════════

export interface MeditationSession {
  /** Etiqueta legible (ej: "Respiración 4-7-8"). */
  label: string;
  /** Duración en segundos. Default 300 (5 min). */
  durationSec?: number;
  /** Ícono Material Symbols opcional. */
  icon?: string;
  /** Subtítulo/descripción opcional. */
  description?: string;
}

export interface MeditationOverlayProps {
  session: MeditationSession;
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

export function MeditationOverlay({ session, onClose }: MeditationOverlayProps) {
  const totalSec = session.durationSec ?? 300;
  const [remaining, setRemaining] = useState<number>(totalSec);
  // Cuenta de ciclos de respiración completados (cada 8s = 1 ciclo 4-4).
  const [cycles, setCycles] = useState(0);
  // Fase actual: "inhale" | "exhale" (4s cada una).
  const [phase, setPhase] = useState<"inhale" | "exhale">("inhale");
  // Pausado.
  const [paused, setPaused] = useState(false);
  // Confirmación de terminación anticipada.
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Refs para intervalos / timeouts (limpieza en unmount).
  const timerRef = useRef<number | null>(null);
  const breathRef = useRef<number | null>(null);

  // Duración efectiva (segundos transcurridos) — se computa al cierre.
  const elapsed = totalSec - remaining;

  // ── Dispatch helper — envía el CustomEvent de finalización ──────────────
  const dispatchComplete = useCallback(
    (completed: boolean) => {
      window.dispatchEvent(
        new CustomEvent("koru-card-action", {
          detail: {
            action: "meditation_complete",
            session: session.label,
            duration: elapsed,
            totalPlanned: totalSec,
            completed,
            cycles,
          },
        }),
      );
    },
    [elapsed, totalSec, cycles, session.label],
  );

  // ── Finalizar la sesión ──────────────────────────────────────────────────
  const finish = useCallback(
    (completed: boolean) => {
      dispatchComplete(completed);
      onClose();
    },
    [dispatchComplete, onClose],
  );

  // ── Timer countdown (1 tick por segundo) ────────────────────────────────
  useEffect(() => {
    if (paused) return;
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Auto-finish cuando llega a 0.
          setTimeout(() => finish(true), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, finish]);

  // ── Breathing cycle (4s inhale + 4s exhale = 8s por ciclo) ───────────────
  // Haptic pulse en CADA ciclo (al volver a "inhale").
  useEffect(() => {
    if (paused) return;
    let cycleCount = 0;
    setPhase("inhale");
    breathRef.current = window.setInterval(() => {
      setPhase((p) => {
        if (p === "inhale") {
          // Pasamos a exhale.
          return "exhale";
        }
        // Estábamos en exhale → volvemos a inhale = ciclo completo.
        cycleCount += 1;
        setCycles(cycleCount);
        // Haptic pulse al completar un ciclo de respiración.
        vibrate(20);
        return "inhale";
      });
    }, 4000);
    return () => {
      if (breathRef.current !== null) {
        window.clearInterval(breathRef.current);
        breathRef.current = null;
      }
    };
  }, [paused]);

  // ── ESC = abrir confirmación de salida (no cerrar directo) ───────────────
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

  const progress = totalSec > 0 ? 1 - remaining / totalSec : 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Meditación — ${session.label}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        overflow: "hidden",
        background: "linear-gradient(180deg, #efe6ff 0%, #f5edff 50%, #faf6ff 100%)",
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        color: "#382b8c",
      }}
    >
      {/* ── Aurora blobs (decorativos, pseudo-random) ───────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-10%",
          left: "-15%",
          width: "70vw",
          height: "70vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, rgba(131, 99, 249, 0.45), transparent 60%)",
          filter: "blur(40px)",
          animation: "koru-breathe 8s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-20%",
          width: "80vw",
          height: "80vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 60% 50%, rgba(70, 72, 212, 0.35), transparent 60%)",
          filter: "blur(50px)",
          animation: "koru-breathe 10s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "30%",
          right: "-10%",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.22), transparent 60%)",
          filter: "blur(45px)",
          animation: "koru-breathe 9s ease-in-out infinite 1s",
          pointerEvents: "none",
        }}
      />

      {/* ── Header: close + session label ──────────────────────────────── */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 18px",
          paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
        }}
      >
        <button
          type="button"
          aria-label="Terminar meditación"
          onClick={() => setConfirmOpen(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "1px solid rgba(131, 99, 249, 0.18)",
            background: "rgba(255, 255, 255, 0.55)",
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
            Sesión de meditación
          </p>
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            color: "#382b8c",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {session.label}
          </h2>
        </div>
        {session.icon && (
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 22,
              color: "#8363f9",
              background: "rgba(255, 255, 255, 0.55)",
              width: 38,
              height: 38,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            {session.icon}
          </span>
        )}
      </header>

      {/* ── Breathing circle ────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          display: "grid",
          placeItems: "center",
          padding: "8px 22px",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: 280,
            height: 280,
          }}
        >
          {/* Halo exterior (más sutil, también respira) */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "radial-gradient(circle at 50% 50%, rgba(131, 99, 249, 0.18), transparent 70%)",
              transform: phase === "inhale" ? "scale(1.08)" : "scale(0.92)",
              transition: "transform 4000ms ease-in-out",
            }}
          />
          {/* Círculo principal — koru-breathe ampliado (4s inhale + 4s exhale).
              Usamos la animación `koru-breathe` con duración 8s para sincronizar
              con el ciclo de fase del JS. Escalamos 1.0 → 1.35 → 1.0. */}
          <div
            aria-hidden
            style={{
              width: 180,
              height: 180,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 30%, #c4a7ff 0%, #8363f9 55%, #4648d4 100%)",
              boxShadow:
                "0 20px 60px rgba(131, 99, 249, 0.45), inset 0 0 40px rgba(255, 255, 255, 0.25)",
              transform: phase === "inhale" ? "scale(1.18)" : "scale(0.92)",
              transition: "transform 4000ms ease-in-out",
            }}
          />
          {/* Texto de fase sobre el círculo */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              textAlign: "center",
              color: "#fff",
              textShadow: "0 2px 8px rgba(70, 50, 130, 0.4)",
              pointerEvents: "none",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                opacity: 0.9,
              }}
            >
              {paused ? "Pausado" : phase === "inhale" ? "Inhala" : "Exhala"}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontFamily: '"Bricolage Grotesque", Georgia, serif',
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {paused ? "—" : phase === "inhale" ? "4s" : "4s"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Timer + cycles ──────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "0 22px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: '"Bricolage Grotesque", Georgia, serif',
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1,
            color: "#382b8c",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -1,
          }}
        >
          {formatTime(remaining)}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 600, color: "#6b5f8c" }}>
          {cycles} {cycles === 1 ? "respiración" : "respiraciones"} · {Math.round(progress * 100)}% completado
        </p>

        {/* Barra de progreso sutil */}
        <div
          aria-hidden
          style={{
            marginTop: 14,
            height: 6,
            borderRadius: 999,
            background: "rgba(131, 99, 249, 0.16)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #8363f9, #4648d4)",
              borderRadius: 999,
              transition: "width 800ms ease",
            }}
          />
        </div>
      </div>

      {/* ── Footer: pausar / terminar ───────────────────────────────────── */}
      <footer
        style={{
          position: "relative",
          zIndex: 2,
          padding: "20px 22px",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setPaused((p) => !p);
            vibrate(12);
          }}
          style={{
            flex: 1,
            padding: "14px 12px",
            borderRadius: 14,
            border: "1px solid rgba(70, 72, 212, 0.18)",
            background: "rgba(255, 255, 255, 0.7)",
            color: "#4648d4",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {paused ? "play_arrow" : "pause"}
          </span>
          {paused ? "Reanudar" : "Pausar"}
        </button>
        <button
          type="button"
          onClick={() => finish(true)}
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
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
          Terminar
        </button>
      </footer>

      {/* ── Confirmación de salida ──────────────────────────────────────── */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="¿Terminar la sesión?"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(30, 20, 60, 0.55)",
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
                background: "rgba(131, 99, 249, 0.14)",
                color: "#8363f9",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>self_improvement</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1a2e" }}>
              ¿Terminar la sesión?
            </h3>
            <p style={{ margin: "8px 0 18px", fontSize: 13, color: "#6b5f8c", lineHeight: 1.45 }}>
              Llevás {formatTime(elapsed)} de {formatTime(totalSec)} y {cycles} respiraciones.
              Guardaremos el progreso de tu sesión.
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
                Seguir
              </button>
              <button
                type="button"
                onClick={() => finish(true)}
                style={{
                  flex: 1,
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: "#4648d4",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Terminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export default MeditationOverlay;
