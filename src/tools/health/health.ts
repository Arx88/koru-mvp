/**
 * Bloque Health — Medicación, sueño, hidratación, ánimo, hábitos, calidad aire.
 * 6 tools. Todas locales (leen/escriben KoruState) + Open-Meteo para aire.
 */

import { defineTool, policies, type ToolHandler, type ToolRunContext } from "../types";
import type { LifeRecord } from "../../domain/types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";

// ─── medication_reminder ────────────────────────────────────────────────────
export const medicationReminder: ToolHandler = {
  definition: defineTool(
    "medication_reminder",
    "Organiza un esquema de medicación y programa recordatorios horarios. Úsala cuando el usuario diga 'recordame el ibuprofeno cada 8 horas por 5 días', 'necesito tomar amoxicilina cada 12 horas', 'avisame la pastilla de la presión'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del medicamento." },
        frequency: { type: "string", description: "Frecuencia (ej: 'cada 8 horas', 'cada 12 horas', 'diario')." },
        duration: { type: "string", description: "Duración (ej: '5 días', '10 días', 'crónico')." },
        note: { type: "string" },
      },
      required: ["name", "frequency"],
    },
  ),
  policy: policies.localWrite("Crea esquema de medicación."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const frequency = String(args.frequency ?? "").trim();
    if (!name || !frequency) return { type: "medication_reminder", status: "failed", error: "Indicá medicamento y frecuencia." };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "health",
      kind: "medication",
      title: name,
      value: frequency,
      dueHint: frequency,
      notes: args.duration ? `${args.duration}${args.note ? ` — ${args.note}` : ""}` : args.note,
    };
    return {
      type: "medication_reminder",
      status: "ok",
      name, frequency,
      duration: args.duration,
      records: [record],
      note: "Esquema guardado. Los recordatorios se activarán según la frecuencia.",
    };
  },
};

// ─── sleep_track ────────────────────────────────────────────────────────────
export const sleepTrack: ToolHandler = {
  definition: defineTool(
    "sleep_track",
    "Registra tus horas de sueño y calcula promedios. Úsala cuando el usuario diga 'dormí 6 horas anoche', 'anoche dormí 7.5h', 'cómo viene mi sueño esta semana'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        hours: { type: "number", description: "Horas dormidas." },
        quality: { type: "string", enum: ["buena", "regular", "mala"] },
      },
      required: ["hours"],
    },
  ),
  policy: policies.localWrite("Registra sueño."),
  async run(args, ctx: ToolRunContext) {
    const hours = Number(args.hours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) return { type: "sleep_track", status: "failed", error: "Indicá horas válidas (0-24)." };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "health",
      kind: "sleep",
      title: `Sueño: ${hours}h`,
      value: String(hours),
      notes: args.quality ? `Calidad: ${args.quality}` : undefined,
    };
    // Promedio de últimos 7 registros.
    const recent = (ctx.state.records ?? []).filter((r) => r.kind === "sleep").slice(-6);
    const allHours = [hours, ...recent.map((r) => Number(r.value)).filter(Number.isFinite)];
    const avg = allHours.reduce((s, n) => s + n, 0) / allHours.length;
    return {
      type: "sleep_track",
      status: "ok",
      hours,
      quality: args.quality,
      records: [record],
      avg7Days: Number(avg.toFixed(1)),
      samples: allHours.length,
      note: avg < 6.5 ? "Promedio bajo: conviene apuntar a 7-8h." : avg > 9 ? "Promedio alto: revisá calidad." : "Promedio saludable.",
    };
  },
};

// ─── hydration_remind ───────────────────────────────────────────────────────
export const hydrationRemind: ToolHandler = {
  definition: defineTool(
    "hydration_remind",
    "Programa recordatorios para tomar agua según tu rutina. Úsala cuando el usuario diga 'avisame cada 2 horas que tome agua', 'recordame hidratación', 'necesito beber más agua'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        intervalHours: { type: "number", description: "Intervalo en horas entre recordatorios. Default 2." },
        activeStart: { type: "string", description: "Hora inicio (HH:MM). Default 08:00." },
        activeEnd: { type: "string", description: "Hora fin (HH:MM). Default 22:00." },
      },
      required: [],
    },
  ),
  policy: policies.localWrite("Configura recordatorio de hidratación."),
  async run(args) {
    const interval = Number(args.intervalHours ?? 2);
    return {
      type: "hydration_remind",
      status: "ok",
      intervalHours: interval,
      activeStart: args.activeStart ?? "08:00",
      activeEnd: args.activeEnd ?? "22:00",
      memoryCandidates: [{
        kind: "routine" as const,
        text: `Hidratación: recordar beber agua cada ${interval} horas`,
        confidence: 0.9,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: "hidratación",
        useForSuggestions: true,
      }],
      note: `Recordatorios cada ${interval}h configurados. Beber agua mejora energía y concentración.`,
    };
  },
};

