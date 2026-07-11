import type {
  AssistantAction,
  AssistantActionKind,
  AssistantActionPayload,
  CalendarEvent,
  Commitment,
  ContextReviewItem,
  DailyEntry,
  KoruState,
  LifeRecord,
  ProactiveNudge,
} from "./types";
import { upcomingCalendarEvents } from "./calendar";
import { foldAccents, uniqueCommitmentList } from "./commitments";
import {
  cleanupShoppingTaskTitle,
  extractShoppingItems,
  hasShoppingIntent,
  hasTaskCue,
  isNewsIntent,
  isWorldSignalIntent,
} from "./intent";
import { dueAtFromText, dueLabel } from "./time";

type ActionProposal = Omit<AssistantAction, "id" | "createdAt" | "sourceEntryId">;
type CommitmentLike = Pick<Commitment, "title" | "dueHint"> & {
  id?: string;
  createdAt?: string;
  dueAt?: string;
  recurrence?: Commitment["recurrence"];
  status?: Commitment["status"];
};
type PlanningContext = Pick<KoruState, "commitments" | "calendarEvents" | "memories" | "entries" | "nudges" | "actions" | "records">;
type RecordDraft = Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">;

export type ActionDraft = {
  kind?: AssistantActionKind;
  title?: string;
  body?: string;
  payload?: AssistantActionPayload;
  source_commitment_title?: string;
};

type TaskCandidate = {
  title: string;
  priority: "Alta" | "Media" | "Baja";
  source: "input" | "commitment" | "calendar" | "memory" | "nudge" | "recent";
  detail?: string;
};

