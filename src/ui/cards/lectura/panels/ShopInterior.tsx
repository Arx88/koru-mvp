/**
 * ShopInterior — card "Lista del super" (#p-shop), bind real del block
 * `shopping_list` (items + quantities + checked + dueText + note).
 *
 * Antes su "Ver más" caía al render genérico viejo. Ahora: ticket de
 * compras en lenguaje Lectura Visual — cada item tipea un toggle real
 * (dispatch toggle_shopping con los ids sintéticos que KoruProvider
 * auto-crea como ShoppingList durable), las cantidades aparecen como
 * pastilla ×N solo cuando existen, y lo ya comprado queda tachado.
 * Nada inventado: sin items → estado vacío honesto.
 */
import { useState } from "react";
import { ShoppingCart, Check, Circle, Brain, Save, ArrowLeft, CircleSlash } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-shop.css";

type ShopBlock = Extract<UiBlock, { type: "shopping_list" }>;

function shopSlug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "compras";
}

export function ShopInterior({ block, onClose, onSave }: LecturaInteriorProps<ShopBlock>) {
  const items = (block.items ?? []).map((it) => String(it));
  const quantities = (block.quantities ?? {}) as Record<string, number>;
  const listId = `shoplist_${shopSlug(String(block.title ?? "").trim() || "compras")}`;
  const [done, setDone] = useState<boolean[]>(() =>
    items.map((it) => (block.checked ?? []).includes(it)),
  );

  const doneCount = done.filter(Boolean).length;
  const total = items.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const toggle = (i: number) => {
    if (!items[i]) return;
    const next = [...done];
    next[i] = !next[i];
    setDone(next);
    dispatchCardAction("toggle_shopping", block, { listId, itemId: items[i] });
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Lista de compras", `${doneCount}/${total}`) : undefined}
      chip={{ label: "Lista", background: "linear-gradient(135deg,#4BDD8C,#2FC86E)" }}
      ariaLabel={block.title || "Lista de compras"}
    >
      <div id="p-shop" className="lcr-panel">
        <div className="sh-head rv">
          <h1>
            <small>Tu lista</small>
            {String(block.title ?? "").trim() || "Compras"}
          </h1>
          <p>
            {total
              ? `${doneCount} de ${total} en el changuito — tocá un item para marcarlo.${block.dueText ? ` Vence ${String(block.dueText).toLowerCase()}.` : ""}`
              : "Todavía no hay items en esta lista."}
          </p>
        </div>

        <div className="sh-ticket rv">
          <div className="sh-ticket-head">
            <Ic i={ShoppingCart} className="ic" />
            <span>{total} items</span>
            <i className="perf" />
            <span className="sh-pct">{pct}%</span>
          </div>
          <div className="sh-list">
            {items.map((it, i) => {
              const qty = quantities[it];
              return (
                <button
                  key={`shop_${i}_${it}`}
                  type="button"
                  className={`shitem${done[i] ? " done" : ""}`}
                  onClick={() => toggle(i)}
                  aria-pressed={done[i] ?? false}
                >
                  <span className="box">
                    <Ic i={Check} className="ic" />
                  </span>
                  <div className="st">
                    <b>{it}</b>
                  </div>
                  {qty != null && qty > 0 && <span className="qty">×{qty}</span>}
                  <span className="dot" aria-hidden="true" title={done[i] ? "Comprado" : "Pendiente"}>
                    {done[i] ? <Ic i={Check} className="ic" /> : <Ic i={Circle} className="ic pend" />}
                  </span>
                </button>
              );
            })}
            {total === 0 && (
              <div className="shitem" style={{ cursor: "default" }}>
                <span className="box">
                  <Ic i={CircleSlash} className="ic" style={{ color: "var(--ink-faint)" }} />
                </span>
                <div className="st">
                  <b>Lista vacía</b>
                  <span>cuando sumes items aparecen acá</span>
                </div>
              </div>
            )}
          </div>
          <div className="sh-ticket-foot">
            <i className="perf" />
            <span>Comprado {doneCount} · Falta {Math.max(0, total - doneCount)}</span>
          </div>
        </div>

        {block.note && (
          <div className="sh-note rv">
            <div className="nic">
              <Ic i={Brain} className="ic" />
            </div>
            <div className="nt">
              <b>La nota de Koru</b>
              <span>{block.note}</span>
            </div>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => (onSave ? onSave(block.title || "Lista de compras", `${doneCount}/${total}`) : onClose())}
          >
            <Ic i={Save} className="ic" />
            Guardar lista
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={ArrowLeft} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