// ─── mood_track ─────────────────────────────────────────────────────────────
export const moodTrack: ToolHandler = {
  definition: defineTool(
    "mood_track",
    "Registra tu ánimo para ver tendencias a lo largo del tiempo. Úsala cuando el usuario diga 'hoy me siento bien', 'vengo cansado esta semana', 'ánimo bajo', 'registro emocional'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        mood: { type: "string", enum: ["muy bien", "bien", "normal", "cansado", "bajo", "mal"] },
        note: { type: "string" },
      },
      required: ["mood"],
    },
  ),
  policy: policies.localWrite("Registra ánimo."),
  async run(args) {
    const mood = String(args.mood ?? "").trim();
    if (!mood) return { type: "mood_track", status: "failed", error: "Indicá tu ánimo." };
    const record: Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId"> = {
      domain: "health",
      kind: "medical_info",
      title: `Ánimo: ${mood}`,
      value: mood,
      notes: args.note,
    };
    return {
      type: "mood_track",
      status: "ok",
      mood,
      records: [record],
      note: /bajo|mal/i.test(mood) ? "Lo registro. Si persiste varios días, considerá hablar con alguien de confianza." : "Anotado.",
    };
  },
};

// ─── habit_streak ───────────────────────────────────────────────────────────
export const habitStreak: ToolHandler = {
  definition: defineTool(
    "habit_streak",
    "Cuenta la racha de días seguidos de un hábito y te alienta a mantenerla. Úsala cuando el usuario diga 'cuántos días seguidos gimnasio?', 'racha de meditación', 'mi racha de X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        habit: { type: "string", description: "Nombre del hábito." },
      },
      required: ["habit"],
    },
  ),
  policy: policies.readonly("Cuenta racha de hábito."),
  async run(args, ctx: ToolRunContext) {
    const habit = String(args.habit ?? "").trim().toLowerCase();
    if (!habit) return { type: "habit_streak", status: "failed", error: "Indicá el hábito." };
    const today = new Date();
    const days: string[] = [];
    // Buscar records/entries que mencionen el hábito en últimos 30 días.
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const has = (ctx.state.records ?? []).some((r) => r.createdAt.slice(0, 10) === dStr && (r.title + r.value + (r.notes ?? "")).toLowerCase().includes(habit));
      if (has) days.push(dStr);
      else if (i > 0) break; // racha se rompe
    }
    days.reverse();
    return {
      type: "habit_streak",
      status: "ok",
      habit,
      streak: days.length,
      days,
      note: days.length === 0 ? "No encontré registros recientes de ese hábito." : days.length >= 7 ? `¡${days.length} días seguidos! Excelente racha, no la rompas.` : `Racha de ${days.length} día(s).`,
    };
  },
};

// ─── air_quality_advice ─────────────────────────────────────────────────────
export const airQualityAdvice: ToolHandler = {
  definition: defineTool(
    "air_quality_advice",
    "Consulta calidad del aire y aconseja actividad según PM2.5/PM10. Úsala cuando el usuario diga 'calidad del aire hoy', 'conviene correr afuera?', 'PM2.5 en mi zona', 'polución'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        city: { type: "string", description: "Nombre de ciudad (si no tenés coords)." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee calidad del aire de Open-Meteo."),
  async run(args) {
    const lat = Number(args.lat);
    const lng = Number(args.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { type: "air_quality_advice", status: "failed", error: "Indicá lat y lng (o usá weather_full que geolocaliza)." };
    }
    const cacheKey = `aq:${lat.toFixed(2)}:${lng.toFixed(2)}`;
    const data = await cached<{ current?: { pm2_5?: number; pm10?: number; european_aqi?: number; us_aqi?: number } }>(cacheKey, ttls.weatherNow, async () => {
      const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lng));
      url.searchParams.set("current", "pm2_5,pm10,european_aqi,us_aqi");
      const r = await fetchJson(url.toString(), { timeoutMs: 8_000 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    const c = data.current;
    if (!c) return { type: "air_quality_advice", status: "failed", error: "Sin datos de calidad del aire." };
    const pm25 = c.pm2_5 ?? 0;
    let level: string;
    let advice: string;
    if (pm25 <= 12) { level = "Buena"; advice = "Aire limpio: ideal para actividad al aire libre."; }
    else if (pm25 <= 35) { level = "Moderada"; advice = "Aceptable; sensibles pueden reducir esfuerzo prolongado."; }
    else if (pm25 <= 55) { level = "Poco saludable (sensibles)"; advice = "Conviene entrenar indoor si tenés asma o afecciones."; }
    else if (pm25 <= 150) { level = "Poco saludable"; advice = "Evitá ejercicio intenso al aire libre."; }
    else { level = "Mala"; advice = "Quedate indoor, cerrá ventanas, usa purificador si tenés."; }
    return {
      type: "air_quality_advice",
      status: "ok",
      lat, lng,
      pm25: c.pm2_5,
      pm10: c.pm10,
      europeanAqi: c.european_aqi,
      usAqi: c.us_aqi,
      level,
      advice,
      source: "Open-Meteo Air Quality",
    };
  },
};
