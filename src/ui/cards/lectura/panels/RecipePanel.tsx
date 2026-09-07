/* ⚠️ AUTO-GENERADO de lectura-visual.html #p-recipe — port visual del catálogo.
 * Card type real: recipe
 * FASE DE INTEGRACIÓN: bind de datos reales (props) + wiring de acciones.
 * El contenido literal es el sample del catálogo hasta que se bindee. */
import { Ic } from "../Ic";
import {
  ChefHat,
  Users,
  Flame,
  Star,
  ShoppingBasket,
  Lightbulb,
} from "lucide-react";

import "./p-recipe.css";

export function RecipePanel() {
  return (
    <>
      <div id="p-recipe" className="lcr-panel">
      <div className="rc-head rv">
                <h1><small>De la guía de Roma</small>La carbonara<br />de verdad</h1>
                <p>Chequeada contra 11 recetas italianas: sin crema, sin cebolla, sin miedo al pecorino.</p>
              </div>
              <div className="rc-photo rv">
                <img src="/stitch/outfits/recipe-pasta.jpg" alt="Spaghetti a la carbonara" />
                <span className="lv"><Ic i={ChefHat} className="ic" />fácil · 25 min</span>
                <div className="in">
                  <span className="k">Receta verificada</span>
                  <h3>Spaghetti alla carbonara</h3>
                  <div className="m">
                    <span><Ic i={Users} className="ic" />2 porciones</span>
                    <span><Ic i={Flame} className="ic" />386 kcal/plato</span>
                    <span><Ic i={Star} className="ic" />4,8 (214)</span>
                  </div>
                </div>
              </div>
              <div className="rc-ing rv">
                <h4><Ic i={ShoppingBasket} className="ic" />Lo que necesitás<span>6 ingredientes</span></h4>
                <div className="rc-pills">
                  <span><b>200 g</b> spaghetti nº5</span>
                  <span><b>80 g</b> guanciale</span>
                  <span><b>2</b> yemas + 1 huevo</span>
                  <span><b>50 g</b> pecorino romano</span>
                  <span><b>pimienta</b> negra recién molida</span>
                  <span className="na"><b>0</b> crema — jamás</span>
                </div>
              </div>
              <div className="rc-steps rv">
                <div className="rc-step"><span className="n">1</span><div><b>Dorado del guanciale</b><p>Tiras gruesas, fuego medio, sin aceite: su grasa es el aceite. 6–7 min hasta que quede crocante.</p></div><span className="tm">7 min</span></div>
                <div className="rc-step"><span className="n">2</span><div><b>La crema falsa</b><p>Yemas + huevo + pecorino + pimienta, batidos hasta pasta densa. Fuera del fuego siempre.</p></div><span className="tm">3 min</span></div>
                <div className="rc-step"><span className="n">3</span><div><b>El matrimonio</b><p>Pasta al dente (1 min menos), mezclá con el guanciale APAGADO y agregá la crema + 3 cucharas de agua de cocción.</p></div><span className="tm">2 min</span></div>
              </div>
              <div className="rc-tip rv">
                <Ic i={Lightbulb} className="ic" />
                <p><b>El truco que la salva:</b> si el huevo se te corta, fue temperatura. El bowl de la crema entibiá 1 min con el vapor de la pasta antes de mezclar.</p>
              </div>
              
                      <div className="actions">
                <button className="btn primary"><Ic i={ChefHat} className="ic" />Cocinar en modo pantalla</button>
                <button className="btn ghost"><Ic i={ShoppingBasket} className="ic" />Agregar al carrito</button>
              </div>
      </div>
    </>
  );
}
