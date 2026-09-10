/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-money — port visual del catálogo.
 * Card type real: money_summary
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  TrendingDown,
  House,
  Utensils,
  TramFront,
  Gamepad2,
  Sparkles,
  PiggyBank,
  Receipt,
} from "lucide-react";

import "./p-money.css";

export function MoneyPanel() {
  return (
    <>
      <div id="p-money" className="lcr-panel">
      <div className="mo-head rv">
                <h1><small>Agosto · tus gastos</small>€1.850 y una<br />buena sorpresa</h1>
                <p>Gastaste 12% menos que julio sin que te lo propusieras. Te muestro dónde se note.</p>
              </div>
              <div className="mo-hero rv">
                <div className="mo-total">
                  <div><div className="tl">Total del mes</div><div className="tv">€1.850</div></div>
                  <span className="mo-delta"><Ic i={TrendingDown} className="ic" />−12% vs julio</span>
                </div>
                <div className="mo-stack">
                  <i style={{ "width": "33%", "background": "#d6497f" }}>Casa</i>
                  <i style={{ "width": "24%", "background": "#B07E00" }}>Comida</i>
                  <i style={{ "width": "16%", "background": "#1A237E" }} aria-label="Transporte"></i>
                  <i style={{ "width": "13%", "background": "#6D52F8" }} aria-label="Ocio"></i>
                  <i style={{ "width": "14%", "background": "#A6ACCB" }} aria-label="Otros"></i>
                </div>
                <div className="mo-legend">
                  <span className="lg"><i style={{ "background": "#d6497f" }}></i>Casa <b>€611</b></span>
                  <span className="lg"><i style={{ "background": "#B07E00" }}></i>Comida <b>€444</b></span>
                  <span className="lg"><i style={{ "background": "#1A237E" }}></i>Transporte <b>€296</b></span>
                  <span className="lg"><i style={{ "background": "#6D52F8" }}></i>Ocio <b>€240</b></span>
                  <span className="lg"><i style={{ "background": "#A6ACCB" }}></i>Otros <b>€259</b></span>
                </div>
              </div>
              <div className="mo-rows rv">
                <div className="mrow"><div className="rt"><div className="ric" style={{ "background": "#fdeaF2" }}><Ic i={House} className="ic" style={{ "color": "var(--pink-ink)" }} /></div><span className="rn">Casa y servicios</span><span className="rv">€611 <small>−3%</small></span></div><div className="rtrack"><i style={{ "width": "100%", "background": "#d6497f" }}></i></div></div>
                <div className="mrow"><div className="rt"><div className="ric" style={{ "background": "var(--honey-soft)" }}><Ic i={Utensils} className="ic" style={{ "color": "var(--honey-ink)" }} /></div><span className="rn">Comida</span><span className="rv">€444 <small>−18%</small></span></div><div className="rtrack"><i style={{ "width": "73%", "background": "#B07E00" }}></i></div></div>
                <div className="mrow"><div className="rt"><div className="ric" style={{ "background": "var(--sky-soft)" }}><Ic i={TramFront} className="ic" style={{ "color": "var(--sky-ink)" }} /></div><span className="rn">Transporte</span><span className="rv">€296 <small>−9%</small></span></div><div className="rtrack"><i style={{ "width": "48%", "background": "#1A237E" }}></i></div></div>
                <div className="mrow"><div className="rt"><div className="ric" style={{ "background": "var(--violet-soft)" }}><Ic i={Gamepad2} className="ic" style={{ "color": "var(--violet-ink)" }} /></div><span className="rn">Ocio</span><span className="rv">€240 <small>−4%</small></span></div><div className="rtrack"><i style={{ "width": "39%", "background": "#6D52F8" }}></i></div></div>
              </div>
              <div className="mo-note rv">
                <Ic i={Sparkles} className="ic" />
                <p>La baja viene de la comida: <b>6 menos deliverys que en julio</b> (€182 de diferencia). No cambiaste de dieta, cambiaste de horario de cena.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={PiggyBank} className="ic" />Fijar tope de septiembre</button>
                <button className="btn ghost"><Ic i={Receipt} className="ic" />Ver movimientos</button>
              </div>
      </div>
    </>
  );
}
