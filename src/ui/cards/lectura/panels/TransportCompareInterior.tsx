/**
 * TransportCompareInterior — card "Tablero de salidas" (#p-transp), bind
 * real del block `transport_compare` (items: mode/time/icon/active).
 *
 * Las filas del tablero son los items REALES: mode como línea/destino,
 * time como eta, active → fila destacada. La sección comparada usa los
 * mismos items: el activo lleva el badge GANA. Iconos por heurística del
 * nombre del modo (el icon del block es material name — se mapea).
 */
import { Bus, TrainFront, Footprints, Bike, Car, Ship, Sparkles, Route as RouteIcon, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-transp.css";

type TranspBlock = Extract<UiBlock, { type: "transport_compare" }>;
type Mode = NonNullable<TranspBlock["items"]>[number];

function modeIcon(mode?: string, matIcon?: string): LucideIcon {
  const m = `${mode ?? ""} ${matIcon ?? ""}`.toLowerCase();
  if (/subte|metro|tren|train|estaci/.test(m)) return TrainFront;
  if (/bus|colectivo|l[ií]nea/.test(m)) return Bus;
  if (/camin|pie|walk/.test(m)) return Footprints;
  if (/bici|bike/.test(m)) return Bike;
  if (/auto|car|taxi|uber|cabify/.test(m)) return Car;
  if (/barco|ferry|ship/.test(m)) return Ship;
  return Bus;
}

export function TransportCompareInterior({ block, onClose, onSave }: LecturaInteriorProps<TranspBlock>) {
  const items = block.items ?? [];
  const best = items.find((m) => m.active) ?? items[0];

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave("Tablero de salidas", best?.time) : undefined}
      chip={{ label: "Transporte", background: "linear-gradient(135deg,#93c5fd,#007BF9)" }}
      ariaLabel="Tablero de salidas"
    >
      <div id="p-transp" className="lcr-panel">
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
              {best ? `Tu mejor opción · ${best.mode}` : "Salidas"}
            </small>
            El tablero
            <br />
            de salidas
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {items.length
              ? `${items.length} opciones reales del comparador — la destacada es la que recomiendo.`
              : "Sin opciones para comparar todavía."}
          </p>
        </div>

        <div className="db-hero rv">
          <div className="db-head">
            <span className="tt">
              <Ic i={Bus} className="ic" />
              Próximas salidas
            </span>
            <span className="now">{items.length} opciones</span>
          </div>
          {items.map((m: Mode, i) => (
            <div className={`db-row${m.active ? " next" : ""}`} key={`row_${i}_${m.mode}`}>
              <span className="ln d">
                {m.mode}
                <small>{m.active ? "RECOMENDADO" : "ALTERNATIVA"}</small>
              </span>
              <span className="dst">
                {m.mode}
                <small>{m.active ? "tu mejor apuesta" : "opción del comparador"}</small>
              </span>
              <span className="eta">{m.time}</span>
            </div>
          ))}
          {items.length > 0 && (
            <div className="db-adv">
              <Ic i={Sparkles} className="ic" />
              El de {best?.time} es el tuyo: {best?.mode}. Las demás quedan como plan B anotado.
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="db-compare rv">
            <h3>
              <Ic i={RouteIcon} className="ic" />
              Comparadas por tu viaje
            </h3>
            {items.map((m: Mode, i) => (
              <div className={`cmp-row${m.active ? " best" : ""}`} key={`cmp_${i}_${m.mode}`}>
                <span className="ci" style={{ background: m.active ? "var(--mint-soft)" : "var(--honey-soft)" }}>
                  <Ic i={modeIcon(m.mode, m.icon)} className="ic" style={{ color: m.active ? "var(--mint-ink)" : "var(--honey-ink)" }} />
                </span>
                <span className="cn">
                  {m.mode}
                  <small>{m.active ? "recomendado por Michi" : "alternativa"}</small>
                </span>
                <span className="cv">
                  {m.time}
                  <small>{m.active ? "tu viaje" : "tiempo estimado"}</small>
                </span>
                {m.active && (
                  <span
                    style={{
                      font: "800 8.5px var(--sans)",
                      color: "#05301d",
                      background: "var(--mint)",
                      padding: "4px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    GANA
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn primary" onClick={onClose}>
            <Ic i={Bus} className="ic" />
            Volver al chat
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => (onSave ? onSave("Tablero de salidas", best?.time) : onClose())}
          >
            <Ic i={RouteIcon} className="ic" />
            Guardar opciones
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
