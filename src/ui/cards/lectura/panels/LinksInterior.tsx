/**
 * LinksInterior — card "La lectura pendiente" (#p-links), bind real del
 * block `research_sources` (title/summary/sources).
 *
 * Las sources[] REALES arman la biblioteca: título, dominio y snippet de
 * cada una. El preview fotográfico usa el imageUrl REAL de la source
 * (og:image) — sin imagen no se inventa nada (inicial del dominio). La
 * primera va como pin (destacada). Tocar una fila abre su url real.
 * El summary y el followUpQuestion del block van como cierre.
 */
import { Link, Globe, ChevronRight, Lock, Share2, ExternalLink } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-links.css";

type LinksBlock = Extract<UiBlock, { type: "research_sources" }>;

export function LinksInterior({ block, onClose, onSave }: LecturaInteriorProps<LinksBlock>) {
  const sources = block.sources ?? [];
  const title = block.title || "Tus enlaces guardados";

  const open = (url: string) => {
    try {
      window.open(url, "_blank", "noopener");
    } catch {
      /* el sandbox puede bloquear window.open — sin error */
    }
  };

  const share = async () => {
    const list = sources.map((s) => `- ${s.title} (${s.domain})`).join("\n");
    const text = `${title}\n\n${list}`;
    try {
      if (navigator.share) await navigator.share({ title, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* cancelado */
    }
  };

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, `${sources.length} enlaces`) : undefined}
      chip={{ label: "Enlaces", background: "linear-gradient(135deg,#7dd3fc,#0369a1)" }}
      ariaLabel={title}
    >
      <div id="p-links" className="lcr-panel">
        <div className="lk2-head rv">
          <h1>
            <small>Guardado para después</small>
            {title}
          </h1>
          <p>
            {sources.length > 0
              ? `${sources.length} fuentes verificadas${
                  sources.length > 1
                    ? ` · ${[...new Set(sources.map((s) => s.domain).filter(Boolean))].slice(0, 3).join(" · ")}`
                    : ""
                } — tocá cualquiera para abrir la original.`
              : block.summary ||
                "Todavía no guardamos enlaces de este tema."}
          </p>
        </div>

        <div className="lk2-board rv">
          <div className="lk2-top">
            <div className="t">
              <div className="icb">
                <Ic i={Link} className="ic" />
              </div>
              <b>Biblioteca de enlaces</b>
            </div>
            <span className="cnt3">{sources.length} guardados</span>
          </div>

          {sources.map((s, i) => (
            <button
              type="button"
              className={`lk2-row${i === 0 ? " pin" : ""}`}
              key={`src_${i}_${s.url}`}
              onClick={() => open(s.url)}
              style={{ textAlign: "left", width: "100%", background: undefined, border: undefined }}
            >
              <div className="th">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt={s.title} />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "100%",
                      height: "100%",
                      font: "800 15px var(--disp)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {(s.domain || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="ty">
                  <Ic i={Globe} className="ic" />
                  {(s.domain || "web").toUpperCase().slice(0, 14)}
                </span>
              </div>
              <div className="tx">
                <b>{s.title}</b>
                <span>
                  <Ic i={Lock} className="ic" />
                  {s.domain}
                  {s.snippet ? ` · ${s.snippet.slice(0, 42)}${s.snippet.length > 42 ? "…" : ""}` : ""}
                </span>
              </div>
              <span className="go">
                <Ic i={ChevronRight} className="ic" />
              </span>
            </button>
          ))}
        </div>

        {block.followUpQuestion && (
          <div className="fx2-note rv" style={{ marginTop: "12px" }}>
            <Ic i={ExternalLink} className="ic" />
            <p>{block.followUpQuestion}</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={sources.length === 0 || !sources[0]?.url}
            onClick={() => sources[0]?.url && open(sources[0].url)}
          >
            <Ic i={ExternalLink} className="ic" />
            Abrir el destacado
          </button>
          <button type="button" className="btn ghost" onClick={() => void share()}>
            <Ic i={Share2} className="ic" />
            Compartir lista
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
