/**
 * BirthdayCalendarInterior — card "Calendario de cumples" (#p-bcal), bind
 * real del block `birthday_calendar` (month/highlightedDay/startDay/
 * daysInMonth).
 *
 * La grilla se construye REAL: daysInMonth celdas, startDay como offset
 * (1=L), highlightedDay con el punto de cumple. "Hoy" se marca solo si
 * el mes del block coincide con el mes en curso (derivado del reloj, no
 * inventado). El dominio no trae personas ni notas de regalos → la
 * leyenda muestra el día marcado, sin nombres inventados. Acción:
 * activar aviso → create_commitment durable.
 */
import { CalendarDays, User, Gift, BellRing, PartyPopper } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-bcal.css";

type BcalBlock = Extract<UiBlock, { type: "birthday_calendar" }>;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function BirthdayCalendarInterior({ block, onClose, onSave }: LecturaInteriorProps<BcalBlock>) {
  const daysInMonth = block.daysInMonth ?? 30;
  const startDay = Math.min(7, Math.max(1, block.startDay ?? 1)); // 1 = lunes
  const highlightedDay = block.highlightedDay;
  const month = block.month ?? "este mes";

  const now = new Date();
  const monthMatches = MONTHS[now.getMonth()] === month.toLowerCase();
  const today = monthMatches ? now.getDate() : null;

  const cells: Array<{ day: number | null; sat: boolean }> = [];
  for (let i = 1; i < startDay; i++) cells.push({ day: null, sat: i % 7 === 6 });
  for (let d = 1; d <= daysInMonth; d++) {
    const col = (startDay - 1 + d - 1) % 7; // 0=L … 6=D
    cells.push({ day: d, sat: col === 5 || col === 6 });
  }

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`Cumples de ${month}`, highlightedDay ? `día ${highlightedDay}` : undefined) : undefined}
      chip={{ label: "Cumples", background: "linear-gradient(135deg,#fda4af,#e11d48)" }}
      ariaLabel={`Calendario de cumpleaños de ${month}`}
    >
      <div id="p-bcal" className="lcr-panel">
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
              {month}
              {highlightedDay ? ` · día ${highlightedDay}` : ""}
            </small>
            La fecha marcada,
            <br />
            cero olvidos
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {highlightedDay
              ? `El ${highlightedDay} de ${month.toLowerCase()} hay cumple marcado — activá el aviso y lo seguís desde lejos.`
              : "Mes sin fechas marcadas por ahora."}
          </p>
        </div>

        <div className="cal2 rv">
          <div className="cal2-top">
            <span className="mo">
              <Ic i={CalendarDays} className="ic" />
              {month}
            </span>
            <span className="n">{highlightedDay ? "1 cumple" : "sin marcas"}</span>
          </div>
          <div className="cal2-grid">
            <span className="dw2">L</span><span className="dw2">M</span><span className="dw2">X</span>
            <span className="dw2">J</span><span className="dw2">V</span><span className="dw2">S</span><span className="dw2">D</span>
            {cells.map((c, i) => {
              if (c.day == null) return <span key={`pad_${i}`} />;
              const isBday = highlightedDay === c.day;
              const isToday = today === c.day;
              const cls = [
                "day",
                c.sat && !isBday && !isToday ? "sat" : "",
                isToday ? "today" : "",
                isBday ? "bday" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={`d_${c.day}`} className={cls}>
                  {c.day}
                  {isBday && (
                    <span className="dt">
                      <i style={{ background: "var(--pink-ink)" }} />
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {highlightedDay != null && (
          <div className="cal2-legend rv">
            <div className="l">
              <Ic i={User} className="ic" style={{ color: "var(--pink-ink)" }} />
              <div>
                <b>El {highlightedDay} de {month.toLowerCase()}</b>
                <span>{today && highlightedDay >= today ? `en ${Math.max(0, highlightedDay - today)} días` : "fecha marcada del mes"}</span>
              </div>
            </div>
          </div>
        )}

        <div className="cal2-buy rv">
          <Ic i={Gift} className="ic" />
          <p>
            {highlightedDay
              ? `Cuando se acerque el ${highlightedDay} te propongo ideas de regalo con margen para envíos normales.`
              : "Cuando marques fechas, acá van las ideas de regalo con tiempo de sobra."}
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={highlightedDay == null}
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: `Aviso cumple · ${month}`,
                dueHint: `recordame el ${highlightedDay} de ${month.toLowerCase()}`,
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Activar el aviso
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(`Cumples de ${month}`, highlightedDay ? `día ${highlightedDay}` : undefined) : onClose())}>
            <Ic i={PartyPopper} className="ic" />
            Guardar calendario
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
