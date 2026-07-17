import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { UiBlock } from "../../../domain/types";
import type { Detail, DetailSection, Accent, DetailRow, DetailSourceRef } from "./presentation";
import { CookingMode, type CookingStep } from "./CookingMode";
import { WorkoutSession } from "../../WorkoutSession";
import { PriceHistoryChart, extractAsin } from "./PriceHistoryChart";
import { useKoru } from "../../KoruProvider";
import {
  sensitivityAnalysis,
  preMortem,
  weightedAdditive,
} from "../../../domain/decisionEngine";
import { KoruIcon, iconFromMaterial } from "./KoruIcons";

// Pantalla de detalle unificada — misma estética Stitch que PlanRoadmapScreen
// (koru-roadmap + magical-cards + blobs), pero genérica: renderiza cualquier
// conjunto de secciones normalizadas. Cada UiBlock que abre su CTA cae acá,
// así informe, clima, mercados, etc. comparten un único lenguaje visual.

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

// 🔴 P2 — Platform detection para el botón "Navegar" de route_map.
// iOS detection incluye el iPad con iOS 13+ que se reporta como MacIntel.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * 🔴 P2 — Construye la URL de navegación según plataforma y datos disponibles.
 * - Si lat/lng están presentes:
 *   • Android: geo:${lat},${lng}?q=${destination}
 *   • iOS:     maps://?daddr=${lat},${lng}
 *   • Desktop: https://www.google.com/maps/dir/?api=1&destination=${dest}
 * - Si NO hay lat/lng, cae a esquemas address-based:
 *   • Android: geo:0,0?q=${destination}
 *   • iOS:     maps://?daddr=${destination}
 *   • Desktop: https://www.google.com/maps/dir/?api=1&destination=${dest}
 * Devuelve null si no hay destino (ni to ni from ni lat/lng).
 */
