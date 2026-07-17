import { useState, useCallback, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { UiBlock } from "../../../domain/types";
import { toPresentation } from "./presentation";
import type { Hero, Detail, KoruPresentation } from "./presentation";
import { KoruDetailScreen } from "./KoruDetailScreen";
import { KoruCountUp } from "./KoruCountUp";
import { useTapRipple } from "./useTapRipple";
import { useKoru } from "../../KoruProvider";
import { convertCurrency } from "../../../tools/travel/currencyConverter";
import { KoruIcon, iconFromMaterial } from "./KoruIcons";
import { LivePrice } from "./useLivePrice";

/** Hook: detecta si el navegador está offline. */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Hook: detecta si el usuario está inactivo (sin touch/mouse/keyboard por N ms). */
function useIsIdle(thresholdMs = 5 * 60 * 1000): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      setIdle(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), thresholdMs);
    };
    const events = ["mousemove", "touchstart", "keydown", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [thresholdMs]);
  return idle;
}

// 🔴 Code-splitting: CollectionsScreen (~600 líneas, renderer markdown + portal)
// se carga bajo demanda cuando el CTA del card abre la vista de colección.
// Necesita default export en CollectionsScreen.tsx (agregado).
import { CollectionsScreen } from "../../CollectionsScreen";

// Card unificada — TODA respuesta con estructura se renderiza con esta hoja,
// réplica del Stitch "Plan Entregado": superficie lila, kicker + título,
// arte (icono o ilustración) opcional con valor grande, fila de 3 métricas
// (tiles si traen valor, chips si no) y CTA que abre la pantalla de detalle.
// Reemplaza las ~45 estéticas de card sueltas por un único molde.
//
// 🔴 v3: soporta 5 layouts vía presentation.layout:
//   default  → molde clásico (sin cambios).
//   compact  → fila única (icono + kicker + título + chevron). ~60px.
//   spotlight → imagen full-bleed (180px) con scrim + título overlay + métricas.
//   gallery  → carrusel horizontal de mini-cards (70×80).
//   banner   → gradiente full-width (100px) con número grande + label.

const FONT_HEADING = '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
const COLOR_INK = "#382b8c";
const COLOR_INK_MUTED = "#6b5f8c";
const COLOR_INK_TENUE = "#a99bbe";

function Mat({ children, style, className = "" }: { children: string; style?: CSSProperties; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {children}
    </span>
  );
}

type Cta = KoruPresentation["cta"];
type Actions = KoruPresentation["actions"];
type Empty = KoruPresentation["empty"];

type SharedProps = {
  block: UiBlock;
  hero: Hero;
  detail?: Detail;
  cta?: Cta;
  actions?: Actions;
  empty?: Empty;
  isTappable: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  handleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  hasMetricValues: boolean;
  displayTitle: string;
  // 🔴 KIMI v4: estado ambiente para aplicar modo dormir / offline badge.
  isIdle: boolean;
  isOnline: boolean;
};

// ---- Helpers compartidos por todos los layouts ------------------------------

function CardRoot({
  block,
  hero,
  isTappable,
  open,
  handleClick,
  handleKeyDown,
  style,
  className,
  children,
}: {
  block: UiBlock;
  hero: Hero;
  isTappable: boolean;
  open: boolean;
  handleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  style?: CSSProperties;
  // 🔴 KIMI audit: clase adicional para que el DefaultLayout monte el
  // molde `.kc` (gradient bg + sparkles + shadows) sin perder la
  // compatibilidad con `.koru-plan-hero` (otros layouts no la pasan).
  className?: string;
  children: ReactNode;
}) {
  // overflow + position necesarios para que el ripple quede recortado
  // a los bordes redondeados de la card. Las variantes full-bleed
  // (spotlight/banner) añaden padding:0 vía `style`.
  const base = "koru-plan-hero" + (className ? " " + className : "") + (isTappable ? " is-tappable" : "");
  return (
    <div
      className={base}
      data-ui-block={block.type}
      role={isTappable ? "button" : undefined}
      tabIndex={isTappable ? 0 : undefined}
      aria-label={isTappable ? `Abrir ${hero.title}` : undefined}
      onClick={isTappable ? handleClick : undefined}
      onKeyDown={!open ? handleKeyDown : undefined}
      style={{ overflow: "hidden", position: "relative", ...style }}
    >
      {children}
    </div>
  );
}

