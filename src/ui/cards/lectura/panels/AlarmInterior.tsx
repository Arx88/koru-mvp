/**
 * AlarmInterior — card "Alarma creada" (#p-alarm), bind real del block `alarm`.
 *
 * Reloj de pared con agujas REALES derivadas de block.time (hora, minutos)
 * y segundos vivos (tick por segundo). Repetición → días encendidos
 * derivados del texto de block.repeat (lunes a viernes / todos los días /
 * días sueltos). Nota de Koru solo si block.note existe (nada inventado).
 * Acciones legítimas: complete (marca el commitment como sonado) y snooze
 * (reagenda via snoozeCommitment) — mismo contrato que la card compacta.
 */
import { useEffect, useState } from "react";
import { AlarmClock, Brain, CheckCheck, SlidersHorizontal } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-alarm.css";

type AlarmBlock = Extract<UiBlock, { type: "alarm" }>;

/** "07:00" | "7:30 am" | "19:05" → {h24, m} | null */
function parseHHMM(raw?: string): { h: number; m: number } | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s*[:h.]\s*(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/** Texto de repetición → [L,M,X,J,V,S,D] encendidos. */
function repeatDays(repeat?: string): boolean[] {
  const none = [false, false, false, false, false, false, false];
  const r = (repeat ?? "").toLowerCase();
  if (!r.trim()) return none;
  if (/(todos|diario|daily|todos los d)/.test(r)) return [true, true, true, true, true, true, true];
  if (/(lunes a viernes|semana|weekday|laborable)/.test(r)) return [true, true, true, true, true, false, false];
  if (/(fin de semana|weekend|s[áa]bado y domingo)/.test(r)) return [false, false, false, false, false, true, true];
  const days = [...none];
  const names: Array<[RegExp, number]> = [
    [/lunes|\blun\b|\bmon\b/, 0],
    [/martes|\bmar\b|\btue\b/, 1],
    [/mi[ée]rcoles|\bmi[ée]\b|\bwed\b/, 2],
    [/jueves|\bjue\b|\bthu\b/, 3],
    [/viernes|\bvie\b|\bfri\b/, 4],
    [/s[áa]bado|\bs[áa]b\b|\bsat\b/, 5],
    [/domingo|\bdom\b|\bsun\b/, 6],
  ];
  let any = false;
  for (const [re, i] of names) {
    if (re.test(r)) {
      days[i] = true;
      any = true;
    }
  }
  return any ? days : none;
}

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

export function AlarmInterior({ block, onClose, onSave }: LecturaInteriorProps<AlarmBlock>) {
  const parsed = parseHHMM(block.time) ?? parseHHMM(block.title);
  const [now, setNow] = useState(() => new Date());

  // Segundos vivos del reloj — un tick por segundo.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = parsed?.h ?? 7;
  const m = parsed?.m ?? 0;
  const hourDeg = ((h % 12) + m / 60) * 30;
  const minDeg = m * 6;
  const secDeg = now.getSeconds() * 6;
  const days = repeatDays(block.repeat);
  const ampm = h < 12 ? "AM" : "PM";
  const time12 = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || time12, block.repeat) : undefined}
      chip={{ label: "Alarma", background: "linear-gradient(135deg,#FFD75E,#FDC533)" }}
      ariaLabel={block.title || `Alarma ${time12}`}
    >
      <div id="p-alarm" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--honey-ink)",
                marginBottom: "5px",
              }}
            >
              Alarma creada
            </small>
            {block.title || "Tu alarma"}
            <br />
            suena a las {time12}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            Ya quedó activa. {block.repeat ? `Repite ${block.repeat.toLowerCase()}.` : "Es por única vez."}
          </p>
        </div>

        <div className="cl-hero rv">
          <div className="cl-face" role="img" aria-label={`Reloj marcando las ${time12}`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className={`tick${i % 3 === 0 ? " big" : ""}`}
                style={{ transform: `rotate(${i * 30}deg) translateX(-50%)` }}
              />
            ))}
            <span
              className="h"
              style={{ transform: `translateX(-50%) rotate(${hourDeg}deg)` }}
            />
            <span
              className="m"
              style={{ transform: `translateX(-50%) rotate(${minDeg}deg)` }}
            />
            <span
              className="s"
              style={{ transform: `translateX(-50%) rotate(${secDeg}deg)` }}
            />
            <span className="cap" />
            <span className="ampm">{ampm}</span>
          </div>
          <div className="lbl">
            <Ic i={AlarmClock} className="ic" />
            {block.title || `Alarma ${time12}`}
          </div>
          <div className="cl-days">
            {DAY_LETTERS.map((d, i) => (
              <span key={d} className={days[i] ? "on" : undefined}>
                {d}
              </span>
            ))}
          </div>
          <div className="sub2">{block.repeat ? `Repite: ${block.repeat}` : "Suena 1 vez · vibración suave"}</div>
        </div>

        {block.note && (
          <div className="cl-note rv">
            <div className="nic">
              <Ic i={Brain} className="ic" />
            </div>
            <div className="nt">
              <b>La nota de Koru</b>
              <span>{block.note}</span>
            </div>
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
            <Ic i={CheckCheck} className="ic" />
            Perfecto, ya sonó
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              dispatchCardAction("snooze", block, { minutes: 10 });
              onClose();
            }}
          >
            <Ic i={SlidersHorizontal} className="ic" />
            Dormir 10 min más
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
