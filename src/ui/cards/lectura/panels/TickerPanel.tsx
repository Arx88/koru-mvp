/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-ticker — port visual del catálogo.
 * Card type real: data_ticker
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  CircleDollarSign,
  Calendar,
  Sparkles,
  BellRing,
  EyeOff,
} from "lucide-react";

import "./p-ticker.css";

export function TickerPanel() {
  return (
    <>
      <div id="p-ticker" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--mint-ink)", "marginBottom": "5px" }}>Cupo · dólar · oficial</small>Te quedan<br />US$136 de 200</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>La cinta corre sola — solo te aviso cuando toque el límite o el precio haga algo raro.</p>
              </div>
              <div className="tt2-hero rv">
                <div className="tt2-tape">
                  <span className="lane">
                    <span className="tk2"><b>USD/EUR</b> 0,92 <span className="up">▲ +0,1%</span></span>
                    <span className="tk2"><b>EUR/ARS</b> 1.105,0 <span className="up">▲ +0,3%</span></span>
                    <span className="tk2"><b>US$200 CUPO</b> restan 136</span>
                    <span className="tk2"><b>OMIE POOL</b> €84,2/MWh</span>
                    <span className="tk2"><b>BITCOIN</b> 61.240 <span className="up">▲ +2,4%</span></span>
                    <span className="tk2"><b>ORO</b> 2.331 <span className="dn">▼ −0,4%</span></span>
                    <span className="tk2"><b>USD/EUR</b> 0,92 <span className="up">▲ +0,1%</span></span>
                    <span className="tk2"><b>EUR/ARS</b> 1.105,0 <span className="up">▲ +0,3%</span></span>
                    <span className="tk2"><b>US$200 CUPO</b> restan 136</span>
                    <span className="tk2"><b>OMIE POOL</b> €84,2/MWh</span>
                    <span className="tk2"><b>BITCOIN</b> 61.240 <span className="up">▲ +2,4%</span></span>
                    <span className="tk2"><b>ORO</b> 2.331 <span className="dn">▼ −0,4%</span></span>
                  </span>
                </div>
                <div className="tt2-main">
                  <div className="lbl">Tu cupo mensual · septiembre</div>
                  <div className="big">US$136<small> de 200</small></div>
                  <div className="sub">gastaste US$64 · se renueva el 1 de octubre</div>
                  <div className="tt2-gauge">
                    <div className="gt"><span>Queda <b>68%</b> del mes</span><span>34% usado</span></div>
                    <div className="tt2-track"><i></i><em></em></div>
                    <div className="gl"><span>1 sep</span><span>hoy</span><span>30 sep</span></div>
                  </div>
                </div>
              </div>
              <div className="tt2-what rv">
                <div className="tt2-w"><span className="wk2"><Ic i={CircleDollarSign} className="ic" />Precio hoy</span><b>€0,92</b><span>por cada US$1</span></div>
                <div className="tt2-w"><span className="wk2"><Ic i={Calendar} className="ic" />Renueva</span><b>1 oct</b><span>en 23 días</span></div>
              </div>
              <div className="tt2-note rv">
                <Ic i={Sparkles} className="ic" />
                <p>Con lo que queda te sobra para <b>los US$90 de Spotify anual</b> y la suscripción de iCloud. No hace falta que decidas hoy.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Avisame si toca el límite</button>
                <button className="btn ghost"><Ic i={EyeOff} className="ic" />Silenciar cinta</button>
              </div>
      </div>
    </>
  );
}
