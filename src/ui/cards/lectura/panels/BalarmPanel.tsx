/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-balarm — port visual del catálogo.
 * Card type real: birthday_alarm
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Truck,
  Users,
  Check,
  SlidersHorizontal,
} from "lucide-react";

import "./p-balarm.css";

export function BalarmPanel() {
  return (
    <>
      <div id="p-balarm" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--pink-ink)", "marginBottom": "5px" }}>Aviso activado</small>El cumple de Juan,<br />bajo control</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>El anillo muestra cuánto falta — se cierra solo a medida que se acerca el día.</p>
              </div>
              <div className="cd-hero rv">
                <div className="cd-ring">
                  <svg viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r="64" fill="none" stroke="#fbd9e6" strokeWidth="13" />
                    <circle cx="75" cy="75" r="64" fill="none" stroke="url(#p-balarm-cdG)" strokeWidth="13" strokeLinecap="round" strokeDasharray="402" strokeDashoffset="115" />
                    <defs><linearGradient id="p-balarm-cdG" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#ff8fb8" /><stop offset="1" stopColor="#d6497f" />
                    </linearGradient></defs>
                  </svg>
                  <div className="cv"><b>5</b><span>DÍAS</span></div>
                </div>
                <div className="lbl">sábado 12 · 21:00<small>el jueves 10 a las 10:00 te cae el primer aviso</small></div>
                <div className="cd-when">
                  <span className="w on">1 SEM</span><span className="w on">1 DÍA</span><span className="w on">ESE DÍA</span><span className="w">2 H</span>
                </div>
              </div>
              <div className="cd-tips rv">
                <div className="cd-tip"><div className="cic" style={{ "background": "var(--mint-soft)" }}><Ic i={Truck} className="ic" style={{ "color": "var(--mint-ink)" }} /></div><div className="ct2"><b>Con 5 días alcanza el envío normal</b><span>ahorrás €4,90 del exprés si comprás antes del jueves</span></div></div>
                <div className="cd-tip"><div className="cic" style={{ "background": "var(--sky-soft)" }}><Ic i={Users} className="ic" style={{ "color": "var(--sky-ink)" }} /></div><div className="ct2"><b>Maru ya tiene un regalo pensado</b><span>conviene coordinar antes de comprar dos veces lo mismo</span></div></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Check} className="ic" />Así está perfecto</button>
                <button className="btn ghost"><Ic i={SlidersHorizontal} className="ic" />Ajustar avisos</button>
              </div>
      </div>
    </>
  );
}
