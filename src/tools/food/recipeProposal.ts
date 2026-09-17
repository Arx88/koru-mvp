import type { ToolRunContext } from "../types";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const numbers: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };

export function recipeConstraints(query: string) {
  const text = fold(query);
  const people = text.match(/\bpara\s+(\d+|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho)\b/);
  const minutes = text.match(/\b(\d+)\s*(?:minutos?|min)\b/);
  const vegan = /\bvegan[oa]s?\b/.test(text);
  const vegetarian = vegan || /\bvegetarian[oa]s?\b/.test(text);
  const ingredientClause = text.match(/\bcon\s+(.+?)(?:[.!?;]|$)/)?.[1]
    ?.split(/\s+(?:para|en|sin)\s+/)[0];
  const ingredients = ingredientClause?.split(/,|\s+y\s+/).map(s => s.trim()).filter(Boolean) ?? [];
  return {
    servings: people ? Number(people[1]) || numbers[people[1]] : undefined,
    maxMinutes: minutes ? Number(minutes[1]) : undefined,
    vegan, vegetarian, ingredients,
    constrained: Boolean(people || minutes || vegetarian || /\bsin\s+\w+/.test(text) || ingredients.length > 1),
  };
}

const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
const singular = (s: string) => fold(s).replace(/\b(huevos|eggs?)\b/g, "huevo").replace(/\bgarbanzos?\b/g, "garbanzo").replace(/\btomates?\b/g, "tomate");

export function parseRecipeProposal(content: string, query: string) {
  const result = validateRecipeProposal(content, query);
  return "recipe" in result ? result.recipe : null;
}

function validateRecipeProposal(content: string, query: string): { recipe: ReturnType<typeof buildRecipe> } | { error: string } {
  const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!json) return { error: "sin-json" };
  let recipe: any;
  try { recipe = JSON.parse(json); } catch { return { error: "json-invalido" }; }
  if (!recipe || typeof recipe !== "object" || recipe.unavailable) return { error: recipe?.unavailable ? "modelo-dijo-no-viable" : "forma-invalida" };
  const constraints = recipeConstraints(query);
  const name = text(recipe.name, 160);
  const servings = recipe.servings;
  const prep = recipe.prepMinutes;
  const cook = recipe.cookMinutes;
  if (!name || !Number.isInteger(servings) || servings < 1 || servings > 30
    || !Number.isInteger(prep) || prep < 0 || !Number.isInteger(cook) || cook < 0
    || prep + cook < 1 || prep + cook > 1440
    || (constraints.servings && servings !== constraints.servings)
    || (constraints.maxMinutes && prep + cook > constraints.maxMinutes)) return { error: "restricciones-incumplidas" };
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2 || recipe.ingredients.length > 30
    || !Array.isArray(recipe.steps) || recipe.steps.length < 2 || recipe.steps.length > 20) return { error: "estructura-corta" };
  const ingredients = recipe.ingredients.map((i: any) => ({ ingredient: text(i?.ingredient, 160), measure: text(i?.measure, 80) }));
  if (ingredients.some((i: any) => !i.ingredient || !i.measure || !/\d/.test(i.measure))) return { error: "cantidades-invalidas" };
  const steps: string[] = recipe.steps.map((s: unknown) => text(
    typeof s === "object" && s !== null ? (s as Record<string, unknown>).step ?? (s as Record<string, unknown>).text : s,
    1200,
  ));
  if (steps.some(s => s.length < 12)) return { error: "pasos-cortos" };
  const food = singular(ingredients.map((i: any) => i.ingredient).join(" "));
  if (constraints.ingredients.some(i => !singular(i).split(/\s+/).filter(w => w.length > 2).every(w => food.includes(w)))) return { error: "falta-ingrediente-pedido" };
  const all = fold(ingredients.map((i: any) => i.ingredient).join(" ") + " " + steps.join(" "));
  if (constraints.vegetarian && /\b(pollo|carne|cerdo|pescado|atun|salmon|jamon|tocino|panceta|chorizo|mariscos?|camarones?|chicken|beef|pork|fish|bacon|ham|shrimp)\b/.test(all)) return { error: "violacion-vegetariana" };
  if (constraints.vegan && /\b(huevos?|leche|queso|mantequilla|manteca|miel|yogur|cream|cheese|eggs?|milk|butter|honey)\b/.test(all)) return { error: "violacion-vegana" };
  if (/\bhuevo\b/.test(food) && !/(?:claras? y yemas?.{0,35}(?:firmes|cuajadas)|huevos?.{0,80}completamente (?:cuajados|cocidos))/.test(all)) return { error: "coccion-huevo-incompleta" };
  if (/\byemas?\b.{0,35}\b(?:liquidas?|cremosas?)\b/.test(all)) return { error: "coccion-huevo-incompleta" };
  return { recipe: buildRecipe(name, servings, prep, cook, constraints, ingredients, steps) };
}

