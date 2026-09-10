/**
 * ElectInterior — card "Así está la cuenta" (#p-elect), bind real del block
 * `election_results` (title/status/items).
 *
 * El % de escrutinio se parsea del status real (ej. "89% contado") para el
 * anillo. Los items[] REALES arman la barra (width desde su percent) y la
 * leyenda con detalle + bancas derivadas del percent (cap 6). El líder
 * (primer item) lleva el borde de lead. done=false muestra el % aún
 * provisorio. Acción: avísame al 100% → create_commitment REAL.
 */
import { Hourglass, BellRing, Map } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-elect.css";

type ElectBlock = Extract<UiBlock, { type: "election_results" }>;

const RING_C = 144.5; // circunferencia 2π·23

function pctFrom(value?: string): number | null {
  if (!value) return null;
  const m = value.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  return m ? Math.min(100, parseFloat(m[1].replace(",", "."))) : null;
}

function numFrom(percent: string): number {
  return parseFloat(percent.replace("%", "").replace(",", ".")) || 0;
}

export function ElectInterior({ block, onClose, onSave }: LecturaInteriorProps<ElectBlock>) {
  const status = block.status;
  const counted = pctFrom(status);
  const items = (block.items ?? []).slice(0, 5);
  const leader = items[0];
  const title = block.title || "Resultado electoral";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, status) : undefined}
      chip={{ label: "Elecciones", background: "linear-gradient(135deg,#8B6DFF,#6D52F8)" }}
      ariaLabel={title}
    >
      <div id="p-elect" className="lcr-panel">
        <div className="ev-head rv">
          <h1>
            <small>{status || "Escrutinio"}</small>
            {title}
          </h1>
          <p>
            {counted != null
              ? `${counted}% contado. Aún puede moverse, pero ya se ve la forma del resultado.`
              : "Con los datos oficiales que hay hasta ahora."}
          </p>
        </div>

        <div className="el-hero rv">
          {counted != null && (
            <div className="el-progress">
              <div className="ring">
                <svg viewBox="0 0 54 54" aria-hidden="true">
                  <circle cx="27" cy="27" r="23" fill="none" stroke="#eee8f8" strokeWidth="6" />
                  <circle
                    cx="27"
                    cy="27"
                    r="23"
                    fill="none"
                    stroke="#6D52F8"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - counted / 100)}
                  />
                </svg>
                <span className="rv2">{Math.round(counted)}%</span>
              </div>
              <div className="tx">
                <b>{status}</b>
                <span>se actualiza con cada corte · fuente oficial electoral</span>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="el-bar">
              {items.map((it, i) => {
                const pct = numFrom(it.percent);
                return (
                  <i
                    key={`bar_${i}_${it.name}`}
                    className={i === 0 ? "lead" : undefined}
                    style={{ width: `${Math.max(pct, 4)}%`, background: it.color }}
                    aria-label={`${it.name} ${it.percent}`}
                  >
                    {pct >= 10 ? it.percent : ""}
                  </i>
                );
              })}
            </div>
          )}

          <div className="el-legend">
            {items.map((it, i) => {
              const pct = numFrom(it.percent);
              const seats = Math.max(1, Math.min(6, Math.round(pct / 6)));
              return (
                <div className={`el-row${i === 0 ? " win" : ""}`} key={`row_${i}_${it.name}`}>
                  <span className="sw2" style={{ background: it.color }} />
                  <b>
                    {it.name}
                    {it.detail ? <small>{it.detail}</small> : null}
                    {it.done ? null : <small>provisorio</small>}
                  </b>
                  <span className="pv">{it.percent}</span>
                  <span className="seats" aria-label={`${seats} bancas estimadas`}>
                    {Array.from({ length: seats }).map((_, s) => (
                      <i key={`seat_${i}_${s}`} style={{ background: it.color }} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="el-note rv">
          <Ic i={Hourglass} className="ic" />
          <p>
            {leader
              ? `Los números son oficiales pero provisorios: ${
                  leader.done ? "el líder ya superó el piso" : "el líder todavía no cierra"
                }. `
              : "Los números son oficiales pero provisorios. "}
            <b>Te aviso cuando llegue al 100%.</b>
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: "Aviso: escrutinio al 100%",
                dueHint: "cuando el recuento final sea publicado",
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Avísame al 100%
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={Map} className="ic" />
            Cerrar
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
