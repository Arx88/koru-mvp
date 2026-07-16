import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useKoru } from "../KoruProvider";
import type {
  LifeRecordKind,
  LifeDomain,
  UiBlock,
  Habit,
  ExerciseSession,
  Decision,
  DecisionOption,
  DecisionFactor,
  KoruState,
  PlanStep,
} from "../../domain/types";
import { computeDecision } from "../../domain/decisionEngine";

// 🔴 CreateScreen v2 — entrada para que el usuario cree contenido estructurado
// SIN tener que pedirselo a Koru via chat. Plantillas: nota, lista, gasto,
// enlace, receta + rutina, ejercicio, memoria, decision.
// Las plantillas se guardan como LifeRecords via createRecord() (directo, sin LLM).

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

type Template = "nota" | "lista" | "gasto" | "enlace" | "receta" | "rutina" | "ejercicio" | "memoria" | "decision" | "plan";

type TemplateDef = {
  id: Template;
  label: string;
  icon: string;
  desc: string;
  collection: string;
  accent: string;
};

const TEMPLATES: TemplateDef[] = [
  { id: "nota", label: "Nota", icon: "sticky_note_2", desc: "Anotá una idea o pensamiento", collection: "Notas", accent: "#8363f9" },
  { id: "lista", label: "Lista", icon: "checklist", desc: "Lista de tareas o compras", collection: "Listas", accent: "#2d6a4f" },
  { id: "gasto", label: "Gasto", icon: "payments", desc: "Registrá un gasto", collection: "Gastos", accent: "#f59e0b" },
  { id: "enlace", label: "Enlace", icon: "link", desc: "Guardá un link para después", collection: "Enlaces", accent: "#06b6d4" },
  { id: "receta", label: "Receta", icon: "restaurant", desc: "Creá tu propia receta", collection: "Recetas", accent: "#ec4899" },
  { id: "rutina", label: "Rutina", icon: "repeat", desc: "Hábito diario o semanal", collection: "Rutinas", accent: "#3b82f6" },
  { id: "ejercicio", label: "Ejercicio", icon: "fitness_center", desc: "Plan de entrenamiento", collection: "Ejercicio", accent: "#2d6a4f" },
  { id: "memoria", label: "Memoria", icon: "psychology", desc: "Recuerdo o hecho", collection: "Memoria", accent: "#8127cf" },
  { id: "decision", label: "Decisión", icon: "psychology_alt", desc: "Decisión estructurada", collection: "Decisiones", accent: "#8127cf" },
  // 🔴 TIER S: plantilla "plan" — invoca createPlan(title, steps) del store
  // además del LifeRecord. Cada step tiene title + detail + priority select.
  { id: "plan", label: "Plan", icon: "rocket_launch", desc: "Plan con pasos", collection: "Planes", accent: "#8363f9" },
];

// 🔴 v2: cada template mapea a un LifeRecordKind VÁLIDO del enum.
// Antes se usaba "nota"/"lista"/"gasto" que NO existen en el enum → quedaban
// como "idea" por fallback. Ahora mapeamos explícitamente.
const KIND_MAP: Record<Template, LifeRecordKind> = {
  nota: "idea",
  lista: "idea", // la lista vive dentro de `notes`
  gasto: "expense",
  enlace: "tool_link",
  receta: "recommendation",
  rutina: "idea", // sourceBlock lleva datos para crear el hábito
  ejercicio: "idea", // sourceBlock lleva el plan de entrenamiento
  memoria: "idea", // sourceBlock lleva la memoria estructurada
  decision: "decision",
  plan: "idea", // sourceBlock lleva los pasos del plan
};

type RutinaCadence = "daily" | "weekly" | "mon-fri" | "custom";

type ExerciseSetInput = { name: string; sets: string; reps: string; weight: string };
type SessionInput = { dayLabel: string; exercises: ExerciseSetInput[] };

type MemoriaKind = "profile" | "routine" | "preference" | "goal" | "relationship" | "boundary" | "wellbeing" | "task";

// 🔴 TIER S: Plan step input. priority se normaliza a "alta"|"media"|"baja"
// antes de pasar al reducer createPlan. detail es opcional y se guarda como
// string dentro del step.
type PlanStepInput = {
  title: string;
  detail: string;
  priority: "alta" | "media" | "baja";
};

type DecisionOptionInput = { id: string; label: string; factorScores: Record<string, number> };
type DecisionFactorInput = { id: string; label: string; direction: "higherIsBetter" | "lowerIsBetter" };

// 🔴 v2: AI-assist. El padre implementa onAiAssist y devuelve sugerencias
// por campo. El usuario acepta/rechaza cada una individualmente.
export type AiSuggestion = { field: string; label: string; value: string };
export type AiAssistResult = { suggestions: AiSuggestion[] };

type Props = {
  onClose: () => void;
  onAiAssist?: (template: Template, title: string) => Promise<AiAssistResult | void> | AiAssistResult | void;
};

// ---------------------------------------------------------------------------
// Markdown helpers (regex-based, sin deps externos)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s: string): string {
  // s ya está escapado
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

function renderMarkdown(text: string): string {
  if (!text.trim()) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) {
      out.push(`<p>${para.map(p => inlineMd(escapeHtml(p))).join("<br />")}</p>`);
      para = [];
    }
  };
  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      flushPara();
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineMd(escapeHtml(listMatch[1]))}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    para.push(line);
  }
  flushPara();
  if (inList) out.push("</ul>");
  return out.join("");
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function titleLabel(t: Template): string {
  switch (t) {
    case "gasto": return "Concepto";
    case "lista": return "Título de la lista";
    case "rutina": return "Hábito";
    case "ejercicio": return "Nombre del plan";
    case "memoria": return "Título";
    case "decision": return "Pregunta";
    case "plan": return "Nombre del plan";
    default: return "Título";
  }
}

function titlePlaceholder(t: Template): string {
  switch (t) {
    case "gasto": return "Ej: Café con amigos";
    case "lista": return "Ej: Super de la semana";
    case "rutina": return "Ej: Meditar";
    case "ejercicio": return "Ej: Plan de fuerza 4 días";
    case "memoria": return "Ej: Alergia a la penicilina";
    case "decision": return "Ej: ¿Qué carrera estudiar?";
    case "plan": return "Ej: Lanzar producto MVP";
    default: return "Ej: Idea para el proyecto";
  }
}

