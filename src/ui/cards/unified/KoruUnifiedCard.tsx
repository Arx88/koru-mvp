import { useState } from "react";
import type { CSSProperties } from "react";
import type { UiBlock } from "../../../domain/types";
import { toPresentation } from "./presentation";
import { KoruDetailScreen } from "./KoruDetailScreen";
import { CollectionsScreen } from "../../CollectionsScreen";

// Card unificada — TODA respuesta con estructura se renderiza con esta hoja,
// réplica del Stitch "Plan Entregado": superficie lila, kicker + título,
// arte (icono o ilustración) opcional con valor grande, fila de 3 métricas
// (tiles si traen valor, chips si no) y CTA que abre la pantalla de detalle.
// Reemplaza las ~45 estéticas de card sueltas por un único molde.

function Mat({ children, style, className = "" }: { children: string; style?: CSSProperties; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {children}
    </span>
  );
}

export function KoruUnifiedCard({ block }: { block: UiBlock }) {
  const [open, setOpen] = useState(false);
  const { hero, detail, cta } = toPresentation(block);
  const hasMetricValues = hero.metrics?.some((m) => m.value != null);

  return (
    <div className="koru-plan-hero" data-ui-block={block.type}>
      <div className="koru-plan-hero-top">
        <div className="koru-plan-hero-copy">
          <p className="koru-plan-hero-kicker" style={{ color: hero.accent.color }}>
            {hero.kicker}
          </p>
          <h2 className="koru-plan-hero-title">{hero.title}</h2>
          {hero.desc && <p className="koru-plan-hero-desc">{hero.desc}</p>}
        </div>

        {hero.art ? (
          <img alt="" src={hero.art} className="koru-plan-hero-art" />
        ) : (
          <div
            className="koru-unified-art"
            style={{ background: hero.accent.soft, color: hero.accent.color }}
          >
            <Mat className="koru-unified-art-icon">{hero.icon}</Mat>
            {hero.artValue && <span className="koru-unified-art-value">{hero.artValue}</span>}
          </div>
        )}
      </div>

      {hero.metrics && hero.metrics.length > 0 && (
        <div className={hasMetricValues ? "koru-unified-metrics" : "koru-plan-hero-cats"}>
          {hero.metrics.map((m, i) =>
            hasMetricValues ? (
              <div key={i} className="koru-unified-metric">
                <Mat className="koru-unified-metric-icon" style={{ color: m.color ?? hero.accent.color }}>
                  {m.icon}
                </Mat>
                <span className="koru-unified-metric-label">{m.label}</span>
                <span className="koru-unified-metric-value">{m.value}</span>
              </div>
            ) : (
              <div key={i} className="koru-plan-hero-cat">
                <Mat style={{ color: m.color ?? hero.accent.color }}>{m.icon}</Mat>
                <span>{m.label}</span>
              </div>
            ),
          )}
        </div>
      )}

      {cta && (detail || cta.screen === "collections") && (
        <button
          type="button"
          className="koru-plan-hero-cta"
          style={{ background: hero.accent.color }}
          onClick={() => setOpen(true)}
        >
          {cta.label}
          <Mat>arrow_forward</Mat>
        </button>
      )}

      {open && cta?.screen === "collections" ? (
        <CollectionsScreen focusCollection={cta.collection} onClose={() => setOpen(false)} />
      ) : open && detail ? (
        <KoruDetailScreen detail={detail} headerIcon={hero.icon} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}
