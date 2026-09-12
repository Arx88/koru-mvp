import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, Bookmark, ChefHat, Clock3, Heart, Newspaper, Radio, Sparkles, Star, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { UiBlock, AssistantSource } from "../../../domain/types";
import { useKoru } from "../../KoruProvider";
import type { MichiProps } from "./MichiLayouts";
import "./michi-new-cards.css";

const art = (name: string) => `/assets/michi-cards/${name}.webp`;
const safeUrl = (url?: string) => url && /^https?:\/\//i.test(url) ? url : undefined;

function SaveButton({ block, title, heart = false }: { block: UiBlock; title: string; heart?: boolean }) {
  const { records } = useKoru();
  const saved = records.some(record => record.title === title && record.sourceBlock?.type === block.type);
  const Icon = heart ? Heart : Bookmark;
  return <button type="button" className={`mn-save ${heart ? "is-heart" : ""}`} aria-label={saved ? `${title}, guardado` : `Guardar ${title}`} disabled={saved} onClick={event => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent("koru-save-deliverable", { detail: { title, blockType: block.type, blockData: block } }));
  }}><Icon size={23} fill={saved ? "currentColor" : "none"} /></button>;
}

export function isMichiNews(block: UiBlock) {
  return block.type === "news_urgent" || (block.type === "research_sources" && block.mode === "news") || (block.type === "proactive_signal" && block.category === "news");
}

type Story = { title: string; summary?: string; source?: AssistantSource; updated?: string; category?: string; urgent?: boolean; block: UiBlock };
export function MichiNewsCards(props: MichiProps) {
  const { block, hero, handleClick, overlay } = props;
  const [active, setActive] = useState(0);
  const start = useRef<number | null>(null);
  const { records } = useKoru();
  const stories: Story[] = block.type === "research_sources" && block.sources.length ? block.sources.map(source => ({
    title: source.title, summary: source.snippet || source.content, source,
    block: { ...block, title: source.title, summary: source.snippet || source.content || "", sources: [source] },
  })) : block.type === "news_urgent" ? [{ title: block.headline || hero.title, summary: block.summary, source: block.sources?.[0], updated: block.lastUpdated, category: block.category, urgent: block.severity === "breaking" || block.severity === "urgent", block }]
    : block.type === "proactive_signal" ? [{ title: block.title, summary: block.body, source: block.sources?.[0], updated: block.timestampLabel, urgent: block.severity === "urgent", block }]
    : [{ title: hero.title, summary: block.type === "research_sources" ? block.summary : undefined, block }];
  const current = Math.min(active, stories.length - 1);
  const previous = (current + stories.length - 1) % stories.length;
  const next = (current + 1) % stories.length;
  const move = (delta: number) => setActive(index => (index + stories.length + delta) % stories.length);
  return <section className={`mn-news ${stories.length > 1 ? "is-carousel" : ""}`} aria-label={stories.length > 1 ? "Carrusel de noticias" : "Noticia"} aria-roledescription={stories.length > 1 ? "carrusel" : undefined}>
    <div className="mn-news-stage" onTouchStart={event => { start.current = event.touches[0].clientX; }} onTouchEnd={event => { if (start.current !== null) { const delta = event.changedTouches[0].clientX - start.current; if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1); } start.current = null; }} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}>
      {stories.map((story, index) => <article key={`${story.title}-${index}`} className={`mn-card mn-news-card ${index === current ? "is-active" : index === previous ? "is-before" : "is-after"}`} hidden={index !== current && index !== previous && index !== next} inert={index !== current} aria-hidden={index !== current}>
        <div className="mn-hero"><img src={art(story.urgent ? "urgent" : "news")} alt="" width="900" height="600" />
          <span className={`mn-news-badge ${story.urgent ? "is-urgent" : ""}`}>{story.urgent ? <BellRing size={20} /> : <Star size={18} fill="#ffe354" />}{story.urgent ? "ÚLTIMO MOMENTO" : records.some(record => record.title === story.title && record.sourceBlock?.type === story.block.type) ? "Noticia favorita" : "Noticias para ti"}</span>
          <SaveButton title={story.title} block={story.block} />
        </div>
        <div className="mn-content">{story.category && <span className="mn-category">{story.category}</span>}<h3>{story.title}</h3>{story.summary && <p className="mn-description">{story.summary}</p>}
          <div className="mn-news-meta">{story.source?.domain && <span><Newspaper size={18} />{story.source.domain}</span>}{story.updated && <span><Clock3 size={18} />{story.updated}</span>}
            {!story.urgent && (safeUrl(story.source?.url) ? <a className="mn-arrow" href={safeUrl(story.source?.url)} target="_blank" rel="noopener noreferrer" aria-label={`Leer ${story.title}`}><ArrowRight size={22} /></a> : <button type="button" className="mn-arrow" onClick={handleClick} aria-label={`Leer ${story.title}`}><ArrowRight size={22} /></button>)}
          </div>
          {story.urgent && <button type="button" className="mn-cta" onClick={handleClick}><Radio size={21} />Ver cobertura y detalles<ArrowRight size={20} /></button>}
        </div>
      </article>)}
    </div>
    {stories.length > 1 && <div className="mn-carousel-controls"><button type="button" aria-label="Noticia anterior" disabled={stories.length < 2} onClick={() => move(-1)}><ArrowLeft size={18} /></button><div className="mn-dots">{stories.map((story, index) => <button key={index} type="button" aria-label={`Ver noticia ${index + 1}: ${story.title}`} aria-current={index === current ? "true" : undefined} onClick={() => setActive(index)}><span /></button>)}</div><button type="button" aria-label="Noticia siguiente" disabled={stories.length < 2} onClick={() => move(1)}><ArrowRight size={18} /></button><span className="sr-only" aria-live="polite">Noticia {current + 1} de {stories.length}</span></div>}
    {overlay}
  </section>;
}

