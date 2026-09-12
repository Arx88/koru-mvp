/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-alarm — port visual del catálogo.
 * Card type real: alarm
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Dumbbell,
  Brain,
  CheckCheck,
  SlidersHorizontal,
} from "lucide-react";

import "./p-alarm.css";

export function AlarmPanel() {
  return (
    <>
      <div id="p-alarm" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--honey-ink)", "marginBottom": "5px" }}>Alarma creada</small>Suena a las 07:00,<br />y está lista</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>No hay nada que confirmar — ya quedó activa. Esto es lo que va a pasar:</p>
              </div>
              <div className="cl-hero rv">
                <div className="cl-face">
                  <span className="tick" style={{ "transform": "rotate(0deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(30deg) translateX(-50%)" }}></span>
                  <span className="tick big" style={{ "transform": "rotate(60deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(90deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(120deg) translateX(-50%)" }}></span>
                  <span className="tick big" style={{ "transform": "rotate(150deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(180deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(210deg) translateX(-50%)" }}></span>
                  <span className="tick big" style={{ "transform": "rotate(240deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(270deg) translateX(-50%)" }}></span>
                  <span className="tick" style={{ "transform": "rotate(300deg) translateX(-50%)" }}></span>
                  <span className="tick big" style={{ "transform": "rotate(330deg) translateX(-50%)" }}></span>
                  <span className="h"></span><span className="m"></span><span className="s"></span><span className="cap"></span>
                  <span className="ampm">AM</span>
                </div>
                <div className="lbl"><Ic i={Dumbbell} className="ic" />Gym — lunes a viernes</div>
                <div className="cl-days">
                  <span className="on">L</span><span className="on">M</span><span className="on">X</span><span className="on">J</span><span className="on">V</span><span>S</span><span>D</span>
                </div>
                <div className="sub2">Suena 1 vez · snooze de 5 min · vibración suave</div>
              </div>
              <div className="cl-note rv">
                <div className="nic"><Ic i={Brain} className="ic" /></div>
                <div className="nt"><b>La nota de Michi</b><span>Te agendé el gym 30 min después de la alarma — así no tienes que pensarlo a las 7 de la mañana.</span></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CheckCheck} className="ic" />Perfecto</button>
                <button className="btn ghost"><Ic i={SlidersHorizontal} className="ic" />Editar</button>
              </div>
      </div>
    </>
  );
}
