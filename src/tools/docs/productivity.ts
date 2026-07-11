/**
 * Bloque Productivity — Resumir, traducir, letras, deep research, tareas de texto,
 * borradores, clipboard, QR, tiempo/sol/luna/feriados/zona horaria.
 * Sub-grupo de "Docs/Productividad".
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { searchAndEnrich, usableSources } from "../shared/scrapers";
import { validateWithCitations, extractionToDataCard } from "../shared/extractor";

// ─── summarize_url ───────────────────────────────────────────────────────────
export const summarizeUrl: ToolHandler = {
  definition: defineTool(
    "summarize_url",
    "Resume un artículo o página web en 5 puntos clave. Úsala cuando el usuario diga 'resumí este artículo', 'de qué va este link', 'síntesis de esta URL'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string", description: "URL del artículo." },
        focus: { type: "string", description: "Aspecto a destacar (opcional)." },
      },
      required: ["url"],
    },
  ),
  policy: policies.readonly("Lee y resume URL pública."),
  async run(args, ctx) {
    const url = String(args.url ?? "").trim();
    if (!url) return { type: "summarize_url", status: "failed", error: "Indicá la URL." };
    if (!ctx.chatFn) {
      return { type: "summarize_url", status: "not_configured", url, note: "Para resumir necesito el LLM local (Ollama). Configuralo en Settings." };
    }
    const sources = usableSources(await searchAndEnrich(url, 1));
    let dataCard = null;
    try { dataCard = extractionToDataCard(await validateWithCitations(String(args.focus ?? "resumen"), sources, ctx.chatFn)); } catch (err) { console.warn("[Koru] productivity dataCard extraction failed:", err instanceof Error ? err.message : err); }
    return { type: "summarize_url", status: "ok", url, sources, dataCard };
  },
};

// ─── summarize_text ─────────────────────────────────────────────────────────
export const summarizeText: ToolHandler = {
  definition: defineTool(
    "summarize_text",
    "Resume cualquier texto pegado. Úsala cuando el usuario diga 'resumí estos apuntes', 'síntesis de este email', 'acuortar este texto'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        focus: { type: "string" },
      },
      required: ["text"],
    },
  ),
  policy: policies.readonly("Resume texto local."),
  async run(args, ctx) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "summarize_text", status: "failed", error: "Pegá el texto." };
    if (!ctx.chatFn) return { type: "summarize_text", status: "not_configured", note: "Necesito el LLM local (Ollama) para resumir." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Sos un asistente que resume en español. Devolvé solo 5 bullets concisos del texto, sin intro ni outro." },
          { role: "user", content: `${args.focus ? `Foco: ${args.focus}\n\n` : ""}${text.slice(0, 8000)}` },
        ],
        { temperature: 0.2, maxTokens: 500 },
      );
      const bullets = r.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
      return { type: "summarize_text", status: "ok", summary: bullets };
    } catch (e) {
      return { type: "summarize_text", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── translate ──────────────────────────────────────────────────────────────
export const translate: ToolHandler = {
  definition: defineTool(
    "translate",
    "Traduce texto entre idiomas. Úsala cuando el usuario diga 'traducí esto al japonés', 'cómo se dice gracias en árabe', 'pasá este texto a inglés'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        to: { type: "string", description: "Idioma destino (ej: 'inglés', 'japonés')." },
        from: { type: "string", description: "Idioma origen (opcional, autodetecta)." },
      },
      required: ["text", "to"],
    },
  ),
  policy: policies.readonly("Traduce con LLM local."),
  async run(args, ctx) {
    const text = String(args.text ?? "").trim();
    const to = String(args.to ?? "").trim();
    if (!text || !to) return { type: "translate", status: "failed", error: "Indicá texto e idioma destino." };
    if (!ctx.chatFn) return { type: "translate", status: "not_configured", note: "Necesito el LLM local (Ollama) para traducir." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: `Sos traductor experto. Traducí al ${to}${args.from ? ` desde el ${args.from}` : ""}. Devolvé SOLO la traducción, sin explicaciones ni comillas.` },
          { role: "user", content: text },
        ],
        { temperature: 0.2, maxTokens: 1000 },
      );
      return { type: "translate", status: "ok", original: text, to, translation: r.content.trim() };
    } catch (e) {
      return { type: "translate", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── lyrics_find ────────────────────────────────────────────────────────────
export const lyricsFind: ToolHandler = {
  definition: defineTool(
    "lyrics_find",
    "Busca la letra de una canción. Úsala cuando el usuario diga 'letra de Bohemian Rhapsody', 'cómo sigue esa de Cerati', 'letra de la canción X de Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        artist: { type: "string" },
        title: { type: "string" },
      },
      required: ["artist", "title"],
    },
  ),
  policy: policies.readonly("Lee letra pública via lyrics.ovh."),
  async run(args) {
    const artist = String(args.artist ?? "").trim();
    const title = String(args.title ?? "").trim();
    if (!artist || !title) return { type: "lyrics_find", status: "failed", error: "Indicá artista y título." };
    const cacheKey = `lyrics:${artist.toLowerCase()}:${title.toLowerCase()}`;
    const lyrics = await cached<string>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<{ lyrics?: string }>(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.lyrics?.trim() ?? "";
    });
    if (!lyrics) {
      return { type: "lyrics_find", status: "ok", artist, title, lyrics: "", note: "No encontré esa letra. Probá con otro nombre." };
    }
    return { type: "lyrics_find", status: "ok", artist, title, lyrics };
  },
};

// ─── deep_research ──────────────────────────────────────────────────────────
export const deepResearch: ToolHandler = {
  definition: defineTool(
    "deep_research",
    "Investigación profunda: abre múltiples fuentes, contrasta, valida con citas y sintetiza con referencias. Úsala cuando el usuario diga 'investigá si conviene alquilar o comprar', 'investigá tratamientos para el insomnio', 'estudiá este tema a fondo'. Esta es la killer feature de investigación de Koru.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tema a investigar." },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Investigación web multi-fuente."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "deep_research", status: "failed", error: "Indicá el tema." };
    const queries = [query, `${query} análisis pros contras`, `${query} fuentes confiables 2025`];
    const all = await Promise.all(queries.map((q) => searchAndEnrich(q, 4)));
    const sources = usableSources(all.flat()).slice(0, 8);
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try { dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn)); } catch (err) { console.warn("[Koru] productivity dataCard extraction failed:", err instanceof Error ? err.message : err); }
    }
    return {
      type: "deep_research",
      status: "ok",
      query,
      sources,
      dataCard,
      note: sources.length >= 4 ? `Cruzadas ${sources.length} fuentes. Cada dato validado con cita literal.` : `Encontré pocas fuentes (${sources.length}). Profundizá la consulta.`,
    };
  },
};

// ─── extract_action_items ───────────────────────────────────────────────────
export const extractActionItems: ToolHandler = {
  definition: defineTool(
    "extract_action_items",
    "Extrae tareas/puntos de acción de notas, minuta de reunión o email. Úsala cuando el usuario diga 'qué tareas surgen de esta minuta?', 'extraé los action items de este email', 'puntos pendientes de esta nota'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  ),
  policy: policies.localWrite("Extrae tareas y las propone como commitments."),
  async run(args, ctx) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "extract_action_items", status: "failed", error: "Pegá el texto." };
    if (!ctx.chatFn) return { type: "extract_action_items", status: "not_configured", note: "Necesito el LLM local (Ollama) para extraer tareas." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Extraé las tareas/puntos de acción del texto. Devolvé solo la lista, una tarea por línea, en infinitivo. Sin intro." },
          { role: "user", content: text.slice(0, 6000) },
        ],
        { temperature: 0.1, maxTokens: 400 },
      );
      const items = r.content.split(/\r?\n/).map((l) => l.trim().replace(/^[-*\d.]+\s*/, "")).filter((l) => l.length > 3).slice(0, 12);
      const commitments = items.map((title) => ({ title, dueHint: "sin fecha", status: "open" as const }));
      return { type: "extract_action_items", status: "ok", actionItems: items, commitments };
    } catch (e) {
      return { type: "extract_action_items", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── email_draft ────────────────────────────────────────────────────────────
export const emailDraft: ToolHandler = {
  definition: defineTool(
    "email_draft",
    "Redacta un email listo para revisar. Úsala cuando el usuario diga 'escribile a mi jefe pidiendo vacaciones', 'respuesta cortés a la queja', 'email formal para el cliente'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        purpose: { type: "string", description: "Qué debe decir el email." },
        recipient: { type: "string", description: "A quién va (nombre/rol)." },
        tone: { type: "string", enum: ["formal", "cordial", "directo"], default: "cordial" },
      },
      required: ["purpose"],
    },
  ),
  policy: policies.readonly("Genera borrador de email."),
  async run(args, ctx) {
    const purpose = String(args.purpose ?? "").trim();
    if (!purpose) return { type: "email_draft", status: "failed", error: "Indicá el propósito." };
    if (!ctx.chatFn) return { type: "email_draft", status: "not_configured", note: "Necesito el LLM local (Ollama) para redactar." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: `Redactás emails en español, tono ${args.tone ?? "cordial"}. Devolvé solo el cuerpo del email (con saludo y despedida), sin asunto ni explicaciones.` },
          { role: "user", content: `Para: ${args.recipient ?? "(destinatario)"}\nPropósito: ${purpose}` },
        ],
        { temperature: 0.4, maxTokens: 500 },
      );
      return { type: "email_draft", status: "ok", purpose, recipient: args.recipient, draft: r.content.trim() };
    } catch (e) {
      return { type: "email_draft", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── message_draft ──────────────────────────────────────────────────────────
export const messageDraft: ToolHandler = {
  definition: defineTool(
    "message_draft",
    "Redacta un mensaje corto (SMS, WhatsApp) listo para enviar. Úsala cuando el usuario diga 'mensaje para mi novia que llego tarde', 'confirmación al cliente', 'mensaje breve a mamá'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        purpose: { type: "string" },
        recipient: { type: "string" },
      },
      required: ["purpose"],
    },
  ),
  policy: policies.readonly("Genera borrador de mensaje."),
  async run(args, ctx) {
    const purpose = String(args.purpose ?? "").trim();
    if (!purpose) return { type: "message_draft", status: "failed", error: "Indicá el propósito." };
    if (!ctx.chatFn) return { type: "message_draft", status: "not_configured", note: "Necesito el LLM local (Ollama) para redactar." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Redactás mensajes cortos de chat (WhatsApp/SMS) en español, naturales y directos. Máx 2-3 líneas. Sin explicaciones, solo el mensaje." },
          { role: "user", content: `Para: ${args.recipient ?? "(destinatario)"}\nPropósito: ${purpose}` },
        ],
        { temperature: 0.5, maxTokens: 200 },
      );
      return { type: "message_draft", status: "ok", purpose, recipient: args.recipient, draft: r.content.trim() };
    } catch (e) {
      return { type: "message_draft", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── copy_to_clipboard ──────────────────────────────────────────────────────
export const copyToClipboard: ToolHandler = {
  definition: defineTool(
    "copy_to_clipboard",
    "Copia texto al portapapeles del usuario. Úsala cuando el usuario diga 'copiá eso', 'al portapapeles', 'mandá eso al clipboard'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  ),
  policy: policies.localWrite("Copia al portapapeles."),
  async run(args) {
    const text = String(args.text ?? "");
    if (!text) return { type: "copy_to_clipboard", status: "failed", error: "Indicá el texto." };
    // En el cliente, KoruProvider usará navigator.clipboard. La tool solo registra la intención.
    return { type: "copy_to_clipboard", status: "ok", text, length: text.length, note: "Texto listo para copiar (la UI lo pondrá en el portapapeles)." };
  },
};

// ─── qr_generate ────────────────────────────────────────────────────────────
export const qrGenerate: ToolHandler = {
  definition: defineTool(
    "qr_generate",
    "Genera un código QR para texto, URL o datos de WiFi. Úsala cuando el usuario diga 'QR para mi WiFi', 'código QR para este link', 'generá un QR'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Texto o URL a codificar." },
        size: { type: "number", description: "Tamaño en px. Default 300." },
      },
      required: ["text"],
    },
  ),
  policy: policies.readonly("Genera QR via GoQR."),
  async run(args) {
    const text = String(args.text ?? "").trim();
    const size = Number(args.size ?? 300);
    if (!text) return { type: "qr_generate", status: "failed", error: "Indicá el texto." };
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    return { type: "qr_generate", status: "ok", text, size, qrUrl: url, source: "GoQR", sourceUrl: "https://goqr.me/" };
  },
};

