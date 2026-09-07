/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-match — port visual del catálogo.
 * Card type real: live_match
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Goal,
  ChartPie,
  BellRing,
  List,
} from "lucide-react";

import "./p-match.css";

export function MatchPanel() {
  return (
    <>
      <div id="p-match" className="lcr-panel">
      <div className="sb rv">
                <div className="sb-top">
                  <span className="sb-comp">LaLiga · Jornada 5</span>
                  <span className="sb-live"><span className="dot"></span>EN VIVO</span>
                </div>
                <div className="sb-score">
                  <div className="sb-team"><img src="/stitch/sports/real-madrid.png" alt="Real Madrid" /><span className="nm">Real Madrid</span></div>
                  <div className="sb-nums"><span className="g">2</span><span className="sep">–</span><span className="g">1</span></div>
                  <div className="sb-team"><img src="/stitch/sports/barcelona.png" alt="Barcelona" /><span className="nm">Barcelona</span></div>
                </div>
                <div className="sb-min"><b>78'</b><span>segundo tiempo</span></div>
                <div className="sb-bar"><i></i></div>
              </div>
              <div className="sb-feed rv">
                <h3><Ic i={Goal} className="ic" />Cómo llegaron los goles</h3>
                <div className="frow"><span className="fmin">12'</span><div className="fp"><img src="/stitch/sports/players/bellingham.jpg" alt="Bellingham" /></div><div className="ft"><b>Bellingham</b><span>cabezazo tras córner de Rodrygo</span></div><div className="fic"><Ic i={Goal} className="ic" /></div></div>
                <div className="frow opp"><span className="fmin">34'</span><div className="fp"><img src="/stitch/sports/players/yamal.jpg" alt="Yamal" /></div><div className="ft"><b>Lamine Yamal</b><span>diagonal y definición cruzada</span></div><div className="fic"><Ic i={Goal} className="ic" /></div></div>
                <div className="frow"><span className="fmin">71'</span><div className="fp"><img src="/stitch/sports/players/mbappe.jpg" alt="Mbappé" /></div><div className="ft"><b>Mbappé</b><span>contraataque en 3 toques, solo ante el arquero</span></div><div className="fic"><Ic i={Goal} className="ic" /></div></div>
              </div>
              <div className="sb-pos rv">
                <h3><Ic i={ChartPie} className="ic" />Quién está mandando</h3>
                <div className="pos-track"><span className="l" style={{ "width": "58%" }}>58%</span><span className="r" style={{ "width": "42%" }}>42%</span></div>
                <div className="pos-ends"><span>Remates 12 – 7</span><span> intenciones de gol<b style={{ "color": "var(--mint-ink)" }}> +3</b></span></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Avisame si hay gol</button>
                <button className="btn ghost"><Ic i={List} className="ic" />Ver eventos</button>
              </div>
      </div>
    </>
  );
}
