/**
 * RecipeInterior — card "Receta" (#p-recipe), bind real del block `recipe`
 * (TheMealDB + enriquecimientos OFF).
 *
 * Página de revista: foto real del tool, ingredientes como etiquetas de
 * mercado (measure+ingredient), pasos numerados con title/duración del
 * block, truco real de tips[], nutrición OFF. "Cocinar en modo pantalla"
 * abre el CookingMode REAL de la app (timers por paso).
 */
import { useState } from "react";
import { ChefHat, Clock, Flame, Lightbulb, ShoppingBasket, Users } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { CookingMode, type CookingStep } from "../../unified/CookingMode";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-recipe.css";

type RecipeBlock = Extract<UiBlock, { type: "recipe" }>;

const DIFF_LABEL: Record<string, string> = { easy: "fácil", medium: "media", hard: "difícil" };

export function RecipeInterior({ block, onClose, onSave }: LecturaInteriorProps<RecipeBlock>) {
  const [cookingOpen, setCookingOpen] = useState(false);
  const name = block.name ?? block.title ?? "Receta";
  const ingredients = block.ingredients ?? [];
  const steps = block.steps ?? [];
  const tip = block.tips?.[0];

  const cookingSteps: CookingStep[] = steps.map((s) => {
    const maybeTimer = (s as unknown as { timerSec?: unknown }).timerSec;
    return {
      step: s.step,
      text: s.text,
      ...(typeof maybeTimer === "number" ? { timerSec: maybeTimer } : {}),
    };
  });

  const totalMin = (() => {
    const prep = parseInt(block.prepTime ?? "", 10);
    const cook = parseInt(block.cookTime ?? "", 10);
    const parts = [prep, cook].filter(Number.isFinite);
    return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
  })();

  if (cookingOpen && cookingSteps.length > 0) {
    return <CookingMode title={name} steps={cookingSteps} block={block} onClose={() => setCookingOpen(false)} />;
  }

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(name, block.category) : undefined}
      chip={{ label: "Cocina", background: "linear-gradient(135deg,#FFD75E,#FDC533)" }}
      ariaLabel={name}
    >
      <div id="p-recipe" className="lcr-panel">
        <div className="rc-head rv">
          <h1>
            <small>{[block.category, block.area].filter(Boolean).join(" · ") || "Receta"}</small>
            {name}
          </h1>
          <p>{block.description}</p>
        </div>

        {block.image && (
          <div className="rc-photo rv">
            <img src={block.image} alt={name} />
            <span className="lv">
              <Ic i={ChefHat} className="ic" />
              {DIFF_LABEL[block.difficulty ?? "easy"] ?? "receta"}{totalMin ? ` · ${totalMin} min` : ""}
            </span>
            <div className="in">
              <span className="k">Receta verificada</span>
              <h3>{name}</h3>
              <div className="m">
                {block.servings != null && <span><Ic i={Users} className="ic" />{block.servings} porciones</span>}
                {block.nutrition && <span><Ic i={Flame} className="ic" />{block.nutrition.kcal} kcal/100g</span>}
                {block.cookTime && <span><Ic i={Clock} className="ic" />{block.cookTime} cocción</span>}
              </div>
            </div>
          </div>
        )}

        {ingredients.length > 0 && (
          <div className="rc-ing rv">
            <h4><Ic i={ShoppingBasket} className="ic" />Lo que necesitás<span>{ingredients.length} ingredientes</span></h4>
            <div className="rc-pills">
              {ingredients.map((ing, i) => (
                <span key={i}><b>{ing.measure || "—"}</b> {ing.ingredient}</span>
              ))}
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <div className="rc-steps rv">
            {steps.map((s, i) => (
              <div className="rc-step" key={i}>
                <span className="n">{s.step}</span>
                <div>
                  <b>{s.title ?? `Paso ${s.step}`}</b>
                  <p>{s.text}</p>
                </div>
                {s.durationMinutes != null && <span className="tm">{s.durationMinutes} min</span>}
              </div>
            ))}
          </div>
        )}

        {tip && (
          <div className="rc-tip rv">
            <Ic i={Lightbulb} className="ic" />
            <p><b>El truco:</b> {tip}</p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={cookingSteps.length === 0}
            onClick={() => setCookingOpen(true)}
          >
            <Ic i={ChefHat} className="ic" />Cocinar en modo pantalla
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              dispatchCardAction("create_commitment", block, {
                title: `Comprar ingredientes de ${name}`,
                dueHint: `antes de cocinar (${ingredients.length} ingredientes)`,
              })
            }
          >
            <Ic i={ShoppingBasket} className="ic" />Agregar al carrito
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
