/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-health — port visual del catálogo.
 * Card type real: health_reminder
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Pill,
  Flame,
  CircleCheck,
  BellRing,
  Package,
  ShoppingCart,
} from "lucide-react";

import "./p-health.css";

export function HealthPanel() {
  return (
    <>
      <div id="p-health" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--honey-ink)", "marginBottom": "5px" }}>Vitamina D · 2000 UI</small>Una por noche,<br />12 días seguidos</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>El organizador muestra la semana — hoy queda el último casillero por tomar.</p>
              </div>
              <div className="po-hero rv">
                <div className="po-top">
                  <div className="med">
                    <div className="cic2"><Ic i={Pill} className="ic" /></div>
                    <div><b>1 comprimido · con la cena</b><small>21:00 · el frasco está en la puerta del fondo</small></div>
                  </div>
                  <span className="po-flame"><Ic i={Flame} className="ic" />racha 12</span>
                </div>
                <div className="po-strip">
                  <div className="po-box taken"><span className="d">L</span><span className="pills"><i></i></span><span className="st2">tomada</span></div>
                  <div className="po-box taken"><span className="d">M</span><span className="pills"><i></i></span><span className="st2">tomada</span></div>
                  <div className="po-box taken"><span className="d">X</span><span className="pills"><i></i></span><span className="st2">tomada</span></div>
                  <div className="po-box taken"><span className="d">J</span><span className="pills"><i></i></span><span className="st2">tomada</span></div>
                  <div className="po-box taken"><span className="d">V</span><span className="pills"><i></i></span><span className="st2">tomada</span></div>
                  <div className="po-box taken"><span className="d">S</span><span className="pills"><i></i></span><span className="st2">tomada</span></div>
                  <div className="po-box today"><span className="d">D</span><span className="pills"><i></i></span><span className="st2">hoy</span></div>
                </div>
                <div className="po-dose">
                  <div className="dz"><Ic i={CircleCheck} className="ic" style={{ "color": "var(--mint-ink)" }} /><div><b>Con comida</b><span>mejor absorción con grasas</span></div></div>
                  <div className="dz"><Ic i={BellRing} className="ic" style={{ "color": "var(--sky-ink)" }} /><div><b>Aviso 21:00</b><span>suave, no molesto</span></div></div>
                </div>
              </div>
              <div className="po-stock rv">
                <h4><Ic i={Package} className="ic" />El frasco</h4>
                <div className="po-bar"><i></i></div>
                <div className="tx"><span>Quedan <b>38 de 60</b> · para 8 días</span><span>reposición 20 sep</span></div>
                <div className="po-buy">
                  <Ic i={ShoppingCart} className="ic" />
                  <p>Mismo laboratorio · €9,50 en Farmacity · te lo agrego al pedido del <b>18</b> junto con lo demás.</p>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Pill} className="ic" />Ya tomé la de hoy</button>
                <button className="btn ghost"><Ic i={ShoppingCart} className="ic" />Comprar más</button>
              </div>
      </div>
    </>
  );
}
