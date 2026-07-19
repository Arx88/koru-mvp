/**
 * Memory Extractor — extraído de koruBackend.ts (Task 11-PARTITION).
 *
 * Contiene:
 *  - buildMemoryExtractorMessages: arma los mensajes para el LLM extractor.
 *  - extractMemoryWithJsonPrompt: llama al provider y parsea el JSON.
 *  - normalizeMemoryCandidates: normaliza candidatos desde JSON del LLM.
 *  - synthesizeMemoryFromRevelation: síntesis determinística basada en regex.
 *  - normalizeCommitments / normalizeRecords / normalizeSuggestedActions.
 *  - uniqueRecords / uniqueCommitments: dedupe helpers.
 *  - personalCapturesFromTools / localActionsFromTools / memoryCapturesFromTools.
 *
 * Sin cambios de comportamiento respecto al original.
 */
import type {
  Commitment,
  KoruState,
  LifeRecord,
  MemoryFact,
  UiBlock,
} from "../domain/types";
import type { ChatFn as ExtractorChatFn } from "../domain/structureExtractor";
import {
  asArray,
  asRecord,
  cleanText,
  createId,
  plainLower,
  safeJsonObjectFromContent,
  toolObservationSummary,
  inferProviderFromModel,
  callProvider,
  type ChatMessage,
  type KoruBackendTurnRequest,
  type KoruSuggestedAction,
  type LocalActionData,
  type MemoryCaptureData,
  type PersonalCaptureData,
  type ProviderConfig,
  type ProviderToolCall,
  type ToolExecution,
} from "./koruBackend";

export type { ExtractorChatFn };

export function buildMemoryExtractorMessages(
  request: KoruBackendTurnRequest,
  toolExecutions: ToolExecution[],
  composedRaw?: Record<string, unknown>,
): ChatMessage[] {
  // 🔴 ARQUITECTURA NUEVA: el extractor recibe las memorias EXISTENTES del usuario
  // para poder detectar contradicciones, actualizaciones y duplicados.
  // El LLM decide qué AGREGAR, qué ARCHIVAR y qué ACTUALIZAR — sin regex, sin frases rígidas.
  const existingMemories = (request.state.memories ?? [])
    .filter(m => m.status === "confirmed" || m.status === "candidate")
    .slice(0, 20)
    .map(m => ({ id: m.id, kind: m.kind, text: m.text, status: m.status }));

  return [
    {
      role: "system",
      content: [
        "Sos el extractor de memoria de Koru. Devolvé SOLO JSON válido, sin markdown.",
        'Schema: {"memoryCandidates":[],"archiveMemoryIds":[],"behaviorNotes":[]}',
        "",
        "Tu trabajo: analizar lo que el usuario dijo y compararlo con sus memorias existentes.",
        "",
        "REGLAS PARA AGREGAR (memoryCandidates):",
        "- Extraé SOLO información duradera y reutilizable sobre el usuario.",
        "- Preferencias, identidad, rutinas, objetivos, relaciones, salud, fechas importantes, intereses.",
        "- NO extraigas chit-chat genérico, saludos, o información temporal.",
        "- Si el usuario revela algo personal (gustos, hábitos, metas, relaciones), extraelo SIEMPRE.",
        "- NO necesitas que el usuario diga 'guardá esto' — si lo cuenta, es porque quiere que lo sepas.",
        "- Redactá la memoria en tercera persona: 'Le encanta el sushi', 'Trabaja de programador', 'Vive en Madrid'.",
        "- kind puede ser: preference, routine, goal, profile, relationship, wellbeing, boundary, retail, task",
        "",
        "REGLAS PARA ARCHIVAR (archiveMemoryIds):",
        "- Si el usuario dice algo que CONTRADICE una memoria existente, incluí el ID de esa memoria en archiveMemoryIds.",
        "- Ejemplos: 'ya no juego al tenis' → archivar memoria sobre tenis.",
        "- 'me mude a Barcelona' → archivar memoria 'Vive en Madrid'.",
        "- 'termine la carrera' → archivar memoria 'Estudia medicina'.",
        "- 'deje el trabajo' → archivar memoria 'Trabaja de programador'.",
        "- 'ya no me gusta' → archivar memoria de preferencia anterior.",
        "- Si una nueva memoria reemplaza una vieja (mismo tema, info diferente), archivá la vieja.",
        "",
        "REGLAS PARA NO DUPLICAR:",
        "- Si ya existe una memoria con la misma información, NO la agregues de nuevo.",
        "- Compará por SIGNIFICADO, no por texto exacto. 'Le gusta el helado' = 'Le encanta el helado'.",
        "",
        "Ejemplos de respuestas:",
        '- Usuario dice "me encanta el sushi" (sin memorias previas): {"memoryCandidates":[{"kind":"preference","text":"Le encanta el sushi.","confidence":0.88}],"archiveMemoryIds":[],"behaviorNotes":[]}',
        '- Usuario dice "me mude a barcelona" (tiene "Vive en Madrid"): {"memoryCandidates":[{"kind":"profile","text":"Vive en Barcelona.","confidence":0.85}],"archiveMemoryIds":["mem_abc123"],"behaviorNotes":[]}',
        '- Usuario dice "que calor" (no revela nada personal): {"memoryCandidates":[],"archiveMemoryIds":[],"behaviorNotes":[]}',
        '- Usuario dice "ya no juego al tenis" (tiene "Juega al tenis"): {"memoryCandidates":[],"archiveMemoryIds":["mem_xyz789"],"behaviorNotes":[]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Memorias existentes del usuario:",
        existingMemories.length > 0
          ? JSON.stringify(existingMemories, null, 2)
          : "(sin memorias previas)",
        "",
        `Mensaje del usuario: "${request.input}"`,
        "",
        composedRaw
          ? `Respuesta de Koru: "${cleanText(composedRaw.reply)}"`
          : "",
        "",
        "Tool observations:",
        toolObservationSummary(toolExecutions),
      ].filter(Boolean).join("\n"),
    },
  ];
}

