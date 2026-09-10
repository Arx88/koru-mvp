/**
 * ProductInterior — card "Veredicto de compra" (#p-prod), bind real del
 * block `product_analysis` (product: name/image/icon/rating/reviewCount/
 * description + specs + actionLabel).
 *
 * Foto del producto SOLO si product.image existe (nada random). Dial con
 * rating REAL (escala asumida 0-10 si viene ≤10, 0-100 si >10). Specs
 * REALES como grid label/value. reviewCount como chip de reseñas. Sin
 * price/pros/cons en el domain → no se inventan. Acción primaria con
 * actionLabel REAL del block.
 */
import { useState } from "react";
import { Check,  BadgeCheck, ShoppingCart, Scale, Star, ThumbsUp, Package } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-prod.css";

type ProdBlock = Extract<UiBlock, { type: "product_analysis" }>;
type Spec = NonNullable<ProdBlock["specs"]>[number];

const RING_CIRC = 2 * Math.PI * 52;

export function ProductInterior({ block, onClose, onSave }: LecturaInteriorProps<ProdBlock>) {
  // Guardar para la compra con estado pegado (toggle real, no one-shot).
  const [saved, setSaved] = useState(false);
  const product = block.product;
  const name = product?.name || block.product?.icon || "Tu producto";
  const rating = product?.rating;
  const specs = block.specs ?? [];
  // escala: rating ≤ 10 → escala 10; > 10 → escala 100
  const scale = rating != null && rating > 10 ? 100 : 10;
  const pct = rating != null ? Math.min(100, Math.max(0, (rating / scale) * 100)) : 0;
  const ringOffset = RING_CIRC * (1 - pct / 100);
  const ratingLabel = rating != null ? `${String(rating).replace(".", ",")}/${scale}` : null;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(name, ratingLabel ?? undefined) : undefined}
      chip={{ label: "Producto", background: "linear-gradient(135deg,#4BDD8C,#22B35F)" }}
      ariaLabel={name}
    >
      <div id="p-prod" className="lcr-panel">
        <div className="prs-head rv">
          <h1>
            <small>Veredicto de compra</small>
            {name}
          </h1>
          <p>{product?.description ?? "El producto que analicé para vos, con lo que importa de verdad."}</p>
        </div>

        {product?.image && (
          <div className="prs-photo rv">
            <img src={product.image} alt={name} />
            <div className="veil" />
            <div className="in">
              <div>
                <span className="k">El producto</span>
                <h3>{name}</h3>
              </div>
              {product.reviewCount && (
                <span className="ver">
                  <Ic i={ThumbsUp} className="ic" style={{ fontSize: 11 }} />
                  {product.reviewCount} reseñas
                </span>
              )}
            </div>
          </div>
        )}

        <div className="prs-hero rv">
          <div className="prs-dial">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#eee8f8" strokeWidth="11" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="url(#p-prod-prsG)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={rating != null ? ringOffset : RING_CIRC}
              />
              <defs>
                <linearGradient id="p-prod-prsG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#4BDD8C" />
                  <stop offset="1" stopColor="#22B35F" />
                </linearGradient>
              </defs>
            </svg>
            <div className="dval">
              <b>{ratingLabel ?? "—"}</b>
              <span>SCORE</span>
            </div>
          </div>
          <div className="prs-facts">
            <div className="fk">{rating != null ? "Puntaje del análisis" : "Tu producto"}</div>
            <div className="fnm">
              {name}
              {product?.reviewCount ? (
                <>
                  <br />
                  {product.reviewCount} reseñas
                </>
              ) : null}
            </div>
            {rating != null && (
              <span className="stamp">
                <Ic i={BadgeCheck} className="ic" style={{ fontSize: "11px" }} />
                ANÁLISIS DE KORU
              </span>
            )}
          </div>
        </div>

        {specs.length > 0 && (
          <div className="prs-specs rv">
            {specs.map((s: Spec) => (
              <div className="spec" key={`spec_${s.label}`}>
                <div className="sk">
                  <Ic i={Package} className="ic" />
                  {s.label}
                </div>
                <div className="sv">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            aria-pressed={saved}
            onClick={() => {
              const next = !saved;
              setSaved(next);
              if (next) onSave?.(name, ratingLabel ?? undefined);
            }}
          >
            <Ic i={saved ? Check : ShoppingCart} className="ic" />
            {saved ? "Guardado en tu compra" : block.actionLabel || "Guardar para la compra"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            <Ic i={Scale} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
