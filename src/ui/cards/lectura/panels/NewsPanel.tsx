/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-news — port visual del catálogo.
 * Card type real: news_urgent
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  BadgeCheck,
  CircleUser,
  CheckCheck,
  FileText,
} from "lucide-react";

import "./p-news.css";

export function NewsPanel() {
  return (
    <>
      <div id="p-news" className="lcr-panel">
      <div className="ev-head rv" style={{ "margin": "2px 0 14px" }}>
                <h1 style={{ "font": "800 26px/1.12 var(--disp)", "letterSpacing": "-.02em" }}><small style={{ "display": "block", "font": "700 11px var(--sans)", "letterSpacing": ".14em", "textTransform": "uppercase", "color": "var(--sky-ink)", "marginBottom": "5px" }}>Tech · solo lo tuyo</small>Tres noticias<br />que te importan</h1>
                <p style={{ "font": "600 12px var(--sans)", "color": "var(--ink-dim)", "marginTop": "6px" }}>Filtré 214 fuentes por tus temas. Estas son las tres que valen tu martes.</p>
              </div>
              <div className="np-paper rv">
                <div className="np-mast">
                  <div className="mk"><b>VERIFICADO</b><span>·</span><span>3 FUENTES</span><span>·</span><span>EDI. TARDE</span></div>
                  <h1>El Digesto</h1>
                  <div className="md">domingo 7 de septiembre · 2025 · actualizado 16:20</div>
                </div>
                <div className="np-photo rv">
                  <img src="/stitch/outfits/news-ev.jpg" alt="Auto eléctrico cargando" />
                  <div className="pcap"><b>FOTO:</b> carga rápida de 800 V en estación piloto · la nota principal</div>
                </div>
                <div className="np-lead">
                  <span className="k2">La principal</span>
                  <h2>La UE avanza con la batería de 2030: 30% más barata que la china</h2>
                  <p>El nuevo estándar promete recargar al 80% en 12 minutos. Impacta directo en el auto eléctrico que venís mirando desde junio — te lo marco abajo.</p>
                  <div className="src"><Ic i={BadgeCheck} className="ic" />Reuters + 2 medios coinciden · 14:50</div>
                </div>
                <div className="np-cols">
                  <div className="np-col">
                    <div className="np-item"><img className="iph" src="/stitch/outfits/prod-phone.jpg" alt="Smartphone con NFC" /><h4>Apple abriría el NFC a bancos</h4><p>Presión regulatoria: podría significar tu billetera sin la comisión del 0,15%.</p><span className="tag2" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}>BLOOMBERG</span></div>
                    <div className="np-item"><img className="iph" src="/stitch/outfits/news-chip.jpg" alt="Chip de silicio" /><h4>Starlink baja 15% en Latam</h4><p>Paga el mismo mes 2% más de velocidad: raro, pero real en la última medición.</p><span className="tag2" style={{ "background": "var(--honey-soft)", "color": "var(--honey-ink)" }}>GSMA</span></div>
                  </div>
                  <div className="np-col">
                    <div className="np-item"><h4>El Prado digitaliza 12.000 obras</h4><p>Van Gogh y El Bosco en 8K: la app nueva permite zoom de pincelada.</p><span className="tag2" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}>EL PAÍS</span></div>
                    <div className="np-item"><h4>Baterías: lo que implica</h4><p>Si se confirma el estándar, el precio del auto eléctrico cae €3.000 el año que viene.</p><span className="tag2" style={{ "background": "var(--pink-soft)", "color": "var(--pink-ink)" }}>ANÁLISIS</span></div>
                  </div>
                </div>
                <div className="np-mine">
                  <Ic i={CircleUser} className="ic" />
                  <p>Conecté la nota de la batería con tu investigación del auto: <b>te armo un resumen cruzado esta noche</b> si querés.</p>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CheckCheck} className="ic" />Suficiente por hoy</button>
                <button className="btn ghost"><Ic i={FileText} className="ic" />Leer el resumen de la batería</button>
              </div>
      </div>
    </>
  );
}
