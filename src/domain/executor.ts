/**
 * Fase 2.7 — Executor extraído de actions.ts.
 *
 * executeApprovedAction es la ÚNICA función de actions.ts usada por
 * el flujo principal (store.ts → KoruProvider). Las demás funciones
 * (buildActionProposalsLocal, normalizeActionDrafts, etc.) son parte
 * del motor client-side legacy.
 */
import type {
  AssistantAction,
  CalendarEvent,
  Commitment,
  KoruState,
  ProactiveNudge,
} from "./types";
import { dueAtFromText } from "./time";
import { createId } from "./store";

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
