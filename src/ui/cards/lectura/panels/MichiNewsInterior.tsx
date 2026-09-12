import { useState } from "react";
import { ArrowUpRight, BellRing, Clock3, Newspaper, ShieldCheck, Sparkles } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import type { LecturaInteriorProps } from "../index";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";

export type NewsStoryBlock = Extract<UiBlock, { type: "news_urgent" | "research_sources" | "proactive_signal" }>;
export function MichiNewsInterior({ block, onClose, onSave }: LecturaInteriorProps<NewsStoryBlock>) {
  const [requested, setRequested] = useState(false);
  const urgent = block.type === "news_urgent" ? block.severity === "breaking" || block.severity === "urgent" : block.type === "proactive_signal" && block.severity === "urgent";
  const title = block.type === "news_urgent" ? block.headline || "Noticia" : block.title || "Noticia";
  const summary = block.type === "proactive_signal" ? block.body : block.summary;
  const updated = block.type === "news_urgent" ? block.lastUpdated : block.type === "proactive_signal" ? block.timestampLabel : undefined;
  const category = block.type === "news_urgent" ? block.category : undefined;
  const sources = block.sources || [];
  const timeline = block.type === "news_urgent" ? block.timeline || [] : [];
  const checks = block.type === "news_urgent" ? block.factChecks || [] : [];
  const photo = sources.find(source => source.imageUrl)?.imageUrl;
  return <LecturaShell variant="news" onClose={onClose} onBookmark={onSave ? () => onSave(title, category) : undefined} chip={{ label: urgent ? "Último momento" : "Noticias para ti" }} ariaLabel={title}>
    <article className={`lcr-panel md-news ${urgent ? "md-urgent" : ""}`}>
      <div className="md-news-art"><img src={`/assets/michi-cards/${urgent ? "urgent" : "news"}.webp`} alt="" /><span><Sparkles size={15} />Michi te pone al día</span></div>
      <header className="md-news-lead">
        <div className="md-eyebrow"><Newspaper size={16} />{category || "Actualidad"}{urgent && <b>Último momento</b>}</div>
        <h1>{title}</h1>
        <div className="md-byline">{sources.length > 0 && <span>{sources.length} {sources.length === 1 ? "fuente" : "fuentes"}</span>}{updated && <span><Clock3 size={14} />{updated}</span>}</div>
        {summary && <p className="md-summary">{summary}</p>}
      </header>
      {photo && <figure className="md-photo"><img src={photo} alt={title} onError={event => { event.currentTarget.closest("figure")?.setAttribute("hidden", ""); }} /><figcaption>Imagen de la fuente</figcaption></figure>}
      {timeline.length > 0 && <section className="md-section"><h2><Clock3 />Cómo fue pasando</h2><ol className="md-timeline">{timeline.map((item, index) => <li key={index} data-status={item.status}><span className="md-time">{item.time} · {({done:"confirmado",current:"ahora",pending:"pendiente"})[item.status] || item.status}</span><p>{item.event}</p></li>)}</ol></section>}
      {checks.length > 0 && <section className="md-section"><h2><ShieldCheck />Qué dicen las verificaciones</h2><div className="md-checks">{checks.map((check, index) => <div key={index}><h3>{check.claim}</h3><p>{check.verdict}</p><small>{check.source}</small></div>)}</div></section>}
      <section className="md-section"><h2><Newspaper />Para leer en origen</h2>{sources.length ? <div className="md-sources">{sources.map((source, index) => {
        const content = <><span className="md-source-number">{String(index + 1).padStart(2,"0")}</span><span><small>{source.domain || "Fuente"}</small><strong>{source.title}</strong></span></>;
        return /^https?:\/\//i.test(source.url || "") ? <a key={index} href={source.url} target="_blank" rel="noopener noreferrer">{content}<ArrowUpRight size={20} /><span className="sr-only">Abre en otra pestaña</span></a> : <div key={index}>{content}</div>;
      })}</div> : <p>Esta noticia no incluyó enlaces a sus fuentes.</p>}</section>
      <div className="actions"><button type="button" className="btn primary" disabled={requested} onClick={() => { dispatchCardAction("create_commitment", block, { title: `Seguir: ${title}`, dueHint: "cuando haya una novedad verificada" }); setRequested(true); }}><BellRing size={19} />{requested ? "Seguimiento solicitado" : "Seguir esta historia"}</button><button type="button" className="btn ghost" onClick={onClose}>Volver al chat</button></div>
    </article>
  </LecturaShell>;
}
