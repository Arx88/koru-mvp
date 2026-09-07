/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-transp — port visual del catálogo.
 * Card type real: transport_compare
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Bus,
  Sparkles,
  Route,
  TrainFront,
  Car,
  LocateFixed,
} from "lucide-react";

import "./p-transp.css";

export function TranspPanel() {
  return (
    <>
      <div id="p-transp" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--sky-ink)", "marginBottom": "5px" }}>Callao → Retiro · ahora</small>El tablero<br />de salidas</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Lo que está por llegar a tu cuadra, en orden real de llegada — no de cercanía.</p>
              </div>
              <div className="db-hero rv">
                <div className="db-head">
                  <span className="tt"><Ic i={Bus} className="ic" />Próximas salidas</span>
                  <span className="now">actualizado 8 s</span>
                </div>
                <div className="db-row next">
                  <span className="ln d">D<small>SUBTE</small></span>
                  <span className="dst">Hacia Retiro<small>andén derecho · 4 vagones</small></span>
                  <span className="eta">4 min</span>
                </div>
                <div className="db-row">
                  <span className="ln b">10<small>BUS</small></span>
                  <span className="dst">Hacia Puerto Madero<small>8 cuadras caminando</small></span>
                  <span className="eta">9 min</span>
                </div>
                <div className="db-row">
                  <span className="ln t">78<small>COLECTIVO</small></span>
                  <span className="dst">Hacia Constitución<small>paso a 2 cuadras</small></span>
                  <span className="eta">12 min</span>
                </div>
                <div className="db-adv">
                  <Ic i={Sparkles} className="ic" />
                  El de 4 min es el tuyo: si caminás despacio igual llegás. El bus de 9 te deja 6 cuadras más lejos.
                </div>
              </div>
              <div className="db-compare rv">
                <h3><Ic i={Route} className="ic" />Comparadas por tu viaje</h3>
                <div className="cmp-row best">
                  <span className="ci" style={{ "background": "var(--mint-soft)" }}><Ic i={TrainFront} className="ic" style={{ "color": "var(--mint-ink)" }} /></span>
                  <span className="cn">Subte D<small>5 paradas directo</small></span>
                  <span className="cv">25 min<small>llegás 16:05</small></span>
                  <span style={{ "font": "800 8.5px var(--sans)", "color": "#05301d", "background": "var(--mint)", "padding": "4px 8px", "borderRadius": "999px" }}>GANA</span>
                </div>
                <div className="cmp-row">
                  <span className="ci" style={{ "background": "var(--honey-soft)" }}><Ic i={Bus} className="ic" style={{ "color": "var(--honey-ink)" }} /></span>
                  <span className="cn">Bus 10 + caminata<small>transbordo en Libertad</small></span>
                  <span className="cv">41 min<small>llegás 16:21</small></span>
                </div>
                <div className="cmp-row">
                  <span className="ci" style={{ "background": "var(--sky-soft)" }}><Ic i={Car} className="ic" style={{ "color": "var(--sky-ink)" }} /></span>
                  <span className="cn">Uber<small>tráfico moderado en 9 de Julio</small></span>
                  <span className="cv">22 min<small>€11,40</small></span>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={TrainFront} className="ic" />Tomar el subte</button>
                <button className="btn ghost"><Ic i={LocateFixed} className="ic" />Ver en el mapa</button>
              </div>
      </div>
    </>
  );
}
