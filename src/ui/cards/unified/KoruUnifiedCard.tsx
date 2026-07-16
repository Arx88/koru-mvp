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
  children,
}: {
  block: UiBlock;
  hero: Hero;
  isTappable: boolean;
  open: boolean;
  handleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  // overflow + position necesarios para que el ripple quede recortado
  // a los bordes redondeados de la card. Las variantes full-bleed
  // (spotlight/banner) añaden padding:0 vía `style`.
  return (
    <div
      className={"koru-plan-hero" + (isTappable ? " is-tappable" : "")}
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

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

// ============================================================================
// Layout: DEFAULT (molde Stitch clásico — sin cambios respecto a v2)
// ============================================================================

function DefaultLayout(props: SharedProps) {
  const { block, hero, detail, cta, actions, empty, isTappable, open, setOpen, handleClick, handleKeyDown, hasMetricValues, displayTitle } = props;
  return (
    <CardRoot block={block} hero={hero} isTappable={isTappable} open={open} handleClick={handleClick} handleKeyDown={handleKeyDown}>
      <div className="koru-plan-hero-top">
        <div className="koru-plan-hero-copy">
          <p className="koru-plan-hero-kicker" style={{ color: hero.accent.color }}>
            {hero.kicker}
          </p>
          <h2 className="koru-plan-hero-title">{displayTitle}</h2>
          {hero.desc && <p className="koru-plan-hero-desc">{hero.desc}</p>}
        </div>

        {hero.art ? (
          <img
            alt=""
            src={hero.art}
            className={
              hero.artAspect === "poster"
                ? "koru-plan-hero-art is-poster"
                : hero.artAspect === "cover"
                ? "koru-plan-hero-art is-cover"
                : "koru-plan-hero-art"
            }
          />
        ) : (
          <div className="koru-unified-art" style={{ background: hero.accent.soft, color: hero.accent.color }}>
            <Mat className="koru-unified-art-icon">{hero.icon}</Mat>
            {hero.artValue && <KoruCountUp value={hero.artValue} className="koru-unified-art-value" />}
          </div>
        )}
      </div>

      {hero.metrics && hero.metrics.length > 0 && (
        <div className={hasMetricValues ? "koru-unified-metrics" : "koru-plan-hero-cats"}>
          {hero.metrics.map((m, i) => {
            const displayValue = truncate(m.value, 15);
            const displayLabel = truncate(m.label, 25);
            return hasMetricValues ? (
              <div key={i} className="koru-unified-metric">
                <Mat className="koru-unified-metric-icon" style={{ color: m.color ?? hero.accent.color }}>
                  {m.icon}
                </Mat>
                <span className="koru-unified-metric-label">{displayLabel}</span>
                <span className="koru-unified-metric-value">{displayValue}</span>
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
        <div className="koru-unified-empty">
          <Mat>{empty.icon || "info"}</Mat>
          <span>{empty.reason}</span>
        </div>
      )}

      <CtaHint cta={cta} detail={detail} accentColor={hero.accent.color} />

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
  };

  if (layout === "compact") return <CompactLayout {...shared} />;
  if (layout === "spotlight") return <SpotlightLayout {...shared} />;
  if (layout === "gallery") return <GalleryLayout {...shared} />;
  if (layout === "banner") return <BannerLayout {...shared} />;
  return <DefaultLayout {...shared} />;
}
