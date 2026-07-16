import { type CSSProperties, useEffect, useState } from "react";
import { fetchPriceHistoryCamel, type CamelPriceHistory } from "../../../tools/shopping/camelPrice";

// ═══════════════════════════════════════════════════════════════════════════
//  PriceHistoryChart — histórico de precios Amazon por ASIN.
//
//  Estrategia:
//   - Si KEEPA_API_KEY está configurado en runtime, debería usarse Keepa (no
//     implementado aquí todavía — el stub previo esperaba ese wiring).
//   - Si NO hay KEEPA_API_KEY, caemos a CamelCamelCamel (HTML scrape público,
//     sin key). Devuelve lowest/highest/current. Best-effort: si el scrape
//     falla, mostramos placeholder "no disponible".
//
//  La firma pública (props + extractAsin) está alineada con el uso en
//  KoruDetailScreen:
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

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 8,
  flexWrap: "wrap",
};

const tileStyle: CSSProperties = {
  flex: "1 1 80px",
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(131, 99, 249, 0.06)",
  border: "1px solid rgba(131, 99, 249, 0.10)",
};

const tileLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "#6b5f8c",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tileValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#1a1a2e",
  marginTop: 2,
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: CamelPriceHistory }
  | { kind: "empty" };

/** Componente — usa CamelCamelCamel como fallback libre cuando no hay
 *  KEEPA_API_KEY. Best-effort: si Camel no parsea el HTML, muestra fallback. */
export function PriceHistoryChart({ title, asin, currentPrice }: PriceHistoryChartProps) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    if (!asin) {
      setState({ kind: "empty" });
      return;
    }
    // Si KEEPA_API_KEY está configurado en runtime, dejamos que una futura
    // implementación Keepa tome la posta. Por ahora, caemos a Camel.
    const keepaKey =
      typeof process !== "undefined" && process.env ? process.env.KEEPA_API_KEY : undefined;
    if (keepaKey) {
      // Keepa no implementado aún — mantenemos fallback visual.
      setState({ kind: "empty" });
      return;
    }
    setState({ kind: "loading" });
    void fetchPriceHistoryCamel(asin)
      .then((data) => {
        if (cancelled) return;
        if (data == null) {
          setState({ kind: "empty" });
        } else {
          setState({ kind: "ready", data });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "empty" });
      });
    return () => {
      cancelled = true;
    };
  }, [asin]);

  return (
    <div style={wrapStyle}>
      <p style={titleStyle}>{title}</p>
      {state.kind === "ready" ? (
        <>
          <p style={{ ...fallbackStyle, marginBottom: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>show_chart</span>
            {currentPrice ? `${currentPrice} · ` : ""}Histórico CamelCamelCamel
          </p>
          <div style={rowStyle}>
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Mínimo</div>
              <div style={{ ...tileValueStyle, color: "#16a34a" }}>${state.data.lowest}</div>
            </div>
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Actual</div>
              <div style={{ ...tileValueStyle, color: "#2563eb" }}>${state.data.current}</div>
            </div>
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Máximo</div>
              <div style={{ ...tileValueStyle, color: "#dc2626" }}>${state.data.highest}</div>
            </div>
          </div>
        </>
      ) : (
        <p style={fallbackStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {state.kind === "loading" ? "progress_activity" : "show_chart"}
          </span>
          {currentPrice ? `${currentPrice} · ` : ""}
          {state.kind === "loading"
            ? "Consultando CamelCamelCamel…"
            : asin
              ? "Histórico no disponible"
              : "Sin ASIN detectado"}
        </p>
      )}
    </div>
  );
}

export default PriceHistoryChart;