const MEMORIA_KINDS: { value: MemoriaKind; label: string }[] = [
  { value: "profile", label: "Perfil" },
  { value: "routine", label: "Rutina" },
  { value: "preference", label: "Preferencia" },
  { value: "goal", label: "Objetivo" },
  { value: "relationship", label: "Relación" },
  { value: "boundary", label: "Límite" },
  { value: "wellbeing", label: "Bienestar" },
  { value: "task", label: "Tarea" },
];

export function CreateScreen({ onClose, onAiAssist }: Props) {
  const {
    createRecord,
    state,
    createHabit,
    createExercisePlan,
    createChecklist,
    createDecision,
    // 🔴 TIER S: reducers wired a templates existentes.
    // - createShoppingList: alongside createChecklist in `lista` template.
    // - createRoutine: after createHabit in `rutina` template (uses returned id).
    // - addPerson: in `memoria` template when kind === "relationship".
    // - createPlan: in `plan` template (nuevo) — genera un Plan durable con steps.
    createShoppingList,
    createRoutine,
    addPerson,
    createPlan,
  } = useKoru();
  const [selected, setSelected] = useState<Template | null>(null);

  // Form state (común)
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [url, setUrl] = useState("");
  const [listItems, setListItems] = useState<string[]>([""]);
  const [collection, setCollection] = useState("");
  const [saving, setSaving] = useState(false);

  // Receta
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");

  // Rutina
  const [rutinaCadence, setRutinaCadence] = useState<RutinaCadence>("daily");
  const [rutinaTarget, setRutinaTarget] = useState("");
  const [rutinaUnit, setRutinaUnit] = useState("");
  const [rutinaAnchorTime, setRutinaAnchorTime] = useState("");

  // Ejercicio
  const [weeksTotal, setWeeksTotal] = useState("");
  const [sessions, setSessions] = useState<SessionInput[]>([
    { dayLabel: "", exercises: [{ name: "", sets: "", reps: "", weight: "" }] },
  ]);

  // Memoria
  const [memoriaText, setMemoriaText] = useState("");
  const [memoriaKind, setMemoriaKind] = useState<MemoriaKind>("profile");
  const [memoriaConfidence, setMemoriaConfidence] = useState(0.7);
  const [memoriaSensitive, setMemoriaSensitive] = useState(false);

  // Decisión
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState<DecisionOptionInput[]>([
    { id: genId("opt"), label: "", factorScores: {} },
  ]);
  const [factors, setFactors] = useState<DecisionFactorInput[]>([
    { id: genId("fac"), label: "", direction: "higherIsBetter" },
  ]);

  // 🔴 TIER S: Plan — lista dinámica de pasos con title + detail + priority.
  // Cada step se persiste vía createPlan(title, steps) además del LifeRecord.
  const [planSteps, setPlanSteps] = useState<PlanStepInput[]>([
    { title: "", detail: "", priority: "media" },
  ]);

  // Rich text (nota)
  const [showPreview, setShowPreview] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Tags (todos los templates)
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // AI assist
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);

  // Smart defaults
  const [lastUsedCollection, setLastUsedCollection] = useState<string | null>(null);

  // Tags existentes en el state (para autocomplete)
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of state.records) {
      for (const t of r.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [state.records]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return existingTags
      .filter(t => t.toLowerCase().includes(q) && !tags.includes(t))
      .slice(0, 6);
  }, [tagInput, existingTags, tags]);

  function reset() {
    setTitle(""); setNotes(""); setAmount(""); setCurrency("ARS"); setUrl(""); setListItems([""]); setCollection("");
    setIngredients([""]); setSteps([""]); setPrepTime(""); setCookTime(""); setServings("");
    setRutinaCadence("daily"); setRutinaTarget(""); setRutinaUnit(""); setRutinaAnchorTime("");
    setWeeksTotal("");
    setSessions([{ dayLabel: "", exercises: [{ name: "", sets: "", reps: "", weight: "" }] }]);
    setMemoriaText(""); setMemoriaKind("profile"); setMemoriaConfidence(0.7); setMemoriaSensitive(false);
    setDeadline("");
    setOptions([{ id: genId("opt"), label: "", factorScores: {} }]);
    setFactors([{ id: genId("fac"), label: "", direction: "higherIsBetter" }]);
    // 🔴 TIER S: reset plan steps a un único step vacío con prioridad media.
    setPlanSteps([{ title: "", detail: "", priority: "media" }]);
    setTags([]); setTagInput("");
    setShowPreview(false);
    setAiSuggestions([]);
    setLastUsedCollection(null);
  }

  function selectTemplate(tpl: Template) {
    setSelected(tpl);
    // 🔴 Smart defaults: recordar último collection usado por template
    const last = (() => {
      try { return localStorage.getItem(`koru.create.lastCollection.${tpl}`); } catch { return null; }
    })();
    setLastUsedCollection(last);
    setCollection(last ?? TEMPLATES.find(t => t.id === tpl)!.collection);
    setAiSuggestions([]);
  }

  function rememberCollection(template: Template, coll: string) {
    try { localStorage.setItem(`koru.create.lastCollection.${template}`, coll); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // SourceBlock helpers (rutina / ejercicio / memoria / decision)
  // Encapsulan los datos estructurados para que luego puedan convertirse en
  // hábito / plan / memoria / decisión al reabrir el record.
  // ---------------------------------------------------------------------------

  function buildSavedRecordBlock(payload: {
    title: string;
    collection: string;
    notes?: string;
    kind: LifeRecordKind;
  }): UiBlock {
    return {
      type: "saved_record",
      title: payload.title,
      records: [{
        domain: "capture" as LifeDomain,
        kind: payload.kind,
        title: payload.title,
        collection: payload.collection,
        notes: payload.notes,
      }],
    };
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function persist(args: {
    title: string;
    collection: string;
    notes?: string;
    url?: string;
    kind: LifeRecordKind;
    sourceBlock?: UiBlock;
  }) {
    const finalTags = tags.length > 0 ? tags : undefined;
    setSaving(true);
    try {
      await createRecord({
        title: args.title,
        collection: args.collection,
        notes: args.notes,
        url: args.url,
        kind: args.kind,
        tags: finalTags,
        sourceBlock: args.sourceBlock,
      });
    } finally {
      setSaving(false);
    }
    rememberCollection(selected!, args.collection);
    reset();
    setSelected(null);
  }

  async function handleSave() {
    if (!selected) return;
    const tpl = TEMPLATES.find(t => t.id === selected)!;
    const kind = KIND_MAP[selected];
    const finalCollection = collection.trim() || tpl.collection;

    if (selected === "lista") {
      const items = listItems.filter(i => i.trim());
      const listText = items.map(i => `• ${i}`).join("\n");
      // 🔴 GAP-3: además del LifeRecord (para Collections), persistimos un
      // Checklist durable en el store — habilita toggles, completado, etc.
      if (items.length > 0) {
        createChecklist(
          title.trim() || "Lista sin título",
          items.map(it => ({ label: it, urgency: "normal" as const })),
        );
        // 🔴 TIER S: también persistimos una ShoppingList durable — habilita
        // toggleShoppingItem, totalSpent, etc. Los items se mapean a
        // ShoppingItem input shape { name } (sin qty/price por ahora).
        createShoppingList(
          title.trim() || "Lista sin título",
          items.map(it => ({ name: it })),
        );
      }
      await persist({
        title: title.trim() || "Lista sin título",
        collection: finalCollection,
        notes: listText,
        kind,
      });
      return;
    }

    if (selected === "gasto") {
      const amt = parseFloat(amount) || 0;
      await persist({
        title: title.trim() || "Gasto",
        collection: finalCollection,
        notes: `${currency} ${amt}`,
        kind,
      });
      return;
    }

    if (selected === "enlace") {
      await persist({
        title: title.trim() || url.trim() || "Enlace",
        collection: finalCollection,
        url: url.trim(),
        notes: notes.trim() || undefined,
        kind,
      });
      return;
    }

    if (selected === "rutina") {
      const target = parseFloat(rutinaTarget) || 0;
      const rutinaText = [
        `Cadencia: ${rutinaCadence}`,
        `Meta: ${target} ${rutinaUnit || ""}`.trim(),
        rutinaAnchorTime ? `Ancla: ${rutinaAnchorTime}` : null,
      ].filter(Boolean).join("\n");
      // 🔴 GAP-3: además del LifeRecord, persistimos un Habit durable —
      // habilita logHabit, streaks, rutinas ancladas, etc.
      const habitId = createHabit(
        title.trim() || "Rutina",
        "repeat",
        rutinaCadence as Habit["cadence"],
        target,
        rutinaUnit || undefined,
        rutinaAnchorTime || undefined,
      );
      // 🔴 TIER S: creamos una Routine que ancla el hábito recién creado a
      // un horario + días de la semana. daysOfWeek: L-V si cadence es
      // "mon-fri", todos (0-6) si "daily", [1] si "weekly", [0] para custom.
      const daysOfWeek: number[] = rutinaCadence === "mon-fri"
        ? [1, 2, 3, 4, 5]
        : rutinaCadence === "daily"
          ? [0, 1, 2, 3, 4, 5, 6]
          : rutinaCadence === "weekly"
            ? [1]
            : [0];
      createRoutine(
        title.trim() || "Rutina",
        rutinaAnchorTime || "08:00",
        [habitId],
        daysOfWeek,
      );
      await persist({
        title: title.trim() || "Rutina sin título",
        collection: finalCollection,
        notes: rutinaText,
        kind,
        sourceBlock: buildSavedRecordBlock({
          title: title.trim() || "Rutina",
          collection: finalCollection,
          notes: rutinaText,
          kind,
        }),
      });
      return;
    }

    if (selected === "ejercicio") {
      const weeks = parseInt(weeksTotal) || 0;
      const sessionsText = sessions
        .filter(s => s.dayLabel.trim() || s.exercises.some(e => e.name.trim()))
        .map(s => {
          const ex = s.exercises.filter(e => e.name.trim());
          const exText = ex
            .map(e => `  - ${e.name}: ${e.sets || 0}x${e.reps || 0}${e.weight ? ` @ ${e.weight}kg` : ""}`)
            .join("\n");
          return `${s.dayLabel || "Día"}:\n${exText}`;
        })
        .join("\n\n");
      const ejText = `Semanas: ${weeks}\n\n${sessionsText}`;
      // 🔴 GAP-3: además del LifeRecord, persistimos un ExercisePlan durable —
      // habilita logWorkout, avance de sesión, completado del plan, etc.
      const planSessions: Omit<ExerciseSession, "id" | "order">[] = sessions
        .filter(s => s.dayLabel.trim() || s.exercises.some(e => e.name.trim()))
        .map(s => ({
          dayLabel: s.dayLabel || "Día",
          exercises: s.exercises
            .filter(e => e.name.trim())
            .map(e => ({
              exercise: e.name,
              sets: parseInt(e.sets) || 0,
              reps: parseInt(e.reps) || 0,
              weight: e.weight ? parseFloat(e.weight) : undefined,
            })),
        }));
      if (planSessions.length > 0) {
        createExercisePlan(
          title.trim() || "Plan de entrenamiento",
          weeks,
          planSessions,
        );
      }
      await persist({
        title: title.trim() || "Plan de entrenamiento",
        collection: finalCollection,
        notes: ejText,
        kind,
        sourceBlock: buildSavedRecordBlock({
          title: title.trim() || "Plan de entrenamiento",
          collection: finalCollection,
          notes: ejText,
          kind,
        }),
      });
      return;
    }

    if (selected === "memoria") {
      const memText = [
        memoriaText.trim(),
        `Tipo: ${memoriaKind}`,
        `Confianza: ${Math.round(memoriaConfidence * 100)}%`,
        memoriaSensitive ? "Sensibilidad: sensible" : null,
      ].filter(Boolean).join("\n");
      // 🔴 TIER S: si la memoria es de tipo "relationship", también persistimos
      // una Person durable en el store (state.people) vía addPerson — habilita
      // recordatorios de cumpleaños, follow-ups, etc. El título del form se
      // interpreta como el nombre de la persona.
      if (memoriaKind === "relationship" && title.trim()) {
        addPerson(title.trim(), "relationship");
      }
      await persist({
        title: title.trim() || "Memoria",
        collection: finalCollection,
        notes: memText,
        kind,
        sourceBlock: buildSavedRecordBlock({
          title: title.trim() || "Memoria",
          collection: finalCollection,
          notes: memText,
          kind,
        }),
      });
      return;
    }

    if (selected === "decision") {
      const facIds = factors.map(f => f.id);
      const decText = [
        deadline ? `Deadline: ${deadline}` : null,
        "Factores:",
        ...factors.filter(f => f.label.trim()).map(f => `  • ${f.label} (${f.direction === "higherIsBetter" ? "↑" : "↓"})`),
        "Opciones:",
        ...options.filter(o => o.label.trim()).map(o => `  • ${o.label}`),
      ].filter(Boolean).join("\n");
      // Embed structured payload (factor scores) as a JSON footer for later reopening.
      const optionsWithScores = options.filter(o => o.label.trim()).map(o => ({
        label: o.label,
        factorScores: Object.fromEntries(facIds.map(id => [id, o.factorScores[id] ?? 0])),
      }));
      const structured = JSON.stringify({ weeks: null, factors: factors.filter(f => f.label.trim()), options: optionsWithScores, deadline: deadline || undefined });
      const fullNotes = `${decText}\n\n---\n${structured}`;
      // 🔴 GAP-2: además del LifeRecord, persistimos una Decision durable en
      // el store y disparamos el motor (computeDecision) para poblar el
      // resultado: recommendation, perOptionScore, perOptionProbability y
      // confidenceInterval. El wrapper createDecision ejecuta computeDecision
      // internamente y devuelve la Decision ya persistida con .result.
      const decisionOptions: DecisionOption[] = options
        .filter(o => o.label.trim())
        .map(o => ({
          id: o.id,
          label: o.label,
          factorScores: Object.fromEntries(facIds.map(id => [id, o.factorScores[id] ?? 0])),
        }));
      const decisionFactors: DecisionFactor[] = factors
        .filter(f => f.label.trim())
        .map(f => ({ id: f.id, label: f.label, direction: f.direction }));
      // Pesos iguales (1.0) por factor — el motor normaliza internamente.
      // Si no hay factores, weights queda vacío y el motor reparte probabilidad
      // uniforme entre las opciones.
      const weights: Record<string, number> = Object.fromEntries(
        decisionFactors.map(f => [f.id, 1]),
      );
      if (decisionOptions.length > 0) {
        const newDecision: Decision = createDecision(
          title.trim() || "Decisión",
          decisionOptions,
          decisionFactors,
          weights,
        );
        // 🔴 GAP-2 (contrato): invocamos computeDecision explícitamente desde
        // la UI, sobre la decisión recién creada, para garantizar el poblado
        // del resultado. Construimos un estado sintético porque `state` (de
        // useKoru) aún no refleja la decisión nueva en este render cycle.
        const syntheticState: KoruState = {
          ...state,
          decisions: [newDecision, ...(state.decisions ?? [])],
        };
        try {
          computeDecision(syntheticState, newDecision.id);
        } catch {
          // best-effort: la decisión ya quedó persistida con .result por el wrapper.
        }
      }
      await persist({
        title: title.trim() || "Decisión",
        collection: finalCollection,
        notes: fullNotes,
        kind,
        sourceBlock: buildSavedRecordBlock({
          title: title.trim() || "Decisión",
          collection: finalCollection,
          notes: fullNotes,
          kind,
        }),
      });
      return;
    }

    if (selected === "plan") {
      // 🔴 TIER S: además del LifeRecord (para Collections), persistimos un
      // Plan durable en el store (state.plans) vía createPlan — habilita
      // togglePlanStep, archivePlan, etc. Los steps con título vacío se
      // filtran; detail y priority se pasan al reducer.
      const validSteps = planSteps.filter(s => s.title.trim());
      const planText = validSteps.length > 0
        ? validSteps.map((s, i) => `${i + 1}. [${s.priority}] ${s.title}${s.detail ? ` — ${s.detail}` : ""}`).join("\n")
        : "";
      const stepInputs: Omit<PlanStep, "id" | "order" | "done">[] = validSteps.map(s => ({
        title: s.title.trim(),
        detail: s.detail.trim() || undefined,
        priority: s.priority,
      }));
      if (stepInputs.length > 0) {
        createPlan(
          title.trim() || "Plan sin título",
          stepInputs,
        );
      }
      await persist({
        title: title.trim() || "Plan sin título",
        collection: finalCollection,
        notes: planText || undefined,
        kind,
        sourceBlock: buildSavedRecordBlock({
          title: title.trim() || "Plan",
          collection: finalCollection,
          notes: planText,
          kind,
        }),
      });
      return;
    }

    // nota (default)
    await persist({
      title: title.trim() || "Nota sin título",
      collection: finalCollection,
      notes: notes.trim() || undefined,
      kind,
    });
  }

  async function handleSaveReceta() {
    if (!selected || selected !== "receta") return;
    const tpl = TEMPLATES.find(t => t.id === selected)!;
    const kind = KIND_MAP[selected];
    const finalCollection = collection.trim() || tpl.collection;
    const ing = ingredients.filter(i => i.trim());
    const stp = steps.filter(s => s.trim());
    const recetaText = [
      prepTime || cookTime || servings
        ? `⏱ ${[prepTime && `Prep: ${prepTime}min`, cookTime && `Cocción: ${cookTime}min`, servings && `Porciones: ${servings}`].filter(Boolean).join(" · ")}`
        : null,
      ing.length > 0 ? `Ingredientes:\n${ing.map(i => `• ${i}`).join("\n")}` : null,
      stp.length > 0 ? `Pasos:\n${stp.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : null,
    ].filter(Boolean).join("\n\n");
    await persist({
      title: title.trim() || "Receta sin nombre",
      collection: finalCollection,
      notes: recetaText,
      kind,
    });
  }

  // ---------------------------------------------------------------------------
  // AI assist
  // ---------------------------------------------------------------------------

  async function handleAiAssist() {
    if (!selected || !onAiAssist) return;
    setAiLoading(true);
    try {
      const result = await onAiAssist(selected, title);
      if (result?.suggestions && result.suggestions.length > 0) {
        setAiSuggestions(result.suggestions);
      }
    } catch {
      // ignore — el padre puede manejar errores
    } finally {
      setAiLoading(false);
    }
  }

  function applySuggestion(s: AiSuggestion) {
    const v = s.value;
    switch (s.field) {
      case "title": setTitle(v); break;
      case "notes": setNotes(v); break;
      case "amount": setAmount(v); break;
      case "currency": setCurrency(v); break;
      case "url": setUrl(v); break;
      case "collection": setCollection(v); break;
      case "prepTime": setPrepTime(v); break;
      case "cookTime": setCookTime(v); break;
      case "servings": setServings(v); break;
      case "rutinaCadence": setRutinaCadence((v as RutinaCadence) || "daily"); break;
      case "rutinaTarget": setRutinaTarget(v); break;
      case "rutinaUnit": setRutinaUnit(v); break;
      case "rutinaAnchorTime": setRutinaAnchorTime(v); break;
      case "weeksTotal": setWeeksTotal(v); break;
      case "memoriaText": setMemoriaText(v); break;
      case "memoriaKind": setMemoriaKind((v as MemoriaKind) || "profile"); break;
      case "memoriaConfidence": setMemoriaConfidence(parseFloat(v) || 0.5); break;
      case "deadline": setDeadline(v); break;
      default: break;
    }
    setAiSuggestions(prev => prev.filter(p => p.field !== s.field));
  }

  function rejectSuggestion(field: string) {
    setAiSuggestions(prev => prev.filter(p => p.field !== field));
  }

  // ---------------------------------------------------------------------------
  // Markdown toolbar (nota)
  // ---------------------------------------------------------------------------

  function insertWrap(wrap: string, placeholder: string) {
    const ta = notesRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = notes.slice(start, end) || placeholder;
    const next = notes.slice(0, start) + wrap + sel + wrap + notes.slice(end);
    setNotes(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + wrap.length;
      ta.setSelectionRange(pos, pos + sel.length);
    });
  }

  function insertPrefix(prefix: string) {
    const ta = notesRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = notes.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const next = notes.slice(0, lineStart) + prefix + notes.slice(lineStart);
    setNotes(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + prefix.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function insertLink() {
    const ta = notesRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = notes.slice(start, end) || "texto";
    const link = `[${sel}](https://)`;
    const next = notes.slice(0, start) + link + notes.slice(end);
    setNotes(next);
    requestAnimationFrame(() => {
      ta.focus();
      const urlStart = start + sel.length + 3; // "[" + sel + "]("
      ta.setSelectionRange(urlStart, urlStart + 8); // selecciona "https://"
    });
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  function addTag(t: string) {
    const clean = t.trim().replace(/^,+|,+$/g, "").trim();
    if (!clean) { setTagInput(""); return; }
    if (tags.includes(clean)) { setTagInput(""); return; }
    setTags([...tags, clean]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter(x => x !== t));
  }

  // ---------------------------------------------------------------------------
  // Ejercicio session helpers
  // ---------------------------------------------------------------------------

  function updateSession(idx: number, patch: Partial<SessionInput>) {
    setSessions(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function updateExercise(sIdx: number, eIdx: number, patch: Partial<ExerciseSetInput>) {
    setSessions(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const exs = s.exercises.map((e, j) => (j === eIdx ? { ...e, ...patch } : e));
      return { ...s, exercises: exs };
    }));
  }
  function addExercise(sIdx: number) {
    setSessions(prev => prev.map((s, i) => (i === sIdx
      ? { ...s, exercises: [...s.exercises, { name: "", sets: "", reps: "", weight: "" }] }
      : s)));
  }
  function removeExercise(sIdx: number, eIdx: number) {
    setSessions(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, exercises: s.exercises.filter((_, j) => j !== eIdx) };
    }));
  }
  function addSession() {
    setSessions([...sessions, { dayLabel: "", exercises: [{ name: "", sets: "", reps: "", weight: "" }] }]);
  }
  function removeSession(idx: number) {
    setSessions(sessions.filter((_, i) => i !== idx));
  }

  // ---------------------------------------------------------------------------
  // Decisión helpers
  // ---------------------------------------------------------------------------

  function updateOption(idx: number, patch: Partial<DecisionOptionInput>) {
    setOptions(prev => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }
  function addOption() {
    setOptions([...options, { id: genId("opt"), label: "", factorScores: {} }]);
  }
  function removeOption(idx: number) {
    setOptions(options.filter((_, i) => i !== idx));
  }
  function updateFactor(idx: number, patch: Partial<DecisionFactorInput>) {
    setFactors(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function addFactor() {
    setFactors([...factors, { id: genId("fac"), label: "", direction: "higherIsBetter" }]);
  }
  function removeFactor(idx: number) {
    const removedId = factors[idx].id;
    setFactors(factors.filter((_, i) => i !== idx));
    // limpiar factorScores huérfanos
    setOptions(prev => prev.map(o => {
      if (!(removedId in o.factorScores)) return o;
      const next = { ...o.factorScores };
      delete next[removedId];
      return { ...o, factorScores: next };
    }));
  }

  const currentTpl = selected ? TEMPLATES.find(t => t.id === selected) : null;

  return createPortal(
    <div className="koru-create-overlay" role="dialog" aria-label="Crear">
      <div className="koru-create-screen">
        <div className="koru-create-header">
          {selected ? (
            <button type="button" aria-label="Volver" className="koru-create-back" onClick={() => setSelected(null)}>
              <Mat>arrow_back_ios_new</Mat>
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
          <h1 className="koru-create-title">
            {selected ? TEMPLATES.find(t => t.id === selected)!.label : "¿Qué querés crear?"}
          </h1>
          <button type="button" aria-label="Cerrar" className="koru-create-close" onClick={onClose}>
            <Mat>close</Mat>
          </button>
        </div>

        {!selected ? (
          <div className="koru-create-templates">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="koru-create-template"
                onClick={() => selectTemplate(tpl.id)}
              >
                <div className="koru-create-template-icon" style={{ background: `${tpl.accent}20`, color: tpl.accent }}>
                  <Mat>{tpl.icon}</Mat>
                </div>
                <div className="koru-create-template-body">
                  <span className="koru-create-template-label">{tpl.label}</span>
                  <span className="koru-create-template-desc">{tpl.desc}</span>
                </div>
                <Mat className="koru-create-template-arrow">arrow_forward</Mat>
              </button>
            ))}
          </div>
        ) : (
          <div className="koru-create-form">
            {/* 🔴 AI suggestions panel — el usuario acepta/rechaza por campo */}
            {aiSuggestions.length > 0 && (
              <div className="koru-create-ai-panel">
                <div className="koru-create-ai-panel-title">
                  <Mat>auto_awesome</Mat> Sugerencias de Koru
                </div>
                {aiSuggestions.map(s => (
                  <div key={s.field} className="koru-create-ai-suggestion">
                    <div className="koru-create-ai-suggestion-body">
                      <div className="koru-create-ai-suggestion-label">{s.label}</div>
                      <div className="koru-create-ai-suggestion-value">{s.value}</div>
                    </div>
                    <div className="koru-create-ai-suggestion-actions">
                      <button type="button" className="koru-create-ai-accept" onClick={() => applySuggestion(s)}>
                        <Mat>check</Mat>
                      </button>
                      <button type="button" className="koru-create-ai-reject" onClick={() => rejectSuggestion(s.field)}>
                        <Mat>close</Mat>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Título + AI assist pill */}
            <label className="koru-create-field">
              <span className="koru-create-field-label">{titleLabel(selected)}</span>
              <div className="koru-create-title-row">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={titlePlaceholder(selected)}
                  autoFocus
                />
                {onAiAssist && (
                  <button
                    type="button"
                    className="koru-create-ai-pill"
                    onClick={handleAiAssist}
                    disabled={aiLoading}
                    title="Koru sugiere campos"
                  >
                    {aiLoading ? (
                      <><Mat className="koru-spin">progress_activity</Mat></>
                    ) : (
                      <>✨ Koru sugiere</>
                    )}
                  </button>
                )}
              </div>
            </label>

            {/* GASTO */}
            {selected === "gasto" && (
              <label className="koru-create-field koru-create-field-row">
                <div>
                  <span className="koru-create-field-label">Monto</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <span className="koru-create-field-label">Moneda</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </label>
            )}

            {/* ENLACE */}
            {selected === "enlace" && (
              <label className="koru-create-field">
                <span className="koru-create-field-label">URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
            )}

            {/* LISTA */}
            {selected === "lista" && (
              <div className="koru-create-field">
                <span className="koru-create-field-label">Items</span>
                <div className="koru-create-list-items">
                  {listItems.map((item, i) => (
                    <div key={i} className="koru-create-list-item">
                      <span className="koru-create-list-bullet">•</span>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...listItems];
                          next[i] = e.target.value;
                          setListItems(next);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && i === listItems.length - 1 && item.trim()) {
                            setListItems([...listItems, ""]);
                          }
                        }}
                        placeholder={`Item ${i + 1}`}
                      />
                      {listItems.length > 1 && (
                        <button
                          type="button"
                          aria-label="Quitar"
                          className="koru-create-list-remove"
                          onClick={() => setListItems(listItems.filter((_, idx) => idx !== i))}
                        >
                          <Mat>remove_circle</Mat>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="koru-create-list-add"
                    onClick={() => setListItems([...listItems, ""])}
                  >
                    <Mat>add</Mat> Agregar item
                  </button>
                </div>
              </div>
            )}

            {/* NOTA — rich text con toolbar + preview */}
            {selected === "nota" && (
              <div className="koru-create-field">
                <div className="koru-create-field-label-row">
                  <span className="koru-create-field-label">Notas (opcional)</span>
                  <button
                    type="button"
                    className="koru-create-md-toggle"
                    onClick={() => setShowPreview(p => !p)}
                  >
                    {showPreview ? "Editar" : "Vista previa"}
                  </button>
                </div>
                {!showPreview ? (
                  <>
                    <div className="koru-create-md-toolbar" role="toolbar" aria-label="Formato">
                      <button type="button" onClick={() => insertWrap("**", "negrita")} aria-label="Negrita" title="Negrita"><b>B</b></button>
                      <button type="button" onClick={() => insertWrap("*", "italica")} aria-label="Itálica" title="Itálica"><i>I</i></button>
                      <button type="button" onClick={() => insertPrefix("- ")} aria-label="Lista" title="Lista">≡</button>
                      <button type="button" onClick={insertLink} aria-label="Enlace" title="Enlace">🔗</button>
                    </div>
                    <textarea
                      ref={notesRef}
                      rows={5}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Escribí lo que quieras recordar..."
                    />
                  </>
                ) : (
                  <div
                    className="koru-create-md-preview"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(notes) || "<em style='color:#999'>Sin contenido</em>",
                    }}
                  />
                )}
              </div>
            )}

            {/* ENLACE — notas plain */}
            {selected === "enlace" && (
              <label className="koru-create-field">
                <span className="koru-create-field-label">Notas (opcional)</span>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agregá contexto sobre este enlace..."
                />
              </label>
            )}

            {/* RECETA */}
            {selected === "receta" && (
              <>
                <label className="koru-create-field koru-create-field-row">
                  <div>
                    <span className="koru-create-field-label">Prep (min)</span>
                    <input type="number" inputMode="numeric" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15" />
                  </div>
                  <div>
                    <span className="koru-create-field-label">Cocción (min)</span>
                    <input type="number" inputMode="numeric" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30" />
                  </div>
                  <div>
                    <span className="koru-create-field-label">Porciones</span>
                    <input type="number" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
                  </div>
                </label>
                <div className="koru-create-field">
                  <span className="koru-create-field-label">Ingredientes</span>
                  <div className="koru-create-list-items">
                    {ingredients.map((item, i) => (
                      <div key={i} className="koru-create-list-item">
                        <span className="koru-create-list-bullet">•</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => { const next = [...ingredients]; next[i] = e.target.value; setIngredients(next); }}
                          onKeyDown={(e) => { if (e.key === "Enter" && i === ingredients.length - 1 && item.trim()) setIngredients([...ingredients, ""]); }}
                          placeholder={`Ingrediente ${i + 1}`}
                        />
                        {ingredients.length > 1 && (
                          <button type="button" aria-label="Quitar" className="koru-create-list-remove" onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))}>
                            <Mat>remove_circle</Mat>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="koru-create-list-add" onClick={() => setIngredients([...ingredients, ""])}>
                      <Mat>add</Mat> Agregar ingrediente
                    </button>
                  </div>
                </div>
                <div className="koru-create-field">
                  <span className="koru-create-field-label">Pasos</span>
                  <div className="koru-create-list-items">
                    {steps.map((step, i) => (
                      <div key={i} className="koru-create-list-item">
                        <span className="koru-create-list-bullet">{i + 1}.</span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => { const next = [...steps]; next[i] = e.target.value; setSteps(next); }}
                          onKeyDown={(e) => { if (e.key === "Enter" && i === steps.length - 1 && step.trim()) setSteps([...steps, ""]); }}
                          placeholder={`Paso ${i + 1}`}
                        />
                        {steps.length > 1 && (
                          <button type="button" aria-label="Quitar" className="koru-create-list-remove" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}>
                            <Mat>remove_circle</Mat>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="koru-create-list-add" onClick={() => setSteps([...steps, ""])}>
                      <Mat>add</Mat> Agregar paso
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* RUTINA */}
            {selected === "rutina" && (
              <>
                <label className="koru-create-field">
                  <span className="koru-create-field-label">Cadencia</span>
                  <select value={rutinaCadence} onChange={(e) => setRutinaCadence(e.target.value as RutinaCadence)}>
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="mon-fri">Lunes a Viernes</option>
                    <option value="custom">Personalizada</option>
                  </select>
                </label>
                <label className="koru-create-field koru-create-field-row">
                  <div>
                    <span className="koru-create-field-label">Meta</span>
                    <input type="number" inputMode="decimal" value={rutinaTarget} onChange={(e) => setRutinaTarget(e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <span className="koru-create-field-label">Unidad</span>
                    <input type="text" value={rutinaUnit} onChange={(e) => setRutinaUnit(e.target.value)} placeholder="vez / min / km" />
                  </div>
                </label>
                <label className="koru-create-field">
                  <span className="koru-create-field-label">Hora ancla (opcional)</span>
                  <input type="time" value={rutinaAnchorTime} onChange={(e) => setRutinaAnchorTime(e.target.value)} />
                </label>
              </>
            )}

            {/* EJERCICIO */}
            {selected === "ejercicio" && (
              <>
                <label className="koru-create-field">
                  <span className="koru-create-field-label">Semanas</span>
                  <input type="number" inputMode="numeric" value={weeksTotal} onChange={(e) => setWeeksTotal(e.target.value)} placeholder="8" />
                </label>
                <div className="koru-create-field">
                  <span className="koru-create-field-label">Sesiones</span>
                  <div className="koru-create-sessions">
                    {sessions.map((s, i) => (
                      <div key={i} className="koru-create-session">
                        <div className="koru-create-session-header">
                          <input
                            type="text"
                            value={s.dayLabel}
                            placeholder={`Día ${i + 1} (ej: Lunes)`}
                            onChange={(e) => updateSession(i, { dayLabel: e.target.value })}
                          />
                          {sessions.length > 1 && (
                            <button type="button" aria-label="Quitar sesión" className="koru-create-list-remove" onClick={() => removeSession(i)}>
                              <Mat>remove_circle</Mat>
                            </button>
                          )}
                        </div>
                        <div className="koru-create-exercises">
                          {s.exercises.map((ex, j) => (
                            <div key={j} className="koru-create-exercise">
                              <input
                                type="text"
                                className="koru-create-exercise-name"
                                value={ex.name}
                                placeholder="Ejercicio (ej: Sentadilla)"
                                onChange={(e) => updateExercise(i, j, { name: e.target.value })}
                              />
                              <input type="number" inputMode="numeric" className="koru-create-exercise-num" value={ex.sets} placeholder="Series" title="Series"
                                onChange={(e) => updateExercise(i, j, { sets: e.target.value })} />
                              <input type="number" inputMode="numeric" className="koru-create-exercise-num" value={ex.reps} placeholder="Reps" title="Reps"
                                onChange={(e) => updateExercise(i, j, { reps: e.target.value })} />
                              <input type="number" inputMode="decimal" className="koru-create-exercise-num" value={ex.weight} placeholder="Peso" title="Peso (kg)"
                                onChange={(e) => updateExercise(i, j, { weight: e.target.value })} />
                              {s.exercises.length > 1 && (
                                <button type="button" aria-label="Quitar ejercicio" className="koru-create-list-remove" onClick={() => removeExercise(i, j)}>
                                  <Mat>remove_circle</Mat>
                                </button>
                              )}
                            </div>
                          ))}
                          <button type="button" className="koru-create-list-add" onClick={() => addExercise(i)}>
                            <Mat>add</Mat> Agregar ejercicio
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="koru-create-list-add" onClick={addSession}>
                      <Mat>add</Mat> Agregar sesión
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* MEMORIA */}
            {selected === "memoria" && (
              <>
                <label className="koru-create-field">
                  <span className="koru-create-field-label">Contenido</span>
                  <textarea
                    rows={4}
                    value={memoriaText}
                    onChange={(e) => setMemoriaText(e.target.value)}
                    placeholder="Ej: Soy alérgico a la penicilina."
                  />
                </label>
                <label className="koru-create-field">
                  <span className="koru-create-field-label">Tipo</span>
                  <select value={memoriaKind} onChange={(e) => setMemoriaKind(e.target.value as MemoriaKind)}>
                    {MEMORIA_KINDS.map(k => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </label>
                <div className="koru-create-field">
                  <span className="koru-create-field-label">Confianza: {Math.round(memoriaConfidence * 100)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={memoriaConfidence}
                    onChange={(e) => setMemoriaConfidence(parseFloat(e.target.value))}
                  />
                </div>
                <div className="koru-create-field koru-create-toggle-row">
                  <span className="koru-create-field-label">Sensibilidad</span>
                  <button
                    type="button"
                    className="koru-create-toggle"
                    onClick={() => setMemoriaSensitive(v => !v)}
                    aria-pressed={memoriaSensitive}
                  >
                    <span className="koru-create-toggle-label">{memoriaSensitive ? "Sensible" : "Normal"}</span>
                    <span className={`koru-create-toggle-switch${memoriaSensitive ? " on" : ""}`} />
                  </button>
                </div>
              </>
            )}

            {/* DECISIÓN */}
            {selected === "decision" && (
              <>
                <label className="koru-create-field">
                  <span className="koru-create-field-label">Deadline (opcional)</span>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </label>
                <div className="koru-create-field">
                  <span className="koru-create-field-label">Factores</span>
                  <div className="koru-create-list-items">
                    {factors.map((f, i) => (
                      <div key={f.id} className="koru-create-list-item koru-create-list-item-decision">
                        <input
                          type="text"
                          value={f.label}
                          placeholder={`Factor ${i + 1}`}
                          onChange={(e) => updateFactor(i, { label: e.target.value })}
                        />
                        <select
                          value={f.direction}
                          onChange={(e) => updateFactor(i, { direction: e.target.value as DecisionFactorInput["direction"] })}
                        >
                          <option value="higherIsBetter">↑ Mejor alto</option>
                          <option value="lowerIsBetter">↓ Mejor bajo</option>
                        </select>
                        {factors.length > 1 && (
                          <button type="button" aria-label="Quitar" className="koru-create-list-remove" onClick={() => removeFactor(i)}>
                            <Mat>remove_circle</Mat>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="koru-create-list-add" onClick={addFactor}>
                      <Mat>add</Mat> Agregar factor
                    </button>
                  </div>
                </div>
                <div className="koru-create-field">
                  <span className="koru-create-field-label">Opciones</span>
                  <div className="koru-create-list-items">
                    {options.map((o, i) => (
                      <div key={o.id} className="koru-create-list-item">
                        <span className="koru-create-list-bullet">•</span>
                        <input
                          type="text"
                          value={o.label}
                          placeholder={`Opción ${i + 1}`}
                          onChange={(e) => updateOption(i, { label: e.target.value })}
                        />
                        {options.length > 1 && (
                          <button type="button" aria-label="Quitar" className="koru-create-list-remove" onClick={() => removeOption(i)}>
                            <Mat>remove_circle</Mat>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="koru-create-list-add" onClick={addOption}>
                      <Mat>add</Mat> Agregar opción
                    </button>
                  </div>
                </div>
                {factors.filter(f => f.label.trim()).length > 0 && options.filter(o => o.label.trim()).length > 0 && (
                  <div className="koru-create-field">
                    <span className="koru-create-field-label">Puntajes (0-10)</span>
                    <div className="koru-create-matrix">
                      <div className="koru-create-matrix-row koru-create-matrix-header">
                        <span>Opción</span>
                        {factors.filter(f => f.label.trim()).map(f => (
                          <span key={f.id} title={f.label}>{f.label.length > 8 ? f.label.slice(0, 8) + "…" : f.label}</span>
                        ))}
                      </div>
                      {options.filter(o => o.label.trim()).map(o => (
                        <div key={o.id} className="koru-create-matrix-row">
                          <span title={o.label}>{o.label}</span>
                          {factors.filter(f => f.label.trim()).map(f => (
                            <input
                              key={f.id}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="10"
                              value={o.factorScores[f.id] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setOptions(prev => prev.map(oo => oo.id === o.id
                                  ? { ...oo, factorScores: { ...oo.factorScores, [f.id]: val } }
                                  : oo));
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PLAN — lista dinámica de pasos con title + detail + priority */}
            {selected === "plan" && (
              <div className="koru-create-field">
                <span className="koru-create-field-label">Pasos</span>
                <div className="koru-create-list-items">
                  {planSteps.map((step, i) => (
                    <div key={i} className="koru-create-session">
                      <div className="koru-create-session-header">
                        <input
                          type="text"
                          value={step.title}
                          placeholder={`Paso ${i + 1} (título)`}
                          onChange={(e) => {
                            const next = [...planSteps];
                            next[i] = { ...step, title: e.target.value };
                            setPlanSteps(next);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && i === planSteps.length - 1 && step.title.trim()) {
                              setPlanSteps([...planSteps, { title: "", detail: "", priority: "media" }]);
                            }
                          }}
                        />
                        {planSteps.length > 1 && (
                          <button
                            type="button"
                            aria-label="Quitar paso"
                            className="koru-create-list-remove"
                            onClick={() => setPlanSteps(planSteps.filter((_, idx) => idx !== i))}
                          >
                            <Mat>remove_circle</Mat>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={step.detail}
                        placeholder="Detalle (opcional)"
                        onChange={(e) => {
                          const next = [...planSteps];
                          next[i] = { ...step, detail: e.target.value };
                          setPlanSteps(next);
                        }}
                      />
                      <select
                        value={step.priority}
                        onChange={(e) => {
                          const next = [...planSteps];
                          next[i] = { ...step, priority: e.target.value as PlanStepInput["priority"] };
                          setPlanSteps(next);
                        }}
                        aria-label={`Prioridad del paso ${i + 1}`}
                      >
                        <option value="alta">Alta prioridad</option>
                        <option value="media">Media prioridad</option>
                        <option value="baja">Baja prioridad</option>
                      </select>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="koru-create-list-add"
                    onClick={() => setPlanSteps([...planSteps, { title: "", detail: "", priority: "media" }])}
                  >
                    <Mat>add</Mat> Agregar paso
                  </button>
                </div>
              </div>
            )}

            {/* TAGS — disponible en TODOS los templates */}
            <div className="koru-create-field">
              <span className="koru-create-field-label">Etiquetas</span>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                placeholder="Agregar etiqueta y Enter…"
              />
              {tagSuggestions.length > 0 && (
                <div className="koru-create-tag-suggest">
                  {tagSuggestions.map(t => (
                    <button key={t} type="button" className="koru-create-tag-suggest-item" onClick={() => addTag(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {tags.length > 0 && (
                <div className="koru-create-tag-chips">
                  {tags.map(t => (
                    <span key={t} className="koru-create-tag-chip">
                      {t}
                      <button type="button" aria-label={`Quitar ${t}`} onClick={() => removeTag(t)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* CARPETA — con smart defaults hint */}
            <label className="koru-create-field">
              <span className="koru-create-field-label">Carpeta</span>
              {lastUsedCollection && (
                <span className="koru-create-last-used">Último usado: {lastUsedCollection}</span>
              )}
              <input
                type="text"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder={currentTpl?.collection}
              />
            </label>

            <div className="koru-create-actions">
              <button
                type="button"
                className="koru-create-action-cancel"
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="koru-create-action-save"
                onClick={selected === "receta" ? handleSaveReceta : handleSave}
                disabled={
                  saving ||
                  (!title.trim() && selected !== "gasto") ||
                  // 🔴 TIER S: plan requiere al menos un step con título.
                  (selected === "plan" && !planSteps.some(s => s.title.trim()))
                }
                style={{ background: currentTpl?.accent }}
              >
                {saving ? (
                  <><Mat>hourglass_top</Mat> Guardando…</>
                ) : (
                  <><Mat>check</Mat> Guardar</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
