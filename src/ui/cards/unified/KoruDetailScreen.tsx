import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { Detail, DetailSection, Accent, DetailRow } from "./presentation";

// Pantalla de detalle unificada — misma estética Stitch que PlanRoadmapScreen
// (koru-roadmap + magical-cards + blobs), pero genérica: renderiza cualquier
// conjunto de secciones normalizadas. Cada UiBlock que abre su CTA cae acá,
// así informe, clima, mercados, etc. comparten un único lenguaje visual.

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
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

function SectionHead({ section }: { section: DetailSection }) {
  return (
    <div className="koru-module-head">
      <div className="koru-module-id">
        <div className="koru-module-icon">
          <Mat>{section.icon}</Mat>
        </div>
        <div>
          <h3 className="koru-module-title">{section.title}</h3>
          {section.subtitle && <p className="koru-module-kicker">{section.subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionBody({ section }: { section: DetailSection }) {
  switch (section.kind) {
    case "text":
      return <p className="koru-dsec-text">{section.body}</p>;

    case "tiles":
      return (
        <div className="koru-dsec-tiles">
          {section.tiles.map((t, i) => (
            <div key={i} className="koru-dsec-tile">
              {t.icon && <Mat className="koru-dsec-tile-icon" >{t.icon}</Mat>}
              <span className="koru-dsec-tile-label">{t.label}</span>
              <span className="koru-dsec-tile-value">{t.value}</span>
            </div>
          ))}
        </div>
      );

    case "rows":
      return (
        <div className="koru-dsec-rows">
          {section.rows.map((r, i) => (
            <div key={i} className={"koru-dsec-row" + (r.bar ? " koru-dsec-row-with-bar" : "")}>
              {r.icon && <Mat className="koru-dsec-row-icon">{r.icon}</Mat>}
              <div className="koru-dsec-row-body">
                <p className="koru-dsec-row-title">{r.title}</p>
                {r.detail && <p className="koru-dsec-row-detail">{r.detail}</p>}
                {/* 🔴 v2: barra comparativa para stats de fútbol (posesión, tiros, etc.) */}
                {r.bar && <ComparisonBar bar={r.bar} />}
              </div>
              {r.meta && <span className="koru-dsec-row-meta">{r.meta}</span>}
              {r.badge && <span className={`koru-step-chip is-${r.badgeTone ?? "pending"}`}>{r.badge}</span>}
            </div>
          ))}
        </div>
      );

    case "chips":
      return (
        <div className="koru-dsec-chips">
          {section.chips.map((c, i) => (
            <div key={i} className="koru-dsec-chip">
              <span className="koru-dsec-chip-label">{c.label}</span>
              {c.sub && <span className="koru-dsec-chip-sub">{c.sub}</span>}
            </div>
          ))}
        </div>
      );

    case "scroller":
      return (
        <div className="koru-dsec-scroller">
          {section.cards.map((c, i) => (
            <div key={i} className="koru-dsec-scard">
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
      return (
        <div className="koru-timeline">
          <div className="koru-timeline-line" />
          <div className="koru-timeline-steps">
            {section.steps.map((s, i) => {
              const status = s.status ?? "pending";
              return (
                <div key={i} className={`koru-timeline-step is-${status}`}>
                  <div className="koru-timeline-dot">
                    <Mat>{status === "done" ? "check" : s.icon ?? "radio_button_unchecked"}</Mat>
                  </div>
                  <div className="koru-timeline-body">
                    <h4 className="koru-timeline-name">{s.title}</h4>
                    {s.detail && <p className="koru-timeline-meta">{s.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "sources":
      return (
        <div className="koru-dsec-sources">
          {section.sources.map((s, i) => {
            const inner = (
              <>
                <Mat className="koru-dsec-source-icon">language</Mat>
                <span className="koru-dsec-source-title">
                  {s.title}
                  {s.domain && <span className="koru-dsec-source-domain"> — {s.domain}</span>}
                </span>
              </>
            );
            return s.url ? (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="koru-dsec-source">
                {inner}
              </a>
            ) : (
              <div key={i} className="koru-dsec-source">
                {inner}
              </div>
            );
          })}
        </div>
      );

    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

export function KoruDetailScreen({
  detail,
  headerIcon,
  onClose,
  onSave,
  onExportPdf,
}: {
  detail: Detail;
  headerIcon: string;
  onClose: () => void;
  onSave?: (title: string, subtitle?: string) => void;
  onExportPdf?: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="koru-roadmap" role="dialog" aria-label={detail.title}>
      <div className="koru-roadmap-screen">
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        <button type="button" aria-label="Volver" className="koru-roadmap-back" onClick={onClose}>
          <Mat>arrow_back_ios_new</Mat>
        </button>

        {/* 🔴 Icono de guardar arriba a la derecha */}
        <button
          type="button"
          aria-label="Guardar"
          className="koru-dsec-save-top"
          onClick={() => onSave?.(detail.title, detail.subtitle)}
        >
          <Mat>bookmark_border</Mat>
        </button>

        <div className="koru-roadmap-header">
          <div className="koru-detail-hero-icon">
            <Mat>{headerIcon}</Mat>
          </div>
          <h1 className="koru-roadmap-title">{detail.title}</h1>
          {detail.subtitle && <p className="koru-roadmap-subtitle">{detail.subtitle}</p>}
        </div>

        <div className="koru-roadmap-modules">
          {detail.sections.map((section, i) => (
            <div key={i} className="koru-magical-card" style={moduleStyle(section.accent)}>
              <SectionHead section={section} />
              <SectionBody section={section} />
            </div>
          ))}
        </div>

        {/* 🔴 Botones de acción — layout flex 50/50 con spacing consistente */}
        <div className="koru-dsec-actions">
          <button
            type="button"
            className="koru-dsec-action-btn koru-dsec-action-save"
            onClick={() => onSave?.(detail.title, detail.subtitle)}
          >
            <span className="material-symbols-outlined">bookmark_added</span>
            <span>Guardar</span>
          </button>
          {onExportPdf && (
            <button
              type="button"
              className="koru-dsec-action-btn koru-dsec-action-pdf"
              onClick={onExportPdf}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              <span>PDF</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
