import { type CSSProperties } from "react";

// ═══════════════════════════════════════════════════════════════════════════
//  PriceHistoryChart — STUB.
//
//  Este archivo es un placeholder temporal para que `KoruDetailScreen.tsx`
//  pueda importar `PriceHistoryChart` y `extractAsin` sin romper tsc.
//  La implementación real (sparklines SVG alimentados por Keepa) debe
//  reemplazar este stub. La firma pública (props + extractAsin) está
//  alineada con el uso en KoruDetailScreen:
//
//    <PriceHistoryChart
//      title={it.title}
//      url={it.url ?? ""}
//      asin={extractAsin(it.url ?? "")}
//      currentPrice={it.price}
//    />
// ═══════════════════════════════════════════════════════════════════════════

export function extractAsin(url: string): string | null {
  if (!url) return null;
  // ASINs tienen 10 caracteres alfanuméricos y aparecen tras /dp/ o /product/
  const m = url.match(/\/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1] : null;
}

export interface PriceHistoryChartProps {
  title: string;
  url: string;
  asin: string | null;
  currentPrice?: string;
}

const wrapStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(131, 99, 249, 0.14)",
  background: "rgba(255, 255, 255, 0.6)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  color: "#1a1a2e",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const fallbackStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 12,
  color: "#6b5f8c",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

/** Stub component — renderiza un placeholder "no disponible" hasta que la
 *  implementación real (Keepa sparkline SVG) reemplace este archivo. */
export function PriceHistoryChart({ title, asin, currentPrice }: PriceHistoryChartProps) {
  return (
    <div style={wrapStyle}>
      <p style={titleStyle}>{title}</p>
      <p style={fallbackStyle}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>show_chart</span>
        {currentPrice ? `${currentPrice} · ` : ""}
        {asin ? `Histórico no disponible` : "Sin ASIN detectado"}
      </p>
    </div>
  );
}

export default PriceHistoryChart;