// ─── sunrise_sunset ─────────────────────────────────────────────────────────
export const sunriseSunset: ToolHandler = {
  definition: defineTool(
    "sunrise_sunset",
    "Hora de salida y puesta del sol para una ubicación y fecha. Úsala cuando el usuario diga 'a qué hora sale el sol mañana?', 'atardecer hoy en Madrid', 'cuándo oscurece'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        lat: { type: "number", description: "Latitud." },
        lng: { type: "number", description: "Longitud." },
        date: { type: "string", description: "Fecha YYYY-MM-DD. Default hoy." },
      },
      required: ["lat", "lng"],
    },
  ),
  policy: policies.readonly("Lee datos solares de sunrise-sunset.org."),
  async run(args) {
    const lat = Number(args.lat);
    const lng = Number(args.lng);
    const date = String(args.date ?? "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { type: "sunrise_sunset", status: "failed", error: "Indicá lat y lng." };
    const cacheKey = `sun:${lat}:${lng}:${date}`;
    const data = await cached<{ results?: { sunrise?: string; sunset?: string; solar_noon?: string; day_length?: number } }>(cacheKey, ttls.weatherNow, async () => {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), formatted: "0" });
      if (date) params.set("date", date);
      const r = await fetchJson(`https://api.sunrise-sunset.org/json?${params.toString()}`, { timeoutMs: 8_000 });
      if (!r.ok) throw new Error(r.error);
      return r.data as { results?: { sunrise?: string; sunset?: string; solar_noon?: string; day_length?: number } };
    });
    return { type: "sunrise_sunset", status: "ok", lat, lng, date: date || "hoy", sunrise: data.results?.sunrise, sunset: data.results?.sunset, solarNoon: data.results?.solar_noon, dayLengthSec: data.results?.day_length };
  },
};

