/**
 * ReminderInterior — card "Recordatorio" (#p-rem), bind real del block
 * `reminder` (el recordatorio mínimo: title + dueText + note).
 *
 * Hasta ahora su "Ver más" caía al render genérico de KoruDetailScreen
 * (estética Kimi oscura vieja). Este interior lo trae al lenguaje Lectura
 * Visual: fecha grande en display, título, nota de Koru si existe.
 * Todo viene del block — sin dueText no se inventa hora.
 * Acciones: complete (marca el commitment coincidente como hecho) + volver.
 */
import { Bell, CheckCheck, Brain, ArrowLeft } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-rem.css";

type ReminderBlock = Extract<UiBlock, { type: "reminder" }>;

/** "Hoy 16:00" → {lead:"Hoy", big:"16:00"} · "mañana 9:30" → {lead:"mañana", big:"9:30"} */
function splitDue(dueText?: string): { lead: string; big: string } | null {
  const raw = String(dueText ?? "").trim();
  if (!raw) return null;
  // Caso "solo hora": "16:00", "a las 9"
  if (/^\d{1,2}[:h]\d{2}(am|pm)?$/i.test(raw)) return { lead: "Hoy", big: raw };
  const m = raw.match(/^(.+?)\s+(\d{1,2}[:h]\d{2}(?:\s?(?:am|pm))?)$/i);
  if (m) return { lead: m[1].replace(/\ba las\b/i, "").trim() || "Cuando sea", big: m[2].trim() };
  // Sin hora parseable: todo es el "lead" (ej. "antes del sábado")
  return { lead: raw, big: "" };
}

export function ReminderInterior({ block, onClose, onSave }: LecturaInteriorProps<ReminderBlock>) {
  const due = splitDue(block.dueText);
  const title = String(block.title ?? "").trim() || "Tu recordatorio";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.dueText) : undefined}
      chip={{ label: "Recordatorio", background: "linear-gradient(135deg,#fda4af,#e6566e)" }}
      ariaLabel={title}
    >
      <div id="p-rem" className="lcr-panel">
        <div className="rem-head rv">
          <h1>
            <small>Anotado</small>
            {title}
          </h1>
          <p>
            {due
              ? "Michi te avisa cuando llegue el momento. Tocá «ya está» cuando lo hagas."
              : "Michi te lo tiene presente. Sin fecha concreta, no inventa una."}
          </p>
        </div>

        <div className="rem-hero rv">
          <div className="rem-bell">
            <Ic i={Bell} className="ic" />
            <span className="pulse" aria-hidden="true" />
          </div>
          <div className="rem-when">
            {due ? (
              <>
                <span className="lead">{due.lead}</span>
                {due.big && <b className="big">{due.big}</b>}
              </>
            ) : (
              <b className="big small">Sin hora fija</b>
            )}
          </div>
          <div className="rem-title">{title}</div>
        </div>

        {block.note && (
          <div className="rem-note rv">
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
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={CheckCheck} className="ic" />
            Ya está, hecho
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
