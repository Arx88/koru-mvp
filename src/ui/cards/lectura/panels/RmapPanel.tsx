/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-rmap — port visual del catálogo.
 * Card type real: route_map
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  MapPin,
  Flag,
  Navigation,
  Route,
  Footprints,
  Leaf,
  BellRing,
} from "lucide-react";

import "./p-rmap.css";

export function RmapPanel() {
  return (
    <>
      <div id="p-rmap" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--sky-ink)", "marginBottom": "5px" }}>Tu ruta · en vivo</small>Vas por Callao,<br />todo normal</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>El mapa se actualiza solo: yo aviso si algo cambia, no hace falta que lo mires.</p>
              </div>
              <div className="mp-map rv">
                <div className="mp-pin">
                  <span className="pchip"><Ic i={MapPin} className="ic" style={{ "color": "var(--violet-ink)" }} />Tú aquí</span>
                  <span className="pchip"><Ic i={Flag} className="ic" style={{ "color": "var(--mint-ink)" }} />Retiro · 6,2 km</span>
                </div>
                <svg className="map" viewBox="0 0 390 300">
                  <g stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity=".9">
                    <path d="M0 62 L390 62" /><path d="M0 158 L390 158" /><path d="M0 252 L390 252" />
                    <path d="M52 0 L52 300" /><path d="M146 0 L146 300" /><path d="M244 0 L244 300" /><path d="M330 0 L330 300" />
                  </g>
                  <g stroke="#d3e0f2" strokeWidth="2" strokeLinecap="round">
                    <path d="M0 110 L390 110" /><path d="M0 205 L390 205" />
                    <path d="M100 0 L100 300" /><path d="M198 0 L198 300" /><path d="M290 0 L290 300" />
                  </g>
                  <path d="M70 240 L146 240 L146 205 L244 205 L244 110 L320 58" fill="none" stroke="#1A237E" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
                  <path d="M70 240 L146 240 L146 205 L244 205 L244 110 L320 58" fill="none" stroke="#8ab0ff" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 12" />
                  <circle cx="176" cy="120" r="26" fill="#c9e4c9" opacity=".7" />
                  <text x="176" y="125" textAnchor="middle" fontFamily="Material Symbols Outlined" fontSize="14" fill="#1f7a5c">park</text>
                  <rect x="262" y="220" width="52" height="34" rx="7" fill="#e6d9f5" />
                  <text x="288" y="241" textAnchor="middle" fontFamily="Nunito" fontWeight="700" fontSize="9" fill="#6D52F8">RETIRO</text>
                </svg>
                <div className="mp-live"><span className="pulse"></span></div>
                <div className="mp-bottom">
                  <div className="bic"><Ic i={Navigation} className="ic" /></div>
                  <div className="bt"><b>Siguiente: Subte D en 4 min</b><span>Callao 220 · andén derecho</span></div>
                  <span className="bm">25 min</span>
                </div>
              </div>
              <div className="mp-stats rv">
                <div className="mp-stat"><Ic i={Route} className="ic" /><b>6,2 km</b><span>total</span></div>
                <div className="mp-stat"><Ic i={Footprints} className="ic" /><b>650 m</b><span>peatonal</span></div>
                <div className="mp-stat"><Ic i={Leaf} className="ic" /><b>0,9 kg</b><span>CO₂ vs auto</span></div>
              </div>
              <div className="mp-note rv">
                <Ic i={BellRing} className="ic" />
                <p>Si la línea D se corta te lo aviso <b>al instante</b> con plan B listo — mientras tanto, seguí caminando tranqui.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Route} className="ic" />Guíame paso a paso</button>
                <button className="btn ghost"><Ic i={MapPin} className="ic" />Compartir mi llegada</button>
              </div>
      </div>
    </>
  );
}
