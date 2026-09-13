import { useState } from "react";
import { AlarmClock, ArrowRight, Bell, Bookmark, Cake, CalendarDays, Clock3, ExternalLink, Globe2, Link2, Repeat2 } from "lucide-react";
import type { MichiProps } from "./MichiLayouts";
import "./michi-moments.css";

function savedPreviewImage(source:unknown):string | undefined {
  if (!source || typeof source !== "object") return;
  const item=source as Record<string,unknown>;
  for (const candidate of [item.imageUrl,item.image,item.thumbnail,item.heroImage,item.coverUrl]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  const article=item.article;
  if (article && article !== source) return savedPreviewImage(article);
  const first=Array.isArray(item.items) ? item.items[0] : Array.isArray(item.sources) ? item.sources[0] : undefined;
  if (first && first !== source) return savedPreviewImage(first);
}

export function MichiMomentCard({ block, hero, isTappable, handleClick, overlay, foot }: MichiProps) {
  const kind = block.type === "alarm" ? "alarm" : block.type === "saved_record" ? "saved" : block.type === "birthday_alarm" ? "birthday" : "reminder";
  const Icon = kind === "alarm" ? AlarmClock : kind === "saved" ? Bookmark : kind === "birthday" ? Cake : Bell;
  const label = { alarm: "Alarma", saved: "Elemento guardado", birthday: "Cumpleaños", reminder: "Recordatorio" }[kind];
  const record = block.type === "saved_record" ? block.records?.[0] : undefined;
  const recordCount = block.type === "saved_record" ? (block.records ?? []).length : 0;
  const title = block.type === "birthday_alarm" && block.name ? `${/hoy/i.test(block.eta ?? "") ? "Hoy cumple" : "Cumple de"} ${block.name}` : record?.title || hero.title;
  const description = block.type === "reminder" ? block.note : block.type === "birthday_alarm" ? "Un día para celebrar con alguien especial." : record ? record.notes || record.value : hero.desc;
  const date = block.type === "birthday_alarm" ? block.date : block.type === "reminder" ? block.dueText : undefined;
  const previewImage = savedPreviewImage(record?.sourceBlock);
  const [imageFailed, setImageFailed] = useState(false);
  let domain = "";
  try { if (record?.url && /^https?:\/\//i.test(record.url)) domain = new URL(record.url).hostname.replace(/^www\./, ""); } catch { /* A malformed saved URL must not break the chat. */ }
  const metrics = block.type === "birthday_alarm" ? [
    ...(block.date ? [{label:"Fecha",value:block.date,Icon:CalendarDays}] : []),
    {label:"Fecha especial",value:"Cumpleaños",Icon:Cake},
    ...(block.countdown ? [{label:"Para celebrarlo",value:`${block.countdown} ${block.unit || ""}`.trim(),Icon:Clock3}] : []),
  ] : kind === "saved" || kind === "reminder" ? [] : (hero.metrics ?? []).slice(0,3).map((metric,index) => ({label:metric.label === "Sucede" ? "Falta" : metric.label === "Repite" ? "Repetición" : metric.label,value:(metric.value || "").replace(/^suena en /i,"").replace(/ · descansá.*$/i,""),Icon:index === 0 ? Repeat2 : Clock3}));
  return <>
    <article className={`mm-card mm-${kind}`} aria-label={label}>
      <div className="mm-art" style={{ backgroundImage: `url(/assets/michi-moments/${kind}-v2.png)` }}>
        <span className="mm-label"><Icon size={18} /><span>{recordCount > 1 ? `${recordCount} elementos guardados` : label}{record?.collection && <small>en <b>{record.collection}</b></small>}</span></span>
      </div>
      <div className="mm-panel">
        {kind === "alarm" && <span className="mm-eyebrow">Tu alarma</span>}
        {kind === "saved" && previewImage && !imageFailed && <div className="mm-preview-image"><img src={previewImage} alt="" loading="lazy" onError={() => setImageFailed(true)} /><span><Link2 /></span></div>}
        <h3>{title}</h3>
        {date && kind !== "birthday" && <div className="mm-date"><CalendarDays size={20} /><span><small>Cuándo</small>{date}</span></div>}
        {description && <div className="mm-note">{kind === "reminder" && <h4>Para tener presente</h4>}<p>{description}</p></div>}
        {record?.value && record.notes && record.value !== record.notes && <p className="mm-saved-value">{record.value}</p>}
        {record && <dl className="mm-record-details">{record.person && <div><dt>Con quién</dt><dd>{record.person}</dd></div>}{record.dueHint && <div><dt>Cuándo</dt><dd>{record.dueHint}</dd></div>}{record.amount !== undefined && <div><dt>Importe</dt><dd>{record.amount} {record.currency}</dd></div>}</dl>}
        {block.type === "saved_record" && recordCount > 1 && <div className="mm-more-records"><h4>También guardaste</h4><ul>{block.records.slice(1).map((item,index)=><li key={index}><strong>{item.title}</strong>{(item.notes || item.value) && <p>{item.notes || item.value}</p>}</li>)}</ul></div>}
        {!!metrics.length && <div className="mm-metrics">{metrics.map(({Icon:MetricIcon,...metric},index) => <div key={index}><MetricIcon aria-hidden="true"/><span><strong>{metric.value || metric.label}</strong><small>{metric.value ? metric.label : ""}</small></span></div>)}</div>}
        {kind === "saved" && (domain || record?.happenedAt) && <div className="mm-source">{domain && <span><Globe2 size={14}/>{domain}</span>}{record?.happenedAt && <time>{record.happenedAt}</time>}</div>}
        {isTappable && <button type="button" className="mm-cta" onClick={handleClick}>{kind === "saved" && <ExternalLink size={20}/>} {kind === "saved" ? recordCount > 1 ? "Ver elementos" : "Ver elemento" : kind === "alarm" ? "Ver alarma" : "Ver detalle"}<ArrowRight size={22} /></button>}
        {foot}
      </div>
    </article>
    {overlay}
  </>;
}