export function MichiRecipeCard({ block, hero, handleClick, overlay }: MichiProps) {
  if (block.type !== "recipe") return null;
  const title = block.name || block.title || hero.title;
  const times = [block.prepTime, block.cookTime].filter(Boolean) as string[];
  const time = times.length && times.every(value => /^\d+\s*(min)?$/i.test(value.trim())) ? `${times.reduce((sum, value) => sum + parseInt(value), 0)} min` : times.join(" + ");
  const difficulty = block.difficulty && ({ easy: "Fácil", medium: "Media", hard: "Difícil" })[block.difficulty];
  return <article className="mn-card mn-recipe" data-ui-block="recipe"><div className="mn-hero"><img src={art("recipe")} alt="" width="900" height="600" /><SaveButton block={block} title={title} heart /></div><div className="mn-content"><h3>{title}</h3>{block.description && <p className="mn-description">{block.description}</p>}<div className="mn-recipe-metrics">
    {time && <div><Clock3 /><strong>{time}</strong><small>Tiempo</small></div>}{difficulty && <div><ChefHat /><strong>{difficulty}</strong><small>Dificultad</small></div>}{block.servings != null && <div><Users /><strong>{block.servings} porciones</strong><small>Porciones</small></div>}
  </div><div className="mn-tags">{[block.category, block.area].filter(Boolean).map(tag => <span key={tag}>{tag}</span>)}</div><button type="button" className="mn-cta" onClick={handleClick}><Sparkles size={20} fill="white" />Ver receta completa<ArrowRight size={20} /></button></div>{overlay}</article>;
}

