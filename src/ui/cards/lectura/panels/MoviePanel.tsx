/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-movie — port visual del catálogo.
 * Card type real: movie_review
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Clapperboard,
  Star,
  Play,
  Clock,
  Volume2,
  Calendar,
} from "lucide-react";

import "./p-movie.css";

export function MoviePanel() {
  return (
    <>
      <div id="p-movie" className="lcr-panel">
      <div className="mv-head rv">
                <h1><small>La sugerencia de esta noche</small>Neón,<br />sueños y un caso</h1>
                <p>Si te gustó Blade Runner 2049, esta te va a dormir tarde. Disponible ya en tu cola.</p>
              </div>
              <div className="mv-photo rv">
                <img src="/stitch/outfits/movie-neon.jpg" alt="Calle con neones de noche" />
                <span className="q"><Ic i={Clapperboard} className="ic" />2h 14min · 2017</span>
                <div className="in">
                  <span className="k">Hoy te recomiendo</span>
                  <h3>Blade Runner 2049</h3>
                  <div className="g"><span>CIENCIA FICCIÓN</span><span>DRAMA</span><span>4K HDR</span></div>
                </div>
              </div>
              <div className="mv-verdict rv">
                <div className="stars">
                  <div className="st3">
                    <Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic" /><Ic i={Star} className="ic off" />
                  </div>
                  <b>8,1</b>
                  <span>critics 88% · público 81%</span>
                </div>
                <p>Visualmente es <b>la peli más hermosa de la década</b>: cada cuadro es un cuadro. La historia va lenta a propósito — vos querés cine contemplativo de domingo a la noche, y esto ES eso.</p>
              </div>
              <div className="mv-rows rv">
                <div className="mv-row"><div className="ic" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}><Ic i={Play} className="ic" /></div><div className="tx"><b>Disponible ahora</b><span>incluida en tu suscripción</span></div><span className="where">INCLUIDA</span></div>
                <div className="mv-row"><div className="ic" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}><Ic i={Clock} className="ic" /></div><div className="tx"><b>Cuándo te conviene</b><span>hoy 22:15 — terminás antes de las 00:30</span></div></div>
                <div className="mv-row"><div className="ic" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}><Ic i={Volume2} className="ic" /></div><div className="tx"><b>Audio y subtitulos</b><span>latino 5.1 o original con subs</span></div></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Play} className="ic" />Ver hoy 22:15</button>
                <button className="btn ghost"><Ic i={Calendar} className="ic" />Guardar para el finde</button>
              </div>
      </div>
    </>
  );
}
