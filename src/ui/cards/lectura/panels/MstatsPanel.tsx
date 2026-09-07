/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-mstats — port visual del catálogo.
 * Card type real: match_stats
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  TrendingUp,
  Radar,
  Users,
} from "lucide-react";

import "./p-mstats.css";

export function MstatsPanel() {
  return (
    <>
      <div id="p-mstats" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--mint-ink)", "marginBottom": "5px" }}>El clásico, en números</small>Quién mandó<br />de verdad</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Métricas del partido completo — sin narrativa, lo que pasó fue esto.</p>
              </div>
              <div className="du-hero rv">
                <div className="du-teams">
                  <div className="du-tm"><img src="/stitch/sports/real-madrid.png" alt="Real Madrid" /><span className="nm">Real Madrid</span></div>
                  <span className="du-mid">78'</span>
                  <div className="du-tm rt"><span className="nm">Barcelona</span><img src="/stitch/sports/barcelona.png" alt="Barcelona" /></div>
                </div>
                <div className="du-pos">
                  <div className="lbl">Posesión</div>
                  <div className="track"><span className="l" style={{ "width": "58%" }}>58</span><span className="r" style={{ "width": "42%" }}>42</span></div>
                </div>
                <div className="du-bars">
                  <div className="db">
                    <div className="lbl">Remates al arco</div>
                    <div className="row"><div className="lbar" style={{ "width": "80%" }}><i style={{ "width": "6%" }}></i></div><div className="num">8<small>RMA</small></div><div className="rbar" style={{ "width": "50%" }}><i style={{ "width": "16%" }}></i></div></div>
                    <div className="row" style={{ "marginTop": "4px" }}><div className="lbar" style={{ "width": "0" }}></div><div className="num">5<small>BAR</small></div><div className="rbar" style={{ "width": "0" }}></div></div>
                  </div>
                  <div className="db">
                    <div className="lbl">Córners</div>
                    <div className="row"><div className="lbar" style={{ "width": "56%" }}><i style={{ "width": "22%" }}></i></div><div className="num">7<small>RMA</small></div><div className="rbar" style={{ "width": "40%" }}><i style={{ "width": "10%" }}></i></div></div>
                    <div className="row" style={{ "marginTop": "4px" }}><div className="lbar" style={{ "width": "0" }}></div><div className="num">4<small>BAR</small></div><div className="rbar" style={{ "width": "0" }}></div></div>
                  </div>
                  <div className="db">
                    <div className="lbl">Faltas</div>
                    <div className="row"><div className="lbar" style={{ "width": "36%" }}><i style={{ "width": "6%" }}></i></div><div className="num">9<small>RMA</small></div><div className="rbar" style={{ "width": "44%" }}><i style={{ "width": "9%" }}></i></div></div>
                    <div className="row" style={{ "marginTop": "4px" }}><div className="lbar" style={{ "width": "0" }}></div><div className="num">11<small>BAR</small></div><div className="rbar" style={{ "width": "0" }}></div></div>
                  </div>
                </div>
              </div>
              <div className="du-verdict rv">
                <Ic i={TrendingUp} className="ic" />
                <p>El 2-1 es justo: dominio local claro, pero <b>el rival remató mejor</b> — 3 de sus 5 fueron al ángulo. Si empatan al final, fue por eso.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Radar} className="ic" />Volver al partido</button>
                <button className="btn ghost"><Ic i={Users} className="ic" />Ver alineaciones</button>
              </div>
      </div>
    </>
  );
}
