/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-links — port visual del catálogo.
 * Card type real: research_sources
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Link,
  ChefHat,
  Lock,
  ChevronRight,
  Newspaper,
  Globe,
  ShoppingBag,
  Tag,
  Plane,
  MapPin,
  Share2,
} from "lucide-react";

import "./p-links.css";

export function LinksPanel() {
  return (
    <>
      <div id="p-links" className="lcr-panel">
      <div className="lk2-head rv">
                <h1><small>Tus enlaces guardados</small>La lectura<br />pendiente</h1>
                <p>Lo que me pediste guardar para después, con preview real de cada página. Sin carpetas raras: ordenado por utilidad.</p>
              </div>
              <div className="lk2-board rv">
                <div className="lk2-top">
                  <div className="t">
                    <div className="icb"><Ic i={Link} className="ic" /></div>
                    <b>Biblioteca de enlaces</b>
                  </div>
                  <span className="cnt3">24 guardados</span>
                </div>
                <div className="lk2-row pin">
                  <div className="th"><img src="/stitch/outfits/recipe-pasta.jpg" alt="Receta carbonara" /><span className="ty"><Ic i={ChefHat} className="ic" />RECETA</span></div>
                  <div className="tx"><b>La carbonara de Roma que sí es carbonara</b><span><Ic i={Lock} className="ic" />lacucinaitaliana.it · lo abrís 2×/mes</span></div>
                  <span className="go"><Ic i={ChevronRight} className="ic" /></span>
                </div>
                <div className="lk2-row">
                  <div className="th"><img src="/stitch/outfits/news-chip.jpg" alt="Nota de chips" /><span className="ty"><Ic i={Newspaper} className="ic" />NOTA</span></div>
                  <div className="tx"><b>Por qué Europa apuesta fuerte a los chips propios</b><span><Ic i={Globe} className="ic" />eldiario.es · hace 3 días</span></div>
                  <span className="go"><Ic i={ChevronRight} className="ic" /></span>
                </div>
                <div className="lk2-row">
                  <div className="th"><img src="/stitch/outfits/prod-espresso.jpg" alt="Cafetera" /><span className="ty"><Ic i={ShoppingBag} className="ic" />PRODUCTO</span></div>
                  <div className="tx"><b>Magnifica Evo a €329 — histórico mínimo</b><span><Ic i={Tag} className="ic" />tucarro.com · precio baja</span></div>
                  <span className="go"><Ic i={ChevronRight} className="ic" /></span>
                </div>
                <div className="lk2-row">
                  <div className="th"><img src="/stitch/outfits/travel-madrid.jpg" alt="Madrid" /><span className="ty"><Ic i={Plane} className="ic" />VIAJE</span></div>
                  <div className="tx"><b>48 horas en Madrid: la guía sin trampas</b><span><Ic i={MapPin} className="ic" />guianaima.com · para tu viaje</span></div>
                  <span className="go"><Ic i={ChevronRight} className="ic" /></span>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Link} className="ic" />Guardar otro enlace</button>
                <button className="btn ghost"><Ic i={Share2} className="ic" />Compartir lista</button>
              </div>
      </div>
    </>
  );
}
