/**
 * RouteMapInterior — card "Tu ruta en vivo" (#p-rmap), bind real del block
 * `route_map` (from/to/distance/remaining/progress/lat/lng/steps/
 * alternatives/trafficLevel/fuelEstimate).
 *
 * Mapa esquemático (grilla de calles del catálogo, escena decorativa) con
 * el polyline de la ruta; el progreso REAL del block desvanece lo andado.
 * Pins con from/to/distance reales. Stats: distancia, restante y tráfico
 * (o combustible si vino). "Guíame paso a paso" abre el deep link NATIVO
 * de maps con lat/lng del block (Android geo:, iOS maps://) — la misma
 * convención documentada en el domain. "Compartir mi llegada" usa
 * navigator.share (con fallback a clipboard).
 */
import { MapPin, Flag, Navigation, Route as RouteIcon, Footprints, Car, Gauge, BellRing, Share2 } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-rmap.css";

type MapBlock = Extract<UiBlock, { type: "route_map" }>;

/** Ruta esquemática del catálogo con fade del tramo andado (progress). */
const ROUTE_D = "M70 240 L146 240 L146 205 L244 205 L244 110 L320 58";

export function RouteMapInterior({ block, onClose, onSave }: LecturaInteriorProps<MapBlock>) {
  const progress = Math.min(100, Math.max(0, block.progress ?? 0));
  const arrived = progress >= 100;
  const next = arrived ? undefined : block.steps?.[0];
  const hasGeo = block.lat != null && block.lng != null;

  const openNativeMaps = () => {
    if (!hasGeo) return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const url = isIOS
      ? `maps://?daddr=${block.lat},${block.lng}`
      : `geo:${block.lat},${block.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareArrival = async () => {
    const text = `Llego a ${block.to ?? "destino"}${block.remaining ? ` en ${block.remaining}` : ""}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Mi llegada", text });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // usuario canceló el share o clipboard no disponible — sin drama
    }
  };

  const traffic = block.trafficLevel?.toLowerCase() ?? "";

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`Ruta a ${block.to ?? "destino"}`, block.remaining) : undefined}
      chip={{ label: "En vivo", background: "linear-gradient(135deg,#a5b4fc,#6366f1)" }}
      ariaLabel="Tu ruta en vivo"
    >
      <div id="p-rmap" className="lcr-panel">
        <div className="ev-head rv" style={{ margin: "2px 0 14px" }}>
          <h1 style={{ font: "800 26px/1.12 var(--disp)", letterSpacing: "-.02em" }}>
            <small
              style={{
                display: "block",
                font: "700 11px var(--sans)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--sky-ink)",
                marginBottom: "5px",
              }}
            >
              Tu ruta · en vivo
            </small>
            {progress > 0 ? `Vas al ${Math.round(progress)}%` : "Ruta lista"}
            <br />
            hacia {block.to ?? "tu destino"}
          </h1>
          <p style={{ font: "600 12px var(--sans)", color: "var(--ink-dim)", marginTop: "6px" }}>
            {block.remaining
              ? `Te quedan ${block.remaining} — el resto del camino ya está resuelto.`
              : "El mapa es esquemático; el botón de abajo abre la app de maps con el destino real."}
          </p>
        </div>

        <div className="mp-map rv">
          <div className="mp-pin">
            <span className="pchip">
              <Ic i={MapPin} className="ic" style={{ color: "var(--violet-ink)" }} />
              {block.from ?? "Vos acá"}
            </span>
            <span className="pchip">
              <Ic i={Flag} className="ic" style={{ color: "var(--mint-ink)" }} />
              {block.to ?? "Destino"}
              {block.distance ? ` · ${block.distance}` : ""}
            </span>
          </div>
          <svg className="map" viewBox="0 0 390 300" role="img" aria-label="Mapa esquemático de la ruta">
            <g stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity=".9">
              <path d="M0 62 L390 62" /><path d="M0 158 L390 158" /><path d="M0 252 L390 252" />
              <path d="M52 0 L52 300" /><path d="M146 0 L146 300" /><path d="M244 0 L244 300" /><path d="M330 0 L330 300" />
            </g>
            <g stroke="#d3e0f2" strokeWidth="2" strokeLinecap="round">
              <path d="M0 110 L390 110" /><path d="M0 205 L390 205" />
              <path d="M100 0 L100 300" /><path d="M198 0 L198 300" /><path d="M290 0 L290 300" />
            </g>
            {/* tramo restante (sólido) + tramo andado (desvanecido según progress) */}
            <path d={ROUTE_D} fill="none" stroke="#5170d8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity={progress >= 100 ? 0.25 : 0.85} />
            <path d={ROUTE_D} fill="none" stroke="#8ab0ff" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 12" />
            <circle cx="176" cy="120" r="26" fill="#c9e4c9" opacity=".7" />
            <rect x="262" y="220" width="52" height="34" rx="7" fill="#e6d9f5" />
            <text x="288" y="241" textAnchor="middle" fontFamily="var(--sans)" fontWeight="700" fontSize="9" fill="#6d4bf0">
              {(block.to ?? "DESTINO").slice(0, 10).toUpperCase()}
            </text>
          </svg>
          <div className="mp-live" data-progress={Math.round(progress)}><span className="pulse" /></div>
          <div className="mp-bottom">
            <div className="bic">
              <Ic i={Navigation} className="ic" />
            </div>
            <div className="bt">
              <b>
                {next
                  ? `Siguiente: ${next.instruction}`
                  : progress >= 100
                    ? "Llegaste al destino"
                    : "Ruta trazada"}
              </b>
              <span>
                {next && next.distanceMeters
                  ? `${next.distanceMeters} m · ${next.maneuver}`
                  : `${block.steps?.length ?? 0} pasos de navegación`}
              </span>
            </div>
            <span className="bm">{block.remaining ?? `${Math.round(progress)}%`}</span>
          </div>
        </div>

        <div className="mp-stats rv">
          <div className="mp-stat">
            <Ic i={RouteIcon} className="ic" />
            <b>{block.distance ?? "—"}</b>
            <span>total</span>
          </div>
          <div className="mp-stat">
            <Ic i={progress >= 100 ? Flag : Footprints} className="ic" />
            <b>{block.remaining ?? (progress >= 100 ? "listo" : `${Math.round(progress)}%`)}</b>
            <span>{progress >= 100 ? "completado" : "restante"}</span>
          </div>
          <div className="mp-stat">
            <Ic i={traffic && /pesado|heavy/.test(traffic) ? Gauge : Car} className="ic" />
            <b>{traffic || block.fuelEstimate || "—"}</b>
            <span>{traffic ? "tráfico" : block.fuelEstimate ? "combustible" : "estado"}</span>
          </div>
        </div>

        {block.alternatives?.length ? (
          <div className="mp-note rv">
            <Ic i={BellRing} className="ic" />
            <p>
              Alternativas reales del planificador:{" "}
              {block.alternatives.map((a) => `${a.mode} (${a.time})`).join(" · ")}. Si algo cambia en el camino, el plan B ya está anotado acá.
            </p>
          </div>
        ) : null}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={!hasGeo}
            onClick={openNativeMaps}
          >
            <Ic i={RouteIcon} className="ic" />
            {hasGeo ? "Guíame paso a paso" : "Sin coordenadas"}
          </button>
          <button type="button" className="btn ghost" onClick={() => void shareArrival()}>
            <Ic i={Share2} className="ic" />
            Compartir mi llegada
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
