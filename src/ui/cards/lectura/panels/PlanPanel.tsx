/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-plan — port visual del catálogo.
 * Card type real: plan
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Coffee,
  Brain,
  Utensils,
  Dumbbell,
  Clapperboard,
  Flower,
  CalendarCheck,
  CalendarDays,
} from "lucide-react";

import "./p-plan.css";

export function PlanPanel() {
  return (
    <>
      <div id="p-plan" className="lcr-panel">
      <div className="tl-hero rv">
                <h1><small>Domingo 7 · tus bloques</small>Cinco momentos,<br />nada solapado</h1>
                <p className="sub">Te dejé la tarde con aire — el hueco de 16 a 18 no lo llené a propósito.</p>
              </div>
              <div className="tl rv">
                <div className="tl-ev done work">
                  <span className="tt">08:00</span><span className="tdot"></span>
                  <div className="tcard"><div className="th"><div className="tic" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}><Ic i={Coffee} className="ic" /></div>Desayuno tranquilo</div><div className="td">Café + tostadas · 25 min antes de arrancar</div></div>
                </div>
                <div className="tl-ev done work">
                  <span className="tt">09:00</span><span className="tdot"></span>
                  <div className="tcard"><div className="th"><div className="tic" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}><Ic i={Brain} className="ic" /></div>Trabajo profundo</div><div className="td">2 h sin notificaciones · después me contás</div></div>
                </div>
                <div className="tl-now">
                  <span className="tt">09:41</span>
                  <div className="nline"><span className="nl-tag">AHORA</span></div>
                </div>
                <div className="tl-ev next meal">
                  <span className="tt">13:30</span><span className="tdot"></span>
                  <div className="tcard"><div className="th"><div className="tic" style={{ "background": "var(--honey-soft)", "color": "var(--honey-ink)" }}><Ic i={Utensils} className="ic" /></div>Almuerzo con Sofi<span className="next-tag">SIGUE</span></div><div className="td">Café Oui · reservado para 2 · son 6 cuadras</div></div>
                </div>
                <div className="tl-ev gym">
                  <span className="tt">18:30</span><span className="tdot"></span>
                  <div className="tcard"><div className="th"><div className="tic" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}><Ic i={Dumbbell} className="ic" /></div>Gym · piernas</div><div className="td">1 h · llevalo liviano, venís del almuerzo largo</div></div>
                </div>
                <div className="tl-ev fun">
                  <span className="tt">20:30</span><span className="tdot"></span>
                  <div className="tcard"><div className="th"><div className="tic" style={{ "background": "var(--pink-soft)", "color": "var(--pink-ink)" }}><Ic i={Clapperboard} className="ic" /></div>Cine con Juan</div><div className="td">"El Rojo" 20:45 · compré las entradas ya</div></div>
                </div>
              </div>
              <div className="tl-gap rv">
                <div className="gic"><Ic i={Flower} className="ic" /></div>
                <div><h5>El hueco de 16 a 18 es tuyo</h5><p>Si querés lo dejo libre, o te sugiero algo liviano — siesta, paseo al río, nada urgente.</p></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CalendarCheck} className="ic" />Se ve bien</button>
                <button className="btn ghost"><Ic i={CalendarDays} className="ic" />Mover algo</button>
              </div>
      </div>
    </>
  );
}
