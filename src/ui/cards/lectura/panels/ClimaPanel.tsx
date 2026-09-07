/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-clima — port visual del catálogo.
 * Card type real: weather
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  CloudSun,
  Sunset,
  ChartLine,
  Sun,
  Moon,
  CloudRain,
  Cloud,
  BellRing,
  CalendarDays,
} from "lucide-react";

import "./p-clima.css";

export function ClimaPanel() {
  return (
    <>
      <div id="p-clima" className="lcr-panel">
      <div className="wx-now rv">
                <div className="wx-top">
                  <div><div className="wx-place">Ahora en Madrid</div><div className="wx-when">domingo 7 · 15:40</div></div>
                  <div className="wx-wicon"><Ic i={CloudSun} className="ic" /></div>
                </div>
                <div className="wx-main">
                  <div className="wx-temp">26°</div>
                  <div className="wx-meta">Parcial<br />Sensación <b>27°</b><br />Viento 12 km/h NE</div>
                </div>
                <div className="wx-arc rv">
                  <div className="arc-cap"><span><Ic i={Sunset} className="ic" />07:41</span><span>20:52<Ic i={Sunset} className="ic" /></span></div>
                  <svg viewBox="0 0 360 74" style={{ "width": "100%", "height": "74px", "display": "block" }}>
                    <path d="M8 66 A 172 172 0 0 1 352 66" fill="none" stroke="#c9d9f5" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
                    <path d="M8 66 A 172 172 0 0 1 251 21" fill="none" stroke="#f6bd6d" strokeWidth="3.5" strokeLinecap="round" opacity=".9" />
                    <circle cx="251" cy="21" r="11" fill="#fde9c8" stroke="#f59e0b" strokeWidth="3.5" />
                    <line x1="4" y1="66" x2="356" y2="66" stroke="#c9d9f5" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <div className="wx-curve rv" style={{ "marginTop": "14px" }}>
                <h3><Ic i={ChartLine} className="ic" />Cómo viene la tarde</h3>
                <svg viewBox="0 0 340 110">
                  <defs><linearGradient id="p-clima-wxf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8ab0ff" stopOpacity=".34" /><stop offset="1" stopColor="#8ab0ff" stopOpacity="0" />
                  </linearGradient></defs>
                  <g stroke="#eef2fb" strokeWidth="1">
                    <line x1="0" y1="22" x2="340" y2="22" /><line x1="0" y1="55" x2="340" y2="55" /><line x1="0" y1="88" x2="340" y2="88" />
                  </g>
                  <path d="M6 58 C 30 52, 40 44, 64 40 C 92 35, 104 26, 136 23 C 170 20, 186 18, 216 19 C 246 20, 262 26, 288 36 C 312 45, 324 52, 334 56 L334 108 L6 108 Z" fill="url(#p-clima-wxf)" />
                  <path d="M6 58 C 30 52, 40 44, 64 40 C 92 35, 104 26, 136 23 C 170 20, 186 18, 216 19 C 246 20, 262 26, 288 36 C 312 45, 324 52, 334 56" fill="none" stroke="#5170d8" strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="136" cy="23" r="6" fill="#fff" stroke="#f59e0b" strokeWidth="3" />
                  <circle cx="6" cy="58" r="5" fill="#fff" stroke="#5170d8" strokeWidth="3" />
                  <text x="136" y="12" textAnchor="middle" fontFamily="Plus Jakarta Sans" fontWeight="800" fontSize="11" fill="#b45309">29° máx</text>
                </svg>
                <div className="xh"><span>15</span><span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span></div>
              </div>
              <div className="wx-hi-lo rv" style={{ "marginTop": "14px" }}>
                <div className="hl" style={{ "background": "var(--honey-soft)" }}><Ic i={Sun} className="ic" style={{ "color": "var(--honey-ink)" }} /><div><b style={{ "color": "var(--honey-ink)" }}>29°</b><span>Máxima · 18h</span></div></div>
                <div className="hl" style={{ "background": "var(--sky-soft)" }}><Ic i={Moon} className="ic" style={{ "color": "var(--sky-ink)" }} /><div><b style={{ "color": "var(--sky-ink)" }}>19°</b><span>Mínima · 6h</span></div></div>
              </div>
              <div className="rv" style={{ "marginTop": "14px" }}>
                <h3 style={{ "font": "800 15px var(--disp)", "marginBottom": "9px" }}>La semana viene calmando</h3>
                <div className="wx-days">
                  <div className="wx-day"><span className="wd">Lun</span><div className="wi"><Ic i={Sun} className="ic" /></div><div className="wbar"><i style={{ "left": "22%" }}></i></div><span className="wtmp">18°–28°</span></div>
                  <div className="wx-day"><span className="wd">Mar</span><div className="wi"><Ic i={CloudSun} className="ic" /></div><div className="wbar"><i style={{ "left": "30%" }}></i></div><span className="wtmp">17°–26°</span></div>
                  <div className="wx-day"><span className="wd">Mié</span><div className="wi" style={{ "background": "var(--honey-soft)" }}><Ic i={CloudRain} className="ic" style={{ "color": "var(--honey-ink)" }} /></div><div className="wbar"><i style={{ "left": "38%" }}></i></div><span className="wtmp">16°–23°</span></div>
                  <div className="wx-day"><span className="wd">Jue</span><div className="wi"><Ic i={Cloud} className="ic" /></div><div className="wbar"><i style={{ "left": "34%" }}></i></div><span className="wtmp">15°–22°</span></div>
                </div>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={BellRing} className="ic" />Avisame si llueve</button>
                <button className="btn ghost"><Ic i={CalendarDays} className="ic" />Ver semana</button>
              </div>
      </div>
    </>
  );
}
