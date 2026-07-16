import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { AssistantPlanItem } from "../domain/types";
import { useKoru } from "./KoruProvider";

// Tu Plan Integral — réplica Stitch "Roadmap Detallado" hecha funcional:
// - "Ruta de Hoy" es el plan REAL entregado por el pipeline (items del uiBlock).
//   Tocar el círculo de un paso lo marca como completado (persiste en localStorage).
// - "Seguimiento de Hábitos" son las prioridades/compromisos reales de Koru;
//   los checkboxes llaman a togglePriority.
// - "Métricas" se calculan del propio plan (minutos activos, pasos completados).

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

const STEP_ICON: Record<string, string> = {
  flag: "flag",
  book: "menu_book",
  move: "fitness_center",
  message: "chat_bubble",
  calendar: "calendar_month",
  money: "savings",
  heart: "favorite",
  home: "home",
};

const FALLBACK_ICONS = ["self_improvement", "fitness_center", "bedtime", "directions_run", "spa"];

function stepIcon(item: AssistantPlanItem, index: number): string {
  if (item.icon && STEP_ICON[item.icon]) return STEP_ICON[item.icon];
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

function progressKey(title: string | undefined, items: AssistantPlanItem[]): string {
  const sig = `${title ?? "plan"}::${items.map((i) => i.title).join("|")}`;
  let hash = 0;
  for (let i = 0; i < sig.length; i++) hash = (hash * 31 + sig.charCodeAt(i)) | 0;
  return `koru.plan.progress.${Math.abs(hash).toString(36)}`;
}

function habitIconFor(label: string): { icon: string; bg: string; color: string } {
  const l = label.toLowerCase();
  if (/agua|hidrat|beber/.test(l)) return { icon: "water_drop", bg: "#dbeafe", color: "#3b82f6" };
  if (/dormir|suen|descans/.test(l)) return { icon: "bedtime", bg: "#e0e7ff", color: "#6366f1" };
  if (/pantalla|celular|movil/.test(l)) return { icon: "devices", bg: "#ffedd5", color: "#f97316" };
  if (/comida|comer|nutri|dieta/.test(l)) return { icon: "restaurant", bg: "#dcfce7", color: "#22c55e" };
  if (/ejercicio|entren|correr|gym/.test(l)) return { icon: "fitness_center", bg: "#fce7f3", color: "#ec4899" };
  return { icon: "check_circle", bg: "#f3e8ff", color: "#a855f7" };
}

export function PlanRoadmapScreen({
  title,
  items,
  onClose,
}: {
  title?: string;
  items: AssistantPlanItem[];
  onClose: () => void;
}) {
  // 🔴 TIER S: además de priorities/togglePriority, leemos state para
  // exponer botones que disparen logWorkout (sobre el ExercisePlan actual)
  // y archivePlan (sobre el Plan durable actual). Los botones dispatchan
  // CustomEvent "koru-card-action" que el handler de KoruProvider traduce a
  // llamadas a los reducers logWorkout / archivePlan.
  const { state, priorities, togglePriority } = useKoru();
  const storageKey = useMemo(() => progressKey(title, items), [title, items]);
  const [doneSteps, setDoneSteps] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as boolean[]) : [];
      return items.map((_, i) => parsed[i] ?? false);
    } catch {
      return items.map(() => false);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(doneSteps));
    } catch {
      // persistencia best-effort
    }
  }, [storageKey, doneSteps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const doneCount = doneSteps.filter(Boolean).length;
  const routePct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const currentIdx = doneSteps.findIndex((d) => !d);
  const habits = priorities.slice(0, 5);
  const habitsDone = habits.filter((h) => h.done).length;
  const activeMinutes = items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
  const doneMinutes = items.reduce((sum, item, i) => sum + (doneSteps[i] ? item.durationMinutes ?? 0 : 0), 0);
  const minutesPct = activeMinutes ? Math.round((doneMinutes / activeMinutes) * 100) : 0;

  function toggleStep(index: number) {
    setDoneSteps((prev) => prev.map((d, i) => (i === index ? !d : d)));
  }

  return (
    <div className="koru-roadmap" role="dialog" aria-label="Tu Plan Integral">
      <div className="koru-roadmap-screen">
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        <button type="button" aria-label="Volver" className="koru-roadmap-back" onClick={onClose}>
          <Mat>arrow_back_ios_new</Mat>
        </button>

        <div className="koru-roadmap-header">
          <img alt="" src="/stitch/roadmap-hero.png" className="koru-roadmap-hero" />
          <h1 className="koru-roadmap-title">{title?.trim() || "Tu Plan Integral"}</h1>
          <p className="koru-roadmap-subtitle">Diseñado para tu mejor versión</p>
        </div>

        <div className="koru-roadmap-modules">
          {/* Ruta de Hoy — plan real, pasos marcables */}
          <div className="koru-magical-card module-morning">
            <div className="koru-module-head">
              <div className="koru-module-id">
                <div className="koru-module-icon">
                  <Mat>route</Mat>
                </div>
                <div>
                  <h3 className="koru-module-title">Ruta de Hoy</h3>
                  <p className="koru-module-kicker">TU CAMINO DIARIO</p>
                </div>
              </div>
              <div className="koru-progress-ring" style={{ "--ring-pct": routePct } as CSSProperties}>
                <span>{routePct}%</span>
              </div>
            </div>
            <div className="koru-timeline">
              <div className="koru-timeline-line" />
              <div className="koru-timeline-steps">
                {items.map((item, idx) => {
                  const status = doneSteps[idx] ? "done" : idx === currentIdx ? "current" : "pending";
                  const meta = [
                    item.durationMinutes ? `${item.durationMinutes} min` : item.time,
                    item.rationale ?? item.mode,
                  ]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <div key={`${item.title}-${idx}`} className={`koru-timeline-step is-${status}`}>
                      <button
                        type="button"
                        className="koru-timeline-dot"
                        aria-label={doneSteps[idx] ? `Desmarcar ${item.title}` : `Completar ${item.title}`}
                        onClick={() => toggleStep(idx)}
                      >
                        <Mat>{doneSteps[idx] ? "check" : stepIcon(item, idx)}</Mat>
                      </button>
                      <div className="koru-timeline-body">
                        <h4 className="koru-timeline-name">{item.title}</h4>
                        {meta && <p className="koru-timeline-meta">{meta}</p>}
                        <span className={`koru-step-chip is-${status}`}>
                          {status === "done" ? "Completado" : status === "current" ? "En curso" : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Seguimiento de Hábitos — prioridades reales de Koru */}
          {habits.length > 0 && (
            <div className="koru-magical-card module-habits">
              <div className="koru-module-head">
                <div className="koru-module-id">
                  <div className="koru-module-icon">
                    <Mat>check_circle</Mat>
                  </div>
                  <div>
                    <h3 className="koru-module-title">Seguimiento de Hábitos</h3>
                    <p className="koru-module-kicker">PEQUEÑAS VICTORIAS</p>
                  </div>
                </div>
                <div className="koru-module-count">
                  {habitsDone}/{habits.length}
                </div>
              </div>
              <div className="koru-habit-list">
                {habits.map((habit) => {
                  const style = habitIconFor(habit.label);
                  return (
                    <label key={habit.id} className="koru-habit-row">
                      <div className="koru-habit-id">
                        <div className="koru-habit-icon" style={{ background: style.bg, color: style.color }}>
                          <Mat>{style.icon}</Mat>
                        </div>
                        <span className="koru-habit-name">{habit.label}</span>
                      </div>
                      <input
                        type="checkbox"
                        className="koru-habit-checkbox"
                        checked={habit.done}
                        onChange={() => togglePriority(habit.id)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Métricas — calculadas del plan real */}
          <div className="koru-magical-card module-core">
            <div className="koru-module-head">
              <div className="koru-module-id">
                <div className="koru-module-icon">
                  <Mat>monitoring</Mat>
                </div>
                <div>
                  <h3 className="koru-module-title">Métricas de Rendimiento</h3>
                  <p className="koru-module-kicker">TUS NÚMEROS</p>
                </div>
              </div>
            </div>
            <div className="koru-metric-grid">
              <div className="koru-metric-tile">
                <div className="koru-progress-ring" style={{ "--ring-pct": minutesPct, color: "#ef4444", marginBottom: 8 } as CSSProperties}>
                  <Mat>local_fire_department</Mat>
                </div>
                <h4 className="koru-metric-label">Minutos Activos</h4>
                <p className="koru-metric-value">
                  {doneMinutes} <small>/ {activeMinutes} min</small>
                </p>
              </div>
              <div className="koru-metric-tile">
                <div
                  className="koru-habit-icon"
                  style={{ width: 64, height: 64, marginBottom: 8, background: "#ffe4e6", color: "#f43f5e" }}
                >
                  <Mat>favorite</Mat>
                </div>
                <h4 className="koru-metric-label">Pasos Completados</h4>
                <p className="koru-metric-value">
                  {doneCount} <small>/ {items.length}</small>
                </p>
                {routePct >= 50 && <p className="koru-metric-foot">Buen ritmo</p>}
              </div>
            </div>
          </div>

          {/* Próximos Desafíos — se desbloquean con el progreso real */}
          <div className="koru-magical-card module-challenges">
            <div className="koru-module-head">
              <div className="koru-module-id">
                <div className="koru-module-icon">
                  <Mat>emoji_events</Mat>
                </div>
                <div>
                  <h3 className="koru-module-title">Próximos Desafíos</h3>
                  <p className="koru-module-kicker">SUPERA TUS LÍMITES</p>
                </div>
              </div>
            </div>
            <div className="koru-challenge-list">
              <div className="koru-challenge-row">
                <div className="koru-challenge-lock">
                  <Mat>{routePct === 100 ? "emoji_events" : "lock"}</Mat>
                </div>
                <div>
                  <p className="koru-challenge-name">Día Perfecto</p>
                  <p className="koru-challenge-desc">Completa todos los pasos de tu ruta de hoy.</p>
                </div>
              </div>
              <div className="koru-challenge-row">
                <div className="koru-challenge-lock">
                  <Mat>lock</Mat>
                </div>
                <div>
                  <p className="koru-challenge-name">Semana de Oro</p>
                  <p className="koru-challenge-desc">Completa 7 días perfectos.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 🔴 TIER S: Acciones del Plan — botones que disparan reducers
              que antes no tenían caller en la UI:
              • logWorkout: marca la sesión actual del primer ExercisePlan
                como completada (avanza currentSessionIdx).
              • archivePlan: archiva el primer Plan durable (status=archived).
              Ambos dispatchan `koru-card-action` que el listener de
              KoruProvider traduce a llamadas a los reducers. */}
          {((state.exercisePlans ?? []).length > 0 || (state.plans ?? []).length > 0) && (
            <div className="koru-magical-card module-core">
              <div className="koru-module-head">
                <div className="koru-module-id">
                  <div className="koru-module-icon">
                    <Mat>bolt</Mat>
                  </div>
                  <div>
                    <h3 className="koru-module-title">Acciones del Plan</h3>
                    <p className="koru-module-kicker">REGISTRA TU PROGRESO</p>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 0" }}>
                {(state.exercisePlans ?? []).length > 0 && (() => {
                  const plan = state.exercisePlans![0];
                  const session = plan.sessions[plan.currentSessionIdx] ?? plan.sessions[0];
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("koru-card-action", {
                            detail: {
                              action: "log_workout",
                              planId: plan.id,
                              sessionId: session?.id ?? "",
                              durationMin: 30,
                            },
                          }),
                        );
                        if ("vibrate" in navigator) navigator.vibrate(12);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(34, 160, 107, 0.2)",
                        background: "rgba(34, 160, 107, 0.06)",
                        color: "#0b1c30",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#22a06b", fontSize: 20 }}>fitness_center</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        Completar sesión{session ? `: ${session.dayLabel}` : ""} (logWorkout)
                      </span>
                    </button>
                  );
                })()}
                {(state.plans ?? []).length > 0 && (() => {
                  const plan = state.plans![0];
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("koru-card-action", {
                            detail: {
                              action: "archive_plan",
                              planId: plan.id,
                            },
                          }),
                        );
                        if ("vibrate" in navigator) navigator.vibrate(12);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(220, 38, 38, 0.2)",
                        background: "rgba(220, 38, 38, 0.04)",
                        color: "#0b1c30",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#dc2626", fontSize: 20 }}>archive</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        Archivar plan “{plan.title}” (archivePlan)
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
