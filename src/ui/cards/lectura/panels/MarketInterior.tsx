/**
 * MarketInterior — card "Acción al detalle" (#p-market), bind real del
 * block `market` (assets[]).
 *
 * Hero de cotización del primer activo con useLivePrice — el MISMO hook
 * de la app para el precio latiente (random-walk ±0.15% sobre el base,
 * idéntico al comportamiento de la card compacta Trading). Change chip
 * desde change/changeUp reales. Board con todos los assets (icon/bg/
 * shape reales del block). OHLC/52-semanas NO están en el domain:
 * no se dibujan (nada inventado). Acciones: Alerta → create_commitment
 * durable; Guardar → onSave.
 */
import { CandlestickChart, BellRing, Save, ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { useLivePrice } from "../../unified/useLivePrice";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-market.css";

type MarketBlock = Extract<UiBlock, { type: "market" }>;
type Asset = MarketBlock["assets"][number];

const Dir: Partial<Record<"up" | "dn", LucideIcon>> = { up: ArrowUpRight, dn: ArrowDownRight };

export function MarketInterior({ block, onClose, onSave }: LecturaInteriorProps<MarketBlock>) {
  const assets = block.assets ?? [];
  const first = assets[0];
  const { displayPrice, direction } = useLivePrice(first?.price);
  const up = first?.changeUp ?? true;
  const DirIcon = direction ? Dir[direction] : undefined;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(first ? `${first.symbol} · ${first.name}` : "Mercado", first?.price) : undefined}
      chip={{ label: "Mercado", background: "linear-gradient(135deg,#93c5fd,#3b82f6)" }}
      ariaLabel={first ? `${first.symbol} ${first.name}` : "Mercado"}
    >
      <div id="p-market" className="lcr-panel">
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
              {first ? `${first.symbol}${first.category ? ` · ${first.category}` : ""}` : "MERCADO"}
            </small>
            {first ? first.name : "Tu consulta"}
            <br />
            al detalle
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {assets.length > 1
              ? `${assets.length} activos — el grande arriba, el resto en el tablero.`
              : "Cotización con el precio latiendo como en la card del chat — el valor base es el del block."}
          </p>
        </div>

        {first && (
          <div className="st-hero rv">
            <div className="sh-top">
              <span className="tk">
                <Ic i={CandlestickChart} className="ic" />
                <b>{first.symbol}</b>
                {first.category ? ` · ${first.category}` : ""}
              </span>
              <span
                style={{
                  font: "700 9px var(--sans)",
                  color: "var(--ink-faint)",
                  background: "var(--paper2)",
                  padding: "4px 9px",
                  borderRadius: "999px",
                }}
              >
                en vivo
              </span>
            </div>
            <div className="px" style={direction === "up" ? { color: "var(--mint-ink)" } : direction === "dn" ? { color: "var(--rose-ink)" } : undefined}>
              {displayPrice ?? first.price}
            </div>
            <div className="chg" style={{ color: up ? "var(--mint-ink)" : "var(--rose-ink)" }}>
              {up ? "▲" : "▼"} {first.change || (up ? "sube" : "baja")}
              {DirIcon && <Ic i={DirIcon} className="ic" style={{ display: "inline-flex", verticalAlign: "-2px", marginLeft: 4, fontSize: 13 }} />}
            </div>
            {assets.length > 1 && (
              <div className="ohlc">
                {assets.slice(1, 4).map((a) => (
                  <span key={a.symbol}>
                    {a.symbol}
                    <b>{a.price}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {assets.length > 1 && (
          <div className="st-read rv">
            {assets.map((a: Asset) => (
              <div className="rr" key={a.symbol}>
                <div
                  className="ric"
                  style={{
                    background: a.iconBg || "var(--sky-soft)",
                    borderRadius: a.shape === "circle" ? "50%" : undefined,
                  }}
                >
                  <Ic
                    i={a.changeUp ? ArrowUpRight : ArrowDownRight}
                    className="ic"
                    style={{ color: a.iconColor || (a.changeUp ? "var(--mint-ink)" : "var(--rose-ink)") }}
                  />
                </div>
                <div className="rt">
                  <b>
                    {a.name} · {a.symbol}
                  </b>
                  <span>
                    {a.price} · {a.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!first}
            onClick={() => {
              if (!first) return;
              dispatchCardAction("create_commitment", block, {
                title: `Alerta ${first.symbol}`,
                dueHint: `precio cruza ${first.price}`,
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Alerta de precio
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(first ? `${first.symbol} · ${first.name}` : "Mercado", first?.price) : onClose())}>
            <Ic i={Save} className="ic" />
            Guardar cotización
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
