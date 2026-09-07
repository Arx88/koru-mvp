/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-outfit — port visual del catálogo.
 * Card type real: outfit
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Thermometer,
  Shirt,
  BadgeCheck,
  Watch,
  Wind,
  Sun,
  Briefcase,
  Check,
  Shuffle,
} from "lucide-react";

import "./p-outfit.css";

export function OutfitPanel() {
  return (
    <>
      <div id="p-outfit" className="lcr-panel">
      <div className="lk-head rv">
                <h1><small>Look para hoy · 26°</small>Lo que yo<br />te pondría</h1>
                <p>Viendo tu guardarropa y el clima que viene esta tarde: fresco de día, fresquito a la noche.</p>
              </div>
              <div className="lk-board rv">
                <div className="lk-cond">
                  <span className="cc"><Ic i={Thermometer} className="ic" />26° ahora · 19° a la noche</span>
                  <b>TONO TIERRA</b>
                </div>
                <div className="lk-hero">
                  <img src="/stitch/outfits/outfit-man-2.jpg" alt="Look completo del día" />
                  <span className="fit"><Ic i={Shirt} className="ic" />el look completo</span>
                  <div className="brand">
                    <span className="b1"><Ic i={BadgeCheck} className="ic" />look armado por Koru</span>
                    <span className="b2">3 piezas · 1 detalle</span>
                  </div>
                </div>
                <div className="lk-grid">
                  <div className="lk-tile ph"><div className="im"><img src="/stitch/outfits/prod-jacket.jpg" alt="Campera denim" /><span className="sw" style={{ "background": "#5b7a9d" }}></span></div><div className="tx"><div className="k">Capa</div><div className="n">Campera denim</div><div className="c">para las 20 h, no antes</div></div></div>
                  <div className="lk-tile ph"><div className="im"><img src="/stitch/outfits/prod-jeans-2.jpg" alt="Pantalón azul oscuro" /><span className="sw" style={{ "background": "#31425c" }}></span></div><div className="tx"><div className="k">Abajo</div><div className="n">Pantalón azul oscuro</div><div className="c">el recto, no el skinny</div></div></div>
                  <div className="lk-tile"><span className="sw" style={{ "background": "#f5efe6" }}></span><div className="tic"><Ic i={Shirt} className="ic" /></div><div className="k">Arriba</div><div className="n">Camisa lino crema</div><div className="c">la que va planchada mejor</div></div>
                  <div className="lk-tile"><span className="sw" style={{ "background": "#e8e2d6" }}></span><div className="tic"><Ic i={Watch} className="ic" /></div><div className="k">Detalle</div><div className="n">Reloj correa clara</div><div className="c">compite con el denim — bien</div></div>
                  <div className="lk-tile shoe ph"><div className="im"><img src="/stitch/outfits/prod-sneakers.jpg" alt="Zapatillas off-white" /></div><div className="tx"><span className="sw" style={{ "background": "#efece4" }}></span><div className="k">Pies</div><div className="n">Zapatillas off-white</div><div className="c">con este calor ni lo dudes — no medias cortas por favor</div></div></div>
                </div>
              </div>
              <div className="lk-notes rv">
                <div className="lnote"><div className="lic" style={{ "background": "var(--sky-soft)" }}><Ic i={Wind} className="ic" style={{ "color": "var(--sky-ink)" }} /></div><p><b>Aire de 14 a 17 h:</b> la camisa sola va bien. La campera dejala en el auto o atada a la cintura.</p></div>
                <div className="lnote"><div className="lic" style={{ "background": "var(--honey-soft)" }}><Ic i={Sun} className="ic" style={{ "color": "var(--honey-ink)" }} /></div><p><b>Sol fuerte a las 16:</b> el lino color crema marca transpiración — llevá la camisa celeste de repuesto.</p></div>
              </div>
              <div className="lk-alts rv">
                <h3>Si querés otra línea</h3>
                <div className="lk-alt"><div className="aic"><Ic i={Shirt} className="ic" /></div><div><b>Versión relaxed</b><br /><span>remera oversize blanca + jeans claros</span></div><span className="go">ver →</span></div>
                <div className="lk-alt"><div className="aic"><Ic i={Briefcase} className="ic" /></div><div><b>Versión estructurada</b><br /><span>chaleco beige + pantalón de sastre</span></div><span className="go">ver →</span></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Check} className="ic" />Este look, me gusta</button>
                <button className="btn ghost"><Ic i={Shuffle} className="ic" />Otra combinación</button>
              </div>
      </div>
    </>
  );
}
