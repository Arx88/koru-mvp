import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { Detail, DetailSection, Accent } from "./presentation";

// Pantalla de detalle unificada — misma estética Stitch que PlanRoadmapScreen
// (koru-roadmap + magical-cards + blobs), pero genérica: renderiza cualquier
// conjunto de secciones normalizadas. Cada UiBlock que abre su CTA cae acá,
// así informe, clima, mercados, etc. comparten un único lenguaje visual.

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
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
            <div key={i} className="koru-dsec-row">
              {r.icon && <Mat className="koru-dsec-row-icon">{r.icon}</Mat>}
              <div className="koru-dsec-row-body">
                <p className="koru-dsec-row-title">{r.title}</p>
                {r.detail && <p className="koru-dsec-row-detail">{r.detail}</p>}
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
}: {
  detail: Detail;
  headerIcon: string;
  onClose: () => void;
  onSave?: (title: string, subtitle?: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="koru-roadmap" role="dialog" aria-label={detail.title}>
      <div className="koru-roadmap-screen">
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        <button type="button" aria-label="Volver" className="koru-roadmap-back" onClick={onClose}>
          <Mat>arrow_back_ios_new</Mat>
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

        {/* 🔴 Botón Guardar informe — permite guardarlo para ver después */}
        <div className="koru-dsec-save-section">
          <button
            type="button"
            className="koru-dsec-save-btn"
            onClick={() => onSave?.(detail.title, detail.subtitle)}
          >
            <span className="material-symbols-outlined">bookmark_added</span>
            Guardar informe
          </button>
        </div>
      </div>
    </div>
  );
}
