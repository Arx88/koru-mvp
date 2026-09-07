/**
 * CryptoInterior — card "Portfolio cripto" (#p-crypto), bind real del block
 * `crypto_portfolio`.
 *
 * Total y weekChange reales del block; la curva del hero se dibuja desde
 * block.sparkline (number[] REAL) — sin sparkline no hay curva (no se
 * inventa). Monedas desde items[] con char/color/bg reales, price/change,
 * share % derivado solo si value y totalValue son parseables. Alerts del
 * block como chips reales. Acción: Alerta → create_commitment durable.
 */
import { BellRing, TrendingUp, TrendingDown, ChartPie, Lightbulb, Zap, Coins, History, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { useLivePrice } from "../../unified/useLivePrice";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-crypto.css";

type CryptoBlock = Extract<UiBlock, { type: "crypto_portfolio" }>;
type Coin = NonNullable<CryptoBlock["items"]>[number];

/** "€3.182" | "61400 USD" | "0,052" → number | null */
function parseNum(s?: string | number): number | null {
  if (s == null) return null;
  if (typeof s === "number") return s;
  const cleaned = String(s).replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? parseFloat(cleaned.replace(/\./g, "").replace(",", "."))
      : parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(",", "."));
  return parseFloat(cleaned);
}

/** number[] → path SVG (viewBox 340x118), min-max normalizado. */
function sparkPath(data: number[], w = 340, h = 118, pad = 8): { line: string; area: string } | null {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  const area = `${line} L${lx.toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return { line, area };
}

export function CryptoInterior({ block, onClose, onSave }: LecturaInteriorProps<CryptoBlock>) {
  const items = block.items ?? [];
  const first = items[0];
  const { displayPrice, direction } = useLivePrice(first?.price);
  const week = block.weekChange ?? 0;
  const weekUp = week >= 0;
  const spark = block.sparkline && block.sparkline.length > 1 ? sparkPath(block.sparkline) : null;
  const upIcon: LucideIcon = weekUp ? TrendingUp : TrendingDown;

  const totalNum = parseNum(block.totalValue);
  const shares = totalNum
    ? items.map((c) => {
        const v = parseNum(c.value);
        return v != null ? (v / totalNum) * 100 : null;
      })
    : items.map(() => null);
  const shareSum = shares.reduce<number>((acc, s) => acc + (s ?? 0), 0);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Portfolio cripto", block.totalValue) : undefined}
      chip={{ label: "Cripto", background: "linear-gradient(135deg,#6ee7b7,#2f8f6d)" }}
      ariaLabel={block.title || "Portfolio cripto"}
    >
      <div id="p-crypto" className="lcr-panel">
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
              {block.title || "Tu portfolio · cripto"}
            </small>
            {block.totalValue ? "Tu portfolio hoy" : "Precios de hoy"}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {block.totalValue
              ? `Total ${block.totalValue}${block.weekChange != null ? ` · ${weekUp ? "+" : ""}${week}% en la semana` : ""}. El total primero, la moneda después.`
              : `${items.length || "Sin"} ${items.length === 1 ? "moneda" : "monedas"} — precios al toque del block.`}
          </p>
        </div>

        <div className="pf-hero rv">
          <div className="ph-top">
            <div>
              <div className="pl">{block.totalValue ? "Valor hoy" : first ? `${first.symbol} hoy` : "Cripto"}</div>
              <div className="pv" style={direction === "up" ? { color: "var(--mint-ink)" } : direction === "dn" ? { color: "var(--rose-ink)" } : undefined}>
                {block.totalValue ?? displayPrice ?? first?.price ?? "—"}
              </div>
            </div>
            <div className="pd">
              {block.weekChange != null && (
                <span className={weekUp ? "up" : "dn"} style={{ color: weekUp ? "var(--mint-ink)" : "var(--rose-ink)" }}>
                  <Ic i={upIcon} className="ic" />
                  {weekUp ? "+" : "\u2212"}
                  {Math.abs(week).toFixed(1).replace(".", ",")}%
                </span>
              )}
              {first && (
                <span className="sub">
                  {first.name} {displayPrice ?? first.price}
                </span>
              )}
            </div>
          </div>

          {spark && (
            <div className="pf-chart">
              <svg viewBox="0 0 340 118">
                <defs>
                  <linearGradient id="p-crypto-pfA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={weekUp ? "#6ee7b7" : "#f6a5bb"} stopOpacity=".45" />
                    <stop offset="1" stopColor={weekUp ? "#6ee7b7" : "#f6a5bb"} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g stroke="#f1ecfa" strokeWidth="1">
                  <line x1="0" y1="24" x2="340" y2="24" />
                  <line x1="0" y1="58" x2="340" y2="58" />
                  <line x1="0" y1="92" x2="340" y2="92" />
                </g>
                <path d={spark.area} fill="url(#p-crypto-pfA)" />
                <path
                  d={spark.line}
                  fill="none"
                  stroke={weekUp ? "#2f8f6d" : "#c2410c"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <div className="pf-axis">
                <span>semana</span>
                <span>hoy</span>
              </div>
            </div>
          )}

          <div className="pf-chips">
            <span className="c">
              <Ic i={Zap} className="ic" />
              {items.length} {items.length === 1 ? "moneda" : "monedas"}
            </span>
            {block.alerts?.map((al) => (
              <span className="c" key={`${al.symbol}_${al.target}`}>
                <Ic i={BellRing} className="ic" />
                {al.symbol} {al.direction === "above" ? "≥" : "≤"} {al.target}
              </span>
            ))}
            {shareSum > 0 && shareSum < 99.5 && (
              <span className="c">
                <Ic i={Coins} className="ic" />
                portfolio diversificado
              </span>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="pf-rows rv">
            <h3>
              <Ic i={ChartPie} className="ic" />
              {block.totalValue ? "Tus monedas" : "Precios"}
            </h3>
            {items.map((c: Coin, i) => {
              const chg = c.change ?? 0;
              const up = chg >= 0;
              const share = shares[i];
              return (
                <div className="pcoin" key={`${c.symbol}_${i}`}>
                  <div className="cic" style={{ background: c.bg || "#fffbeb", color: c.color || "#f59e0b" }}>
                    {c.char || c.symbol?.[0] || "?"}
                  </div>
                  <div className="ct">
                    <b>{c.name || c.symbol}</b>
                    <span>
                      {c.amount != null ? `${String(c.amount).replace(".", ",")} ${c.symbol}` : c.symbol}
                      {share != null ? ` · ${Math.round(share)}% del portfolio` : ""}
                    </span>
                  </div>
                  <div className="cv">
                    <b>{c.value ?? c.price}</b>
                    <span className={up ? "u" : "d"}>
                      {up ? "+" : "\u2212"}
                      {Math.abs(typeof chg === "number" ? chg : 0).toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {block.alerts?.length ? (
          <div className="pf-note rv">
            <Ic i={Lightbulb} className="ic" />
            <p>
              Tenés {block.alerts.length} {block.alerts.length === 1 ? "alerta activa" : "alertas activas"}:{Object.values(
                block.alerts,
              )
                .map((a) => `${a.symbol} ${a.direction === "above" ? "cruce al alza en" : "baja a"} ${a.target}`)
                .join(" · ")}
              . Koru vigila, vos no tenés que acordarte.
            </p>
          </div>
        ) : null}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!first && !block.alerts?.length}
            onClick={() => {
              const target = block.alerts?.[0]
                ? `${block.alerts[0].symbol} ${block.alerts[0].direction === "above" ? "cruza" : "baja a"} ${block.alerts[0].target}`
                : first
                  ? `${first.symbol} ${first.value ?? first.price}`
                  : null;
              if (!target) return;
              dispatchCardAction("create_commitment", block, { title: `Alerta cripto`, dueHint: target });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            {block.alerts?.length ? "Alerta ya activa · reforzar" : "Alerta de precio"}
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(block.title || "Portfolio cripto", block.totalValue) : onClose())}>
            <Ic i={History} className="ic" />
            Guardar portfolio
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
