/**
 * MemInterior — card "Lo nuevo que te guardé" (#p-mem), bind real del block
 * `memory` (title/items/note).
 *
 * Los items[] REALES apilan como cartas (la primera NUEVO, hasta 3 visibles
 * con la cascada c1/c2/c3) y el resto va a "por si lo buscás rápido" con su
 * confidence como tag honesto. Foto del item destacado SOLO si el contenido
 * matchea un asset real conocido (mallorca/café) — sin fotos random. El note
 * real va al caption del cerebro. Iconos derivados por keyword del dominio.
 */
import {
  Umbrella,
  MapPin,
  Gift,
  Wifi,
  Lightbulb,
  Car,
  Brain,
  CheckCheck,
  Search,
  Utensils,
  Plane,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-mem.css";

type MemBlock = Extract<UiBlock, { type: "memory" }>;

type Item = NonNullable<MemBlock["items"]>[number];

const KEYWORD_ICONS: Array<{ re: RegExp; Icon: LucideIcon; bg: string; color: string }> = [
  { re: /\b(viaje|ruta|calas|vacacion|destino)\b/i, Icon: Umbrella, bg: "var(--pink-soft)", color: "var(--pink-ink)" },
  { re: /\b(regalo|cumple|vinilo)\b/i, Icon: Gift, bg: "var(--sky-soft)", color: "var(--sky-ink)" },
  { re: /\b(wifi|t[eé]cnico|servicio|internet)\b/i, Icon: Wifi, bg: "var(--mint-soft)", color: "var(--mint-ink)" },
  { re: /\b(idea|men[uú]|brainstorm)\b/i, Icon: Lightbulb, bg: "var(--violet-soft)", color: "var(--violet-ink)" },
  { re: /\b(auto|aceite|coche|taller)\b/i, Icon: Car, bg: "var(--honey-soft)", color: "var(--honey-ink)" },
  { re: /\b(caf[eé]|comida|restaurante|plato)\b/i, Icon: Utensils, bg: "var(--honey-soft)", color: "var(--honey-ink)" },
  { re: /\b(vuelo|avion|aeropuerto)\b/i, Icon: Plane, bg: "var(--sky-soft)", color: "var(--sky-ink)" },
];
const FALLBACK_ICONS = [
  { Icon: Brain, bg: "var(--paper2)", color: "var(--ink-soft)" },
];

function iconFor(item: Item) {
  const text = `${item.domain ?? ""} ${item.title} ${item.detail ?? ""}`;
  return KEYWORD_ICONS.find((k) => k.re.test(text)) ?? FALLBACK_ICONS[0];
}

/** Foto real solo si el contenido matchea un asset local conocido. */
const CONTENT_PHOTOS: Array<{ re: RegExp; src: string; alt: string; caption: string }> = [
  {
    re: /\b(mallorca|calobra|s[oó]ller|calas?)\b/i,
    src: "/stitch/outfits/mem-mallorca.jpg",
    alt: "Cala de Mallorca",
    caption: "sa Calobra · parada 3",
  },
  {
    re: /\b(flat white|caf[eé] de siempre|bar aparte)\b/i,
    src: "/stitch/outfits/cafe-latte.jpg",
    alt: "El café de siempre",
    caption: "Bar Aparte · tu mesa",
  },
];

function photoFor(item: Item) {
  const text = `${item.title} ${item.detail ?? ""}`;
  return CONTENT_PHOTOS.find((p) => p.re.test(text)) ?? null;
}

export function MemInterior({ block, onClose, onSave }: LecturaInteriorProps<MemBlock>) {
  const items = block.items ?? [];
  const title = block.title || "Lo nuevo que te guardé";
  const featured = items.slice(0, 3);
  const quickRows = items.slice(3, 7);
  const firstPhoto = items[0] ? photoFor(items[0]) : null;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, `${items.length} recuerdos`) : undefined}
      chip={{ label: "Memoria", background: "linear-gradient(135deg,#FF9EBE,#FF5A60)" }}
      ariaLabel={title}
    >
      <div id="p-mem" className="lcr-panel">
        <div className="arc-head rv">
          <h1>
            <small>{block.title || "Tu archivo de este mes"}</small>
            Lo nuevo que te guardé
          </h1>
          <p>
            {items.length
              ? "Esto lo retengo solito: cuando me vuelvas a preguntar, ya lo voy a saber."
              : "Todavía no hay nada nuevo esta vez — lo que me cuentes queda acá."}
          </p>
        </div>

        {featured.length > 0 && (
          <div className="arc-stack rv">
            {featured.map((item, i) => {
              const { Icon, bg, color } = iconFor(item);
              const photo = i === 0 ? firstPhoto : null;
              return (
                <div className={`arc-card c${i + 1}`} key={`mem_${i}_${item.title}`}>
                  <div className="ac-top">
                    <div className="aic" style={{ background: bg }}>
                      <Ic i={Icon} className="ic" style={{ color }} />
                    </div>
                    <div className="at">
                      <small>{item.domain || "guardado"}</small>
                      {item.title}
                    </div>
                    {i === 0 && <span className="arc-new">NUEVO</span>}
                  </div>
                  {item.detail && <p className="ad">{item.detail}</p>}
                  {photo && (
                    <div className="aph">
                      <img src={photo.src} alt={photo.alt} />
                      <span>
                        <Ic i={MapPin} className="ic" />
                        {photo.caption}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {quickRows.length > 0 && (
          <div className="arc-rows rv">
            <h3>Por si lo buscás rápido</h3>
            {quickRows.map((item, i) => {
              const { Icon, bg, color } = iconFor(item);
              return (
                <div className="arow" key={`quick_${i}_${item.title}`}>
                  <div className="abic" style={{ background: bg }}>
                    <Ic i={Icon} className="ic" style={{ color }} />
                  </div>
                  <div className="abt">
                    <b>{item.title}</b>
                    <span>{item.detail ?? item.domain ?? ""}</span>
                  </div>
                  {item.confidence != null && (
                    <span className="tag" style={{ background: bg, color }}>
                      {Math.round(item.confidence * 100)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(block.note || items.length > 0) && (
          <div className="arc-cap rv">
            <Ic i={Brain} className="ic" />
            {block.note ||
              "Todo lo de arriba quedó asociado a tu historial: no hace falta que lo repitas cuando lo necesites."}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={CheckCheck} className="ic" />
            Perfecto así
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={Search} className="ic" />
            Buscar algo guardado
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
