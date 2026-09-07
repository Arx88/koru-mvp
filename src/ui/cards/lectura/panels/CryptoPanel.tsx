/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-crypto — port visual del catálogo.
 * Card type real: crypto_portfolio
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  TrendingUp,
  Zap,
  PiggyBank,
  ChartPie,
  Lightbulb,
  BellRing,
  History,
} from "lucide-react";

import "./p-crypto.css";

export function CryptoPanel() {
  return (
    <>
      <div id="p-crypto" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--mint-ink)", "marginBottom": "5px" }}>Tu portfolio · cripto</small>Hoy te despertaste<br />€186 más rico</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Te lo muestro como lo miro yo: el total primero, la moneda después.</p>
              </div>
              <div className="pf-hero rv">
                <div className="ph-top">
                  <div>
                    <div className="pl">Valor hoy</div>
                    <div className="pv">€4.320</div>
                  </div>
                  <div className="pd">
                    <span className="up"><Ic i={TrendingUp} className="ic" />+€186</span>
                    <span className="sub">+4,5% en 24 h</span>
                  </div>
                </div>
                <div className="pf-chart">
                  <svg viewBox="0 0 340 118">
                    <defs>
                      <linearGradient id="p-crypto-pfA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#6ee7b7" stopOpacity=".45" /><stop offset="1" stopColor="#6ee7b7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <g stroke="#f1ecfa" strokeWidth="1">
                      <line x1="0" y1="24" x2="340" y2="24" /><line x1="0" y1="58" x2="340" y2="58" /><line x1="0" y1="92" x2="340" y2="92" />
                    </g>
                    <path d="M4 74 C 24 78, 40 70, 58 64 C 80 57, 96 62, 118 54 C 142 46, 160 50, 182 44 C 206 38, 222 40, 244 32 C 266 24, 284 26, 306 16 C 322 9, 330 8, 336 7 L336 118 L4 118 Z" fill="url(#p-crypto-pfA)" />
                    <path d="M4 74 C 24 78, 40 70, 58 64 C 80 57, 96 62, 118 54 C 142 46, 160 50, 182 44 C 206 38, 222 40, 244 32 C 266 24, 284 26, 306 16 C 322 9, 330 8, 336 7" fill="none" stroke="#2f8f6d" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="336" cy="7" r="5.5" fill="#fff" stroke="#2f8f6d" strokeWidth="3" />
                  </svg>
                  <div className="pf-axis"><span>09:00</span><span>13:00</span><span>17:00</span><span>ahora</span></div>
                </div>
                <div className="pf-chips">
                  <span className="c"><Ic i={Zap} className="ic" />actualizado 12 s</span>
                  <span className="c"><Ic i={PiggyBank} className="ic" />2 monedas</span>
                </div>
              </div>
              <div className="pf-rows rv">
                <h3><Ic i={ChartPie} className="ic" />Tus monedas</h3>
                <div className="pcoin">
                  <div className="cic btc">₿</div>
                  <div className="ct"><b>Bitcoin</b><span>0,052 BTC · 74% del portfolio</span></div>
                  <svg className="spk" viewBox="0 0 58 26"><path d="M2 20 L10 16 L17 19 L26 10 L34 13 L44 6 L56 3" fill="none" stroke="#2f8f6d" strokeWidth="2.2" strokeLinecap="round" /></svg>
                  <div className="cv"><b>€3.182</b><span className="u">+2,4%</span></div>
                </div>
                <div className="pcoin">
                  <div className="cic eth">Ξ</div>
                  <div className="ct"><b>Ethereum</b><span>0,42 ETH · 26% del portfolio</span></div>
                  <svg className="spk" viewBox="0 0 58 26"><path d="M2 13 L10 16 L17 11 L26 15 L34 19 L44 16 L56 20" fill="none" stroke="#d6497f" strokeWidth="2.2" strokeLinecap="round" /></svg>
                  <div className="cv"><b>€1.252</b><span className="d">−1,1%</span></div>
                </div>
              </div>
              <div className="pf-note rv">
                <Ic i={Lightbulb} className="ic" />
                <p>Hace 3 meses me pediste que te avisara si el total cruzaba <b>€4.500</b>: faltan €180 (4,2%). Puse la alerta igual, no te tengo que acordar.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Alerta en €4.500</button>
                <button className="btn ghost"><Ic i={History} className="ic" />Ver histórico</button>
              </div>
      </div>
    </>
  );
}