type Series = { label: string; values: number[] };
type Quote = { name: string; symbol: string; price: string; change?: string; up?: boolean; marketCap?: string; volume?: string; series?: Series[] };
export function MichiMarketCard({ block, hero, handleClick, overlay }: MichiProps) {
  const [active, setActive] = useState(0);
  const [period, setPeriod] = useState("");
  const quotes: Quote[] = block.type === "crypto_portfolio" ? (block.items || []).map(item => ({ ...item, change: item.change == null ? undefined : `${item.change > 0 ? "+" : ""}${item.change}%`, up: item.change == null ? undefined : item.change >= 0 })) : block.type === "market" ? block.assets.map(item => ({ ...item, up: item.changeUp })) : [];
  const quote = quotes[Math.min(active, quotes.length - 1)];
  const legacy = block.type === "crypto_portfolio" && quotes.length === 1 && block.sparkline ? [{ label: "1S", values: block.sparkline }] : [];
  const series = (quote?.series || legacy).map(item => ({ ...item, values: item.values.filter(Number.isFinite) })).filter(item => item.values.length > 1);
  const chosen = series.find(item => item.label === period) || series[0];
  const values = chosen?.values || [];
  const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 0;
  const points = values.map((value, index) => `${8 + index / (values.length - 1) * 264},${76 - (value - min) / (max - min || 1) * 62}`);
  const changeUp = values.length ? values[values.length - 1] >= values[0] : quote?.up !== false;
  return <article className="mn-card mn-market" data-ui-block={block.type}><div className="mn-market-content"><div className="mn-market-heading"><span className="mn-coin">{quote?.symbol === "BTC" ? "₿" : quote?.symbol.slice(0, 3) || <TrendingUp />}</span><div><h3>{quote?.name || hero.title}</h3>{quote && <p>{quote.symbol}</p>}</div></div>
    {quote ? <><strong className="mn-price">{quote.price === "?" ? "Cotización no disponible" : quote.price}</strong>{quote.change && quote.change !== "-" && <p className={`mn-change ${quote.up === false ? "is-down" : ""}`}><span>{quote.up === false ? <TrendingDown size={16} /> : <TrendingUp size={16} />}{quote.change.replace(/^up /, "+").replace(/^down /, "−")}</span>Últimas 24 h</p>}
      <div className="mn-periods" aria-label="Período del gráfico">{["1D", "1S", "1M", "1A", "TODO"].map(label => <button key={label} type="button" disabled={!series.some(item => item.label === label)} aria-pressed={chosen?.label === label} onClick={() => setPeriod(label)} title={!series.some(item => item.label === label) ? "Sin historial para este período" : undefined}>{label}</button>)}</div>
      {chosen ? <div className={`mn-chart ${changeUp ? "is-up" : "is-down"}`}><svg viewBox="0 0 310 92" role="img" aria-label={`Evolución de ${quote.symbol}, ${chosen.label}. Mínimo ${min}, máximo ${max}.`}><path d="M8 14H276 M8 45H276 M8 76H276" className="mn-grid-lines" /><polygon points={`8,88 ${points.join(" ")} 272,88`} fill="currentColor" opacity=".13" /><polyline points={points.join(" ")} stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /><circle cx="272" cy={points[points.length - 1]?.split(",")[1]} r="4" fill="currentColor" stroke="white" strokeWidth="2" /><text x="281" y="17">{Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 }).format(max)}</text><text x="281" y="79">{Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 }).format(min)}</text></svg></div> : <p className="mn-chart-empty">El proveedor no incluyó un historial de precios.</p>}
      {(quote.marketCap || quote.volume) && <div className="mn-market-stats">{quote.marketCap && <div><small>Capitalización</small><strong>{quote.marketCap}</strong></div>}{quote.volume && <div><small>Volumen {block.type === "crypto_portfolio" ? "(24 h)" : ""}</small><strong>{quote.volume}</strong></div>}</div>}
      {quotes.length > 1 && <div className="mn-assets" aria-label="Elegir activo">{quotes.map((item, index) => <button type="button" key={item.symbol} aria-pressed={index === active} onClick={() => { setActive(index); setPeriod(""); }}>{item.symbol}</button>)}</div>}
    </> : <p className="mn-description">No pude obtener la cotización. Puedes volver a consultarla en el chat.</p>}
    </div><img className="mn-market-art" src={art("markets")} alt="" width="900" height="450" /><div className="mn-market-footer"><button type="button" className="mn-cta" onClick={handleClick}><TrendingUp size={20} />Ver más detalles y análisis<ArrowRight size={20} /></button></div>{overlay}</article>;
}

