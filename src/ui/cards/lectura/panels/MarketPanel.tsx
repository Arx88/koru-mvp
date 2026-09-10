/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-market — port visual del catálogo.
 * Card type real: market
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  CandlestickChart,
  Ruler,
  HeartHandshake,
  BellRing,
  History,
} from "lucide-react";

import "./p-market.css";

export function MarketPanel() {
  return (
    <>
      <div id="p-market" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--sky-ink)", "marginBottom": "5px" }}>AAPL · NASDAQ</small>Apple, al detalle<br />y en contexto</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Cotización en vivo y dónde está parada respecto a su propio año — que es lo único que importa.</p>
              </div>
              <div className="st-hero rv">
                <div className="sh-top">
                  <span className="tk"><Ic i={CandlestickChart} className="ic" /><b>AAPL</b> · NASDAQ</span>
                  <span style={{ "font": "700 9px var(--sans)", "color": "var(--ink-faint)", "background": "var(--paper2)", "padding": "4px 9px", "borderRadius": "999px" }}>en vivo</span>
                </div>
                <div className="px">231,40<small> USD</small></div>
                <div className="chg">▲ +1,8% hoy · +$4,12</div>
                <div className="st-chart">
                  <svg viewBox="0 0 340 104">
                    <g stroke="#f1ecfa" strokeWidth="1">
                      <line x1="0" y1="22" x2="340" y2="22" /><line x1="0" y1="52" x2="340" y2="52" /><line x1="0" y1="82" x2="340" y2="82" />
                    </g>
                    <path d="M4 66 C 20 62, 34 68, 50 60 C 68 51, 84 56, 100 48 C 118 40, 134 44, 150 38 C 168 31, 184 34, 200 28 C 218 22, 236 26, 252 19 C 268 13, 286 15, 302 10 C 316 6, 328 6, 336 5" fill="none" stroke="#1A237E" strokeWidth="3" strokeLinecap="round" />
                    <line x1="0" y1="46" x2="340" y2="46" stroke="#c9d9f5" strokeWidth="1.5" strokeDasharray="4 5" />
                    <text x="334" y="42" textAnchor="end" fontFamily="Nunito" fontWeight="700" fontSize="9" fill="#6E7594">prev. cierre 227,28</text>
                    <circle cx="336" cy="5" r="5" fill="#fff" stroke="#1A237E" strokeWidth="3" />
                  </svg>
                </div>
                <div className="ohlc">
                  <span>APERTURA<b>$229,28</b></span>
                  <span>MÁX HOY<b>$232,10</b></span>
                  <span>MÍN HOY<b>$228,44</b></span>
                </div>
              </div>
              <div className="st-range rv">
                <div className="rl"><span>52 sem mín <b>$164,08</b></span><span>52 sem máx <b>$237,25</b></span></div>
                <div className="rtrack"><span className="rmark"></span></div>
                <div className="rnow"><span>Está al <b>97%</b> de su máximo anual</span><span>zona alta</span></div>
              </div>
              <div className="st-read rv">
                <div className="rr"><div className="ric" style={{ "background": "var(--sky-soft)" }}><Ic i={Ruler} className="ic" style={{ "color": "var(--sky-ink)" }} /></div><div className="rt"><b>Cara para comprar</b><span>Cotiza a 34 veces sus ganancias: precio de empresa de calidad, no de ganga.</span></div></div>
                <div className="rr"><div className="ric" style={{ "background": "var(--mint-soft)" }}><Ic i={HeartHandshake} className="ic" style={{ "color": "var(--mint-ink)" }} /></div><div className="rt"><b>Paga dividendito</b><span>0,45% anual + US$90.000 M recomprando acciones propias este año.</span></div></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Alerta si toca $235</button>
                <button className="btn ghost"><Ic i={History} className="ic" />Ver 1 año</button>
              </div>
      </div>
    </>
  );
}
