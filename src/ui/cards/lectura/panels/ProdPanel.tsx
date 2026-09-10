/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-prod — port visual del catálogo.
 * Card type real: product_analysis
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  BadgeCheck,
  Coffee,
  Droplets,
  SprayCan,
  Volume2,
  ThumbsUp,
  Check,
  ThumbsDown,
  CircleAlert,
  ShoppingCart,
  Scale,
} from "lucide-react";

import "./p-prod.css";

export function ProdPanel() {
  return (
    <>
      <div id="p-prod" className="lcr-panel">
      <div className="prs-head rv">
                <h1><small>Veredicto de compra</small>Cafetera De'Longhi<br />Magnifica Evo</h1>
                <p>La que recomiendo de las 14 que analicé para tu cocina y tu café de todos los días.</p>
              </div>
              <div className="prs-photo rv">
                <img src="/stitch/outfits/prod-espresso.jpg" alt="Cafetera espresso Magnifica Evo" />
                <div className="veil"></div>
                <div className="in">
                  <div>
                    <span className="k">La máquina</span>
                    <h3>Magnifica Evo · beige</h3>
                  </div>
                  <div className="price"><small>€419</small><b>€329</b></div>
                </div>
              </div>
              <div className="prs-hero rv">
                <div className="prs-dial">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#eee8f8" strokeWidth="11" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#p-prod-prsG)" strokeWidth="11" strokeLinecap="round" strokeDasharray="327" strokeDashoffset="42" />
                    <defs><linearGradient id="p-prod-prsG" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#4BDD8C" /><stop offset="1" stopColor="#22B35F" />
                    </linearGradient></defs>
                  </svg>
                  <div className="dval"><b>8,7</b><span>SCORE</span></div>
                </div>
                <div className="prs-facts">
                  <div className="fk">Precio con oferta real</div>
                  <div className="fnm">Magnifica Evo<br />ECAM290</div>
                  <div className="frow2"><span className="fp">€329</span><span className="fpo">€419</span><span style={{ "font": "800 9px var(--sans)", "color": "#05301d", "background": "var(--mint)", "padding": "3px 7px", "borderRadius": "6px" }}>−21%</span></div>
                  <span className="stamp"><Ic i={BadgeCheck} className="ic" style={{ "fontSize": "11px" }} />COMPRA RECOMENDADA</span>
                </div>
              </div>
              <div className="prs-specs rv">
                <div className="spec"><div className="sk"><Ic i={Coffee} className="ic" />Espresso</div><div className="sv">9 bar<small> con crema decente</small></div></div>
                <div className="spec"><div className="sk"><Ic i={Droplets} className="ic" />Vapor</div><div className="sv">Sí<small> para latte</small></div></div>
                <div className="spec"><div className="sk"><Ic i={SprayCan} className="ic" />Limpieza</div><div className="sv">Auto<small> cada 200 cafés</small></div></div>
                <div className="spec"><div className="sk"><Ic i={Volume2} className="ic" />Ruido</div><div className="sv">62 dB<small> tipo office</small></div></div>
              </div>
              <div className="prs-pc rv">
                <div className="pc-col" style={{ "background": "var(--mint-soft)", "border": "1px solid #c9edda" }}>
                  <h4 style={{ "color": "var(--mint-ink)" }}><Ic i={ThumbsUp} className="ic" style={{ "fontSize": "14px" }} />Por qué sí</h4>
                  <li><Ic i={Check} className="ic" style={{ "color": "var(--mint-ink)" }} />Molinillo cónico: el café de especialidad rinde</li>
                  <li><Ic i={Check} className="ic" style={{ "color": "var(--mint-ink)" }} />La limpieza automática es real, no marketing</li>
                </div>
                <div className="pc-col" style={{ "background": "#fdecee", "border": "1px solid #f7ccd4" }}>
                  <h4 style={{ "color": "var(--rose-ink)" }}><Ic i={ThumbsDown} className="ic" style={{ "fontSize": "14px" }} />Por qué dudar</h4>
                  <li><Ic i={CircleAlert} className="ic" style={{ "color": "var(--rose-ink)" }} />El vapor tarda 40 s — lento para 2 cafés</li>
                  <li><Ic i={CircleAlert} className="ic" style={{ "color": "var(--rose-ink)" }} />2,1 kg en contra: pesada para mover</li>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={ShoppingCart} className="ic" />Comprar en €329</button>
                <button className="btn ghost"><Ic i={Scale} className="ic" />Ver alternativa</button>
              </div>
      </div>
    </>
  );
}
