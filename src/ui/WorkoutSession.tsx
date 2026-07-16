import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ExercisePlan, ExerciseSession, ExerciseSet } from "../domain/types";

// ═══════════════════════════════════════════════════════════════════════════
// WorkoutSession — overlay full-screen para una sesión de entrenamiento activa.
//
// Renderiza el ejercicio actual con sets × reps × peso + timer de descanso
// circular. Marcar un set como completado avanza al siguiente; al terminar
// todos los sets de un ejercicio, avanza al siguiente. Al finalizar, dispatcha
// `koru-card-action` con `action: "log_workout"` para que KoruProvider lo
// persista como WorkoutLog (vía logWorkout reducer).
//
// Fondo: gradiente verde oscuro (única dark surface permitida en fitness).
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_REST_SEC = 90;

function Mat({ children }: { children: string }) {
  return <span className="material-symbols-outlined">{children}</span>;
}

function fmtTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function haptic(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    /* noop */
  }
}

type SetState = { weight: number; done: boolean };
type ExerciseProgress = { sets: SetState[] };

type Props = {
  plan: ExercisePlan;
  session: ExerciseSession;
  onClose: () => void;
};

/** Cuenta regresiva circular con stroke-dasharray animado. */
function RestTimer({ seconds, onSkip, onEnd }: { seconds: number; onSkip: () => void; onEnd: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = seconds > 0 ? remaining / seconds : 0;
  const dashoffset = c * (1 - pct);

  useEffect(() => {
    setRemaining(seconds);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const rem = Math.max(0, seconds - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(id);
        setTimeout(() => onEnd(), 0);
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <svg width="160" height="160" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#a7f3d0"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.2s linear" }}
        />
        <text x="70" y="80" textAnchor="middle" fill="#ffffff" fontSize="34" fontWeight="700" fontFamily="system-ui, sans-serif">
          {Math.ceil(remaining)}
        </text>
      </svg>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: 0.6, textTransform: "uppercase" }}>
        Descanso
      </p>
      <button
        type="button"
        onClick={() => {
          haptic(10);
          onSkip();
        }}
        style={{
          background: "rgba(255,255,255,0.15)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 999,
          padding: "10px 22px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Saltar descanso
      </button>
    </div>
  );
}

const SPEC_LABEL: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  marginBottom: 4,
};

const SPEC_VALUE: CSSProperties = {
  display: "block",
  fontSize: 26,
  fontWeight: 800,
  color: "#ffffff",
  fontVariantNumeric: "tabular-nums",
};

function Spec({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <span style={SPEC_LABEL}>{label}</span>
      <span style={SPEC_VALUE}>{value}</span>
    </div>
  );
}

export function WorkoutSession({ plan, session, onClose }: Props) {
  const initial: ExerciseProgress[] = useMemo(() => {
    return (session.exercises ?? []).map((ex) => ({
      sets: Array.from({ length: Math.max(1, ex.sets ?? 1) }, () => ({
        weight: ex.weight ?? 0,
        done: false,
      })),
    }));
  }, [session]);

  const [progress, setProgress] = useState<ExerciseProgress[]>(initial);
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [restSec, setRestSec] = useState<number | null>(null);
  const [startTs] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [confirmingFinish, setConfirmingFinish] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTs]);

  const dispatchedRef = useMemo(() => ({ current: false }), []);

  const exercises = session.exercises ?? [];
  const totalEx = exercises.length;
  const currentEx = exercises[exIdx];
  const totalSetsCurrent = Math.max(1, currentEx?.sets ?? 1);

  function completeSet() {
    if (exIdx >= totalEx) return;
    haptic(40);
    setProgress((prev) =>
      prev.map((p, i) =>
        i === exIdx
          ? { ...p, sets: p.sets.map((s, j) => (j === setIdx ? { ...s, done: true } : s)) }
          : p,
      ),
    );

    const ex = exercises[exIdx];
    const restDuration = ex?.restSec ?? DEFAULT_REST_SEC;
    setRestSec(restDuration);

    if (setIdx + 1 < totalSetsCurrent) {
      setSetIdx(setIdx + 1);
    } else if (exIdx + 1 < totalEx) {
      setExIdx(exIdx + 1);
      setSetIdx(0);
    }
    // Si es el último set del último ejercicio, no avanzamos índices — la UI
    // muestra "Completar set final" y el usuario puede cerrar o finalizar.
  }

  function skipRest() {
    setRestSec(null);
  }

  function buildLoggedExercises(): ExerciseSet[] {
    return exercises.map((ex, i) => {
      const p = progress[i];
      const lastWeight = p?.sets?.find((s) => s.weight > 0)?.weight ?? ex.weight;
      return {
        exercise: ex.exercise,
        sets: ex.sets,
        reps: ex.reps,
        weight: lastWeight,
        durationSec: ex.durationSec,
        restSec: ex.restSec,
        notes: ex.notes,
      };
    });
  }

  function dispatchFinish() {
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    const durationMin = Math.max(1, Math.round((Date.now() - startTs) / 60_000));
    const payload = {
      action: "log_workout",
      planId: plan.id,
      sessionId: session.id,
      exercises: buildLoggedExercises(),
      durationMin,
    };
    try {
      window.dispatchEvent(new CustomEvent("koru-card-action", { detail: payload }));
    } catch {
      /* noop */
    }
    haptic(60);
  }

  function handleFinish() {
    if (!confirmingFinish) {
      setConfirmingFinish(true);
      return;
    }
    dispatchFinish();
    onClose();
  }

  // ESC cierra con confirmación.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmingFinish(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sessionComplete = exIdx >= totalEx;
  const isLastSet = exIdx === totalEx - 1 && setIdx === totalSetsCurrent - 1;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    background: "linear-gradient(180deg, #1a3d2e 0%, #2d6a4f 100%)",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
  };

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={`Sesión: ${session.dayLabel}`}>
      {/* Topbar: elapsed timer + sesión + finalizar */}
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
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 999,
            padding: "6px 12px",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label="Tiempo total"
        >
          <Mat>timer</Mat>
          <span>{fmtTime(elapsedSec)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(167,243,208,0.85)", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Sesión
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#ffffff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {session.dayLabel}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleFinish}
          aria-label="Finalizar sesión"
          style={{
            background: confirmingFinish ? "#dc2626" : "rgba(255,255,255,0.15)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {confirmingFinish ? "¿Confirmar?" : "Finalizar"}
        </button>
      </header>

      {/* Progress text */}
      <div style={{ padding: "4px 18px 0", flexShrink: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(255,255,255,0.78)",
            textAlign: "center",
          }}
        >
          Ejercicio {Math.min(exIdx + 1, totalEx)} de {totalEx} · Set {Math.min(setIdx + 1, totalSetsCurrent)} de {totalSetsCurrent}
        </p>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {sessionComplete ? (
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>
              <Mat>celebrating</Mat>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800 }}>¡Sesión completa!</h2>
            <p style={{ margin: "0 0 22px", fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
              Duración: {fmtTime(elapsedSec)}
            </p>
            <button
              type="button"
              onClick={() => {
                dispatchFinish();
                onClose();
              }}
              style={{
                background: "#a7f3d0",
                color: "#1a3d2e",
                border: "none",
                borderRadius: 14,
                padding: "14px 26px",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Registrar entrenamiento
            </button>
          </div>
        ) : (
          <>
            <div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(167,243,208,0.85)",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                Ejercicio actual
              </p>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{currentEx?.exercise}</h2>
              {currentEx?.notes && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{currentEx.notes}</p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "16px 12px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Spec label="Series" value={currentEx?.sets ?? "—"} />
              <Spec label="Reps" value={currentEx?.reps ?? "—"} />
              <Spec label="Peso" value={currentEx?.weight ? `${currentEx.weight}kg` : "—"} />
              <Spec label="Descanso" value={`${currentEx?.restSec ?? DEFAULT_REST_SEC}s`} />
            </div>

            {/* Sets indicator dots */}
            <div
              style={{ display: "flex", justifyContent: "center", gap: 8 }}
              aria-label="Progreso de sets"
            >
              {progress[exIdx]?.sets.map((s, i) => (
                <span
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: s.done ? "#a7f3d0" : i === setIdx ? "#ffffff" : "rgba(255,255,255,0.25)",
                    border: i === setIdx ? "2px solid #a7f3d0" : "none",
                  }}
                />
              ))}
            </div>

            {restSec != null ? (
              <div style={{ marginTop: 8 }}>
                <RestTimer seconds={restSec} onSkip={skipRest} onEnd={skipRest} />
              </div>
            ) : (
              <button
                type="button"
                onClick={completeSet}
                style={{
                  marginTop: 8,
                  background: "#a7f3d0",
                  color: "#1a3d2e",
                  border: "none",
                  borderRadius: 16,
                  padding: "18px 22px",
                  fontSize: 17,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 10px 30px rgba(167,243,208,0.25)",
                }}
              >
                {isLastSet ? "Completar set final" : "Completar set"}
              </button>
            )}

            {confirmingFinish && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="¿Finalizar sesión?"
                style={{
                  marginTop: 8,
                  padding: 16,
                  borderRadius: 16,
                  background: "rgba(220,38,38,0.15)",
                  border: "1px solid rgba(220,38,38,0.4)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                  ¿Finalizar la sesión ahora? Se registrará el progreso parcial.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmingFinish(false)}
                    style={{
                      flex: 1,
                      padding: "12px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.25)",
                      background: "transparent",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    style={{
                      flex: 1,
                      padding: "12px 10px",
                      borderRadius: 12,
                      border: "none",
                      background: "#dc2626",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Sí, finalizar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default WorkoutSession;
