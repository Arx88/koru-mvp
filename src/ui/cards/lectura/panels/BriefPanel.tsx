/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-brief — port visual del catálogo.
 * Card type real: morning_brief
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Sun,
  Wind,
  Droplets,
  BellRing,
  Radar,
  TrendingUp,
  Newspaper,
  Plane,
  CheckCheck,
  Volume2,
} from "lucide-react";

import "./p-brief.css";

export function BriefPanel() {
  return (
    <>
      <div id="p-brief" className="lcr-panel">
      <div className="bf-head rv">
                <h1><small>Mientras dormías</small>Buen domingo,<br />así arranca tu día</h1>
                <p>Siete minutos de lectura con todo lo que cambió mientras soñabas. Nada más, nada menos.</p>
              </div>
              <div className="bf-photo rv">
                <img src="/stitch/outfits/brief-sunrise.jpg" alt="Amanecer sobre la ciudad" />
                <div className="in">
                  <span className="k">Domingo 7 · 7:42 am</span>
                  <h3>Amanece despejado en Madrid</h3>
                  <div className="w">
                    <span><Ic i={Sun} className="ic" />16–29°</span>
                    <span><Ic i={Wind} className="ic" />aire 9 km/h</span>
                    <span><Ic i={Droplets} className="ic" />UV 4 a las 11</span>
                  </div>
                </div>
                <span className="ava"><img src="/stitch/avatar-wink.png" alt="Koru" /><span>tu brief de siempre</span></span>
              </div>
              <div className="bf-list rv">
                <div className="bf-item urgent">
                  <div className="ic"><Ic i={BellRing} className="ic" /></div>
                  <div className="tx"><b>Hoy no lo olvidés</b><span>llamar a la abuela — la nota que guardaste el jueves</span></div>
                  <div className="v"><b>11:00</b><span>antes de Maru</span></div>
                </div>
                <div className="bf-item">
                  <div className="ic" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}><Ic i={Radar} className="ic" /></div>
                  <div className="tx"><b>Real Madrid 2–1 Barcelona</b><span>anoche, con gol de Vinícius a los 67'</span></div>
                  <div className="v"><b>2–1</b><span>final</span></div>
                </div>
                <div className="bf-item">
                  <div className="ic" style={{ "background": "var(--honey-soft)", "color": "var(--honey-ink)" }}><Ic i={TrendingUp} className="ic" /></div>
                  <div className="tx"><b>Tu portfolio +1,8%</b><span>bitcoin tocó los US$68.400 de madrugada</span></div>
                  <div className="v"><b>+1,8%</b><span>vs ayer</span></div>
                </div>
                <div className="bf-item">
                  <div className="ic" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}><Ic i={Newspaper} className="ic" /></div>
                  <div className="tx"><b>La batería de 2030 se acerca</b><span>la UE confirmó el estándar que impacta tu auto</span></div>
                  <div className="v"><b>3</b><span>noticias</span></div>
                </div>
                <div className="bf-item">
                  <div className="ic" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}><Ic i={Plane} className="ic" /></div>
                  <div className="tx"><b>Tu viaje a Madrid</b><span>faltan 18 días · el boleto ya está en tu bóveda</span></div>
                  <div className="v"><b>18 d</b><span>septiembre</span></div>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CheckCheck} className="ic" />Brief leído</button>
                <button className="btn ghost"><Ic i={Volume2} className="ic" />Escucharlo</button>
              </div>
      </div>
    </>
  );
}