function buildNavUrl(opts: {
  destination: string;
  lat?: number;
  lng?: number;
}): string | null {
  const { destination, lat, lng } = opts;
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  if (isAndroid()) {
    if (hasCoords) {
      return `geo:${lat},${lng}?q=${encodeURIComponent(destination)}`;
    }
    return `geo:0,0?q=${encodeURIComponent(destination)}`;
  }
  if (isIOS()) {
    if (hasCoords) {
      return `maps://?daddr=${lat},${lng}`;
    }
    return `maps://?daddr=${encodeURIComponent(destination)}`;
  }
  // Desktop (o fallback)
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

// 🔴 v2: ComparisonBar — barra comparativa para stats de fútbol (o cualquier
// matchup home/away). Dibuja dos segmentos coloreados con team colors,
// mostrando visualmente quién domina esa stat.
function ComparisonBar({ bar }: { bar: NonNullable<DetailRow["bar"]> }) {
  const { homeValue, awayValue, isPercent, homeColor, awayColor } = bar;
  const total = (homeValue ?? 0) + (awayValue ?? 0);
  const homePct = total > 0 ? Math.max(2, Math.min(98, (homeValue / total) * 100)) : 50;
  const awayPct = 100 - homePct;
  const hc = homeColor || "#2d6a4f";
  const ac = awayColor || "#8363f9";
  return (
    <div className="koru-comparison-bar" role="presentation">
      <span className="koru-comparison-value home" style={{ color: hc }}>
        {isPercent ? `${Math.round(homeValue)}%` : homeValue}
      </span>
      <div className="koru-comparison-track">
        <div
          className="koru-comparison-fill home"
          style={{ width: `${homePct}%`, background: hc }}
        />
        <div
          className="koru-comparison-fill away"
          style={{ width: `${awayPct}%`, background: ac }}
        />
      </div>
      <span className="koru-comparison-value away" style={{ color: ac }}>
        {isPercent ? `${Math.round(awayValue)}%` : awayValue}
      </span>
    </div>
  );
}

/** Aplica el accent de la sección a las CSS custom props del módulo. */
function moduleStyle(accent: Accent): CSSProperties {
  return { "--module-color": accent.color, "--module-bg": accent.soft } as CSSProperties;
}

/**
 * 🔴 KIMI v4 — Color del glow del xt-hero según tipo de bloque.
 * Replica los gradientes del spec Kimi (pág. 28-30) por dominio:
 * - weather: azul (lluvia) / amber (sol) / primary (nieve)
 * - live_match / tennis_match: esmeralda
 * - crypto_portfolio / market / forex / data_ticker: amber (miel)
 * - shopping_list: amber
 * - alarm: violet (spec card 13 dominio VIOLETA #8363f9)
 * - reminder: violet
 * - memory: emerald
 * - restaurant_synthesis / recipe: amber
 * - comparison: pink
 * - morning_brief: amber (dorado)
 * - default: violet
 */
function heroGlowColor(block: UiBlock): string {
  const t = block.type;
  if (t === "weather") {
    const condition = ("condition" in block && typeof block.condition === "string" ? block.condition : "").toLowerCase();
    if (/lluvia|rain/.test(condition)) return "#2563eb";
    if (/sol|soleado|clear/.test(condition)) return "#f59e0b";
    if (/nieve|snow/.test(condition)) return "#8363f9";
    return "#2563eb";
  }
  if (t === "live_match" || t === "tennis_match") return "#2f8f6d";
  if (t === "crypto_portfolio" || t === "market" || t === "forex" || t === "data_ticker") return "#f59e0b";
  if (t === "shopping_list") return "#f59e0b";
  // 🔴 KIMI v4 — spec card 13 alarmas dominio VIOLETA (#8363f9), no rose.
  if (t === "alarm") return "#8363f9";
  if (t === "reminder") return "#8363f9";
  if (t === "memory") return "#46c293";
  if (t === "restaurant_synthesis" || t === "recipe") return "#f59e0b";
  if (t === "comparison") return "#ec4899";
  if (t === "morning_brief") return "#f6bd6d";
  if (t === "news_urgent") return "#ff7d6b";
  if (t === "birthday_alarm") return "#ec4899";
  if (t === "exercise_plan") return "#2f8f6d";
  if (t === "travel_plan" || t === "route_map") return "#3b82f6";
  return "#8363f9"; // violet default
}

/**
 * 🔴 KIMI v4 — Background gradient del xt-hicon según tipo de bloque.
 * Replica los gradientes del spec Kimi por dominio.
 */
function heroIconBg(block: UiBlock): string {
  const t = block.type;
  if (t === "weather") {
    const condition = ("condition" in block && typeof block.condition === "string" ? block.condition : "").toLowerCase();
    if (/lluvia|rain/.test(condition)) return "linear-gradient(150deg,#60a5fa,#2563eb 70%,#1d4ed8)";
    if (/sol|soleado|clear/.test(condition)) return "linear-gradient(150deg,#f6bd6d,#f59e0b 65%,#d97706)";
    if (/nieve|snow/.test(condition)) return "linear-gradient(150deg,#c9bdf5,#8363f9)";
    if (/tormenta|thunder|storm/.test(condition)) return "linear-gradient(150deg,#f6bd6d,#1d4ed8)";
    return "linear-gradient(150deg,#60a5fa,#2563eb)";
  }
  if (t === "live_match" || t === "tennis_match") return "linear-gradient(150deg,#46c293,#2f8f6d 60%,#257a5c)";
  if (t === "crypto_portfolio" || t === "market" || t === "forex" || t === "data_ticker") return "linear-gradient(150deg,#f6bd6d,#f59e0b 65%,#d97706)";
  if (t === "shopping_list") return "linear-gradient(150deg,#f6bd6d,#f59e0b)";
  // 🔴 KIMI v4 — spec card 13 alarmas dominio VIOLETA, gradiente c9bdf5→8363f9→523a9e.
  if (t === "alarm") return "linear-gradient(150deg,#c9bdf5,#8363f9 65%,#523a9e)";
  if (t === "reminder") return "linear-gradient(150deg,#8363f9,#523a9e)";
  if (t === "memory") return "linear-gradient(150deg,#7ed491,#2f8f6d)";
  if (t === "restaurant_synthesis") return "linear-gradient(150deg,#f6bd6d,#f59e0b)";
  if (t === "recipe") return "linear-gradient(150deg,#ff7d6b,#d63b2f)";
  if (t === "comparison") return "linear-gradient(150deg,#ff8fb8,#ec4899)";
  if (t === "morning_brief") return "linear-gradient(150deg,#f6bd6d,#f59e0b)";
  if (t === "news_urgent") return "linear-gradient(150deg,#ff7d6b,#d63b2f)";
  if (t === "birthday_alarm") return "linear-gradient(150deg,#ff8fb8,#ec4899)";
  if (t === "exercise_plan") return "linear-gradient(150deg,#7ed491,#2f8f6d)";
  if (t === "travel_plan") return "linear-gradient(150deg,#60a5fa,#3b82f6)";
  if (t === "route_map") return "linear-gradient(150deg,#7dd3fc,#38bdf8)";
  return "linear-gradient(150deg,#8363f9,#523a9e)";
}

/**
 * 🔴 KIMI v4 — Background gradient del xt-hero (dark + tono del dominio).
 * Replica los gradientes dark del spec Kimi por dominio (pág. 28-30).
 */
function heroGradientBg(block: UiBlock): string {
  const t = block.type;
  if (t === "weather") {
    const condition = ("condition" in block && typeof block.condition === "string" ? block.condition : "").toLowerCase();
    if (/lluvia|rain/.test(condition)) return "linear-gradient(170deg,#1e3a6e,#16294f 55%,#101a3a)";
    if (/sol|soleado|clear/.test(condition)) return "linear-gradient(170deg,#5e3a1e,#4a2a14 55%,#2a1808)";
    if (/nieve|snow/.test(condition)) return "linear-gradient(170deg,#3a2c5e,#2a1f4a 55%,#1a1240)";
    return "linear-gradient(170deg,#1e3a6e,#16294f 55%,#101a3a)";
  }
  if (t === "live_match" || t === "tennis_match") return "linear-gradient(170deg,#1e4a3a,#143a2a 55%,#0a2a1a)";
  if (t === "crypto_portfolio" || t === "market" || t === "forex" || t === "data_ticker") return "linear-gradient(170deg,#5e3a1e,#4a2a14 55%,#2a1808)";
  if (t === "shopping_list") return "linear-gradient(170deg,#5e3a1e,#4a2a14 55%,#2a1808)";
  // 🔴 KIMI v4 — spec card 13 alarmas: dark violet (#2c1f5e→#1c1445→#120d31).
  if (t === "alarm") return "linear-gradient(170deg,#2c1f5e,#1c1445 60%,#120d31)";
  if (t === "reminder") return "linear-gradient(170deg,#2c1f5e,#1c1445 60%,#120d31)";
  if (t === "memory") return "linear-gradient(170deg,#1e4a3a,#143a2a 55%,#0a2a1a)";
  if (t === "restaurant_synthesis") return "linear-gradient(170deg,#5e3a1e,#4a2a14 55%,#2a1808)";
  if (t === "recipe") return "linear-gradient(170deg,#5e1e2a,#4a1420 55%,#2a0810)";
  if (t === "comparison") return "linear-gradient(170deg,#3a1e5e,#2a1445 55%,#1a0831)";
  if (t === "morning_brief") return "linear-gradient(170deg,#5e3a1e,#4a2a14 55%,#2a1808)";
  if (t === "news_urgent") return "linear-gradient(170deg,#5e1e2a,#4a1420 55%,#2a0810)";
  if (t === "birthday_alarm") return "linear-gradient(170deg,#3a1e5e,#2a1445 55%,#1a0831)";
  if (t === "exercise_plan") return "linear-gradient(170deg,#1e4a3a,#143a2a 55%,#0a2a1a)";
  if (t === "travel_plan") return "linear-gradient(170deg,#1e3a6e,#16294f 55%,#101a3a)";
  if (t === "route_map") return "linear-gradient(170deg,#1e3a5e,#16294a 55%,#101a30)";
  return "linear-gradient(170deg,#2c1f5e,#1c1445 60%,#120d31)";
}

/**
 * 🔴 KIMI v4 — CTA contextual primario por tipo de bloque.
 * Replica los CTAs del spec Kimi por dominio (pág. 28-30).
 * Devuelve { label, icon } o null si no hay CTA contextual.
 */
function primaryActionFor(block: UiBlock): { label: string; icon: "bell" | "search" | "calendar" | "share" | "bookmark" | "play" | "navigate" | "shopping" | "alarm"; action: string } | null {
  const t = block.type;
  if (t === "weather") return { label: "Avisame si cambia", icon: "bell", action: "weather:notify" };
  if (t === "live_match" || t === "tennis_match") return { label: "Avisame al terminar", icon: "bell", action: "match:notify" };
  if (t === "crypto_portfolio" || t === "market" || t === "forex" || t === "data_ticker") return { label: "Avisame si baja del 5%", icon: "bell", action: "price:alert" };
  if (t === "alarm") return { label: "Editar alarma", icon: "alarm", action: "alarm:edit" };
  if (t === "reminder") return { label: "Posponer 1 hora", icon: "alarm", action: "reminder:snooze" };
  if (t === "memory") return { label: "Regar el jardín", icon: "bookmark", action: "memory:water" };
  if (t === "shopping_list") return { label: "Empezar a comprar", icon: "shopping", action: "shopping:start" };
  if (t === "restaurant_synthesis") return { label: "Reservar mesa", icon: "calendar", action: "reserve" };
  if (t === "recipe") return { label: "Empezar a cocinar", icon: "play", action: "recipe:cook" };
  if (t === "exercise_plan") return { label: "Empezar entrenamiento", icon: "play", action: "exercise:start" };
  if (t === "route_map") return { label: "Navegar", icon: "navigate", action: "route:navigate" };
  if (t === "travel_plan") return { label: "Guardar viaje", icon: "bookmark", action: "travel:save" };
  if (t === "comparison") return { label: "Ver detalles", icon: "search", action: "compare:details" };
  if (t === "morning_brief") return { label: "Avisame mañana a las 7", icon: "bell", action: "morning:schedule" };
  if (t === "news_urgent") return { label: "Leer después", icon: "bookmark", action: "news:save" };
  if (t === "birthday_alarm") return { label: "Recordame 1 día antes", icon: "bell", action: "birthday:remind" };
  return null;
}

// 🔴 v2: Extrae el video ID de una URL de YouTube (youtu.be / watch?v= / embed / shorts).
// Devuelve null si no es una URL válida de YouTube.
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

function SectionHead({ section }: { section: DetailSection }) {
  // 🔴 KIMI v4 — clases canónicas del spec: .mh + .ic + h5 + .mk
  // (reemplazan a koru-module-head/icon/title/kicker que NO aplicaban las
  // reglas CSS Kimi del spec). El .ic usa el gradient del accent de la sección.
  return (
    <div className="mh koru-module-head">
      <span
        className="ic koru-module-icon"
        style={{ background: `linear-gradient(140deg, ${section.accent.color}, ${section.accent.color}cc)` }}
      >
        {(() => {
          const kn = iconFromMaterial(section.icon);
          if (kn !== "default") {
            return <KoruIcon name={kn} size={16} style={{ color: "#fff" }} />;
          }
          return <Mat>{section.icon}</Mat>;
        })()}
      </span>
      <div>
        <h5 className="koru-module-title">{section.title}</h5>
        {section.subtitle && <span className="mk koru-module-kicker">{section.subtitle}</span>}
      </div>
    </div>
  );
}

// 🔴 v2: SourceRow — un source puede tener favicon (imageUrl) o ser un video
// embebido de YouTube (thumbnail + play button + duration badge), o un
// iframe de preview de Archive.org (Open Library book preview).
function SourceRow({ source }: { source: DetailSourceRef }) {
  const ytId = source.url ? youtubeId(source.url) : null;
  const isArchiveEmbed = !!source.url && /archive\.org\/embed\//i.test(source.url);

  const titleEl = (
    <span className="koru-dsec-source-title">
      {source.title}
      {source.domain && <span className="koru-dsec-source-domain"> — {source.domain}</span>}
    </span>
  );

  // 🔴 v4: Archive.org embed — renderiza un iframe 16:9 (400px height) en
  // lugar del link textual. Permite ver el preview del libro sin salir de Koru.
  if (isArchiveEmbed && source.url) {
    return (
      <div className="koru-dsec-source koru-dsec-source-embed">
        <div className="koru-dsec-embed-wrap">
          <iframe
            src={source.url}
            title={source.title}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              height: 400,
              maxHeight: 400,
              border: 0,
              borderRadius: 12,
              background: "#000",
            }}
          />
        </div>
        {titleEl}
      </div>
    );
  }

  // Video embed: thumbnail 16:9 + play button (koru-breathe) + duration badge
  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    const inner = (
      <>
        <div
          className="koru-source-video-thumb"
          style={{ backgroundImage: `url(${thumb})` }}
        >
          <span className="koru-source-video-play animate-breathe">
            <Mat>play_arrow</Mat>
          </span>
          {source.duration && (
            <span className="koru-source-video-duration">{source.duration}</span>
          )}
        </div>
        {titleEl}
      </>
    );
    return source.url ? (
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="koru-dsec-source koru-dsec-source-video"
      >
        {inner}
      </a>
    ) : (
      <div className="koru-dsec-source koru-dsec-source-video">{inner}</div>
    );
  }

  // Favicon: si hay imageUrl, mostrar imagen 28x28 en vez del ícono genérico
  const inner = (
    <>
      {source.imageUrl ? (
        <img
          src={source.imageUrl}
          alt=""
          className="koru-source-favicon"
          loading="lazy"
        />
      ) : (
        <Mat className="koru-dsec-source-icon">language</Mat>
      )}
      {titleEl}
    </>
  );

  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" className="koru-dsec-source">
      {inner}
    </a>
  ) : (
    <div className="koru-dsec-source">{inner}</div>
  );
}

