/**
 * MovieInterior — card "Película" (#p-movie), bind real del block
 * `movie_review` (TMDB enriquecido).
 *
 * Cartelera nocturna: póster real del tool, rating → estrellas, géneros
 * chips, streaming/whereToWatch reales, director/reparto. "Ver tráiler"
 * abre trailerUrl real; guardar delega en onSave.
 */
import { Calendar, Clapperboard, Clock, Play, Star, Users, Volume2, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-movie.css";

type MovieBlock = Extract<UiBlock, { type: "movie_review" }>;

export function MovieInterior({ block, onClose, onSave }: LecturaInteriorProps<MovieBlock>) {
  const title = block.title ?? "Película";
  const rating = block.rating ?? block.ratings?.[0]?.score;
  const stars = rating != null ? Math.max(1, Math.round(rating / 2)) : 0;
  const StarIcon: LucideIcon = Star;
  const where = block.whereToWatch ?? block.streaming?.map((s) => s.provider) ?? [];
  const hasTrailer = !!block.trailerUrl;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.genres?.[0]) : undefined}
      chip={{ label: "Cine", background: "linear-gradient(135deg,#6D52F8,#6D52F8)" }}
      ariaLabel={title}
    >
      <div id="p-movie" className="lcr-panel">
        <div className="mv-head rv">
          <h1>
            <small>La sugerencia de esta noche</small>
            {title}
          </h1>
          <p>{block.overview}</p>
        </div>

        {block.poster && (
          <div className="mv-photo rv">
            <img src={block.poster} alt={title} />
            <span className="q">
              <Ic i={Clapperboard} className="ic" />
              {block.runtime ?? ""}{block.releaseDate ? ` · ${block.releaseDate.slice(0, 4)}` : ""}
            </span>
            <div className="in">
              <span className="k">Hoy te recomiendo</span>
              <h3>{title}</h3>
              <div className="g">
                {(block.genres ?? []).slice(0, 3).map((g) => <span key={g}>{g.toUpperCase()}</span>)}
              </div>
            </div>
          </div>
        )}

        {rating != null && (
          <div className="mv-verdict rv">
            <div className="stars">
              <div className="st3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ic key={i} i={StarIcon} className={`ic${i >= stars ? " off" : ""}`} />
                ))}
              </div>
              <b>{String(rating).replace(".", ",")}</b>
              <span>
                {block.ratings && block.ratings.length > 0
                  ? block.ratings.slice(0, 2).map((r) => `${r.source} ${r.score}/${r.outOf}`).join(" · ")
                  : block.ratingCount
                    ? `${block.ratingCount.toLocaleString("es")} votos`
                    : "rating TMDB"}
              </span>
            </div>
            <p>{block.overview}</p>
          </div>
        )}

        <div className="mv-rows rv">
          {where.length > 0 && (
            <div className="mv-row">
              <div className="ic" style={{ background: "var(--mint-soft)", color: "var(--mint-ink)" }}><Ic i={Play} className="ic" /></div>
              <div className="tx"><b>Disponible en</b><span>{where.slice(0, 3).join(" · ")}</span></div>
              <span className="where">STREAMING</span>
            </div>
          )}
          {block.runtime && (
            <div className="mv-row">
              <div className="ic" style={{ background: "var(--sky-soft)", color: "var(--sky-ink)" }}><Ic i={Clock} className="ic" /></div>
              <div className="tx"><b>Duración</b><span>{block.runtime}</span></div>
            </div>
          )}
          {(block.director || block.cast) && (
            <div className="mv-row">
              <div className="ic" style={{ background: "var(--violet-soft)", color: "var(--violet-ink)" }}><Ic i={Users} className="ic" /></div>
              <div className="tx">
                <b>{block.director ?? "Reparto"}</b>
                <span>{block.cast?.slice(0, 3).join(", ")}</span>
              </div>
            </div>
          )}
          {block.boxOffice && (
            <div className="mv-row">
              <div className="ic" style={{ background: "var(--honey-soft)", color: "var(--honey-ink)" }}><Ic i={Volume2} className="ic" /></div>
              <div className="tx"><b>Taquilla</b><span>{block.boxOffice}</span></div>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!hasTrailer}
            onClick={() => { if (block.trailerUrl) window.open(block.trailerUrl, "_blank", "noopener,noreferrer"); }}
          >
            <Ic i={Play} className="ic" />{hasTrailer ? "Ver tráiler" : "Sin tráiler"}
          </button>
          <button type="button" className="btn ghost" onClick={() => (onSave ? onSave(title, block.genres?.[0]) : onClose())}>
            <Ic i={Calendar} className="ic" />Guardar para el finde
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
