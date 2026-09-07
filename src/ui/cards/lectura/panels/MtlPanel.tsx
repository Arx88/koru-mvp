/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-mtl — port visual del catálogo.
 * Card type real: match_timeline
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Calendar,
  ChartScatter,
  BellRing,
  CalendarDays,
} from "lucide-react";

import "./p-mtl.css";

export function MtlPanel() {
  return (
    <>
      <div id="p-mtl" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--mint-ink)", "marginBottom": "5px" }}>Tu equipo · próximo partido</small>Juega Boca,<br />y conviene verlo</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Te lo agendé con recordatorio 30 minutos antes. Así llega el día sin apuro.</p>
              </div>
              <div className="fx2-hero rv">
                <div className="fx2-when">
                  <span className="lg"><Ic i={Calendar} className="ic" />Jornada 6 · LaLiga</span>
                  <span className="cnt">en 3 días</span>
                </div>
                <div className="fx2-teams">
                  <div className="fx2-tm">
                    <img src="/stitch/sports/real-madrid.png" alt="Real Madrid" />
                    <span className="nm">Real Madrid</span>
                    <span className="form"><i className="w">G</i><i className="w">G</i><i className="d">E</i><i className="w">G</i><i className="w">G</i></span>
                  </div>
                  <div className="fx2-vs">
                    <span className="v">VS</span>
                    <span className="t">sáb 21:30</span>
                  </div>
                  <div className="fx2-tm">
                    <img src="/stitch/sports/barcelona.png" alt="Barcelona" />
                    <span className="nm">Barcelona</span>
                    <span className="form"><i className="w">G</i><i className="l">P</i><i className="w">G</i><i className="w">G</i><i className="d">E</i></span>
                  </div>
                </div>
                <div className="fx2-meta">
                  <div className="m"><span>Estadio</span><b>Santiago B.</b></div>
                  <div className="m"><span>Dónde verlo</span><b>DAZN</b></div>
                  <div className="m"><span>Clima</span><b>21° despejado</b></div>
                </div>
              </div>
              <div className="fx2-note rv">
                <Ic i={ChartScatter} className="ic" />
                <p>Llegan mejor los blancos: <b>13 de 15 puntos</b> vs 10 del rival. Pero el clásico ya nos enseñó que la forma no manda — <b>te aviso igual 30 min antes</b>.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Recordarme 30 min antes</button>
                <button className="btn ghost"><Ic i={CalendarDays} className="ic" />Ver todo el mes</button>
              </div>
      </div>
    </>
  );
}
