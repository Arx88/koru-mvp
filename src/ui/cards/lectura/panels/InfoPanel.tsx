/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-info — port visual del catálogo.
 * Card type real: deliverable
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Sun,
  Banknote,
  BadgeCheck,
  Download,
  CircleHelp,
} from "lucide-react";

import "./p-info.css";

export function InfoPanel() {
  return (
    <>
      <div id="p-info" className="lcr-panel">
      <div className="rep-head rv">
                <div className="rep-meta"><span>Informe <b>Nº 047</b> · Energía</span><span>7 min de lectura</span></div>
                <h1>Energía solar<br />en España</h1>
                <p className="rep-lede">Radiación, costos reales y el punto exacto en que la solar doméstica conviene frente a la red.</p>
              </div>
              <div className="rep-count rv">
                <span className="rc-label">La cuenta que importa</span>
                <div className="rc-big">€1.100<small>/año</small></div>
                <div className="rc-sub">ahorro medio de una casa con 3 kWp, excedentes incluidos</div>
                <div className="rep-axis">
                  <div className="ra-track">
                    <span className="ra-tag">se paga sola · año 7</span>
                    <div className="ra-line"></div>
                    <div className="ra-dot"></div>
                  </div>
                  <div className="ra-ends"><span>Inversión €7.400</span><span>+18 años de ganancia</span></div>
                </div>
              </div>
              <div className="rep-chart rv" style={{ "marginTop": "14px" }}>
                <h3><Ic i={Sun} className="ic" />Dónde pega más el sol</h3>
                <div className="cnote">Producción anual por kWp instalado¹ — axis Y recortada en 1.000</div>
                <div className="rrow"><div className="rn">Andalucía</div><div className="rtrack"><i style={{ "width": "100%" }}></i></div><div className="rval">1.750<small>kWh</small></div></div>
                <div className="rrow"><div className="rn">Murcia</div><div className="rtrack"><i style={{ "width": "97%" }}></i></div><div className="rval">1.700<small>kWh</small></div></div>
                <div className="rrow"><div className="rn">Madrid</div><div className="rtrack"><i style={{ "width": "91%" }}></i></div><div className="rval">1.600<small>kWh</small></div></div>
                <div className="rrow"><div className="rn">Valencia</div><div className="rtrack"><i style={{ "width": "86%" }}></i></div><div className="rval">1.540<small>kWh</small></div></div>
                <div className="rrow"><div className="rn">Galicia<sup>2</sup></div><div className="rtrack"><i style={{ "width": "71%", "background": "linear-gradient(90deg,#cfc2ef,#8B6DFF)" }}></i></div><div className="rval">1.250<small>kWh</small></div></div>
              </div>
              <div className="rep-sheet rv" style={{ "marginTop": "14px" }}>
                <h3><Ic i={Banknote} className="ic" />Qué cuesta de verdad</h3>
                <div className="ds-row"><span className="dn">3 kWp · casa típica</span><span className="dots"></span><span className="dv">€7.400<em>REF</em></span></div>
                <div className="ds-row"><span className="dn">5 kWp + batería</span><span className="dots"></span><span className="dv">€12.900</span></div>
                <div className="ds-row"><span className="dn">Boletín eléctrico</span><span className="dots"></span><span className="dv">€350–600</span></div>
                <div className="ds-row"><span className="dn">Mantenimiento anual</span><span className="dots"></span><span className="dv">€120</span></div>
                <div className="ds-row"><span className="dn">Subvención EU (hasta 40%)</span><span className="dots"></span><span className="dv">−€2.960<em>VER</em></span></div>
              </div>
              <div className="rv" style={{ "marginTop": "14px" }}>
                <h3 style={{ "font": "800 15px var(--disp)", "marginBottom": "9px" }}>Las 3 trampas del contrato</h3>
                <div className="rep-traps">
                  <div className="trap"><span className="tn">I.</span><div><h5>El precio "desde" €3.900</h5><p>Ese es por 1,5 kWp sin instalación. La casa real de 3 kWp arranca en €7.400 con obra incluida.</p></div></div>
                  <div className="trap"><span className="tn">II.</span><div><h5>La batería que no necesitás</h5><p>Con excedentes remunerados, la batería se paga sola solo si la luz nocturna supera el 45% de tu consumo.</p></div></div>
                  <div className="trap"><span className="tn">III.</span><div><h5>El boletín "incluido"</h5><p>Casi nunca lo está. Si tu tablero es viejo, sumá €350–600 antes de firmar nada.</p></div></div>
                </div>
              </div>
              <div className="rep-foot rv" style={{ "marginTop": "14px" }}>
                <div className="fk"><Ic i={BadgeCheck} className="ic" />Fuentes verificadas esta semana</div>
                <div className="fnote"><b>1</b><span>IDAE — Atlas de radiación solar, producción media anual por comunidad.</span></div>
                <div className="fnote"><b>2</b><span>Galicia entra en autoconsumo solo con apoyo de red: el 28% de su energía.</span></div>
                <div className="fnote"><b>3</b><span>OMIE — precio pool de agosto: €84,2/MWh de media.</span></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Download} className="ic" />Guardar informe</button>
                <button className="btn ghost"><Ic i={CircleHelp} className="ic" />Preguntarme más</button>
              </div>
      </div>
    </>
  );
}
