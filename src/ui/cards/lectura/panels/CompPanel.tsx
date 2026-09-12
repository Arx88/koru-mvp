/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-comp — port visual del catálogo.
 * Card type real: comparison
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Headphones,
  Trophy,
  Brain,
  ShoppingCart,
  Swords,
} from "lucide-react";

import "./p-comp.css";

export function CompPanel() {
  return (
    <>
      <div id="p-comp" className="lcr-panel">
      <div className="vs-head rv">
                <h1><small>Tres auriculares · un ganador</small>El duelo de<br />los in-ear</h1>
                <p>Puse los 47 criterios que me pediste en 6 rounds. Ganó uno por KO técnico.</p>
              </div>
              <div className="duel-photo rv">
                <img src="/stitch/outfits/comp-duel.jpg" alt="Auriculares over-ear comparados" />
                <div className="in">
                  <div>
                    <span className="k">Los contendientes</span>
                    <h3>Los tres, sobre tu mesa</h3>
                  </div>
                  <span className="vs-photo">VS</span>
                </div>
              </div>
              <div className="duel rv">
                <span className="vs-badge">VS</span>
                <div className="duel-sides">
                  <div className="dside win">
                    <div className="dph" style={{ "background": "var(--mint-soft)" }}><Ic i={Headphones} className="ic" style={{ "color": "var(--mint-ink)" }} /></div>
                    <div className="dnm"><b>Sony XM5</b></div>
                    <div className="dsc">ganó 5 de 6</div>
                    <div className="tally"><i className="w"></i><i className="w"></i><i className="w"></i><i className="w"></i><i className="w"></i><i></i></div>
                    <div className="crown"><Ic i={Trophy} className="ic" style={{ "fontSize": "11px" }} />TU MATCH</div>
                  </div>
                  <div className="dside">
                    <div className="dph" style={{ "background": "var(--sky-soft)" }}><Ic i={Headphones} className="ic" style={{ "color": "var(--sky-ink)" }} /></div>
                    <div className="dnm">Bose QC</div>
                    <div className="dsc">ganó 1 de 6</div>
                    <div className="tally"><i></i><i></i><i></i><i></i><i></i><i className="w" style={{ "background": "#9dbcf3" }}></i></div>
                  </div>
                  <div className="dside">
                    <div className="dph" style={{ "background": "var(--paper3)" }}><Ic i={Headphones} className="ic" style={{ "color": "var(--ink-dim)" }} /></div>
                    <div className="dnm">AirPods 4</div>
                    <div className="dsc">compatible, caro</div>
                  </div>
                </div>
              </div>
              <div className="vs-table rv">
                <div className="vt-head"><span>Criterio</span><span>Sony XM5</span><span>Bose QC</span><span>AirPods 4</span></div>
                <div className="vt-row"><span className="vt-k">Cancelación</span><span className="best">Mejor en 38 dB</span><span>Muy buena</span><span>Básica</span></div>
                <div className="vt-row"><span className="vt-k">Batería</span><span className="best">10 h</span><span>7 h</span><span>6 h</span></div>
                <div className="vt-row"><span className="vt-k">Vos en llamadas</span><span>Claras</span><span className="best">Mejor mic</span><span>Buenas</span></div>
                <div className="vt-row"><span className="vt-k">Con tu Android</span><span className="best">Full + LDAC</span><span>Full</span><span>Limitado¹</span></div>
                <div className="vt-row"><span className="vt-k">Precio</span><span>€189</span><span>€199</span><span className="best">€149</span></div>
                <div className="vt-row final"><span className="vt-k">Veredicto</span><span className="best">GANA</span><span>Si vivís al teléfono</span><span>Si eres todo Apple</span></div>
              </div>
              <div className="vs-note rv">
                <Ic i={Brain} className="ic" />
                <p>El empate técnico era real: por tus llamadas diarias ganaba Bose. Ganó Sony por el combo <b>batería + cancelación + LDAC</b> con tu teléfono.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={ShoppingCart} className="ic" />Añadir al carrito</button>
                <button className="btn ghost"><Ic i={Swords} className="ic" />Comparar otros</button>
              </div>
      </div>
    </>
  );
}
