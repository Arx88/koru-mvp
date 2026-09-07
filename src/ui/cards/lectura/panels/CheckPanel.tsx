/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-check — port visual del catálogo.
 * Card type real: smart_checklist
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Check,
  BellRing,
  ArrowRightLeft,
} from "lucide-react";

import "./p-check.css";

export function CheckPanel() {
  return (
    <>
      <div id="p-check" className="lcr-panel">
      <div className="ck-head rv">
                <h1><small>Tu notebook nueva</small>Lo que falta<br />antes de comprar</h1>
                <p>La dell XPS que vimos cumple 3 de 4 requisitos tuyos — tocá para marcar lo que ya resolviste.</p>
              </div>
              <div className="ck-hero rv">
                <div className="ck-ring">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#eee8f8" strokeWidth="11" />
                    <circle id="p-check-ckarc" cx="60" cy="60" r="52" fill="none" stroke="url(#p-check-ckG)" strokeWidth="11" strokeLinecap="round" strokeDasharray="327" strokeDashoffset="163" />
                    <defs><linearGradient id="p-check-ckG" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#6ee7b7" /><stop offset="1" stopColor="#2f8f6d" />
                    </linearGradient></defs>
                  </svg>
                  <div className="cval"><b id="p-check-ckn">2 / 4</b><span>HECHO</span></div>
                </div>
                <div className="ch-facts" style={{ "flex": "1", "minWidth": "0" }}>
                  <div className="fk">Presupuesto declarado</div>
                  <div className="fnm" style={{ "marginBottom": "7px" }}>Dell XPS 14</div>
                  <div className="ck-budget"><span>Presupuesto</span><b>€1.200</b></div>
                </div>
              </div>
              <div className="ck-list rv">
                <div className="ckitem done"><span className="box"><Ic i={Check} className="ic" /></span><div className="ct"><b>RAM 32 GB verificada</b><span>se puede ampliar después</span></div><span className="cprice">✓</span></div>
                <div className="ckitem done"><span className="box"><Ic i={Check} className="ic" /></span><div className="ct"><b>Garantía internacional</b><span>3 años con accidentes</span></div><span className="cprice">✓</span></div>
                <div className="ckitem"><span className="box"><Ic i={Check} className="ic" /></span><div className="ct"><b>Precio por debajo de €1.200</b><span>hoy está €1.318 — cae con oferta</span></div><span className="cprice">€118</span></div>
                <div className="ckitem"><span className="box"><Ic i={Check} className="ic" /></span><div className="ct"><b>Teclado español físico</b><span>en tienda hay que pedirlo</span></div><span className="cprice">?</span></div>
              </div>
              <div className="ck-barwrap rv">
                <div className="bt"><span>Cuanto falta del presupuesto</span><b id="p-check-ckpct">82%</b></div>
                <div className="ck-btrack"><i id="p-check-ckfill" style={{ "width": "82%" }}></i></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Avisame si baja de 1.200</button>
                <button className="btn ghost"><Ic i={ArrowRightLeft} className="ic" />Alternativa similar</button>
              </div>
      </div>
    </>
  );
}
