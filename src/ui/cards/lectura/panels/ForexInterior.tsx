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
import { useState } from "react";
import { BellRing, RefreshCw, Banknote, ArrowLeftRight, TrendingUp, TrendingDown, Calculator } from "lucide-react";
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
  // Calculadora de ventanilla: par elegible + monto editable + resultado
  // computado del rate REAL del block (mismo patrón del catálogo: cambiar
  // US$500 hoy → €455). Estado local de la card, nada simulado.
  const [pairIdx, setPairIdx] = useState(0);
  const [amount, setAmount] = useState("500");
  const active = items[Math.min(pairIdx, Math.max(0, items.length - 1))] ?? items[0];
  const [from, to] = (active?.pair ?? "").split("/");
  const rateNum = parseRate(active?.rate);
  const amountNum = Math.max(0, parseFloat(amount.replace(",", ".")) || 0);
  const conv = rateNum != null ? rateNum * amountNum : null;
  const positive = active?.positive ?? true;
  const change = active?.change ?? 0;
  const changeUp = change >= 0;
  const QUICK = [100, 500, 1000];

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || active?.pair || "Cotización", active?.rate) : undefined}
      chip={{ label: "Divisas", background: "linear-gradient(135deg,#6ee7b7,#2f8f6d)" }}
      ariaLabel={block.title || active?.pair || "Cotización de divisas"}
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
              {block.title || active?.pair || "Divisas"}
            </small>
            {from || "Origen"}
            <br />
            hacia {to || "destino"}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {items.length > 1
              ? `${items.length} pares — elegís el que querés y calculo cuánto te dan de verdad.`
              : "La cotización del block, tal como la trajo la herramienta."}
          </p>
        </div>

        {active && (
          <div className="fx3-hero rv">
            <div className="fx3-rate">
              <div className="fx3-cur">
                <span className="fl" style={{ background: "var(--sky-soft)", color: "var(--sky-ink)" }}>
                  {active.flag || (from?.slice(0, 2) ?? "US")}
                </span>
                <span>{from || "Origen"}</span>
              </div>
              <div className="fx3-arrow">
                <Ic i={RefreshCw} className="ic a" />
                <div className="r">
                  {active.rate}
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

            {items.length > 1 && (
              <div className="fx3-board">
                <div className="bh">
                  <span>Par</span>
                  <span>Cotización</span>
                </div>
                <div className="bb">
                  {items.map((p: Pair, i: number) => (
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
            )}

            {items.length === 1 && (
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

            {/* Calculadora de ventanilla — computa del rate real del par activo */}
            {items.length > 0 && rateNum != null && (
              <div className="fx3-calc rv">
                <div className="calc-h">
                  <Ic i={Calculator} className="ic" />
                  <span>Calculadora de ventanilla</span>
                </div>
                {items.length > 1 && (
                  <div className="calc-pairs" role="tablist" aria-label="Elegir par">
                    {items.map((p, i) => (
                      <button
                        key={`${p.pair}_${i}`}
                        type="button"
                        role="tab"
                        aria-selected={i === Math.min(pairIdx, items.length - 1)}
                        onClick={() => setPairIdx(i)}
                      >
                        {p.pair}
                      </button>
                    ))}
                  </div>
                )}
                <label className="calc-amt">
                  <span>Cantidad en {from || "origen"}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={50}
                    aria-label={`Cantidad de ${from || "divisa origen"}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <div className="calc-chips">
                  {QUICK.map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={amount === String(v)}
                      onClick={() => setAmount(String(v))}
                    >
                      {v} {from}
                    </button>
                  ))}
                </div>
                <div className="calc-res">
                  <span>
                    {amount || 0} {from} hoy →
                  </span>
                  <b>
                    {conv != null ? fmt(conv) : "—"} {to}
                  </b>
                  <small>
                    al rate real {active.rate} · 1 {from} = {fmt(rateNum)} {to}
                    {amountNum > 0 && conv != null ? ` · sin comisión estimada` : ""}
                  </small>
                </div>
              </div>
            )}
          </div>
        )}

        {!active && (
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
            disabled={!active}
            onClick={() => {
              if (!active) return;
              dispatchCardAction("create_commitment", block, {
                title: `Aviso ${active.pair}`,
                dueHint: `${active.pair} llega a ${active.rate}`,
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Avisame si se mueve
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(block.title || active?.pair || "Cotización", active?.rate) : onClose())}>
            <Ic i={Banknote} className="ic" />
            Guardar cotización
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
