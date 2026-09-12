/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-route — port visual del catálogo.
 * Card type real: route_timeline
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Footprints,
  TrainFront,
  TreePine,
  Sun,
  TriangleAlert,
  Navigation,
  Route,
} from "lucide-react";

import "./p-route.css";

export function RoutePanel() {
  return (
    <>
      <div id="p-route" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--sky-ink)", "marginBottom": "5px" }}>Aquí → Parque del Retiro</small>25 minutos,<br />dos cambios</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>La ruta que te recomiendo hoy — no la más corta, la que menos caminás al sol.</p>
              </div>
              <div className="rt-hero rv">
                <div className="rt-ends">
                  <div className="rt-end"><span className="dot2 a"></span><span className="nm">Estás aquí · Callao 220</span></div>
                  <div className="rt-eta"><b>25 min</b><span>llegás 16:05</span></div>
                </div>
                <div className="rt-path">
                  <div className="rt-leg">
                    <span className="ic" style={{ "color": "var(--sky-ink)" }}><Ic i={Footprints} className="ic" /></span>
                    <div className="lt"><b>Caminá 250 m</b><span>3 min</span></div>
                    <p>Por Callao hacia el sur, a la sombra de los plátanos.</p>
                  </div>
                  <div className="rt-leg">
                    <span className="ic" style={{ "color": "var(--honey-ink)" }}><Ic i={TrainFront} className="ic" /></span>
                    <div className="lt"><b>Subte D · 5 paradas</b><span>14 min</span></div>
                    <p>Callao → Retiro. Subís en el andén de la mano derecha.</p>
                  </div>
                  <div className="rt-leg">
                    <span className="ic" style={{ "color": "var(--sky-ink)" }}><Ic i={Footprints} className="ic" /></span>
                    <div className="lt"><b>Caminá 400 m</b><span>5 min</span></div>
                    <p>Salida Aduana, cruzás la avenida y entrás por Puerta de España.</p>
                  </div>
                  <div className="rt-leg end">
                    <span className="ic"><Ic i={TreePine} className="ic" style={{ "color": "var(--mint-ink)" }} /></span>
                    <div className="lt"><b>Llegás al Retiro</b></div>
                    <p>La estación de lagos queda a la izquierda de la entrada.</p>
                  </div>
                </div>
                <div className="rt-arr rv">
                  <Ic i={Sun} className="ic" />
                  <div className="at"><b>En el Retiro a las 16:05</b><span>26° y soleado — perfecto para lagos</span></div>
                  <span className="tm">16:05</span>
                </div>
              </div>
              <div className="rt-warn rv">
                <Ic i={TriangleAlert} className="ic" />
                <p>La línea D viene con <b>6 min de demora</b> por señalización. Si salís ahora mismo igual llegás antes de las 16:15.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Navigation} className="ic" />Empezar ruta</button>
                <button className="btn ghost"><Ic i={Route} className="ic" />Menos transbordo</button>
              </div>
      </div>
    </>
  );
}
