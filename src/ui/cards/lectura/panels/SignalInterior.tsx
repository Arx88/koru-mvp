/**
 * SignalInterior — card "Aviso de Koru" (#p-signal), bind real del block
 * `proactive_signal` (category + severity + title + body + summaryItems +
 * sources + timestampLabel + followUpQuestion).
 *
 * "Koru te avisa antes de que preguntes": banda de color por severidad,
 * título y cuerpo, cifras clave como filas, fuentes linkeables, y la
 * pregunta de seguimiento mostrada como lo que es — la pregunta de Koru.
 * Acciones: enterado (dismiss) + volver.
 */
import { BellRing, Clock, ExternalLink, ArrowLeft, HelpCircle, ShieldAlert } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-signal.css";

type SignalBlock = Extract<UiBlock, { type: "proactive_signal" }>;

const SEVERITY_STYLE: Record<string, { label: string; chip: string; band: string }> = {
  info: { label: "Info", chip: "linear-gradient(135deg,#8ab0ff,#5170d8)", band: "linear-gradient(90deg,#8ab0ff,#5170d8)" },
  useful: { label: "Útil", chip: "linear-gradient(135deg,#6ee7b7,#059669)", band: "linear-gradient(90deg,#6ee7b7,#059669)" },
  important: { label: "Importante", chip: "linear-gradient(135deg,#f6bd6d,#b45309)", band: "linear-gradient(90deg,#f6bd6d,#b45309)" },
  urgent: { label: "Urgente", chip: "linear-gradient(135deg,#ff8fb8,#c62b46)", band: "linear-gradient(90deg,#e6566e,#c62b46)" },
};

const CATEGORY_LABEL: Record<string, string> = {
  world: "Mundo",
  news: "Noticias",
  market: "Mercados",
  weather: "Clima",
  traffic: "Tráfico",
  health: "Salud",
  relationship: "Gente",
  home: "Casa",
  package: "Paquetería",
  sports: "Deportes",
  general: "Aviso",
};

export function SignalInterior({ block, onClose, onSave }: LecturaInteriorProps<SignalBlock>) {
  const sev = SEVERITY_STYLE[block.severity ?? "info"] ?? SEVERITY_STYLE.info;
  const catLabel = CATEGORY_LABEL[block.category] ?? "Aviso";
  const items = (block.summaryItems ?? []).filter((it) => it && String(it.label ?? "").trim());
  const sources = (block.sources ?? []).filter(Boolean);
  const firstSource = sources.find((s) => /^https?:\/\//i.test(String(s?.url ?? "")));

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title || "Aviso de Koru", catLabel) : undefined}
      chip={{ label: catLabel, background: sev.chip }}
      ariaLabel={block.title || "Aviso de Koru"}
    >
      <div id="p-signal" className="lcr-panel">
        <div className="sg-hero rv">
          <div className="sg-band" style={{ background: sev.band }} aria-hidden="true" />
          <div className="sg-icon">
            <Ic i={block.severity === "urgent" || block.severity === "important" ? ShieldAlert : BellRing} className="ic" />
          </div>
          <div className="sg-meta">
            <span className="sg-cat">
              {catLabel} · {sev.label}
            </span>
            <h1>{String(block.title ?? "Aviso de Koru")}</h1>
            {block.timestampLabel && (
              <span className="sg-time">
                <Ic i={Clock} className="ic" />
                {String(block.timestampLabel)}
              </span>
            )}
          </div>
        </div>

        {block.body && (
          <div className="sg-body rv">
            <p>{String(block.body)}</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="sg-facts rv">
            <div className="sg-sub">Las cifras clave</div>
            {items.map((it, i) => (
              <div key={`sg_${i}`} className="sg-row">
                <span>{String(it.label)}</span>
                <b>{String(it.value ?? "—")}</b>
                {it.detail && <em>{String(it.detail)}</em>}
              </div>
            ))}
          </div>
        )}

        {block.followUpQuestion && (
          <div className="sg-question rv">
            <Ic i={HelpCircle} className="ic" />
            <div>
              <b>Koru te pregunta</b>
              <span>{String(block.followUpQuestion)}</span>
            </div>
          </div>
        )}

        {sources.length > 0 && (
          <div className="sg-sources rv">
            <div className="sg-sub">Fuentes</div>
            {sources.slice(0, 4).map((s, i) => {
              const url = String(s?.url ?? "");
              const ok = /^https?:\/\//i.test(url);
              return ok ? (
                <a key={`src_${i}`} className="sg-src" href={url} target="_blank" rel="noopener noreferrer">
                  <Ic i={ExternalLink} className="ic" />
                  {String(s?.domain ?? s?.title ?? "fuente")}
                </a>
              ) : (
                <span key={`src_${i}`} className="sg-src is-plain">
                  <Ic i={ShieldAlert} className="ic" />
                  {String(s?.title ?? "fuente")}
                </span>
              );
            })}
          </div>
        )}

        <div className="actions">
          {firstSource ? (
            <a className="btn primary" href={String(firstSource.url)} target="_blank" rel="noopener noreferrer">
              <Ic i={ExternalLink} className="ic" />
              Ver la fuente
            </a>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                dispatchCardAction("dismiss", block);
                onClose();
              }}
            >
              <Ic i={BellRing} className="ic" />
              Enterado, gracias
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={ArrowLeft} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
