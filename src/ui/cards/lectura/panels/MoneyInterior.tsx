/**
 * MoneyInterior — card "Tus gastos del mes" (#p-money), bind real del block
 * `money_summary`.
 *
 * Total + currency reales (formateado es-ES). Stack bar y leyenda derivados
 * de summaryItems: el ancho de cada tramo es el % REAL de su value sobre el
 * total (parseo tolerante "€611" / "611" / "1.234,50"). Rows con label/value/
 * detail reales del block. La nota es block.recommendation — solo si existe.
 * Sin summaryItems parseables no hay barras (no se inventan categorías).
 * Acción: fijar tope → create_commitment durable.
 */
import { PiggyBank, Receipt, Sparkles, Wallet, TrendingDown, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-money.css";

type MoneyBlock = Extract<UiBlock, { type: "money_summary" }>;
type SumItem = NonNullable<MoneyBlock["summaryItems"]>[number];

const CATEGORY_COLORS = ["#d6497f", "#B07E00", "#1A237E", "#6D52F8", "#A6ACCB", "#22B35F", "#c2410c"];
const CATEGORY_ICONS: LucideIcon[] = [Wallet, Receipt, PiggyBank, Sparkles, TrendingDown, Wallet, Receipt];

/** "€611" | "611" | "1.234,50" → number | null */
function parseMoney(v?: string | number): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? parseFloat(cleaned.replace(/\./g, "").replace(",", "."))
      : parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(",", "."));
  return parseFloat(cleaned);
}

function fmtMoney(n: number, currency?: string): string {
  const num = n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
  return currency ? `${num} ${currency}` : num;
}

export function MoneyInterior({ block, onClose, onSave }: LecturaInteriorProps<MoneyBlock>) {
  const items = block.summaryItems ?? [];
  const total = block.total;
  const totalLabel =
    total != null
      ? fmtMoney(total, block.currency)
      : items[0]
        ? `${block.title || "Resumen"}`
        : "—";

  const nums = items.map((it) => parseMoney(it.value));
  const numTotal = total ?? nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
  const hasBars = numTotal > 0 && nums.some((n) => n != null && n > 0);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Resumen de gastos", totalLabel) : undefined}
      chip={{ label: "Plata", background: "linear-gradient(135deg,#FF9EBE,#FF5A60)" }}
      ariaLabel={block.title || "Resumen de gastos"}
    >
      <div id="p-money" className="lcr-panel">
        <div className="mo-head rv">
          <h1>
            <small>{block.title || "Tu resumen"}</small>
            {total != null ? `${totalLabel} en la mira` : "Tu resumen de plata"}
          </h1>
          <p>
            {items.length
              ? `${items.length} ${items.length === 1 ? "rubro" : "rubros"} con lo que se fue — la barra apila el % real de cada uno.`
              : "Todavía no hay desglose en este resumen."}
          </p>
        </div>

        <div className="mo-hero rv">
          <div className="mo-total">
            <div>
              <div className="tl">Total{block.currency ? ` (${block.currency})` : ""}</div>
              <div className="tv">{totalLabel}</div>
            </div>
            <span className="mo-delta">
              <Ic i={TrendingDown} className="ic" />
              {items.length} rubros
            </span>
          </div>
          <div className="mo-stack">
            {items.map((it, i) => {
              const n = nums[i];
              // FIX PROPORCIÓN: ancho EXACTO (n/total) — antes Math.max(4, …)
              // forzaba un mínimo del 4% por segmento y con muchos rubros chicos
              // la suma superaba el 100% → flex distorsionaba la barra (mentía).
              const pct = n != null && numTotal > 0 ? (n / numTotal) * 100 : null;
              if (pct == null) return null;
              return (
                <i
                  key={`${it.label}_${i}`}
                  style={{ width: `${pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  aria-label={`${it.label}: ${pct.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mo-legend">
            {items.map((it, i) => (
              <span className="lg" key={`${it.label}_lg_${i}`}>
                <i style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                {it.label} <b>{it.value}</b>
              </span>
            ))}
          </div>
        </div>

        {items.length > 0 && (
          <div className="mo-rows rv">
            {items.map((it: SumItem, i) => {
              const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
              const n = nums[i];
              const pct = n != null && numTotal > 0 ? Math.round((n / numTotal) * 100) : null;
              return (
                <div className="mrow" key={`${it.label}_row_${i}`}>
                  <div className="rt">
                    <div className="ric" style={{ background: `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}1a` }}>
                      <Ic i={Icon} className="ic" style={{ color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    </div>
                    <span className="rn">
                      {it.label}
                      {it.detail ? <small style={{ display: "block", font: "600 9.5px var(--sans)", color: "var(--ink-dim)", marginTop: 1 }}>{it.detail}</small> : null}
                    </span>
                    <span className="rv">
                      {it.value}
                      {pct != null ? <small> · {pct}%</small> : null}
                    </span>
                  </div>
                  {pct != null && (
                    <div className="rtrack">
                      <i style={{ width: `${Math.min(100, pct)}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {block.recommendation && (
          <div className="mo-note rv">
            <Ic i={Sparkles} className="ic" />
            <p>{block.recommendation}</p>
          </div>
        )}

        {!hasBars && items.length > 0 && (
          <div className="mo-note rv">
            <Ic i={Receipt} className="ic" />
            <p>Los valores de estos rubros no son comparables con el total — te muestro el detalle sin barras, para no inventar proporciones.</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: `Tope ${block.title || "de gastos"}`,
                dueHint: total != null ? `tope en ${totalLabel}` : "definir con Koru",
              });
              onClose();
            }}
          >
            <Ic i={PiggyBank} className="ic" />
            Fijar un tope
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(block.title || "Resumen de gastos", totalLabel) : onClose())}>
            <Ic i={Receipt} className="ic" />
            Guardar resumen
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
