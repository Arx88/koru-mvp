/**
 * PlanInterior — card "Tu día" del catálogo Lectura Visual (#p-plan),
 * integrada al block real `plan` (AssistantPlanItem[]).
 *
 * Concepto del catálogo: agenda-timeline viva — hero con la cantidad de
 * momentos, timeline con AHORA pulsante en la posición real según la
 * hora, items tappables (toggle real vía koru-card-action toggle_step,
 * crea el Plan durable en el provider), hueco más grande detectado de
 * verdad entre eventos consecutivos.
 */
import { useState } from "react";
import {
  BookOpen,
  Brain,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Clapperboard,
  Flag,
  Flower,
  Footprints,
  Heart,
  House,
  MessageCircle,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-plan.css";

type PlanBlock = Extract<UiBlock, { type: "plan" }>;
type PlanItem = PlanBlock["items"][number];

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "untitled";

function itemIcon(it: PlanItem): LucideIcon {
  switch (it.icon) {
    case "flag": return Flag;
    case "book": return BookOpen;
    case "move": return Footprints;
    case "message": return MessageCircle;
    case "calendar": return Calendar;
    case "money": return Wallet;
    case "heart": return Heart;
    case "home": return House;
  }
  switch (it.mode) {
    case "focus": return Brain;
    case "quick": return Zap;
    case "recovery": return Flower;
  }
  return CalendarCheck;
}

function itemTint(it: PlanItem): { background: string; color: string } {
  switch (it.mode) {
    case "focus": return { background: "var(--mint-soft)", color: "var(--mint-ink)" };
    case "recovery": return { background: "var(--sky-soft)", color: "var(--sky-ink)" };
    case "admin": return { background: "var(--violet-soft)", color: "var(--violet-ink)" };
    case "quick": return { background: "var(--honey-soft)", color: "var(--honey-ink)" };
  }
  return { background: "var(--violet-soft)", color: "var(--violet-ink)" };
}

function toMinutes(time?: string): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2})[:.h](\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const fmtHour = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function PlanInterior({
  block,
  onClose,
  onSave,
  now,
}: LecturaInteriorProps<PlanBlock> & { now?: Date }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const nowMin = (now ?? new Date()).getHours() * 60 + (now ?? new Date()).getMinutes();
  const planId = `plan_${slug(block.title || "plan")}`;

  const items = block.items ?? [];
  const withDone = items.map((it, i) => ({ ...it, done: it.done || !!done[i] }));

  // primer índice futuro (para AHORA y SIGUE)
  const nextIdx = withDone.findIndex((it) => {
    const t = toMinutes(it.time);
    return t != null && t > nowMin;
  });

  // hueco más grande entre eventos consecutivos con hora (≥ 90 min)
  const timed = withDone
    .map((it, i) => ({ i, min: toMinutes(it.time) }))
    .filter((x): x is { i: number; min: number } => x.min != null);
  let gap: { from: number; to: number; minutes: number } | null = null;
  for (let k = 0; k < timed.length - 1; k++) {
    const minutes = timed[k + 1].min - timed[k].min;
    if (minutes >= 90 && (!gap || minutes > gap.minutes)) {
      gap = { from: timed[k].min, to: timed[k + 1].min, minutes };
    }
  }

  const heroTitle = items.length > 0 ? `${items.length} momentos, nada solapado` : "Tu día";
  const when = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric" }).format(now ?? new Date());

  const toggle = (i: number, title: string) => {
    setDone((prev) => ({ ...prev, [i]: !prev[i] }));
    dispatchCardAction("toggle_step", block, {
      planId,
      stepId: `step_${slug(title)}_${i}`,
    });
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title ?? "Tu día", `${items.length} momentos`) : undefined}
      chip={{ label: "Tu día", background: "linear-gradient(135deg,#4BDD8C,#1f7a5c)" }}
      ariaLabel={block.title ?? "Tu día"}
    >
      <div id="p-plan" className="lcr-panel">
        <div className="tl-hero rv">
          <h1>
            <small>{when} · tus bloques</small>
            {heroTitle}
          </h1>
          <p className="sub">
            {block.note ?? "Armado con tus bloques reales — tocá un evento para marcarlo hecho."}
          </p>
        </div>

        <div className="tl rv">
          {withDone.map((it, i) => {
            const Icon = itemIcon(it);
            const tint = itemTint(it);
            const isNext = i === nextIdx;
            return (
              <div key={i}>
                {isNext && (
                  <div className="tl-now">
                    <span className="tt">{fmtHour(nowMin)}</span>
                    <div className="nline"><span className="nl-tag">AHORA</span></div>
                  </div>
                )}
                <div className={`tl-ev ${it.done ? "done" : ""} ${isNext ? "next" : ""}`}>
                  <span className="tt">{it.time ?? "—"}</span>
                  <span className="tdot"></span>
                  <div
                    className="tcard"
                    role="button"
                    tabIndex={0}
                    aria-pressed={it.done}
                    aria-label={`Marcar ${it.title}`}
                    onClick={() => toggle(i, it.title)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(i, it.title); }}
                  >
                    <div className="th">
                      <div className="tic" style={tint}><Ic i={Icon} className="ic" /></div>
                      {it.title}
                      {isNext && <span className="next-tag">SIGUE</span>}
                    </div>
                    {(it.detail ?? it.rationale ?? it.timeEstimate) && (
                      <div className="td">{it.detail ?? it.rationale ?? it.timeEstimate}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {nextIdx === -1 && items.length > 0 && (
            <div className="tl-now">
              <span className="tt">{fmtHour(nowMin)}</span>
              <div className="nline"><span className="nl-tag">AHORA</span></div>
            </div>
          )}
        </div>

        {gap && (
          <div className="tl-gap rv">
            <div className="gic"><Ic i={Flower} className="ic ic-sway" /></div>
            <div>
              <h5>El hueco de {fmtHour(gap.from)} a {fmtHour(gap.to)} es tuyo</h5>
              <p>{Math.round(gap.minutes / 60)} h libres — si querés lo dejo así, o te sugiero algo liviano.</p>
            </div>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => (onSave ? onSave(block.title ?? "Tu día", `${items.length} momentos`) : onClose())}
          >
            <Ic i={CalendarCheck} className="ic" />Se ve bien
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            <Ic i={CalendarDays} className="ic" />Mover algo
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
