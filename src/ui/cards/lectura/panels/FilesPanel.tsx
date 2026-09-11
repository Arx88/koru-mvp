/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-files — port visual del catálogo.
 * Card type real: resource_bundle
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  FolderOpen,
  Check,
  Star,
  CloudUpload,
  Paperclip,
  Archive,
} from "lucide-react";

import "./p-files.css";

export function FilesPanel() {
  return (
    <>
      <div id="p-files" className="lcr-panel">
      <div className="fl-head rv">
                <h1><small>Lo que me pasaste</small>Archivos<br />de tu chat</h1>
                <p>Los PDF, fotos y documentos que compartiste en nuestras conversaciones, con su contexto al lado.</p>
              </div>
              <div className="fl-tray rv">
                <div className="fl-top">
                  <div className="t">
                    <div className="icb"><Ic i={FolderOpen} className="ic" /></div>
                    <b>Bandeja de archivos</b>
                  </div>
                  <span className="cnt4">8 archivos</span>
                </div>
                <div className="fl-row">
                  <div className="th"><img src="/stitch/outfits/travel-madrid.jpg" alt="Boletos a Madrid" /><div className="ft pdf"><span>PDF</span></div><span className="dot"><Ic i={Check} className="ic" /></span></div>
                  <div className="tx"><b>Boletos MAD · sept.pdf</b><span>los pasajes de tu viaje · guardado en Viajes</span></div>
                  <div className="sz"><b>412 KB</b><span>ayer</span></div>
                </div>
                <div className="fl-row">
                  <div className="th"><img src="/stitch/outfits/recipe-pasta.jpg" alt="Receta de la abuela" /><div className="ft pdf"><span>PDF</span></div></div>
                  <div className="tx"><b>Receta pionono.jpg → PDF</b><span>la foto que mandaste, digitalizada y searchable</span></div>
                  <div className="sz"><b>1,8 MB</b><span>sábado</span></div>
                </div>
                <div className="fl-row">
                  <div className="th"><img src="/stitch/outfits/cafe-latte.jpg" alt="Foto del café" /><span className="dot"><Ic i={Star} className="ic" /></span></div>
                  <div className="tx"><b>IMG_4821.heic</b><span>“el flat white de siempre” · vinculada a Bar Aparte</span></div>
                  <div className="sz"><b>2,4 MB</b><span>12 ago</span></div>
                </div>
                <div className="fl-row">
                  <div className="th"><img src="/stitch/outfits/solar-panels-2.jpg" alt="Informe solar" /><div className="ft doc"><span>DOC</span></div></div>
                  <div className="tx"><b>informe-solar-michi.pdf</b><span>el análisis que armamos juntos · 14 páginas</span></div>
                  <div className="sz"><b>3,1 MB</b><span>5 ago</span></div>
                </div>
                <div className="fl-new">
                  <Ic i={CloudUpload} className="ic" />
                  <p>El PDF del boleto ya quedó <b>abierto en tu viaje</b>: la puerta de embarque aparece sola el día del vuelo.</p>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Paperclip} className="ic" />Pasarme un archivo</button>
                <button className="btn ghost"><Ic i={Archive} className="ic" />Ver archivo viejo</button>
              </div>
      </div>
    </>
  );
}
