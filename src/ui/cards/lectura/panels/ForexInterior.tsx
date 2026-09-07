/**
 * ForexInterior — card "Dólar oficial" (#p-forex), bind real del block
 * `forex` (items: pair/rate/change/flag/positive).
 *
 * Hero del primer par: from/to split real del string "USD/EUR", rate
 * grande con el número del block, dirección desde `positive`. Board de
 * ventanilla con TODOS los pares del block (rate + change con flecha
 * real de positive). Conversión derivada del rate REAL (US$500 × rate).
 * La curva semanal NO está en el domain → no se dibuja. Acción:
 * avisame → create_commitment durable.
 */
import { BellRing, RefreshCw, Banknote, ArrowLeftRight, TrendingUp, TrendingDown } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-forex.css";

type ForexBlock = Extract<UiBlock, { type: "forex" }>;
type Pair = NonNullable<ForexBlock["items"]>[number];

/** "0,92" | "1.105,0" | "0.92" → number */
function parseRate(rate?: string): number | null {
  if (!rate) return null;
  const cleaned = rate.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? parseFloat(cleaned.replace(/\./g, "").replace(",", "."))
      : parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(",", "."));
  return parseFloat(cleaned);
}

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

export function ForexInterior({ block, onClose, onSave }: LecturaInteriorProps<ForexBlock>) {
  const items = block.items ?? [];
  const first = items[0];
  const [from, to] = (first?.pair ?? "").split("/");
  const rateNum = parseRate(first?.rate);
  const positive = first?.positive ?? true;
  const change = first?.change ?? 0;
  const changeUp = change >= 0;
  // Conversión real derivada del rate del block (500 unidades base).
  const conv = rateNum != null ? rateNum * 500 : null;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || first?.pair || "Cotización", first?.rate) : undefined}
      chip={{ label: "Divisas", background: "linear-gradient(135deg,#6ee7b7,#2f8f6d)" }}
      ariaLabel={block.title || first?.pair || "Cotización de divisas"}
    >
      <div id="p-forex" className="lcr-panel">
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
              {block.title || first?.pair || "Divisas"}
            </small>
            {from || "Origen"}
            <br />
            hacia {to || "destino"}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {items.length > 1
              ? `${items.length} pares — el que preguntaste arriba, el resto en la ventanilla.`
              : "La cotización del block, tal como la trajo la herramienta."}
          </p>
        </div>

        {first && (
          <div className="fx3-hero rv">
            <div className="fx3-rate">
              <div className="fx3-cur">
                <span className="fl" style={{ background: "var(--sky-soft)", color: "var(--sky-ink)" }}>
                  {first.flag || (from?.slice(0, 2) ?? "US")}
                </span>
                <span>{from || "Origen"}</span>
              </div>
              <div className="fx3-arrow">
                <Ic i={RefreshCw} className="ic a" />
                <div className="r">
                  {first.rate}
                  <small>
                    {to || "DEST"} POR {from || "ORIG"} 1
                  </small>
                </div>
              </div>
              <div className="fx3-cur">
                <span className="fl" style={{ background: "var(--violet-soft)", color: "var(--violet-ink)" }}>
                  {to?.slice(0, 2) ?? "€"}
                </span>
                <span>{to || "Destino"}</span>
              </div>
            </div>

            {items.length > 1 ? (
              <div className="fx3-board">
                <div className="bh">
                  <span>Par</span>
                  <span>Cotización</span>
                </div>
                <div className="bb">
                  {items.slice(1).map((p: Pair, i) => (
                    <span key={`${p.pair}_${i}`} style={{ display: "contents" }}>
                      <span>
                        <b>{p.pair}</b>
                        <small>{p.rate}</small>
                      </span>
                      <span>
                        <b style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <Ic i={p.positive ? TrendingUp : TrendingDown} className="ic" style={{ fontSize: 15, color: p.positive ? "var(--mint-ink)" : "var(--rose-ink)" }} />
                          {p.positive ? "+" : "\u2212"}
                          {Math.abs(typeof p.change === "number" ? p.change : 0).toFixed(1).replace(".", ",")}%
                        </b>
                        <small>{p.positive ? "AL ALZA" : "A LA BAJA"}</small>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="fx3-board">
                <div className="bh">
                  <span>movimiento</span>
                  <span>variación</span>
                </div>
                <div className="bb">
                  <span>
                    <b style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Ic i={changeUp ? TrendingUp : TrendingDown} className="ic" style={{ fontSize: 16, color: changeUp ? "var(--mint-ink)" : "var(--rose-ink)" }} />
                      {changeUp ? "AL ALZA" : "A LA BAJA"}
                    </b>
                    <small>HOY</small>
                  </span>
                  <span>
                    <b>
                      {changeUp ? "+" : "\u2212"}
                      {Math.abs(typeof change === "number" ? change : 0).toFixed(1).replace(".", ",")}%
                    </b>
                    <small>VARIACIÓN</small>
                  </span>
                </div>
              </div>
            )}

            {conv != null && (
              <div className="fx3-conv">
                <span>Cambiando 500 {from || "USD"} hoy</span>
                <b>
                  → {fmt(conv)} {to || ""}
                </b>
              </div>
            )}
          </div>
        )}

        {!first && (
          <div className="fx3-hero rv" style={{ textAlign: "center", padding: "22px 16px" }}>
            <Ic i={ArrowLeftRight} className="ic" style={{ fontSize: 26, color: "var(--ink-faint)" }} />
            <p style={{ font: "600 11px var(--sans)", color: "var(--ink-dim)", marginTop: 8 }}>
              Sin pares en este block todavía.
            </p>
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
                title: `Aviso ${first.pair}`,
                dueHint: `${first.pair} llega a ${first.rate}`,
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Avisame si se mueve
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(block.title || first?.pair || "Cotización", first?.rate) : onClose())}>
            <Ic i={Banknote} className="ic" />
            Guardar cotización
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