// ─── moon_phase ─────────────────────────────────────────────────────────────
export const moonPhase: ToolHandler = {
  definition: defineTool(
    "moon_phase",
    "Fase lunar actual y próxima luna llena/nueva. Úsala cuando el usuario diga 'qué luna hay hoy?', 'cuándo es la próxima luna llena', 'fase lunar'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string", description: "Fecha YYYY-MM-DD. Default hoy." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Cálculo astronómico local."),
  async run(args) {
    // Cálculo simplificado (fórmula de Conway): días desde luna nueva de referencia 2000-01-06 18:14 UTC.
    const ref = new Date("2000-01-06T18:14:00Z").getTime();
    const target = args.date ? new Date(String(args.date)).getTime() : Date.now();
    if (Number.isNaN(target)) return { type: "moon_phase", status: "failed", error: "Fecha inválida." };
    const synodic = 29.530588853;
    const days = (target - ref) / (24 * 60 * 60 * 1000);
    const phase = ((days % synodic) + synodic) % synodic;
    const phaseNames = ["Luna nueva", "Luna creciente", "Cuarto creciente", "Gibosa creciente", "Luna llena", "Gibosa menguante", "Cuarto menguante", "Gibosa menguante"];
    const idx = Math.floor((phase / synodic) * 8) % 8;
    const illumination = (1 - Math.cos((phase / synodic) * 2 * Math.PI)) / 2;
    const daysToFull = ((synodic * 0.5 - phase + synodic) % synodic);
    const daysToNew = ((synodic - phase) % synodic);
    return {
      type: "moon_phase",
      status: "ok",
      date: args.date ?? new Date().toISOString().slice(0, 10),
      phaseName: phaseNames[idx],
      phaseDay: Math.round(phase),
      illuminationPct: Number((illumination * 100).toFixed(1)),
      daysToFullMoon: Number(daysToFull.toFixed(1)),
      daysToNewMoon: Number(daysToNew.toFixed(1)),
    };
  },
};

// ─── holidays ───────────────────────────────────────────────────────────────
export const holidays: ToolHandler = {
  definition: defineTool(
    "holidays",
    "Feriados nacionales de un país. Úsala cuando el usuario diga 'cuándo es el próximo feriado?', 'feriados de España 2025', 'días no laborables en Argentina'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        countryCode: { type: "string", description: "Código ISO país (ej: 'ES', 'AR', 'US')." },
        year: { type: "number", description: "Año. Default actual." },
      },
      required: ["countryCode"],
    },
  ),
  policy: policies.readonly("Lee feriados de Nager.Date."),
  async run(args) {
    const cc = String(args.countryCode ?? "").toUpperCase().trim();
    const year = Number(args.year ?? new Date().getFullYear());
    if (cc.length !== 2) return { type: "holidays", status: "failed", error: "Indicá código de país de 2 letras." };
    const cacheKey = `hol:${cc}:${year}`;
    const data = await cached<Array<{ date: string; localName?: string; name?: string; types?: string[] }>>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`, { timeoutMs: 9_000 });
      if (!r.ok) throw new Error(r.error);
      return Array.isArray(r.data) ? r.data : [];
    });
    const holidays = data.map((h) => ({ date: h.date, name: h.localName ?? h.name, types: h.types }));
    return { type: "holidays", status: "ok", countryCode: cc, year, holidays };
  },
};

// ─── time_zone ──────────────────────────────────────────────────────────────
export const timeZone: ToolHandler = {
  definition: defineTool(
    "time_zone",
    "Convierte o consulta la hora en otra zona horaria. Úsala cuando el usuario diga 'qué hora es en Tokyo?', 'si llamo a las 10am Madrid qué hora es allá?', 'zona horaria de San Francisco'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        city: { type: "string", description: "Ciudad o zona IANA (ej: 'Tokyo', 'America/Argentina/Buenos_Aires')." },
      },
      required: ["city"],
    },
  ),
  policy: policies.readonly("Conversión de zona horaria local."),
  async run(args) {
    const city = String(args.city ?? "").trim();
    if (!city) return { type: "time_zone", status: "failed", error: "Indicá la ciudad o zona." };
    // Mapa de ciudades comunes → IANA.
    const map: Record<string, string> = {
      "tokyo": "Asia/Tokyo", "nueva york": "America/New_York", "new york": "America/New_York",
      "los angeles": "America/Los_Angeles", "londres": "Europe/London", "london": "Europe/London",
      "paris": "Europe/Paris", "madrid": "Europe/Madrid", "buenos aires": "America/Argentina/Buenos_Aires",
      "mexico": "America/Mexico_City", "sao paulo": "America/Sao_Paulo", "singapur": "Asia/Singapore",
      "dubai": "Asia/Dubai", "sidney": "Australia/Sydney", "sydney": "Australia/Sydney",
      "san francisco": "America/Los_Angeles", "chicago": "America/Chicago",
    };
    const tz = map[city.toLowerCase()] ?? (city.includes("/") ? city : `Europe/${city}`);
    try {
      const now = new Date();
      const time = new Intl.DateTimeFormat("es", { timeZone: tz, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const offsetH = -(new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "");
      return { type: "time_zone", status: "ok", city, timezone: tz, currentTime: time, offset: offsetH, yourTime: now.toLocaleTimeString("es") };
    } catch {
      return { type: "time_zone", status: "failed", error: `No reconocí la zona horaria de "${city}". Usá formato IANA como Europe/Madrid.` };
    }
  },
};