export async function extractMemoryWithJsonPrompt(
  request: KoruBackendTurnRequest,
  config: ProviderConfig,
  toolExecutions: ToolExecution[],
  composedRaw: Record<string, unknown> | undefined,
  extractorTimeout: number,
): Promise<{ raw: Record<string, unknown>; provider: "nvidia" | "openrouter" | "minimax" | "bluesminds"; model?: string; fallbackReason?: string }> {
  const pp = inferProviderFromModel(request.model);
  const result = await callProvider(config, buildMemoryExtractorMessages(request, toolExecutions, composedRaw), extractorTimeout, false, pp);
  const content = cleanText(result.message.content);
  const raw = safeJsonObjectFromContent(content);
  return {
    raw,
    provider: result.provider,
    model: result.model,
    fallbackReason: result.fallbackReason,
  };
}

export function normalizeMemoryCandidates(value: unknown): Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] {
  return asArray(value).map(asRecord).map((item) => ({
    kind: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(cleanText(item.kind))
      ? cleanText(item.kind) as MemoryFact["kind"]
      : "profile" as const,
    text: cleanText(item.text),
    confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.7,
    sensitivity: cleanText(item.sensitivity) === "sensitive" ? "sensitive" as const : "normal" as const,
    status: "candidate" as const,
    rootQuote: cleanText(item.root_quote ?? item.rootQuote),
    useForSuggestions: item.use_for_suggestions === false || item.useForSuggestions === false ? false : true,
  })).filter((item) => item.text.length > 4).slice(0, 5);
}

