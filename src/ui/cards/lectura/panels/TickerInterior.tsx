/**
 * TickerInterior — card "Cinta de datos" (#p-ticker), bind real del block
 * `data_ticker`.
 *
 * La cinta corre con los items REALES del block (label + value,
 * duplicados para el loop infinito de la animación CSS). El stat grande
 * es el item con highlight=true (o el primero). block.alert como nota
 * de Koru — solo si existe. El gauge del catálogo era del dominio "cupo":
 * no está en el block → no se dibuja. Acciones: avisame →
 * create_commitment durable con el alert/label real.
 */
import { BellRing, EyeOff, Activity, Sparkles, CircleDot } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-ticker.css";

type TickerBlock = Extract<UiBlock, { type: "data_ticker" }>;
type Tick = NonNullable<TickerBlock["items"]>[number];

export function TickerInterior({ block, onClose, onSave }: LecturaInteriorProps<TickerBlock>) {
  const items = block.items ?? [];
  const tape = [...items, ...items]; // duplicado para el loop translateX(-50%)
  const main = items.find((it) => it.highlight) ?? items[0];
  const label = block.title || "Cinta de datos";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(label, main?.value) : undefined}
      chip={{ label: "Cinta", background: "linear-gradient(135deg,#a5b4fc,#6366f1)" }}
      ariaLabel={label}
    >
      <div id="p-ticker" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--mint-ink)",
                marginBottom: "5px",
              }}
            >
              {label}
            </small>
            {main ? `${main.label}` : "Tu cinta"}
            <br />
            en vivo
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {items.length
              ? `La cinta corre sola con tus ${items.length} datos — solo te aviso${block.alert ? " (alerta activa)" : " si me pedís"}.`
              : "Sin datos en la cinta todavía."}
          </p>
        </div>

        <div className="tt2-hero rv">
          <div className="tt2-tape" aria-hidden="true">
            <span className="lane">
              {tape.map((it: Tick, i) => (
                <span className="tk2" key={`tp_${i}`}>
                  <b>{it.label}</b> {it.value}
                  {it.highlight ? (
                    <span className="up">★</span>
                  ) : null}
                </span>
              ))}
            </span>
          </div>

          {main && (
            <div className="tt2-main">
              <div className="lbl">El que más importa ahora</div>
              <div className="big">
                {main.value}
                <small> {main.label}</small>
              </div>
              <div className="sub">
                {main.highlight ? "marcado como importante por Michi" : `dato 1 de ${items.length} de tu cinta`}
              </div>
              <div className="tt2-gauge">
                <div className="gt">
                  <span>
                    En la cinta: <b>{items.length} datos</b>
                  </span>
                  <span>{items.filter((it) => it.highlight).length} destacados</span>
                </div>
                <div className="tt2-track">
                  <i style={{ width: `${items.length ? Math.round((items.filter((x) => x.highlight).length / items.length) * 100) : 0}%` }} />
                </div>
                <div className="gl">
                  <span>cinta</span>
                  <span>destacados</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tt2-what rv">
          {items.slice(0, 2).map((it, i) => (
            <div className="tt2-w" key={`w_${i}_${it.label}`}>
              <span className="wk2">
                <Ic i={i === 0 ? CircleDot : Activity} className="ic" />
                {it.label}
              </span>
              <b>{it.value}</b>
              <span>{it.highlight ? "destacado por Michi" : "dato de la cinta"}</span>
            </div>
          ))}
        </div>

        {block.alert && (
          <div className="tt2-note rv">
            <Ic i={Sparkles} className="ic" />
            <p>{block.alert}</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!main}
            onClick={() => {
              if (!main) return;
              dispatchCardAction("create_commitment", block, {
                title: `Aviso ${block.title || "cinta"}`,
                dueHint: block.alert || `${main.label} llega a ${main.value}`,
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Avisame si toca
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            <Ic i={EyeOff} className="ic" />
            Cerrar cinta
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