/** Pantalla de detalle / collections — se monta dentro del root de la card
 *  cuando `open` está activo. Compartido por todos los layouts. */
function DetailOverlay({
  open,
  cta,
  detail,
  hero,
  block,
  setOpen,
}: {
  open: boolean;
  cta?: Cta;
  detail?: Detail;
  hero: Hero;
  block: UiBlock;
  setOpen: (open: boolean) => void;
}) {
  if (!open) return null;
  if (cta?.screen === "collections") {
    return (
      <CollectionsScreen focusCollection={cta.collection} onClose={() => setOpen(false)} />
    );
  }
  if (detail) {
    return (
      <KoruDetailScreen
        detail={detail}
        headerIcon={hero.icon}
        onClose={() => setOpen(false)}
        block={block}
        onSave={(title, subtitle) => {
          window.dispatchEvent(
            new CustomEvent("koru-save-deliverable", {
              detail: { title, subtitle, blockType: block.type, blockData: block },
            }),
          );
          setOpen(false);
        }}
        onExportPdf={() => {
          window.dispatchEvent(
            new CustomEvent("koru-export-pdf", {
              detail: {
                blockType: block.type,
                blockTitle: hero.title,
                blockData: block,
              },
            }),
          );
        }}
      />
    );
  }
  return null;
}

/** Acciones inline (alarm, reminder) — botones que disparan eventos
 *  `koru-card-action` sin abrir detail. stopPropagation para no reabrir. */
function InlineActions({
  actions,
  block,
  accentColor,
  style,
}: {
  actions?: Actions;
  block: UiBlock;
  accentColor: string;
  style?: CSSProperties;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="koru-plan-hero-actions" style={style}>
      {actions.map((act, i) => (
        <button
          key={i}
          type="button"
          className={`koru-plan-hero-action is-${act.kind ?? "primary"}`}
          style={act.kind === "primary" ? { background: accentColor } : undefined}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("koru-card-action", {
                detail: { action: act.action, blockType: block.type, blockData: block },
              }),
            );
            if ("vibrate" in navigator) navigator.vibrate(15);
          }}
        >
          {act.icon && <Mat>{act.icon}</Mat>}
          <span>{act.label}</span>
        </button>
      ))}
    </div>
  );
}

/** CTA hint visual (no botón — la card entera es el tap target). */
function CtaHint({ cta, detail, accentColor, style }: { cta?: Cta; detail?: Detail; accentColor: string; style?: CSSProperties }) {
  if (!cta || !(detail || cta.screen === "collections")) return null;
  return (
    <div className="koru-plan-hero-cta-hint" style={{ color: accentColor, ...style }}>
      <span>{cta.label}</span>
      <Mat>arrow_forward</Mat>
    </div>
  );
}

// ============================================================================
// 🔴 KIMI AUDIT — Refined card visual design.
// Nuevos componentes extraídos del audit (kc-*): pill CTA con sheen, foot con
// source + icon buttons. Conviven con CtaHint/InlineActions para backward
// compatibility (otros layouts siguen usando los anteriores).
// ============================================================================

/** Kimi CTA pill button — botón completo con gradiente + sheen animada.
 *  Reemplaza a CtaHint en DefaultLayout (la card sigue siendo tappable;
 *  el botón detiene la propagación para no reabrir el detail si el usuario
 *  toca específicamente el CTA, pero mantiene el ripple + handleClick). */
