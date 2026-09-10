/**
 * SocialInterior — card "El evento de la semana" (#p-social), bind real del
 * block `social_interaction` (name/event/date/age/remaining/gifts).
 *
 * Header desde name+event; remaining como chip del calendario. El día
 * marcado del calendario se deriva del número dentro de block.date (si es
 * parseable — sino va sin marca). Facts reales: cuándo (date), edad (age)
 * y falta (remaining). Los gifts[] REALES como opciones de regalo con su
 * emoji — el primero lleva ELEGIDO. Sin gifts no se inventan ideas.
 * Acción: confirmar → complete (el compromiso del evento).
 */
import { Cake, Clock, Users, Gift, CalendarCheck, PartyPopper } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-social.css";

type SocialBlock = Extract<UiBlock, { type: "social_interaction" }>;

/** "sábado 12 · 21:00" | "12 de septiembre" → 12 | null */
function dayFromDate(date?: string): number | null {
  if (!date) return null;
  const m = date.match(/\b(\d{1,2})\b/);
  return m ? Number(m[1]) : null;
}

export function SocialInterior({ block, onClose, onSave }: LecturaInteriorProps<SocialBlock>) {
  const name = block.name || "alguien especial";
  const event = block.event || "evento";
  const date = block.date;
  const day = dayFromDate(date);
  const gifts = block.gifts ?? [];

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`El ${event} de ${name}`, date) : undefined}
      chip={{ label: "Evento", background: "linear-gradient(135deg,#FF9EBE,#FF5A60)" }}
      ariaLabel={`El ${event} de ${name}`}
    >
      <div id="p-social" className="lcr-panel">
        <div className="ev-head rv">
          <h1>
            <small>El {event} que viene</small>
            El {event}
            <br />
            de {name}
          </h1>
          <p>
            {date ? `Guardé la fecha (${date})` : "Guardé el evento"}
            {block.remaining ? ` — faltan ${block.remaining}` : ""}.
            {gifts.length ? " Y la idea de regalo que dejaste anotada." : ""}
          </p>
        </div>

        <div className="ev-cal rv">
          <div className="cal-top">
            <span className="mo">{date ?? "fecha por confirmar"}</span>
            {block.remaining && (
              <span className="cd">
                <Ic i={Cake} className="ic" style={{ fontSize: "13px" }} />
                en {block.remaining}
              </span>
            )}
          </div>
          <div className="cal-grid">
            <span className="dw">L</span><span className="dw">M</span><span className="dw">X</span>
            <span className="dw">J</span><span className="dw">V</span><span className="dw">S</span><span className="dw">D</span>
            {Array.from({ length: 31 }).map((_, i) => {
              const d = i + 1;
              const isEvent = day === d;
              return (
                <span key={`dd_${d}`} className={`dd${isEvent ? " big" : ""}`}>
                  {d}
                </span>
              );
            })}
          </div>
        </div>

        <div className="ev-facts rv">
          {date && (
            <div className="ev-fact">
              <div className="fk">
                <Ic i={Clock} className="ic" />
                Cuándo
              </div>
              <div className="fv">{date}</div>
              <div className="fs">{block.remaining ? `faltan ${block.remaining}` : "fecha guardada"}</div>
            </div>
          )}
          {block.age && (
            <div className="ev-fact">
              <div className="fk">
                <Ic i={Cake} className="ic" />
                La edad
              </div>
              <div className="fv">{block.age}</div>
              <div className="fs">los que cumple {name}</div>
            </div>
          )}
          {gifts.length > 0 && (
            <div className="ev-fact wide">
              <Ic i={Users} className="ic big" />
              <div className="fv">
                {gifts.length} {gifts.length === 1 ? "idea de regalo" : "ideas de regalo"}
              </div>
              <div className="fk" style={{ margin: 0, color: "var(--pink-ink)" }}>
                guardadas en tu bóveda
              </div>
            </div>
          )}
        </div>

        {gifts.length > 0 && (
          <div className="ev-gift rv">
            <h4>
              <Ic i={Gift} className="ic" />
              Las ideas que tenías pensadas
            </h4>
            {gifts.map((g, i) => (
              <div className={`gopt${i === 0 ? " win" : ""}`} key={`gift_${i}_${g.title}`}>
                <div className="gic" style={{ background: i === 0 ? "var(--mint-soft)" : "var(--paper3)" }}>
                  <span style={{ fontSize: 17, lineHeight: 1 }}>{g.emoji}</span>
                </div>
                <div className="gt">
                  <b>{g.title}</b>
                  <span>{g.detail}</span>
                </div>
                {i === 0 && <span className="gtag">ELEGIDO</span>}
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={CalendarCheck} className="ic" />
            Confirmo que voy
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(`El ${event} de ${name}`, date) : onClose())}>
            <Ic i={PartyPopper} className="ic" />
            Guardar evento
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
