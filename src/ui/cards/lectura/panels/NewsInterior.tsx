/**
 * NewsInterior — card "Noticias" (#p-news), integrada al block real
 * `news_urgent` (una noticia urgente con timeline y fact-checks).
 *
 * Concepto: portada de diario — masthead con verificación real (nº de
 * fuentes del block + factChecks), la historia como lead, timeline del
 * evento en columnas (status done/current/pending) y verificación de
 * claims. Foto solo si el block trae imagen (hoy no la trae: honesto).
 */
import { BadgeCheck, CheckCheck, FileText, History, ShieldCheck, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-news.css";

type NewsBlock = Extract<UiBlock, { type: "news_urgent" }>;

const STATUS_LABEL: Record<string, string> = {
  done: "confirmado",
  current: "ahora",
  pending: "pendiente",
};

export function NewsInterior({ block, onClose, onSave }: LecturaInteriorProps<NewsBlock>) {
  const sources = block.sources ?? [];
  const timeline = block.timeline ?? [];
  const factChecks = block.factChecks ?? [];
  const lastUpdated = block.lastUpdated ?? new Intl.DateTimeFormat("es", { day: "numeric", month: "long" }).format(new Date());
  // foto de portada: la primera fuente del tool con og:image real
  const imageUrl = sources.find((s) => s.imageUrl)?.imageUrl;
  const domains = sources.map((s) => s.domain).filter(Boolean);
  const HistIcon: LucideIcon = History;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.headline ?? "Noticia", block.category) : undefined}
      chip={{ label: block.severity === "breaking" ? "Última hora" : "Noticias", background: "linear-gradient(135deg,#8ab0ff,#1A237E)" }}
      ariaLabel={block.headline ?? "Noticia"}
    >
      <div id="p-news" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small style={{ display: "block", font: "700 11px var(--sans)", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--sky-ink)", marginBottom: "5px" }}>
              {block.category ?? "Actualidad"} · solo lo tuyo
            </small>
            {block.severity === "breaking" ? "Última hora" : "Lo que importa ahora"}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {sources.length > 0
              ? `Filtré ${sources.length} fuente${sources.length === 1 ? "" : "s"} por tus temas. Esto es lo que vale tu atención.`
              : "Lo que los medios coinciden en señalar ahora."}
          </p>
        </div>

        <div className="np-paper rv">
          <div className="np-mast">
            <div className="mk">
              <b>{factChecks.length > 0 ? "VERIFICADO" : "EN SEGUIMIENTO"}</b>
              {sources.length > 0 && <><span>·</span><span>{sources.length} FUENTES</span></>}
              <span>·</span><span>EDI. AHORA</span>
            </div>
            <h1>El Digesto</h1>
            <div className="md">actualizado {lastUpdated}</div>
          </div>

          {imageUrl && (
            <div className="np-photo rv">
              <img src={imageUrl} alt={block.headline ?? "noticia"} />
            </div>
          )}

          <div className="np-lead">
            <span className="k2">La principal</span>
            <h2>{block.headline ?? "Sin titular"}</h2>
            <p>{block.summary}</p>
            {domains.length > 0 && (
              <div className="src"><Ic i={BadgeCheck} className="ic" />{domains.slice(0, 3).join(" + ")}{domains.length > 1 ? " coinciden" : ""}</div>
            )}
          </div>

          {(timeline.length > 0 || factChecks.length > 0) && (
            <div className="np-cols">
              <div className="np-col">
                {timeline.map((t, i) => (
                  <div className="np-item" key={i}>
                    <h4>{t.time} · {STATUS_LABEL[t.status] ?? t.status}</h4>
                    <p>{t.event}</p>
                    <span className="tag2" style={{ background: "var(--sky-soft)", color: "var(--sky-ink)" }}>LÍNEA DE TIEMPO</span>
                  </div>
                ))}
              </div>
              <div className="np-col">
                {factChecks.map((f, i) => (
                  <div className="np-item" key={i}>
                    <h4>{f.claim}</h4>
                    <p>{f.verdict}</p>
                    <span className="tag2" style={{ background: "var(--mint-soft)", color: "var(--mint-ink)" }}>
                      {f.source.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="np-mine">
              <Ic i={HistIcon} className="ic" />
              <p>Fuentes: {sources.slice(0, 4).map((s) => s.domain ?? s.title).join(" · ")}</p>
            </div>
          )}
        </div>

        <div className="actions">
          <button type="button" className="btn primary" onClick={onClose}>
            <Ic i={CheckCheck} className="ic" />Suficiente por hoy
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              dispatchCardAction("create_commitment", block, {
                title: `Seguir: ${block.headline ?? "esta noticia"}`,
                dueHint: "cuando haya una novedad verificada",
              })
            }
          >
            <Ic i={FileText} className="ic" />Seguir esta historia
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
