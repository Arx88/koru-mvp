/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-rest — port visual del catálogo.
 * Card type real: restaurant_synthesis
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Star,
  Award,
  Utensils,
  Clock,
  PiggyBank,
  Radar,
  Route,
} from "lucide-react";

import "./p-rest.css";

export function RestPanel() {
  return (
    <>
      <div id="p-rest" className="lcr-panel">
      <div className="pod-head rv">
                <h1><small>La parrilla de hoy</small>Tres que no fallan,<br />una que ganó</h1>
                <p>Puntaje promedio de 2.400 reseñas reales, cruzado con tu historial de gustos.</p>
              </div>
              <div className="pod rv">
                <div className="pod-l1">
                  <div className="medal"><span className="mno">Nº</span><b>1</b></div>
                  <div style={{ "minWidth": "0" }}>
                    <div className="nm">Don Julio</div>
                    <div className="sc"><b>9,2</b><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /></div>
                    <div className="meta">Palermo Soho · 12 min caminando · vacío y mollejas</div>
                  </div>
                  <div className="wait"><b>25'</b><span>de espera</span></div>
                </div>
                <div className="pod-others">
                  <div className="pod-o">
                    <div className="rank"><Ic i={Award} className="ic" style={{ "fontSize": "13px", "color": "#cd9d5e" }} />2</div>
                    <div className="nm">La Cabrera</div>
                    <div className="sc">9,0 <small>· 30' espera</small></div>
                  </div>
                  <div className="pod-o">
                    <div className="rank"><Ic i={Award} className="ic" style={{ "fontSize": "13px", "color": "#cd9d5e" }} />3</div>
                    <div className="nm">Cabaña Las Lilas</div>
                    <div className="sc">8,8 <small>· mesa ya</small></div>
                  </div>
                </div>
              </div>
              
              <div className="dish rv" style={{ "marginTop": "14px" }}>
                <div className="dish-ph">
                  <img src="/stitch/outfits/rest-steak.jpg" alt="Ojo de bife con romero" />
                  <span className="dish-tag"><Ic i={Utensils} className="ic" />el plato de la noche</span>
                  <div className="dish-cap">
                    <b>Ojo de bife · Don Julio</b>
                    <span>a punto, con romero y papas noisette — el que siempre pedís</span>
                  </div>
                </div>
              </div>
              <div className="rv" style={{ "marginTop": "14px" }}>
                <h3 style={{ "font": "800 15px var(--disp)", "marginBottom": "9px" }}>Lo que nadie te dice</h3>
                <div className="pod-tips">
                  <div className="prow"><div className="pic" style={{ "background": "var(--honey-soft)", "color": "var(--honey-ink)" }}><Ic i={Clock} className="ic" /></div><div className="pt"><b>Don Julio sin fila</b><span>Si vas a las 19:15 entramás directo — después de las 21 se hace eterno.</span></div><span className="chip" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}>TIP</span></div>
                  <div className="prow"><div className="pic" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}><Ic i={PiggyBank} className="ic" /></div><div className="pt"><b>La Cabrera de mediodía</b><span>Menú ejecutivo a €18 con entrada y postre — de noche es el doble.</span></div><span className="chip" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}>€€</span></div>
                  <div className="prow"><div className="pic" style={{ "background": "var(--rose-ink)", "color": "#fff" }}><Ic i={Radar} className="ic" /></div><div className="pt"><b>Las Lilas está con mesa</b><span>Ahora mismo tenés disponibilidad — las otras dos tienen fila a esta hora.</span></div><span className="chip" style={{ "background": "#fdecee", "color": "var(--rose-ink)" }}>AHORA</span></div>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Utensils} className="ic" />Reservar Don Julio</button>
                <button className="btn ghost"><Ic i={Route} className="ic" />Ver otras</button>
              </div>
      </div>
    </>
  );
}
