/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-elect — port visual del catálogo.
 * Card type real: election_results
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Hourglass,
  BellRing,
  Map,
} from "lucide-react";

import "./p-elect.css";

export function ElectPanel() {
  return (
    <>
      <div id="p-elect" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--violet-ink)", "marginBottom": "5px" }}>Escrutinio provisorio</small>Así está<br />la cuenta</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>89% contado. Aún puede moverse, pero ya se ve la forma del resultado.</p>
              </div>
              <div className="el-hero rv">
                <div className="el-progress">
                  <div className="ring">
                    <svg viewBox="0 0 54 54">
                      <circle cx="27" cy="27" r="23" fill="none" stroke="#E6EEFA" strokeWidth="6" />
                      <circle cx="27" cy="27" r="23" fill="none" stroke="#6D52F8" strokeWidth="6" strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="15.9" />
                    </svg>
                    <span className="rv2">89%</span>
                  </div>
                  <div className="tx">
                    <b>Mesas escrutas: 34.312 de 38.540</b>
                    <span>se actualiza cada 10 min · fuente oficial electoral</span>
                  </div>
                </div>
                <div className="el-bar">
                  <i className="lead" style={{ "width": "34%", "background": "#6D52F8" }}>34%</i>
                  <i style={{ "width": "29%", "background": "#1A237E" }}>29%</i>
                  <i style={{ "width": "18%", "background": "#B07E00" }}>18%</i>
                  <i style={{ "width": "12%", "background": "#d6497f" }}>12%</i>
                  <i style={{ "width": "7%", "background": "#A6ACCB" }} aria-label="Otros 7%"></i>
                </div>
                <div className="el-legend">
                  <div className="el-row win"><span className="sw2" style={{ "background": "#6D52F8" }}></span><b>Partido A<small>mejoró 2 pts en el sur</small></b><span className="pv">34,1%</span><span className="seats"><i style={{ "background": "#6D52F8" }}></i><i style={{ "background": "#6D52F8" }}></i><i style={{ "background": "#6D52F8" }}></i><i style={{ "background": "#6D52F8" }}></i><i style={{ "background": "#6D52F8" }}></i><i style={{ "background": "#6D52F8" }}></i></span></div>
                  <div className="el-row"><span className="sw2" style={{ "background": "#1A237E" }}></span><b>Partido B<small>fuerte en la costa</small></b><span className="pv">28,8%</span><span className="seats"><i style={{ "background": "#1A237E" }}></i><i style={{ "background": "#1A237E" }}></i><i style={{ "background": "#1A237E" }}></i><i style={{ "background": "#1A237E" }}></i><i style={{ "background": "#1A237E" }}></i></span></div>
                  <div className="el-row"><span className="sw2" style={{ "background": "#B07E00" }}></span><b>Partido C<small>cede terreno urbano</small></b><span className="pv">18,2%</span><span className="seats"><i style={{ "background": "#B07E00" }}></i><i style={{ "background": "#B07E00" }}></i><i style={{ "background": "#B07E00" }}></i></span></div>
                  <div className="el-row"><span className="sw2" style={{ "background": "#d6497f" }}></span><b>Partido D</b><span className="pv">12,4%</span><span className="seats"><i style={{ "background": "#d6497f" }}></i><i style={{ "background": "#d6497f" }}></i></span></div>
                  <div className="el-row"><span className="sw2" style={{ "background": "#A6ACCB" }}></span><b>Otros</b><span className="pv">6,5%</span><span className="seats"><i style={{ "background": "#A6ACCB" }}></i></span></div>
                </div>
              </div>
              <div className="el-note rv">
                <Ic i={Hourglass} className="ic" />
                <p>Faltan <b>4.228 mesas</b>, casi todas de la costa. Con ese patrón, el segundo puede recortar hasta 1,5 pts — <b>el primero no pierde el primer lugar</b> en ningún escenario.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Avísame al 100%</button>
                <button className="btn ghost"><Ic i={Map} className="ic" />Ver por provincias</button>
              </div>
      </div>
    </>
  );
}
