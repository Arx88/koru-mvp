/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-saved — port visual del catálogo.
 * Card type real: delivery
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Check,
  BellRing,
  Pencil,
} from "lucide-react";

import "./p-saved.css";

export function SavedPanel() {
  return (
    <>
      <div id="p-saved" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--mint-ink)", "marginBottom": "5px" }}>Sin pasos extra</small>Ya quedó<br />en tu agenda</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>No te pedí confirmar nada: lo guardé, avisé a los que correspondía y esto es el comprobante.</p>
              </div>
              <div className="tkk-hero rv">
                <span className="cutl"></span><span className="cutr"></span>
                <div className="tkk-top">
                  <div className="ok"><Ic i={Check} className="ic" /></div>
                  <div className="tq">Reservado para 2</div>
                  <div className="ts">Don Julio · sábado 7, 21:15</div>
                </div>
                <span className="tkk-stamp">CONFIRMADO</span>
                <div className="tkk-lines">
                  <div className="trow"><span className="tn">Mesa</span><span className="dots"></span><span className="tv">Patio · junto a la parra</span></div>
                  <div className="trow"><span className="tn">A nombre de</span><span className="dots"></span><span className="tv">Vos</span></div>
                  <div className="trow"><span className="tn">Aviso</span><span className="dots"></span><span className="tv">Sábado 19:30</span></div>
                  <div className="trow"><span className="tn">Cancelación gratis</span><span className="dots"></span><span className="tv">hasta 3 h antes</span></div>
                  <div className="trow total"><span className="tn">Estado</span><span className="dots"></span><span className="tv">LISTO</span></div>
                </div>
                <div className="tkk-code">
                  <div className="bars">
                    <i style={{ "height": "12px" }}></i><i style={{ "height": "22px" }}></i><i style={{ "height": "8px" }}></i><i style={{ "height": "28px" }}></i><i style={{ "height": "16px" }}></i>
                    <i style={{ "height": "24px" }}></i><i style={{ "height": "10px" }}></i><i style={{ "height": "30px" }}></i><i style={{ "height": "14px" }}></i><i style={{ "height": "20px" }}></i>
                    <i style={{ "height": "26px" }}></i><i style={{ "height": "8px" }}></i><i style={{ "height": "18px" }}></i><i style={{ "height": "28px" }}></i><i style={{ "height": "12px" }}></i>
                    <i style={{ "height": "22px" }}></i><i style={{ "height": "16px" }}></i><i style={{ "height": "30px" }}></i><i style={{ "height": "10px" }}></i><i style={{ "height": "24px" }}></i>
                  </div>
                  <div className="cn">DJ-SAB-2115-PM</div>
                </div>
              </div>
              <div className="tkk-note rv">
                <Ic i={BellRing} className="ic" />
                <p>Te aviso el sábado a las 19:30 con tiempo de sobra. Si quieres cambiar la mesa o el horario, dime y lo rehago — <b>el código no cambia</b>.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Check} className="ic" />Perfecto, gracias</button>
                <button className="btn ghost"><Ic i={Pencil} className="ic" />Cambiar algo</button>
              </div>
      </div>
    </>
  );
}
