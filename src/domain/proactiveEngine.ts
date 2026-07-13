/**
 * Proactive Engine — Fase 1: "El compañero que te espera"
 *
 * Cuando el usuario abre la app, Koru verifica si hay algo relevante
 * que pasó en el mundo y le manda un mensaje proactivo CON PERSONALIDAD.
 *
 * NO es hardcodeado: el LLM decide qué tools correr basándose en las
 * memories del usuario, y genera el mensaje con el tono correcto.
 *
 * Flujo:
 * 1. Leer memories del usuario
 * 2. Preguntar al LLM (Flash) qué tools deberíamos consultar
 * 3. Ejecutar las tools sugeridas
 * 4. Si hay resultados relevantes, generar mensaje proactivo con personalidad
 * 5. Mostrar el mensaje como primer turn del chat
 */

import type { KoruState, MemoryFact } from "../domain/types";
import type { ProviderConfig, ProviderResult, ChatMessage } from "../server/koruBackend";

// ── Types ──

export type ProactiveTrigger = {
  toolName: string;
  toolArgs: Record<string, unknown>;
  reason: string; // por qué el LLM sugirió esta tool
};

export type ProactiveEvent = {
  type: "sports_result" | "weather_alert" | "overdue_commitment" | "upcoming_birthday" | "spending_pattern" | "inactivity" | "custom";
  data: Record<string, unknown>;
  priority: "high" | "medium" | "low";
  summary: string; // resumen del evento para el generador
};

export type ProactiveMessage = {
  reply: string;
  mascotState: string;
  uiBlocks?: unknown[];
  shouldShow: boolean;
  dedupKey: string; // hash para no repetir
};

// ── Paso 1: El LLM decide qué tools consultar ──

const TRIGGER_SYSTEM_PROMPT = `Sos Koru, un asistente personal. Vas a decidir si hay algo del mundo exterior que deberías chequear para el usuario, basándote en sus memories.

Mirá las memories del usuario y decidí:
1. ¿Tu equipo jugó hoy o ayer? → usá match_live
2. ¿Viene clima extremo (lluvia, tormenta, calor) en tu ciudad? → usá weather
3. ¿Tenés un pendiente vencido (más de 3 días sin cumplir)? → usá commitment_check
4. ¿Hay un cumpleaños en los próximos 3 días? → usá birthday_check

Reglas:
- Solo sugerí tools que tengan sentido con las memories. Si no hay memories sobre deportes, no sugieras match_live.
- Máximo 3 tools por vez (no spamear).
- Si no hay nada relevante, devolvé tools: [].

Respondé SOLO JSON válido:
{"tools": [{"tool": "match_live", "args": {"query": "Real Madrid"}, "reason": "el usuario sigue al Real Madrid"}]}`;

export async function detectTriggers(
  memories: MemoryFact[],
  _config: ProviderConfig,
): Promise<ProactiveTrigger[]> {
  const triggers: ProactiveTrigger[] = [];
  const relevantMemories = memories.filter((m) => m.status !== "rejected");

  for (const mem of relevantMemories) {
    const text = (mem.text ?? "").toLowerCase();
    
    // Deportes
    const sportsMatch = text.match(/(?:sigue|fan|hinch|segui|equipo|del|es).{0,20}(espa[ñn]a|argentina|brasil|brazil|francia|italia|alemania|inglaterra|portugal|belgica|uruguay|colombia|chile|mexico|real madrid|barcelona|boca|river|psg|arsenal|liverpool|manchester|juventus|inter|bayern)/i);
    if (sportsMatch) {
      triggers.push({ toolName: "match_live", toolArgs: { query: sportsMatch[1] }, reason: "memory: " + mem.text });
    }
    
    // Clima
    const cityMatch = text.match(/(?:vive|ciudad|location|ubicado|de|en).{0,15}(madrid|barcelona|buenos aires|sevilla|valencia|bilbao|mexico|bogota|lima|santiago)/i);
    if (cityMatch) {
      triggers.push({ toolName: "weather", toolArgs: { city: cityMatch[1] }, reason: "memory: " + mem.text });
    }
  }
  
  triggers.push({ toolName: "inactivity_check", toolArgs: {}, reason: "check" });
  console.log("[proactive] Triggers:", triggers.length, triggers.map(t => t.toolName).join(","));
  return triggers;
}

// ── Paso 2: Ejecutar tools y recolectar eventos ──