function sentenceCase(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function normalizedIncludes(text: string, words: string[]): boolean {
  return includesAny(foldAccents(text), words);
}

function isPlanningIntent(text: string): boolean {
  const normalized = foldAccents(text);
  if (/^\s*(prefiero|me gusta|no me gusta|quiero que koru|me sirve que)\b/i.test(normalized)) return false;
  return /(\bno se que hacer\b|\bno tengo nada\b|\bno se por donde\b|\bque hago\b|\bque hacemos\b|\bque podria hacer\b|\bque deberia hacer\b|\bpor donde empiezo\b|\bpor donde empezar\b|\bmuchas cosas\b|\bmil cosas\b|\bque tengo pendiente\b|\bpendientes\b|\bprioridad\b|\borganiza\b|\bordename\b|\barmame un plan\b|\bplan de hoy\b|\bestoy perdido\b|\bestoy trabado\b)/i.test(normalized);
}

function isDocumentIntent(text: string): boolean {
  return normalizedIncludes(text, [
    "entregable",
    "entregables",
    "presentacion",
    "resumen ejecutivo",
    "archivo",
    "archivos",
    "documento",
    "documentos",
    "preparame un pdf",
    "preparame archivos",
    "cv",
    "curriculum",
    "informe",
    "propuesta",
  ]);
}

function isResearchIntent(text: string): boolean {
  const lower = foldAccents(text);
  if (isDecisionIntent(text)) return false;
  if (/\b(anota(?:r)?\s+gasto|gaste|gast[eé]|pague|pagu[eé]|cuanto gaste|resumen de gastos)\b/i.test(lower)) {
    return false;
  }
  if (isNewsIntent(text) || isWorldSignalIntent(text)) return true;
  return normalizedIncludes(text, [
    "clima",
    "temperatura",
    "lluvia",
    "que ponerme",
    "trafico",
    "ruta",
    "mercado",
    "mercados",
    "acciones",
    "portfolio",
    "portafolio",
    "bitcoin",
    "btc",
    "eth",
    "deep research",
    "busqueda profunda",
    "búsqueda profunda",
    "internet",
    "web",
    "fuente",
    "fuentes",
    "buscar",
    "busca",
    "buscame",
    "investiga",
    "comprar",
    "precio",
    "entrega",
    "comparar",
    "comparativa",
  ]);
}

function isMoneySummaryIntent(text: string): boolean {
  const lower = foldAccents(text);
  if (!/\b(cuanto|cuanto llevo|cuanto gaste|gastos?|gaste esta semana|resumen de gastos|dinero|presupuesto)\b/i.test(lower)) return false;
  if (/\b(anota(?:r)?\s+gasto|registre|registr[aá]|guardar|guarda)\b/i.test(lower)) return false;
  if (/\b(gaste|gast[eé]|pague|pagu[eé])\b/i.test(lower) && !/\b(cuanto|resumen|total|llevo)\b/i.test(lower)) return false;
  return /\b(cuanto|cuanto llevo|cuanto gaste|gastos?|gaste esta semana|resumen de gastos|dinero|presupuesto)\b/i.test(lower);
}

function isSimpleWeatherIntent(text: string): boolean {
  const lower = foldAccents(text);
  return /\b(clima|temperatura|lluvia|que ponerme|ropa)\b/i.test(lower);
}

function isWeatherFollowupReady(text: string): boolean {
  const lower = foldAccents(text);
  if (!isSimpleWeatherIntent(text)) return false;
  if (/\b(en|de|para)\s+[a-z]/i.test(lower)) return true;
  const knownLocations = ["madrid", "barcelona", "buenos aires", "cordoba", "new york", "nueva york", "miami", "san francisco"];
  return knownLocations.some((location) => lower.includes(location));
}

function isOnlySimpleWeatherIntent(text: string): boolean {
  const lower = foldAccents(text);
  if (!isSimpleWeatherIntent(text)) return false;
  return !/\b(buen dia|buenos dias|arrancar el dia|brief|resumen|que tengo hoy|como viene el dia|trafico|medicamento|comer en casa|reunion|agenda|noticias)\b/i.test(lower);
}

function isMorningBriefIntent(text: string): boolean {
  const lower = foldAccents(text);
  if (isOnlySimpleWeatherIntent(text)) return false;
  const explicitBrief = /\b(buen dia|buenos dias|arrancar el dia|brief|resumen de manana|que tengo hoy|que tengo manana|como viene el dia|que me pongo|medicamento|que tengo para comer|comer en casa)\b/i.test(lower);
  const multiSignalBrief = /\b(clima|trafico|noticias|medicamento|comer en casa)\b/i.test(lower) && /\b(manana|hoy|reunion|agenda|dia)\b/i.test(lower);
  if (!explicitBrief && !multiSignalBrief) return false;
  return /\b(manana|buen dia|buenos dias|arrancar el dia|brief|resumen de manana|que tengo hoy|que tengo manana|como viene el dia|que me pongo|tr[aá]fico|trafico|clima|medicamento|que tengo para comer|comer en casa)\b/i.test(lower);
}

function isMealInventoryIntent(text: string): boolean {
  const lower = foldAccents(text);
  return /\b(que tengo para comer|comer en casa|tengo en casa|heladera|nevera|despensa|freezer|cena|almuerzo)\b/i.test(lower);
}

function isMeetingIntent(text: string): boolean {
  const lower = foldAccents(text);
  return /\b(reunion|reuniones|meeting|minuta|notas durante|preparar reunion|seguimiento|follow.?up|pendiente con)\b/i.test(lower);
}

function isDecisionIntent(text: string): boolean {
  const lower = foldAccents(text);
  return /\b(puedo permitirme|me conviene|decidir|decision|vale la pena|comprarlo|comprar esto|permitir)\b/i.test(lower);
}

function isStructuredCaptureIntent(text: string): boolean {
  if (/\b(que tengo|cuanto|cual|cuales|dime|decime|mostrame|muestrame|recuerdas|recordas)\b/i.test(foldAccents(text)) || /[?¿]/.test(text)) {
    return false;
  }
  if (isDecisionIntent(text)) return false;
  if (hasShoppingIntent(text)) return true;
  const lower = foldAccents(text);
  return /\b(anota|anotar|registre|registr[aá]|guardar|guarda|captura|idea|me recomendaron|empece|empec[eé]|link|enlace|herramienta|cumple|regale|regal[eé]|dormi|dorm[ií]|gaste|gast[eé]|pague|pagu[eé]|tengo arroz|tengo pollo|tengo huevos|hay en casa)\b/i.test(lower);
}

function isTaskLike(text: string): boolean {
  return hasTaskCue(text);
}

function isLifeCaptureIntent(text: string): boolean {
  const lower = foldAccents(text);
  if (/\b(que tengo|cuanto|cual|cuales|dime|decime|mostrame|muestrame|recuerdas|recordas)\b/i.test(lower) || /[?¿]/.test(text)) {
    return false;
  }
  return /\b(factura|medicamento|medicacion|pastilla|turno medico|medico|serie|libro|restaurante|viaje|paquete|seguro|plomero|fontanero|cumpleanos|cumple|regalo|herramienta|enlace|link|idea|no quiero perder|tengo .*en casa|hay .*en casa)\b/i.test(lower);
}

function isNoContextStatement(text: string): boolean {
  const lower = foldAccents(text);
  return /(\bno tengo nada\b|\bno tengo nada claro\b|\bno se que hacer\b|\bno se por donde\b|\btengo muchas cosas en la cabeza\b|\bmuchas cosas en la cabeza\b|\bestoy perdido\b|\bestoy trabado\b)/i.test(
    lower,
  );
}

function taskPriority(text: string, dueHint = ""): "Alta" | "Media" | "Baja" {
  const lower = foldAccents(`${text} ${dueHint}`);
  if (includesAny(lower, ["hoy", "ahora", "urgente"])) return "Alta";
  if (includesAny(lower, ["manana", "reunion", "socio", "cliente", "proveedor", "demo"])) return "Media";
  return "Baja";
}

function commitmentPriority(dueHint: string): number {
  const priority = taskPriority("", dueHint);
  if (priority === "Alta") return 0;
  if (priority === "Media") return 1;
  return 2;
}

function uniqueCommitments(commitments: CommitmentLike[]): CommitmentLike[] {
  return uniqueCommitmentList(commitments);
}

function sortCommitmentsForPlan(commitments: CommitmentLike[]): CommitmentLike[] {
  return [...commitments].sort((a, b) => {
    const priorityDelta = commitmentPriority(a.dueHint) - commitmentPriority(b.dueHint);
    if (priorityDelta !== 0) return priorityDelta;
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aCreated - bCreated;
  });
}

function splitInputTasks(input: string): TaskCandidate[] {
  const protectedInput = input
    .replace(/\brelacion precio entrega\b/gi, "relacion-precio-entrega")
    .replace(/\bprecio y entrega\b/gi, "precio-entrega");
  const pieces = protectedInput
    .split(/[.\n;]+|,\s+|\s+y\s+(?=(?:tengo|necesito|debo|quiero|hay|hablar|preparar|comparar|lanzar|mandar|enviar|llamar|revisar|comprar|buscar|hacer)\b)/i)
    .map((part) =>
      part
        .replace(/relacion-precio-entrega/gi, "relacion precio entrega")
        .replace(/precio-entrega/gi, "precio y entrega")
        .trim(),
    )
    .filter((part) => part.length > 4);

  const tasks = pieces
    .filter((part) => isTaskLike(part) && !isNoContextStatement(part))
    .map((part) => ({
      title: cleanupTaskTitle(part),
      priority: taskPriority(part),
      source: "input" as const,
    }))
    .filter((task) => task.title.length > 3);

  return dedupeTasks(tasks).slice(0, 6);
}

function cleanupTaskTitle(text: string): string {
  if (hasShoppingIntent(text)) return cleanupShoppingTaskTitle(text);
  const normalized = text
    .replace(/^\s*(tengo que|debo|necesito|prometi|recordar|recordame|recuerdame|acordame|acordarme de|hay que|quiero)\s+/i, "")
    .replace(/^\s*(que\s+)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return sentenceCase(normalized);
}

function dedupeTasks(tasks: TaskCandidate[]): TaskCandidate[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = foldAccents(task.title).replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function todayAt(hour: number, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() < Date.now()) {
    date.setHours(date.getHours() + 1);
  }
  return date.toISOString();
}

function tomorrowAt(hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function contextReviewFor(_input: string, context?: PlanningContext): ContextReviewItem[] {
  const review: ContextReviewItem[] = [];
  const openCommitments = sortCommitmentsForPlan(
    uniqueCommitments((context?.commitments ?? []).filter((commitment) => commitment.status === "open")),
  );

  for (const commitment of openCommitments.slice(0, 4)) {
    review.push({
      title: commitment.title,
      detail: commitment.dueHint || "Pendiente abierto",
      source: "commitment",
      priority: taskPriority(commitment.title, commitment.dueHint),
    });
  }

  const upcoming = upcomingCalendarEvents(context?.calendarEvents ?? [], new Date(), 72).slice(0, 3);
  for (const event of upcoming) {
    review.push({
      title: event.title,
      detail: new Intl.DateTimeFormat("es", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.startsAt)),
      source: "calendar",
      priority: "Media",
    });
  }

  const usefulMemories = (context?.memories ?? [])
    .filter((memory) => memory.status === "confirmed" && memory.useForSuggestions !== false)
    .filter((memory) => /objetivo|quiero|prefiero|me cuesta|siempre|trabajo|proyecto|rutina|stock|cliente/i.test(memory.text))
    .slice(0, 3);
  for (const memory of usefulMemories) {
    review.push({
      title: memory.text,
      detail: "Memoria confirmada",
      source: "memory",
      priority: "Media",
    });
  }

  for (const entry of (context?.entries ?? []).filter((item) => item.summary.trim().length > 0).slice(0, 2)) {
    review.push({
      title: entry.summary,
      detail: "Conversación reciente",
      source: "recent",
      priority: entry.sentiment === "heavy" || entry.sentiment === "busy" ? "Media" : "Baja",
    });
  }

  for (const nudge of (context?.nudges ?? []).filter((item) => !item.dismissed).slice(0, 2)) {
    review.push({
      title: nudge.body || nudge.title,
      detail: nudge.reason,
      source: "nudge",
      priority: nudge.priority === "high" ? "Alta" : nudge.priority === "medium" ? "Media" : "Baja",
    });
  }

  const seen = new Set<string>();
  return review
    .filter((item) => {
      const key = `${item.source}|${foldAccents(item.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function tasksFromContext(commitments: CommitmentLike[], calendarEvents: CalendarEvent[], review: ContextReviewItem[]): TaskCandidate[] {
  const fromCommitments = sortCommitmentsForPlan(commitments).map((commitment) => ({
    title: commitment.title,
    priority: taskPriority(commitment.title, commitment.dueHint),
    source: "commitment" as const,
    detail: commitment.dueHint,
  }));
  const fromCalendar = upcomingCalendarEvents(calendarEvents, new Date(), 48).map((event) => ({
    title: event.title,
    priority: "Media" as const,
    source: "calendar" as const,
    detail: new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt)),
  }));
  const fromReview = review
    .filter((item) => item.source === "nudge" || (item.source === "memory" && isTaskLike(item.title)))
    .map((item) => ({
      title: item.title,
      priority: item.priority,
      source: item.source as "memory" | "nudge",
      detail: item.detail,
    }));
  return dedupeTasks([...fromCommitments, ...fromCalendar, ...fromReview]).slice(0, 6);
}

function planItemsFor(
  tasks: TaskCandidate[],
  review: ContextReviewItem[] = [],
  energy: DailyEntry["sentiment"] = "calm",
): NonNullable<AssistantActionPayload["planItems"]> {
  const iconBySource: Record<TaskCandidate["source"], NonNullable<AssistantActionPayload["planItems"]>[number]["icon"]> = {
    input: "flag",
    commitment: "flag",
    calendar: "calendar",
    memory: "book",
    nudge: "move",
    recent: "book",
  };
  const priorityRank = { Alta: 0, Media: 1, Baja: 2 };
  const sorted = [...tasks].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  const baseHour = energy === "heavy" ? 10 : 9;
  const gapMinutes = energy === "heavy" ? 45 : 60;
  let cursor = baseHour * 60;
  return sorted
    .slice(0, 4)
    .map((task, index) => {
      const fixedTime = task.detail && /^\d{2}:\d{2}$/.test(task.detail) ? task.detail : undefined;
      const lowEnergy = energy === "heavy";
      const isAdmin = /mail|mensaje|llamar|pagar|factura|comprar|presupuesto/i.test(foldAccents(task.title));
      const durationMinutes = fixedTime
        ? 45
        : lowEnergy
          ? index === 0 ? 15 : 25
          : isAdmin
            ? 25
            : task.priority === "Alta"
              ? 50
              : 35;
      const time = fixedTime ?? `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
      cursor += durationMinutes + gapMinutes;
      return {
        time,
        title: task.title,
        priority: task.priority,
        icon: iconBySource[task.source],
        durationMinutes,
        mode: lowEnergy ? "recovery" as const : isAdmin ? "admin" as const : durationMinutes <= 25 ? "quick" as const : "focus" as const,
        rationale: task.detail && !fixedTime ? task.detail : task.source === "memory" ? "Sale de tu memoria confirmada." : undefined,
      };
    })
    .filter((item) => !review.some((reviewItem) => reviewItem.source === "recent" && reviewItem.title === item.title));
}

function buildClarifyingQuestion(
  title: string,
  body: string,
  questions: string[],
  missingContext: string[] = [],
  review: ContextReviewItem[] = [],
): ActionProposal {
  return {
    kind: "clarifying_question",
    title,
    body,
    status: "proposed",
    approvalRequired: false,
    payload: {
      title,
      body,
      questions,
      missingContext,
      contextReview: review.length ? review : undefined,
      steps: ["Revisé memoria y pendientes", "Detecté que faltan datos reales", "Te pido lo mínimo para avanzar"],
    },
  };
}

function buildEmptyDayQuestion(review: ContextReviewItem[]): ActionProposal {
  const contextHints = review
    .filter((item) => item.source === "memory" || item.source === "recent" || item.source === "record")
    .slice(0, 2)
    .map((item) => item.title);
  if (contextHints.length > 0) {
    return buildClarifyingQuestion(
      "Encontrar el primer paso real",
      `No encontre pendientes abiertos, pero puedo tirar de contexto: ${contextHints.join(" / ")}.`,
      [
        "Quieres que armemos un bloque corto con eso?",
        "Hay algo urgente de hoy o manana?",
        "Energia ahora: baja, media o buena?",
      ],
      ["urgencia", "energia disponible"],
      review,
    );
  }
  return buildClarifyingQuestion(
    "Encontrar el primer paso real",
    "No encontré pendientes claros en tu memoria ni en la conversación reciente. Para no inventarte un plan, necesito una descarga mínima.",
    [
      "¿Qué tres cosas te están rondando ahora mismo?",
      "¿Hay algo urgente de hoy o mañana?",
      "¿Qué tipo de energía tienes: baja, media o buena?",
    ],
    ["pendientes actuales", "urgencia", "energía disponible"],
    review,
  );
}

function buildWeatherLocationQuestion(): ActionProposal {
  return buildClarifyingQuestion(
    "Ubicar el clima",
    "Para clima necesito una ciudad. Con eso lo consulto y te respondo corto.",
    ["En que ciudad?"],
    ["ciudad"],
  );
}

function buildDayPlan(tasks: TaskCandidate[], review: ContextReviewItem[] = [], energy: DailyEntry["sentiment"] = "calm"): ActionProposal {
  return {
    kind: "day_plan",
    title: review.length > 0 ? "Ordenar el día con tu contexto" : "Ordenar un plan accionable",
    body: review.length > 0
      ? `Revisé ${review.length} señales entre pendientes, memoria e historial y armé un orden práctico.`
      : "Convertí lo que nombraste en pasos concretos, sin agregar tareas inventadas.",
    status: "proposed",
    approvalRequired: true,
    payload: {
      title: "Plan de hoy",
      planItems: planItemsFor(tasks, review, energy),
      contextReview: review.length ? review : undefined,
      steps: [
        "Separé tareas reales",
        "Prioricé por urgencia y dependencia",
        "Evité agregar pasos que no dijiste",
        "Preparé un orden aplicable",
      ],
    },
  };
}

function documentRequest(input: string, context?: PlanningContext): {
  enough: boolean;
  filename: string;
  title: string;
  kind: "markdown" | "text" | "document";
  mimeType: string;
  missing: string[];
  template: "cv" | "executive_summary" | "proposal" | "generic";
} {
  const lower = foldAccents(input);
  const hasContext = Boolean(context?.entries.length || context?.memories.some((memory) => memory.status === "confirmed"));
  const wantsCv = /\b(cv|curriculum)\b/i.test(lower);
  const wantsExecutiveSummary = includesAny(lower, ["resumen ejecutivo", "informe", "avance"]);
  const wantsProposal = includesAny(lower, ["propuesta"]);
  if (wantsCv) {
    return {
      enough: includesAny(lower, ["experiencia", "perfil", "educacion", "trabajo"]) || hasContext,
      filename: "CV_borrador.md",
      title: "CV borrador",
      kind: "markdown",
      mimeType: "text/markdown",
      missing: ["experiencia", "perfil objetivo", "formato o puesto al que apunta"],
      template: "cv",
    };
  }
  if (wantsExecutiveSummary) {
    return {
      enough: hasContext || input.length > 80,
      filename: "Resumen_ejecutivo.md",
      title: "Resumen ejecutivo",
      kind: "markdown",
      mimeType: "text/markdown",
      missing: ["audiencia", "avance real", "objetivo del documento"],
      template: "executive_summary",
    };
  }
  if (wantsProposal) {
    return {
      enough: hasContext || input.length > 100,
      filename: "Propuesta_borrador.md",
      title: "Propuesta borrador",
      kind: "markdown",
      mimeType: "text/markdown",
      missing: ["cliente o audiencia", "alcance", "entregables", "fecha"],
      template: "proposal",
    };
  }
  return {
    enough: input.length > 100 || hasContext,
    filename: "Documento_borrador.md",
    title: "Documento borrador",
    kind: "markdown",
    mimeType: "text/markdown",
    missing: ["tipo de documento", "audiencia", "contenido base"],
    template: "generic",
  };
}

function relevantContextLines(context?: PlanningContext): string[] {
  const memories = (context?.memories ?? [])
    .filter((memory) => memory.status === "confirmed" && memory.useForSuggestions !== false)
    .slice(0, 4)
    .map((memory) => `- Memoria: ${memory.text}`);
  const entries = (context?.entries ?? [])
    .slice(0, 4)
    .map((entry) => `- Conversación: ${entry.summary}`);
  const commitments = (context?.commitments ?? [])
    .filter((commitment) => commitment.status === "open")
    .slice(0, 4)
    .map((commitment) => `- Pendiente: ${commitment.title} (${commitment.dueHint})`);
  return [...memories, ...entries, ...commitments];
}

function missingSection(missing: string[]): string {
  return missing.length ? missing.map((item) => `- ${item}`).join("\n") : "- Sin faltantes detectados en esta pasada.";
}

function documentContentFor(
  request: ReturnType<typeof documentRequest>,
  input: string,
  contextLines: string[],
): string {
  const brief = sentenceCase(input).slice(0, 420);
  const contextBlock = contextLines.length ? contextLines.join("\n") : "- Solo el pedido actual del usuario.";
  const missing = missingSection(request.missing);

  if (request.template === "cv") {
    return [
      `# ${request.title}`,
      "",
      "## Perfil objetivo",
      "Pendiente de confirmar: puesto, industria y tono del CV.",
      "",
      "## Experiencia relevante",
      contextBlock,
      "",
      "## Logros para cuantificar",
      "- Agregar resultados medibles, herramientas usadas y alcance.",
      "",
      "## Información faltante",
      missing,
      "",
      "## Próximo paso",
      "Responder con experiencia, educación y puesto objetivo para convertir esto en una versión presentable.",
    ].join("\n");
  }

  if (request.template === "executive_summary") {
    return [
      `# ${request.title}`,
      "",
      "## Objetivo",
      brief,
      "",
      "## Estado actual",
      contextBlock,
      "",
      "## Decisiones o avances",
      "- Confirmar qué ya está hecho, qué está en progreso y qué está bloqueado.",
      "",
      "## Riesgos y pendientes",
      missing,
      "",
      "## Próximo paso recomendado",
      "Validar los puntos anteriores y convertirlos en una versión para la audiencia indicada.",
    ].join("\n");
  }

  if (request.template === "proposal") {
    return [
      `# ${request.title}`,
      "",
      "## Necesidad",
      brief,
      "",
      "## Alcance propuesto",
      contextBlock,
      "",
      "## Entregables",
      "- Borrador sujeto a confirmar alcance real y criterio de éxito.",
      "",
      "## Fuera de alcance",
      "- No se asumen tareas, fechas ni costos no mencionados por el usuario.",
      "",
      "## Datos faltantes",
      missing,
    ].join("\n");
  }

  return [
    `# ${request.title}`,
    "",
    "## Pedido",
    brief,
    "",
    "## Contexto usado",
    contextBlock,
    "",
    "## Borrador",
    "Este documento queda como primera versión editable. No completa datos que no fueron aportados.",
    "",
    "## Próximo paso",
    "Revisar exactitud, agregar datos faltantes y ajustar tono antes de compartir.",
  ].join("\n");
}

function buildFileBundle(input: string, context?: PlanningContext): ActionProposal {
  const request = documentRequest(input, context);
  if (!request.enough) {
    return buildClarifyingQuestion(
      "Definir el documento antes de crearlo",
      "Puedo prepararlo, pero todavía faltan datos para que el archivo no sea relleno.",
      request.missing.map((item) => `Necesito ${item}.`),
      request.missing,
    );
  }

  const contextLines = relevantContextLines(context);
  const content = documentContentFor(request, input, contextLines);

  return {
    kind: "file_bundle",
    title: `Preparar ${request.title.toLowerCase()}`,
    body: "Generé un borrador con el contexto disponible y marqué explícitamente lo que falta revisar.",
    status: "proposed",
    approvalRequired: true,
    payload: {
      title: request.title,
      files: [
        {
          name: request.filename,
          kind: request.kind,
          mimeType: request.mimeType,
          sizeLabel: `${Math.max(1, Math.ceil(content.length / 1024))} KB`,
          content,
        },
      ],
      missingContext: request.missing.filter((item) => !content.toLowerCase().includes(item.toLowerCase())),
      steps: ["Identifiqué el tipo de documento", "Reuní contexto real", "Generé un borrador editable"],
    },
  };
}

function buildSearchQuery(input: string): string {
  return sentenceCase(input)
    .replace(/^(buscame|busca|investiga|comparar|compara|quiero comprar|comprar|dame|decime|dime)\s+/i, "")
    .replace(/[¿?]/g, "")
    .trim();
}

function researchQueriesFor(query: string, deep: boolean, news: boolean, shopping: boolean, world = false): string[] {
  if (world) {
    const base = query
      .replace(/\b(el mundo|mundo|se esta hablando|estan hablando|que se habla|de que hablan|te enteraste|que esta pasando|que paso hoy|senales|señales|radar|tendencias)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const topic = base.length > 8 ? base : "inteligencia artificial tecnologia trabajo";
    return Array.from(new Set([
      `${topic} tendencias ultimos 30 dias`,
      `${topic} debate comunidad ultimos 30 dias`,
      `${topic} noticias recientes impacto trabajo`,
    ])).slice(0, 3);
  }
  if (!deep) return [query];
  const base = query.replace(/\b(deep research|busqueda profunda|investigacion profunda)\b/gi, "").trim() || query;
  return Array.from(new Set([
    base,
    `${base} fuentes principales`,
    news ? `${base} noticias recientes analisis` : `${base} comparativa evidencia`,
    shopping ? `${base} precio opiniones problemas` : `${base} riesgos limitaciones alternativas`,
  ])).slice(0, 4);
}

function buildWebResearch(input: string): ActionProposal {
  const lower = foldAccents(input);
  const weather = includesAny(lower, ["clima", "temperatura", "lluvia", "que ponerme"]);
  const traffic = includesAny(lower, ["trafico", "ruta", "desde", "hasta", "llegar"]);
  const market = includesAny(lower, ["mercado", "mercados", "acciones", "portfolio", "portafolio", "bitcoin", "btc", "eth"]);
  const deep = includesAny(lower, ["deep research", "busqueda profunda", "investigacion profunda"]);
  const shopping = !weather && !traffic && !market && !isDecisionIntent(input) &&
    /\b(compara|comparame|comparar|comparativa|precio|precios|entrega|producto|auriculares|notebook|celular|cafetera)\b/i.test(lower);
  const news = isNewsIntent(input);
  const world = isWorldSignalIntent(input);
  const query = buildSearchQuery(input);
  const webMode: NonNullable<AssistantActionPayload["webMode"]> = weather
    ? "weather"
    : traffic
      ? "traffic"
      : market
        ? "market"
        : news
          ? "news"
          : shopping
            ? "shopping"
            : "research";
  const criteria = weather
    ? ["ubicacion", "precipitacion", "temperatura", "viento", "consejo practico"]
    : traffic
      ? ["origen", "destino", "duracion estimada", "limitacion: sin trafico en vivo"]
      : market
        ? ["fuente financiera", "timestamp", "variacion", "no asesoramiento financiero"]
        : news
          ? ["fecha de publicacion", "fuente confiable", "impacto para tu trabajo", "acciones posibles"]
          : shopping
            ? ["precio total", "disponibilidad", "entrega", "devoluciones", "confianza del vendedor"]
            : deep
              ? ["fuentes diversas", "contraste", "evidencia", "sintesis accionable"]
              : ["fuente primaria", "fecha", "credibilidad", "relevancia para tu objetivo"];
  const title = weather
    ? "Consultar clima real"
    : traffic
      ? "Estimar ruta"
      : market
        ? "Preparar radar de mercados"
        : news
          ? "Preparar radar de noticias"
          : shopping
            ? "Preparar busqueda comparativa"
            : deep
              ? "Preparar busqueda profunda"
              : "Preparar investigacion web";
  const body = weather
    ? "Busco clima con una fuente abierta y marco claramente si falta ubicacion."
    : traffic
      ? "Puedo estimar ruta con datos abiertos. Si no hay trafico en vivo, te lo digo sin venderlo como tiempo real."
      : market
        ? "Te preparo un radar con fuentes fechadas. Lo uso como contexto, no como recomendacion financiera."
        : news
          ? "Te preparo un radar con fuentes fechadas. Si no hay conector de noticias, lo marco explicitamente y dejo consultas verificables."
          : shopping
            ? "Te dejo una busqueda y criterios. No marco esto como comparativa real hasta abrir fuentes y verificar resultados."
            : deep
              ? "Hago una busqueda profunda: varias fuentes, contraste y sintesis. Si un conector falta, lo dejo claro."
              : "Te dejo un brief de investigacion. No finjo fuentes leidas si todavia no se consultaron.";
  const payloadTitle = weather
    ? "Clima"
    : traffic
      ? "Ruta"
      : market
        ? "Mercados"
        : news
          ? "Radar de noticias"
          : shopping
            ? "Brief de comparativa"
            : deep
              ? "Deep research"
              : "Brief de investigacion";
  const actionKind: AssistantActionKind = world ? "world_signal" : "web_research";
  const effectiveWebMode: NonNullable<AssistantActionPayload["webMode"]> = world ? "world" : webMode;
  const effectiveCriteria = world
    ? ["ultimos 30 dias", "fuentes abiertas", "senales repetidas", "impacto para ti", "sin ruido viral sin evidencia"]
    : criteria;
  const effectiveTitle = world ? "Preparar radar del mundo" : title;
  const effectiveBody = world
    ? "Busco senales recientes y las convierto en algo conversable. Si te sirve, despues te pregunto si quieres que lo siga trayendo."
    : body;
  const effectivePayloadTitle = world ? "El mundo esta hablando de esto" : payloadTitle;
  const effectiveQueries = researchQueriesFor(query, deep, news, shopping, world);
  return {
    kind: actionKind,
    title: effectiveTitle,
    body: effectiveBody,
    status: "proposed",
    approvalRequired: !world,
    payload: {
      webMode: effectiveWebMode,
      title: effectivePayloadTitle,
      body: sentenceCase(input).slice(0, 260),
      searchQueries: effectiveQueries,
      researchCriteria: effectiveCriteria,
      externalStatus: "pending",
      recommendation: world ? "Te lo traigo como senal, no como verdad absoluta: primero fuentes, despues criterio." : undefined,
      steps: ["Definí la consulta", "Separé criterios de evaluación", "Dejé listo el paso de verificación real"],
    },
  };
}

function latestRecords(
  context: PlanningContext | undefined,
  currentRecords: RecordDraft[],
  predicate: (record: LifeRecord | RecordDraft) => boolean,
  limit = 6,
): Array<LifeRecord | RecordDraft> {
  const records = [...currentRecords, ...(context?.records ?? [])].filter(predicate);
  const seen = new Set<string>();
  return records
    .filter((record) => {
      const normalizedTitle = foldAccents(record.value ?? record.title)
        .replace(/\b(anota|anotar|gaste|gasto|pague|pago|compre|compra|recordame|tengo|hay|en casa|hoy|manana|mañana|por la manana|por la mañana|esta semana)\b/g, " ")
        .replace(/\d+(?:[.,]\d{1,2})?/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 6)
        .join(" ");
      const key = `${record.domain}|${record.kind}|${record.amount ?? ""}|${record.currency ?? ""}|${foldAccents(record.person ?? "")}|${foldAccents(record.url ?? "")}|${normalizedTitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function recordContextRows(records: Array<LifeRecord | RecordDraft>): ContextReviewItem[] {
  return records.slice(0, 5).map((record) => ({
    title: record.title,
    detail: record.value ?? record.dueHint ?? record.notes ?? record.kind,
    source: "record" as const,
    priority: record.dueHint && taskPriority(record.title, record.dueHint) === "Alta" ? "Alta" : "Media",
  }));
}

function recordLabel(record: LifeRecord | RecordDraft): string {
  if (record.kind === "expense" && record.amount) {
    return `${record.amount}${record.currency ? ` ${record.currency}` : ""} - ${record.title}`;
  }
  if (record.value) return `${record.title}: ${record.value}`;
  if (record.person) return `${record.title} (${record.person})`;
  return record.title;
}

function buildStructuredNote(currentRecords: RecordDraft[]): ActionProposal | null {
  if (currentRecords.length === 0) return null;
  const visible = currentRecords.slice(0, 6);
  return {
    kind: "structured_note",
    title: visible.length === 1 ? "Guardar dato util" : "Guardar datos utiles",
    body: visible.length === 1
      ? "Lo ordene como dato reutilizable para que vuelva cuando lo preguntes."
      : `Ordene ${visible.length} datos reutilizables para que Koru los use despues.`,
    status: "proposed",
    approvalRequired: false,
    payload: {
      title: "Datos guardados",
      records: visible,
      summaryItems: visible.map((record) => ({
        label: record.kind.replace(/_/g, " "),
        value: recordLabel(record),
        detail: record.domain,
      })),
      steps: ["Detecte el tipo de dato", "Lo ubique por area de vida", "Lo deje recuperable para futuros pedidos"],
    },
  };
}

function expenseTime(record: LifeRecord | RecordDraft): number {
  const maybeRecord = record as LifeRecord;
  const iso = record.happenedAt ?? maybeRecord.createdAt;
  const time = iso ? new Date(iso).getTime() : Date.now();
  return Number.isFinite(time) ? time : Date.now();
}

function expensesThisWeek(records: Array<LifeRecord | RecordDraft>): Array<LifeRecord | RecordDraft> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  return records.filter((record) => expenseTime(record) >= start.getTime());
}

function buildMoneySummary(context: PlanningContext | undefined, currentRecords: RecordDraft[]): ActionProposal | null {
  const expenses = expensesThisWeek(
    latestRecords(context, currentRecords, (record) => record.kind === "expense" && typeof record.amount === "number", 20),
  );
  if (expenses.length === 0) {
    return buildClarifyingQuestion(
      "Armar tu resumen de gastos",
      "Todavia no tengo gastos registrados para calcular una semana real.",
      ["Pasame gastos con monto y concepto, por ejemplo: 'gaste 12 euros en supermercado'.", "Si tienes un presupuesto semanal, dime cual es."],
      ["gastos registrados", "presupuesto semanal"],
      [],
    );
  }
  const total = expenses.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const currency = expenses.find((record) => record.currency)?.currency ?? "EUR";
  const biggest = [...expenses].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
  return {
    kind: "money_summary",
    title: "Resumen de gastos de la semana",
    body: `Registraste ${expenses.length} gasto(s). Total aproximado: ${total.toFixed(2)} ${currency}.`,
    status: "proposed",
    approvalRequired: false,
    payload: {
      title: "Dinero",
      totalAmount: Number(total.toFixed(2)),
      currency,
      summaryItems: [
        { label: "Total semana", value: `${total.toFixed(2)} ${currency}` },
        { label: "Movimientos", value: `${expenses.length}` },
        ...(biggest ? [{ label: "Mayor gasto", value: recordLabel(biggest) }] : []),
      ],
      contextReview: recordContextRows(expenses),
      recommendation: "Si quieres decidir una compra, pasame precio y presupuesto semanal; te doy una recomendacion con margen.",
      steps: ["Tome gastos registrados", "Filtre los ultimos 7 dias", "Calcule total y movimiento principal"],
    },
  };
}

function buildMealSummary(context: PlanningContext | undefined, currentRecords: RecordDraft[]): ActionProposal | null {
  const inventory = latestRecords(context, currentRecords, (record) => record.kind === "meal_inventory", 4);
  if (inventory.length === 0) {
    return buildClarifyingQuestion(
      "Saber que hay para comer",
      "No tengo comida registrada en casa todavia.",
      ["Dime que hay en heladera, despensa o freezer.", "Si quieres, tambien dime si buscas algo rapido, sano o para reunion."],
      ["inventario de comida"],
    );
  }
  const values = inventory.map((record) => record.value ?? record.title);
  return {
    kind: "morning_brief",
    title: "Comida disponible en casa",
    body: `Tengo registrado: ${values.join("; ")}.`,
    status: "proposed",
    approvalRequired: false,
    payload: {
      title: "Comida en casa",
      summaryItems: values.map((value, index) => ({
        label: index === 0 ? "Disponible" : "Tambien",
        value,
      })),
      recommendation: "Con eso puedo proponerte una comida simple, pero no invento recetas si no se tiempo, hambre o restricciones.",
      contextReview: recordContextRows(inventory),
      steps: ["Busque inventario de comida", "Reuni lo ultimo registrado", "Deje una opcion para decidir rapido"],
    },
  };
}

function weatherTrafficQuestions(input: string): string[] {
  const lower = foldAccents(input);
  const questions: string[] = [];
  if (includesAny(lower, ["clima", "que ponerme"]) && !/\b(en|para)\s+[a-z]+/i.test(lower)) {
    questions.push("Para clima y ropa necesito ciudad o zona.");
  }
  if (includesAny(lower, ["trafico", "tráfico"]) && !includesAny(lower, ["desde", "hasta"])) {
    questions.push("Para trafico necesito origen y destino.");
  }
  if (includesAny(lower, ["noticias"]) && !includesAny(lower, ["trabajo", "sector", "industria", "tema"])) {
    questions.push("Para noticias relevantes necesito tu rubro o tema de trabajo.");
  }
  return questions;
}

function buildMorningBrief(
  input: string,
  context: PlanningContext | undefined,
  currentRecords: RecordDraft[],
  review: ContextReviewItem[],
): ActionProposal | null {
  const lower = foldAccents(input);
  if (isMealInventoryIntent(input) && !includesAny(lower, ["clima", "trafico", "reunion", "medicamento", "noticias", "manana", "buen dia", "buenos dias"])) {
    return buildMealSummary(context, currentRecords);
  }

  const upcoming = upcomingCalendarEvents(context?.calendarEvents ?? [], new Date(), 36).slice(0, 4);
  const openCommitments = sortCommitmentsForPlan((context?.commitments ?? []).filter((commitment) => commitment.status === "open")).slice(0, 4);
  const meds = latestRecords(context, currentRecords, (record) => record.kind === "medication" || record.kind === "medical_info", 3);
  const food = latestRecords(context, currentRecords, (record) => record.kind === "meal_inventory", 2);
  const meetings = latestRecords(context, currentRecords, (record) => record.kind === "meeting_note", 3);
  const missing = weatherTrafficQuestions(input);
  const summaryItems: NonNullable<AssistantActionPayload["summaryItems"]> = [];

  if (upcoming.length) {
    summaryItems.push({
      label: "Agenda",
      value: upcoming.map((event) => event.title).join(" / "),
      detail: "Proximas 36 horas",
    });
  }
  if (openCommitments.length) {
    summaryItems.push({
      label: "Pendientes",
      value: openCommitments.map((commitment) => commitment.title).join(" / "),
      detail: "Abiertos",
    });
  }
  if (meds.length) {
    summaryItems.push({
      label: "Salud",
      value: meds.map(recordLabel).join(" / "),
      detail: "Recordatorio sensible",
    });
  }
  if (food.length) {
    summaryItems.push({
      label: "Comida",
      value: food.map((record) => record.value ?? record.title).join(" / "),
      detail: "Casa",
    });
  }
  if (meetings.length) {
    summaryItems.push({
      label: "Reuniones",
      value: meetings.map((record) => record.title).join(" / "),
    });
  }

  if (!summaryItems.length && missing.length) {
    return buildClarifyingQuestion(
      "Preparar tu mañana",
      "Puedo hacerte un brief util, pero faltan datos para clima, trafico o noticias sin inventar.",
      missing,
      missing.map((item) => item.replace(/^Para\s+/i, "")),
      review,
    );
  }

  if (!summaryItems.length) return null;

  return {
    kind: "morning_brief",
    title: lower.includes("manana") ? "Brief de mañana" : "Brief del dia",
    body: missing.length
      ? "Arme lo que si se con tu memoria. Para clima, trafico o noticias necesito los datos que faltan."
      : "Reuni lo importante para arrancar sin reconstruir todo desde cero.",
    status: "proposed",
    approvalRequired: false,
    payload: {
      title: lower.includes("manana") ? "Mañana" : "Hoy",
      summaryItems,
      missingContext: missing.length ? missing : undefined,
      questions: missing.length ? missing : undefined,
      contextReview: [...review, ...recordContextRows([...meds, ...food, ...meetings])].slice(0, 6),
      planItems: planItemsFor(
        [
          ...openCommitments.map((commitment) => ({
            title: commitment.title,
            priority: taskPriority(commitment.title, commitment.dueHint),
            source: "commitment" as const,
            detail: commitment.dueHint,
          })),
          ...upcoming.map((event) => ({
            title: event.title,
            priority: "Media" as const,
            source: "calendar" as const,
            detail: new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt)),
          })),
        ],
        review,
      ),
      recommendation: missing.length
        ? "Dame ciudad, ruta o rubro y puedo completar la parte externa con busqueda real."
        : "Empieza por el compromiso con fecha mas cercana; lo demas queda en cola visible.",
      steps: ["Revise agenda", "Cruce pendientes y datos guardados", "Separe lo que se de lo que falta verificar"],
    },
  };
}

function buildMeetingBrief(
  input: string,
  context: PlanningContext | undefined,
  currentRecords: RecordDraft[],
  review: ContextReviewItem[],
): ActionProposal | null {
  const meetingRecords = latestRecords(context, currentRecords, (record) => record.kind === "meeting_note" || record.kind === "person_followup", 6);
  const relatedCommitments = sortCommitmentsForPlan((context?.commitments ?? []).filter((commitment) =>
    commitment.status === "open" && /\b(reunion|reunión|cliente|socio|socia|ana|proveedor|mensaje|mail|correo)\b/i.test(commitment.title),
  )).slice(0, 4);
  const hasPrepRequest = isMeetingIntent(input);
  if (!hasPrepRequest && meetingRecords.length === 0) return null;

  if (meetingRecords.length === 0 && relatedCommitments.length === 0) {
    return buildClarifyingQuestion(
      "Preparar la reunion",
      "Puedo prepararla, pero necesito el objetivo y con quien es para no hacer una minuta vacia.",
      ["Con quien es la reunion?", "Que resultado necesitas al terminar?", "Hay temas o decisiones pendientes?"],
      ["persona", "objetivo", "temas"],
      review,
    );
  }

  const tasks: TaskCandidate[] = [
    ...relatedCommitments.map((commitment) => ({
      title: commitment.title,
      priority: taskPriority(commitment.title, commitment.dueHint),
      source: "commitment" as const,
      detail: commitment.dueHint,
    })),
    ...meetingRecords.slice(0, 3).map((record) => ({
      title: record.title,
      priority: taskPriority(record.title, record.dueHint ?? ""),
      source: "recent" as const,
      detail: record.person ?? record.dueHint ?? "Nota",
    })),
  ];

  return {
    kind: "meeting_brief",
    title: "Preparar reunion",
    body: "Junte contexto de reunion, pendientes y personas para llegar con puntos claros.",
    status: "proposed",
    approvalRequired: true,
    payload: {
      title: "Brief de reunion",
      summaryItems: [
        ...(meetingRecords.length ? [{ label: "Notas", value: meetingRecords.map(recordLabel).join(" / ") }] : []),
        ...(relatedCommitments.length ? [{ label: "Pendientes", value: relatedCommitments.map((item) => item.title).join(" / ") }] : []),
      ],
      planItems: planItemsFor(dedupeTasks(tasks), review),
      contextReview: [...review, ...recordContextRows(meetingRecords)].slice(0, 6),
      recommendation: "Lleva tres cosas: objetivo, decision necesaria y proximo responsable. Si tomas notas aca, despues te preparo follow-up.",
      steps: ["Busque reuniones y pendientes", "Agrupe por persona/tema", "Prepare agenda accionable"],
    },
  };
}

function buildDecisionSupport(
  input: string,
  context: PlanningContext | undefined,
  currentRecords: RecordDraft[],
): ActionProposal | null {
  const lower = foldAccents(input);
  const decision = currentRecords.find((record) => record.kind === "decision") ?? undefined;
  const amount = decision?.amount ?? /(?:\$|€|eur|usd)?\s*(\d+(?:[.,]\d{1,2})?)/i.exec(input)?.[1]?.replace(",", ".");
  const parsedAmount = typeof amount === "number" ? amount : amount ? Number(amount) : undefined;
  const expenses = expensesThisWeek(
    latestRecords(context, currentRecords, (record) => record.kind === "expense" && typeof record.amount === "number", 20),
  );
  if (!isDecisionIntent(input) && !decision) return null;
  if (!parsedAmount) {
    return buildClarifyingQuestion(
      "Decidir sin inventar numeros",
      "Puedo ayudarte a decidir, pero necesito el precio o el presupuesto que quieres respetar.",
      ["Cuanto cuesta?", "Cual es tu presupuesto semanal o mensual?", "Es necesidad, oportunidad o gusto?"],
      ["precio", "presupuesto", "criterio"],
    );
  }
  const spent = expenses.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const currency = decision?.currency ?? expenses.find((record) => record.currency)?.currency ?? (lower.includes("usd") ? "USD" : "EUR");
  const ratio = spent > 0 ? parsedAmount / Math.max(spent, 1) : undefined;
  const decisionVote: NonNullable<AssistantActionPayload["decisionVote"]> = ratio && ratio > 0.6 ? "wait" : spent > 0 ? "go" : "missing";
  const recommendation = ratio && ratio > 0.6
    ? "Yo esperaria o buscaria una alternativa: la compra pesa mucho contra lo que ya gastaste esta semana."
    : spent > 0
      ? "Podria tener sentido si no compromete facturas ni medicacion; antes confirmaria presupuesto y urgencia."
      : "Me falta historial de gastos para votar fuerte. Te doy un criterio provisional y te pregunto presupuesto.";
  return {
    kind: "decision_support",
    title: "Ayudarte a decidir",
    body: "Uso los gastos registrados y el precio que diste. Si falta presupuesto, lo marco como supuesto.",
    status: "proposed",
    approvalRequired: false,
    payload: {
      title: "Decision",
      totalAmount: parsedAmount,
      currency,
      summaryItems: [
        { label: "Costo", value: `${parsedAmount.toFixed(2)} ${currency}` },
        { label: "Gastado semana", value: `${spent.toFixed(2)} ${currency}` },
        { label: "Criterio", value: ratio ? `${Math.round(ratio * 100)}% de lo ya gastado` : "sin historial suficiente" },
      ],
      recommendation,
      decisionVote,
      decisionAssumption: spent > 0
        ? `Uso como referencia ${spent.toFixed(2)} ${currency} de gastos registrados en los ultimos 7 dias.`
        : "No tengo gastos recientes suficientes; el voto queda como criterio provisional.",
      contextReview: recordContextRows(expenses),
      steps: ["Lei el costo", "Compare con gastos recientes", "Separe recomendacion de supuesto"],
    },
  };
}

function recipientFrom(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("proveedor")) return "proveedor";
  if (lower.includes("cliente")) return "cliente";
  if (lower.includes("socio")) return "socio";
  const match = /\b(?:con|a|al)\s+([A-Z][a-z]+)/.exec(text);
  return match?.[1];
}

function draftMessageFor(commitment: CommitmentLike, input: string): string {
  const lower = foldAccents(`${commitment.title} ${input}`);
  if (lower.includes("presupuesto")) {
    return "Hola, te paso el presupuesto hoy. Si quieres, lo revisamos juntos y lo ajusto antes de enviarlo.";
  }
  if (lower.includes("proveedor") || lower.includes("stock")) {
    return "Hola, necesito revisar reposición para mañana. ¿Me confirmas disponibilidad y horarios de entrega?";
  }
  if (lower.includes("reunion")) {
    return "Hola, confirmo la reunión. Voy a llegar con los puntos preparados y te aviso si surge algún cambio.";
  }
  return `Hola, te escribo por esto: ${commitment.title}.`;
}

function buildReminder(commitment: CommitmentLike): ActionProposal {
  const dueHint = foldAccents(commitment.dueHint);
  const dueAt = commitment.dueAt ?? dueAtFromText(`${commitment.title} ${commitment.dueHint}`);
  const label = dueLabel(dueAt, commitment.dueHint);
  return {
    kind: "reminder",
    title: "Dejarlo visible",
    body: dueAt
      ? `Lo traigo ${label} como una cosa concreta, no como lista infinita.`
      : dueHint.includes("manana")
        ? "Lo traigo mañana como una cosa concreta, no como lista infinita."
        : "Lo dejo en Hoy hasta que lo cierres o lo sueltes.",
    status: "proposed",
    approvalRequired: true,
    sourceCommitmentId: commitment.id,
    payload: {
      title: commitment.title,
      dueHint: commitment.dueHint,
      startsAt: dueAt,
    },
  };
}

function startsAtForDueHint(dueHint: string): string | undefined {
  const lower = foldAccents(dueHint);
  if (includesAny(lower, ["manana"])) return tomorrowAt(9);
  if (includesAny(lower, ["hoy", "ahora"])) return todayAt(17);
  return undefined;
}

function buildDraftMessage(commitment: CommitmentLike, input: string): ActionProposal {
  return {
    kind: "draft_message",
    title: "Preparar un borrador",
    body: "Lo dejo escrito para que solo tengas que revisarlo.",
    status: "proposed",
    approvalRequired: true,
    sourceCommitmentId: commitment.id,
    payload: {
      recipient: recipientFrom(commitment.title) ?? recipientFrom(input),
      draft: draftMessageFor(commitment, input),
      dueHint: commitment.dueHint,
    },
  };
}

function buildCalendarEvent(commitment: CommitmentLike): ActionProposal | null {
  const startsAt = commitment.dueAt ?? startsAtForDueHint(commitment.dueHint);
  if (!startsAt) return null;
  return {
    kind: "calendar_event",
    title: "Bloquearlo en calendario",
    body: "Lo guardo como evento local para que vuelva a aparecer a tiempo.",
    status: "proposed",
    approvalRequired: true,
    sourceCommitmentId: commitment.id,
    payload: {
      title: commitment.title,
      startsAt,
      dueHint: commitment.dueHint,
    },
  };
}

function buildRestockNote(commitment: CommitmentLike, input: string): ActionProposal {
  const lower = foldAccents(`${commitment.title} ${input}`);
  const items = extractShoppingItems(`${commitment.title} ${input}`);
  if (items.length === 0) {
    items.push(...["cafe", "leche", "avena", "stock", "pedido", "huevos", "pan"].filter((item) => lower.includes(item)));
  }
  const note = items.length > 0 ? `Revisar ${Array.from(new Set(items)).join(", ")}.` : commitment.title;
  return {
    kind: "restock_note",
    title: "Armar nota de reposición",
    body: "Te preparo una nota corta para resolverlo sin reconstruir el contexto.",
    status: "proposed",
    approvalRequired: true,
    sourceCommitmentId: commitment.id,
    payload: {
      note,
      dueHint: commitment.dueHint,
    },
  };
}

function buildHeavyBrief(input: string, review: ContextReviewItem[]): ActionProposal {
  return {
    kind: "daily_brief",
    title: "Cerrar esto en pequeño",
    body: "No lo convierto en plan grande. Te dejo una salida mínima y amable.",
    status: "proposed",
    approvalRequired: true,
    payload: {
      title: "Cierre amable",
      body: `Primer paso: escribir en una línea qué pesa más. Segundo paso: elegir una acción de 10 minutos o pedirme que la busque contigo. Contexto: ${sentenceCase(input).slice(0, 180)}`,
      contextReview: review.length ? review : undefined,
      steps: ["Bajé la carga", "Evité sobredimensionarlo", "Dejé una acción mínima"],
    },
  };
}

export function buildActionProposalsLocal(
  input: string,
  commitments: CommitmentLike[],
  sentiment: DailyEntry["sentiment"],
  context?: PlanningContext,
  currentRecords: RecordDraft[] = [],
): ActionProposal[] {
  const lower = foldAccents(input);
  const proposals: ActionProposal[] = [];
  const openCommitments = uniqueCommitments((context?.commitments ?? []).filter((commitment) => commitment.status === "open"));
  const planningCommitments = uniqueCommitments([...commitments, ...openCommitments]);
  const review = contextReviewFor(input, context);
  const inputTasks = splitInputTasks(input);
  const contextTasks = tasksFromContext(planningCommitments, context?.calendarEvents ?? [], review);
  const allPlanTasks = dedupeTasks([...inputTasks, ...contextTasks]);
  const shouldSuggestPlan = isPlanningIntent(lower);
  const explicitMultiTask = inputTasks.length >= 3 || (inputTasks.length >= 2 && includesAny(lower, ["plan", "organiza", "ordena"]));
  const structuredNote = (isStructuredCaptureIntent(input) || isLifeCaptureIntent(input)) ? buildStructuredNote(currentRecords) : null;
  const moneySummary = isMoneySummaryIntent(input) ? buildMoneySummary(context, currentRecords) : null;
  const morningBrief = isMorningBriefIntent(input) ? buildMorningBrief(input, context, currentRecords, review) : null;
  const meetingBrief = isMeetingIntent(input) ? buildMeetingBrief(input, context, currentRecords, review) : null;
  const decisionSupport = isDecisionIntent(input) ? buildDecisionSupport(input, context, currentRecords) : null;

  if (moneySummary) proposals.push(moneySummary);
  if (morningBrief) proposals.push(morningBrief);
  if (meetingBrief) proposals.push(meetingBrief);
  if (decisionSupport) proposals.push(decisionSupport);
  if (structuredNote) proposals.push(structuredNote);

  if (shouldSuggestPlan) {
    if (allPlanTasks.length === 0) {
      proposals.push(buildEmptyDayQuestion(review));
    } else {
      proposals.push(buildDayPlan(allPlanTasks, review, sentiment));
    }
  } else if (explicitMultiTask) {
    proposals.push(buildDayPlan(inputTasks, review, sentiment));
  }

  if (isDocumentIntent(input)) {
    proposals.push(buildFileBundle(input, context));
  }

  if (isResearchIntent(input)) {
    if (isOnlySimpleWeatherIntent(input) && !isWeatherFollowupReady(input)) {
      proposals.push(buildWeatherLocationQuestion());
    } else {
      proposals.push(buildWebResearch(input));
    }
  }

  const actionCommitments = shouldSuggestPlan || explicitMultiTask ? [] : uniqueCommitments(commitments);
  for (const commitment of actionCommitments) {
    const combined = foldAccents(`${commitment.title} ${input}`);
    if (includesAny(combined, ["mandar", "enviar", "mensaje", "presupuesto", "llamar"])) {
      proposals.push(buildDraftMessage(commitment, input));
    }
    if (includesAny(combined, ["reunion", "cita", "turno"])) {
      const calendar = buildCalendarEvent(commitment);
      if (calendar) proposals.push(calendar);
    }
    if (hasShoppingIntent(combined) || includesAny(combined, ["stock", "cafe", "leche", "pedido", "reposicion", "huevos", "pan"])) {
      proposals.push(buildRestockNote(commitment, input));
    }
    proposals.push(buildReminder(commitment));
  }

  if (proposals.length === 0 && sentiment === "heavy") {
    proposals.push(buildHeavyBrief(input, review));
  }

  if (proposals.length === 0 && sentiment === "busy" && inputTasks.length > 1) {
    proposals.push(buildDayPlan(inputTasks, review, sentiment));
  }

  if (proposals.length === 0 && includesAny(lower, ["preparame", "ayudame", "organiza", "ordenar"])) {
    proposals.push(
      buildClarifyingQuestion(
        "Definir qué quieres que prepare",
        "Puedo ayudarte, pero necesito una meta concreta para no responder con relleno.",
        ["¿Qué resultado quieres al final?", "¿Qué información ya tengo que usar?", "¿Hay formato o deadline?"],
        ["resultado esperado", "contexto base"],
        review,
      ),
    );
  }

  const seen = new Set<string>();
  return proposals
    .filter((proposal) => {
      const key = `${proposal.kind}|${proposal.sourceCommitmentId ?? ""}|${proposal.title}|${proposal.payload.title ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const order: AssistantActionKind[] = [
        "morning_brief",
        "money_summary",
        "meeting_brief",
        "decision_support",
        "day_plan",
        "structured_note",
        "clarifying_question",
        "draft_message",
        "calendar_event",
        "restock_note",
        "reminder",
        "file_bundle",
        "world_signal",
        "web_research",
        "daily_brief",
      ];
      return order.indexOf(a.kind) - order.indexOf(b.kind);
    })
    .slice(0, 3);
}

export function normalizeActionDrafts(
  drafts: ActionDraft[] | undefined,
  commitments: CommitmentLike[],
): ActionProposal[] {
  const allowed: AssistantActionKind[] = [
    "draft_message",
    "calendar_event",
    "reminder",
    "restock_note",
    "daily_brief",
    "day_plan",
    "file_bundle",
    "world_signal",
    "web_research",
    "structured_note",
    "money_summary",
    "morning_brief",
    "meeting_brief",
    "decision_support",
    "clarifying_question",
  ];
  const proposals: ActionProposal[] = [];
  for (const draft of drafts ?? []) {
    if (!draft.kind || !allowed.includes(draft.kind)) continue;
    const title = sentenceCase(draft.title ?? "");
    const body = sentenceCase(draft.body ?? "");
    if (title.length < 4 || body.length < 4) continue;
    const sourceCommitment = commitments.find((commitment) =>
      draft.source_commitment_title
        ? commitment.title.toLowerCase().includes(draft.source_commitment_title.toLowerCase())
        : false,
    );
    proposals.push({
      kind: draft.kind,
      title,
      body,
      status: "proposed" as const,
      approvalRequired: !["clarifying_question", "structured_note", "money_summary", "morning_brief", "decision_support"].includes(draft.kind),
      sourceCommitmentId: sourceCommitment?.id,
      payload: draft.payload ?? {},
    });
    if (proposals.length >= 3) break;
  }
  return proposals;
}

export function executeApprovedAction(
  _state: KoruState,
  action: AssistantAction,
  createId: (prefix: string) => string,
  nowIso: string,
): {
  action: AssistantAction;
  calendarEvents: CalendarEvent[];
  nudges: ProactiveNudge[];
  commitments: Commitment[];
  commitmentIdsDone: string[];
} {
  const commitmentIdsDone: string[] = [];
  const calendarEvents: CalendarEvent[] = [];
  const nudges: ProactiveNudge[] = [];
  const commitments: Commitment[] = [];
  let result = "";

  if (action.kind === "calendar_event" && action.payload.startsAt && action.payload.title) {
    calendarEvents.push({
      id: createId("cal"),
      title: action.payload.title,
      startsAt: action.payload.startsAt,
      location: action.payload.location,
      source: "manual",
      sourceRef: `${action.id}-${action.payload.startsAt}`,
      createdAt: nowIso,
    });
    result = `Evento local creado: ${action.payload.title}.`;
  } else if (action.kind === "alarm") {
    const time = action.payload.uiBlock?.type === "alarm" ? action.payload.uiBlock.time : action.payload.startsAt;
    result = time ? `Alarma preparada para ${time}.` : `Alarma preparada: ${action.payload.title ?? action.title}.`;
    // Crear un compromiso real para que el usuario vea la alarma en su lista
    commitments.push({
      id: createId("commit"),
      title: action.title,
      dueHint: time ?? "alarma",
      dueAt: time ? dueAtFromText(`hoy a las ${time}`, new Date(nowIso)) : undefined,
      status: "open",
      createdAt: nowIso,
      sourceEntryId: action.sourceEntryId,
    });
  } else if (action.kind === "reminder") {
    const due = action.payload.dueHint ?? (action.payload.uiBlock?.type === "reminder" ? action.payload.uiBlock.dueText : undefined);
    result = `Recordatorio preparado: ${action.payload.title ?? action.title}.`;
    commitments.push({
      id: createId("commit"),
      title: action.title,
      dueHint: due ?? "recordatorio",
      dueAt: typeof due === "string" ? dueAtFromText(due, new Date(nowIso)) : undefined,
      status: "open",
      createdAt: nowIso,
      sourceEntryId: action.sourceEntryId,
    });
  } else if (action.kind === "draft_message") {
    const recipient = action.payload.recipient ? ` para ${action.payload.recipient}` : "";
    result = `Borrador listo${recipient}: ${action.payload.draft ?? action.payload.body ?? action.title}`;
  } else if (action.kind === "restock_note") {
    result = `Nota lista: ${action.payload.note ?? action.payload.body ?? action.title}`;
  } else if (action.kind === "daily_brief") {
    result = action.payload.body ?? "Plan corto listo.";
  } else if (action.kind === "day_plan") {
    const count = action.payload.planItems?.length ?? 0;
    result = count > 0 ? `Plan aplicado con ${count} pasos.` : "Plan aplicado.";
    for (const item of action.payload.planItems ?? []) {
      commitments.push({
        id: createId("commit"),
        title: item.title,
        dueHint: item.time ? `hoy ${item.time}` : "hoy",
        dueAt: item.time ? dueAtFromText(`hoy a las ${item.time}`, new Date(nowIso)) : undefined,
        status: "open",
        createdAt: nowIso,
        sourceEntryId: action.sourceEntryId,
      });
    }
  } else if (action.kind === "structured_note") {
    const count = action.payload.records?.length ?? 0;
    result = count > 0 ? `Datos guardados y clasificados: ${count}.` : "Dato guardado.";
  } else if (action.kind === "money_summary") {
    result = action.payload.totalAmount !== undefined
      ? `Resumen de dinero listo: ${action.payload.totalAmount} ${action.payload.currency ?? ""}.`.trim()
      : action.payload.recommendation ?? "Resumen de dinero listo.";
  } else if (action.kind === "morning_brief") {
    result = action.payload.recommendation ?? action.payload.body ?? "Brief listo.";
  } else if (action.kind === "meeting_brief") {
    result = action.payload.recommendation ?? "Brief de reunion listo.";
  } else if (action.kind === "decision_support") {
    result = action.payload.recommendation ?? "Analisis de decision listo.";
  } else if (action.kind === "file_bundle") {
    const count = action.payload.files?.length ?? 0;
    result = count > 0 ? `Archivos preparados: ${action.payload.files?.map((file) => file.name).join(", ")}.` : "Paquete de archivos preparado.";
  } else if (action.kind === "web_research") {
    const queries = action.payload.searchQueries?.join(", ");
    result = queries ? `Búsqueda preparada para verificar: ${queries}.` : "Búsqueda preparada para abrir fuentes reales.";
  } else if (action.kind === "clarifying_question") {
    result = action.payload.questions?.join(" ") ?? action.body;
  } else {
    result = `Lo dejo visible: ${action.payload.title ?? action.title}`;
  }

  if (action.sourceCommitmentId && action.kind === "calendar_event") {
    commitmentIdsDone.push(action.sourceCommitmentId);
  }

  nudges.push({
    id: createId("nudge"),
    title: action.kind === "draft_message" ? "Borrador preparado" : "Hecho por Koru",
    body: result,
    reason: "Acción aprobada por ti.",
    priority: "medium",
    createdAt: nowIso,
    source: "brain",
    sourceId: action.id,
  });

  return {
    action: {
      ...action,
      status: "executed",
      updatedAt: nowIso,
      executedAt: nowIso,
      result,
    },
    calendarEvents,
    nudges,
    commitments,
    commitmentIdsDone,
  };
}
