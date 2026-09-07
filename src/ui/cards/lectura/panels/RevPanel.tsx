/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-rev — port visual del catálogo.
 * Card type real: review_score
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  BadgeCheck,
  Star,
  ThumbsUp,
  Camera,
  BatteryCharging,
  Thermometer,
  Cable,
  ShoppingCart,
  Columns2,
} from "lucide-react";

import "./p-rev.css";

export function RevPanel() {
  return (
    <>
      <div id="p-rev" className="lcr-panel">
      <div className="rh-head rv">
                <h1><small>2.417 reseñas analizadas</small>iPhone 16:<br />qué dice la gente</h1>
                <p>Leí las 2.417 y agrupé por qué lo aman y por qué se enojan. Spoiler: nadie se queja de lo mismo.</p>
              </div>
              <div className="rh-photo rv">
                <img src="/stitch/outfits/prod-phone.jpg" alt="iPhone 16" />
                <div className="in">
                  <div>
                    <span className="k">El reseñado</span>
                    <h3>iPhone 16 · 128 GB</h3>
                  </div>
                  <span className="ver"><Ic i={BadgeCheck} className="ic" />2.417 reseñas</span>
                </div>
              </div>
              <div className="rh-hist rv">
                <div className="rh-top">
                  <div className="rh-avg">
                    <b>4,6</b>
                    <div className="st">
                      <Ic i={Star} className="ic" /><Ic i={Star} className="ic" />
                      <Ic i={Star} className="ic" /><Ic i={Star} className="ic" />
                      <Ic i={Star} className="ic off" />
                    </div>
                  </div>
                  <div className="rh-sum">
                    <span className="pct"><Ic i={ThumbsUp} className="ic" style={{ "fontSize": "12px" }} />78% lo recomienda</span><br />
                    2.417 reseñas verificadas en 9 tiendas. La nota cae por un solo motivo recurrente.
                  </div>
                </div>
                <div className="hbars">
                  <div className="hb"><span className="hs">5★</span><div className="htrack"><i style={{ "width": "62%" }}></i></div><span className="hn">1.498</span></div>
                  <div className="hb"><span className="hs">4★</span><div className="htrack"><i style={{ "width": "26%" }}></i></div><span className="hn">628</span></div>
                  <div className="hb dim"><span className="hs">3★</span><div className="htrack"><i style={{ "width": "8%" }}></i></div><span className="hn">193</span></div>
                  <div className="hb dim"><span className="hs">2★</span><div className="htrack"><i style={{ "width": "3%" }}></i></div><span className="hn">72</span></div>
                  <div className="hb dim"><span className="hs">1★</span><div className="htrack"><i style={{ "width": "1%" }}></i></div><span className="hn">26</span></div>
                </div>
              </div>
              <div className="rh-split rv">
                <div className="rs-col" style={{ "background": "var(--mint-soft)", "border": "1px solid #c9edda" }}>
                  <h4 style={{ "color": "var(--mint-ink)" }}>Lo que aman</h4>
                  <li><Ic i={Camera} className="ic" style={{ "color": "var(--mint-ink)" }} /><span>La cámara nocturna (el 71% lo menciona)</span></li>
                  <li><Ic i={BatteryCharging} className="ic" style={{ "color": "var(--mint-ink)" }} /><span>La batería llega a la noche (64%)</span></li>
                </div>
                <div className="rs-col" style={{ "background": "#fdecee", "border": "1px solid #f7ccd4" }}>
                  <h4 style={{ "color": "var(--rose-ink)" }}>Lo que critican</h4>
                  <li><Ic i={Thermometer} className="ic" style={{ "color": "var(--rose-ink)" }} /><span>Se calienta jugando (33%)</span></li>
                  <li><Ic i={Cable} className="ic" style={{ "color": "var(--rose-ink)" }} /><span>Extraño el cargador en caja</span></li>
                </div>
              </div>
              <div className="rh-quotes rv">
                <div className="quote">
                  <span className="qmark">“</span>
                  <p>Las fotos de noche con los chicos en el parque salieron nítidas por primera vez. Solo por eso ya valió.</p>
                  <div className="qa"><span className="qic" style={{ "background": "var(--mint-ink)" }}>MR</span><span>María R. · compró hace 2 meses</span><span className="qst"><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /></span></div>
                </div>
                <div className="quote">
                  <span className="qmark">“</span>
                  <p>Tres estrellas por el calentamiento jugando. El resto impecable, pero eso me pasa seguido.</p>
                  <div className="qa"><span className="qic" style={{ "background": "var(--honey-ink)" }}>JD</span><span>Jonás D. · gamer, compró en junio</span><span className="qst"><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /></span></div>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={ShoppingCart} className="ic" />Me convence, comprar</button>
                <button className="btn ghost"><Ic i={Columns2} className="ic" />Ver la alternativa</button>
              </div>
      </div>
    </>
  );
}
