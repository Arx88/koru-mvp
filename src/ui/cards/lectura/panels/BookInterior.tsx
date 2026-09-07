/**
 * BookInterior — card "Lectura de noche" (#p-book), bind real del block
 * `book_review` (Open Library).
 *
 * Mesita de luz: cover real del tool, autor/año/páginas/editorial/ISBN
 * como rows reales, rating→estrellas + "4,6/5" explícito, vista previa
 * abre previewUrl (embed de Open Library/Archive.org). Toggle "Lo quiero
 * leer" (aria-pressed) → create_commitment real vía la barra de acciones.
 */
import { useState } from "react";
import { BookOpen, Building2, Calendar, Check, Hash, Quote, ShoppingBag, Star, User, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-book.css";

type BookBlock = Extract<UiBlock, { type: "book_review" }>;

export function BookInterior({ block, onClose, onSave }: LecturaInteriorProps<BookBlock>) {
  const title = block.title ?? "Libro";
  const rating = block.rating;
  const stars = rating != null ? Math.max(1, Math.round(rating)) : 0;
  const StarIcon: LucideIcon = Star;
  // Toggle real de intención de lectura → commitment durable.
  const [wantToRead, setWantToRead] = useState(false);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.author) : undefined}
      chip={{ label: "Lectura", background: "linear-gradient(135deg,#f6bd6d,#f59e0b)" }}
      ariaLabel={title}
    >
      <div id="p-book" className="lcr-panel">
        <div className="bk-head rv">
          <h1>
            <small>Tu lectura{block.genre ? ` de ${block.genre.toLowerCase()}` : " de noche"}</small>
            {title}
          </h1>
          <p>{block.synopsis}</p>
        </div>

        <div className="bk-night rv">
          {block.cover ? (
            <img src={block.cover} alt={title} />
          ) : (
            <img src="/stitch/outfits/book-stack.jpg" alt="Libros con luz de lectura" />
          )}
          {block.previewUrl && (
            <span className="open"><Ic i={BookOpen} className="ic" />vista previa disponible</span>
          )}
          <div className="in">
            <span className="k">{rating != null ? "Recomendado" : "En tu lista"}</span>
            <h3>{title}</h3>
            <span className="a">
              {[block.author, block.year, block.pages ? `${block.pages} páginas` : null].filter(Boolean).join(" · ")}
            </span>
            {rating != null && (
              <div className="st3" style={{ marginTop: 6 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ic key={i} i={StarIcon} className={`ic${i >= stars ? " off" : ""}`} />
                ))}
                <b style={{ marginLeft: 6 }}>{String(rating).replace(".", ",")}/5</b>
              </div>
            )}
          </div>
        </div>

        {block.synopsis && (
          <div className="bk-quote rv">
            <span className="qi"><Ic i={Quote} className="ic" /></span>
            <p>{block.synopsis}</p>
            <span>— la sinopsis de la editorial</span>
          </div>
        )}

        <div className="bk-rows rv">
          {block.author && (
            <div className="bk-row">
              <div className="ic" style={{ background: "var(--mint-soft)", color: "var(--mint-ink)" }}><Ic i={User} className="ic" /></div>
              <div className="tx"><b>{block.author}</b><span>autoría</span></div>
            </div>
          )}
          {block.publisher && (
            <div className="bk-row">
              <div className="ic" style={{ background: "var(--violet-soft)", color: "var(--violet-ink)" }}><Ic i={Building2} className="ic" /></div>
              <div className="tx"><b>{block.publisher}{block.year ? ` · ${block.year}` : ""}</b><span>edición</span></div>
            </div>
          )}
          {block.isbn && (
            <div className="bk-row">
              <div className="ic" style={{ background: "var(--sky-soft)", color: "var(--sky-ink)" }}><Ic i={Hash} className="ic" /></div>
              <div className="tx"><b>{block.isbn}</b><span>ISBN</span></div>
            </div>
          )}
          {block.pages != null && (
            <div className="bk-row">
              <div className="ic" style={{ background: "var(--honey-soft)", color: "var(--honey-ink)" }}><Ic i={Calendar} className="ic" /></div>
              <div className="tx"><b>{block.pages} páginas</b><span>extensión</span></div>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!block.previewUrl}
            onClick={() => { if (block.previewUrl) window.open(block.previewUrl, "_blank", "noopener,noreferrer"); }}
          >
            <Ic i={BookOpen} className="ic" />{block.previewUrl ? "Leer vista previa" : "Sin vista previa"}
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-pressed={wantToRead}
            onClick={() => {
              const next = !wantToRead;
              setWantToRead(next);
              if (next) {
                dispatchCardAction("create_commitment", block, {
                  title: `Leer “${title}”`,
                  dueHint: block.pages ? `${block.pages} páginas · ${block.author ?? "lectura"}` : undefined,
                });
              }
            }}
          >
            <Ic i={wantToRead ? Check : ShoppingBag} className="ic" />
            {wantToRead ? "En tu lista de lectura" : "Lo quiero leer"}
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
