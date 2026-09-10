/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-forex — port visual del catálogo.
 * Card type real: forex
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  RefreshCw,
  ChartLine,
  Sparkles,
  BellRing,
  Banknote,
} from "lucide-react";

import "./p-forex.css";

export function ForexPanel() {
  return (
    <>
      <div id="p-forex" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--mint-ink)", "marginBottom": "5px" }}>Dólar oficial · euro</small>El dólar<br />estable de hoy</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>La cotización de la ventanilla, no la del titular: qué te dan y qué te piden de verdad.</p>
              </div>
              <div className="fx3-hero rv">
                <div className="fx3-rate">
                  <div className="fx3-cur"><span className="fl" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}>US$</span><span>Dólar</span></div>
                  <div className="fx3-arrow">
                    <Ic i={RefreshCw} className="ic a" />
                    <div className="r">0,92<small>€ POR US$1</small></div>
                  </div>
                  <div className="fx3-cur"><span className="fl" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}>€</span><span>Euro</span></div>
                </div>
                <div className="fx3-board">
                  <div className="bh"><span>Te compran (bank buys)</span><span>Te venden (bank sells)</span></div>
                  <div className="bb">
                    <span><b>0,90</b><small>SI VENDÉS DÓLARES</small></span>
                    <span><b>0,92</b><small>SI COMPRÁS DÓLARES</small></span>
                  </div>
                </div>
                <div className="fx3-conv"><span>Cambiando US$500 hoy</span><b>→ €455</b></div>
              </div>
              <div className="fx3-week rv">
                <h3><Ic i={ChartLine} className="ic" />Cómo se movió esta semana</h3>
                <svg viewBox="0 0 320 88">
                  <g stroke="#f1ecfa" strokeWidth="1">
                    <line x1="0" y1="18" x2="320" y2="18" /><line x1="0" y1="44" x2="320" y2="44" /><line x1="0" y1="70" x2="320" y2="70" />
                  </g>
                  <path d="M4 52 L57 46 L110 50 L163 40 L216 44 L269 36 L316 38" fill="none" stroke="#22B35F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="4" cy="52" r="4.5" fill="#fff" stroke="#22B35F" strokeWidth="2.5" />
                  <circle cx="316" cy="38" r="4.5" fill="#fff" stroke="#22B35F" strokeWidth="2.5" />
                </svg>
                <div className="wk"><span>lun</span><span>mar</span><span>mié</span><span>jue</span><span>vie</span><span>hoy</span></div>
              </div>
              <div className="fx3-note rv">
                <Ic i={Sparkles} className="ic" />
                <p>Está <b>0,8% abajo de la semana</b>: si no es urgente, esperar a lunes no te cambia la vida. Si cambiás US$500 hoy, son <b>€455</b> — el banco se queda con €10 de spread.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Avisame si llega a 0,95</button>
                <button className="btn ghost"><Ic i={Banknote} className="ic" />Calcular otro monto</button>
              </div>
      </div>
    </>
  );
}