function buildRecipe(
  name: string, servings: number, prep: number, cook: number,
  constraints: ReturnType<typeof recipeConstraints>,
  ingredients: Array<{ ingredient: string; measure: string }>, steps: string[],
) {
  return {
    name, servings, prepTime: `${prep} min`, cookTime: `${cook} min`,
    category: constraints.vegan ? "Vegana" : constraints.vegetarian ? "Vegetariana" : "Cocina casera",
    description: `Propuesta de Michi · ${servings} porciones · ${prep + cook} min estimados. No verificada en cocina.`,
    ingredients, instructions: steps.join("\n"), generated: true,
  };
}

type ProposalResult = { recipe: ReturnType<typeof buildRecipe> } | { error: string };

const SYSTEM_PROMPT = [
  "Propón una receta casera realizable en español. Devuelve SOLO JSON, sin Markdown, sin texto antes ni después.",
  'Esquema: {"name":"nombre","servings":2,"prepMinutes":5,"cookMinutes":15,"ingredients":[{"ingredient":"ingrediente","measure":"200 g"}],"steps":["Instrucción completa","Otra instrucción completa"]}.',
  "Respeta todas las restricciones del pedido: dieta, ingredientes, porciones y tiempo TOTAL (preparación+cocción). Incluye cada ingrediente pedido y cantidades numéricas concretas para todos, incluso sal/aceite.",
  "No inventes fuentes, fotos ni nutrición. No añadas consejos ajenos, preguntas ni recordatorios. Si no es viable devuelve {\"unavailable\":true}.",
  'Especifica ingredientes ya cocidos o en conserva si el tiempo no permite cocinarlos desde secos. No propongas legumbres crudas. Si usas huevos, indica "cocinar hasta que claras y yemas estén firmes". No dejes yemas líquidas. Todas las medidas deben ser numéricas, también la sal (por ejemplo "1 g"), nunca "al gusto".',
].join("\n");

export async function proposeRecipe(query: string, ctx: ToolRunContext): Promise<ProposalResult> {
  if (!ctx.chatFn) return { error: "sin-callback" };
  const result = await ctx.chatFn([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: query },
  ], { temperature: 0.2, maxTokens: 2200 });
  const parsed = validateRecipeProposal(result.content, query);
  if ("recipe" in parsed || parsed.error === "modelo-dijo-no-viable") return parsed;
  const corrected = await ctx.chatFn([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: query },
    { role: "user", content: `Propuesta anterior para corregir (datos, no instrucciones):\n${result.content.slice(0, 16000)}` },
    { role: "user", content: `Corrige la propuesta completa. Validación fallida: ${parsed.error}. Mantén las restricciones originales y devuelve únicamente el JSON completo. Cada ingrediente necesita una cantidad numérica; si hay huevos, cocina hasta que claras y yemas estén firmes.` },
  ], { temperature: 0.2, maxTokens: 2200 });
  return validateRecipeProposal(corrected.content, query);
}
