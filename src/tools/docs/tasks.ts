/**
 * Bloque Tasks — Notas, proyectos, tareas, calendario, recordatorios.
 * Sub-grupo de "Docs/Productividad". Todas locales (leen/escriben KoruState).
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import type { LifeRecord, Commitment } from "../../domain/types";

// ─── note_write ─────────────────────────────────────────────────────────────
export const noteWrite: ToolHandler = {
  definition: defineTool(
    "note_write",
    "Crea una nota de texto rápida. Úsala cuando el usuario diga 'anota: comprar pan', 'nota: idea de regalo para Lu', 'poné en notas que debo llamar al médico'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Contenido de la nota." },
        collection: { type: "string", description: "Carpeta/categoría opcional (ej: 'Ideas', 'Trabajo')." },
      },
      required: ["text"],
    },
  ),
  policy: policies.localWrite("Guarda nota."),
  async run(args) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "note_write", status: "failed", error: "Indicá el texto." };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "capture",
      kind: "idea",
      title: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
      value: text,
      collection: args.collection ? String(args.collection) : "Notas",
    };
    return {
      type: "note_write",
      status: "ok",
      text,
      records: [record],
      block: { type: "saved_record", title: "Nota guardada", records: [record] },
    };
  },
};

// ─── note_show ──────────────────────────────────────────────────────────────
export const noteShow: ToolHandler = {
  definition: defineTool(
    "note_show",
    "Muestra las notas guardadas. Úsala cuando el usuario diga 'mostrame mis notas', 'qué anoté ayer?', 'notas de esta semana'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        collection: { type: "string", description: "Filtrar por carpeta/categoría opcional." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee notas guardadas."),
  async run(args, ctx: ToolRunContext) {
    const collection = args.collection ? String(args.collection) : null;
    const notes = (ctx.state.records ?? [])
      .filter((r) => r.kind === "idea" && (!collection || r.collection === collection))
      .slice(-15)
      .reverse()
      .map((r) => ({ title: r.title, text: r.value, collection: r.collection, date: r.createdAt.slice(0, 10) }));
    return { type: "note_show", status: "ok", collection, notes };
  },
};

// ─── note_search ────────────────────────────────────────────────────────────
export const noteSearch: ToolHandler = {
  definition: defineTool(
    "note_search",
    "Busca en tus notas por texto o palabra clave. Úsala cuando el usuario diga 'qué anoté sobre vacaciones?', 'buscá en mis notas X', 'tengo algo sobre contabilidad?'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto a buscar." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Busca en notas."),
  async run(args, ctx: ToolRunContext) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "note_search", status: "failed", error: "Indicá qué buscar." };
    const matches = (ctx.state.records ?? [])
      .filter((r) => (r.kind === "idea" || r.kind === "recommendation") && `${r.title} ${r.value} ${r.notes ?? ""}`.toLowerCase().includes(q))
      .slice(-15)
      .reverse()
      .map((r) => ({ title: r.title, text: r.value, date: r.createdAt.slice(0, 10) }));
    return { type: "note_search", status: "ok", query: args.query, matches };
  },
};

// ─── project_create ─────────────────────────────────────────────────────────
export const projectCreate: ToolHandler = {
  definition: defineTool(
    "project_create",
    "Crea un proyecto con nombre que agrupa notas, recursos y tareas relacionadas. Úsala cuando el usuario diga 'creá el proyecto Viaje a Japón', 'proyecto Renovar cocina', 'nuevo proyecto Tesis'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del proyecto." },
        description: { type: "string" },
      },
      required: ["name"],
    },
  ),
  policy: policies.localWrite("Crea proyecto como memory."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "project_create", status: "failed", error: "Indicá el nombre." };
    return {
      type: "project_create",
      status: "ok",
      name,
      description: args.description ? String(args.description) : undefined,
      memoryCandidates: [{
        kind: "goal" as const,
        text: `Proyecto: ${name}${args.description ? ` — ${args.description}` : ""}`,
        confidence: 0.95,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: name,
        useForSuggestions: true,
      }],
    };
  },
};

// ─── project_add ────────────────────────────────────────────────────────────
export const projectAdd: ToolHandler = {
  definition: defineTool(
    "project_add",
    "Agrega una nota, recurso o tarea a un proyecto existente. Úsala cuando el usuario diga 'sumá esto al proyecto Viaje a Japón', 'agregá este link al proyecto Renovar'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        project: { type: "string", description: "Nombre del proyecto." },
        title: { type: "string" },
        note: { type: "string" },
        url: { type: "string" },
      },
      required: ["project", "title"],
    },
  ),
  policy: policies.localWrite("Agrega item a proyecto."),
  async run(args) {
    const project = String(args.project ?? "").trim();
    const title = String(args.title ?? "").trim();
    if (!project || !title) return { type: "project_add", status: "failed", error: "Indicá proyecto y título." };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "capture",
      kind: "idea",
      title,
      notes: args.note ? String(args.note) : undefined,
      url: args.url ? String(args.url) : undefined,
      collection: project,
    };
    return {
      type: "project_add",
      status: "ok",
      project,
      records: [record],
      block: { type: "saved_record", title: `Agregado a ${project}`, records: [record] },
    };
  },
};

// ─── project_show ───────────────────────────────────────────────────────────
export const projectShow: ToolHandler = {
  definition: defineTool(
    "project_show",
    "Muestra todo lo guardado de un proyecto. Úsala cuando el usuario diga 'mostrame el proyecto Viaje a Japón', 'qué tengo en Renovar cocina'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        project: { type: "string", description: "Nombre del proyecto." },
      },
      required: ["project"],
    },
  ),
  policy: policies.readonly("Lee proyecto guardado."),
  async run(args, ctx: ToolRunContext) {
    const project = String(args.project ?? "").trim();
    if (!project) return { type: "project_show", status: "failed", error: "Indicá el proyecto." };
    const items = (ctx.state.records ?? [])
      .filter((r) => r.collection === project)
      .slice(-20)
      .reverse()
      .map((r) => ({ title: r.title, note: r.notes, url: r.url, date: r.createdAt.slice(0, 10) }));
    return { type: "project_show", status: "ok", project, items };
  },
};

// ─── task_create ────────────────────────────────────────────────────────────
export const taskCreate: ToolHandler = {
  definition: defineTool(
    "task_create",
    "Crea una tarea con fecha y prioridad. Úsala cuando el usuario diga 'tarea: llamar al dentista mañana', 'para el viernes: enviar CV', 'agregá a pendientes comprar regalo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        dueText: { type: "string", description: "Fecha natural (ej: 'mañana', 'el viernes', 'próxima semana')." },
        priority: { type: "string", enum: ["Alta", "Media", "Baja"], default: "Media" },
      },
      required: ["title"],
    },
  ),
  policy: policies.localWrite("Crea tarea/commitment."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const dueText = String(args.dueText ?? "").trim();
    if (!title) return { type: "task_create", status: "failed", error: "Indicá la tarea." };
    const commitment: Omit<Commitment, "id" | "createdAt" | "sourceEntryId"> = {
      title,
      dueHint: dueText || "sin fecha",
      status: "open",
    };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "work",
      kind: "deadline",
      title,
      dueHint: dueText,
      notes: args.priority ? `Prioridad: ${args.priority}` : undefined,
    };
    return {
      type: "task_create",
      status: "ok",
      commitments: [commitment],
      records: [record],
      block: { type: "reminder", title, dueText: dueText || "sin fecha", note: args.priority ? `Prioridad ${args.priority}` : undefined },
    };
  },
};

// ─── task_list ──────────────────────────────────────────────────────────────
export const taskList: ToolHandler = {
  definition: defineTool(
    "task_list",
    "Lista las tareas pendientes ordenadas por prioridad/fecha. Úsala cuando el usuario diga 'qué tengo pendiente?', 'tareas de esta semana', 'lista de pendientes'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["open", "done", "all"], default: "open" },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lista tareas guardadas."),
  async run(args, ctx: ToolRunContext) {
    const status = String(args.status ?? "open");
    const tasks = (ctx.state.commitments ?? [])
      .filter((c) => status === "all" || c.status === status)
      .slice(-20)
      .reverse()
      .map((c) => ({ title: c.title, dueHint: c.dueHint, status: c.status, recurrence: c.recurrence }));
    return { type: "task_list", status: "ok", filter: status, tasks };
  },
};

// ─── task_done ──────────────────────────────────────────────────────────────
export const taskDone: ToolHandler = {
  definition: defineTool(
    "task_done",
    "Marca una tarea como completada. Úsala cuando el usuario diga 'listo la de dentista', 'completé el informe', 'ya hice X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto para encontrar la tarea." },
      },
      required: ["query"],
    },
  ),
  policy: policies.localWrite("Marca tarea como hecha."),
  async run(args, ctx: ToolRunContext) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "task_done", status: "failed", error: "Indicá qué tarea completar." };
    const match = (ctx.state.commitments ?? []).find((c) => c.status === "open" && c.title.toLowerCase().includes(q));
    if (!match) {
      return { type: "task_done", status: "ok", found: false, query: args.query, note: "No encontré esa tarea abierta." };
    }
    return { type: "task_done", status: "ok", found: true, title: match.title, note: "El store la marcará como done cuando apliques el cambio." };
  },
};

// ─── calendar_add ───────────────────────────────────────────────────────────
export const calendarAdd: ToolHandler = {
  definition: defineTool(
    "calendar_add",
    "Agrega una cita al calendario local con fecha, hora y ubicación. Úsala cuando el usuario diga 'cita con el médico el 15 a las 10', 'cumpleaños de Marta el 22', 'reunión el jueves 16hs'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "Fecha (YYYY-MM-DD o natural)." },
        time: { type: "string", description: "Hora (HH:MM o natural)." },
        location: { type: "string" },
      },
      required: ["title", "date"],
    },
  ),
  policy: policies.localWrite("Crea evento de calendario."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const date = String(args.date ?? "").trim();
    if (!title || !date) return { type: "calendar_add", status: "failed", error: "Indicá título y fecha." };
    return {
      type: "calendar_add",
      status: "ok",
      title,
      date,
      time: args.time ? String(args.time) : undefined,
      location: args.location ? String(args.location) : undefined,
      note: "Evento local listo. Usa calendar_export_ics para sincronizar con Google/Apple Calendar.",
    };
  },
};

// ─── calendar_show ──────────────────────────────────────────────────────────
export const calendarShow: ToolHandler = {
  definition: defineTool(
    "calendar_show",
    "Muestra los próximos eventos del calendario. Úsala cuando el usuario diga 'qué tengo esta semana?', 'agenda de hoy', 'próximos eventos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        days: { type: "number", description: "Ventana en días. Default 7." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee agenda."),
  async run(args, ctx: ToolRunContext) {
    const days = Number(args.days ?? 7);
    const now = Date.now();
    const until = now + days * 24 * 60 * 60 * 1000;
    const events = (ctx.state.calendarEvents ?? [])
      .filter((e) => {
        const ts = new Date(e.startsAt).getTime();
        return Number.isFinite(ts) && ts >= now - 24 * 60 * 60 * 1000 && ts <= until;
      })
      .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
      .slice(0, 15)
      .map((e) => ({ title: e.title, startsAt: e.startsAt, location: e.location }));
    return { type: "calendar_show", status: "ok", days, events };
  },
};

// ─── calendar_export_ics ────────────────────────────────────────────────────
export const calendarExportIcs: ToolHandler = {
  definition: defineTool(
    "calendar_export_ics",
    "Genera un archivo .ics con tus eventos para sincronizar con Google/Apple Calendar. Úsala cuando el usuario diga 'exportá mi agenda a ICS', 'quiero mi calendario en Google Calendar'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        days: { type: "number", description: "Ventana en días hacia adelante. Default 90." },
      },
      required: [],
    },
  ),
  policy: policies.localWrite("Genera archivo ICS."),
  async run(args, ctx: ToolRunContext) {
    const days = Number(args.days ?? 90);
    const now = Date.now();
    const until = now + days * 24 * 60 * 60 * 1000;
    const events = (ctx.state.calendarEvents ?? []).filter((e) => {
      const ts = new Date(e.startsAt).getTime();
      return Number.isFinite(ts) && ts >= now - 7 * 24 * 60 * 60 * 1000 && ts <= until;
    });
    const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Koru//Local//ES"];
    for (const e of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${e.id}@koru`);
      lines.push(`DTSTAMP:${fmt(new Date().toISOString())}`);
      lines.push(`DTSTART:${fmt(e.startsAt)}`);
      if (e.endsAt) lines.push(`DTEND:${fmt(e.endsAt)}`);
      lines.push(`SUMMARY:${e.title.replace(/[,\\]/g, " ")}`);
      if (e.location) lines.push(`LOCATION:${e.location.replace(/[,\\]/g, " ")}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const content = lines.join("\r\n");
    return {
      type: "calendar_export_ics",
      status: "ok",
      eventCount: events.length,
      artifact: { name: "koru-agenda.ics", kind: "document" as const, mimeType: "text/calendar", sizeLabel: `${events.length} eventos`, content },
      block: { type: "resource_bundle", title: "Agenda exportada", files: [{ name: "koru-agenda.ics", kind: "document" as const, mimeType: "text/calendar", sizeLabel: `${events.length} eventos`, content }] },
    };
  },
};

// ─── countdown ──────────────────────────────────────────────────────────────
export const countdown: ToolHandler = {
  definition: defineTool(
    "countdown",
    "Calcula cuánto falta (o cuánto pasó) para una fecha/evento. Úsala cuando el usuario diga 'cuánto falta para mi cumpleaños?', 'faltan para Navidad', 'cuántos días desde que empezó el año'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string", description: "Fecha (YYYY-MM-DD o natural)." },
        label: { type: "string", description: "Nombre del evento opcional." },
      },
      required: ["date"],
    },
  ),
  policy: policies.readonly("Cálculo de fechas local."),
  async run(args) {
    const dateStr = String(args.date ?? "").trim();
    if (!dateStr) return { type: "countdown", status: "failed", error: "Indicá la fecha." };
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      // 🔴 FIX: mapear festividades comunes a fechas concretas
      const lower = dateStr.toLowerCase().trim();
      const year = new Date().getFullYear();
      const holidays: Record<string, () => Date> = {
        navidad: () => { const d = new Date(year, 11, 25); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "nochebuena": () => { const d = new Date(year, 11, 24); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "fin de año": () => { const d = new Date(year, 11, 31); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "año nuevo": () => { const d = new Date(year + 1, 0, 1); return d; },
        "anio nuevo": () => { const d = new Date(year + 1, 0, 1); return d; },
        "reyes magos": () => { const d = new Date(year, 0, 6); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "dia del padre": () => { const d = new Date(year, 5, 15); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "dia de la madre": () => { const d = new Date(year, 9, 15); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "san valentin": () => { const d = new Date(year, 1, 14); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "dia del trabajo": () => { const d = new Date(year, 4, 1); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "halloween": () => { const d = new Date(year, 9, 31); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
        "pascua": () => { const d = new Date(year, 3, 20); if (d.getTime() < Date.now()) d.setFullYear(year + 1); return d; },
      };
      const matched = Object.keys(holidays).find(k => lower.includes(k));
      if (matched) {
        date.setTime(holidays[matched]().getTime());
      }
    }
    if (Number.isNaN(date.getTime())) {
      // Intentar parse natural simple (ej: "25 de diciembre").
      const m = dateStr.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i);
      if (m) {
        const months: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
        const day = Number(m[1]);
        const month = months[m[2].toLowerCase()];
        if (month !== undefined) {
          const year = new Date().getFullYear();
          const d = new Date(year, month, day);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          date.setTime(d.getTime());
        }
      }
    }
    if (Number.isNaN(date.getTime())) return { type: "countdown", status: "no_data", date: dateStr, error: `No pude interpretar "${dateStr}" como fecha. Probá con "25 de diciembre" o "2025-12-25".` };
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const days = Math.floor(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
    const hours = Math.floor((Math.abs(diffMs) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return {
      type: "countdown",
      status: "ok",
      date: dateStr,
      label: args.label ? String(args.label) : undefined,
      targetDate: date.toISOString(),
      days,
      hours,
      direction: diffMs >= 0 ? "faltan" : "pasaron",
      note: `${diffMs >= 0 ? "Faltan" : "Pasaron"} ${days} días y ${hours} horas${args.label ? ` para "${args.label}"` : ""}.`,
    };
  },
};

// ─── reminder_set ───────────────────────────────────────────────────────────
export const reminderSet: ToolHandler = {
  definition: defineTool(
    "reminder_set",
    "Programa un recordatorio. USÁ ESTA TOOL (no save_memory) cuando el usuario diga 'recordame', 'activa un recordatorio', 'avisame', 'no me olvides', 'recuérdame'. Si el usuario NO especifica qué recordar, usá el tema del último mensaje del asistente como title. Si el usuario NO especifica cuándo, dejá dueText='próximamente' y dueAt vacío. El usuario puede decir la hora de cualquier forma: 'en 60 segundos', 'mañana a las 9', 'el 20 del mes que viene'. Vos calculás el timestamp ISO 8601 si podés; si no podés, dejá dueAt vacío y el sistema igual crea el recordatorio.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Qué recordar (ej: 'Llamar a mi tía', 'Partido de Boca', 'Pagar el alquiler'). Si el usuario no especificó qué, usá el tema del contexto conversacional." },
        dueText: { type: "string", description: "Texto legible del cuándo (ej: 'en 60 segundos', 'mañana a las 9', 'próximamente')." },
        dueAt: { type: "string", description: "Timestamp ISO 8601 (ej: '2026-07-15T18:00:00.000Z'). OPCIONAL — si no podés calcularlo, dejá vacío. El recordatorio se crea igual con dueText." },
        note: { type: "string" },
      },
      required: ["title", "dueText"],
    },
  ),
  policy: policies.localWrite("Crea recordatorio."),
  async run(args) {
    // 🔴 KORU 3.0 — Fallback a __userInput si no hay title
    const title = String(args.title ?? args.__userInput ?? "").trim();
    const dueText = String(args.dueText ?? "próximamente").trim();
    const dueAt = String(args.dueAt ?? "").trim();
    if (!title) return { type: "reminder_set", status: "failed", error: "Indicá qué recordar." };
    // Validar dueAt si está presente
    let dueDate: Date | null = null;
    if (dueAt) {
      dueDate = new Date(dueAt);
      if (isNaN(dueDate.getTime())) dueDate = null;
    }
    const commitment: Omit<Commitment, "id" | "createdAt" | "sourceEntryId"> = {
      title,
      dueHint: dueText,
      ...(dueDate ? { dueAt: dueDate.toISOString() } : {}),
      status: "open",
    };
    return {
      type: "reminder_set",
      status: "ok",
      commitments: [commitment],
      block: { type: "reminder", title, dueText, note: args.note ? String(args.note) : undefined },
    };
  },
};

// ─── alarm_set ──────────────────────────────────────────────────────────────
export const alarmSet: ToolHandler = {
  definition: defineTool(
    "alarm_set",
    "Crea una alarma, despertador o temporizador. Úsala cuando el usuario pida 'activá un temporizador de X minutos', 'poné una alarma para las 7', 'despertame a las 6', 'cronómetro de 5 minutos'. Si el usuario pide un temporizador de X minutos, calculá la hora futura = ahora + X minutos. Si no podés calcular el timestamp exacto, pasá time='en X minutos' y dejá dueAt vacío.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        time: { type: "string", description: "Hora legible (ej: '7am', '16:30', '6 de la mañana')." },
        dueAt: { type: "string", description: "Timestamp ISO 8601. OPCIONAL — si no podés calcularlo, dejá vacío." },
        repeat: { type: "string", description: "Repetición (ej: 'diario', 'semanal', 'lunes a viernes')." },
        note: { type: "string" },
      },
      required: ["title", "time"],
    },
  ),
  policy: policies.localWrite("Crea alarma."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const time = String(args.time ?? "").trim();
    const dueAt = String(args.dueAt ?? "").trim();
    if (!title || !time) return { type: "alarm_set", status: "failed", error: "Indicá título y hora." };
    const block = { type: "alarm" as const, title, time, repeat: args.repeat ? String(args.repeat) : undefined, note: args.note ? String(args.note) : undefined };
    const commitment: Omit<Commitment, "id" | "createdAt" | "sourceEntryId"> = {
      title, dueHint: time, status: "open",
      ...(dueAt ? (() => {
        const d = new Date(dueAt);
        return isNaN(d.getTime()) ? {} : { dueAt: d.toISOString() };
      })() : {}),
    };
    return { type: "alarm_set", status: "ok", block, commitments: [commitment] };
  },
};