// 🔴 FIX: síntesis determinística de memorias a partir de revelaciones pasivas.
export function synthesizeMemoryFromRevelation(input: string): Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] {
  const candidates: Omit<MemoryFact, "id" | "createdAt" | "sourceEntryId">[] = [];
  const text = input.trim();
  let m: RegExpMatchArray | null;

  // ── PREFERENCES: "me encanta X", "me gusta X", "amo X", "odio X", "soy fan de X" ──
  if ((m = text.match(/\b(?:me encanta|me encantan|amo|me apasiona|me fascina|me gustan los|me gustan las|me gusta el|me gusta la|me gusta|adoro|soy fan de|soy fan|me copa|me copan|me re gusta|me re copa)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "preference", text: `Le encanta ${m[1].trim()}.`, confidence: 0.88, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "odio X" / "no me gusta X" / "detesto X"
  if ((m = text.match(/\b(?:odio|detesto|no me gusta|no soporto|me rechina|me molesta)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "preference", text: `Odia ${m[1].trim()}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "soy celiaco" / "soy vegetariano" / "soy alergico a X"
  if ((m = text.match(/\b(?:soy|soy )?(celiaco|celíaca|vegetariano|vegetariana|vegano|vegana|diabetico|diabética|alergico|alérgico|alergica|alérgica|intolerante)\s+(?:a\s+|al\s+|a la\s+|a los\s+)?([^.!?]{3,60})?/i))) {
    const condition = m[1].toLowerCase();
    const to = m[2]?.trim();
    candidates.push({ kind: "wellbeing", text: `Es ${condition}${to ? ` a ${to}` : ""}.`, confidence: 0.87, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "tengo alergia a X" / "tengo X" (condiciones médicas)
  if ((m = text.match(/\btengo\s+(alergia|alergias|asma|diabetes|hipertension|hipotiroidismo|migraña|migranas)\s*(?:a\s+|al\s+|a la\s+)?([^.!?]{3,60})?/i))) {
    const condition = m[1].toLowerCase();
    const to = m[2]?.trim();
    candidates.push({ kind: "wellbeing", text: `Tiene ${condition}${to ? ` a ${to}` : ""}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── ROUTINES/GOALS: "estoy X", "trabajo de X", "estudio X", "aprendo X" ──
  if ((m = text.match(/\b(?:estoy|ando|estuve)\s+(trabajando|aprendiendo|leyendo|escuchando|viendo|estudiando|haciendo|armando|programando|escribiendo|cocinando|preparando|investigando|diseñando|creando|desarrollando|practicando|jugando|entrenando|corriendo|necessitando)\s+(?:en\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?([^.!?]{3,100})/i))) {
    const action = m[1].toLowerCase();
    const what = m[2].trim();
    const kind = action === "aprendiendo" || action === "practicando" ? "routine" : action === "trabajando" || action === "programando" || action === "desarrollando" || action === "creando" || action === "diseñando" ? "goal" : "routine";
    const verbMap: Record<string, string> = {
      trabajando: "Trabaja en", aprendiendo: "Aprende", leyendo: "Está leyendo",
      escuchando: "Escucha", viendo: "Está viendo", estudiando: "Estudia",
      haciendo: "Está haciendo", armando: "Está armando", programando: "Programa",
      escribiendo: "Está escribiendo", cocinando: "Está cocinando", preparando: "Está preparando",
      investigando: "Investiga", diseñando: "Diseña", creando: "Está creando", desarrollando: "Desarrolla",
      practicando: "Practica", jugando: "Juega", entrenando: "Entrena", corriendo: "Corre",
    };
    candidates.push({ kind, text: `${verbMap[action] ?? "Está " + action} ${what}.`, confidence: 0.86, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "trabajo de X" / "trabajo en X" / "soy X" (profesión)
  if ((m = text.match(/\b(?:trabajo de|trabajo en|trabajo como|soy)\s+(?:un\s+|una\s+|un\b|una\b)?([a-záéíóúñ][^.!?]{3,60})/i))) {
    const what = m[1].trim();
    // Filtrar palabras que NO son profesiones
    if (!/^(celiaco|celíaca|vegetariano|vegetariana|vegano|vegana|diabetico|diabética|alergico|alérgico|alergica|alérgica|de|la|el|los|las|un|una|muy|bastante|feliz|triste|cansado|cansada|aburrido|aburrida)$/.test(what.toLowerCase())) {
      candidates.push({ kind: "profile", text: `Trabaja de ${what}.`, confidence: 0.82, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
    }
  }
  // "estudio X" / "estoy estudiando X" (carrera)
  if ((m = text.match(/\b(?:estudio|estudiando|estoy estudiando|cursando)\s+(?:la\s+|el\s+|la carrera de\s+|el profesorado de\s+)?([a-záéíóúñ][^.!?]{3,60})/i))) {
    candidates.push({ kind: "goal", text: `Estudia ${m[1].trim()}.`, confidence: 0.84, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── RELATIONSHIPS: "tengo un gato/perro", "mi novia se llama X", "mi madre es X" ──
  // "tengo un gato/perro/mascota"
  if ((m = text.match(/\btengo\s+(?:un\s+|una\s+|unos\s+|unas\s+)?(gato|gata|gatos|perro|perros|perra|gata|conejo|coneja|hamster|pez|peces|tortuga|loro|canario|cobayo|cobaya|mascota|mascotas)\b([^.]*)/i))) {
    candidates.push({ kind: "relationship", text: `Tiene ${m[1].toLowerCase()}${m[2]?.trim() ? ` ${m[2].trim()}` : ""}.`, confidence: 0.84, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "mi novia/novia/esposa/madre/padre se llama X"
  if ((m = text.match(/\b(?:mi\s+)?(?:novia|novio|esposa|esposo|mujer|marido|madre|padre|mamá|mamá|papá|papá|hermano|hermana|hijo|hija|amigo|amiga|sobrino|sobrina|tio|tía|abuela|abuelo|primo|prima)\s+(?:se llama|se llama|es|esta|está|trabaja de|vive en|cumple|tiene)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "relationship", text: `${m[0].trim()}.`, confidence: 0.82, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "mi madre/padre cumple X"
  if ((m = text.match(/\b(?:mi\s+)?(?:madre|padre|mam[áa]|pap[áa])\s+(?:cumple|tiene|es|está|va a)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "relationship", text: `Sobre su madre/padre: ${m[0].trim()}.`, confidence: 0.8, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── PROFILE: cumpleaños, ubicación, nombre ──
  // "mi cumple es en X" / "cumple años en X"
  if ((m = text.match(/\b(?:mi\s+)?cumple[años]*\s+(?:es|en|el|por|cae en)\s+([^.!?]{3,60})/i))) {
    candidates.push({ kind: "profile", text: `Cumpleaños: ${m[1].trim()}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  // "vivo en X" / "estoy en X" / "soy de X" (ubicación)
  if ((m = text.match(/\b(?:vivo en|estoy en|estoy en|soy de|viviendo en|me mude a|me mudé a)\s+([a-záéíóúñ][^.!?]{3,50})/i))) {
    candidates.push({ kind: "profile", text: `Vive en ${m[1].trim()}.`, confidence: 0.83, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── GOALS: "quiero X", "tengo pensado X", "estoy ahorrando para X" ──
  if ((m = text.match(/\b(?:quiero|tengo pensado|tengo ganas de|me gustaria|me gustaría|estoy ahorrando para|estoy juntando para|planeo|tengo planeado|mi objetivo es|mi meta es)\s+([^.!?]{3,100})/i))) {
    candidates.push({ kind: "goal", text: `Quiere ${m[1].trim()}.`, confidence: 0.84, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── ROUTINES: "todos los días X", "los martes X", "cada mañana X" ──
  if ((m = text.match(/\b(?:todos los dias|todos los días|cada dia|cada día|los lunes|los martes|los miercoles|los miércoles|los jueves|los viernes|los sabados|los sábados|los domingos|cada mañana|cada noche|cada semana|cada mes)\s+([^.!?]{3,100})/i))) {
    candidates.push({ kind: "routine", text: `${m[0].trim()}.`, confidence: 0.82, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  // ── INTERESTS: "me interesa X", "me llama la atención X", "estoy buscando X" ──
  if ((m = text.match(/\b(?:me interesa|me interesan|me llama la atencion|me llama la atención|estoy buscando|estoy viendo|estoy explorando|me estoy metiendo en)\s+([^.!?]{3,80})/i))) {
    candidates.push({ kind: "preference", text: `Le interesa ${m[1].trim()}.`, confidence: 0.80, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }

  return candidates;
}

export function normalizeCommitments(value: unknown): Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] {
  return asArray(value).map(asRecord).map((item) => ({
    title: cleanText(item.title),
    dueHint: cleanText(item.due_hint ?? item.dueHint, "sin fecha"),
    dueAt: cleanText(item.dueAt),
    recurrence: ["daily", "weekly", "monthly"].includes(cleanText(item.recurrence)) ? cleanText(item.recurrence) as Commitment["recurrence"] : undefined,
    status: "open" as const,
  })).filter((item) => item.title.length > 3).slice(0, 5);
}

export function normalizeRecords(value: unknown): Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[] {
  return asArray(value).map(asRecord).map((item) => ({
    domain: ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"].includes(cleanText(item.domain))
      ? cleanText(item.domain) as LifeRecord["domain"]
      : "capture" as const,
    kind: cleanText(item.kind) as LifeRecord["kind"],
    title: cleanText(item.title),
    value: cleanText(item.value),
    amount: typeof item.amount === "number" ? item.amount : undefined,
    currency: cleanText(item.currency),
    person: cleanText(item.person),
    url: cleanText(item.url),
    collection: cleanText(item.collection),
    dueHint: cleanText(item.dueHint ?? item.due_hint),
    notes: cleanText(item.notes),
    tags: asArray(item.tags).map((tag) => cleanText(tag)).filter(Boolean),
  })).filter((item) => item.title.length > 2 && item.kind).slice(0, 8);
}

export function normalizeSuggestedActions(value: unknown): KoruSuggestedAction[] {
  return asArray(value).map(asRecord).map((item) => ({
    id: cleanText(item.id, createId("suggestion")),
    label: cleanText(item.label, "Usar"),
    kind: ["save", "remind", "watch", "compare_more", "approve", "calendar", "research"].includes(cleanText(item.kind))
      ? cleanText(item.kind) as KoruSuggestedAction["kind"]
      : "research" as const,
    requiresApproval: item.requiresApproval !== false,
    payload: asRecord(item.payload),
  })).filter((item) => item.label.length > 1).slice(0, 4);
}

export function personalCapturesFromTools(toolExecutions: ToolExecution[]): PersonalCaptureData[] {
  return toolExecutions
    .map((execution) => execution.result)
    .filter((result): result is PersonalCaptureData => result.type === "personal_capture");
}

export function localActionsFromTools(toolExecutions: ToolExecution[]): LocalActionData[] {
  return toolExecutions
    .map((execution) => execution.result)
    .filter((result): result is LocalActionData => result.type === "local_action");
}

export function memoryCapturesFromTools(toolExecutions: ToolExecution[]): MemoryCaptureData[] {
  return toolExecutions
    .map((execution) => execution.result)
    .filter((result): result is MemoryCaptureData => result.type === "memory_capture");
}

export function uniqueRecords(records: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[]): Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (/^dato guardado$/i.test(record.title.trim())) return false;
    const key = `${record.domain}|${record.kind}|${plainLower(record.title)}|${plainLower(record.value ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function uniqueCommitments(commitments: Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[]): Omit<Commitment, "id" | "createdAt" | "sourceEntryId">[] {
  const seen = new Set<string>();
  return commitments.filter((commitment) => {
    const key = `${plainLower(commitment.title)}|${plainLower(commitment.dueHint)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Type-only re-exports for callers that still want to import from this module.
export type {
  KoruState,
  MemoryFact,
  Commitment,
  LifeRecord,
  UiBlock,
  ProviderConfig,
  KoruBackendTurnRequest,
  ProviderToolCall,
  ToolExecution,
  KoruSuggestedAction,
  LocalActionData,
  PersonalCaptureData,
  MemoryCaptureData,
  ChatMessage,
};
