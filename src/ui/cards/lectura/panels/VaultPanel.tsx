/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-vault — port visual del catálogo.
 * Card type real: saved_record
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Vault,
  Search,
  Cake,
  Database,
  MessageCircle,
  LockKeyhole,
} from "lucide-react";

import "./p-vault.css";

export function VaultPanel() {
  return (
    <>
      <div id="p-vault" className="lcr-panel">
      <div className="vt-head rv">
                <h1><small>Tu bóveda de recuerdos</small>Todo lo que Michi<br />sabe de ti</h1>
                <p>Cada cosa que me cuentas queda aquí adentro: viajes, personas, gastos, ideas. Privada, buscable y siempre a mano.</p>
              </div>
              <div className="vt-safe rv">
                <div className="vt-top">
                  <div className="vt-dial"><Ic i={Vault} className="ic" /></div>
                  <div className="t">
                    <b>Bóveda de Valentina</b>
                    <span>127 recuerdos · 9 categorías · desde mar 2024</span>
                  </div>
                  <div className="cnt2"><b>127</b><span>recuerdos</span></div>
                </div>
                <div className="vt-search">
                  <Ic i={Search} className="ic" />
                  <span>“la ruta de Mallorca”, “Maru”, “café…”</span>
                  <span className="kbd">⌘K</span>
                </div>
                <div className="vt-grid">
                  <div className="vt-mem">
                    <div className="mp"><img src="/stitch/outfits/mem-mallorca.jpg" alt="Cala de Mallorca" /><span className="mk2">Viaje</span></div>
                    <div className="mt2"><b>Ruta de Mallorca</b><span>calas + moto en Sóller · €900</span></div>
                  </div>
                  <div className="vt-mem">
                    <div className="mp"><img src="/stitch/outfits/cafe-latte.jpg" alt="El café de siempre" /><span className="mk2">Lugar</span></div>
                    <div className="mt2"><b>Bar Aparte</b><span>tu mesa + flat white doble</span></div>
                  </div>
                  <div className="vt-mem">
                    <div className="mp"><img src="/stitch/sports/players/bellingham.jpg" alt="Bellingham" /><span className="mk2">Deporte</span></div>
                    <div className="mt2"><b>Eres del Real Madrid</b><span>desde el gol de La Decimocuarta</span></div>
                  </div>
                  <div className="vt-mem no-ph">
                    <div className="mt2">
                      <div className="mi2" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}><Ic i={Cake} className="ic" /></div>
                      <b>El cumple de Maru</b>
                      <span>12 de septiembre · le encanta el vino naranja</span>
                    </div>
                  </div>
                </div>
                <div className="vt-stats">
                  <div className="vt-stat vs1"><Ic i={Database} className="ic" /><b>1,2 GB</b><span>guardado</span></div>
                  <div className="vt-stat vs2"><Ic i={MessageCircle} className="ic" /><b>312</b><span>consultas resueltas</span></div>
                  <div className="vt-stat vs3"><Ic i={LockKeyhole} className="ic" /><b>100%</b><span>en tu teléfono</span></div>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={Search} className="ic" />Buscar en la bóveda</button>
                <button className="btn ghost"><Ic i={LockKeyhole} className="ic" />Privacidad</button>
              </div>
      </div>
    </>
  );
}