function KimiCtaButton({
  cta,
  handleClick,
}: {
  cta?: Cta;
  handleClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  if (!cta || !cta.label) return null;
  return (
    <button
      type="button"
      className="koru-kimi-cta kc-cta"
      onClick={(e) => {
        // Mantener el ripple + open del handler unificado de la card.
        // No stopPropagation: la card entera es el tap target y handleClick
        // ya guarda contra re-open si el detail está activo.
        handleClick(e);
      }}
    >
      <span>{cta.label}</span>
      {/* 🔴 KIMI audit: SVG arrow (.arr) — el CSS .kc-cta .arr anima
          translateX en hover. Reemplaza el material-symbols arrow_forward
          para coincidir con el spec del audit (SVG 15×15, stroke #fff). */}
      <svg
        className="arr"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** Card foot — source info (favicon + domain) + icon action buttons.
 *  Solo se renderiza si el bloque trae `sources` (mostramos el primero)
 *  o si hay CTA tap-target (acciones save/share/open siempre útiles). */
function CardFoot({
  block,
  cta,
}: {
  block: UiBlock;
  cta?: Cta;
}) {
  // Solo bloques con sources los muestran en el foot. Type guard: el campo
  // `sources` es opcional y solo algunos UiBlock lo traen.
  const sources = "sources" in block && Array.isArray((block as { sources?: unknown }).sources)
    ? ((block as { sources?: Array<{ title: string; url: string; domain: string }> }).sources)
    : undefined;
  const firstSource = sources?.[0];
  const faviconSrc = firstSource
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(firstSource.domain)}&sz=32`
    : undefined;

  const dispatchAction = (action: "save" | "share" | "open") => {
    if ("vibrate" in navigator) navigator.vibrate(12);
    window.dispatchEvent(
      new CustomEvent("koru-card-foot-action", {
        detail: { action, blockType: block.type, blockData: block, source: firstSource },
      }),
    );
  };

  return (
    <div className="koru-card-foot kc-foot">
      <div className="src">
        {firstSource ? (
          <>
            {faviconSrc && <img alt="" src={faviconSrc} loading="lazy" />}
            <span>{firstSource.domain}</span>
          </>
        ) : (
          <span>Koru</span>
        )}
      </div>
      <div className="acts">
        <button
          type="button"
          className="koru-icon-btn iconbtn"
          aria-label="Guardar"
          onClick={(e) => { e.stopPropagation(); dispatchAction("save"); }}
        >
          <Mat>bookmark_border</Mat>
        </button>
        <button
          type="button"
          className="koru-icon-btn iconbtn"
          aria-label="Compartir"
          onClick={(e) => { e.stopPropagation(); dispatchAction("share"); }}
        >
          <Mat>share</Mat>
        </button>
        <button
          type="button"
          className="koru-icon-btn iconbtn"
          aria-label="Abrir"
          onClick={(e) => { e.stopPropagation(); dispatchAction("open"); }}
          disabled={!cta && !firstSource}
        >
          <Mat>ios_share</Mat>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 🔴 KIMI AUDIT — "Vacío que invita".
// El jardín como metáfora: icono en cuadrado de acento, título rotundo,
// descripción con un ejemplo concreto y un primer paso obvio (CTA).
// Si la presentación solo trae `reason` (legacy), cae al molde anterior.
// ============================================================================
function EmptyState({
  empty,
  block,
  accentColor,
  accentSoft,
}: {
  empty: NonNullable<Empty>;
  block: UiBlock;
  accentColor: string;
  accentSoft: string;
}) {
  // Legacy: solo `reason` → molde viejo (icon + línea).
  if (!empty.title && !empty.desc && empty.reason) {
    return (
      <div className="koru-unified-empty">
        <Mat>{empty.icon || "info"}</Mat>
        <span>{empty.reason}</span>
      </div>
    );
  }

  const iconColor = empty.accent?.color ?? accentColor;
  const iconBg = empty.accent?.soft ?? accentSoft;
  const title = empty.title ?? "No hay nada acá todavía";
  const desc = empty.desc ?? "Pedime algo y lo busco";

  const handleCta = () => {
    if ("vibrate" in navigator) navigator.vibrate(15);
    window.dispatchEvent(
      new CustomEvent("koru-empty-cta", {
        detail: {
          action: empty.cta?.action ?? "prompt",
          blockType: block.type,
          blockData: block,
        },
      }),
    );
  };

  return (
    <div className="koru-unified-empty-v2">
      <div className="koru-unified-empty-v2-row">
        <div
          className="koru-unified-empty-v2-icon"
          style={{ background: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          <Mat>{empty.icon || "eco"}</Mat>
        </div>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <p className="koru-unified-empty-v2-title">{title}</p>
          <p className="koru-unified-empty-v2-desc">{desc}</p>
        </div>
      </div>
      {empty.cta && (
        <button
          type="button"
          className="koru-unified-empty-v2-cta"
          style={{ background: iconColor }}
          onClick={(e) => {
            e.stopPropagation();
            handleCta();
          }}
        >
          <Mat>{empty.icon === "spa" ? "eco" : "arrow_forward"}</Mat>
          <span>{empty.cta.label}</span>
        </button>
      )}
    </div>
  );
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Bloques cuyo artValue es un precio latiente (cripto/trading/forex/data_ticker).
 *  Para esos usamos LivePrice con flash verde/rojo cada 3s. */
function isLivePriceBlock(block: UiBlock): boolean {
  return block.type === "crypto_portfolio" ||
    block.type === "market" ||
    block.type === "forex" ||
    block.type === "data_ticker";
}

// ============================================================================
// Layout: DEFAULT (molde Stitch clásico — sin cambios respecto a v2)
// ============================================================================

function DefaultLayout(props: SharedProps) {
  const { block, hero, detail, cta, actions, empty, isTappable, open, setOpen, handleClick, handleKeyDown, hasMetricValues, displayTitle, isIdle, isOnline } = props;
  const metrics = hero.metrics ?? [];
  // 🔴 KIMI audit: si hay 2 métricas con valor, la grid usa la variante m2.
  const metricsClass = hasMetricValues
    ? `koru-unified-metrics kc-metrics${metrics.length === 2 ? " m2" : ""}`
    : "koru-plan-hero-cats";
  // 🔴 KIMI v4: modo dormir + offline badge en la clase raíz.
  const sleepyClass = isIdle ? " koru-card-sleepy" : "";
  return (
    <CardRoot block={block} hero={hero} isTappable={isTappable} open={open} handleClick={handleClick} handleKeyDown={handleKeyDown} className={`kc${sleepyClass}`}>
      {/* 🔴 KIMI v4: badge offline cuando no hay conexión. */}
      {!isOnline && (
        <div className="koru-card-offline-badge" style={{ position: "absolute", top: 10, right: 14, zIndex: 5 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 16a4 4 0 0 1 0-8 6 6 0 0 1 11.5-2 4 4 0 0 1 1 8z" />
          </svg>
          Sin conexión
        </div>
      )}
      {/* 🔴 KIMI audit: sparkles decorativos (top-right + bottom-left).
          El CSS define la animación twinkle (si no existe en style.css,
          los puntos quedan estáticos — pendiente de agregar keyframes). */}
      <div className="kc-sparkle s1" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8z" />
        </svg>
      </div>
      <div className="kc-sparkle s2" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8z" />
        </svg>
      </div>

      <div className="koru-plan-hero-top kc-top">
        <div className="koru-plan-hero-copy kc-copy">
          <div className="koru-card-kicker kc-kicker" style={{ color: hero.accent.color }}>
            <span className={"dot" + (hero.live ? " live" : "")} />
            {hero.kicker}
          </div>
          <h3 className="koru-plan-hero-title kc-title">{displayTitle}</h3>
          {hero.desc && <p className="koru-plan-hero-desc kc-desc">{hero.desc}</p>}
        </div>

        {hero.art ? (
          <img
            alt=""
            src={hero.art}
            className={
              hero.artAspect === "poster"
                ? "koru-plan-hero-art is-poster kc-art"
                : hero.artAspect === "cover"
                ? "koru-plan-hero-art is-cover kc-art"
                : "koru-plan-hero-art kc-art"
            }
            style={{ background: hero.accent.color }}
          />
        ) : (
          // 🔴 KIMI audit: kc-art = bloque 88×88 con inner-shadows y valor
          // grande abajo a la derecha (.val). Convive con koru-unified-art
          // para no romper otras reglas que dependen de esa clase. El fondo
          // sólido accent.color reemplaza el soft anterior (el CSS .kc-art
          // fuerza color:#fff, ícono blanco sobre fondo de acento).
          // 🔴 KIMI v2: si el Material Symbol mapea a un KoruIcon animado,
          // usamos el SVG; si no, caemos al Mat original (compatibilidad).
          <div
            className="koru-unified-art kc-art"
            style={{ background: hero.accent.color, color: "#fff" }}
          >
            {(() => {
              const kn = iconFromMaterial(hero.icon);
              if (kn !== "default") {
                return <KoruIcon name={kn} size={40} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))" }} />;
              }
              return <Mat className="koru-unified-art-icon">{hero.icon}</Mat>;
            })()}
            {hero.artValue && (
              isLivePriceBlock(block) ? (
                <LivePrice value={hero.artValue} className="koru-unified-art-value val" />
              ) : (
                <KoruCountUp value={hero.artValue} className="koru-unified-art-value val" />
              )
            )}
          </div>
        )}
      </div>

      {metrics.length > 0 && (
        <div className={metricsClass}>
          {metrics.map((m, i) => {
            const displayValue = truncate(m.value, 15);
            const displayLabel = truncate(m.label, 25);
            return hasMetricValues ? (
              <div key={i} className="koru-unified-metric kc-m">
                <span
                  className="koru-metric-icon-square mi"
                  style={{ background: m.color ?? hero.accent.color }}
                >
                  {(() => {
                    const kn = iconFromMaterial(m.icon);
                    if (kn !== "default") {
                      return <KoruIcon name={kn} size={14} />;
                    }
                    return <Mat>{m.icon}</Mat>;
                  })()}
                </span>
                <span className="koru-unified-metric-label ml">{displayLabel}</span>
                <span className="koru-unified-metric-value mv">{displayValue}</span>
              </div>
            ) : (
              <div key={i} className="koru-plan-hero-cat">
                <Mat style={{ color: m.color ?? hero.accent.color }}>{m.icon}</Mat>
                <span>{displayLabel}</span>
              </div>
            );
          })}
        </div>
      )}

      {empty && !hasMetricValues && (
        <EmptyState empty={empty} block={block} accentColor={hero.accent.color} accentSoft={hero.accent.soft} />
      )}

      {/* 🔴 KIMI audit: pill CTA replaces text-only hint in DefaultLayout.
          Solo se renderiza si la card es tappable (mismo guard que CtaHint). */}
      {isTappable && cta && <KimiCtaButton cta={cta} handleClick={handleClick} />}

      {/* 🔴 KIMI audit: card foot (source + actions) — replaces nothing,
          se añade al pie del molde default. */}
      <CardFoot block={block} cta={cta} />

      <InlineActions actions={actions} block={block} accentColor={hero.accent.color} />

      <DetailOverlay open={open} cta={cta} detail={detail} hero={hero} block={block} setOpen={setOpen} />
    </CardRoot>
  );
}

// ============================================================================
// Layout: COMPACT — fila única (icono + kicker + título + chevron). ~60px.
// Usado para reminders, signals, notificaciones simples.
// ============================================================================

function CompactLayout(props: SharedProps) {
  const { block, hero, detail, cta, actions, isTappable, open, setOpen, handleClick, handleKeyDown } = props;
  const compactTitle = truncate(hero.title, 28) ?? hero.title;

  return (
    <CardRoot block={block} hero={hero} isTappable={isTappable} open={open} handleClick={handleClick} handleKeyDown={handleKeyDown}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 60,
          padding: "10px 16px",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: 12,
            background: hero.accent.soft,
            color: hero.accent.color,
          }}
        >
          <Mat style={{ fontSize: 24 }}>{hero.icon}</Mat>
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <p
            style={{
              color: hero.accent.color,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: 0,
              marginBottom: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hero.kicker}
          </p>
          <h2
            style={{
              margin: 0,
              color: COLOR_INK,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {compactTitle}
          </h2>
        </div>

        <Mat
          style={{
            fontSize: 22,
            color: COLOR_INK_TENUE,
            opacity: isTappable ? 0.9 : 0.4,
            flex: "0 0 auto",
          }}
        >
          chevron_right
        </Mat>
      </div>

      <InlineActions actions={actions} block={block} accentColor={hero.accent.color} />

      <DetailOverlay open={open} cta={cta} detail={detail} hero={hero} block={block} setOpen={setOpen} />
    </CardRoot>
  );
}

// ============================================================================
// Layout: SPOTLIGHT — imagen full-bleed (180px) con scrim + título overlay
// (Bricolage Grotesque, blanco), métricas debajo y CTA hint al pie.
// Usado para recipe, movie, book — cards con hero image.
// ============================================================================

function SpotlightLayout(props: SharedProps) {
  const { block, hero, detail, cta, isTappable, open, setOpen, handleClick, handleKeyDown, hasMetricValues, displayTitle } = props;

  const heroBg = hero.art
    ? `url(${hero.art})`
    : `linear-gradient(135deg, ${hero.accent.color}, ${hero.accent.soft})`;

  return (
    <CardRoot
      block={block}
      hero={hero}
      isTappable={isTappable}
      open={open}
      handleClick={handleClick}
      handleKeyDown={handleKeyDown}
      style={{ padding: 0 }}
    >
      {/* Full-bleed hero + scrim + título overlay */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 180,
          backgroundImage: heroBg,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: hero.accent.soft,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 45%, transparent 75%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 20px 14px" }}>
          <p
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: 0,
              marginBottom: 4,
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            {hero.kicker}
          </p>
          <h2
            style={{
              margin: 0,
              color: "#ffffff",
              fontFamily: FONT_HEADING,
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              textShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            {displayTitle}
          </h2>
        </div>
      </div>

      {/* Métricas debajo de la imagen */}
      {hero.metrics && hero.metrics.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "16px 20px 4px",
            flexWrap: "wrap",
          }}
        >
          {hero.metrics.map((m, i) => {
            const displayValue = truncate(m.value, 15);
            const displayLabel = truncate(m.label, 25);
            return (
              <div
                key={i}
                style={{
                  flex: "1 1 0",
                  minWidth: 80,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "10px 8px",
                  borderRadius: 14,
                  background: hero.accent.soft,
                }}
              >
                <Mat style={{ fontSize: 18, color: m.color ?? hero.accent.color }}>{m.icon}</Mat>
                {hasMetricValues && displayValue && (
                  <span style={{ color: COLOR_INK, fontSize: 14, fontWeight: 700 }}>{displayValue}</span>
                )}
                <span
                  style={{
                    color: COLOR_INK_MUTED,
                    fontSize: 10,
                    fontWeight: 500,
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {displayLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <CtaHint cta={cta} detail={detail} accentColor={hero.accent.color} style={{ margin: "12px 20px" }} />

      <DetailOverlay open={open} cta={cta} detail={detail} hero={hero} block={block} setOpen={setOpen} />
    </CardRoot>
  );
}

// ============================================================================
// Layout: GALLERY — carrusel horizontal de mini-cards (70×80) con gradiente,
// título + métrica. Usado para comparación, síntesis de restaurantes.
// ============================================================================

function GalleryLayout(props: SharedProps) {
  const { block, hero, detail, cta, isTappable, open, setOpen, handleClick, handleKeyDown, displayTitle } = props;
  const items = hero.metrics ?? [];
  // Paleta rotativa para que cada mini-card tenga su gradiente propio.
  const gradients = [
    `linear-gradient(135deg, ${hero.accent.color}, ${hero.accent.soft})`,
    "linear-gradient(135deg, #ec4899, rgba(236,72,153,0.18))",
    "linear-gradient(135deg, #2563eb, rgba(37,99,235,0.18))",
    "linear-gradient(135deg, #059669, rgba(16,185,129,0.18))",
    "linear-gradient(135deg, #d97706, rgba(217,119,6,0.18))",
    "linear-gradient(135deg, #8127cf, rgba(129,39,207,0.18))",
    "linear-gradient(135deg, #0284c7, rgba(2,132,199,0.18))",
    "linear-gradient(135deg, #e11d48, rgba(225,29,72,0.18))",
  ];

  return (
    <CardRoot block={block} hero={hero} isTappable={isTappable} open={open} handleClick={handleClick} handleKeyDown={handleKeyDown}>
      <div style={{ padding: "16px 20px 4px" }}>
        <p className="koru-plan-hero-kicker" style={{ color: hero.accent.color, margin: 0, marginBottom: 4 }}>
          {hero.kicker}
        </p>
        <h2
          style={{
            margin: 0,
            color: COLOR_INK,
            fontFamily: FONT_HEADING,
            fontSize: 18,
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          {displayTitle}
        </h2>
        {hero.desc && (
          <p style={{ margin: "4px 0 0", color: COLOR_INK_MUTED, fontSize: 12, fontWeight: 400, lineHeight: 1.4 }}>
            {hero.desc}
          </p>
        )}
      </div>

      {items.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "12px 20px 16px",
            scrollbarWidth: "thin",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((m, i) => {
            const displayLabel = truncate(m.label, 12);
            const displayValue = truncate(m.value, 10);
            return (
              <div
                key={i}
                style={{
                  flex: "0 0 auto",
                  width: 70,
                  height: 80,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "8px 6px",
                  borderRadius: 14,
                  background: gradients[i % gradients.length],
                  color: "#ffffff",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
              >
                <Mat style={{ fontSize: 18, color: "rgba(255,255,255,0.95)" }}>{m.icon}</Mat>
                <div>
                  {displayValue && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1.1,
                        marginBottom: 2,
                        color: "#ffffff",
                      }}
                    >
                      {displayValue}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      lineHeight: 1.15,
                      color: "rgba(255,255,255,0.88)",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {displayLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "8px 20px 16px", color: COLOR_INK_TENUE, fontSize: 12 }}>
          Sin opciones para mostrar.
        </div>
      )}

      <CtaHint cta={cta} detail={detail} accentColor={hero.accent.color} />

      <DetailOverlay open={open} cta={cta} detail={detail} hero={hero} block={block} setOpen={setOpen} />
    </CardRoot>
  );
}

// ============================================================================
// Layout: BANNER — gradiente full-width (100px) con número grande (28px
// Bricolage) + label. Usado para birthday_calendar, birthday_alarm.
// ============================================================================

function BannerLayout(props: SharedProps) {
  const { block, hero, detail, cta, isTappable, open, setOpen, handleClick, handleKeyDown } = props;
  // Número grande = artValue o primer métrica con valor.
  const bigNumber = hero.artValue ?? hero.metrics?.find((m) => m.value)?.value ?? "";
  // Label = primer métrica o kicker (cuando solo hay un número destacado).
  const label = hero.metrics?.[0]?.label ?? hero.kicker;

  return (
    <CardRoot
      block={block}
      hero={hero}
      isTappable={isTappable}
      open={open}
      handleClick={handleClick}
      handleKeyDown={handleKeyDown}
      style={{ padding: 0, background: `linear-gradient(135deg, ${hero.accent.color}, ${hero.accent.soft})` }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 24px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          {hero.kicker && (
            <p
              style={{
                margin: 0,
                marginBottom: 4,
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {hero.kicker}
            </p>
          )}
          {bigNumber && (
            <div
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 28,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {bigNumber}
            </div>
          )}
          {label && (
            <div
              style={{
                color: "rgba(255,255,255,0.92)",
                fontSize: 13,
                fontWeight: 500,
                marginTop: 4,
              }}
            >
              {label}
            </div>
          )}
        </div>

        {hero.icon && (
          <Mat
            style={{
              fontSize: 40,
              color: "rgba(255,255,255,0.55)",
              flex: "0 0 auto",
            }}
          >
            {hero.icon}
          </Mat>
        )}
      </div>

      <DetailOverlay open={open} cta={cta} detail={detail} hero={hero} block={block} setOpen={setOpen} />
    </CardRoot>
  );
}

// ============================================================================
// Root: levanta estado + handlers (ripple, keyboard, tappability) y despacha
// al layout elegido por la presentación. El modelo no cambia; solo la
// composición visual.
// ============================================================================

export function KoruUnifiedCard({ block }: { block: UiBlock }) {
  const [open, setOpen] = useState(false);
  const [, forceRerender] = useState(0);
  const { state } = useKoru();
  const userCurrency = (state.userProfile?.currency ?? "EUR").toUpperCase();
  const { hero, detail, cta, actions, empty, layout = "default" } = toPresentation(block, { userCurrency });
  const hasMetricValues = hero.metrics?.some((m) => m.value != null) ?? false;

  // 🔴 KIMI v4: modo dormir (5 min idle) + offline badge.
  const isIdle = useIsIdle();
  const isOnline = useOnlineStatus();

  // 🔴 v4 — Pre-fetch exchange rates for travel_plan budget currencies.
  // toPresentation's travelPlan mapper reads cached rates synchronously
  // (via getCachedRate). On first render the cache is empty, so we trigger
  // async convertCurrency calls for each (budget.currency, userCurrency)
  // pair. When the rates land (and the cache is populated), we force a
  // re-render so the converted amounts appear.
  useEffect(() => {
    if (block.type !== "travel_plan") return;
    const budget = block.budget ?? [];
    if (budget.length === 0) return;
    let cancelled = false;
    (async () => {
      const currenciesToFetch = Array.from(new Set(
        budget
          .map((b) => (b.currency ?? "").toUpperCase())
          .filter((c) => c && c !== userCurrency),
      ));
      await Promise.allSettled(
        currenciesToFetch.map((from) => convertCurrency(1, from, userCurrency)),
      );
      if (!cancelled) forceRerender((n) => n + 1);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, userCurrency]);

  // 🔴 v2: la card entera es tappable si hay detail o collections screen
  const isTappable = !!(cta && (detail || cta.screen === "collections"));

  // Truncar título a 40 chars para que no rompa el layout
  const displayTitle = hero.title.length > 40 ? hero.title.slice(0, 37).trimEnd() + "…" : hero.title;

  // Ripple feedback en cualquier tap sobre la card.
  const triggerRipple = useTapRipple();

  // 🔴 v2: handler unificado para abrir (click + keyboard)
  // Guard: no abrir si ya está abierto (evita re-trigger cuando el detail screen está visible)
  const handleOpen = useCallback(() => {
    if (isTappable && !open) setOpen(true);
  }, [isTappable, open]);

  // Click handler: ripple + abrir. El ripple se dispara siempre que la card
  // sea tappable (incluso si ya está abierta) para mantener el feedback táctil.
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      triggerRipple(e);
      if (!open) handleOpen();
    },
    [triggerRipple, handleOpen, open],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTappable && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setOpen(true);
      }
    },
    [isTappable],
  );

  const shared: SharedProps = {
    block,
    hero,
    detail,
    cta,
    actions,
    empty,
    isTappable,
    open,
    setOpen,
    handleClick,
    handleKeyDown,
    hasMetricValues,
    displayTitle,
    isIdle,
    isOnline,
  };

  if (layout === "compact") return <CompactLayout {...shared} />;
  if (layout === "spotlight") return <SpotlightLayout {...shared} />;
  if (layout === "gallery") return <GalleryLayout {...shared} />;
  if (layout === "banner") return <BannerLayout {...shared} />;
  return <DefaultLayout {...shared} />;
}
