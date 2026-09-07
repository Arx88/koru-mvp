/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-mem — port visual del catálogo.
 * Card type real: memory
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  Umbrella,
  MapPin,
  Gift,
  Zap,
  Wifi,
  Lightbulb,
  Car,
  Brain,
  CheckCheck,
  Search,
} from "lucide-react";

import "./p-mem.css";

export function MemPanel() {
  return (
    <>
      <div id="p-mem" className="lcr-panel">
      <div className="arc-head rv">
                <h1><small>Tu archivo de este mes</small>Lo nuevo que<br />te guardé</h1>
                <p>Esto lo retengo solito: cuando me vuelvas a preguntar, ya lo voy a saber.</p>
              </div>
              <div className="arc-stack rv">
                <div className="arc-card c1">
                  <div className="ac-top">
                    <div className="abic" style={{ "background": "var(--pink-soft)" }}><Ic i={Umbrella} className="ic" style={{ "color": "var(--pink-ink)" }} /></div>
                    <div className="at"><small>Hoy · 11:20</small>La ruta de Mallorca que armamos</div>
                    <span className="arc-new">NUEVO</span>
                  </div>
                  <p className="ad">Calas escondidas + alquiler de moto en Sóller · presupuesto €900 · fecha ideal septiembre</p>
                  <div className="aph">
                    <img src="/stitch/outfits/mem-mallorca.jpg" alt="Cala de Mallorca" />
                    <span><Ic i={MapPin} className="ic" />sa Calobra · parada 3</span>
                  </div>
                </div>
                <div className="arc-card c2">
                  <div className="ac-top">
                    <div className="abic" style={{ "background": "var(--sky-soft)" }}><Ic i={Gift} className="ic" style={{ "color": "var(--sky-ink)" }} /></div>
                    <div className="at"><small>Ayer</small>El regalo de Maru:el vinilo de Wos</div>
                  </div>
                  <p className="ad">Edición numerada · queda en Bar Aparte, Palermo · te reservé el último</p>
                </div>
                <div className="arc-card c3">
                  <div className="ac-top">
                    <div className="abic" style={{ "background": "var(--mint-soft)" }}><Ic i={Zap} className="ic" style={{ "color": "var(--mint-ink)" }} /></div>
                    <div className="at"><small>Martes</small>El técnico de wifi que te funcionó</div>
                  </div>
                </div>
              </div>
              <div className="arc-rows rv">
                <h3>Por si lo buscás rápido</h3>
                <div className="arow"><div className="abic" style={{ "background": "var(--sky-soft)" }}><Ic i={Gift} className="ic" style={{ "color": "var(--sky-ink)" }} /></div><div className="abt"><b>Regalo de Maru · vinyl Wos</b><span>para el 12 de septiembre</span></div><span className="tag" style={{ "background": "var(--sky-soft)", "color": "var(--sky-ink)" }}>REGALO</span></div>
                <div className="arow"><div className="abic" style={{ "background": "var(--mint-soft)" }}><Ic i={Wifi} className="ic" style={{ "color": "var(--mint-ink)" }} /></div><div className="abt"><b>Técnico de wifi · 11-3422</b><span>el que dejó todo funcionando</span></div><span className="tag" style={{ "background": "var(--mint-soft)", "color": "var(--mint-ink)" }}>SERVICIO</span></div>
                <div className="arow"><div className="abic" style={{ "background": "var(--violet-soft)" }}><Ic i={Lightbulb} className="ic" style={{ "color": "var(--violet-ink)" }} /></div><div className="abt"><b>Idea: menú de cumple de Juan</b><span>parrilla + tarta de la abuela</span></div><span className="tag" style={{ "background": "var(--violet-soft)", "color": "var(--violet-ink)" }}>IDEA</span></div>
                <div className="arow"><div className="abic" style={{ "background": "var(--honey-soft)" }}><Ic i={Car} className="ic" style={{ "color": "var(--honey-ink)" }} /></div><div className="abt"><b>Auto: cambiar aceite a los 12.000</b><span>me avisa solo en octubre</span></div><span className="tag" style={{ "background": "var(--honey-soft)", "color": "var(--honey-ink)" }}>AUTO</span></div>
              </div>
              <div className="arc-cap rv">
                <Ic i={Brain} className="ic" />
                Todo lo de arriba quedó asociado a tu historial: no hace falta que lo repitas cuando lo necesites.
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={CheckCheck} className="ic" />Perfecto así</button>
                <button className="btn ghost"><Ic i={Search} className="ic" />Buscar algo guardado</button>
              </div>
      </div>
    </>
  );
}
