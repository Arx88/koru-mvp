/**
 * CheckInterior — card "Checklist" (#p-check), bind real del block
 * `smart_checklist`.
 *
 * Anillo de progreso REAL (done/total de block.items, o block.progress).
 * Cada item es un toggle legítimo: despacha `toggle_checklist` con los
 * ids sintéticos (`checklist_<slug>` / `citem_<slug>_<i>`) — KoruProvider
 * auto-crea el Checklist durable si no existe y marca el item. El estado
 * local refleja el toggle optimista hasta que la app re-renderiza.
 * 🔴 HIDRATACIÓN VIVA: si existe un checklist durable con el mismo id
 * sintético (creado desde Crear→Lista o por un toggle previo), el estado
 * inicial se hidrata del STORE (doneAt real), no de la foto del block —
 * así la card reabierta muestra el progreso actual, no uno viejo.
 * Sin items → estado vacío honesto (no se inventa contenido).
 */
import { useState } from "react";
import { Check, Circle, ListChecks, Save, CircleSlash } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import { checklistIdFor, checklistItemIdFor } from "../slug";
import { useKoruOptional } from "../../../KoruProvider";
import type { LecturaInteriorProps } from "../index";
import "./p-check.css";

type ChecklistBlock = Extract<UiBlock, { type: "smart_checklist" }>;

const RING_CIRC = 2 * Math.PI * 52; // 326.7

export function CheckInterior({ block, onClose, onSave }: LecturaInteriorProps<ChecklistBlock>) {
  const items = block.items ?? [];
  const checklistId = checklistIdFor(block.title || "lista");
  // 🔴 Estado VIVO: si el store tiene el checklist durable con el mismo id
  // sintético, su doneAt manda sobre el snapshot del block.
  const koru = useKoruOptional();
  const durable = koru?.state?.checklists?.find((c) => c.id === checklistId);
  const [localDone, setLocalDone] = useState<boolean[]>(() =>
    items.map((it, i) => {
      const durableItem = durable?.items?.find((di) => di.id === checklistItemIdFor(it.label, i));
      return durableItem ? Boolean(durableItem.doneAt) : it.checked;
    }),
  );

  const doneCount = localDone.filter(Boolean).length;
  const total = items.length;
  const pct = block.progress != null ? block.progress : total ? Math.round((doneCount / total) * 100) : 0;
  const ringOffset = RING_CIRC * (1 - pct / 100);

  const toggleItem = (i: number) => {
    if (!items[i]) return;
    const next = [...localDone];
    next[i] = !next[i];
    setLocalDone(next);
    dispatchCardAction("toggle_checklist", block, {
      checklistId,
      itemId: checklistItemIdFor(items[i].label, i),
    });
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Checklist", `${doneCount}/${total}`) : undefined}
      chip={{ label: "Checklist", background: "linear-gradient(135deg,#8B6DFF,#6D52F8)" }}
      ariaLabel={block.title || "Checklist"}
    >
      <div id="p-check" className="lcr-panel">
        <div className="ck-head rv">
          <h1>
            <small>Tu checklist</small>
            {block.title || "Lo que falta"}
          </h1>
          <p>
            {total
              ? `${doneCount} de ${total} completados — tocá un item para marcarlo.`
              : "Todavía no hay items en esta lista."}
          </p>
        </div>

        {total > 0 && (
          <div className="ck-hero rv">
            <div className="ck-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#E6EEFA" strokeWidth="11" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#p-check-ckG)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                  style={{ transition: "stroke-dashoffset .4s var(--ease)" }}
                />
                <defs>
                  <linearGradient id="p-check-ckG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#4BDD8C" />
                    <stop offset="1" stopColor="#22B35F" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="cval">
                <b>{doneCount} / {total}</b>
                <span>HECHO</span>
              </div>
            </div>
            <div className="ch-facts" style={{ flex: 1, minWidth: 0 }}>
              <div className="fk">Progreso real de tu lista</div>
              <div className="fnm" style={{ marginBottom: "7px" }}>
                {block.title || "Checklist"}
              </div>
              <div className="ck-budget">
                <span>Completado</span>
                <b>{pct}%</b>
              </div>
            </div>
          </div>
        )}

        <div className="ck-list rv">
          {items.map((it, i) => (
            <button
              key={`${checklistItemIdFor(it.label, i)}`}
              type="button"
              className={`ckitem${localDone[i] ? " done" : ""}`}
              onClick={() => toggleItem(i)}
              aria-pressed={localDone[i] ?? false}
            >
              <span className="box">
                <Ic i={Check} className="ic" />
              </span>
              <div className="ct">
                <b>{it.label}</b>
              </div>
              <span
                className="cprice"
                aria-hidden="true"
                title={localDone[i] ? "Completado" : "Pendiente"}
              >
                {localDone[i] ? <Ic i={Check} className="ic" /> : <Ic i={Circle} className="ic pend" />}
              </span>
            </button>
          ))}
          {total === 0 && (
            <div className="ckitem" style={{ cursor: "default" }}>
              <span className="box">
                <Ic i={CircleSlash} className="ic" style={{ color: "var(--ink-faint)" }} />
              </span>
              <div className="ct">
                <b>Lista vacía</b>
                <span>cuando Michi arme la lista, los items aparecen acá</span>
              </div>
            </div>
          )}
        </div>

        <div className="ck-barwrap rv">
          <div className="bt">
            <span>Progreso de la lista</span>
            <b>{pct}%</b>
          </div>
          <div className="ck-btrack">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="actions">
          <button type="button" className="btn primary" onClick={() => (onSave ? onSave(block.title || "Checklist", `${doneCount}/${total}`) : onClose())}>
            <Ic i={Save} className="ic" />
            Guardar lista
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            <Ic i={ListChecks} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
