/**
 * ReviewQuoteInterior — card "Cita de la fuente" (#p-quote), bind real del
 * block `review_quote` (sourceName + sourceType + quote + tags).
 *
 * Pieza del flujo de reviews (airpods, switch…): la cita textual de una
 * fuente. Antes caía al render genérico viejo; ahora es un "recorte de
 * prensa": comillas gigantes en display, cita en itálica, atribución con
 * fuente y tipo, tags como chips. Sin quote no se renderiza texto falso.
 */
import { Quote, BookOpen, Tags, Bookmark, ArrowLeft } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-quote.css";

type QuoteBlock = Extract<UiBlock, { type: "review_quote" }>;

export function ReviewQuoteInterior({ block, onClose, onSave }: LecturaInteriorProps<QuoteBlock>) {
  const quote = String(block.quote ?? "").trim();
  const sourceName = String(block.sourceName ?? "").trim();
  const sourceType = String(block.sourceType ?? "").trim();
  const tags = (block.tags ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
  const buttonLabel = String(block.buttonLabel ?? "").trim();

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(sourceName || "Cita de reseña", quote.slice(0, 60)) : undefined}
      chip={{ label: "Reseña", background: "linear-gradient(135deg,#8B6DFF,#6D52F8)" }}
      ariaLabel={sourceName || "Cita de reseña"}
    >
      <div id="p-quote" className="lcr-panel">
        <div className="q-head rv">
          <h1>
            <small>Lo que dicen</small>
            {sourceName || "La fuente"}
          </h1>
          <p>
            {sourceType
              ? `${sourceType} · cita textual, palabra por palabra.`
              : "Cita textual de la fuente, palabra por palabra."}
          </p>
        </div>

        <figure className="q-clip rv">
          <span className="qmark" aria-hidden="true">
            <Ic i={Quote} className="ic" />
          </span>
          {quote ? (
            <blockquote>{quote}</blockquote>
          ) : (
            <blockquote className="empty">La cita llega vacía — nada inventado acá.</blockquote>
          )}
          <figcaption>
            <Ic i={BookOpen} className="ic" />
            {sourceName || "Fuente sin nombre"}
            {sourceType && <em>· {sourceType}</em>}
          </figcaption>
        </figure>

        {tags.length > 0 && (
          <div className="q-tags rv">
            <div className="q-tags-label">
              <Ic i={Tags} className="ic" />
              Temas
            </div>
            <div className="q-chips">
              {tags.map((t) => (
                <span key={`qt_${t}`} className="q-chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => (onSave ? onSave(sourceName || "Cita de reseña", quote.slice(0, 60)) : onClose())}
          >
            <Ic i={Bookmark} className="ic" />
            {buttonLabel || "Guardar la cita"}
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
