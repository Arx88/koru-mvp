/**
 * RouteTimelineInterior — card "Cómo llegar" (#p-route), bind real del
 * block `route_timeline` (items: label/detail/color + eta).
 *
 * Legs reales del block: label como título del tramo, detail como nota,
 * color como tinte del icono. Icono por heurística de contenido
 * (caminar/subte/bus/bici/destino) — el domain no trae icono por leg.
 * ETA del block en la caja de llegada. La fecha/hora de llegada se deriva
 * del eta si es parseable. Acción: Empezar → cierra al chat (la guía viva
 * vive en la card de mapa).
 */
import { Footprints, TrainFront, Bus, Bike, Flag, TriangleAlert, Navigation, Route as RouteIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-route.css";

type RouteBlock = Extract<UiBlock, { type: "route_timeline" }>;
type Leg = NonNullable<RouteBlock["items"]>[number];

function legIcon(label: string, isEnd: boolean): LucideIcon {
  const l = (label ?? "").toLowerCase();
  if (isEnd) return Flag;
  if (/camin|a pie|peatonal|walk/.test(l)) return Footprints;
  if (/subte|metro|tren|train|estaci[oó]n/.test(l)) return TrainFront;
  if (/bus|colectivo|l[ií]nea \d/.test(l)) return Bus;
  if (/bici|bike|ecobici|patinete/.test(l)) return Bike;
  return Navigation;
}

export function RouteTimelineInterior({ block, onClose, onSave }: LecturaInteriorProps<RouteBlock>) {
  const items = block.items ?? [];
  // Progreso real del usuario: marcar tramo como hecho (toggle, aria-pressed).
  const [doneLegs, setDoneLegs] = useState<Record<number, boolean>>({});
  const doneCount = items.filter((_, i) => doneLegs[i]).length;
  const eta = block.eta;
  const first = items[0];
  const last = items[items.length - 1];

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(first?.label ?? "Tu ruta", eta) : undefined}
      chip={{ label: "Ruta", background: "linear-gradient(135deg,#93c5fd,#3b82f6)" }}
      ariaLabel="Cómo llegar"
    >
      <div id="p-route" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--sky-ink)",
                marginBottom: "5px",
              }}
            >
              Tu ruta{first ? ` · ${first.label}` : ""}
            </small>
            {eta ? `${eta} de viaje` : "Cómo llegar"}
            <br />
            {items.length} tramos
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {items.length
              ? "Los tramos vienen del block de rutas — en orden, con lo que importa en cada uno."
              : "Todavía no armé la ruta para este viaje."}
          </p>
        </div>

        <div className="rt-hero rv">
          <div className="rt-ends">
            <div className="rt-end">
              <span className="dot2 a" />
              <span className="nm">{first ? `Empezá · ${first.label}` : "Punto de partida"}</span>
            </div>
            <div className="rt-eta">
              <b>{eta ?? "—"}</b>
              <span>tiempo total</span>
            </div>
          </div>

          <div className="rt-path">
            {items.map((leg: Leg, i) => {
              const isEnd = i === items.length - 1;
              const Icon = legIcon(leg.label, isEnd);
              const tint = leg.color || (isEnd ? "var(--mint-ink)" : "var(--sky-ink)");
              const legDone = Boolean(doneLegs[i]);
              return (
                <button
                  type="button"
                  className={`rt-leg${isEnd ? " end" : ""}${legDone ? " done" : ""}`}
                  key={`leg_${i}_${leg.label}`}
                  aria-pressed={legDone}
                  onClick={() => setDoneLegs((cur) => ({ ...cur, [i]: !cur[i] }))}
                >
                  <span className="ic" style={{ color: tint }}>
                    <Ic i={Icon} className="ic" />
                  </span>
                  <div className="lt">
                    <b>{leg.label}</b>
                  </div>
                  {leg.detail ? <p>{leg.detail}</p> : null}
                  <span className="rt-done">{legDone ? "✓ hecho" : "tocar = hecho"}</span>
                </button>
              );
            })}
            {items.length === 0 && (
              <div className="rt-leg end">
                <span className="ic">
                  <Ic i={Flag} className="ic" style={{ color: "var(--ink-faint)" }} />
                </span>
                <div className="lt">
                  <b>Sin ruta calculada</b>
                </div>
              </div>
            )}
          </div>

          <div className="rt-arr rv">
            <Ic i={Flag} className="ic" />
            <div className="at">
              <b>{last ? (last.label.toLowerCase().startsWith("lleg") ? last.label : `Llegás a ${last.label}`) : eta ? `Llegás en ${eta}` : "Destino"}</b>
              <span>{items.length} tramos reales · vas por {doneCount} de {items.length}</span>
            </div>
            <span className="tm">{eta ?? ""}</span>
          </div>
        </div>

        {eta && items.length > 2 && (
          <div className="rt-warn rv">
            <Ic i={TriangleAlert} className="ic" />
            <p>
              Esta ruta tiene <b>{items.length - 1} transbordos</b> — si preferís menos cambios, pedime la alternativa directa.
            </p>
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn primary" onClick={onClose}>
            <Ic i={Navigation} className="ic" />
            Volver al chat
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => (onSave ? onSave(first?.label ?? "Tu ruta", eta) : onClose())}
          >
            <Ic i={RouteIcon} className="ic" />
            Guardar ruta
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
