/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-book — port visual del catálogo.
 * Card type real: book_review
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  BookOpen,
  Quote,
  Clock,
  Lightbulb,
  ShoppingBag,
} from "lucide-react";

import "./p-book.css";

export function BookPanel() {
  return (
    <>
      <div id="p-book" className="lcr-panel">
      <div className="bk-head rv">
                <h1><small>Tu lectura de noche</small>El libro que<br />dejaste a mitad</h1>
                <p>Te lo empecé a buscar por la cita que compartiste. Retomalo: vas bien encaminada.</p>
              </div>
              <div className="bk-night rv">
                <img src="/stitch/outfits/book-stack.jpg" alt="Libros con luz de lectura" />
                <span className="open"><Ic i={BookOpen} className="ic" />marcador en pág. 142</span>
                <div className="in">
                  <span className="k">Estás leyendo</span>
                  <h3>Los días del venado</h3>
                  <span className="a">Nicolás Petrone · 2023 · 288 páginas</span>
                </div>
              </div>
              <div className="bk-prog rv">
                <div className="prow2"><b>62%</b><span>leído · quedan 109 páginas</span></div>
                <div className="bar2"><i></i></div>
                <div className="meta2"><span>pág. 142 de 228</span><span>retomás el martes</span></div>
              </div>
              <div className="bk-quote rv">
                <span className="qi"><Ic i={Quote} className="ic" /></span>
                <p>“La memoria no es un archivo: es un perro que duerme donde quiere.”</p>
                <span>— la frase que subrayaste dos veces</span>
              </div>
              <div className="bk-rows rv">
                <div className="bk-row"><div className="ic" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}><Ic i={Clock} className="ic" /></div><div className="tx"><b>Te queda 1 semana</b><span>al ritmo de 15 páginas por noche</span></div><span className="nxt">RITMO OK</span></div>
                <div className="bk-row"><div className="ic" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}><Ic i={Lightbulb} className="ic" /></div><div className="tx"><b>Por qué te va a gustar el final</b><span>sin spoilers: el perro del epígrafe vuelve</span></div></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BookOpen} className="ic" />Seguir leyendo</button>
                <button className="btn ghost"><Ic i={ShoppingBag} className="ic" />Comprar el próximo</button>
              </div>
      </div>
    </>
  );
}