function SectionBody({ section, block }: { section: DetailSection; block?: UiBlock }) {
  switch (section.kind) {
    case "text":
      // 🔴 KIMI v4: .tx canónico (12px ink-soft) reemplaza koru-dsec-text.
      return <p className="tx koru-dsec-text">{section.body}</p>;

    case "tiles":
      // 🔴 KIMI v4: .tiles + .tile + .tv + .tl canónicos reemplazan koru-dsec-*.
      return (
        <div className="tiles koru-dsec-tiles">
          {section.tiles.map((t, i) => (
            <div key={i} className="tile koru-dsec-tile">
              <span className="tv koru-dsec-tile-value">{t.value}</span>
              <span className="tl koru-dsec-tile-label">{t.label}</span>
            </div>
          ))}
        </div>
      );

    case "rows":
      // 🔴 KIMI v4: .trow + .ti + .tb + .tt + .td + .tm canónicos reemplazan koru-dsec-row-*.
      // .ti es el icon-chip con gradient del accent de la sección.
      return (
        <div className="koru-dsec-rows">
          {section.rows.map((r, i) => {
            const toggle = r.toggle;
            const rowInner = (
              <>
                {r.icon && (
                  <span className="ti koru-dsec-row-icon" style={{ background: `linear-gradient(140deg, ${section.accent.color}, ${section.accent.color}cc)` }}>
                    {(() => {
                      const kn = iconFromMaterial(r.icon);
                      if (kn !== "default") return <KoruIcon name={kn} size={14} style={{ color: "#fff" }} />;
                      return <Mat>{r.icon}</Mat>;
                    })()}
                  </span>
                )}
                <div className="tb koru-dsec-row-body">
                  <p className="tt koru-dsec-row-title">{r.title}</p>
                  {r.detail && <p className="td koru-dsec-row-detail">{r.detail}</p>}
                  {/* 🔴 v2: barra comparativa para stats de fútbol (posesión, tiros, etc.) */}
                  {r.bar && <ComparisonBar bar={r.bar} />}
                </div>
                {r.meta && <span className="tm koru-dsec-row-meta">{r.meta}</span>}
                {r.badge && <span className={`koru-step-chip is-${r.badgeTone ?? "pending"}`}>{r.badge}</span>}
              </>
            );
            if (toggle) {
              return (
                <button
                  key={i}
                  type="button"
                  className="trow koru-dsec-row koru-dsec-row-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    const action =
                      toggle.kind === "shopping_item" ? "toggle_shopping" : "toggle_checklist";
                    window.dispatchEvent(
                      new CustomEvent("koru-card-action", {
                        detail: {
                          action,
                          listId: toggle.listId,
                          checklistId: toggle.checklistId,
                          itemId: toggle.itemId,
                          // 🔴 TIER S: include blockData so KoruProvider can
                          // auto-create the durable entity if it doesn't exist.
                          blockData: block,
                        },
                      }),
                    );
                    if ("vibrate" in navigator) navigator.vibrate(12);
                  }}
                >
                  {rowInner}
                </button>
              );
            }
            return (
              <div key={i} className={"trow koru-dsec-row" + (r.bar ? " koru-dsec-row-with-bar" : "")}>
                {rowInner}
              </div>
            );
          })}
        </div>
      );

    case "chips":
      // 🔴 KIMI v4: .pillchips + .pillchip canónicos reemplazan koru-dsec-chips.
      return (
        <div className="pillchips koru-dsec-chips">
          {section.chips.map((c, i) => (
            <span key={i} className="pillchip koru-dsec-chip" style={c.color ? { background: c.color, color: "#fff" } : undefined}>
              <span className="koru-dsec-chip-label">{c.label}</span>
              {c.sub && <span className="koru-dsec-chip-sub">{c.sub}</span>}
            </span>
          ))}
        </div>
      );

    case "calendar":
      // 🔴 v2: kind dedicado para el calendario de cumpleaños. Usa clases
      // propias (.koru-dsec-calendar / -day) para no colisionar con los chips
      // genéricos que ahora vuelven a verse como píldoras.
      return (
        <div className="koru-dsec-calendar">
          {section.days.map((d, i) => (
            <div
              key={i}
              className="koru-dsec-calendar-day"
              style={d.color ? { color: d.color } : undefined}
            >
              <span className="koru-dsec-chip-label">{d.label}</span>
              {d.sub && <span className="koru-dsec-chip-sub">{d.sub}</span>}
            </div>
          ))}
        </div>
      );

    case "scroller":
      return (
        <div className="koru-dsec-scroller">
          {section.cards.map((c, i) => (
            <div key={i} className="koru-dsec-scard">
              {/* 🔴 v3: badge image (Google Places photo) — thumbnail 16:9 sobre el título. */}
              {c.image && (
                <div className="koru-dsec-scard-image">
                  <img src={c.image} alt={c.title} loading="lazy" />
                </div>
              )}
              {c.badge && (
                <span className="koru-dsec-scard-badge" style={c.badgeColor ? { color: c.badgeColor, background: `${c.badgeColor}1a` } : undefined}>
                  {c.badge}
                </span>
              )}
              <h4 className="koru-dsec-scard-title">{c.title}</h4>
              {c.detail && <p className="koru-dsec-scard-detail">{c.detail}</p>}
              {c.metrics && c.metrics.length > 0 && (
                <div className="koru-dsec-scard-metrics">
                  {c.metrics.map((m, j) => (
                    <span key={j} className="koru-dsec-scard-metric">{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case "timeline":
      // 🔴 KIMI v4: .tl-wrap + .tl-step + .when + .tt + .td canónicos
      // reemplazan koru-timeline-*. Status done/now/pending como clases.
      return (
        <div className="tl-wrap koru-timeline">
          <div className="koru-timeline-line" />
          <div className="koru-timeline-steps">
            {section.steps.map((s, i) => {
              const status = s.status ?? "pending";
              const toggle = s.toggle;
              const stepInner = (
                <>
                  <div className="koru-timeline-dot">
                    {status === "done" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round"><path d="M4 12l5 5L20 6"/></svg>
                    ) : (
                      <Mat>{s.icon ?? "radio_button_unchecked"}</Mat>
                    )}
                  </div>
                  <div className="koru-timeline-body">
                    {s.detail && <span className="when koru-timeline-meta">{s.detail}</span>}
                    <h4 className="tt koru-timeline-name">{s.title}</h4>
                    {s.badge && <span className={`koru-step-chip is-${s.badgeTone ?? "pending"}`}>{s.badge}</span>}
                  </div>
                </>
              );
              if (toggle && toggle.kind === "plan_step") {
                return (
                  <button
                    key={i}
                    type="button"
                    className={`tl-step is-${status} koru-timeline-step koru-timeline-step-toggle`}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(
                        new CustomEvent("koru-card-action", {
                          detail: {
                            action: "toggle_step",
                            planId: toggle.planId,
                            stepId: toggle.stepId,
                            blockData: block,
                          },
                        }),
                      );
                      if ("vibrate" in navigator) navigator.vibrate(12);
                    }}
                  >
                    {stepInner}
                  </button>
                );
              }
              return (
                <div key={i} className={`tl-step is-${status} koru-timeline-step`}>
                  {stepInner}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "sources":
      return (
        <div className="koru-dsec-sources">
          {section.sources.map((s, i) => (
            <SourceRow key={i} source={s} />
          ))}
        </div>
      );

    case "pitch":
      return <FormationPitch pitch={section.pitch} />;

    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

function FormationPitch({ pitch }: { pitch: NonNullable<Extract<DetailSection, { kind: "pitch" }>["pitch"]> }) {
  const { homeFormation, awayFormation, homePlayers, awayPlayers, homeColor, awayColor, homeName, awayName } = pitch;
  const hc = homeColor || "#2d6a4f";
  const ac = awayColor || "#8363f9";

  // Parse formation string "4-3-3" → [4, 3, 3]
  function parseFormation(f: string): number[] {
    return f.split("-").map(n => parseInt(n, 10) || 0).filter(n => n > 0);
  }

  // Posicionar jugadores en una mitad de cancha (50% vertical)
  // home juega "hacia arriba" (de abajo hacia arriba), away "hacia abajo"
  // Cada línea del formation se posiciona a un Y% creciente desde el arquero.
  function positionPlayers(players: Array<{ number?: string; name: string; position?: string }>, formation: string, isHome: boolean): Array<{ x: number; y: number; player: typeof players[0] }> {
    if (players.length === 0) return [];
    const lines = parseFormation(formation);
    const result: Array<{ x: number; y: number; player: typeof players[0] }> = [];
    let playerIdx = 0;

    // GK siempre primero, en la línea de gol
    if (players[0]) {
      result.push({ x: 50, y: isHome ? 95 : 5, player: players[0] });
      playerIdx = 1;
    }

    // Cada línea del formation: distribuir N jugadores en una fila horizontal
    // Y va creciendo desde la defensa (cerca del arquero) hasta el ataque (cerca del mediocampo)
    const linesCount = lines.length;
    lines.forEach((count, lineIdx) => {
      // Y para home: de 80% (defensa) a 55% (ataque, mediocampo)
      // Y para away: de 20% (defensa) a 45% (ataque, mediocampo)
      const yBase = isHome ? 80 : 20;
      const yEnd = isHome ? 55 : 45;
      const yRange = Math.abs(yBase - yEnd);
      const yStep = linesCount > 1 ? yRange / (linesCount - 1) : 0;
      const y = isHome ? yBase - lineIdx * yStep : yBase + lineIdx * yStep;

      // Distribuir los N jugadores horizontalmente
      for (let i = 0; i < count && playerIdx < players.length; i++) {
        const x = ((i + 1) / (count + 1)) * 100;
        result.push({ x, y, player: players[playerIdx] });
        playerIdx++;
      }
    });

    return result;
  }

  const homePositions = positionPlayers(homePlayers, homeFormation, true);
  const awayPositions = positionPlayers(awayPlayers, awayFormation, false);

  return (
    <div className="koru-pitch-container">
      <div className="koru-pitch-header">
        <span style={{ color: hc }}>{awayName} · {awayFormation}</span>
        <span style={{ color: ac, fontSize: 11, opacity: 0.7 }}>vs</span>
        <span style={{ color: hc }}>{homeName} · {homeFormation}</span>
      </div>
      <div className="koru-pitch">
        {/* Líneas de cancha */}
        <div className="koru-pitch-line halfway" />
        <div className="koru-pitch-circle" />
        <div className="koru-pitch-box top" />
        <div className="koru-pitch-box bottom" />

        {/* Players away (arriba) */}
        {awayPositions.map((pos, i) => (
          <div
            key={`away-${i}`}
            className="koru-pitch-player away"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: ac,
            }}
            title={`${pos.player.name}${pos.player.number ? ` #${pos.player.number}` : ""}`}
          >
            <span className="koru-pitch-player-num">{pos.player.number ?? ""}</span>
            <span className="koru-pitch-player-name">{pos.player.name.split(" ").slice(-1)[0]}</span>
          </div>
        ))}

        {/* Players home (abajo) */}
        {homePositions.map((pos, i) => (
          <div
            key={`home-${i}`}
            className="koru-pitch-player home"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: hc,
            }}
            title={`${pos.player.name}${pos.player.number ? ` #${pos.player.number}` : ""}`}
          >
            <span className="koru-pitch-player-num">{pos.player.number ?? ""}</span>
            <span className="koru-pitch-player-name">{pos.player.name.split(" ").slice(-1)[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 🔴 v4 — Decision sensitivity analysis panel. For each factor in the
// decision, runs sensitivityAnalysis with +20% delta on that factor's weight,
// then renders an inline-SVG horizontal bar chart where bar width ∝ score
// change of the current winner. Bars that would flip the winner are amber
// with a "⚠ Cambia el ganador" annotation.
function DecisionSensitivityPanel({ block }: { block: Extract<UiBlock, { type: "decision_support" }> }) {
  const { state } = useKoru();
  const decisionId = block.decisionId;
  if (!decisionId) return null;
  const decision = (state.decisions ?? []).find((d) => d.id === decisionId);
  if (!decision) return null;
  if (decision.factors.length === 0 || decision.options.length === 0) return null;

  const deltaPct = 20;
  const rows = decision.factors.map((factor) => {
    const result = sensitivityAnalysis(decision, factor.id, deltaPct);
    // Compute the magnitude of the winning option's WADD score change so
    // we have something proportional to drive the bar width. sensitivityAnalysis
    // itself only reports wouldFlip + newWinner; the actual delta we compute
    // here with weightedAdditive (same algorithm the engine uses internally).
    const adjustedWeights = { ...decision.weights };
    const currentWeight = adjustedWeights[factor.id] ?? 0;
    adjustedWeights[factor.id] = currentWeight * (1 + deltaPct / 100);
    const originalScores = weightedAdditive(
      decision.options,
      decision.factors,
      decision.weights,
    );
    const adjustedScores = weightedAdditive(
      decision.options,
      decision.factors,
      adjustedWeights,
    );
    const winner = decision.result?.recommendation ?? "";
    const scoreChange = Math.abs(
      (adjustedScores[winner] ?? 0) - (originalScores[winner] ?? 0),
    );
    return { factor, result, scoreChange };
  });

  const maxChange = Math.max(...rows.map((r) => r.scoreChange), 0.0001);

  // SVG layout — each row 28px tall, bar grows left→right inside a 220px track.
  const rowH = 28;
  const labelW = 110;
  const barX = labelW + 8;
  const barMax = 220;
  const svgW = labelW + 8 + barMax + 12;
  const svgH = rows.length * rowH + 8;

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div
        style={{
          background: "rgba(99,102,241,0.05)",
          borderRadius: 18,
          padding: "16px 18px",
          border: "1px solid rgba(99,102,241,0.18)",
        }}
      >
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 11,
            fontWeight: 800,
            color: "#4f46e5",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          Análisis de sensibilidad
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#5a5a72" }}>
          ¿Qué pasa si cada factor pesa +20%? Las barras ámbar indican que el ganador cambiaría.
        </p>
        <svg
          width="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMinYMin meet"
          role="img"
          aria-label="Análisis de sensibilidad de la decisión"
        >
          {rows.map((row, i) => {
            const y = i * rowH + 6;
            const barLen = Math.max(2, (row.scoreChange / maxChange) * barMax);
            const flip = row.result.wouldFlip;
            const barColor = flip ? "#f59e0b" : "#6366f1";
            const label =
              row.factor.label.length > 16
                ? row.factor.label.slice(0, 15) + "…"
                : row.factor.label;
            return (
              <g key={row.factor.id}>
                <text
                  x={labelW}
                  y={y + 12}
                  textAnchor="end"
                  fontSize={11}
                  fill="#1a1a2e"
                  fontWeight={600}
                >
                  {label}
                </text>
                <rect x={barX} y={y} width={barMax} height={14} rx={3} fill="rgba(0,0,0,0.05)" />
                <rect x={barX} y={y} width={barLen} height={14} rx={3} fill={barColor} />
                {flip && (
                  <text x={barX + barMax + 6} y={y + 12} fontSize={10} fill="#b45309" fontWeight={700}>
                    ⚠
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {rows.some((r) => r.result.wouldFlip) && (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: "#b45309",
              fontWeight: 700,
            }}
          >
            ⚠ Cambia el ganador si sube +20%:{" "}
            {rows
              .filter((r) => r.result.wouldFlip)
              .map((r) => r.factor.label)
              .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

// 🔴 v4 — Decision pre-mortem panel. For each option, show a collapsible card
// with its 3 lowest-scoring factors (template-based risk string). Each risk
// has a "Mitigado" / "Aceptado" toggle stored in local state. Risk text is
// rendered in amber.
function DecisionPreMortemPanel({ block }: { block: Extract<UiBlock, { type: "decision_support" }> }) {
  const { state } = useKoru();
  const decisionId = block.decisionId;
  if (!decisionId) return null;
  const decision = (state.decisions ?? []).find((d) => d.id === decisionId);
  if (!decision) return null;
  if (decision.options.length === 0 || decision.factors.length === 0) return null;

  const analysis = preMortem(decision.options, decision.factors);
  // Mitigation state: keyed by `${optionId}:${riskIndex}` → "mitigated" | "accepted" | undefined
  const [mitigation, setMitigation] = useState<Record<string, "mitigated" | "accepted" | undefined>>({});
  const [openOption, setOpenOption] = useState<string | null>(
    decision.options[0]?.id ?? null,
  );

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div
        style={{
          background: "rgba(245,158,11,0.05)",
          borderRadius: 18,
          padding: "16px 18px",
          border: "1px solid rgba(245,158,11,0.22)",
        }}
      >
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 11,
            fontWeight: 800,
            color: "#b45309",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          Pre-mortem
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#5a5a72" }}>
          Si esta opción falla, lo más probable es que sea por…
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {analysis.map((entry) => {
            const option = decision.options.find((o) => o.id === entry.optionId);
            const isOpen = openOption === entry.optionId;
            return (
              <div
                key={entry.optionId}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(245,158,11,0.25)",
                  background: "#fff",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenOption(isOpen ? null : entry.optionId)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>
                    {option?.label ?? entry.optionId}
                  </span>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 18,
                      color: "#b45309",
                      transition: "transform 0.15s",
                      transform: isOpen ? "rotate(180deg)" : "none",
                    }}
                  >
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {entry.risks.map((risk, idx) => {
                      const key = `${entry.optionId}:${idx}`;
                      const status = mitigation[key];
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(245,158,11,0.06)",
                            border: "1px solid rgba(245,158,11,0.15)",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: 12,
                              color: "#b45309",
                              lineHeight: 1.4,
                            }}
                          >
                            {risk}
                          </p>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() =>
                                setMitigation((prev) => ({
                                  ...prev,
                                  [key]: status === "mitigated" ? undefined : "mitigated",
                                }))
                              }
                              style={{
                                flex: 1,
                                padding: "6px 0",
                                borderRadius: 8,
                                border:
                                  status === "mitigated"
                                    ? "2px solid #059669"
                                    : "1px solid rgba(0,0,0,0.12)",
                                background:
                                  status === "mitigated" ? "rgba(5,150,105,0.10)" : "#fff",
                                color: status === "mitigated" ? "#059669" : "#5a5a72",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Mitigado
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setMitigation((prev) => ({
                                  ...prev,
                                  [key]: status === "accepted" ? undefined : "accepted",
                                }))
                              }
                              style={{
                                flex: 1,
                                padding: "6px 0",
                                borderRadius: 8,
                                border:
                                  status === "accepted"
                                    ? "2px solid #b45309"
                                    : "1px solid rgba(0,0,0,0.12)",
                                background:
                                  status === "accepted" ? "rgba(245,158,11,0.12)" : "#fff",
                                color: status === "accepted" ? "#b45309" : "#5a5a72",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Aceptado
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 🔴 v4 — Recipe servings scaler. Lets the user scale ingredient quantities
// up/down with "−" / "+" buttons (1..20). For each ingredient we parse the
// numeric prefix of `measure`, multiply by (newServings/originalServings), and
// re-render the quantity next to the original. Falls back to the original
// measure string when no number is parseable.
function RecipeServingsScaler({ block }: { block: Extract<UiBlock, { type: "recipe" }> }) {
  const originalServings = block.servings && block.servings > 0 ? block.servings : 4;
  const [servings, setServings] = useState(originalServings);
  const ingredients = block.ingredients ?? [];

  // Parse the leading number (int or decimal) of a measure string like
  // "200 g", "1/2 taza", "2 cdas". Returns null when no leading number is found.
  function parseLeadingNumber(s: string): { value: number; rest: string } | null {
    const m = s.trim().match(/^(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    return { value: parseFloat(m[1].replace(",", ".")), rest: s.trim().slice(m[1].length) };
  }

  function scaleMeasure(measure: string): string {
    if (!measure) return measure;
    const parsed = parseLeadingNumber(measure);
    if (!parsed) return measure;
    const scaled = parsed.value * (servings / originalServings);
    // Pretty-print: integers without decimals, otherwise 2 decimal places trimmed.
    const rounded = Math.round(scaled * 100) / 100;
    const display = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    return `${display}${parsed.rest}`;
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div
        style={{
          background: "rgba(16,185,129,0.05)",
          borderRadius: 18,
          padding: "16px 18px",
          border: "1px solid rgba(16,185,129,0.22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              color: "#059669",
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Ajustar porciones
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              aria-label="Restar porción"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                border: "1px solid rgba(16,185,129,0.30)",
                background: "#fff",
                color: "#059669",
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e", minWidth: 18, textAlign: "center" }}>
              {servings}
            </span>
            <button
              type="button"
              aria-label="Sumar porción"
              onClick={() => setServings((s) => Math.min(20, s + 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                border: "1px solid rgba(16,185,129,0.30)",
                background: "#fff",
                color: "#059669",
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#5a5a72" }}>
          Original: {originalServings} · Actual: {servings}
        </p>
        {ingredients.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ingredients.map((ing, i) => {
              const original = ing.measure || "";
              const scaled = scaleMeasure(original);
              const changed = scaled !== original && servings !== originalServings;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.55)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 600 }}>
                    {ing.ingredient}
                  </span>
                  <span style={{ fontSize: 12, color: changed ? "#059669" : "#5a5a72", fontWeight: 700 }}>
                    {changed ? `${original} → ${scaled}` : original}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 🔴 v4 — Decision outcome panel: lets the user register which option they
// chose + a 1-5 satisfaction rating. The reducer updateDecisionOutcome writes
// the outcome, creates a follow-up commitment (90d) and a MemoryFact kind
// "preference" with confidence boosted/reduced by the satisfaction score.
function DecisionOutcomePanel({ block }: { block: Extract<UiBlock, { type: "decision_support" }> }) {
  const { state, updateDecisionOutcome } = useKoru();
  const decisionId = block.decisionId;
  // Sin decisionId no podemos vincular el bloque a una Decision durable.
  if (!decisionId) return null;
  const decision = (state.decisions ?? []).find((d) => d.id === decisionId);
  if (!decision) return null;

  // Outcome ya registrado → mostrar resumen "Decidiste: X · Satisfacción: N/5".
  const outcome = decision.outcome;
  if (outcome) {
    const chosen = decision.options.find((o) => o.id === outcome.chosenOptionId);
    const chosenLabel = chosen?.label ?? "Opción elegida";
    return (
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(67,56,202,0.06))",
            borderRadius: 18,
            padding: "16px 18px",
            border: "1px solid rgba(99,102,241,0.18)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#4f46e5" }}>
              check_circle
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#4f46e5", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Decidiste
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>
            {chosenLabel}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#5a5a72" }}>Satisfacción:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: satisfactionColor(outcome.satisfaction1to5) }}>
              {outcome.satisfaction1to5}/5
            </span>
            <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 14,
                    color: i < outcome.satisfaction1to5 ? "#f59e0b" : "rgba(0,0,0,0.18)",
                  }}
                >
                  star
                </span>
              ))}
            </div>
          </div>
          {outcome.notes && (
            <p style={{ margin: 0, fontSize: 13, color: "#5a5a72", fontStyle: "italic" }}>
              "{outcome.notes}"
            </p>
          )}
        </div>
      </div>
    );
  }

  // Sin outcome → mostrar prompt "¿Ya decidiste?" con botones por opción.
  // El primer tap elige la opción; luego pedimos satisfaction 1-5 inline.
  return (
    <DecisionOutcomeEditor
      decision={decision}
      onSubmit={(chosenOptionId, satisfaction1to5, notes) => {
        updateDecisionOutcome(decision.id, {
          chosenOptionId,
          decidedAt: new Date().toISOString(),
          satisfaction1to5,
          notes,
        });
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate(15); } catch { /* best-effort */ }
        }
      }}
    />
  );
}

function satisfactionColor(rating: number): string {
  if (rating >= 4) return "#059669";
  if (rating <= 2) return "#dc2626";
  return "#d97706";
}

// 🔴 v4 — Inline editor: opción elegida → satisfaction rating → submit.
// Tres estados: "choosing" (lista de opciones), "rating" (selector 1-5 estrellas),
// "done" (transient confirmation; el panel padre ya re-renderiza con el outcome).
function DecisionOutcomeEditor({
  decision,
  onSubmit,
}: {
  decision: import("../../../domain/types").Decision;
  onSubmit: (chosenOptionId: string, satisfaction1to5: number, notes?: string) => void;
}) {
  const [phase, setPhase] = useState<"choosing" | "rating">("choosing");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);

  const options = decision.options.length > 0
    ? decision.options
    : [];

  if (options.length === 0) return null;

  // Phase 2: rating — muestra la opción elegida + 5 estrellas para satisfaction.
  if (phase === "rating" && chosenId) {
    const chosen = options.find((o) => o.id === chosenId);
    return (
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "rgba(99,102,241,0.06)",
            borderRadius: 18,
            padding: "16px 18px",
            border: "1px solid rgba(99,102,241,0.18)",
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#4f46e5", letterSpacing: 0.4, textTransform: "uppercase" }}>
            ¿Ya decidiste?
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>
            Elegiste: {chosen?.label ?? "—"}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#5a5a72" }}>
            ¿Qué tan satisfecho quedaste?
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} estrellas`}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: rating === n ? "2px solid #4f46e5" : "1px solid rgba(0,0,0,0.12)",
                  background: rating === n ? "rgba(99,102,241,0.10)" : "#fff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: rating >= n ? "#f59e0b" : "rgba(0,0,0,0.25)" }}
                >
                  star
                </span>
                <span style={{ fontSize: 11, color: "#5a5a72", fontWeight: 700 }}>{n}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => { setPhase("choosing"); setChosenId(null); setRating(0); }}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#fff",
                color: "#5a5a72",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Volver
            </button>
            <button
              type="button"
              disabled={rating === 0}
              onClick={() => onSubmit(chosenId, rating)}
              style={{
                flex: 2,
                padding: "10px 0",
                borderRadius: 12,
                border: "none",
                background: rating === 0 ? "rgba(99,102,241,0.30)" : "linear-gradient(135deg, #6366f1, #4338ca)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: rating === 0 ? "not-allowed" : "pointer",
                boxShadow: rating === 0 ? "none" : "0 6px 16px rgba(99,102,241,0.30)",
              }}
            >
              Confirmar decisión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Phase 1: choosing — lista de opciones como botones grandes.
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div
        style={{
          background: "rgba(99,102,241,0.06)",
          borderRadius: 18,
          padding: "16px 18px",
          border: "1px solid rgba(99,102,241,0.18)",
        }}
      >
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: "#4f46e5", letterSpacing: 0.4, textTransform: "uppercase" }}>
          ¿Ya decidiste?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { setChosenId(o.id); setPhase("rating"); }}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(99,102,241,0.25)",
                background: "#fff",
                color: "#1a1a2e",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>{o.label}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#4f46e5" }}>
                arrow_forward
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KoruDetailScreen({
  detail,
  headerIcon,
  onClose,
  onSave,
  onExportPdf,
  block,
}: {
  detail: Detail;
  headerIcon: string;
  onClose: () => void;
  onSave?: (title: string, subtitle?: string) => void;
  onExportPdf?: () => void;
  // 🔴 TIER S: el UiBlock original se pasa para que los toggles de rows/steps
  // puedan incluir `blockData` en el CustomEvent. Así el handler en
  // KoruProvider puede auto-crear la entidad durable (Plan/ShoppingList/
  // Checklist) si no existe, haciendo que el toggle sea efectivo aún para
  // bloques transitorios del LLM.
  block?: UiBlock;
}) {
  // 🔴 P2 — Cooking mode: estado que abre el overlay full-screen.
  // Sólo se activa si el block es un UiBlock `recipe` con steps.
  const [cookingOpen, setCookingOpen] = useState(false);
  // 🔴 P2 — Workout session: estado que abre el overlay full-screen.
  // Sólo se activa si el block es un UiBlock `exercise_plan` con sesiones.
  const [workoutOpen, setWorkoutOpen] = useState(false);
  // 🔴 P2 — Toast "Abriendo navegación..." para el botón Navegar de route_map.
  // Se muestra con la animación koru-save-rise (mismo feel que el modal Save).
  const [navToast, setNavToast] = useState<string | null>(null);

  const recipe = block && block.type === "recipe" ? block : null;
  const recipeTitle = recipe?.name ?? recipe?.title ?? detail.title;
  const cookingSteps: CookingStep[] = (recipe?.steps ?? []).map((s) => {
    const maybeTimer = (s as unknown as { timerSec?: unknown }).timerSec;
    return {
      step: s.step,
      text: s.text,
      // timerSec se conserva si el dominio lo llega a agregar (hoy no viene).
      ...(typeof maybeTimer === "number"
        ? { timerSec: maybeTimer }
        : {}),
    };
  });
  const canCook = !!recipe && cookingSteps.length > 0;

  // exercise_plan: plan + sesión actual (currentSessionIdx).
  const exercisePlan = block && block.type === "exercise_plan" ? block : null;
  const exercisePlanObj = exercisePlan?.plan;
  const workoutSession =
    exercisePlanObj && exercisePlanObj.sessions.length > 0
      ? exercisePlanObj.sessions[Math.min(exercisePlanObj.currentSessionIdx ?? 0, exercisePlanObj.sessions.length - 1)]
      : null;
  const canWorkout = !!exercisePlanObj && !!workoutSession;

  // 🔴 P2 — route_map: extraemos destino + coords (opcionales) para el CTA
  // "Navegar". El destino prioriza `to` (lugar de llegada); si no, cae a
  // `from`. Sin destino, el botón no se renderiza.
  const routeMap = block && block.type === "route_map" ? block : null;
  const navDestination =
    (routeMap?.to && routeMap.to.trim()) ||
    (routeMap?.from && routeMap.from.trim()) ||
    "";
  const canNavigate = !!routeMap && navDestination.length > 0;

  // 🔴 P2 — Handler "Navegar": construye la URL según plataforma, abre la
  // app nativa de mapas (geo:/maps:) o Google Maps web en desktop, muestra
  // un toast "Abriendo navegación..." con koru-save-rise, y vibra (haptic).
  function handleNavigate() {
    if (!canNavigate) return;
    const url = buildNavUrl({
      destination: navDestination,
      lat: routeMap?.lat,
      lng: routeMap?.lng,
    });
    if (!url) return;
    // 🔴 Toast con animación koru-save-rise (mismo feel que el modal Save).
    setNavToast("Abriendo navegación...");
    // 🔴 Haptic feedback — patrón corto si Vibration API está disponible.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // best-effort — algunos browsers lanzan si el usuario no interactuó
      }
    }
    // 🔴 Abrir URL — en mobile usamos window.location.href para que el SO
    // intercepte el esquema (geo:/maps:) y abra la app nativa. En desktop
    // abrimos en pestaña nueva con window.open.
    try {
      if (isAndroid() || isIOS()) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      // best-effort — si el esquema falla (popup blocker, etc.), el toast
      // igual le da feedback al usuario de que intentamos.
    }
    // 🔴 Auto-ocultar el toast después de 2.2s (mismo tiempo que save-toast).
    window.setTimeout(() => setNavToast(null), 2200);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sections = detail.sections ?? [];
  const isEmpty = sections.length === 0;

  return createPortal(
    <div className="koru-roadmap" role="dialog" aria-label={detail.title}>
      {/* 🔴 KIMI audit: kc-* / xt-* — `.xt` (dark night theme) se añade
          alongside `.koru-roadmap-screen` (phone frame). El CSS del audit
          (cargado después en style.css) pinta el fondo gradient night y
          border-radius:44px sobre el frame existente. */}
      <div className="koru-roadmap-screen xt">
        {/* 🔴 KIMI v4: blobs eliminados — el spec Kimi NO los tiene.
            El .glow del xt-hero ya da la atmósfera. */}

        {/* 🔴 KIMI v4: xt-hero CANÓNICO con gradient dark del dominio + glow +
            back + fav + xt-hicon (SVG animado) + xt-title + xt-sub. Replica
            exactamente la estructura del spec Kimi (pág. 28 anatomía del extendido).
            NO hay sticky header duplicado — el spec solo tiene el xt-hero
            con back + fav como botones flotantes absolutos. */}
        <div
          className="koru-roadmap-header xt-hero"
          style={{ background: block ? heroGradientBg(block) : "linear-gradient(170deg,#2c1f5e,#1c1445 60%,#120d31)" }}
        >
          {/* glow: div absolutamente posicionado con color del acento del bloque. */}
          <div className="glow" style={{ background: block ? heroGlowColor(block) : "#8363f9" }} />
          {/* back: botón volver con SVG (igual al spec). Mismo handler que el sticky. */}
          <button
            type="button"
            aria-label="Volver"
            className="back"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          {/* fav: botón favorito con SVG bookmark (igual al spec). */}
          <button
            type="button"
            aria-label="Guardar"
            className="fav"
            onClick={() => onSave?.(detail.title, detail.subtitle)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4h12v17l-6-4-6 4z" />
            </svg>
          </button>
          {/* xt-hicon: SVG animado (KoruIcon) en cuadrado de acento. */}
          <div className="koru-detail-hero-icon xt-hicon" style={{ background: block ? heroIconBg(block) : "linear-gradient(150deg,#8363f9,#523a9e)" }}>
            {(() => {
              const kn = iconFromMaterial(headerIcon);
              if (kn !== "default") {
                return <KoruIcon name={kn} size={38} style={{ color: "#fff" }} />;
              }
              return <Mat>{headerIcon}</Mat>;
            })()}
          </div>
          <h1 className="koru-roadmap-title xt-title">{detail.title}</h1>
          {detail.subtitle && <p className="koru-roadmap-subtitle xt-sub">{detail.subtitle}</p>}
        </div>

        {/* 🔴 KIMI audit: `.xt-body` añade margin-top negativo + padding
            sobre el stack de módulos, y `.mcard` añade el gradiente blanco→
            lila + border-radius:22px sobre cada `.koru-magical-card`. Ambos
            conviven con las clases Stitch existentes (cascade: xt/mcard
            cargados después prevalecen para mismas props). */}
        <div className="koru-roadmap-modules xt-body">
          {isEmpty ? (
            <div className="koru-unified-empty koru-detail-empty">
              <Mat>inbox</Mat>
              <span>No hay secciones para mostrar en este detalle.</span>
            </div>
          ) : (
            sections.map((section, i) => {
              // 🔴 KIMI v3: si la sección es de Compras (título "Góndola N · ..."),
              // la envolvemos en .koru-aisle-group con .koru-aisle-header visible.
              const isAisle = /^g[óo]ndola\s+\d+/i.test(section.title ?? "");
              const wrapperClass = isAisle
                ? `koru-magical-card mcard koru-aisle-group`
                : `koru-magical-card mcard`;
              return (
                <div
                  key={i}
                  className={wrapperClass}
                  style={{ ...moduleStyle(section.accent), "--stagger-i": i } as CSSProperties}
                >
                  {isAisle && (
                    <div className="koru-aisle-header" aria-hidden="true">
                      <span>{section.title}</span>
                    </div>
                  )}
                  <SectionHead section={section} />
                  <SectionBody section={section} block={block} />
                </div>
              );
            })
          )}
        </div>

        {/* 🔴 P2 — "Empezar a cocinar": abre el overlay CookingMode cuando el
            bloque es una receta con pasos. Se renderiza como un CTA grande
            al final de la lista de secciones (antes del sticky footer). */}
        {canCook && (
          <div style={{ padding: "0 16px 16px" }}>
            <button
              type="button"
              onClick={() => setCookingOpen(true)}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 18,
                border: "none",
                background: "linear-gradient(135deg, #8363f9, #4648d4)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(131, 99, 249, 0.30)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>soup_kitchen</span>
              Empezar a cocinar
              <span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.85 }}>arrow_forward</span>
            </button>
          </div>
        )}

        {/* 🔴 P2 — "Empezar sesión": abre el overlay WorkoutSession cuando el
            bloque es un exercise_plan con sesiones. CTA verde oscuro fitness. */}
        {canWorkout && (
          <div style={{ padding: "0 16px 16px" }}>
            <button
              type="button"
              onClick={() => setWorkoutOpen(true)}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 18,
                border: "none",
                background: "linear-gradient(135deg, #2d6a4f, #1a3d2e)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(45, 106, 79, 0.30)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>play_arrow</span>
              Empezar sesión
              <span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.85 }}>arrow_forward</span>
            </button>
          </div>
        )}

        {/* 🔴 P2 — "Navegar" para route_map. Abre la app nativa de mapas
            (geo: en Android, maps: en iOS) o Google Maps web en desktop.
            El CTA usa el accent indigo (mismo que el hero de routeMap) para
            coherencia visual. Toast + haptic al tap. */}
        {canNavigate && (
          <div style={{ padding: "0 16px 16px" }}>
            <button
              type="button"
              onClick={handleNavigate}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 18,
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #4338ca)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(99, 102, 241, 0.30)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              aria-label={`Navegar a ${navDestination}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>navigation</span>
              Navegar
              {navDestination ? (
                <span style={{ opacity: 0.85, fontWeight: 600, fontSize: 13 }}>
                  · {navDestination.length > 28 ? navDestination.slice(0, 28) + "…" : navDestination}
                </span>
              ) : null}
            </button>
          </div>
        )}

        {/* 🔴 P2 — Price history sparklines para bloques de comparison.
            Cada item con URL (Amazon/product) muestra un mini-chart SVG
            inline alimentado por Keepa (si hay KEEPA_API_KEY) o un fallback
            "no disponible". */}
        {block && block.type === "comparison" && block.items.some((it) => it.url) && (
          <div style={{ padding: "0 16px 16px" }}>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                fontWeight: 800,
                color: "#1a1a2e",
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              Histórico de precios
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {block.items
                .filter((it) => it.url)
                .map((it, i) => (
                  <PriceHistoryChart
                    key={i}
                    title={it.title}
                    url={it.url ?? ""}
                    asin={extractAsin(it.url ?? "")}
                    currentPrice={it.price}
                  />
                ))}
            </div>
          </div>
        )}

        {/* 🔴 v4: Decision outcome panel — when block is decision_support and
            has decisionId, render the outcome tracker (chosen option +
            satisfaction rating). The panel reads the Decision from state via
            useKoru() and calls updateDecisionOutcome. */}
        {block && block.type === "decision_support" && (
          <DecisionOutcomePanel block={block} />
        )}

        {/* 🔴 v4: Decision sensitivity analysis + pre-mortem — both panels
            read the Decision from state via useKoru() and only render when
            the block is decision_support and has a valid decisionId pointing
            to a Decision with options + factors. */}
        {block && block.type === "decision_support" && (
          <DecisionSensitivityPanel block={block} />
        )}
        {block && block.type === "decision_support" && (
          <DecisionPreMortemPanel block={block} />
        )}

        {/* 🔴 v4: Recipe servings scaler — when block is a recipe with
            ingredients, render a "− / +" scaler (1..20) that re-computes
            each ingredient's leading quantity proportionally. */}
        {block && block.type === "recipe" && block.ingredients && block.ingredients.length > 0 && (
          <RecipeServingsScaler block={block} />
        )}

        {/* 🔴 KIMI v4: Sticky footer CANÓNICO con CTAs contextuales por dominio.
            Lee los CTAs del `detail.actions` (definidos por cada mapper en
            presentation.ts) en vez de hardcodearlos. Fallback a primaryActionFor
            + Guardar si el mapper no definió actions. */}
        <div className="koru-detail-actions-sticky xt-actions">
          {(() => {
            // Si el mapper definió actions custom en detail, usar esos.
            const actions = (detail as Detail & { actions?: Array<{ label: string; icon?: string; kind?: "primary" | "secondary"; action: string }> }).actions;
            if (actions && actions.length > 0) {
              return actions.map((act, i) => (
                <button
                  key={i}
                  type="button"
                  className={`koru-dsec-action-btn xbtn ${act.kind === "primary" ? "pri" : "sec"}`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("koru-card-action", {
                      detail: { action: act.action, blockType: block?.type, blockData: block },
                    }));
                    if ("vibrate" in navigator) navigator.vibrate(15);
                  }}
                >
                  {act.icon === "bell" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="bellswing"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9zM10 20a2.2 2.2 0 0 0 4 0"/></svg>}
                  {act.icon === "plus" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
                  {act.icon === "calendar" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>}
                  {act.icon === "play" && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                  {act.icon === "alarm" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3"/></svg>}
                  {act.icon === "bookmark" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>}
                  {act.icon === "navigate" && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z"/></svg>}
                  {act.icon === "shopping" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 7h14l-1.5 12a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5 7z"/><path d="M8.5 7V5a3.5 3.5 0 0 1 7 0v2"/></svg>}
                  {act.icon === "search" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>}
                  {act.icon === "moon" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>}
                  {act.icon === "share" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>}
                  {!act.icon && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>}
                  <span>{act.label}</span>
                </button>
              ));
            }
            // Fallback: CTA contextual primario por defecto + Guardar.
            if (!block) return null;
            const primary = primaryActionFor(block);
            if (!primary) return null;
            const iconSvg = (() => {
              switch (primary.icon) {
                case "bell":
                  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="bellswing"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9zM10 20a2.2 2.2 0 0 0 4 0"/></svg>;
                case "alarm":
                  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3"/></svg>;
                case "play":
                  return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
                case "calendar":
                  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
                case "navigate":
                  return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z"/></svg>;
                case "shopping":
                  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 7h14l-1.5 12a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5 7z"/><path d="M8.5 7V5a3.5 3.5 0 0 1 7 0v2"/></svg>;
                case "search":
                  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>;
                case "bookmark":
                  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>;
                default:
                  return null;
              }
            })();
            return (
              <button
                type="button"
                className="koru-dsec-action-btn xbtn pri"
                onClick={() => {
                  if (!block) return;
                  window.dispatchEvent(new CustomEvent("koru-card-action", {
                    detail: { action: primary.action, blockType: block.type, blockData: block },
                  }));
                  if ("vibrate" in navigator) navigator.vibrate(15);
                }}
              >
                {iconSvg}
                <span>{primary.label}</span>
              </button>
            );
          })()}
          {/* 🔴 KIMI v4 — CTAs secundarios (Guardar + PDF) son FALLBACK.
              Solo se renderizan si el mapper NO definió `detail.actions`.
              Spec Kimi: 2 CTAs canónicos por dominio (pri + sec). Si el
              mapper ya definió sus 2 actions, no duplicar con Guardar/PDF. */}
          {(() => {
            const actions = (detail as Detail & { actions?: Array<{ label: string; icon?: string; kind?: "primary" | "secondary"; action: string }> }).actions;
            if (actions && actions.length > 0) return null;
            return (
              <>
                <button
                  type="button"
                  className="koru-dsec-action-btn koru-dsec-action-save xbtn sec"
                  onClick={() => onSave?.(detail.title, detail.subtitle)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>
                  <span>Guardar</span>
                </button>
                {onExportPdf && (
                  <button
                    type="button"
                    className="koru-dsec-action-btn koru-dsec-action-pdf xbtn sec"
                    onClick={onExportPdf}
                    aria-label="Exportar PDF"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* 🔴 P2 — Cooking mode overlay (full-screen, z-index 300). */}
      {cookingOpen && canCook && (
        <CookingMode
          title={recipeTitle}
          steps={cookingSteps}
          block={block}
          onClose={() => setCookingOpen(false)}
        />
      )}

      {/* 🔴 P2 — Workout session overlay (full-screen, z-index 300). */}
      {workoutOpen && canWorkout && exercisePlanObj && workoutSession && (
        <WorkoutSession
          plan={exercisePlanObj}
          session={workoutSession}
          onClose={() => setWorkoutOpen(false)}
        />
      )}

      {/* 🔴 P2 — Toast "Abriendo navegación..." para el botón Navegar.
          Reutiliza la animación koru-save-rise (mismo feel que el modal Save).
          Se auto-oculta a los 2.2s (ver handleNavigate). */}
      {navToast && (
        <div
          className="koru-nav-toast"
          role="status"
          aria-live="polite"
          onClick={() => setNavToast(null)}
        >
          <div className="koru-nav-toast-content">
            <span className="material-symbols-outlined koru-nav-toast-icon">navigation</span>
            <span className="koru-nav-toast-text">{navToast}</span>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
