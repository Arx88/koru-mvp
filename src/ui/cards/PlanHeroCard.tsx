import { useState } from "react";
import type { AssistantPlanItem } from "../../domain/types";
import { PlanRoadmapScreen } from "../PlanRoadmapScreen";

// Plan Entregado — réplica Stitch: hoja clara "Tu Plan / INTEGRAL" con la
// ilustración 3D, tres categorías derivadas del plan real y el CTA
// "Ver plan completo" que abre el roadmap funcional (PlanRoadmapScreen).

type PlanBlock = {
  type: "plan";
  title?: string;
  items: AssistantPlanItem[];
  note?: string;
};

function Mat({ children, style }: { children: string; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-outlined" style={style}>
      {children}
    </span>
  );
}

type Category = { icon: string; label: string; color: string };

const DEFAULT_CATS: Category[] = [
  { icon: "fitness_center", label: "Entrenamientos", color: "#8363f9" },
  { icon: "potted_plant", label: "Nutrición", color: "#059669" },
  { icon: "dark_mode", label: "Hábitos", color: "#d97706" },
];

// Deriva hasta 3 categorías del contenido real del plan; si no se puede
// clasificar, se usan las tres del diseño Stitch.
function deriveCategories(items: AssistantPlanItem[]): Category[] {
  const found: Category[] = [];
  const text = items.map((i) => `${i.title} ${i.rationale ?? ""}`.toLowerCase()).join(" ");
  if (/entren|ejercicio|hiit|yoga|correr|gym|caminar|cardio|fuerza/.test(text)) found.push(DEFAULT_CATS[0]);
  if (/nutri|comida|dieta|desayun|almuerz|cena|proteína|proteina/.test(text)) found.push(DEFAULT_CATS[1]);
  if (/hábito|habito|dormir|sueño|agua|pantalla|meditar|rutina/.test(text)) found.push(DEFAULT_CATS[2]);
  if (/estudi|leer|curso|aprend/.test(text) && found.length < 3)
    found.push({ icon: "menu_book", label: "Aprendizaje", color: "#2563eb" });
  if (/trabajo|tarea|proyecto|reunión|reunion/.test(text) && found.length < 3)
    found.push({ icon: "work", label: "Trabajo", color: "#4648d4" });
  return found.length ? found.slice(0, 3) : DEFAULT_CATS;
}

function heroTitle(title?: string): string {
  const clean = (title ?? "").replace(/^\s*(tu\s+)?plan\s*/i, "").trim();
  return (clean || "Integral").toUpperCase();
}

export function PlanHeroCard({ block }: { block: PlanBlock }) {
  const [open, setOpen] = useState(false);
  const items = block.items ?? [];
  const cats = deriveCategories(items);

  return (
    <div className="koru-plan-hero" data-ui-block="plan">
      <div className="koru-plan-hero-top">
        <div className="koru-plan-hero-copy">
          <p className="koru-plan-hero-kicker">Tu Plan</p>
          <h2 className="koru-plan-hero-title">{heroTitle(block.title)}</h2>
          <p className="koru-plan-hero-desc">
            {block.note ?? (
              <>
                Diseñado para ti, combinando ejercicio, nutrición y hábitos para <b>resultados reales.</b>
              </>
            )}
          </p>
        </div>
        <img alt="" src="/stitch/plan-illustration.png" className="koru-plan-hero-art" />
      </div>

      <div className="koru-plan-hero-cats">
        {cats.map((cat) => (
          <div key={cat.label} className="koru-plan-hero-cat">
            <Mat style={{ color: cat.color }}>{cat.icon}</Mat>
            <span>{cat.label}</span>
          </div>
        ))}
      </div>

      <button type="button" className="koru-plan-hero-cta" onClick={() => setOpen(true)}>
        Ver plan completo
        <Mat>arrow_forward</Mat>
      </button>

      {open && <PlanRoadmapScreen title={block.title} items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}
