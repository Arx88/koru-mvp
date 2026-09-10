/**
 * WebNavInterior — card "Búsqueda web" (#p-nav), bind real del block
 * `web_nav` (query + summary + findings + results con URLs).
 *
 * El "informe de búsqueda": síntesis arriba, hallazgos como filas, y cada
 * resultado como ficha linkeable con fuente, tiempo de lectura y snippet.
 * Todo del block — sin results no se inventan enlaces.
 */
import { Search, Lightbulb, FileText, ExternalLink, ArrowLeft, Compass } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-nav.css";

type WebNavBlock = Extract<UiBlock, { type: "web_nav" }>;

type NavResult = NonNullable<WebNavBlock["results"]>[number];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function WebNavInterior({ block, onClose, onSave }: LecturaInteriorProps<WebNavBlock>) {
  const results = (block.results ?? []).filter((r) => r && /^https?:\/\//i.test(String(r.url ?? "")));
  const findings = (block.findings ?? []).map((f) => String(f).trim()).filter(Boolean);
  const title = String(block.title ?? "").trim() || `Búsqueda: ${String(block.query ?? "").trim() || "web"}`;
  const firstResult = results[0];

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, block.summary?.slice?.(0, 60) ?? `${results.length} fuentes`) : undefined}
      chip={{ label: "Búsqueda", background: "linear-gradient(135deg,#8ab0ff,#1A237E)" }}
      ariaLabel={title}
    >
      <div id="p-nav" className="lcr-panel">
        <div className="nav-head rv">
          <h1>
            <small>{block.status === "report" ? "Informe web" : "Esto encontré"}</small>
            {title.length > 46 ? title.slice(0, 44).trimEnd() + "…" : title}
          </h1>
          {block.query && <p className="nav-query"><Ic i={Search} className="ic" /> {String(block.query)}</p>}
        </div>

        {block.summary && (
          <div className="nav-synth rv">
            <Ic i={Compass} className="ic" />
            <p>{String(block.summary)}</p>
          </div>
        )}

        {findings.length > 0 && (
          <div className="nav-findings rv">
            <div className="nav-sub">
              <Ic i={Lightbulb} className="ic" />
              Hallazgos
            </div>
            {findings.map((f, i) => (
              <div key={`f_${i}`} className="nav-find">
                <span className="idx">{i + 1}</span>
                <p>{f}</p>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="nav-results rv">
            <div className="nav-sub">
              <Ic i={FileText} className="ic" />
              Fuentes ({results.length})
            </div>
            {results.map((r: NavResult, i) => {
              const domain = domainOf(String(r.url));
              return (
                <a
                  key={`r_${i}`}
                  className="nav-card"
                  href={String(r.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="nav-card-top">
                    <span className="dom">{domain || String(r.source ?? "fuente")}</span>
                    {r.readTime && <span className="rt">{String(r.readTime)}</span>}
                  </div>
                  <b>{String(r.title ?? "Sin título")}</b>
                  {r.snippet && <p>{String(r.snippet)}</p>}
                  <span className="open">
                    <Ic i={ExternalLink} className="ic" />
                    Abrir
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {results.length === 0 && (
          <div className="nav-empty rv">
            <Ic i={Search} className="ic" />
            <p>Esta búsqueda no devolvió fuentes linkeables — nada inventado.</p>
          </div>
        )}

        <div className="actions">
          {firstResult ? (
            <a className="btn primary" href={String(firstResult.url)} target="_blank" rel="noopener noreferrer">
              <Ic i={ExternalLink} className="ic" />
              Abrir la primera
            </a>
          ) : (
            <button type="button" className="btn primary" onClick={() => onClose()}>
              <Ic i={Compass} className="ic" />
              Entendido
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
