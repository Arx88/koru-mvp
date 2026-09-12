/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-travel — port visual del catálogo.
 * Card type real: travel_plan
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Camera,
  Plane,
  Sun,
  Wallet,
  Building2,
  Coffee,
  Landmark,
  Star,
  Utensils,
  Martini,
  Sparkles,
  CalendarCheck,
  CalendarDays,
} from "lucide-react";

import "./p-travel.css";

export function TravelPanel() {
  return (
    <>
      <div id="p-travel" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--honey-ink)", "marginBottom": "5px" }}>Madrid · 3 días · septiembre</small>Tu itinerario,<br />día por día</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Cambiá de pestaña para ver cada día. El ritmo es tuyo: nada de madrugones.</p>
              </div>
              <div className="tv-hero rv">
                <img src="/stitch/outfits/travel-madrid.jpg" alt="Cibeles, Madrid al atardecer" />
                <div className="veil"></div>
                <span className="shot"><Ic i={Camera} className="ic" />Cibeles · 19:42</span>
                <div className="in">
                  <span className="k">Tu próximo destino</span>
                  <h3>Madrid al atardecer</h3>
                  <div className="m">
                    <span><Ic i={Plane} className="ic" />directo 2h 10m</span>
                    <span><Ic i={Sun} className="ic" />26–29°</span>
                    <span><Ic i={Wallet} className="ic" />€120/día</span>
                  </div>
                </div>
              </div>
              <div className="it-days rv">
                <div className="it-day on"><span>Viernes</span><b>Día 1</b></div>
                <div className="it-day"><span>Sábado</span><b>Día 2</b></div>
                <div className="it-day"><span>Domingo</span><b>Día 3</b></div>
              </div>
              <div className="it-card rv">
                <div className="it-city">
                  <span className="ci"><Ic i={Building2} className="ic" />Centro y Austrias</span>
                  <span className="w"><Ic i={Sun} className="ic" />28°</span>
                </div>
                <div className="mom" style={{ "borderTop": "0" }}>
                  <span className="mk"><b>10:00</b>mañana</span>
                  <div className="mc"><span className="t"><Ic i={Coffee} className="ic" />Café en el Passatge</span><p>Churros con la 1 menos fila: antes de las 10:30 es tu ventana.</p></div>
                </div>
                <div className="mom star">
                  <span className="mk"><b>12:30</b>mediodía</span>
                  <div className="mc"><span className="t"><Ic i={Landmark} className="ic" />Prado · 2 h quirúrgicas<span className="star-ic"><Ic i={Star} className="ic" />imperdible</span></span><p>Te marqué la ruta: Goya, Velázquez y la pieza que querías ver. Salís a las 14:30.</p></div>
                </div>
                <div className="mom">
                  <span className="mk"><b>15:30</b>tarde</span>
                  <div className="mc"><span className="t"><Ic i={Utensils} className="ic" />Comida: Casa Mono</span><p>Reservada ya. Paella para 2, sentados afuera si el calor lo permite.</p></div>
                </div>
                <div className="mom">
                  <span className="mk"><b>20:00</b>noche</span>
                  <div className="mc"><span className="t"><Ic i={Martini} className="ic" />Vermú + de paseo</span><p>Sin plan fijo: la Latina a esta hora se camina sola. Te dejo 3 barras por si quieres parar.</p></div>
                </div>
                <div className="it-food">
                  <Ic i={Sparkles} className="ic" />
                  <p><b>El truco del viernes:</b> entradas del Prado compradas ya — la fila de taquilla a mediodía te come 40 min.</p>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CalendarCheck} className="ic" />Guardar día 1</button>
                <button className="btn ghost"><Ic i={CalendarDays} className="ic" />Quiero otro ritmo</button>
              </div>
      </div>
    </>
  );
}
