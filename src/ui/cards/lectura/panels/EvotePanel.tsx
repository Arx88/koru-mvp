/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-evote — port visual del catálogo.
 * Card type real: election_vote
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  PiggyBank,
  Check,
  Shield,
  Trees,
  Brain,
  ArrowRight,
  SlidersHorizontal,
  Dices,
} from "lucide-react";

import "./p-evote.css";

export function EvotePanel() {
  return (
    <>
      <div id="p-evote" className="lcr-panel">
      <div className="pr-hero rv" style={{ "margin": "2px 0 0" }}>
                <div>
                  <div className="pr-q">¿Qué lente uso<br />para ordenar esto?</div>
                  <p className="pr-sub" style={{ "marginTop": "8px" }}>Para la comparación de candidatos que me pediste: elijo uno y arma el análisis desde ahí. Tocá uno.</p>
                </div>
                <div className="pr-card sel">
                  <div className="pic2" style={{ "background": "var(--mint-soft)" }}><Ic i={PiggyBank} className="ic" style={{ "color": "var(--mint-ink)" }} /></div>
                  <div className="pt"><b>Economía primero</b><span>empleo, inflación, impuestos — lo que mueve tu bolsillo</span></div>
                  <span className="chk"><Ic i={Check} className="ic" /></span>
                </div>
                <div className="pr-card">
                  <div className="pic2" style={{ "background": "var(--sky-soft)" }}><Ic i={Shield} className="ic" style={{ "color": "var(--sky-ink)" }} /></div>
                  <div className="pt"><b>Seguridad primero</b><span>crimen, justicia, defensa — la calle como prioridad</span></div>
                  <span className="chk"><Ic i={Check} className="ic" /></span>
                </div>
                <div className="pr-card">
                  <div className="pic2" style={{ "background": "var(--honey-soft)" }}><Ic i={Trees} className="ic" style={{ "color": "var(--honey-ink)" }} /></div>
                  <div className="pt"><b>Ambiente primero</b><span>energía, agua, transición — el plazo largo</span></div>
                  <span className="chk"><Ic i={Check} className="ic" /></span>
                </div>
              </div>
              <div className="pr-why rv" style={{ "marginTop": "12px" }}>
                <h4><Ic i={Brain} className="ic" />Por qué te lo pregunto</h4>
                <li><Ic i={ArrowRight} className="ic" /><span>Con la lente elegida, ordeno las 14 propuestas de cada candidato por impacto directo en vos.</span></li>
                <li><Ic i={ArrowRight} className="ic" /><span>Las otras lentes no desaparecen: quedan como contexto en cada ficha.</span></li>
                <li><Ic i={ArrowRight} className="ic" /><span>Sin lente, el empate técnico es imposible de romper — todos prometen todo.</span></li>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={SlidersHorizontal} className="ic" />Usar esta lente</button>
                <button className="btn ghost"><Ic i={Dices} className="ic" />Más balanceado</button>
              </div>
      </div>
    </>
  );
}
