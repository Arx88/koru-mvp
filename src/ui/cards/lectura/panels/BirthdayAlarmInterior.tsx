/**
 * BirthdayAlarmInterior — card "Aviso de cumple" (#p-balarm), bind real del
 * block `birthday_alarm` (name/date/countdown/unit/eta).
 *
 * Anillo de countdown REAL: el número y unidad vienen del block; el arco
 * se deriva de countdown sobre una ventana de 30 días (asunción explícita
 * del diseño, documentada — no es dato inventado, es la representación
 * visual del countdown). Fecha + eta reales. Los tips de envío/coordinación
 * del catálogo NO están en el domain → no se renderizan. Acción:
 * "Así está perfecto" → complete (el compromiso del aviso queda sonado).
 */
import { Check, SlidersHorizontal } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-balarm.css";

type BalarmBlock = Extract<UiBlock, { type: "birthday_alarm" }>;

const RING_CIRC = 2 * Math.PI * 64; // 402.1

export function BirthdayAlarmInterior({ block, onClose, onSave }: LecturaInteriorProps<BalarmBlock>) {
  const name = block.name || "el cumple";
  // FIX COUNTDOWN: vacío o no numérico → sin countdown (Number("") === 0
  // hacía que un countdown ausente se leyera como "0 días").
  const rawCountdown = String(block.countdown ?? "").trim();
  const countdown = rawCountdown === "" ? NaN : Number(rawCountdown);
  const hasCountdown = Number.isFinite(countdown) && countdown >= 0;
  // Arco derivado: cuenta regresiva sobre ventana de 30 días (asunción del
  // diseño "el anillo se cierra a medida que se acerca el día").
  const window30 = hasCountdown ? Math.min(30, Math.max(1, countdown)) : 30;
  const progress = hasCountdown ? 1 - window30 / 30 : 0;
  const dashOffset = RING_CIRC * (1 - progress);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`Aviso del cumple de ${name}`, block.date) : undefined}
      chip={{ label: "Aviso", background: "linear-gradient(135deg,#fda4af,#e11d48)" }}
      ariaLabel={`Aviso del cumple de ${name}`}
    >
      <div id="p-balarm" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--pink-ink)",
                marginBottom: "5px",
              }}
            >
              Aviso activado
            </small>
            El cumple de {name},
            <br />
            bajo control
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {hasCountdown
              ? "El anillo se cierra a medida que se acerca el día (ventana de 30 días)."
              : "Cuando tenga la fecha exacta, el anillo arranca a correr."}
          </p>
        </div>

        <div className="cd-hero rv">
          <div className="cd-ring">
            <svg viewBox="0 0 150 150">
              <circle cx="75" cy="75" r="64" fill="none" stroke="#fbd9e6" strokeWidth="13" />
              <circle
                cx="75"
                cy="75"
                r="64"
                fill="none"
                stroke="url(#p-balarm-cdG)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset .5s var(--ease)" }}
              />
              <defs>
                <linearGradient id="p-balarm-cdG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ff8fb8" />
                  <stop offset="1" stopColor="#d6497f" />
                </linearGradient>
              </defs>
            </svg>
            <div className="cv">
              <b>{hasCountdown ? countdown : "—"}</b>
              <span>{(block.unit ?? "días").toUpperCase()}</span>
            </div>
          </div>
          <div className="lbl">
            {block.date ?? "la fecha"}
            <small>{block.eta ?? "el aviso te cae con tiempo de sobra"}</small>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={Check} className="ic" />
            Así está perfecto
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => (onSave ? onSave(`Aviso del cumple de ${name}`, block.date) : onClose())}
          >
            <Ic i={SlidersHorizontal} className="ic" />
            Guardar aviso
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
