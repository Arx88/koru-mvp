import { WorldObject } from "./michi/WorldObject";
import { MichiPageBackdrop } from "./michi/MichiPage";
import { MichiCat } from "./michi/v8Shared";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import type { KoruState, ProactiveNudge } from "../domain/types";
import { computeStreak } from "../domain/store";
import { localDateISO } from "../domain/localDate";
import { MeditationOverlay, type MeditationSession } from "./MeditationOverlay";

// 🔴 Code-splitting: App.tsx carga HomeScreen via React.lazy. Necesitamos
// un default export para que `lazy(() => import("./HomeScreen"))` funcione.
// El named export `HomeScreen` se mantiene por compatibilidad con tests y
// otros importers.

// ═══════════════════════════════════════════════════════════════════════════
//  Home dashboard — pantalla "Hoy" del wheel de navegación.
//  Muestra el día de un vistazo: saludo temporal, items del día (2x2),
//  calendario horizontal, prioridades, clima, nudges proactivos y
//  acciones rápidas. Reutiliza los tokens visuales Stitch:
//    • `.koru-roadmap` + `.koru-roadmap-screen` → fondo difuminado + 430px
//    • `.koru-detail-sticky-head` → header sticky con blur
//    • `.koru-plan-hero` → hero de saludo
//    • `.koru-magical-card` → tiles con gradiente + shadow tokens
//
//  🔴 TIER S: esta pantalla es el caller principal de varios reducers del
//  store que antes no tenían uso en la UI:
//    • logWellbeing — tile de hidratación (+250ml por tap)
//    • logHabit — botón "marcar hecho" en cada hábito del día
//    • computeStreak — streak count junto a cada hábito
//  Los callbacks onLogWater / onLogHabit / onRefreshWeather los provee
//  App.tsx desde useKoru() (que a su vez llama a los wrappers de KoruProvider).
// ═══════════════════════════════════════════════════════════════════════════

export interface HomeScreenProps {
  state: KoruState;
  onNavigate: (screen: string) => void;
  onCreate: () => void;
  onSearch: () => void;
  onTalk: () => void;
  onDismissNudge: (nudgeId: string) => void;
  // 🔴 FIX (2026-09-10): acceso a Mis Colecciones desde el dashboard — antes
  // solo se llegaba con el aviso "Ver" del toast (efímero) y Koru no podía
  // mandar al usuario a ver sus guardados.
  onOpenCollections?: () => void;
  // 🔴 TIER S: callbacks para invocar reducers del store desde los widgets.
  onLogWater?: (ml: number) => void;
  onLogHabit?: (habitId: string) => void;
  onRefreshWeather?: () => Promise<boolean> | void;
  // 🔴 P2 — pausar/reanudar hábitos sin perder racha.
  onPauseHabit?: (habitId: string) => void;
  onResumeHabit?: (habitId: string) => void;
}

const HYDRATION_GOAL_ML = 2000;
const PULL_THRESHOLD = 64;

// 🔴 P2 — Sesiones de meditación disponibles en el dashboard "Hoy".
// Cada sesión abre el overlay MeditationOverlay (z-index 300) con el
// círculo de respiración y timer countdown.
const MEDITATION_SESSIONS: MeditationSession[] = [
  {
    label: "Respiración 4-7-8",
    description: "Inhala 4s · sostén 7s · exhala 8s",
    durationSec: 180,
    icon: "self_improvement",
  },
  {
    label: "Respiración consciente",
    description: "4s inhala · 4s exhala",
    durationSec: 300,
    icon: "air",
  },
  {
    label: "Pausa corta",
    description: "Reset rápido en 2 minutos",
    durationSec: 120,
    icon: "spa",
  },
];

