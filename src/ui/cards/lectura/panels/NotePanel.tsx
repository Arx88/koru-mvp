/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-note — port visual del catálogo.
 * Card type real: review_document
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  StickyNote,
  Phone,
  Cake,
  ChefHat,
  Clock,
  Brain,
  BellRing,
  AlarmClock,
  Share2,
} from "lucide-react";

import "./p-note.css";

export function NotePanel() {
  return (
    <>
      <div id="p-note" className="lcr-panel">
      <div className="nt-head rv">
                <h1><small>Guardado en tu bóveda</small>“Anotame<br />esto”</h1>
                <p>Le pediste a Michi que lo guarde y quedó así: tal cual lo dijiste, con su contexto.</p>
              </div>
              <div className="note rv">
                <span className="pin"></span>
                <div className="nk"><Ic i={StickyNote} className="ic" />NOTA<span className="when">ayer · 22:41</span></div>
                <p className="txt">Llamar a la abuela el <em>sábado a las 11</em> — antes de que llegue Maru. Pedirle la receta del <em>pionono</em> que ella hace con la crema de lado.</p>
                <div className="tags">
                  <span><Ic i={Phone} className="ic" />llamada</span>
                  <span><Ic i={Cake} className="ic" />cumple Maru</span>
                  <span><Ic i={ChefHat} className="ic" />receta</span>
                </div>
              </div>
              <div className="nt-meta rv">
                <div className="nt-chip nt-c1"><Ic i={Clock} className="ic" /><div><b>Se volvió recuerdo</b><span>asociado al sábado</span></div></div>
                <div className="nt-chip nt-c2"><Ic i={Brain} className="ic" /><div><b>Michi lo conectó</b><span>con el regalo de Maru</span></div></div>
                <div className="nt-chip nt-c3"><Ic i={BellRing} className="ic" /><div><b>Recordatorio</b><span>sáb 10:45</span></div></div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={AlarmClock} className="ic" />Volverla recordatorio</button>
                <button className="btn ghost"><Ic i={Share2} className="ic" />Compartir</button>
              </div>
      </div>
    </>
  );
}