export async function collectEvents(
  triggers: ProactiveTrigger[],
  state: KoruState,
  lastSeen: number, // timestamp de última vez que el usuario abrió la app
): Promise<ProactiveEvent[]> {
  const events: ProactiveEvent[] = [];

  for (const trigger of triggers) {
    try {
      switch (trigger.toolName) {
        case "match_live": {
          // Consultar ESPN directamente (no via LLM)
          const query = String(trigger.toolArgs.query ?? trigger.toolArgs.__userInput ?? "");
          if (!query) break;
          const matches = await fetchEspnResults(query);
          if (matches.length > 0) {
            const m = matches[0];
            const status = String(m.status ?? "");
            const isFinished = /full time|ft|final/i.test(status);
            const isLive = /in progress|live|halftime/i.test(status);
            if (isFinished || isLive) {
              events.push({
                type: "sports_result",
                data: {
                  homeTeam: m.homeTeam,
                  awayTeam: m.awayTeam,
                  homeScore: m.homeScore,
                  awayScore: m.awayScore,
                  status: m.status,
                  date: m.date,
                  live: isLive,
                },
                priority: "high",
                summary: `${m.homeTeam} ${m.homeScore ?? "?"} - ${m.awayScore ?? "?"} ${m.awayTeam} (${m.status})`,
              });
            }
          }
          break;
        }

        case "weather": {
          const city = String(trigger.toolArgs.city ?? trigger.toolArgs.location ?? "");
          if (!city) break;
          const weather = await fetchWeather(city);
          if (weather) {
            const rainProb = parseInt(weather.rain ?? "0", 10);
            const temp = parseInt(weather.now ?? "0", 10);
            // Solo alertar si hay lluvia > 60% o temp extrema
            if (rainProb > 60 || temp > 35 || temp < 0) {
              events.push({
                type: "weather_alert",
                data: weather,
                priority: rainProb > 80 ? "high" : "medium",
                summary: `${city}: ${weather.now}, lluvia ${weather.rain}`,
              });
            }
          }
          break;
        }

        case "commitment_check": {
          const commitments = Array.isArray(state.commitments) ? state.commitments : [];
          const overdue = commitments.filter((c) => {
            if (c.status !== "open") return false;
            // Check if it has a date hint that's past
            if (c.dueHint) {
              const due = new Date(c.dueHint);
              if (!isNaN(due.getTime()) && due.getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000) {
                return true;
              }
            }
            return false;
          });
          if (overdue.length > 0) {
            events.push({
              type: "overdue_commitment",
              data: { commitments: overdue.map((c) => ({ title: c.title, dueHint: c.dueHint })) },
              priority: "medium",
              summary: `${overdue.length} pendiente(s) vencido(s): ${overdue.map((c) => c.title).join(", ")}`,
            });
          }
          break;
        }

        case "birthday_check": {
          const memories = Array.isArray(state.memories) ? state.memories : [];
          const now = new Date();
          const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          for (const mem of memories) {
            // Buscar memories que mencionen cumpleaños o fechas
            const text = (mem.text ?? "").toLowerCase();
            if (/cumple|birthday|nacimiento/.test(text)) {
              // Extraer fecha si existe
              const dateMatch = text.match(/(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
              if (dateMatch) {
                events.push({
                  type: "upcoming_birthday",
                  data: { text: mem.text, dateHint: dateMatch[0] },
                  priority: "medium",
                  summary: `Cumpleaños próximo: ${mem.text}`,
                });
              }
            }
          }
          break;
        }

        case "inactivity_check": {
          const daysSinceLastSeen = Math.floor((Date.now() - lastSeen) / (24 * 60 * 60 * 1000));
          if (daysSinceLastSeen >= 3) {
            events.push({
              type: "inactivity",
              data: { days: daysSinceLastSeen },
              priority: daysSinceLastSeen >= 7 ? "high" : "low",
              summary: `Usuario inactivo por ${daysSinceLastSeen} días`,
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error(`[proactive] Error collecting event for ${trigger.toolName}:`, err);
    }
  }

  console.log("[proactive] Events collected:", events.length, events.map(e => e.type).join(", "));
  return events;
}

// ── Paso 3: Generar mensaje con personalidad ──

const MESSAGE_SYSTEM_PROMPT = `Sos Koru, el asistente personal de Juan. Estás a punto de mandarle un mensaje proactivo — algo que pasó en el mundo que le interesa, sin que él te haya preguntado.

REGLAS CRÍTICAS:
- Hablá como un AMIGO, no como un asistente. No digas "Te informo que..." — decí "¡Juan!" o "Che, Juan..."
- Si su equipo ganó, celebrá CON él. Usá "ganamos" o "perdimos" si seguís a ese equipo también.
- Si su equipo perdió, mostrá empatía real. No seas frío.
- Si es clima, sed práctico y cercano. "Llevá paraguas" no "Se recomienda llevar paraguas".
- Si es un pendiente, decíselo con honestidad pero sin reproche.
- Si es inactividad, mostrá que te importó no verlo. Con calidez.
- NUNCA seas servil ("¿En qué más te puedo ayudar?").
- NUNCA inventes datos que no tenés.
- Sé conciso (2-4 líneas máximo). Esto es un mensaje, no un informe.
- Si no hay nada relevante que decir, devolvé {"shouldShow": false}.

Respondé SOLO JSON:
{"shouldShow": true, "reply": "tu mensaje", "mascotState": "celebrating|happy|worried|thinking|idle"}`;

export async function generateProactiveMessage(
  events: ProactiveEvent[],
  memories: MemoryFact[],
  config: ProviderConfig,
  userName: string,
): Promise<ProactiveMessage | null> {
  // Template-based message generation (sin LLM para evitar timeout)
  // El LLM se usa solo si está disponible, pero el template es el fallback
  if (events.length === 0) return null;

  const relevant = events.filter((e) => e.priority !== "low");
  if (relevant.length === 0) return null;

  const event = relevant.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  })[0];

  // Generar mensaje basado en el tipo de evento (sin LLM)
  let reply = "";
  let mascotState = "happy";

  if (event.type === "sports_result") {
    const d = event.data as any;
    const homeScore = d.homeScore ?? 0;
    const awayScore = d.awayScore ?? 0;
    const homeTeam = d.homeTeam ?? "?";
    const awayTeam = d.awayTeam ?? "?";
    const status = d.status ?? "FT";
    const isLive = d.live;

    // Determinar si "ganamos" o "perdimos" basándose en el equipo del usuario
    // Normalizar: "España" en memory → "Spain" en ESPN
    const TEAM_NORM: Record<string, string> = { "españa": "spain", "espana": "spain", "brasil": "brazil", "alemania": "germany", "inglaterra": "england" };
    const userMemory = memories.find(m => {
      let text = (m.text ?? "").toLowerCase();
      for (const [es, en] of Object.entries(TEAM_NORM)) { text = text.replace(es, en); }
      const home = homeTeam.toLowerCase();
      const away = awayTeam.toLowerCase();
      return text.includes(home) || text.includes(away);
    });
    let userTeam = userMemory ? (userMemory.text ?? "").toLowerCase() : "";
    for (const [es, en] of Object.entries(TEAM_NORM)) { userTeam = userTeam.replace(es, en); }
    const userIsHome = userTeam.includes(homeTeam.toLowerCase());
    const userIsAway = userTeam.includes(awayTeam.toLowerCase());
    const userWon = userIsHome ? homeScore > awayScore : userIsAway ? awayScore > homeScore : false;
    const isDraw = homeScore === awayScore;

    if (isLive) {
      reply = `Están jugando, Juan! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} (${status}). Entrá que te paso el detalle.`;
      mascotState = "thinking";
    } else if (userWon) {
      reply = `GANAMOS, Juan! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}. Te dejo el resultado por si no lo viste.`;
      mascotState = "celebrating";
    } else if (isDraw) {
      reply = `Empatamos, Juan. ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}. No estuvo mal, pero podría haber sido mejor.`;
      mascotState = "thinking";
    } else {
      const lostTeam = userIsHome ? homeTeam : userIsAway ? awayTeam : homeTeam;
      const wonTeam = userIsHome ? awayTeam : userIsAway ? homeTeam : awayTeam;
      reply = `Uf, Juan... cayó ${lostTeam} ${homeScore}-${awayScore} contra ${wonTeam}. Duele, pero hay que seguir.`;
      mascotState = "worried";
    }
  } else if (event.type === "weather_alert") {
    const d = event.data as any;
    const rain = parseInt(d.rain ?? "0", 10);
    const temp = d.now ?? "?";
    const city = d.city ?? "";
    if (rain > 60) {
      reply = `Juan, llueve en ${city} (${rain}% probabilidad). Llev\u00e1 paraguas si sal\u00eds.`;
      mascotState = "worried";
    } else {
      reply = `Juan, ${temp} en ${city}. ${rain > 30 ? "Hay chance de lluvia, ojo." : "D\u00eda lindo por ahora."}`;
      mascotState = "happy";
    }
  } else if (event.type === "overdue_commitment") {
    const d = event.data as any;
    const items = d.commitments ?? [];
    if (items.length === 1) {
      reply = `Juan, hace tiempo que ten\u00e9s pendiente: ${items[0].title}. \u00bfLo hac\u00e9s hoy?`;
    } else {
      reply = `Juan, ten\u00e9s ${items.length} pendientes atrasados. \u00bfLos ordenamos?`;
    }
    mascotState = "thinking";
  } else if (event.type === "upcoming_birthday") {
    const d = event.data as any;
    reply = `Juan, se acerca un cumplea\u00f1os: ${d.text}. \u00bfTen\u00e9s regalo?`;
    mascotState = "happy";
  } else if (event.type === "inactivity") {
    const d = event.data as any;
    const days = d.days ?? 0;
    if (days >= 7) {
      reply = `Juan, te extra\u00e9 estos ${days} d\u00edas. \u00bfTodo bien?`;
      mascotState = "worried";
    } else {
      // No mostrar mensaje de inactividad para menos de 7 días
      return null;
    }
  }

  if (!reply) return null;

  const dedupKey = `${event.type}:${event.summary.slice(0, 50)}`;
  return { reply, mascotState, shouldShow: true, dedupKey };
}

// Original LLM-based generation (kept as future enhancement)
async function generateProactiveMessageWithLLM(
  events: ProactiveEvent[],
  memories: MemoryFact[],
  config: ProviderConfig,
  userName: string,
): Promise<ProactiveMessage | null> {
  if (events.length === 0) return null;

  // Filtrar solo eventos high/medium
  const relevant = events.filter((e) => e.priority !== "low");
  if (relevant.length === 0) return null;

  // Tomar el más prioritario
  const event = relevant.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  })[0];

  // Construir contexto
  const memoryContext = memories
    .filter((m) => m.status !== "rejected")
    .slice(0, 10)
    .map((m) => `- ${m.kind}: ${m.text}`)
    .join("\n");

  const eventContext = `Evento detectado:
- Tipo: ${event.type}
- Resumen: ${event.summary}
- Datos: ${JSON.stringify(event.data)}`;

  const messages: ChatMessage[] = [
    { role: "system", content: MESSAGE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Nombre del usuario: ${userName}\n\nMemories:\n${memoryContext}\n\n${eventContext}\n\n¿Le mandás mensaje? Si sí, hacelo con personalidad.`,
    },
  ];

  try {
    const fastConfig = { ...config, nvidiaModel: config.nvidiaFastModel || "nvidia/nemotron-3-ultra-550b-a55b" };
    const result = await callProviderSimple(fastConfig, messages, 30_000);
    const content = (result.message as any)?.content ?? "";
    const parsed = JSON.parse(extractJson(content));

    if (!parsed.shouldShow) return null;

    // Generar dedup key
    const dedupKey = `${event.type}:${event.summary.slice(0, 50)}`;

    return {
      reply: parsed.reply,
      mascotState: parsed.mascotState ?? "happy",
      shouldShow: true,
      dedupKey,
    };
  } catch {
    return null;
  }
}

// ── Helpers ──

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}

// LLM call simple (sin tools, sin streaming) — usa fetch directo a NVIDIA API
async function callProviderSimple(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<{ message: { role: string; content: string } }> {
  const apiKey = config.nvidiaApiKey;
  const baseUrl = config.nvidiaBaseUrl || "https://integrate.api.nvidia.com";
  const model = config.nvidiaModel || "nvidia/nemotron-3-ultra-550b-a55b";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.2,
        max_tokens: 500,
        stream: false,
      }),
      signal: controller.signal,
    });
    const data = await res.json() as any;
    return {
      message: {
        role: "assistant",
        content: data.choices?.[0]?.message?.content ?? "",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ESPN fetch directo (sin importar todo el tool system)
// Sinónimos de selecciones nacionales para que "España" encuentre "Spain"
const TEAM_SYNONYMS: Record<string, string> = {
  "españa": "Spain", "espana": "Spain",
  "argentina": "Argentina",
  "brasil": "Brazil", "brazil": "Brazil",
  "francia": "France",
  "italia": "Italy",
  "alemania": "Germany",
  "inglaterra": "England",
  "portugal": "Portugal",
  "belgica": "Belgium",
  "uruguay": "Uruguay",
  "colombia": "Colombia",
  "chile": "Chile",
  "mexico": "Mexico", "méxico": "Mexico",
};

async function fetchEspnResults(query: string): Promise<Array<{
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  date?: string;
}>> {
  try {
    const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    const leagues = ["fifa.world", "uefa.euro", "esp.1"];
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const dates = [
      fmt(new Date(now.getTime() - 72 * 60 * 60 * 1000)), // 3 días atrás
      fmt(new Date(now.getTime() - 48 * 60 * 60 * 1000)), // 2 días atrás
      fmt(new Date(now.getTime() - 24 * 60 * 60 * 1000)), // ayer
      fmt(now), // hoy
    ];

    // Normalizar query con sinónimos
    let queryLower = query.toLowerCase();
    for (const [alias, canonical] of Object.entries(TEAM_SYNONYMS)) {
      if (queryLower.includes(alias)) {
        queryLower = canonical.toLowerCase();
        break;
      }
    }
    const results: any[] = [];

    const promises = leagues.map(async (league) => {
      for (const date of dates) {
        try {
          const res = await fetch(`${ESPN_BASE}/${league}/scoreboard?dates=${date}`, {
            signal: AbortSignal.timeout(2000),
          });
          if (!res.ok) return;
          const data = await res.json() as any;
          const events = data.events ?? [];
          const matching = events.filter((e: any) => {
            const eventName = (e.name ?? "").toLowerCase();
            const comps = e.competitions ?? [];
            const teams = comps.flatMap((c: any) => (c.competitors ?? []).map((comp: any) => comp.team?.displayName?.toLowerCase() ?? ""));
            return eventName.includes(queryLower) || teams.some((t: string) => t.includes(queryLower));
          });
          results.push(...matching);
        } catch {}
      }
    });

    await Promise.all(promises);

    return results.map((e) => {
      const comps = e.competitions ?? [];
      const comp = comps[0];
      const competitors = comp?.competitors ?? [];
      const home = competitors.find((c: any) => c.homeAway === "home") ?? {};
      const away = competitors.find((c: any) => c.homeAway === "away") ?? {};
      return {
        homeTeam: home.team?.displayName,
        awayTeam: away.team?.displayName,
        homeScore: home.score != null ? Number(home.score) : undefined,
        awayScore: away.score != null ? Number(away.score) : undefined,
        status: e.status?.type?.detail ?? e.status?.type?.description,
        date: comp?.date ?? e.date,
      };
    });
  } catch {
    return [];
  }
}

// Weather fetch directo
async function fetchWeather(city: string): Promise<{
  city?: string;
  now?: string;
  range?: string;
  rain?: string;
  wind?: string;
} | null> {
  try {
    // Geocode
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`,
      { signal: AbortSignal.timeout(5000) },
    );
    const geoData = await geoRes.json() as any;
    const result = geoData.results?.[0];
    if (!result) return null;

    // Weather
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    const weatherData = await weatherRes.json() as any;

    return {
      city: [result.name, result.country].filter(Boolean).join(", "),
      now: `${Math.round(weatherData.current?.temperature_2m ?? 0)}°C`,
      range: `${Math.round(weatherData.daily?.temperature_2m_min?.[0] ?? 0)}° - ${Math.round(weatherData.daily?.temperature_2m_max?.[0] ?? 0)}°`,
      rain: `${weatherData.daily?.precipitation_probability_max?.[0] ?? 0}%`,
      wind: `${Math.round(weatherData.current?.wind_speed_10m ?? 0)} km/h`,
    };
  } catch {
    return null;
  }
}

// ── Función principal: ejecutar todo el pipeline ──

export async function runProactiveCheck(
  state: KoruState,
  config: ProviderConfig,
  lastSeen: number,
): Promise<ProactiveMessage | null> {
  const memories = Array.isArray(state.memories) ? state.memories : [];
  const userName = state.userName ?? "amigo";

  // Paso 1: Detectar triggers
  const triggers = await detectTriggers(memories, config);
  if (triggers.length === 0) return null;

  // Paso 2: Recolectar eventos
  const events = await collectEvents(triggers, state, lastSeen);
  if (events.length === 0) return null;

  // Paso 3: Generar mensaje
  // Usar template-based generation (sin LLM, más confiable)
  const message = await generateProactiveMessage(events, memories, config, userName);
  return message;
}