function todayISO(): string {
  // 🔴 FIX (2026-09-09): fecha LOCAL — new Date().toISOString() devuelve UTC y
  // tras ~21:00 en Latinoamérica el dashboard mostraba los eventos de mañana
  // como "hoy" (y los de hoy desaparecían).
  return localDateISO();
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour <= 20) return "Buenas tardes";
  return "Buenas noches";
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function HomeScreen({
  state,
  onNavigate,
  onCreate,
  onSearch,
  onTalk,
  onDismissNudge,
  onOpenCollections,
  onLogWater,
  onLogHabit,
  onRefreshWeather,
  onPauseHabit,
  onResumeHabit,
}: HomeScreenProps) {
  // ── Pull-to-refresh (visual indicator only — no refresh logic) ────────────
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  // 🔴 P2 — Sesión de meditación activa (abre MeditationOverlay).
  // null = overlay cerrado; objeto = sesión que se está reproduciendo.
  const [meditationSession, setMeditationSession] = useState<MeditationSession | null>(null);

  // 🔴 FIX (2026-09-09): refresh REAL del clima compartido por pull-to-refresh
  // y botón "Actualizar"/"Traer clima" del widget. `refreshing` mantiene el
  // indicador visible mientras el fetch está en vuelo.
  const [refreshing, setRefreshing] = useState(false);
  // 🔴 FIX (2026-09-09): refs para que los tiles del dashboard hagan SCROLL a
  // la sección correspondiente en vez de navegar a pantallas equivocadas
  // ("Eventos hoy" abría Historial) o ejecutar acciones destructivas
  // ("Hábitos" marcaba el primer hábito sin confirmación).
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const habitsRef = useRef<HTMLDivElement | null>(null);
  const prioritiesRef = useRef<HTMLDivElement | null>(null);
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current ?? (ref as { current: HTMLElement | null }).current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const triggerWeatherRefresh = useCallback(async () => {
    if (!onRefreshWeather) return;
    setRefreshing(true);
    try {
      await onRefreshWeather();
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshWeather]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if ((scrollerRef.current?.scrollTop ?? 0) > 0) return;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current == null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0 && (scrollerRef.current?.scrollTop ?? 0) <= 0) {
      // Easing: los primeros 160px se resisten, luego tope de 80px.
      const eased = Math.min(80, delta * 0.5);
      setPull(eased);
    }
  };
  const onTouchEnd = () => {
    const crossed = pull >= PULL_THRESHOLD;
    touchStartY.current = null;
    setPull(0);
    // 🔴 FIX (2026-09-09): el pull-to-refresh era PURAMENTE cosmético (el
    // icono prometía refrescar y no hacía nada). Al cruzar el umbral dispara
    // el refresh REAL del clima (fetch al backend) — el mismo del botón
    // "Actualizar" del widget.
    if (crossed && !refreshing) void triggerWeatherRefresh();
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const d = useMemo(() => {
    const today = todayISO();
    const hour = new Date().getHours();
    const greeting = greetingFor(hour);
    const name = state.userProfile?.name || state.userName || "";

    const eventsToday = (state.calendarEvents ?? []).filter((e) => {
      // 🔴 FIX: día LOCAL del evento (startsAt es ISO/UTC — startsWith(today)
      // fallaba para eventos entre medianoche y ~2AM en zonas al este de UTC).
      if (!e.startsAt) return false;
      const dt = new Date(e.startsAt);
      return Number.isNaN(dt.getTime()) ? false : localDateISO(dt) === today;
    });

    const deadlinesToday = (state.commitments ?? []).filter((c) => {
      if (c.status !== "open" || !c.dueAt) return false;
      const dt = new Date(c.dueAt);
      return Number.isNaN(dt.getTime()) ? false : localDateISO(dt) === today;
    });

    const waterLogs = (state.wellbeingLogs ?? []).filter(
      (l) => l.date === today && l.metric === "water",
    );
    const waterMl = waterLogs.reduce((sum, l) => sum + (l.value || 0), 0);

    const habits = state.habits ?? [];
    const habitLogsToday = state.habitLogs ?? [];
    const activeHabits = habits.filter((h) => h.active);
    const pausedHabits = habits.filter((h) => !h.active);
    const habitsRemaining = activeHabits.filter(
      (h) => !habitLogsToday.some((l) => l.habitId === h.id && l.date === today),
    );
    // 🔴 TIER S: streak por hábito via computeStreak reducer (función pura).
    // Lo precomputamos aquí para que el render sólo haga un lookup por id.
    // Incluimos los pausados también: la racha se conserva aunque el hábito
    // esté pausado (no se resetea).
    const streakByHabitId: Record<string, number> = {};
    for (const h of habits) {
      streakByHabitId[h.id] = computeStreak(h.id, habitLogsToday);
    }

    // Prioridades — 4 cuadrantes. `Commitment` no tiene campo `priority`,
    // así que usamos proximidad de `dueAt` + recurrencia como heurística.
    const openCommitments = (state.commitments ?? []).filter(
      (c) => c.status === "open",
    );
    const now = Date.now();
    const urgente = openCommitments.filter((c) => {
      if (!c.dueAt) return false;
      const due = new Date(c.dueAt).getTime();
      return Number.isNaN(due) ? false : due <= now + DAY_MS; // vence hoy o ya vencido
    });
    const urgenteIds = new Set(urgente.map((c) => c.id));
    const importante = openCommitments.filter((c) => {
      if (!c.dueAt || urgenteIds.has(c.id)) return false;
      const due = new Date(c.dueAt).getTime();
      if (Number.isNaN(due)) return false;
      return due > now + DAY_MS && due <= now + 3 * DAY_MS;
    });
    const clasificadosIds = new Set([...urgenteIds, ...importante.map((c) => c.id)]);
    // 🔴 FIX: "rutina" ya no solapa con urgente/importante — un compromiso
    // recurrente que vence mañana contaba en DOS tiles a la vez.
    const rutina = openCommitments.filter((c) => !!c.recurrence && !clasificadosIds.has(c.id));
    const rutinaIds = new Set(rutina.map((c) => c.id));
    const opcional = openCommitments.filter((c) => !clasificadosIds.has(c.id) && !rutinaIds.has(c.id));

    // 🔴 FIX (2026-09-10): los nudges marcados [proactive_shown] ya fueron
    // inyectados como mensaje de chat — NO re-mostrarlos como cards en Home
    // (el usuario veía el marcador interno "[proactive_shown] Buenos días"
    // en la sección "Koru te sugiere").
    const activeNudges = (state.nudges ?? []).filter(
      (n) => !n.dismissed && !n.title.startsWith("[proactive_shown]"),
    );

    return {
      today,
      greeting,
      name,
      eventsToday,
      deadlinesToday,
      waterMl,
      habitsRemaining,
      activeHabits,
      pausedHabits,
      streakByHabitId,
      urgente,
      importante,
      rutina,
      opcional,
      activeNudges,
    };
  }, [state]);

  const {
    greeting,
    name,
    eventsToday,
    deadlinesToday,
    waterMl,
    habitsRemaining,
    activeHabits,
    pausedHabits,
    streakByHabitId,
    urgente,
    importante,
    rutina,
    opcional,
    activeNudges,
  } = d;

  const waterPct = Math.min(100, Math.round((waterMl / HYDRATION_GOAL_ML) * 100));
  const todayLong = new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="koru-roadmap mx-secondary mx-homescreen" role="region" aria-label="Hoy — Michi">
      <div
        ref={scrollerRef}
        className="koru-roadmap-screen"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ overscrollBehaviorY: "contain" }}
      >
        {/* Blobs decorativos Stitch */}
        <MichiPageBackdrop />

        {/* Pull-to-refresh indicator (visual only) */}
        <div
          aria-hidden={!refreshing}
          role={refreshing ? "status" : undefined}
          style={{
            height: refreshing ? 36 : pull,
            flexShrink: 0,
            display: pull > 0 || refreshing ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            overflow: "hidden",
            transition: pull === 0 && !refreshing ? "height 220ms ease" : "none",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 22,
              color: "#6D52F8",
              transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
              opacity: refreshing ? 1 : Math.min(1, pull / PULL_THRESHOLD),
              animation: refreshing ? "koru-spin 1s linear infinite" : undefined,
            }}
          >
            {refreshing || pull >= PULL_THRESHOLD ? "autorenew" : "progress_activity"}
          </span>
          {refreshing && (
            <span style={{ fontSize: 12, color: "#6b5f8c", fontWeight: 600 }}>
              Actualizando el clima…
            </span>
          )}
        </div>

        {/* Sticky header — Koru brand + saludo + buscar + hablar */}
        <header className="koru-detail-sticky-head">
          <button
            type="button"
            aria-label="Hablar con Michi"
            className="koru-detail-sticky-back"
            onClick={onTalk}
          >
            <span className="material-symbols-outlined">graphic_eq</span>
          </button>
          <div className="koru-detail-mini-icon" style={brandIconStyle}>
            <MichiCat size={40} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span className="koru-detail-mini-title">Michi</span>
            {/* 🔴 FIX: el saludo "Buenos días, {name}" estaba DUPLICADO en el
                mismo viewport (header + hero, a ~100px). El saludo vive solo en
                el hero; aquí un subtítulo descriptivo. */}
            <span className="koru-detail-mini-sub">Tu día de un vistazo</span>
          </div>
          <button
            type="button"
            aria-label="Buscar"
            className="koru-detail-sticky-back"
            onClick={onSearch}
          >
            <span className="material-symbols-outlined">search</span>
          </button>
        </header>

        <div className="koru-roadmap-modules">
          {/* ── Hero de saludo ─────────────────────────────────────────────── */}
          <section
            className="koru-plan-hero mw-today-hero is-tappable"
            onClick={onTalk}
            role="button"
            tabIndex={0}
            aria-label={`Hablar con Michi — ${greeting}${name ? ", " + name : ""}`}
            onKeyDown={(e) => {
              // 🔴 FIX a11y: role=button sin onKeyDown no respondía a Enter/Espacio.
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTalk();
              }
            }}
          >
            <div className="koru-plan-hero-top">
              <div className="koru-plan-hero-copy">
                <p className="koru-plan-hero-kicker">Hoy · {todayLong}</p>
                <h2 className="koru-plan-hero-title">
                  {greeting}
                  {name ? `, ${name}` : ""}
                </h2>
                <p className="koru-plan-hero-desc">
                  {(() => {
                    // 🔴 FIX: antes mostraba "Tienes 0 eventos y 3 deadlines" con
                    // ceros literales y "deadline" sin traducir. Ahora arma la
                    // frase solo con las categorías con datos, en español.
                    const parts: string[] = [];
                    if (eventsToday.length > 0) {
                      parts.push(`${eventsToday.length} evento${eventsToday.length === 1 ? "" : "s"}`);
                    }
                    if (deadlinesToday.length > 0) {
                      parts.push(`${deadlinesToday.length} vencimiento${deadlinesToday.length === 1 ? "" : "s"}`);
                    }
                    if (parts.length === 0) {
                      return <>Tu día está despejado. Cuéntale a Michi qué quieres hacer hoy.</>;
                    }
                    return <>Tienes <b>{parts.join(" y ")}</b> hoy.</>;
                  })()}
                </p>
              </div>
              <MichiCat className="mx-today-cat" size={88} sparkle />
            </div>
          </section>

          {/* ── Quick actions row ───────────────────────────────────────────── */}
          <section className="mw-quick-actions" aria-label="A mano con Michi">
            <QuickAction icon="add_circle" label="Crear" onClick={onCreate} />
            <QuickAction icon="search" label="Buscar" onClick={onSearch} />
            {onOpenCollections && (
              <QuickAction icon="bookmarks" label="Guardados" onClick={onOpenCollections} />
            )}
            <QuickAction
              icon="graphic_eq"
              label="Hablar con Michi"
              onClick={onTalk}
              highlight
            />
          </section>

          {/* ── Items del día (2x2) ─────────────────────────────────────────── */}
          <section className="koru-magical-card" style={{ padding: 18 }}>
            <div className="koru-module-head" style={{ marginBottom: 12 }}>
              <div className="koru-module-id">
                <div
                  className="koru-module-icon"
                  style={
                    {
                      "--module-color": "#5940E0",
                      "--module-bg": "#ece8ff",
                    } as CSSProperties
                  }
                >
                  <WorldObject kind="today" />
                </div>
                <div>
                  <h3 className="koru-module-title">Tu día, a tu ritmo</h3>
                  <p className="koru-module-kicker">PEQUEÑOS PASOS, GRAN DÍA</p>
                </div>
              </div>
            </div>
            <div style={grid2Style}>
              <ItemTile
                icon="event"
                label="Eventos hoy"
                value={eventsToday.length}
                accent="#5940E0"
                soft="#ece8ff"
                // 🔴 FIX: antes navegaba a HISTORIAL (log de actividad, no la
                // agenda). Ahora baja al Calendario del día; sin eventos, te
                // deja hablar con Koru para agendar algo.
                onClick={() => {
                  if (eventsToday.length > 0) scrollTo(calendarRef);
                  else onTalk();
                }}
              />
              <ItemTile
                icon="task_alt"
                label="Vencimientos hoy"
                value={deadlinesToday.length}
                accent="#FF4D54"
                soft="#ffe7e1"
                // 🔴 FIX: antes abría el chat SIN contexto (había que
                // preguntarle a Koru cuáles eran). Ahora baja a Prioridades
                // donde están listados; sin vencimientos, a charlar.
                onClick={() => {
                  if (deadlinesToday.length > 0 || urgente.length + importante.length + rutina.length + opcional.length > 0) scrollTo(prioritiesRef);
                  else onTalk();
                }}
              />
              <ItemTile
                icon="water_drop"
                label="Hidratación"
                value={waterMl}
                suffix={`/ ${HYDRATION_GOAL_ML}ml`}
                pct={waterPct}
                accent="#3a8dde"
                soft="#e3f0ff"
                // 🔴 TIER S: tapping the water tile logs +250ml via logWellbeing
                // (acumulativo desde el fix del reducer).
                onClick={() => {
                  if (onLogWater) onLogWater(250);
                  else onTalk();
                }}
              />
              <ItemTile
                icon="repeat"
                label="Hábitos"
                value={habitsRemaining.length}
                suffix={habitsRemaining.length === 1 ? " restante" : " restantes"}
                accent="#22a06b"
                soft="#e3f7ed"
                // 🔴 FIX: antes tocar el tile marcaba el PRIMER hábito
                // pendiente en silencio (destructivo sin confirmación). Ahora
                // baja a la lista de Hábitos para elegir cuál completar.
                onClick={() => {
                  if (activeHabits.length > 0) scrollTo(habitsRef);
                  else onTalk();
                }}
              />
            </div>
          </section>

          {/* ── Hábitos de hoy (lista con streak + marcar hecho) ─────────────── */}
          {/* 🔴 TIER S: llama a computeStreak por hábito y a logHabit al tap. */}
          {activeHabits.length > 0 && (
            <section ref={habitsRef} className="koru-magical-card" style={{ padding: 18, scrollMarginTop: 72 }}>
              <div className="koru-module-head" style={{ marginBottom: 12 }}>
                <div className="koru-module-id">
                  <div
                    className="koru-module-icon"
                    style={
                      {
                        "--module-color": "#22a06b",
                        "--module-bg": "#e3f7ed",
                      } as CSSProperties
                    }
                  >
                    <span className="material-symbols-outlined">repeat</span>
                  </div>
                  <div>
                    <h3 className="koru-module-title">Hábitos de hoy</h3>
                    <p className="koru-module-kicker">
                      {habitsRemaining.length} pendiente{habitsRemaining.length === 1 ? "" : "s"} ·{" "}
                      {activeHabits.length - habitsRemaining.length} hecho{activeHabits.length - habitsRemaining.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeHabits.map((h) => {
                  const doneToday = !habitsRemaining.some(r => r.id === h.id);
                  const streak = streakByHabitId[h.id] ?? 0;
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 12,
                        background: doneToday ? "rgba(34, 160, 107, 0.08)" : "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(34, 160, 107, 0.12)",
                      }}
                    >
                      <button
                        type="button"
                        aria-label={doneToday ? `Hábito "${h.label}" completado` : `Marcar hábito "${h.label}" como hecho`}
                        onClick={() => {
                          // 🔴 TIER S: logHabit marca el hábito como hecho hoy.
                          if (onLogHabit && !doneToday) onLogHabit(h.id);
                        }}
                        disabled={doneToday}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          border: "none",
                          background: doneToday ? "#22a06b" : "rgba(34, 160, 107, 0.12)",
                          color: doneToday ? "#fff" : "#22a06b",
                          cursor: doneToday ? "default" : "pointer",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          {doneToday ? "check" : "radio_button_unchecked"}
                        </span>
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1a2e", textDecoration: doneToday ? "line-through" : "none", opacity: doneToday ? 0.7 : 1 }}>
                          {h.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "#6b5f8c" }}>
                          {h.target > 1 ? `Meta: ${h.target} ${h.unit ?? ""}`.trim() : "Diario"}
                          {h.anchorTime ? ` · ${h.anchorTime}` : ""}
                        </p>
                      </div>
                      {/* 🔴 TIER S: streak count (computeStreak ya precomputado en d). */}
                      {streak > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#fff1d6",
                            color: "#92400e",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          🔥 {streak}d
                        </span>
                      )}
                      {/* 🔴 P2 — botón "Pausar" sin perder la racha. El streak
                          se conserva porque HabitLog history no se toca. */}
                      {onPauseHabit && (
                        <button
                          type="button"
                          aria-label={`Pausar hábito "${h.label}" sin perder la racha`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPauseHabit(h.id);
                          }}
                          title="Pausar sin perder racha"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            border: "1px solid rgba(109, 82, 248, 0.18)",
                            background: "rgba(109, 82, 248, 0.08)",
                            color: "#6D52F8",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            pause
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Hábitos pausados (racha conservada) ─────────────────────────── */}
          {/* 🔴 P2: cada hábito pausado se muestra con su racha anterior y un
              botón "Reanudar" que vuelve a active=true. La racha se mantiene
              porque HabitLog history no se resetea al pausar. */}
          {pausedHabits.length > 0 && (
            <section className="koru-magical-card" style={{ padding: 18, opacity: 0.85 }}>
              <div className="koru-module-head" style={{ marginBottom: 12 }}>
                <div className="koru-module-id">
                  <div
                    className="koru-module-icon"
                    style={
                      {
                        "--module-color": "#6D52F8",
                        "--module-bg": "#efe6ff",
                      } as CSSProperties
                    }
                  >
                    <span className="material-symbols-outlined">pause_circle</span>
                  </div>
                  <div>
                    <h3 className="koru-module-title">Pausados</h3>
                    <p className="koru-module-kicker">
                      {pausedHabits.length} hábito{pausedHabits.length === 1 ? "" : "s"} · racha conservada
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pausedHabits.map((h) => {
                  const streak = streakByHabitId[h.id] ?? 0;
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 12,
                        background: "rgba(109, 82, 248, 0.06)",
                        border: "1px dashed rgba(109, 82, 248, 0.25)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 20,
                          color: "#6D52F8",
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          background: "rgba(109, 82, 248, 0.12)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        pause
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
                          {h.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "#6b5f8c" }}>
                          Pausado · la racha sigue activa cuando retomes
                        </p>
                      </div>
                      {streak > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#fff1d6",
                            color: "#92400e",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          🔥 {streak}d
                        </span>
                      )}
                      {onResumeHabit && (
                        <button
                          type="button"
                          aria-label={`Reanudar hábito "${h.label}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onResumeHabit(h.id);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: "none",
                            background: "#6D52F8",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          Reanudar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Calendario del día (horizontal scroller) ─────────────────────── */}
          {eventsToday.length > 0 && (
            <section ref={calendarRef} style={{ scrollMarginTop: 72 }}>
              <div style={sectionHeadStyle}>
                <h3 style={sectionTitleStyle}>Calendario del día</h3>
                <span style={sectionHintStyle}>
                  {eventsToday.length} evento{eventsToday.length === 1 ? "" : "s"}
                </span>
              </div>
              <div style={hscrollStyle} className="koru-cal-strip">
                {eventsToday.map((e) => (
                  <article
                    key={e.id}
                    className="koru-magical-card"
                    style={calCardStyle}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, color: "#5940E0" }}
                      >
                        schedule
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#5940E0" }}>
                        {timeLabel(e.startsAt) || "—"}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3 }}>
                      {e.title}
                    </p>
                    {e.location && (
                      <p
                        style={{
                          fontSize: 11,
                          color: "#6b5f8c",
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          place
                        </span>
                        {e.location}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── Prioridades (4 tiles) ───────────────────────────────────────── */}
          <section ref={prioritiesRef} className="koru-magical-card" style={{ padding: 18, scrollMarginTop: 72 }}>
            <div className="koru-module-head" style={{ marginBottom: 12 }}>
              <div className="koru-module-id">
                <div
                  className="koru-module-icon"
                  style={
                    {
                      "--module-color": "#FF4D54",
                      "--module-bg": "#ffe7e1",
                    } as CSSProperties
                  }
                >
                  <span className="material-symbols-outlined">flag</span>
                </div>
                <div>
                  <h3 className="koru-module-title">Prioridades</h3>
                  <p className="koru-module-kicker">Cuadrantes del día</p>
                </div>
              </div>
            </div>
            <div style={grid2Style}>
              <PriorityTile
                label="Urgente"
                icon="priority_high"
                count={urgente.length}
                accent="#FF4D54"
                soft="#ffe7e1"
              />
              <PriorityTile
                label="Importante"
                icon="bookmark"
                count={importante.length}
                accent="#f0a830"
                soft="#fff1d6"
              />
              <PriorityTile
                label="Rutina"
                icon="repeat"
                count={rutina.length}
                accent="#5940E0"
                soft="#ece8ff"
              />
              <PriorityTile
                label="Opcional"
                icon="more_horiz"
                count={opcional.length}
                accent="#6b5f8c"
                soft="#eee9f5"
              />
            </div>
          </section>

          {/* ── Clima widget ─────────────────────────────────────────────────── */}
          <ClimaWidget state={state} onNavigate={onNavigate} onRefresh={onRefreshWeather} onBusy={refreshing} />

          {/* ── Bienestar: sesiones de meditación ───────────────────────────── */}
          {/* 🔴 P2: tapping a session card opens MeditationOverlay (full-screen,
              z-index 300) con breathing circle + timer countdown. Al cerrar,
              el overlay dispatcha `koru-card-action` con action
              "meditation_complete" y la duración efectiva. */}
          <section className="koru-magical-card" style={{ padding: 18 }}>
            <div className="koru-module-head" style={{ marginBottom: 12 }}>
              <div className="koru-module-id">
                <div
                  className="koru-module-icon"
                  style={
                    {
                      "--module-color": "#6D52F8",
                      "--module-bg": "#efe6ff",
                    } as CSSProperties
                  }
                >
                  <span className="material-symbols-outlined">self_improvement</span>
                </div>
                <div>
                  <h3 className="koru-module-title">Bienestar</h3>
                  <p className="koru-module-kicker">Tomate un respiro</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {MEDITATION_SESSIONS.map((s) => {
                const mins = Math.round((s.durationSec ?? 300) / 60);
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setMeditationSession(s)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(109, 82, 248, 0.14)",
                      background: "linear-gradient(135deg, rgba(239, 230, 255, 0.6), rgba(245, 237, 255, 0.4))",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <span
                      className="material-symbols-outlined animate-breathe"
                      style={{
                        fontSize: 24,
                        color: "#6D52F8",
                        background: "rgba(255, 255, 255, 0.7)",
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {s.icon ?? "self_improvement"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E1B4B" }}>
                        {s.label}
                      </p>
                      {s.description && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b5f8c" }}>
                          {s.description}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: "#fff",
                        color: "#5940E0",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        border: "1px solid rgba(89, 64, 224, 0.12)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                      {mins} min
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Proactive nudges ─────────────────────────────────────────────── */}
          {activeNudges.length > 0 && (
            <section>
              <div style={sectionHeadStyle}>
                <h3 style={sectionTitleStyle}>Michi te sugiere</h3>
                <span style={sectionHintStyle}>
                  {activeNudges.length} nudge{activeNudges.length === 1 ? "" : "s"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeNudges.map((n) => (
                  <NudgeCard
                    key={n.id}
                    nudge={n}
                    onDismiss={onDismissNudge}
                    onAct={onTalk}
                  />
                ))}
              </div>
            </section>
          )}


        </div>
      </div>

      {/* 🔴 P2 — Meditation overlay (full-screen, z-index 300). Se monta cuando
          el usuario elige una sesión en la sección Bienestar. */}
      {meditationSession && (
        <MeditationOverlay
          session={meditationSession}
          onClose={() => setMeditationSession(null)}
        />
      )}
    </div>
  );
}

// 🔴 Default export para React.lazy en App.tsx.
export default HomeScreen;

// ═══════════════════════════════════════════════════════════════════════════
//  Sub-componentes
// ═══════════════════════════════════════════════════════════════════════════

const brandIconStyle: CSSProperties = {
  background: "linear-gradient(135deg, #6D52F8, #5940E0)",
  color: "#fff",
};

const grid2Style: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  margin: "4px 4px 10px",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#1E1B4B",
  margin: 0,
};

const sectionHintStyle: CSSProperties = {
  fontSize: 11,
  color: "#6b5f8c",
};

const hscrollStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  overflowX: "auto",
  paddingBottom: 4,
  scrollbarWidth: "none",
};

const calCardStyle: CSSProperties = {
  padding: 14,
  minWidth: 160,
  flex: "0 0 auto",
  borderRadius: 18,
};

// Gradiente + shadow token de `.koru-magical-card` reaplicado a los tiles
// pequeños (la card original tiene padding 24px, demasiado para un tile 2x2).
const tileBaseStyle: CSSProperties = {
  background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
  border: "1px solid rgba(255, 255, 255, 0.8)",
  borderRadius: 18,
  boxShadow: "0 8px 24px rgba(89, 64, 224, 0.06)",
};

function ItemTile({
  icon,
  label,
  value,
  suffix,
  pct,
  accent,
  soft,
  onClick,
}: {
  icon: string;
  label: string;
  value: number | string;
  suffix?: string;
  pct?: number;
  accent: string;
  soft: string;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      style={{
        ...tileBaseStyle,
        textAlign: "left",
        cursor: interactive ? "pointer" : "default",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: interactive ? 1 : 1,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 22,
          color: accent,
          background: soft,
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>{value}</span>
        {suffix && <span style={{ fontSize: 11, color: "#6b5f8c" }}>{suffix}</span>}
      </div>
      <span style={{ fontSize: 11, color: "#464554", fontWeight: 500 }}>{label}</span>
      {typeof pct === "number" && (
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: soft,
            overflow: "hidden",
            marginTop: 2,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: accent,
              transition: "width 240ms ease",
            }}
          />
        </div>
      )}
    </button>
  );
}

function PriorityTile({
  label,
  icon,
  count,
  accent,
  soft,
}: {
  label: string;
  icon: string;
  count: number;
  accent: string;
  soft: string;
}) {
  return (
    <div
      style={{
        ...tileBaseStyle,
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 20,
          color: accent,
          background: soft,
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "#464554", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e" }}>{count}</span>
      </div>
    </div>
  );
}

function ClimaWidget({
  state,
  onNavigate,
  onRefresh,
  onBusy,
}: {
  state: KoruState;
  onNavigate: (screen: string) => void;
  onRefresh?: () => Promise<boolean> | void;
  onBusy?: boolean;
}) {
  const w = state.weatherCache;
  // 🔴 FIX (2026-09-09): ciudad real del usuario (cache → perfil). Sin ciudad
  // el botón principal es CONFIGURAR (navega a Ajustes), no un refresh no-op.
  const city =
    state.userProfile?.homeCity?.trim() ||
    state.userProfile?.location?.trim() ||
    w?.city?.trim() ||
    "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 🔴 TIER S: considerar el cache "stale" si fetchedAt > 60 min o ausente.
  // Si está stale, mostrar un botón de refresh que llama a onRefresh.
  const isStale = (() => {
    if (!w?.fetchedAt) return true;
    const fetched = new Date(w.fetchedAt).getTime();
    if (Number.isNaN(fetched)) return true;
    return Date.now() - fetched > 60 * 60 * 1000;
  })();

  const doRefresh = async () => {
    if (!onRefresh || busy || onBusy) return;
    setError(null);
    setBusy(true);
    try {
      const ok = await onRefresh();
      // 🔴 Honestidad: si el fetch falló, aviso en vez de dejar el dato viejo
      // mostrado como fresco (que era la queja del refresh placebo).
      if (!ok) setError("No pude actualizar el clima. Prueba de nuevo.");
    } catch {
      setError("No pude actualizar el clima. Prueba de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  if (!w) {
    return (
      <section
        className="koru-magical-card"
        style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 32,
            color: "#6D52F8",
            background: "#ece8ff",
            width: 52,
            height: 52,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          cloud
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>
            {city ? `Clima de ${city}` : "Sin ciudad configurada"}
          </p>
          <p style={{ fontSize: 12, color: "#6b5f8c", marginTop: 2, marginBottom: 0 }}>
            {city ? "Toca traer y lo busco ahora mismo." : "Configura tu ciudad en Ajustes para ver el clima del día."}
          </p>
          {error && (
            <p style={{ fontSize: 12, color: "#b3261e", marginTop: 4, marginBottom: 0, fontWeight: 600 }} role="alert">
              {error}
            </p>
          )}
        </div>
        {/* 🔴 FIX: sin cache PERO con ciudad conocida → fetch real ("Traer
            clima"). Sin ciudad → configurar (antes "Traer clima" era un no-op
            total que no hacía nada visible). */}
        {city && onRefresh ? (
          <button
            type="button"
            disabled={busy || onBusy}
            onClick={() => void doRefresh()}
            style={{
              background: busy ? "#6d70e0" : "#5940E0",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4, animation: busy ? "koru-spin 1s linear infinite" : undefined }}
            >
              refresh
            </span>
            {busy ? "Buscando…" : "Traer clima"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate("configuracion")}
            style={{
              background: "#5940E0",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Configurar ciudad
          </button>
        )}
      </section>
    );
  }

  const today = w.payload.daily?.[0];
  return (
    <section className="koru-magical-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 36,
            color: "#f0a830",
            background: "#fff1d6",
            width: 56,
            height: 56,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          partly_cloudy_day
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, color: "#6b5f8c", fontWeight: 600, margin: 0 }}>
            {w.city}
            {isStale && !busy && !error && (
              <span style={{ marginLeft: 6, color: "#92400e", fontWeight: 700 }}>· dato antiguo</span>
            )}
          </p>
          <p
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#1a1a2e",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {w.payload.now}
          </p>
          <p style={{ fontSize: 12, color: "#464554", marginTop: 2, marginBottom: 0 }}>
            {w.payload.condition}
          </p>
          {error && (
            <p style={{ fontSize: 12, color: "#b3261e", marginTop: 4, marginBottom: 0, fontWeight: 600 }} role="alert">
              {error}
            </p>
          )}
        </div>
        {today && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: "#FF4D54", fontWeight: 700, margin: 0 }}>
              {today.hi}
            </p>
            <p style={{ fontSize: 12, color: "#3a8dde", fontWeight: 700, margin: 0 }}>
              {today.lo}
            </p>
          </div>
        )}
        {/* 🔴 FIX: botón de refresh REAL — visible si el cache está stale
            (>60 min), con spinner mientras busca y error honesto si falla. */}
        {onRefresh && (isStale || busy) && (
          <button
            type="button"
            aria-label="Actualizar clima"
            disabled={busy || onBusy}
            onClick={() => void doRefresh()}
            style={{
              background: "rgba(89, 64, 224, 0.1)",
              color: "#5940E0",
              border: "none",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, animation: busy ? "koru-spin 1s linear infinite" : undefined }}
            >
              refresh
            </span>
            {busy ? "Buscando…" : "Actualizar"}
          </button>
        )}
      </div>
    </section>
  );
}

function NudgeCard({
  nudge,
  onDismiss,
  onAct,
}: {
  nudge: ProactiveNudge;
  onDismiss: (id: string) => void;
  onAct: () => void;
}) {
  const accent =
    nudge.priority === "high" ? "#FF4D54" : nudge.priority === "medium" ? "#f0a830" : "#5940E0";
  const soft =
    nudge.priority === "high" ? "#ffe7e1" : nudge.priority === "medium" ? "#fff1d6" : "#ece8ff";

  return (
    <article className="koru-magical-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 20,
            color: accent,
            background: soft,
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          notifications_active
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>
            {/* 🔴 FIX: nunca renderizar el marcador interno [proactive_shown] */}
            {nudge.title.replace(/^\[proactive_shown\]\s*/i, "")}
          </p>
          {nudge.body && (
            <p
              style={{
                fontSize: 12,
                color: "#464554",
                marginTop: 3,
                marginBottom: 0,
                lineHeight: 1.4,
              }}
            >
              {nudge.body}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={onAct}
              style={{
                background: accent,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Actuar
            </button>
            <button
              type="button"
              onClick={() => onDismiss(nudge.id)}
              style={{
                background: "transparent",
                color: "#6b5f8c",
                border: "1px solid rgba(107, 95, 140, 0.25)",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  highlight,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        flex: 1,
        background: highlight
          ? "linear-gradient(135deg, #6D52F8, #5940E0)"
          : "rgba(255, 255, 255, 0.85)",
        color: highlight ? "#fff" : "#5940E0",
        border: highlight ? "none" : "1px solid rgba(89, 64, 224, 0.15)",
        borderRadius: 16,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        boxShadow: highlight
          ? "0 8px 20px rgba(109, 82, 248, 0.28)"
          : "0 4px 12px rgba(89, 64, 224, 0.05)",
        fontWeight: 700,
        fontSize: 11,
      }}
    >
      {label === "Crear" || label === "Guardados" ? <WorldObject kind={label === "Crear" ? "create" : "memory"} /> : <span className="material-symbols-outlined" style={{ fontSize: 24 }} aria-hidden="true">{icon}</span>}
      {label}
    </button>
  );
}
