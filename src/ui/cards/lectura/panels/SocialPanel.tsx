/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-social — port visual del catálogo.
 * Card type real: social_interaction
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Cake,
  Clock,
  MapPin,
  Users,
  Gift,
  Disc3,
  Waves,
  CalendarCheck,
  ShoppingBag,
} from "lucide-react";

import "./p-social.css";

export function SocialPanel() {
  return (
    <>
      <div id="p-social" className="lcr-panel">
      <div className="ev-head rv">
                <h1><small>El evento de la semana</small>El cumple<br />de Juan</h1>
                <p>Guardé la fecha, coordenadas y hasta la idea de regalo que se te ocurrió a las 2 am.</p>
              </div>
              <div className="ev-cal rv">
                <div className="cal-top">
                  <span className="mo">Septiembre 2025</span>
                  <span className="cd"><Ic i={Cake} className="ic" style={{ "fontSize": "13px" }} />en 5 días</span>
                </div>
                <div className="cal-grid">
                  <span className="dw">L</span><span className="dw">M</span><span className="dw">X</span><span className="dw">J</span><span className="dw">V</span><span className="dw">S</span><span className="dw">D</span>
                  <span className="dd">1</span><span className="dd">2</span><span className="dd">3</span><span className="dd">4</span><span className="dd">5</span><span className="dd">6</span><span className="dd here">7</span>
                  <span className="dd">8</span><span className="dd">9</span><span className="dd">10</span><span className="dd">11</span><span className="dd big">12</span><span className="dd">13</span><span className="dd">14</span>
                  <span className="dd">15</span><span className="dd">16</span><span className="dd">17</span><span className="dd">18</span><span className="dd">19</span><span className="dd">20</span><span className="dd">21</span>
                  <span className="dd">22</span><span className="dd">23</span><span className="dd">24</span><span className="dd">25</span><span className="dd">26</span><span className="dd">27</span><span className="dd">28</span>
                  <span className="dd">29</span><span className="dd">30</span>
                </div>
              </div>
              <div className="ev-facts rv">
                <div className="ev-fact"><div className="fk"><Ic i={Clock} className="ic" />Cuándo</div><div className="fv">Sáb 12 · 21:00</div><div className="fs">termina tarde, siempre</div></div>
                <div className="ev-fact"><div className="fk"><Ic i={MapPin} className="ic" />Dónde</div><div className="fv">Casa de Juan</div><div className="fs">Palermo · te paso a buscar</div></div>
                <div className="ev-fact wide">
                  <Ic i={Users} className="ic big" />
                  <div className="fv">12 confirmados de 15</div>
                  <div className="fk" style={{ "margin": "0", "color": "var(--pink-ink)" }}>faltan confirmar 3</div>
                </div>
              </div>
              <div className="ev-gift rv">
                <h4><Ic i={Gift} className="ic" />El regalo que tenías pensado</h4>
                <div className="gopt win">
                  <div className="gic" style={{ "background": "var(--mint-soft)" }}><Ic i={Disc3} className="ic" style={{ "color": "var(--mint-ink)" }} /></div>
                  <div className="gt"><b>Vinilo de Wos, edición numerada</b><span>quedan 2 · Bar Aparte, Palermo</span></div>
                  <span className="gpr">€38</span><span className="gtag">ELEGIDO</span>
                </div>
                <div className="gopt">
                  <div className="gic" style={{ "background": "var(--paper3)" }}><Ic i={Waves} className="ic" style={{ "color": "var(--ink-dim)" }} /></div>
                  <div className="gt"><b>Excursión de kayak</b><span>si el 12 se complicaba la logística</span></div>
                  <span className="gpr">€60</span>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CalendarCheck} className="ic" />Confirmo que voy</button>
                <button className="btn ghost"><Ic i={ShoppingBag} className="ic" />Reservar el vinilo</button>
              </div>
      </div>
    </>
  );
}
