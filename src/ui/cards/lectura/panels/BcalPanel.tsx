/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-bcal — port visual del catálogo.
 * Card type real: birthday_calendar
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  CalendarDays,
  User,
  Gift,
  BellRing,
} from "lucide-react";

import "./p-bcal.css";

export function BcalPanel() {
  return (
    <>
      <div id="p-bcal" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--pink-ink)", "marginBottom": "5px" }}>Septiembre · 3 cumpleaños</small>Tres fechas,<br />cero olvidos</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Esta vez con avisos desde una semana antes — marzo no se repite.</p>
              </div>
              <div className="cal2 rv">
                <div className="cal2-top">
                  <span className="mo"><Ic i={CalendarDays} className="ic" />Septiembre</span>
                  <span className="n">3 cumples</span>
                </div>
                <div className="cal2-grid">
                  <span className="dw2">L</span><span className="dw2">M</span><span className="dw2">X</span><span className="dw2">J</span><span className="dw2">V</span><span className="dw2">S</span><span className="dw2">D</span>
                  <span className="day">1</span><span className="day">2</span><span className="day">3</span><span className="day">4</span><span className="day">5</span><span className="day sat">6</span><span className="day today">7</span>
                  <span className="day">8</span><span className="day">9</span><span className="day">10</span><span className="day">11</span><span className="day bday soon">12<span className="dt"><i style={{ "background": "var(--pink-ink)" }}></i></span></span><span className="day sat">13</span><span className="day sat">14</span>
                  <span className="day">15</span><span className="day">16</span><span className="day">17</span><span className="day">18</span><span className="day">19</span><span className="day sat">20</span><span className="day sat">21</span>
                  <span className="day">22</span><span className="day">23</span><span className="day">24</span><span className="day">25</span><span className="day">26</span><span className="day bday">27<span className="dt"><i style={{ "background": "var(--sky-ink)" }}></i></span></span><span className="day sat">28</span>
                  <span className="day">29</span><span className="day bday">30<span className="dt"><i style={{ "background": "var(--mint-ink)" }}></i></span></span>
                </div>
              </div>
              <div className="cal2-legend rv">
                <div className="l"><Ic i={User} className="ic" style={{ "color": "var(--pink-ink)" }} /><div><b>Juan</b><span>12 · en 5 días</span></div></div>
                <div className="l"><Ic i={User} className="ic" style={{ "color": "var(--sky-ink)" }} /><div><b>Sofi</b><span>27 · en 3 sem</span></div></div>
                <div className="l"><Ic i={User} className="ic" style={{ "color": "var(--mint-ink)" }} /><div><b>Papá</b><span>30 · fin de mes</span></div></div>
              </div>
              <div className="cal2-buy rv">
                <Ic i={Gift} className="ic" />
                <p>Para Juan ya tienes el vinilo elegido (€38). Para Sofi y Papá te propongo ideas <b>el 20</b> — con margen para envíos normales.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Activar los 3 avisos</button>
                <button className="btn ghost"><Ic i={Gift} className="ic" />Ver ideas de regalo</button>
              </div>
      </div>
    </>
  );
}
