import type { CSSProperties } from "react";

// 🔴 KIMI AUDIT — "Nunca un spinner genérico".
// Skeleton card con la MISMA anatomía que el molde Stitch unificado:
//   ┌──────────────────────────────────────┐
//   │ ▓▓▓ kicker              ▓▓▓▓▓▓▓▓▓▓  │  ← shimmer line 52% + shimmer sq 96×96
//   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │  ← shimmer line 84% (14px = title)
//   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                        │  ← shimmer line 64% (desc)
//   │                                      │
//   │ ┌──────┐ ┌──────┐ ┌──────┐            │  ← 3 shimmer metric tiles
//   │ │  ▓   │ │  ▓   │ │  ▓   │            │
//   │ └──────┘ └──────┘ └──────┘            │
//   │                                      │
//   │ Lo estoy oliendo…  • • •              │  ← Koru voice + 3 typing dots
//   └──────────────────────────────────────┘
//
// La forma coincide con KoruUnifiedCard/DefaultLayout: top (copy + art),
// métricas 3-up, footer. El usuario "ve" la card que va a llegar antes de
// que exista — sin spinner, sin ambigüedad.

const FONT_HEADING = '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';

const lineBase: CSSProperties = {
  background: "linear-gradient(90deg, #e4ddf7, #f6f3fe, #e4ddf7)",
  backgroundSize: "200% 100%",
  animation: "koru-shimmer-bar 1.5s linear infinite",
  borderRadius: 4,
  height: 12,
};

const ShimmerLine = ({ width, height, style }: { width: string; height?: number; style?: CSSProperties }) => (
  <div
    className="koru-shimmer-line"
    style={{ ...lineBase, width, height: height ?? 12, ...style }}
    aria-hidden="true"
  />
);

const ShimmerBox = ({ w, h, style }: { w: number; h: number; style?: CSSProperties }) => (
  <div
    className="koru-shimmer-line"
    style={{ ...lineBase, width: w, height: h, borderRadius: 14, ...style }}
    aria-hidden="true"
  />
);

/** Tres puntitos que titilan —Koru está "tecleando" mientras carga. */
function TypingDots() {
  const dot: CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "rgba(131, 99, 249, 0.55)",
    display: "inline-block",
    animation: "koru-shimmer-bar 1.2s ease-in-out infinite",
  };
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", marginLeft: 6 }}>
      <span style={{ ...dot, animationDelay: "0ms" }} />
      <span style={{ ...dot, animationDelay: "180ms" }} />
      <span style={{ ...dot, animationDelay: "360ms" }} />
    </span>
  );
}

export function CardSkeleton() {
  return (
    <div
      className="koru-plan-hero kc koru-card-skeleton"
      data-ui-block="skeleton"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando respuesta"
      style={{ overflow: "hidden", position: "relative" }}
    >
      <div style={{ padding: "18px 20px 14px" }}>
        {/* Top: copy + art */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <ShimmerLine width="52%" height={10} />
            <ShimmerLine width="84%" height={14} />
            <ShimmerLine width="64%" />
          </div>
          <ShimmerBox w={96} h={96} style={{ flex: "0 0 auto" }} />
        </div>

        {/* Métricas 3-up */}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                padding: "12px 10px",
                borderRadius: 14,
                background: "rgba(131, 99, 249, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <ShimmerBox w={18} h={18} style={{ borderRadius: 6 }} />
              <ShimmerLine width="70%" height={10} />
              <ShimmerLine width="50%" height={12} />
            </div>
          ))}
        </div>
      </div>

      {/* Footer — voz de Koru mientras trabaja */}
      <div
        className="kc-foot"
        style={{
          margin: "11px 20px 0",
          padding: "10px 0 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(131,99,249,0.7)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M15.5 15.5L20 20" />
        </svg>
        <span
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 12,
            fontWeight: 600,
            color: "#6b5f8c",
            letterSpacing: "0.01em",
            fontStyle: "italic",
          }}
        >
          Lo estoy oliendo…
        </span>
        <TypingDots />
      </div>
    </div>
  );
}

export default CardSkeleton;
