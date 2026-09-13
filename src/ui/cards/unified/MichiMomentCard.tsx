import { AlarmClock, ArrowRight, Bell, Bookmark, Cake, CalendarDays } from "lucide-react";
import type { MichiProps } from "./MichiLayouts";
import "./michi-moments.css";

export function MichiMomentCard({ block, hero, isTappable, handleClick, overlay, foot }: MichiProps) {
  const kind = block.type === "alarm" ? "alarm" : block.type === "saved_record" ? "saved" : block.type === "birthday_alarm" ? "birthday" : "reminder";
  const Icon = kind === "alarm" ? AlarmClock : kind === "saved" ? Bookmark : kind === "birthday" ? Cake : Bell;
  const label = { alarm: "Alarma", saved: "Elemento guardado", birthday: "Cumpleaños", reminder: "Recordatorio" }[kind];
  const record = block.type === "saved_record" ? block.records?.[0] : undefined;
  const title = record?.title || hero.title;
  const description = record ? record.notes || record.value : hero.desc;
  const date = block.type === "birthday_alarm" ? block.date : block.type === "reminder" ? block.dueText : undefined;
  return <>
    <article className={`mm-card mm-${kind}`} aria-label={label}>
      <div className="mm-art" style={{ backgroundImage: `url(/assets/michi-moments/${kind}.png)` }}>
        <span className="mm-label"><Icon size={18} /><span>{label}{record?.collection && <small>en {record.collection}</small>}</span></span>
      </div>
      <div className="mm-panel">
        {kind === "alarm" && <span className="mm-eyebrow">Tu alarma</span>}
        <h3>{title}</h3>
        {date && <div className="mm-date"><CalendarDays size={20} />{date}</div>}
        {description && <p>{description}</p>}
        {!!hero.metrics?.length && <div className="mm-metrics">{hero.metrics.slice(0,3).map((metric,index) => <div key={index}><strong>{metric.value || metric.label}</strong><small>{metric.value ? metric.label : ""}</small></div>)}</div>}
        {isTappable && <button type="button" className="mm-cta" onClick={handleClick}>{kind === "saved" ? "Ver elemento" : kind === "alarm" ? "Ver alarma" : "Ver detalle"}<ArrowRight size={22} /></button>}
        {foot}
      </div>
    </article>
    {overlay}
  </>;
}
