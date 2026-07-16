import { useMemo, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import type { KoruState, ProactiveNudge } from "../domain/types";

// ═══════════════════════════════════════════════════════════════════════════
//  Home dashboard — pantalla "Hoy" del wheel de navegación.
//  Muestra el día de un vistazo: saludo temporal, items del día (2x2),
//  calendario horizontal, prioridades, clima, nudges proactivos y
//  acciones rápidas. Reutiliza los tokens visuales Stitch:
//    • `.koru-roadmap` + `.koru-roadmap-screen` → fondo difuminado + 430px
//    • `.koru-detail-sticky-head` → header sticky con blur
//    • `.koru-plan-hero` → hero de saludo
//    • `.koru-magical-card` → tiles con gradiente + shadow tokens
// ═══════════════════════════════════════════════════════════════════════════

export interface HomeScreenProps {
  state: KoruState;
  onNavigate: (screen: string) => void;
  onCreate: () => void;
  onSearch: () => void;
  onTalk: () => void;
  onDismissNudge: (nudgeId: string) => void;
}

const HYDRATION_GOAL_ML = 2000;
const PULL_THRESHOLD = 64;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
}: HomeScreenProps) {
  // ── Pull-to-refresh (visual indicator only — no refresh logic) ────────────
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

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
    touchStartY.current = null;
    // Visual indicator only — snap back without refreshing.
    setPull(0);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const d = useMemo(() => {
    const today = todayISO();
    const hour = new Date().getHours();
    const greeting = greetingFor(hour);
    const name = state.userProfile?.name || state.userName || "";

    const eventsToday = (state.calendarEvents ?? []).filter((e) =>
      e.startsAt?.startsWith(today),
    );

    const deadlinesToday = (state.commitments ?? []).filter(
      (c) => c.status === "open" && c.dueAt?.startsWith(today),
    );

    const waterLogs = (state.wellbeingLogs ?? []).filter(
      (l) => l.date === today && l.metric === "water",
    );
    const waterMl = waterLogs.reduce((sum, l) => sum + (l.value || 0), 0);

    const habits = state.habits ?? [];
    const habitLogsToday = state.habitLogs ?? [];
    const activeHabits = habits.filter((h) => h.active);
    const habitsRemaining = activeHabits.filter(
      (h) => !habitLogsToday.some((l) => l.habitId === h.id && l.date === today),
    );

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
    const importante = openCommitments.filter((c) => {
      if (!c.dueAt) return false;
      const due = new Date(c.dueAt).getTime();
      if (Number.isNaN(due)) return false;
      return due > now + DAY_MS && due <= now + 3 * DAY_MS;
    });
    const rutina = openCommitments.filter((c) => !!c.recurrence);
    const opcional = openCommitments.filter((c) => !c.dueAt && !c.recurrence);

    const activeNudges = (state.nudges ?? []).filter((n) => !n.dismissed);

    return {
      today,
      greeting,
      name,
      eventsToday,
      deadlinesToday,
      waterMl,
      habitsRemaining,
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
    <div className="koru-roadmap" role="region" aria-label="Hoy — Koru">
      <div
        ref={scrollerRef}
        className="koru-roadmap-screen"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ overscrollBehaviorY: "contain" }}
      >
        {/* Blobs decorativos Stitch */}
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        {/* Pull-to-refresh indicator (visual only) */}
        <div
          aria-hidden
          style={{
            height: pull,
            flexShrink: 0,
            display: pull > 0 ? "flex" : "none",
            alignItems: "flex-end",
            justifyContent: "center",
            overflow: "hidden",
            transition: pull === 0 ? "height 220ms ease" : "none",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 22,
              color: "#8363f9",
              transform: `rotate(${pull * 3}deg)`,
              opacity: Math.min(1, pull / PULL_THRESHOLD),
              marginBottom: 6,
            }}
          >
            {pull >= PULL_THRESHOLD ? "autorenew" : "progress_activity"}
          </span>
        </div>

        {/* Sticky header — Koru brand + saludo + buscar + hablar */}
        <header className="koru-detail-sticky-head">
          <button
            type="button"
            aria-label="Hablar con Koru"
            className="koru-detail-sticky-back"
            onClick={onTalk}
          >
            <span className="material-symbols-outlined">graphic_eq</span>
          </button>
          <div className="koru-detail-mini-icon" style={brandIconStyle}>
            <span className="material-symbols-outlined">eco</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span className="koru-detail-mini-title">Koru</span>
            <span className="koru-detail-mini-sub">
              {greeting}
              {name ? `, ${name}` : ""}
            </span>
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
            className="koru-plan-hero is-tappable"
            onClick={onTalk}
            role="button"
            tabIndex={0}
          >
            <div className="koru-plan-hero-top">
              <div className="koru-plan-hero-copy">
                <p className="koru-plan-hero-kicker">Hoy · {todayLong}</p>
                <h2 className="koru-plan-hero-title">
                  {greeting}
                  {name ? `, ${name}` : ""}
                </h2>
                <p className="koru-plan-hero-desc">
                  {eventsToday.length > 0 || deadlinesToday.length > 0 ? (
                    <>
                      Tenés <b>{eventsToday.length}</b>{" "}
                      evento{eventsToday.length === 1 ? "" : "s"} y{" "}
                      <b>{deadlinesToday.length}</b>{" "}
                      deadline{deadlinesToday.length === 1 ? "" : "s"} hoy.
                    </>
                  ) : (
                    <>Tu día está despejado. Contale a Koru qué querés hacer hoy.</>
                  )}
                </p>
              </div>
              <div
                className="koru-plan-hero-art"
                style={{
                  background: "linear-gradient(135deg, #f0dbff, #d4b8ff)",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 24,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 56, color: "#4648d4" }}
                >
                  eco
                </span>
              </div>
            </div>
          </section>

          {/* ── Items del día (2x2) ─────────────────────────────────────────── */}
          <section className="koru-magical-card" style={{ padding: 18 }}>
            <div className="koru-module-head" style={{ marginBottom: 12 }}>
              <div className="koru-module-id">
                <div
                  className="koru-module-icon"
                  style={
                    {
                      "--module-color": "#4648d4",
                      "--module-bg": "#ece8ff",
                    } as CSSProperties
                  }
                >
                  <span className="material-symbols-outlined">today</span>
                </div>
                <div>
                  <h3 className="koru-module-title">Items del día</h3>
                  <p className="koru-module-kicker">Lo que manda hoy</p>
                </div>
              </div>
            </div>
            <div style={grid2Style}>
              <ItemTile
                icon="event"
                label="Eventos hoy"
                value={eventsToday.length}
                accent="#4648d4"
                soft="#ece8ff"
                onClick={() => onNavigate("historial")}
              />
              <ItemTile
                icon="task_alt"
                label="Deadlines hoy"
                value={deadlinesToday.length}
                accent="#e8593c"
                soft="#ffe7e1"
                onClick={onTalk}
              />
              <ItemTile
                icon="water_drop"
                label="Hidratación"
                value={waterMl}
                suffix={`/ ${HYDRATION_GOAL_ML}ml`}
                pct={waterPct}
                accent="#3a8dde"
                soft="#e3f0ff"
                onClick={onTalk}
              />
              <ItemTile
                icon="repeat"
                label="Hábitos"
                value={habitsRemaining.length}
                suffix={habitsRemaining.length === 1 ? " restante" : " restantes"}
                accent="#22a06b"
                soft="#e3f7ed"
                onClick={onTalk}
              />
            </div>
          </section>

          {/* ── Calendario del día (horizontal scroller) ─────────────────────── */}
          {eventsToday.length > 0 && (
            <section>
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
                        style={{ fontSize: 16, color: "#4648d4" }}
                      >
                        schedule
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#4648d4" }}>
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
          <section className="koru-magical-card" style={{ padding: 18 }}>
            <div className="koru-module-head" style={{ marginBottom: 12 }}>
              <div className="koru-module-id">
                <div
                  className="koru-module-icon"
                  style={
                    {
                      "--module-color": "#e8593c",
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
                accent="#e8593c"
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
                accent="#4648d4"
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
          <ClimaWidget state={state} onNavigate={onNavigate} />

          {/* ── Proactive nudges ─────────────────────────────────────────────── */}
          {activeNudges.length > 0 && (
            <section>
              <div style={sectionHeadStyle}>
                <h3 style={sectionTitleStyle}>Koru te sugiere</h3>
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

          {/* ── Quick actions row ───────────────────────────────────────────── */}
          <section style={{ display: "flex", gap: 10, paddingBottom: 32 }}>
            <QuickAction icon="add_circle" label="Crear" onClick={onCreate} />
            <QuickAction icon="search" label="Buscar" onClick={onSearch} />
            <QuickAction
              icon="graphic_eq"
              label="Hablar con Koru"
              onClick={onTalk}
              highlight
            />
          </section>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sub-componentes
// ═══════════════════════════════════════════════════════════════════════════

const brandIconStyle: CSSProperties = {
  background: "linear-gradient(135deg, #8363f9, #4648d4)",
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
  color: "#382b8c",
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
  boxShadow: "0 8px 24px rgba(130, 39, 207, 0.06)",
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
}: {
  state: KoruState;
  onNavigate: (screen: string) => void;
}) {
  const w = state.weatherCache;

  if (!w) {
    return (
      <section
        className="koru-magical-card"
        style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 32,
            color: "#8363f9",
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
            Sin ciudad configurada
          </p>
          <p style={{ fontSize: 12, color: "#6b5f8c", marginTop: 2, marginBottom: 0 }}>
            Configurá tu ciudad para ver el clima del día.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("configuracion")}
          style={{
            background: "#4648d4",
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
        </div>
        {today && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: "#e8593c", fontWeight: 700, margin: 0 }}>
              {today.hi}
            </p>
            <p style={{ fontSize: 12, color: "#3a8dde", fontWeight: 700, margin: 0 }}>
              {today.lo}
            </p>
          </div>
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
    nudge.priority === "high" ? "#e8593c" : nudge.priority === "medium" ? "#f0a830" : "#4648d4";
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
            {nudge.title}
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
      onClick={onClick}
      style={{
        flex: 1,
        background: highlight
          ? "linear-gradient(135deg, #8363f9, #4648d4)"
          : "rgba(255, 255, 255, 0.85)",
        color: highlight ? "#fff" : "#4648d4",
        border: highlight ? "none" : "1px solid rgba(70, 72, 212, 0.15)",
        borderRadius: 16,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        boxShadow: highlight
          ? "0 8px 20px rgba(131, 99, 249, 0.28)"
          : "0 4px 12px rgba(130, 39, 207, 0.05)",
        fontWeight: 700,
        fontSize: 11,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
