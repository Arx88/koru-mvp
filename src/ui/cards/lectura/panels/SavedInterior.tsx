/**
 * SavedInterior — card "Ya quedó en tu agenda" (#p-saved), bind real del
 * block `saved_record` con UN record (el comprobante del personal_capture).
 *
 * El ticket muestra los campos REALES del LifeRecord guardado: título,
 * colección, persona, value, dueHint y url — solo los presentes. El código
 * del comprobante se DERIVA de forma determinista (hash del título +
 * colección) y el "código" es presentación, no dato inventado. La nota de
 * aviso solo aparece si el record trae dueHint (recordatorio potencial).
 * Acción: perfecto → complete; cambiar algo → vuelve al chat.
 */
import { Check, BellRing, Pencil } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-saved.css";

type SavedBlock = Extract<UiBlock, { type: "saved_record" }>;

/** Código de comprobante determinista (presentación, no dato). */
function receiptCode(title: string, collection?: string): string {
  const seed = `${title}|${collection ?? ""}`.toLowerCase();
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const letters = (collection ?? "koru").replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "KR";
  return `${letters}-${h.toString(36).toUpperCase().slice(0, 4)}`;
}

/** Alturas de barcode deterministas a partir del código. */
function barsOf(code: string): number[] {
  return code.split("").map((c) => 8 + (c.charCodeAt(0) % 23));
}

export function SavedInterior({ block, onClose, onSave }: LecturaInteriorProps<SavedBlock>) {
  const record = block.records?.[0];
  const title = block.title || "Guardado";
  const rows: Array<{ label: string; value: string }> = [];
  if (record?.collection) rows.push({ label: "Colección", value: record.collection });
  if (record?.person) rows.push({ label: "Persona", value: record.person });
  if (record?.value) rows.push({ label: "Detalle", value: record.value });
  if (record?.amount != null)
    rows.push({
      label: "Monto",
      value: `${record.amount} ${record.currency ?? ""}`.trim(),
    });
  if (record?.dueHint) rows.push({ label: "Cuándo", value: record.dueHint });
  if (record?.url) {
    try {
      rows.push({ label: "Enlace", value: new URL(record.url).hostname });
    } catch {
      /* url no parseable — no se muestra */
    }
  }
  if (record?.notes) rows.push({ label: "Nota", value: record.notes.slice(0, 80) });
  const code = record ? receiptCode(record.title, record.collection) : "KR-0000";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, record?.collection) : undefined}
      chip={{ label: "Guardado", background: "linear-gradient(135deg,#6ee7b7,#059669)" }}
      ariaLabel={title}
    >
      <div id="p-saved" className="lcr-panel">
        <div className="ev-head rv">
          <h1>
            <small>Sin pasos extra</small>
            Ya quedó
            <br />
            en tu agenda
          </h1>
          <p>
            {record
              ? "No te pedí confirmar nada: lo guardé y esto es el comprobante."
              : "Lo guardé — esto es el comprobante."}
          </p>
        </div>

        <div className="tkk-hero rv">
          <span className="cutl"></span>
          <span className="cutr"></span>
          <div className="tkk-top">
            <div className="ok">
              <Ic i={Check} className="ic" />
            </div>
            <div className="tq">{record?.title ?? title}</div>
            <div className="ts">
              {record?.collection ? `Guardado en ${record.collection}` : title}
            </div>
          </div>
          <span className="tkk-stamp">CONFIRMADO</span>
          <div className="tkk-lines">
            {rows.map((row) => (
              <div className="trow" key={`row_${row.label}`}>
                <span className="tn">{row.label}</span>
                <span className="dots"></span>
                <span className="tv">{row.value}</span>
              </div>
            ))}
            <div className="trow total">
              <span className="tn">Estado</span>
              <span className="dots"></span>
              <span className="tv">LISTO</span>
            </div>
          </div>
          <div className="tkk-code">
            <div className="bars">
              {barsOf(code).map((h, i) => (
                <i key={`bar_${i}`} style={{ height: `${h}px` }} />
              ))}
            </div>
            <div className="cn">{code}</div>
          </div>
        </div>

        {record?.dueHint && (
          <div className="tkk-note rv">
            <Ic i={BellRing} className="ic" />
            <p>
              Te lo recuerdo para <b>{record.dueHint}</b> con tiempo de sobra. Si querés cambiar
              algo, decime y lo rehago — <b>el código no cambia</b>.
            </p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={Check} className="ic" />
            Perfecto, gracias
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={Pencil} className="ic" />
            Cambiar algo
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
