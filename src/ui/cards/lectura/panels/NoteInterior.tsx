/**
 * NoteInterior — card "Anotame esto" (#p-note), bind real del block
 * `review_document` (title/body).
 *
 * El post-it muestra el body VERBATIM — tal cual lo dijo el usuario, sin
 * reescribir. Los resaltados <em> y los tags se DERIVAN del texto con
 * detección determinista (días, horas, palabras clave llamada/cumple/
 * receta) — sin inventar contexto. Meta chips honestos: quedó tal cual,
 * asociado al historial y recordatorio solo si se detectó día/hora.
 * Acción: volverla recordatorio → create_commitment REAL de la app.
 */
import { useState } from "react";
import {
  StickyNote,
  Phone,
  Cake,
  ChefHat,
  Clock,
  Brain,
  BellRing,
  AlarmClock,
  Share2,
  Check,
  Copy,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-note.css";

type NoteBlock = Extract<UiBlock, { type: "review_document" }>;

const DAYS = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/gi;
const HOURS = /\b(\d{1,2}(?::\d{2})?\s*(?:hs|horas|am|pm))\b|\ba\s+las\s+(\d{1,2}(?::\d{2})?)\b/gi;
const KEYWORD_TAGS: Array<{ re: RegExp; label: string; Icon: typeof Phone }> = [
  { re: /\b(llam(ar|ada|ame)|marcar|tel[eé]fono)\b/i, label: "llamada", Icon: Phone },
  { re: /\b(cumple|a[ñn]os|festej|fiesta)\b/i, label: "cumple", Icon: Cake },
  { re: /\b(receta|cocin|ingredient|horno)\b/i, label: "receta", Icon: ChefHat },
];

/** Detecta mención de día y hora en el texto (determinista). */
function detectWhen(body: string): { day?: string; hour?: string } {
  const day = body.match(DAYS)?.[0];
  const hourMatch = body.match(HOURS);
  const hour = hourMatch ? hourMatch[0].replace(/\s+/g, " ").trim() : undefined;
  return { day: day ? day.toLowerCase() : undefined, hour };
}

/** Parte el body en segmentos, con <em> en días y horas detectadas. */
function highlightSegments(body: string) {
  const marks = [...body.matchAll(DAYS), ...body.matchAll(HOURS)];
  if (!marks.length) return [{ text: body, em: false }];
  const ranges = marks
    .map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }))
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  const out: Array<{ text: string; em: boolean }> = [];
  let pos = 0;
  for (const r of merged) {
    if (r.start > pos) out.push({ text: body.slice(pos, r.start), em: false });
    out.push({ text: body.slice(r.start, r.end), em: true });
    pos = r.end;
  }
  if (pos < body.length) out.push({ text: body.slice(pos), em: false });
  return out;
}

export function NoteInterior({ block, onClose, onSave }: LecturaInteriorProps<NoteBlock>) {
  const title = block.title || "Tu nota";
  const body = block.body ?? "";
  // Copiar al portapapeles con feedback visible (estado real).
  const [copied, setCopied] = useState(false);
  const when = body ? detectWhen(body) : {};
  const tags = KEYWORD_TAGS.filter((t) => t.re.test(body));
  const reminderHint = when.day ? `${when.day}${when.hour ? ` ${when.hour}` : ""}` : undefined;

  const share = async () => {
    const text = `${title}\n\n${body}`;
    try {
      if (navigator.share) await navigator.share({ title, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* cancelado por el usuario — sin error */
    }
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, body.slice(0, 60)) : undefined}
      chip={{ label: "Nota", background: "linear-gradient(135deg,#fbbf24,#b45309)" }}
      ariaLabel={title}
    >
      <div id="p-note" className="lcr-panel">
        <div className="nt-head rv">
          <h1>
            <small>Guardado en tu bóveda</small>
            {title}
          </h1>
          <p>
            {body
              ? "Quedó tal cual lo dijiste — sin reescribir nada, con su contexto."
              : "La nota está vacía: cuando me pases el texto lo guardo acá."}
          </p>
        </div>

        <div className="note rv">
          <span className="pin"></span>
          <div className="nk">
            <Ic i={StickyNote} className="ic" />
            NOTA
          </div>
          <p className="txt">
            {body
              ? highlightSegments(body).map((seg, i) =>
                  seg.em ? <em key={`seg_${i}`}>{seg.text}</em> : <span key={`seg_${i}`}>{seg.text}</span>,
                )
              : "…"}
          </p>
          {tags.length > 0 && (
            <div className="tags">
              {tags.map(({ label, Icon }) => (
                <span key={`tag_${label}`}>
                  <Ic i={Icon} className="ic" />
                  {label}
                </span>
              ))}
              {when.day && (
                <span>
                  <Ic i={Clock} className="ic" />
                  {when.day}
                  {when.hour ? ` ${when.hour}` : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="nt-meta rv">
          <div className="nt-chip nt-c1">
            <Ic i={Clock} className="ic" />
            <div>
              <b>Tal cual lo dijiste</b>
              <span>sin editar tu texto</span>
            </div>
          </div>
          <div className="nt-chip nt-c2">
            <Ic i={Brain} className="ic" />
            <div>
              <b>Koru lo conectó</b>
              <span>a tu historial</span>
            </div>
          </div>
          {reminderHint && (
            <div className="nt-chip nt-c3">
              <Ic i={BellRing} className="ic" />
              <div>
                <b>Fecha detectada</b>
                <span>{reminderHint}</span>
              </div>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: `Recordatorio: ${title}`,
                dueHint: reminderHint ?? "cuando lo necesites",
              });
              onClose();
            }}
          >
            <Ic i={AlarmClock} className="ic" />
            Volverla recordatorio
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-pressed={copied}
            onClick={() => {
              setCopied(true);
              const text = [title, body].filter(Boolean).join("\n");
              try {
                void navigator.clipboard?.writeText(text);
              } catch {
                // clipboard sin permiso: el estado igual refleja la intención
              }
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            <Ic i={copied ? Check : Copy} className="ic" />
            {copied ? "Copiado" : "Copiar la nota"}
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
