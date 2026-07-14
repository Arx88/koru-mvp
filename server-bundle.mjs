var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// koru-mvp/src/domain/proactiveEngine.ts
var proactiveEngine_exports = {};
__export(proactiveEngine_exports, {
  collectEvents: () => collectEvents,
  detectTriggers: () => detectTriggers,
  generateProactiveMessage: () => generateProactiveMessage,
  runProactiveCheck: () => runProactiveCheck
});
async function detectTriggers(memories, _config) {
  const triggers = [];
  const relevantMemories = memories.filter((m) => m.status !== "rejected");
  for (const mem of relevantMemories) {
    const text = (mem.text ?? "").toLowerCase();
    const sportsMatch = text.match(/(?:sigue|fan|hinch|segui|equipo|del|es).{0,20}(espa[ñn]a|argentina|brasil|brazil|francia|italia|alemania|inglaterra|portugal|belgica|uruguay|colombia|chile|mexico|real madrid|barcelona|boca|river|psg|arsenal|liverpool|manchester|juventus|inter|bayern)/i);
    if (sportsMatch) {
      triggers.push({ toolName: "match_live", toolArgs: { query: sportsMatch[1] }, reason: "memory: " + mem.text });
    }
    const cityMatch = text.match(/(?:vive|ciudad|location|ubicado|de|en).{0,15}(madrid|barcelona|buenos aires|sevilla|valencia|bilbao|mexico|bogota|lima|santiago)/i);
    if (cityMatch) {
      triggers.push({ toolName: "weather", toolArgs: { city: cityMatch[1] }, reason: "memory: " + mem.text });
    }
  }
  triggers.push({ toolName: "inactivity_check", toolArgs: {}, reason: "check" });
  console.log("[proactive] Triggers:", triggers.length, triggers.map((t) => t.toolName).join(","));
  return triggers;
}
async function collectEvents(triggers, state, lastSeen) {
  const events = [];
  for (const trigger of triggers) {
    try {
      switch (trigger.toolName) {
        case "match_live": {
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
                  live: isLive
                },
                priority: "high",
                summary: `${m.homeTeam} ${m.homeScore ?? "?"} - ${m.awayScore ?? "?"} ${m.awayTeam} (${m.status})`
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
            if (rainProb > 60 || temp > 35 || temp < 0) {
              events.push({
                type: "weather_alert",
                data: weather,
                priority: rainProb > 80 ? "high" : "medium",
                summary: `${city}: ${weather.now}, lluvia ${weather.rain}`
              });
            }
          }
          break;
        }
        case "commitment_check": {
          const commitments = Array.isArray(state.commitments) ? state.commitments : [];
          const overdue = commitments.filter((c) => {
            if (c.status !== "open") return false;
            if (c.dueHint) {
              const due = new Date(c.dueHint);
              if (!isNaN(due.getTime()) && due.getTime() < Date.now() - 3 * 24 * 60 * 60 * 1e3) {
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
              summary: `${overdue.length} pendiente(s) vencido(s): ${overdue.map((c) => c.title).join(", ")}`
            });
          }
          break;
        }
        case "birthday_check": {
          const memories = Array.isArray(state.memories) ? state.memories : [];
          const now = /* @__PURE__ */ new Date();
          const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1e3);
          for (const mem of memories) {
            const text = (mem.text ?? "").toLowerCase();
            if (/cumple|birthday|nacimiento/.test(text)) {
              const dateMatch = text.match(/(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
              if (dateMatch) {
                events.push({
                  type: "upcoming_birthday",
                  data: { text: mem.text, dateHint: dateMatch[0] },
                  priority: "medium",
                  summary: `Cumplea\xF1os pr\xF3ximo: ${mem.text}`
                });
              }
            }
          }
          break;
        }
        case "inactivity_check": {
          const daysSinceLastSeen = Math.floor((Date.now() - lastSeen) / (24 * 60 * 60 * 1e3));
          if (daysSinceLastSeen >= 3) {
            events.push({
              type: "inactivity",
              data: { days: daysSinceLastSeen },
              priority: daysSinceLastSeen >= 7 ? "high" : "low",
              summary: `Usuario inactivo por ${daysSinceLastSeen} d\xEDas`
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error(`[proactive] Error collecting event for ${trigger.toolName}:`, err);
    }
  }
  console.log("[proactive] Events collected:", events.length, events.map((e) => e.type).join(", "));
  return events;
}
async function generateProactiveMessage(events, memories, config2, userName) {
  if (events.length === 0) return null;
  const relevant = events.filter((e) => e.priority !== "low");
  if (relevant.length === 0) return null;
  const event = relevant.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  })[0];
  let reply = "";
  let mascotState = "happy";
  if (event.type === "sports_result") {
    const d = event.data;
    const homeScore = d.homeScore ?? 0;
    const awayScore = d.awayScore ?? 0;
    const homeTeam = d.homeTeam ?? "?";
    const awayTeam = d.awayTeam ?? "?";
    const status = d.status ?? "FT";
    const isLive = d.live;
    const TEAM_NORM = { "espa\xF1a": "spain", "espana": "spain", "brasil": "brazil", "alemania": "germany", "inglaterra": "england" };
    const userMemory = memories.find((m) => {
      let text = (m.text ?? "").toLowerCase();
      for (const [es, en] of Object.entries(TEAM_NORM)) {
        text = text.replace(es, en);
      }
      const home = homeTeam.toLowerCase();
      const away = awayTeam.toLowerCase();
      return text.includes(home) || text.includes(away);
    });
    let userTeam = userMemory ? (userMemory.text ?? "").toLowerCase() : "";
    for (const [es, en] of Object.entries(TEAM_NORM)) {
      userTeam = userTeam.replace(es, en);
    }
    const userIsHome = userTeam.includes(homeTeam.toLowerCase());
    const userIsAway = userTeam.includes(awayTeam.toLowerCase());
    const userWon = userIsHome ? homeScore > awayScore : userIsAway ? awayScore > homeScore : false;
    const isDraw = homeScore === awayScore;
    if (isLive) {
      reply = `Est\xE1n jugando, Juan! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} (${status}). Entr\xE1 que te paso el detalle.`;
      mascotState = "thinking";
    } else if (userWon) {
      reply = `GANAMOS, Juan! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}. Te dejo el resultado por si no lo viste.`;
      mascotState = "celebrating";
    } else if (isDraw) {
      reply = `Empatamos, Juan. ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}. No estuvo mal, pero podr\xEDa haber sido mejor.`;
      mascotState = "thinking";
    } else {
      const lostTeam = userIsHome ? homeTeam : userIsAway ? awayTeam : homeTeam;
      const wonTeam = userIsHome ? awayTeam : userIsAway ? homeTeam : awayTeam;
      reply = `Uf, Juan... cay\xF3 ${lostTeam} ${homeScore}-${awayScore} contra ${wonTeam}. Duele, pero hay que seguir.`;
      mascotState = "worried";
    }
  } else if (event.type === "weather_alert") {
    const d = event.data;
    const rain = parseInt(d.rain ?? "0", 10);
    const temp = d.now ?? "?";
    const city = d.city ?? "";
    if (rain > 60) {
      reply = `Juan, llueve en ${city} (${rain}% probabilidad). Llev\xE1 paraguas si sal\xEDs.`;
      mascotState = "worried";
    } else {
      reply = `Juan, ${temp} en ${city}. ${rain > 30 ? "Hay chance de lluvia, ojo." : "D\xEDa lindo por ahora."}`;
      mascotState = "happy";
    }
  } else if (event.type === "overdue_commitment") {
    const d = event.data;
    const items = d.commitments ?? [];
    if (items.length === 1) {
      reply = `Juan, hace tiempo que ten\xE9s pendiente: ${items[0].title}. \xBFLo hac\xE9s hoy?`;
    } else {
      reply = `Juan, ten\xE9s ${items.length} pendientes atrasados. \xBFLos ordenamos?`;
    }
    mascotState = "thinking";
  } else if (event.type === "upcoming_birthday") {
    const d = event.data;
    reply = `Juan, se acerca un cumplea\xF1os: ${d.text}. \xBFTen\xE9s regalo?`;
    mascotState = "happy";
  } else if (event.type === "inactivity") {
    const d = event.data;
    const days = d.days ?? 0;
    if (days >= 7) {
      reply = `Juan, te extra\xE9 estos ${days} d\xEDas. \xBFTodo bien?`;
      mascotState = "worried";
    } else {
      return null;
    }
  }
  if (!reply) return null;
  const dedupKey = `${event.type}:${event.summary.slice(0, 50)}`;
  return { reply, mascotState, shouldShow: true, dedupKey };
}
async function fetchEspnResults(query) {
  try {
    const ESPN_BASE3 = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    const leagues = ["fifa.world", "uefa.euro", "esp.1"];
    const now = /* @__PURE__ */ new Date();
    const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const dates = [
      fmt(new Date(now.getTime() - 72 * 60 * 60 * 1e3)),
      // 3 días atrás
      fmt(new Date(now.getTime() - 48 * 60 * 60 * 1e3)),
      // 2 días atrás
      fmt(new Date(now.getTime() - 24 * 60 * 60 * 1e3)),
      // ayer
      fmt(now)
      // hoy
    ];
    let queryLower = query.toLowerCase();
    for (const [alias, canonical] of Object.entries(TEAM_SYNONYMS)) {
      if (queryLower.includes(alias)) {
        queryLower = canonical.toLowerCase();
        break;
      }
    }
    const results = [];
    const promises = leagues.map(async (league) => {
      for (const date of dates) {
        try {
          const res = await fetch(`${ESPN_BASE3}/${league}/scoreboard?dates=${date}`, {
            signal: AbortSignal.timeout(2e3)
          });
          if (!res.ok) return;
          const data = await res.json();
          const events = data.events ?? [];
          const matching = events.filter((e) => {
            const eventName = (e.name ?? "").toLowerCase();
            const comps = e.competitions ?? [];
            const teams = comps.flatMap((c) => (c.competitors ?? []).map((comp) => comp.team?.displayName?.toLowerCase() ?? ""));
            return eventName.includes(queryLower) || teams.some((t) => t.includes(queryLower));
          });
          results.push(...matching);
        } catch {
        }
      }
    });
    await Promise.all(promises);
    return results.map((e) => {
      const comps = e.competitions ?? [];
      const comp = comps[0];
      const competitors = comp?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home") ?? {};
      const away = competitors.find((c) => c.homeAway === "away") ?? {};
      return {
        homeTeam: home.team?.displayName,
        awayTeam: away.team?.displayName,
        homeScore: home.score != null ? Number(home.score) : void 0,
        awayScore: away.score != null ? Number(away.score) : void 0,
        status: e.status?.type?.detail ?? e.status?.type?.description,
        date: comp?.date ?? e.date
      };
    });
  } catch {
    return [];
  }
}
async function fetchWeather(city) {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`,
      { signal: AbortSignal.timeout(5e3) }
    );
    const geoData = await geoRes.json();
    const result = geoData.results?.[0];
    if (!result) return null;
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`,
      { signal: AbortSignal.timeout(5e3) }
    );
    const weatherData = await weatherRes.json();
    return {
      city: [result.name, result.country].filter(Boolean).join(", "),
      now: `${Math.round(weatherData.current?.temperature_2m ?? 0)}\xB0C`,
      range: `${Math.round(weatherData.daily?.temperature_2m_min?.[0] ?? 0)}\xB0 - ${Math.round(weatherData.daily?.temperature_2m_max?.[0] ?? 0)}\xB0`,
      rain: `${weatherData.daily?.precipitation_probability_max?.[0] ?? 0}%`,
      wind: `${Math.round(weatherData.current?.wind_speed_10m ?? 0)} km/h`
    };
  } catch {
    return null;
  }
}
async function runProactiveCheck(state, config2, lastSeen) {
  const memories = Array.isArray(state.memories) ? state.memories : [];
  const userName = state.userName ?? "amigo";
  const triggers = await detectTriggers(memories, config2);
  if (triggers.length === 0) return null;
  const events = await collectEvents(triggers, state, lastSeen);
  if (events.length === 0) return null;
  const message = await generateProactiveMessage(events, memories, config2, userName);
  return message;
}
var TEAM_SYNONYMS;
var init_proactiveEngine = __esm({
  "koru-mvp/src/domain/proactiveEngine.ts"() {
    "use strict";
    TEAM_SYNONYMS = {
      "espa\xF1a": "Spain",
      "espana": "Spain",
      "argentina": "Argentina",
      "brasil": "Brazil",
      "brazil": "Brazil",
      "francia": "France",
      "italia": "Italy",
      "alemania": "Germany",
      "inglaterra": "England",
      "portugal": "Portugal",
      "belgica": "Belgium",
      "uruguay": "Uruguay",
      "colombia": "Colombia",
      "chile": "Chile",
      "mexico": "Mexico",
      "m\xE9xico": "Mexico"
    };
  }
});

// koru-mvp/server/index.ts
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// koru-mvp/src/domain/types.ts
var VALID_MASCOT_STATES = [
  "idle",
  "thinking",
  "working",
  "happy",
  "tired",
  "sleeping",
  "mistake",
  "planning",
  "product-search",
  "building",
  "cooking",
  "thinking-2",
  "celebrating",
  "worried",
  "affectionate",
  "curious"
];

// koru-mvp/src/domain/commitments.ts
function foldAccents(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// koru-mvp/src/domain/freellmapi.ts
var FreeLlmApiError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.name = "FreeLlmApiError";
    this.status = status;
  }
};
function normalizeBaseUrl(baseUrl) {
  return baseUrl.trim().replace(/\/+$/, "");
}
async function postJson(url, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new FreeLlmApiError(data.error?.message ?? `FreeLLMAPI respondi\xF3 ${response.status}`, response.status);
    }
    return { data, response };
  } catch (error) {
    if (error instanceof FreeLlmApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FreeLlmApiError("FreeLLMAPI tard\xF3 demasiado en responder.");
    }
    throw new FreeLlmApiError(error instanceof Error ? error.message : "No pude contactar FreeLLMAPI.");
  } finally {
    window.clearTimeout(timeout);
  }
}
function isOpenRouter(baseUrl) {
  return /(^|\/)openrouter(?:\/|$)|openrouter\.ai/i.test(baseUrl);
}
async function runFreeLlmChat(runtime, messages, options) {
  if (!runtime.freeLlmApiEnabled || !runtime.freeLlmApiKey.trim()) {
    throw new FreeLlmApiError("FreeLLMAPI no est\xE1 configurado.");
  }
  const baseUrl = normalizeBaseUrl(runtime.freeLlmApiBaseUrl);
  const { data, response } = await postJson(
    `${baseUrl}/v1/chat/completions`,
    runtime.freeLlmApiKey,
    {
      model: runtime.freeLlmApiModel || "auto",
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 1200
    },
    24e3
  );
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new FreeLlmApiError("FreeLLMAPI devolvi\xF3 una respuesta vac\xEDa.");
  return {
    content,
    model: data.model,
    routedVia: response.headers.get("x-routed-via")
  };
}
async function runOpenModelChat(runtime, messages, options) {
  if (!runtime.openModelEnabled || !runtime.openModelBaseUrl.trim() || !runtime.openModelModel.trim()) {
    throw new FreeLlmApiError("El modelo abierto no esta configurado.");
  }
  const baseUrl = normalizeBaseUrl(runtime.openModelBaseUrl);
  const openRouter = isOpenRouter(baseUrl);
  const body = {
    model: runtime.openModelModel,
    messages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 1200
  };
  if (options?.responseFormat || openRouter) {
    body.response_format = options?.responseFormat ?? { type: "json_object" };
  }
  if (openRouter) {
    body.plugins = [{ id: "response-healing" }];
    body.reasoning = { exclude: true };
  }
  const { data } = await postJson(
    `${baseUrl}/chat/completions`,
    runtime.openModelApiKey.trim() || "ollama",
    body,
    openRouter ? 115e3 : 45e3
  );
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new FreeLlmApiError("El modelo abierto devolvio una respuesta vacia.");
  return {
    content,
    model: data.model ?? runtime.openModelModel
  };
}

// koru-mvp/src/domain/store.ts
function selectRelevantMemories(memories, input, maxResults = 5) {
  const inputWords = new Set(
    input.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  );
  if (inputWords.size === 0) return [];
  const scored = memories.filter((m) => m.status === "confirmed" || m.status === "candidate").map((m) => {
    const textLower = m.text.toLowerCase();
    const matchCount = Array.from(inputWords).filter((w) => textLower.includes(w)).length;
    const createdTime = new Date(m.createdAt).getTime();
    const recencyBonus = !isNaN(createdTime) && Date.now() - createdTime < 7 * 24 * 60 * 60 * 1e3 ? 0.2 : 0;
    const score = matchCount * 0.5 + recencyBonus + (m.confidence ?? 0.7) * 0.3;
    return { memory: m, score };
  }).sort((a, b) => b.score - a.score).slice(0, maxResults).map(({ memory }) => ({
    text: memory.text,
    kind: memory.kind,
    confidence: memory.confidence ?? 0.7
  }));
  return scored;
}

// koru-mvp/src/domain/enhancementEngine.ts
function scoreCandidate(candidate, state) {
  const valueMap = { low: 0.6, medium: 1, high: 1.4 };
  const value = valueMap[candidate.userValue];
  const confidence = candidate.confidence;
  const riskPenalty = {
    readonly: 0,
    local_write: 0.3,
    external_side_effect: 0.8,
    financial: 1.2,
    destructive: 2
  };
  const intrusionMap = {
    ask: 0.4,
    suggest: 0.2,
    auto: 0,
    defer: 0
  };
  let base = value + confidence - riskPenalty[candidate.risk] - intrusionMap[candidate.action.mode];
  const pref = state.learningPreferences.find((p) => p.type === candidate.title);
  if (pref) {
    const total = pref.acceptedCount + pref.rejectedCount;
    if (total >= 2) {
      const ratio = pref.acceptedCount / total;
      if (ratio >= 0.75) {
        base += 0.5;
      } else if (ratio <= 0.25) {
        base -= 1;
      } else if (pref.rejectedCount >= 3 && pref.acceptedCount === 0) {
        base -= 2;
      }
    }
  }
  return base;
}
function rankEnhancements(candidates, state) {
  return [...candidates].map((c) => ({ ...c, _score: scoreCandidate(c, state) })).sort((a, b) => b._score - a._score).map((c) => {
    const { _score, ...rest } = c;
    return rest;
  });
}
function filterEnhancements(candidates, state, maxVisible = 1) {
  const ranked = rankEnhancements(candidates, state);
  const kept = [];
  for (const candidate of ranked) {
    if (kept.length >= maxVisible) break;
    if (scoreCandidate(candidate, state) < 1.5) continue;
    if (kept.some((k) => k.title === candidate.title)) continue;
    const rejectedBoundaries = state.memories.filter(
      (m) => m.kind === "boundary" && m.status === "confirmed"
    );
    if (rejectedBoundaries.some((b) => foldAccents(b.text).includes(foldAccents(candidate.title)))) continue;
    const recentIgnored = state.entries.slice(0, 10).filter((e) => e.actionIds.length === 0 && e.memoryIds.length === 0).length;
    if (recentIgnored >= 4 && candidate.action.mode === "ask") continue;
    kept.push(candidate);
  }
  return kept;
}
function opportunityToCandidate(opportunity, index) {
  const id = `enh_${index}_${Math.random().toString(36).slice(2, 6)}`;
  let action;
  if (!opportunity.contextualQuestion || opportunity.contextualQuestion.trim().length < 10) {
    action = { mode: "defer", reason: "El LLM no gener\xF3 una pregunta contextualizada espec\xEDfica." };
  } else if (opportunity.risk === "readonly" && !opportunity.metadata?.uiBlock) {
    action = { mode: "suggest", text: opportunity.contextualQuestion };
  } else if (opportunity.risk === "readonly") {
    action = { mode: "auto", text: opportunity.contextualQuestion };
  } else if (opportunity.requiresApproval) {
    action = { mode: "ask", question: opportunity.contextualQuestion };
  } else {
    action = { mode: "suggest", text: opportunity.contextualQuestion };
  }
  let userValue;
  if (opportunity.confidence >= 0.85 && opportunity.risk === "readonly") {
    userValue = "high";
  } else if (opportunity.confidence >= 0.75) {
    userValue = "high";
  } else if (opportunity.confidence >= 0.7) {
    userValue = "medium";
  } else {
    userValue = "low";
  }
  return {
    id,
    title: opportunity.type,
    rationale: opportunity.rationale,
    userValue,
    confidence: opportunity.confidence,
    risk: opportunity.risk,
    action,
    evidence: [
      { source: "input", detail: `Oportunidad detectada por LLM: ${opportunity.type}` }
    ]
  };
}
function generateEnhancements(opportunities, state) {
  const candidates = opportunities.map((o, i) => opportunityToCandidate(o, i)).filter((c) => c.confidence >= 0.65 && c.action.mode !== "defer");
  return filterEnhancements(candidates, state, 1);
}
function enhancementPrompt(candidates) {
  if (!candidates.length) return "";
  const lines = candidates.map((c) => {
    if (c.action.mode === "ask") {
      return `- Despu\xE9s de cumplir el pedido principal, pregunt\xE1: "${c.action.question}" (raz\xF3n: ${c.rationale})`;
    }
    if (c.action.mode === "suggest") {
      return `- Despu\xE9s de cumplir, suger\xED: "${c.action.text}" (raz\xF3n: ${c.rationale})`;
    }
    if (c.action.mode === "auto") {
      return `- Despu\xE9s de cumplir, hacelo directo: "${c.action.text}" (raz\xF3n: ${c.rationale})`;
    }
    return "";
  });
  return [
    "Instrucci\xF3n de valor adicional (+1): despu\xE9s de responder el pedido principal, agreg\xE1 UN SOLO extra contextual que sea \xFAtil.",
    ...lines,
    "Reglas del +1: no hagas preguntas antes de cumplir el pedido principal. El extra viene DESPU\xC9S. Si no aplica, no lo menciones."
  ].join("\n");
}

// koru-mvp/src/domain/schemas.ts
var SchemaValidationError = class extends Error {
  errors;
  constructor(message, errors) {
    super(message);
    this.name = "SchemaValidationError";
    this.errors = errors;
  }
};
function parseJsonObjectStrict(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new SchemaValidationError("Empty model response", ["empty_response"]);
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    throw new SchemaValidationError("Model response is not valid JSON", ["invalid_json"]);
  }
}

// koru-mvp/src/domain/enhancementExtractor.ts
function systemPrompt() {
  return [
    "Sos el detector de oportunidades de Koru, un asistente personal con memoria.",
    "Tu trabajo es analizar el mensaje del usuario + contexto personal y detectar si existe UN SOLO enhancement (+1) \xFAtil.",
    "",
    "Reglas de oro:",
    "1. NO decidas frases finales del chat. Solo detect\xE1s la oportunidad y su riesgo.",
    "2. NO uses reglas de palabra exacta. Razon\xE1 por se\xF1ales abstractas: dominio, categor\xEDa, objetivo, consecuencia.",
    "3. Solo propon\xE9 si la confianza es >= 0.65.",
    "4. El enhancement debe estar CERCA del objetivo real del usuario. No te vayas de tema.",
    "5. Respet\xE1 boundaries: si hay l\xEDmites expl\xEDcitos, no propon\xE9s nada de ese tipo.",
    "6. Si el usuario est\xE1 agotado o estresado, no agregues tareas. Ofrec\xE9 reducir carga.",
    "7. Si no hay oportunidad real, devolv\xE9 un array vac\xEDo.",
    "8. CR\xCDTICO: la contextualQuestion debe ser ESPEC\xCDFICA al caso. NUNCA gen\xE9rica.",
    "",
    "Mal ejemplo de contextualQuestion:",
    '- "\xBFQuer\xE9s que lo conecte con algo pr\xE1ctico?" \u2192 GEN\xC9RICA, MALA',
    "",
    "Buenos ejemplos de contextualQuestion:",
    '- farmacia: "\xBFQuer\xE9s que prepare alarmas para las tomas del antibi\xF3tico?"',
    '- link: "\xBFQuer\xE9s que extraiga los ingredientes a la lista de compras?"',
    '- reuni\xF3n sin contexto: "\xBFQuer\xE9s que antes te arme un brief con decisiones abiertas?"',
    '- alarma sola: "\xBFQuer\xE9s que le agregue una descripci\xF3n para que sepas para qu\xE9 suena?"',
    '- inventario: "\xBFQuer\xE9s que sugiera una cena con pollo y arroz antes de que se echen a perder?"',
    '- persona: "\xBFQuer\xE9s que tenga en cuenta el t\xE9 matcha para ideas de regalo?"',
    "",
    "Tipos de oportunidad abstracta (solo para clasificar):",
    "- health_followup, subscription_tagging, metadata_extraction, meeting_prep, alarm_context, meal_suggestion, energy_support, transport_tagging, routine_reminder, person_followup.",
    "",
    "Formato de respuesta (SOLO JSON, sin markdown):",
    '{"opportunities":[{"type":"health_followup","rationale":"...","confidence":0.78,"risk":"local_write","requiresApproval":true,"contextualQuestion":"Pregunta espec\xEDfica y contextualizada aqu\xED","metadata":{}}]}'
  ].join("\n");
}
function userPrompt(input, intent, uiBlocks, toolResults, state) {
  const confirmedMemories = state.memories.filter((m) => m.status === "confirmed" && m.useForSuggestions !== false).slice(0, 6).map((m) => `- [${m.kind}] ${m.text.replace(/[\n\r`]+/g, " ").trim()}`).join("\n") || "- ninguna";
  const boundaries = state.memories.filter((m) => m.status === "confirmed" && m.kind === "boundary").map((m) => `- ${m.text.replace(/[\n\r`]+/g, " ").trim()}`).join("\n") || "- ninguno";
  const recentRecords = state.records.slice(0, 5).map((r) => `- ${r.kind}: ${r.title}${r.amount ? ` (${r.amount} ${r.currency})` : ""}`).join("\n") || "- ninguno";
  const toolObservations = toolResults.map((t) => `- ${t.tool}: ${t.summary}`).join("\n") || "- ninguna";
  return [
    `Mensaje del usuario: "${input}"`,
    `Intenci\xF3n detectada: dominio=${intent.domain}, tipo=${intent.kind}, confianza=${intent.confidence}`,
    "",
    "Bloques UI generados:",
    uiBlocks.map((b) => `- ${b.type}`).join("\n") || "- ninguno",
    "",
    "Observaciones de herramientas:",
    toolObservations,
    "",
    "Memorias confirmadas relevantes:",
    confirmedMemories,
    "",
    "L\xEDmites del usuario (boundaries):",
    boundaries,
    "",
    "Registros recientes:",
    recentRecords
  ].join("\n");
}
async function callExtractorLlm(runtime, input, intent, uiBlocks, toolResults, state) {
  const messages = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt(input, intent, uiBlocks, toolResults, state) }
  ];
  let result;
  if (runtime.openModelEnabled && runtime.openModelBaseUrl.trim()) {
    result = await runOpenModelChat(runtime, messages, {
      temperature: 0.15,
      maxTokens: 600,
      responseFormat: { type: "json_object" }
    });
  } else if (runtime.freeLlmApiEnabled && runtime.freeLlmApiKey.trim()) {
    result = await runFreeLlmChat(runtime, messages, {
      temperature: 0.15,
      maxTokens: 600
    });
  } else {
    return [];
  }
  try {
    const parsed = parseJsonObjectStrict(result.content);
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    return opportunities.map(normalizeOpportunity).filter((o) => o !== null && o.confidence >= 0.65);
  } catch (err) {
    console.warn("[Koru] extractOpportunities parse failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
function normalizeOpportunity(value) {
  const obj = value;
  if (!obj) return null;
  const type = typeof obj.type === "string" && obj.type.trim() ? obj.type.trim() : "";
  if (!type) return null;
  const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0;
  const risk = normalizeRisk(obj.risk);
  return {
    type,
    rationale: typeof obj.rationale === "string" ? obj.rationale.trim() : "",
    confidence,
    risk,
    requiresApproval: typeof obj.requiresApproval === "boolean" ? obj.requiresApproval : risk !== "readonly",
    contextualQuestion: typeof obj.contextualQuestion === "string" && obj.contextualQuestion.trim() ? obj.contextualQuestion.trim() : void 0,
    metadata: typeof obj.metadata === "object" && obj.metadata !== null ? obj.metadata : void 0
  };
}
function normalizeRisk(value) {
  const valid = ["readonly", "local_write", "external_side_effect", "financial", "destructive"];
  return valid.includes(value) ? value : "local_write";
}
var enhancementCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 5 * 60 * 1e3;
function hashKey(ctx) {
  const toolCount = ctx.toolResults?.length ?? 0;
  return `${ctx.input.slice(0, 200)}|${ctx.intent}|${toolCount}`;
}
async function extractOpportunities(ctx, chatFn) {
  const key = hashKey(ctx);
  const cached2 = enhancementCache.get(key);
  if (cached2) return cached2;
  if (chatFn) {
    try {
      const messages = [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(ctx.input, ctx.intent, ctx.uiBlocks, ctx.toolResults, ctx.state) }
      ];
      const llmResult = await chatFn(messages, { temperature: 0.15, maxTokens: 600 });
      const parsed = parseJsonObjectStrict(llmResult.content);
      const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
      const result = opportunities.map(normalizeOpportunity).filter((o) => o !== null && o.confidence >= 0.65);
      enhancementCache.set(key, result);
      return result;
    } catch (err) {
      console.warn("[Koru] extractOpportunities (chatFn) failed:", err instanceof Error ? err.message : err);
      return [];
    }
  }
  if (!ctx.runtime.freeLlmApiEnabled && !ctx.runtime.openModelEnabled) {
    return [];
  }
  try {
    const result = await callExtractorLlm(ctx.runtime, ctx.input, ctx.intent, ctx.uiBlocks, ctx.toolResults, ctx.state);
    enhancementCache.set(key, result);
    return result;
  } catch (err) {
    console.warn("[Koru] extractOpportunities (fallback LLM) failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// koru-mvp/src/domain/structureExtractor.ts
function normalizeForMatch(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/["'`«»""'']/g, "").replace(/\s+/g, " ").trim();
}
var MIN_QUOTE_LENGTH = 25;
function findBackingSource(quote, sources) {
  const normalizedQuote = normalizeForMatch(quote);
  if (normalizedQuote.length < MIN_QUOTE_LENGTH) return null;
  for (const source of sources) {
    const haystack = normalizeForMatch(`${source.title} ${source.snippet ?? ""} ${source.content ?? ""}`);
    if (haystack.includes(normalizedQuote)) return source;
    const trimmedQuote = normalizedQuote.replace(/[.,;:¡!¿?]+$/g, "").trim();
    if (trimmedQuote.length >= MIN_QUOTE_LENGTH && haystack.includes(trimmedQuote)) {
      return source;
    }
  }
  return null;
}
function buildExtractorPrompt(userInput, sources) {
  const system = [
    "Sos el extractor de datos de Koru. Tu trabajo: leer contenido web y extraer DATOS CONCRETOS que respondan al pedido del usuario.",
    "",
    "Reglas ABSOLUTAS (no negociables):",
    "1. Solo extra\xE9s datos que aparezcan LITERALMENTE en el contenido. Nunca invent\xE1s ni complet\xE1s de memoria.",
    "2. Por cada dato, inclu\xEDs una `quote`: la frase EXACTA del texto de d\xF3nde lo sacaste. M\xEDnimo una oraci\xF3n completa.",
    "3. Si el contenido no contiene el dato concreto que el usuario pide, devolv\xE9s items: [] (array vac\xEDo). Honestidad total.",
    "4. No interpretais ni resumis en el value. El value es el dato crudo tal cual aparece.",
    "5. No agregues items redundantes. Si dos fuentes dicen lo mismo, pon\xE9s uno.",
    "",
    "Formato de cada item:",
    "  - label: nombre corto del dato (ej: 'D\xF3lar oficial', 'Argentina 3-0 Arabia', 'M\xEDnima ma\xF1ana').",
    "  - value: el valor concreto tal cual aparece (ej: '$1.432,05', '3-0', '7\xB0C').",
    "  - detail: contexto breve opcional (ej: 'precio de compra', 'finalizado').",
    "  - quote: la frase LITERAL del contenido que respalda el dato. Debe contener el value.",
    "",
    "Devolv\xE9 SOLO JSON v\xE1lido, sin markdown:",
    '{"title":"descripci\xF3n corta del conjunto","items":[{"label":"...","value":"...","detail":"...","quote":"frase literal del contenido"}]}'
  ].join("\n");
  const sourcesBlock = sources.map((s, i) => {
    const parts = [`[FUENTE ${i + 1}] ${s.domain}`];
    if (s.title) parts.push(`T\xEDtulo: ${s.title}`);
    if (s.snippet) parts.push(`Resumen: ${s.snippet}`);
    if (s.content) parts.push(`Contenido: ${s.content.slice(0, 1e3)}`);
    return parts.join("\n");
  }).join("\n\n");
  const user = [
    `Pedido del usuario: "${userInput}"`,
    "",
    "Contenido recuperado de la web:",
    sourcesBlock || "(sin contenido)"
  ].join("\n");
  return { system, user };
}
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function stripReasoning(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").replace(/<reflection>[\s\S]*?<\/reflection>/gi, "").trim();
}
function normalizeRawItem(raw) {
  const label = asString(raw.label);
  const value = asString(raw.value);
  const quote = asString(raw.quote);
  const detail = asString(raw.detail);
  if (!label || !value || !quote) return null;
  if (!normalizeForMatch(quote).includes(normalizeForMatch(value).slice(0, 20)) && value.length > 3) {
    const valueToken = value.replace(/[^\d.,$€£¥₡\w]/g, "");
    if (valueToken.length > 2 && !normalizeForMatch(quote).includes(normalizeForMatch(valueToken))) {
      return null;
    }
  }
  return { label, value, detail, quote };
}
async function extractStructuredData(input) {
  const usableSources2 = input.sources.filter((s) => (s.snippet?.trim() ?? "") || (s.content?.trim() ?? ""));
  if (usableSources2.length === 0) return null;
  const { system, user } = buildExtractorPrompt(input.userInput, usableSources2);
  let raw;
  try {
    const result = await input.chatFn(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      { temperature: 0.1, maxTokens: 900, responseFormat: { type: "json_object" } }
    );
    raw = parseJsonObjectStrict(stripReasoning(result.content));
  } catch {
    return null;
  }
  const obj = raw;
  const title = asString(obj.title) || "Datos encontrados";
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const validatedItems = [];
  for (const rawItem of rawItems) {
    const normalized = normalizeRawItem(rawItem);
    if (!normalized) continue;
    const backing = findBackingSource(normalized.quote, usableSources2);
    if (!backing) continue;
    validatedItems.push({
      label: normalized.label,
      value: normalized.value,
      detail: normalized.detail || void 0,
      quote: normalized.quote,
      sourceUrl: backing.url,
      sourceDomain: backing.domain
    });
  }
  if (validatedItems.length === 0) return null;
  return { title, items: validatedItems.slice(0, 8) };
}

// koru-mvp/src/domain/simulatedToolDetector.ts
var VALID_TOOL_NAMES = /* @__PURE__ */ new Set([
  "web_search",
  "shopping_compare",
  "weather",
  "route_traffic",
  "plan_day",
  "query_personal_context",
  "restaurant_deep_search",
  "crypto_price",
  "stock_quote",
  "match_schedule",
  "match_live",
  "nutrition_calc",
  "trending_twitter",
  "exchange_history",
  // 🔴 FIX P1: tools que existían pero no estaban reconocidas
  "recipe_find",
  "recipe_by_ingredients",
  "food_info",
  "wine_pairing",
  "movie_info",
  "book_info",
  "wikipedia_lookup",
  "dictionary_define",
  "news_topic",
  "news_urgent",
  "person_info",
  "flight_search",
  "hotel_search",
  "route_plan",
  "summarize_url",
  "translate",
  "math_calc",
  "unit_convert",
  "currency_convert",
  "team_follow",
  "league_standings",
  "player_stats"
]);
function tryParseArgs(jsonStr) {
  const trimmed = jsonStr.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
  }
  try {
    const quoted = trimmed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    const parsed = JSON.parse(quoted);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function extractFenceContent(content) {
  const match = content.match(/```([a-zA-Z_+-]*)\s*\n?([\s\S]*?)```/);
  if (!match) return null;
  return { lang: (match[1] || "").toLowerCase(), body: match[2].trim() };
}
function detectSimulatedToolCall(content) {
  if (!content || content.length < 5) return null;
  try {
    const directJson = JSON.parse(content.trim());
    if (directJson && typeof directJson.name === "string" && VALID_TOOL_NAMES.has(directJson.name.toLowerCase())) {
      const params = directJson.parameters || directJson.arguments || directJson;
      if (typeof params === "object" && params !== null && !Array.isArray(params)) {
        return { name: directJson.name.toLowerCase(), arguments: params, format: "json_fence" };
      }
    }
  } catch {
  }
  const toolCallFence = content.match(/```tool_call\s+([a-z_]+)\s*(\{[\s\S]*?\})\s*```/i);
  if (toolCallFence) {
    const name = toolCallFence[1].toLowerCase();
    const args = tryParseArgs(toolCallFence[2]);
    if (VALID_TOOL_NAMES.has(name) && args) {
      return { name, arguments: args, format: "tool_call_fence" };
    }
  }
  const pipeCall = content.match(/<\|tool_call\|>\s*call:([a-z_]+)\s*(\{[\s\S]*?\})\s*(?:<\|tool_call\|>|$)/i);
  if (pipeCall) {
    const name = pipeCall[1].toLowerCase();
    const args = tryParseArgs(pipeCall[2]);
    if (VALID_TOOL_NAMES.has(name) && args) {
      return { name, arguments: args, format: "pipe_call" };
    }
  }
  const fence = extractFenceContent(content);
  if (fence && (fence.lang === "json" || fence.lang === "")) {
    const args = tryParseArgs(fence.body);
    if (args) {
      const hasQuery = "query" in args;
      const hasCity = "city" in args;
      const hasTopic = "topic" in args;
      const hasFocus = "focus" in args;
      const hasBudget = "budget" in args;
      const hasLocation = "location" in args;
      if (hasLocation && hasQuery) {
        return { name: "restaurant_deep_search", arguments: args, format: "json_fence" };
      }
      if (hasBudget && hasQuery) {
        return { name: "shopping_compare", arguments: args, format: "json_fence" };
      }
      if (hasQuery) {
        return { name: "web_search", arguments: args, format: "json_fence" };
      }
      if (hasCity) {
        return { name: "weather", arguments: args, format: "json_fence" };
      }
      if (hasTopic) {
        return { name: "query_personal_context", arguments: args, format: "json_fence" };
      }
      if (hasFocus) {
        return { name: "plan_day", arguments: args, format: "json_fence" };
      }
      if (hasLocation) {
        return { name: "restaurant_deep_search", arguments: args, format: "json_fence" };
      }
    }
  }
  const callPrefix = content.match(/\bcall:([a-z_]+)\s*\((\{[\s\S]*?\})\)/i);
  if (callPrefix) {
    const name = callPrefix[1].toLowerCase();
    const args = tryParseArgs(callPrefix[2]);
    if (VALID_TOOL_NAMES.has(name) && args) {
      return { name, arguments: args, format: "call_prefix" };
    }
  }
  return null;
}

// koru-mvp/src/domain/vector.ts
function cosineSimilarity(a, b) {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    aNorm += a[index] * a[index];
    bNorm += b[index] * b[index];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

// koru-mvp/src/domain/semanticRouter.ts
var ROUTE_EXAMPLES = [
  // world_info → web_search: información del mundo exterior que cambia con el tiempo.
  // (NO incluye resultados deportivos — esos van a sports/match_live)
  { category: "world_info", tool: "web_search", text: "\xBFqu\xE9 pas\xF3 hoy en el mundo?" },
  { category: "world_info", tool: "web_search", text: "\xFAltimas noticias de tecnolog\xEDa" },
  { category: "world_info", tool: "web_search", text: "\xBFqu\xE9 pas\xF3 en Argentina hoy?" },
  { category: "world_info", tool: "web_search", text: "noticias urgentes" },
  { category: "world_info", tool: "web_search", text: "buscar refuerzos del Madrid" },
  { category: "world_info", tool: "web_search", text: "fichajes del mercado de pases" },
  { category: "world_info", tool: "web_search", text: "qu\xE9 pas\xF3 con la econom\xEDa" },
  { category: "world_info", tool: "web_search", text: "resumen de la jornada" },
  { category: "world_info", tool: "web_search", text: "qu\xE9 hay del clima pol\xEDtico" },
  // weather → weather: condiciones meteorológicas.
  { category: "weather", tool: "weather", text: "\xBFqu\xE9 tiempo hace?" },
  { category: "weather", tool: "weather", text: "\xBFcomo esta el clima?" },
  { category: "weather", tool: "weather", text: "\xBFcomo esta el tiempo?" },
  { category: "weather", tool: "weather", text: "\xBFnecesito paraguas?" },
  { category: "weather", tool: "weather", text: "\xBFqu\xE9 me pongo hoy?" },
  { category: "weather", tool: "weather", text: "\xBFhace fr\xEDo afuera?" },
  { category: "weather", tool: "weather", text: "\xBFhace calor?" },
  { category: "weather", tool: "weather", text: "\xBFva a llover?" },
  { category: "weather", tool: "weather", text: "\xBFc\xF3mo est\xE1 el d\xEDa?" },
  { category: "weather", tool: "weather", text: "\xBFque temperatura hace?" },
  { category: "weather", tool: "weather", text: "\xBFcomo esta el clima en Buenos Aires?" },
  // shopping → shopping_compare: comparativa o recomendación de compra.
  { category: "shopping", tool: "shopping_compare", text: "\xBFqu\xE9 auriculares compro?" },
  { category: "shopping", tool: "shopping_compare", text: "necesito una bater\xEDa externa" },
  { category: "shopping", tool: "shopping_compare", text: "\xBFd\xF3nde compro X m\xE1s barato?" },
  { category: "shopping", tool: "shopping_compare", text: "\xBFcu\xE1l es mejor, A o B?" },
  { category: "shopping", tool: "shopping_compare", text: "recomendame un celular" },
  // planning → plan_day: organizar el día o priorizar tareas.
  { category: "planning", tool: "plan_day", text: "\xBFc\xF3mo organizo hoy?" },
  { category: "planning", tool: "plan_day", text: "tengo muchas cosas" },
  { category: "planning", tool: "plan_day", text: "\xBFqu\xE9 hago primero?" },
  { category: "planning", tool: "plan_day", text: "ayudame a planificar el d\xEDa" },
  { category: "planning", tool: "plan_day", text: "no me da el tiempo" },
  // personal_query → query_personal_context: datos que Koru ya guardó.
  { category: "personal_query", tool: "query_personal_context", text: "\xBFcu\xE1nto gast\xE9?" },
  { category: "personal_query", tool: "query_personal_context", text: "\xBFqu\xE9 ten\xEDa para comer?" },
  { category: "personal_query", tool: "query_personal_context", text: "\xBFqu\xE9 pendientes tengo?" },
  { category: "personal_query", tool: "query_personal_context", text: "\xBFrecord\xE1s lo que te dije?" },
  { category: "personal_query", tool: "query_personal_context", text: "\xBFqu\xE9 links guard\xE9?" },
  { category: "personal_query", tool: "query_personal_context", text: "cumple de juan" },
  { category: "personal_query", tool: "query_personal_context", text: "cuanto peso" },
  { category: "personal_query", tool: "query_personal_context", text: "mi actividad fisica" },
  // conversation: saludos, charla, emociones, agradecimientos. Sin tool.
  { category: "conversation", text: "hola Koru" },
  { category: "conversation", text: "buenos d\xEDas" },
  { category: "conversation", text: "gracias" },
  { category: "conversation", text: "\xBFc\xF3mo est\xE1s?" },
  { category: "conversation", text: "hoy estoy reventada" },
  { category: "conversation", text: "te quiero contar algo" },
  { category: "conversation", text: "qu\xE9 lindo d\xEDa" },
  { category: "conversation", text: "me aburro" },
  { category: "conversation", text: "che, \xBFqu\xE9 onda lo de ayer?" },
  { category: "conversation", text: "contame algo" },
  { category: "conversation", text: "dale, jaja" },
  { category: "conversation", text: "todo bien por ah\xED?" },
  // conversation: pedidos creativos/generativos. Los responde el modelo
  // directo (imaginacion, no un dato del mundo real) — NO son web_search.
  { category: "conversation", text: "generame una imagen" },
  { category: "conversation", text: "creame un poema" },
  { category: "conversation", text: "escribime una carta" },
  { category: "conversation", text: "contame un chiste" },
  { category: "conversation", text: "inventame un cuento corto" },
  // research → deep_research: el usuario pide un ENTREGABLE de conocimiento
  // (informe, investigación, análisis completo). No es un dato suelto: es el
  // flujo pedido → trabajando → informe entregado. Distinto de world_info
  // (dato puntual de actualidad) y de review (comparativa de producto).
  { category: "research", tool: "deep_research", text: "quiero un informe sobre Age of Empires 2" },
  { category: "research", tool: "deep_research", text: "haceme un informe de River Plate" },
  { category: "research", tool: "deep_research", text: "investig\xE1 todo sobre la dieta keto" },
  { category: "research", tool: "deep_research", text: "contame todo sobre la inteligencia artificial" },
  { category: "research", tool: "deep_research", text: "armame un an\xE1lisis completo del mercado inmobiliario" },
  { category: "research", tool: "deep_research", text: "hac\xE9 un reporte sobre energ\xEDas renovables" },
  { category: "research", tool: "deep_research", text: "quiero saber todo acerca de los agujeros negros" },
  { category: "research", tool: "deep_research", text: "explicame en profundidad c\xF3mo funciona bitcoin" },
  { category: "research", tool: "deep_research", text: "investigaci\xF3n profunda sobre el sue\xF1o" },
  { category: "research", tool: "deep_research", text: "necesito un dossier de la empresa Tesla" },
  { category: "research", tool: "deep_research", text: "hazme un resumen completo de la segunda guerra mundial" },
  // world_info → restaurant_deep_search: buscar lugar para comer.
  { category: "world_info", tool: "restaurant_deep_search", text: "d\xF3nde cenar en Madrid" },
  { category: "world_info", tool: "restaurant_deep_search", text: "mejor parrilla de Palermo" },
  { category: "world_info", tool: "restaurant_deep_search", text: "restaurante sushi en Barcelona" },
  { category: "world_info", tool: "restaurant_deep_search", text: "qu\xE9 restaurante me recomend\xE1s" },
  { category: "world_info", tool: "restaurant_deep_search", text: "donde como paella en Valencia" },
  { category: "world_info", tool: "restaurant_deep_search", text: "restaurantes rom\xE1nticos en Par\xEDs" },
  // action: crear alarma, recordatorio, guardar algo, salud.
  { category: "action", text: "creame una alarma" },
  { category: "action", text: "recordame llamar al m\xE9dico" },
  { category: "action", text: "recordame tomar pastillas" },
  { category: "action", text: "guard\xE1 esto" },
  { category: "action", text: "anot\xE1 un gasto" },
  { category: "action", text: "tengo que comprar leche" },
  { category: "action", text: "dame el resumen del dia" },
  { category: "action", text: "exportame el archivo" },
  { category: "action", text: "descargar pdf" },
  { category: "action", text: "guardar documento" },
  { category: "action", text: "enviame el archivo" },
  // sports → match_live (resultados, marcadores, cómo salió X) o match_schedule (próximos partidos).
  // IMPORTANTE: "como salió X", "como le fue a X", "resultado de X", "quién ganó X"
  // son todos match_live (resultado). Solo "cuándo juega X" / "próximo partido" es match_schedule.
  { category: "sports", tool: "match_live", text: "c\xF3mo sali\xF3 Espa\xF1a ayer" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Boca" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a River en el \xFAltimo partido" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Arsenal en la final" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Argentina" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Real Madrid" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Francia" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Brasil" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Italia" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Inglaterra" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a Alemania" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue al Madrid" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue al Bar\xE7a" },
  { category: "sports", tool: "match_live", text: "c\xF3mo le fue a PSG" },
  { category: "sports", tool: "match_live", text: "c\xF3mo sali\xF3 el partido de Espa\xF1a" },
  { category: "sports", tool: "match_live", text: "c\xF3mo sali\xF3 el partido de Argentina" },
  { category: "sports", tool: "match_live", text: "c\xF3mo sali\xF3 Boca-River" },
  { category: "sports", tool: "match_live", text: "c\xF3mo sali\xF3 el Madrid" },
  { category: "sports", tool: "match_live", text: "c\xF3mo sali\xF3 Barcelona" },
  { category: "sports", tool: "match_live", text: "c\xF3mo termin\xF3 el partido" },
  { category: "sports", tool: "match_live", text: "resultado de Espa\xF1a" },
  { category: "sports", tool: "match_live", text: "resultado de Argentina" },
  { category: "sports", tool: "match_live", text: "resultado de Boca" },
  { category: "sports", tool: "match_live", text: "resultado de River" },
  { category: "sports", tool: "match_live", text: "resultado del partido" },
  { category: "sports", tool: "match_live", text: "resultados de ayer" },
  { category: "sports", tool: "match_live", text: "resultados de la copa" },
  { category: "sports", tool: "match_live", text: "resultados del mundial" },
  { category: "sports", tool: "match_live", text: "qu\xE9 pas\xF3 hoy en el mundial" },
  { category: "sports", tool: "match_live", text: "qui\xE9n gan\xF3 el partido" },
  { category: "sports", tool: "match_live", text: "qui\xE9n gan\xF3 Espa\xF1a" },
  { category: "sports", tool: "match_live", text: "qui\xE9n gan\xF3 Argentina" },
  { category: "sports", tool: "match_live", text: "qui\xE9n gan\xF3 Boca-River" },
  { category: "sports", tool: "match_live", text: "qui\xE9n gan\xF3 la final" },
  { category: "sports", tool: "match_live", text: "\xBFc\xF3mo va el partido?" },
  { category: "sports", tool: "match_live", text: "\xBFc\xF3mo va Boca?" },
  { category: "sports", tool: "match_live", text: "\xBFva ganando el Madrid?" },
  { category: "sports", tool: "match_live", text: "\xBFva ganando Espa\xF1a?" },
  { category: "sports", tool: "match_live", text: "tabla de la liga" },
  { category: "sports", tool: "match_live", text: "tabla de posiciones" },
  { category: "sports", tool: "match_live", text: "estad\xEDsticas del partido" },
  { category: "sports", tool: "match_live", text: "resultado en vivo" },
  { category: "sports", tool: "match_schedule", text: "juega Boca hoy" },
  { category: "sports", tool: "match_schedule", text: "\xBFa qu\xE9 hora juega Real Madrid?" },
  { category: "sports", tool: "match_schedule", text: "fixture de la champions" },
  { category: "sports", tool: "match_schedule", text: "cu\xE1ndo juega Argentina" },
  { category: "sports", tool: "match_schedule", text: "pr\xF3ximo partido de River" },
  { category: "sports", tool: "match_schedule", text: "pr\xF3ximo partido de Espa\xF1a" },
  { category: "sports", tool: "match_schedule", text: "pr\xF3ximo partido de Argentina" },
  { category: "sports", tool: "match_schedule", text: "cu\xE1ndo juega Espa\xF1a" },
  { category: "sports", tool: "match_schedule", text: "cu\xE1ndo juega Francia" },
  // 🔴 FIX: ejemplos SIN tildes (los usuarios escriben sin tildes)
  { category: "sports", tool: "match_live", text: "como salio hoy Argentina" },
  { category: "sports", tool: "match_live", text: "como salio Espa\xF1a" },
  { category: "sports", tool: "match_live", text: "como salio Boca" },
  { category: "sports", tool: "match_live", text: "como salio River" },
  { category: "sports", tool: "match_live", text: "como salio el Madrid" },
  { category: "sports", tool: "match_live", text: "como salio Barcelona" },
  { category: "sports", tool: "match_live", text: "como le fue a Argentina" },
  { category: "sports", tool: "match_live", text: "como le fue a Boca hoy" },
  { category: "sports", tool: "match_live", text: "como le fue a Espa\xF1a ayer" },
  { category: "sports", tool: "match_live", text: "resultado de Argentina" },
  { category: "sports", tool: "match_live", text: "resultado de Boca" },
  { category: "sports", tool: "match_live", text: "resultado de Espa\xF1a" },
  { category: "sports", tool: "match_live", text: "quien gano Argentina" },
  { category: "sports", tool: "match_live", text: "quien gano el partido" },
  { category: "sports", tool: "match_live", text: "como va Argentina" },
  { category: "sports", tool: "match_live", text: "como va Boca" },
  // market → crypto_price / stock_quote / currency_convert
  { category: "market", tool: "crypto_price", text: "precio del bitcoin" },
  { category: "market", tool: "crypto_price", text: "c\xF3mo est\xE1 el ethereum" },
  { category: "market", tool: "stock_quote", text: "cotizaci\xF3n de Apple" },
  { category: "market", tool: "stock_quote", text: "cierre del S&P 500" },
  { category: "market", tool: "currency_convert", text: "precio del d\xF3lar" },
  { category: "market", tool: "currency_convert", text: "cu\xE1nto vale el oro" },
  { category: "market", tool: "stock_quote", text: "c\xF3mo cerr\xF3 Tesla" },
  { category: "market", tool: "crypto_price", text: "cotizaci\xF3n de criptomonedas" },
  { category: "market", tool: "currency_convert", text: "tipo de cambio euro d\xF3lar" },
  // elections → web_search
  { category: "elections", tool: "web_search", text: "resultados de las elecciones" },
  { category: "elections", tool: "web_search", text: "escrutinio" },
  { category: "elections", tool: "web_search", text: "a qui\xE9n le conviene votar" },
  { category: "elections", tool: "web_search", text: "qu\xE9 dicen las encuestas" },
  { category: "elections", tool: "web_search", text: "candidatos 2025" },
  { category: "elections", tool: "web_search", text: "qui\xE9n va ganando" },
  { category: "elections", tool: "web_search", text: "porcentaje de votos" },
  { category: "elections", tool: "web_search", text: "ballotage" },
  { category: "elections", tool: "web_search", text: "mesa electoral" },
  // directions → route_traffic
  { category: "directions", tool: "route_traffic", text: "c\xF3mo llego a Palermo" },
  { category: "directions", tool: "route_traffic", text: "tr\xE1fico en la autopista" },
  { category: "directions", tool: "route_traffic", text: "cu\xE1nto tardo hasta el centro" },
  { category: "directions", tool: "route_traffic", text: "ruta m\xE1s r\xE1pida" },
  { category: "directions", tool: "route_traffic", text: "c\xF3mo ir al aeropuerto" },
  { category: "directions", tool: "route_traffic", text: "mejor ruta en auto" },
  { category: "directions", tool: "route_traffic", text: "comparar transporte" },
  { category: "directions", tool: "route_traffic", text: "cu\xE1nto demora el bondi" },
  // travel → travel_itinerary
  { category: "travel", tool: "travel_itinerary", text: "quiero viajar a Madrid" },
  { category: "travel", tool: "travel_itinerary", text: "vuelos a Barcelona" },
  { category: "travel", tool: "travel_itinerary", text: "hoteles en Par\xEDs" },
  { category: "travel", tool: "travel_itinerary", text: "qu\xE9 visitar en Roma" },
  { category: "travel", tool: "travel_itinerary", text: "armame un itinerario" },
  // review → shopping_compare / web_search
  { category: "review", tool: "shopping_compare", text: "review de auriculares" },
  { category: "review", tool: "shopping_compare", text: "mejor cafetera 2025" },
  { category: "review", tool: "web_search", text: "opiniones del iPhone 16" },
  { category: "review", tool: "shopping_compare", text: "comparativa de notebooks" },
  { category: "review", tool: "web_search", text: "qu\xE9 dicen las rese\xF1as" },
  { category: "review", tool: "shopping_compare", text: "review de cafeteras" },
  { category: "review", tool: "shopping_compare", text: "an\xE1lisis de auriculares Sony" },
  { category: "review", tool: "web_search", text: "puntuaci\xF3n de productos" },
  { category: "review", tool: "web_search", text: "veredicto final" },
  // 🔴 FIX P1: food → recipe_find / food_info / restaurant_deep_search
  { category: "food", tool: "recipe_find", text: "receta de carbonara" },
  { category: "food", tool: "recipe_find", text: "c\xF3mo hago panqueques" },
  { category: "food", tool: "recipe_find", text: "postre sin horno" },
  { category: "food", tool: "recipe_find", text: "algo con pollo y arroz" },
  { category: "food", tool: "recipe_find", text: "qu\xE9 cocino hoy" },
  { category: "food", tool: "recipe_find", text: "receta f\xE1cil de pasta" },
  { category: "food", tool: "recipe_find", text: "receta de tortilla" },
  { category: "food", tool: "food_info", text: "informaci\xF3n nutricional del yogurt" },
  { category: "food", tool: "food_info", text: "qu\xE9 ingredientes tiene la coca cola" },
  // 🔴 FIX P1: media → movie_info / book_info / person_info
  { category: "media", tool: "movie_info", text: "qu\xE9 se dice de la pel\xEDcula obsesi\xF3n" },
  { category: "media", tool: "movie_info", text: "informaci\xF3n sobre la pel\xEDcula duna" },
  { category: "media", tool: "movie_info", text: "resenha de la pelicula avatar" },
  { category: "media", tool: "movie_info", text: "qui\xE9n act\xFAa en el padrino" },
  { category: "media", tool: "movie_info", text: "de qu\xE9 trata la pel\xEDcula interestelar" },
  // 🔴 FIX: ejemplos SIN tildes (los usuarios escriben sin tildes)
  { category: "media", tool: "movie_info", text: "que se dice de la pelicula obsesion" },
  { category: "media", tool: "movie_info", text: "que se dice de la pelicula dune" },
  { category: "media", tool: "movie_info", text: "que se dice de la pelicula avatar" },
  { category: "media", tool: "movie_info", text: "informacion sobre la pelicula" },
  { category: "media", tool: "movie_info", text: "informacion de la pelicula" },
  { category: "media", tool: "movie_info", text: "quien actua en la pelicula" },
  { category: "media", tool: "movie_info", text: "de que trata la pelicula" },
  { category: "media", tool: "movie_info", text: "resena de la pelicula" },
  { category: "media", tool: "movie_info", text: "critica de la pelicula" },
  { category: "media", tool: "movie_info", text: "rating de la pelicula" },
  { category: "media", tool: "movie_info", text: "cr\xEDtica de la pel\xEDcula joker" },
  { category: "media", tool: "book_info", text: "info del libro cien anos de soledad" },
  { category: "media", tool: "book_info", text: "qui\xE9n escribi\xF3 rayuela" },
  { category: "media", tool: "book_info", text: "de qu\xE9 trata el libro 1984" },
  { category: "media", tool: "person_info", text: "qui\xE9n es borges" },
  { category: "media", tool: "person_info", text: "biograf\xEDa de stephen hawking" },
  // 🔴 FIX P1: knowledge → wikipedia_lookup / dictionary_define / math_calc
  { category: "knowledge", tool: "wikipedia_lookup", text: "qu\xE9 es la teor\xEDa de la relatividad" },
  { category: "knowledge", tool: "wikipedia_lookup", text: "contame sobre el renacimiento" },
  { category: "knowledge", tool: "wikipedia_lookup", text: "qui\xE9n fue napole\xF3n" },
  { category: "knowledge", tool: "wikipedia_lookup", text: "qu\xE9 es el efecto invernadero" },
  { category: "knowledge", tool: "dictionary_define", text: "qu\xE9 significa ef\xEDmero" },
  { category: "knowledge", tool: "math_calc", text: "cu\xE1nto es 15 por ciento de 230" },
  { category: "knowledge", tool: "unit_convert", text: "cu\xE1ntos km son 5 millas" },
  // birthday → save_personal_item
  { category: "birthday", tool: "save_personal_item", text: "cumplea\xF1os de Ana" },
  { category: "birthday", tool: "save_personal_item", text: "regalo para mi hermano" },
  { category: "birthday", tool: "save_personal_item", text: "cu\xE1ndo es el cumple de Juan" },
  { category: "birthday", tool: "save_personal_item", text: "fecha de nacimiento de Mar\xEDa" },
  { category: "birthday", tool: "save_personal_item", text: "aniversario de bodas" },
  { category: "birthday", tool: "save_personal_item", text: "recordatorio de cumplea\xF1os" },
  { category: "birthday", tool: "save_personal_item", text: "calendario de cumplea\xF1os" },
  { category: "birthday", tool: "save_personal_item", text: "pr\xF3ximo cumplea\xF1os" }
];
var CONFIDENCE_THRESHOLD = 0.7;
var MIN_CATEGORY_MARGIN = 0.03;
var SemanticRouter = class _SemanticRouter {
  examples = [];
  initialized = false;
  initPromise = null;
  embedFn;
  // Fase 2.5: caché LRU simple para embeddings de mensajes del usuario.
  // Evita re-embedir el mismo mensaje (ej: "hola", "gracias") en cada turno.
  // Tamaño máximo 100 entradas (suficiente para conversación típica).
  messageCache = /* @__PURE__ */ new Map();
  static CACHE_MAX = 100;
  constructor(embedFn) {
    this.embedFn = embedFn;
  }
  /**
   * Embede todos los ejemplos modelo una sola vez. Idempotente.
   * Llamar antes del primer route(). Las llamadas posteriores son no-op.
   */
  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initialized = true;
  }
  async _doInitialize() {
    const batchSize = 5;
    for (let i = 0; i < ROUTE_EXAMPLES.length; i += batchSize) {
      const batch = ROUTE_EXAMPLES.slice(i, i + batchSize);
      const embedded = await Promise.all(
        batch.map(async (ex) => ({
          category: ex.category,
          tool: ex.tool,
          text: ex.text,
          // Normalizar tildes antes de embedear — ambos lados usan foldAccents
          vector: await this.embedFn(foldAccents(ex.text))
        }))
      );
      this.examples.push(...embedded);
    }
  }
  /**
   * Embede un mensaje del usuario con caché LRU.
   * Si el mismo mensaje se pide de nuevo, devuelve el vector cacheado.
   *
   * 🔴 FIX ESTRUCTURAL: normaliza tildes antes de embedear.
   * Así "cómo salió hoy Argentina?" y "como salio hoy Argentina?" producen
   * el mismo vector y matchean contra los mismos ejemplos.
   */
  async embedMessage(text) {
    const normalized = foldAccents(text);
    const cached2 = this.messageCache.get(normalized);
    if (cached2) {
      this.messageCache.delete(normalized);
      this.messageCache.set(normalized, cached2);
      return cached2;
    }
    const vector = await this.embedFn(normalized);
    if (this.messageCache.size >= _SemanticRouter.CACHE_MAX) {
      const firstKey = this.messageCache.keys().next().value;
      if (firstKey) this.messageCache.delete(firstKey);
    }
    this.messageCache.set(normalized, vector);
    return vector;
  }
  /**
   * Clasifica la intención de un mensaje.
   * Devuelve la categoría más probable con su confianza.
   * Si la confianza es baja, cae a "conversation" (deja al modelo responder libre).
   *
   * 🔴 FIX ESTRUCTURAL: keyword-based fast-path ANTES del router semántico.
   * Para intents de alta confianza (resultados deportivos, clima, recetas),
   * usamos regex determinístico en vez de depender de similitud de embeddings.
   * El router semántico sigue siendo el fallback para casos ambiguos.
   */
  async route(message) {
    await this.initialize();
    const fastPath = keywordFastPath(message);
    if (fastPath) {
      return fastPath;
    }
    const messageVector = await this.embedMessage(message);
    let bestSim = -1;
    let bestExample = null;
    const bestByCategory = /* @__PURE__ */ new Map();
    for (const example of this.examples) {
      const sim = cosineSimilarity(messageVector, example.vector);
      if (sim > bestSim) {
        bestSim = sim;
        bestExample = example;
      }
      const prev = bestByCategory.get(example.category) ?? -1;
      if (sim > prev) bestByCategory.set(example.category, sim);
    }
    if (!bestExample || bestSim < CONFIDENCE_THRESHOLD) {
      return { category: "conversation", confidence: bestSim < 0 ? 0 : bestSim };
    }
    if (bestExample.category !== "conversation") {
      const sortedCategories = [...bestByCategory.entries()].sort((a, b) => b[1] - a[1]);
      const secondBestSim = sortedCategories[1]?.[1] ?? -1;
      if (bestSim - secondBestSim < MIN_CATEGORY_MARGIN) {
        return { category: "conversation", confidence: bestSim };
      }
    }
    const result = {
      category: bestExample.category,
      tool: bestExample.tool,
      confidence: bestSim
    };
    result.toolArgs = extractToolArgs(message, bestExample.tool);
    return result;
  }
};
function extractToolArgs(message, tool) {
  if (!tool) return void 0;
  const clean = message.trim();
  if (tool === "web_search" || tool === "shopping_compare") {
    return { query: clean, mode: tool === "shopping_compare" ? "shopping" : "world" };
  }
  if (tool === "deep_research") {
    const topicMatch = clean.match(
      /(?:informe|reporte|dossier|an[aá]lisis|investigaci[oó]n|resumen)\s+(?:completo\s+|profundo\s+|detallado\s+)?(?:sobre|de|del|acerca de)\s+(.{3,120})/i
    ) ?? clean.match(
      /(?:investig[aá](?:me)?|contame todo (?:sobre|de)|quiero saber todo (?:sobre|de|acerca de)|explicame en profundidad)\s+(.{3,120})/i
    );
    const topic = (topicMatch?.[1] ?? clean).trim().replace(/[.?!]+$/, "");
    return { topic, query: clean };
  }
  if (tool === "weather") {
    const cityMatch = clean.match(/\b(?:en|de|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ\s]{2,30}?)(?:\s*$|[.?!,])/);
    if (cityMatch?.[1]) {
      return { city: cityMatch[1].trim() };
    }
    return {};
  }
  if (tool === "restaurant_deep_search") {
    return { query: clean };
  }
  if (tool === "plan_day") {
    return { focus: clean };
  }
  if (tool === "query_personal_context") {
    return { topic: "general", query: clean };
  }
  if (tool === "match_schedule" || tool === "match_live") {
    return { query: clean };
  }
  if (tool === "crypto_price") {
    const lower = clean.toLowerCase();
    const coinMap = {
      btc: "bitcoin",
      bitcoin: "bitcoin",
      eth: "ethereum",
      ethereum: "ethereum",
      ether: "ethereum",
      sol: "solana",
      solana: "solana",
      ada: "cardano",
      cardano: "cardano",
      dot: "polkadot",
      polkadot: "polkadot",
      link: "chainlink",
      chainlink: "chainlink",
      matic: "matic-network",
      polygon: "matic-network",
      avax: "avalanche-2",
      avalanche: "avalanche-2",
      doge: "dogecoin",
      dogecoin: "dogecoin",
      xrp: "ripple",
      ripple: "ripple",
      ltc: "litecoin",
      litecoin: "litecoin",
      bnb: "binancecoin",
      usdt: "tether",
      tether: "tether",
      usdc: "usd-coin",
      shib: "shiba-inu",
      shiba: "shiba-inu",
      uni: "uniswap",
      uniswap: "uniswap",
      atom: "cosmos",
      cosmos: "cosmos",
      near: "near",
      "near protocol": "near",
      apt: "aptos",
      aptos: "aptos",
      fil: "filecoin",
      filecoin: "filecoin"
    };
    for (const [ticker, id] of Object.entries(coinMap)) {
      const re = new RegExp(`\\b${ticker}\\b`, "i");
      if (re.test(lower)) return { coin: id };
    }
    const stripped = clean.replace(/\b(?:precio|cotizacion|cotización|valor|cuanto esta|cómo esta|como esta|cuanto vale|a cuanto|a cuánto|del|de|la|el)\b/gi, "").replace(/[?!.]+/g, "").trim();
    return { coin: stripped || "bitcoin" };
  }
  if (tool === "stock_quote") {
    return { symbol: clean };
  }
  if (tool === "currency_convert") {
    return { amount: 1, from: "USD", to: "ARS" };
  }
  if (tool === "route_traffic") {
    return { query: clean };
  }
  if (tool === "travel_itinerary") {
    return { destination: clean };
  }
  return void 0;
}
var KNOWN_TEAMS = [
  // Selecciones nacionales
  "argentina",
  "espana",
  "brasil",
  "francia",
  "alemania",
  "inglaterra",
  "italia",
  "portugal",
  "holanda",
  "belgica",
  "uruguay",
  "chile",
  "colombia",
  "mexico",
  "peru",
  "ecuador",
  "paraguay",
  "estados unidos",
  "usa",
  "japon",
  "corea",
  "china",
  "arabia",
  "qatar",
  "marruecos",
  "senegal",
  "nigeria",
  "ghana",
  "camerun",
  "australia",
  // Clubes argentinos
  "boca",
  "river",
  "independiente",
  "racing",
  "san lorenzo",
  "estudiantes",
  "lanus",
  "banfield",
  "velez",
  "huracan",
  "rosario central",
  "newells",
  "talleres",
  "belgrano",
  "colon",
  "gimnasia",
  // Clubes europeos principales
  "real madrid",
  "barcelona",
  "barca",
  "atletico madrid",
  "atletico",
  "sevilla",
  "valencia",
  "villarreal",
  "real sociedad",
  "betis",
  "athletic bilbao",
  "athletic",
  "celta",
  "real betis",
  "liverpool",
  "manchester city",
  "manchester united",
  "man city",
  "man united",
  "chelsea",
  "arsenal",
  "tottenham",
  "spurs",
  "leicester",
  "everton",
  "newcastle",
  "west ham",
  "aston villa",
  "brighton",
  "juventus",
  "inter",
  "milan",
  "ac milan",
  "roma",
  "lazio",
  "napoli",
  "fiorentina",
  "atalanta",
  "torino",
  "sampdoria",
  "genoa",
  "bayern munich",
  "bayern",
  "dortmund",
  "borussia dortmund",
  "leverkusen",
  "leipzig",
  "frankfurt",
  "wolfsburg",
  "stuttgart",
  "psg",
  "paris saint germain",
  "marseille",
  "lyon",
  "monaco",
  "lille",
  "benfica",
  "porto",
  "sporting lisboa",
  "sporting",
  "ajax",
  "psv",
  "feyenoord",
  "celtic",
  "rangers"
];
function keywordFastPath(message) {
  const normalized = foldAccents(message);
  const sportsIntentPatterns = [
    /\b(como salio|como salieron|como le fue|como les fue|como va|como van|quien gano|quien ganaron|resultado de|resultados de|marcador de|score de)\b/
  ];
  const mentionsTeam = KNOWN_TEAMS.some((team) => normalized.includes(foldAccents(team)));
  const hasSportsWord = /\b(partido|partidos|futbol|football|soccer|copa|mundial|champions|europa|libertadores|liga|premier|serie a|bundesliga)\b/.test(normalized);
  if (sportsIntentPatterns.some((p) => p.test(normalized)) && (mentionsTeam || hasSportsWord)) {
    const teamMatch = KNOWN_TEAMS.find((team) => normalized.includes(foldAccents(team)));
    const temporalMatch = normalized.match(/\b(hoy|ayer|manana|anteayer|pasado manana|el sabado|el domingo|el lunes|el martes|el miercoles|el jueves|el viernes)\b/);
    const query = teamMatch ? `${teamMatch} ${temporalMatch?.[0] ?? ""}`.trim() : message;
    return {
      category: "sports",
      tool: "match_live",
      confidence: 0.99,
      toolArgs: { query }
    };
  }
  if (/\b(recordame|recuerdame|no me dejes olvidar|avisame)\b/.test(normalized)) {
    const timeMatch = normalized.match(/\b(a las\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|al\s+\d{1,2}(?::\d{2})?|el\s+\d{1,2}|manana|pasado manana|en\s+\d+\s*(?:horas?|minutos?|dias?))\b/i);
    if (timeMatch) {
      const titleMatch = normalized.match(/(?:recordame|recuerdame|no me dejes olvidar|avisame)\s+(.+?)(?:\s+(?:a las|al|el|en|para|manana|pasado)\b|$)/);
      const title = titleMatch?.[1]?.trim() ?? message.replace(/.*(?:recordame|recuerdame|no me dejes olvidar|avisame)\s+/i, "").trim();
      return {
        category: "action",
        tool: "reminder_set",
        confidence: 0.99,
        toolArgs: {
          title: title.slice(0, 100) || "Recordatorio",
          dueText: timeMatch[0]
        }
      };
    }
  }
  if (/\b(alarma|despertador)\b/.test(normalized)) {
    const timeMatch = normalized.match(/\b(?:a las\s+|al\s+|para las\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
    if (timeMatch) {
      const repeatMatch = normalized.match(/\b(diario|diaria|todos los dias|semanal|lunes a viernes|cada dia)\b/i);
      return {
        category: "action",
        tool: "alarm_set",
        confidence: 0.99,
        toolArgs: {
          title: message.replace(/.*(?:alarma|despertador)\s+para\s+/i, "").replace(/[?!.].*$/, "").trim() || "Alarma",
          time: timeMatch[1].replace(/\s+/g, " ").trim(),
          repeat: repeatMatch?.[0]
        }
      };
    }
  }
  if (/\b(cuantos? dias? faltan|cuanto falta para|faltan para)\b/.test(normalized)) {
    const dateMatch = normalized.match(/(?:para|desde)\s+(.+?)(?:\?|$)/);
    const date = dateMatch?.[1]?.trim() ?? message;
    return {
      category: "action",
      tool: "countdown",
      confidence: 0.99,
      toolArgs: {
        date,
        label: date.slice(0, 60)
      }
    };
  }
  if (/\b(guardame|guardar|guarda|guarda|salva|salvame)\b/.test(normalized) && /\b(coleccion|carpeta|tablero)\b/.test(normalized)) {
    const collMatch = normalized.match(/(?:en\s+(?:la\s+|el\s+)?)?(?:coleccion|carpeta|tablero)\s+([a-záéíóúñ0-9\s·]+?)(?:\.|$)/i);
    const collection = collMatch?.[1]?.trim();
    return {
      category: "action",
      tool: "save_personal_item",
      confidence: 0.99,
      toolArgs: {
        title: "Informe guardado",
        collection: collection || "Koru \xB7 Informes",
        uiBlockType: "saved_record",
        recordKind: "idea",
        note: "Guardado desde chat"
      }
    };
  }
  return null;
}

// koru-mvp/src/server/logger.ts
import { appendFileSync, mkdirSync } from "node:fs";
var LOG_DIR = "./logs";
var LOG_FILE = "./logs/koru-backend.log";
function write(level, tag, message, extra) {
  const entry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    tag,
    message,
    ...extra ?? {}
  };
  const line = JSON.stringify(entry) + "\n";
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line);
  } catch {
  }
  const prefix = `[${level}] ${tag}:`;
  const extraStr = extra ? JSON.stringify(extra).slice(0, 500) : "";
  if (level === "ERROR") console.error(prefix, message, extraStr);
  else if (level === "WARN") console.warn(prefix, message, extraStr);
  else console.log(prefix, message, extraStr);
}
function dump(value, maxLen = 1500) {
  let s;
  try {
    if (typeof value === "string") s = value;
    else if (value === void 0) s = "undefined";
    else if (value === null) s = "null";
    else s = JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s.length > maxLen) return s.slice(0, maxLen) + " \u2026[truncated]";
  return s;
}
var logger = {
  debug: (tag, message, extra) => write("DEBUG", tag, message, extra),
  info: (tag, message, extra) => write("INFO", tag, message, extra),
  warn: (tag, message, extra) => write("WARN", tag, message, extra),
  error: (tag, message, extra) => write("ERROR", tag, message, extra)
};

// koru-mvp/src/tools/types.ts
function defineTool(name, description, parameters) {
  return { type: "function", function: { name, description, parameters } };
}
var policies = {
  /** Solo lee datos externos/públicos. Ej: weather, wikipedia. */
  readonly: (reason) => ({ risk: "readonly", requiresApproval: false, autoRun: true, reason }),
  /** Modifica datos locales del usuario. Ej: save_memory, create_task. */
  localWrite: (reason, opts = {}) => ({
    risk: "local_write",
    requiresApproval: opts.requiresApproval ?? true,
    autoRun: opts.requiresApproval === false,
    reason
  }),
  /** Efecto externo reversible. Ej: web_search (gasta cuota), open_url. */
  externalSideEffect: (reason, opts = {}) => ({
    risk: "external_side_effect",
    requiresApproval: opts.requiresApproval ?? true,
    autoRun: opts.autoRun ?? false,
    reason
  }),
  /** Alto riesgo: borra/sobrescribe. Ej: file_write, shell_run. */
  destructive: (reason) => ({ risk: "destructive", requiresApproval: true, autoRun: false, reason })
};

// koru-mvp/src/tools/shared/fetcher.ts
var KORU_USER_AGENT = "KoruLocal/1.0 (+local-first assistant)";
async function fetchJson(url, options = {}) {
  const { method = "GET", headers = {}, body, timeoutMs = 1e4, retries = 1 } = options;
  const finalHeaders = {
    "User-Agent": KORU_USER_AGENT,
    Accept: "application/json",
    ...headers
  };
  let lastError = "fetch failed";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body,
        signal: controller.signal
      });
      const text = await response.text();
      clearTimeout(timeout);
      const looksHtml = /^\s*(?:<!doctype html|<html|<body)/i.test(text);
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (looksHtml) return { ok: false, status: response.status, error: "El servidor devolvi\xF3 HTML en vez de JSON (posible bloqueo de bot o cambio de API)." };
        if (response.ok) return { ok: false, status: response.status, error: "Respuesta no es JSON v\xE1lido" };
        return { ok: false, status: response.status, error: text.slice(0, 200) || `HTTP ${response.status}` };
      }
      if (!response.ok) {
        const errMsg = data?.error ?? data?.message ?? `HTTP ${response.status}`;
        return { ok: false, status: response.status, error: errMsg };
      }
      return { ok: true, status: response.status, data };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return { ok: false, status: 0, error: lastError };
}
async function fetchText(url, options = {}) {
  const { method = "GET", headers = {}, body, timeoutMs = 1e4 } = options;
  const finalHeaders = {
    "User-Agent": KORU_USER_AGENT,
    ...headers
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
    const text = await response.text();
    clearTimeout(timeout);
    if (!response.ok) return { ok: false, status: response.status, error: text.slice(0, 300) || `HTTP ${response.status}` };
    return { ok: true, status: response.status, text };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "\u2026";
}
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "fuente externa";
  }
}

// koru-mvp/src/tools/shared/cache.ts
var store = /* @__PURE__ */ new Map();
function getCached(key) {
  const entry = store.get(key);
  if (!entry) return void 0;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return void 0;
  }
  return entry.value;
}
function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
async function cached(key, ttlMs, fn) {
  const hit = getCached(key);
  if (hit !== void 0) return hit;
  const value = await fn();
  setCached(key, value, ttlMs);
  return value;
}
function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}
var ttls = {
  /** Clima actual: 10 min. */
  weatherNow: 10 * 60 * 1e3,
  /** Pronóstico: 30 min. */
  weatherForecast: 30 * 60 * 1e3,
  /** Resultados deportivos en vivo: 30 s. */
  sportsLive: 30 * 1e3,
  /** Tabla de posiciones: 5 min. */
  sportsStandings: 5 * 60 * 1e3,
  /** Divisas: 1 h. */
  currency: 60 * 60 * 1e3,
  /** Cripto: 60 s. */
  crypto: 60 * 1e3,
  /** Noticias: 5 min. */
  news: 5 * 60 * 1e3,
  /** Trending: 5 min. */
  trending: 5 * 60 * 1e3,
  /** Wikipedia/info estática: 24 h. */
  reference: 24 * 60 * 60 * 1e3,
  /** Geocoding: 7 días (las ciudades no se mueven). */
  geocode: 7 * 24 * 60 * 60 * 1e3
};
setInterval(pruneCache, 5 * 60 * 1e3).unref?.();

// koru-mvp/src/tools/shared/rateLimiter.ts
function rateLimiter(maxPerSec) {
  if (maxPerSec <= 0) return { acquire: async () => void 0 };
  const intervalMs = 1e3 / maxPerSec;
  const queue = [];
  let lastEmit = 0;
  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length > 0) {
        const elapsed = Date.now() - lastEmit;
        const wait = elapsed < intervalMs ? intervalMs - elapsed : 0;
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastEmit = Date.now();
        const resolve = queue.shift();
        resolve?.();
      }
    } finally {
      pumping = false;
    }
  }
  return {
    acquire() {
      return new Promise((resolve) => {
        queue.push(resolve);
        void pump();
      });
    }
  };
}
var limiters = {
  /** Open-Meteo: 600/min ≈ 10/s. Conservamos 8/s para dejar margen. */
  openMeteo: rateLimiter(8),
  /** Nominatim: ESTRICTO 1 req/s. Política oficial OSM. */
  nominatim: rateLimiter(1),
  /** Overpass: ~2 req/s en instancias públicas. */
  overpass: rateLimiter(2),
  /** OSRM: no documentado, conservador 2/s con cache pesado. */
  osrm: rateLimiter(2),
  /** GDELT: "generoso", conservador 2/s. */
  gdelt: rateLimiter(2),
  /** Wikipedia: User-Agent obligatorio, ~3/s razonable. */
  wikipedia: rateLimiter(3),
  /** Frankfurter: sin límite duro, 2/s cortés. */
  frankfurter: rateLimiter(2),
  /** DuckDuckGo HTML scraping: 1/s para evitar bloqueos. */
  duckduckgo: rateLimiter(1),
  /** Reddit JSON: ~60/min = 1/s con User-Agent. */
  reddit: rateLimiter(1),
  /** CoinGecko demo: 30/min = 0.5/s. */
  coingecko: rateLimiter(0.5),
  /** Open Food Facts: fair use, 2/s. */
  openFoodFacts: rateLimiter(2),
  /** Numbers API: 1/s cortés. */
  numbersApi: rateLimiter(1),
  /** Stooq CSV: 1/s cortés. */
  stooq: rateLimiter(1)
};

// koru-mvp/src/tools/money/currencyConvert.ts
var currencyConvert = {
  definition: defineTool(
    "currency_convert",
    "Convierte un monto entre dos monedas usando la tasa de cambio actual del Banco Central Europeo (v\xEDa Frankfurter, open source). \xDAsala cuando el usuario pregunte cu\xE1nto equivale una cantidad en otra moneda, ej: '\xBFcu\xE1nto son 100 d\xF3lares en pesos?', '50 euros a yen', 'conversi\xF3n USD a ARS'. Monedas comunes: USD, EUR, ARS, MXN, COP, CLP, GBP, JPY, BRL.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        amount: { type: "number", description: "Monto a convertir." },
        from: { type: "string", description: "Moneda origen (c\xF3digo ISO 4217, ej: USD, EUR, ARS)." },
        to: { type: "string", description: "Moneda destino (c\xF3digo ISO 4217)." }
      },
      required: ["amount", "from", "to"]
    }
  ),
  policy: policies.readonly("Lee tasas de cambio p\xFAblicas del BCE."),
  async run(args) {
    const amount = Number(args.amount);
    const from = String(args.from ?? "").toUpperCase().trim();
    const to = String(args.to ?? "").toUpperCase().trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      return { type: "currency_convert", status: "failed", error: "El monto debe ser un n\xFAmero positivo." };
    }
    if (!from || !to || from.length !== 3 || to.length !== 3) {
      return { type: "currency_convert", status: "failed", error: "Indic\xE1 monedas de 3 letras (ej: USD, EUR, ARS)." };
    }
    const cacheKey = `fx:${from}:${to}`;
    const rate = await cached(cacheKey, ttls.currency, async () => {
      await limiters.frankfurter.acquire();
      const result = await fetchJson(
        `https://api.frankfurter.app/latest?amount=${encodeURIComponent(amount)}&from=${from}&to=${to}`,
        { timeoutMs: 15e3 }
      );
      if (!result.ok) throw new Error(result.error);
      const rateValue = result.data.rates?.[to];
      if (typeof rateValue !== "number") throw new Error(`No tengo tasa para ${from}\u2192${to}.`);
      return rateValue;
    });
    const converted = rate;
    const unitRate = converted / amount;
    return {
      type: "currency_convert",
      status: "ok",
      amount,
      from,
      to,
      converted: Number(converted.toFixed(2)),
      rate: Number(unitRate.toFixed(4)),
      source: "Banco Central Europeo (v\xEDa Frankfurter)",
      sourceUrl: "https://www.frankfurter.app/",
      note: `Tasa de referencia BCE. Puede diferir de la tasa de casa de cambio.`
    };
  }
};

// koru-mvp/src/tools/money/exchangeHistory.ts
var exchangeHistory = {
  definition: defineTool(
    "exchange_history",
    "Muestra la evoluci\xF3n hist\xF3rica de una divisa contra otra en un per\xEDodo. \xDAsala para '\xBFc\xF3mo estaba el d\xF3lar hace un a\xF1o?', 'evoluci\xF3n del euro vs peso en 2024', 'gr\xE1fico de USD/ARS \xFAltimo mes'. Datos del Banco Central Europeo desde 1999.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", description: "Moneda origen (ISO 4217, ej: USD)." },
        to: { type: "string", description: "Moneda destino (ISO 4217)." },
        startDate: { type: "string", description: "Fecha inicio YYYY-MM-DD." },
        endDate: { type: "string", description: "Fecha fin YYYY-MM-DD. Por defecto hoy." }
      },
      required: ["from", "to", "startDate"]
    }
  ),
  policy: policies.readonly("Lee hist\xF3rico p\xFAblico del BCE."),
  async run(args) {
    const from = String(args.from ?? "").toUpperCase().trim();
    const to = String(args.to ?? "").toUpperCase().trim();
    const startDate = String(args.startDate ?? "").trim();
    const endDate = String(args.endDate ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).trim();
    if (from.length !== 3 || to.length !== 3) {
      return { type: "exchange_history", status: "failed", error: "Monedas deben ser de 3 letras." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { type: "exchange_history", status: "failed", error: "startDate debe ser YYYY-MM-DD." };
    }
    const cacheKey = `fxhist:${from}:${to}:${startDate}:${endDate}`;
    const rates = await cached(cacheKey, ttls.reference, async () => {
      await limiters.frankfurter.acquire();
      const result = await fetchJson(
        `https://api.frankfurter.app/${startDate}..${endDate}?from=${from}&to=${to}`,
        { timeoutMs: 1e4 }
      );
      if (!result.ok) throw new Error(result.error);
      const raw = result.data.rates;
      const out = {};
      for (const [date, entry] of Object.entries(raw)) {
        if (entry && typeof entry[to] === "number") out[date] = entry[to];
      }
      return out;
    });
    const values = Object.values(rates);
    const dates = Object.keys(rates).sort();
    if (values.length === 0) {
      return { type: "exchange_history", status: "failed", error: `Sin datos para ${from}\u2192${to} en ese per\xEDodo.` };
    }
    const first = values[0];
    const last = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const changePct = first > 0 ? (last - first) / first * 100 : 0;
    return {
      type: "exchange_history",
      status: "ok",
      from,
      to,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      firstRate: Number(first.toFixed(4)),
      lastRate: Number(last.toFixed(4)),
      minRate: Number(min.toFixed(4)),
      maxRate: Number(max.toFixed(4)),
      changePct: Number(changePct.toFixed(2)),
      samples: values.length,
      source: "Banco Central Europeo (v\xEDa Frankfurter)",
      sourceUrl: "https://www.frankfurter.app/"
    };
  }
};

// koru-mvp/src/tools/money/cryptoPrice.ts
var cryptoPrice = {
  definition: defineTool(
    "crypto_price",
    "Obt\xE9n el precio actual y m\xE9tricas de mercado de una criptomoneda (BTC, ETH, SOL, etc.). \xDAsala cuando el usuario pregunte '\xBFa cu\xE1nto est\xE1 BTC?', 'precio de ETH', 'c\xF3mo est\xE1 Solana hoy'. Devuelve precio, market cap y variaci\xF3n 24h/7d.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        coin: { type: "string", description: "Ticker o nombre de la cripto (ej: bitcoin, ethereum, solana, BTC, ETH, SOL)." },
        vsCurrency: { type: "string", description: "Moneda en que se cotiza. Default USD.", default: "usd" }
      },
      required: ["coin"]
    }
  ),
  policy: policies.readonly("Lee precios p\xFAblicos de cripto."),
  async run(args) {
    const raw = String(args.coin ?? "").trim().toLowerCase();
    const vs = String(args.vsCurrency ?? "usd").toLowerCase().trim();
    if (!raw) return { type: "crypto_price", status: "failed", error: "Indic\xE1 la cripto." };
    const tickerMap = {
      btc: "bitcoin",
      eth: "ethereum",
      sol: "solana",
      ada: "cardano",
      dot: "polkadot",
      link: "chainlink",
      matic: "matic-network",
      avax: "avalanche-2",
      doge: "dogecoin",
      xrp: "ripple",
      ltc: "litecoin",
      bnb: "binancecoin",
      usdt: "tether",
      usdc: "usd-coin"
    };
    const coinId = tickerMap[raw] ?? raw;
    const cacheKey = `crypto:${coinId}:${vs}`;
    const data = await cached(cacheKey, ttls.crypto, async () => {
      await limiters.coingecko.acquire();
      const result = await fetchJson(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
        { timeoutMs: 1e4 }
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    });
    const md = data.market_data;
    if (!md) return { type: "crypto_price", status: "failed", error: `Sin market_data para ${coinId}.` };
    const price = md.current_price?.[vs];
    if (typeof price !== "number") {
      return { type: "crypto_price", status: "failed", error: `No tengo precio de ${raw} en ${vs}. Prob\xE1 con USD.` };
    }
    return {
      type: "crypto_price",
      status: "ok",
      coin: data.name,
      symbol: (data.symbol ?? raw).toUpperCase(),
      price,
      currency: vs.toUpperCase(),
      marketCap: md.market_cap?.[vs],
      change24hPct: typeof md.price_change_percentage_24h === "number" ? Number(md.price_change_percentage_24h.toFixed(2)) : void 0,
      change7dPct: typeof md.price_change_percentage_7d === "number" ? Number(md.price_change_percentage_7d.toFixed(2)) : void 0,
      high24h: md.high_24h?.[vs],
      low24h: md.low_24h?.[vs],
      source: "CoinGecko",
      sourceUrl: `https://www.coingecko.com/en/coins/${coinId}`
    };
  }
};

// koru-mvp/src/tools/money/stockQuote.ts
function parseStooqCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const cols = lines[1].split(",");
  if (cols.length < 7) return null;
  return {
    symbol: cols[0],
    date: cols[1],
    open: Number(cols[2]),
    high: Number(cols[3]),
    low: Number(cols[4]),
    close: Number(cols[5]),
    volume: Number(cols[6])
  };
}
var stockQuote = {
  definition: defineTool(
    "stock_quote",
    "Obt\xE9n la cotizaci\xF3n actual (\xFAltimo cierre) de una acci\xF3n o \xEDndice burs\xE1til. \xDAsala cuando el usuario pregunte '\xBFc\xF3mo est\xE1 Apple?', 'cierre del S&P 500', 'precio de Tesla', 'c\xF3mo cerr\xF3 el Nasdaq'. S\xEDmbolos comunes: AAPL, MSFT, TSLA, GOOGL, ^SPX, ^NDX, ^DJI.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        symbol: { type: "string", description: "S\xEDmbolo burs\xE1til (ej: AAPL, MSFT, TSLA, ^SPX, ^NDX)." }
      },
      required: ["symbol"]
    }
  ),
  policy: policies.readonly("Lee cotizaciones p\xFAblicas."),
  async run(args) {
    const symbol = String(args.symbol ?? "").trim().toLowerCase();
    if (!symbol) return { type: "stock_quote", status: "failed", error: "Indic\xE1 el s\xEDmbolo." };
    const cacheKey = `stock:${symbol}`;
    const row = await cached(cacheKey, ttls.crypto, async () => {
      await limiters.stooq.acquire();
      const stooqSym = symbol.replace(/^\^/, "");
      const result = await fetchText(
        `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`,
        { headers: { Accept: "text/csv" }, timeoutMs: 15e3 }
      );
      if (!result.ok) throw new Error(result.error);
      const parsed = parseStooqCsv(result.text);
      if (!parsed) throw new Error("Respuesta Stooq inv\xE1lida.");
      return parsed;
    });
    if (!Number.isFinite(row.close)) {
      return { type: "stock_quote", status: "failed", error: `Sin cotizaci\xF3n para ${symbol}.` };
    }
    return {
      type: "stock_quote",
      status: "ok",
      symbol: symbol.toUpperCase(),
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume > 0 ? row.volume : void 0,
      source: "Stooq",
      sourceUrl: `https://stooq.com/q/?s=${symbol}`,
      note: "Precio de \xFAltimo cierre. Datos con leve retardo (15 min+)."
    };
  }
};

// koru-mvp/src/tools/money/expenses.ts
var expenseTrack = {
  definition: defineTool(
    "expense_track",
    "Registra un gasto del usuario con monto, moneda, categor\xEDa y nota. \xDAsala cuando el usuario diga 'gast\xE9 25 en cena', 'anota 50 de gasolina', 'gaste 120 euros en super'. El gasto se guarda como record tipo 'expense'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Descripci\xF3n del gasto (ej: 'Cena', 'Gasolina')." },
        amount: { type: "number", description: "Monto." },
        currency: { type: "string", description: "Moneda (ej: EUR, USD, ARS). Default EUR." },
        note: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["title", "amount"]
    }
  ),
  policy: policies.localWrite("Guarda gasto del usuario."),
  async run(args, _ctx) {
    const title = String(args.title ?? "").trim();
    const amount = Number(args.amount);
    const currency = String(args.currency ?? "EUR").toUpperCase().trim();
    if (!title || !Number.isFinite(amount)) {
      return { type: "expense_track", status: "failed", error: "Necesito t\xEDtulo y monto." };
    }
    const record = {
      domain: "money",
      kind: "expense",
      title,
      amount,
      currency,
      notes: args.note ? String(args.note) : void 0,
      tags: Array.isArray(args.tags) ? args.tags.map(String) : void 0
    };
    return {
      type: "expense_track",
      status: "ok",
      block: { type: "saved_record", title: "Gasto anotado", records: [record] },
      records: [record]
    };
  }
};
function expensesByPeriod(records, periodDays) {
  const now = Date.now();
  const since = now - periodDays * 24 * 60 * 60 * 1e3;
  return records.filter((r) => {
    if (r.kind !== "expense" || typeof r.amount !== "number") return false;
    const created = new Date(r.createdAt).getTime();
    return Number.isFinite(created) && created >= since;
  });
}
var expenseSummary = {
  definition: defineTool(
    "expense_summary",
    "Resume los gastos guardados del usuario por per\xEDodo (hoy, semana, mes) con totales, moneda y desglose. \xDAsala cuando el usuario pregunte '\xBFcu\xE1nto gast\xE9 esta semana?', 'gastos del mes', 'total de hoy'. Lee los records tipo 'expense' ya guardados.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["today", "week", "month"], description: "Per\xEDodo a resumir. Default week." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee gastos guardados del usuario."),
  async run(args, ctx) {
    const period = String(args.period ?? "week");
    const days = period === "today" ? 1 : period === "month" ? 30 : 7;
    const expenses = expensesByPeriod(ctx.state.records ?? [], days);
    if (expenses.length === 0) {
      return {
        type: "expense_summary",
        status: "ok",
        period,
        total: 0,
        currency: "EUR",
        count: 0,
        summaryItems: [],
        block: { type: "money_summary", title: `Sin gastos en ${period === "today" ? "hoy" : period === "week" ? "la semana" : "el mes"}`, recommendation: "Todav\xEDa no anotaste gastos en este per\xEDodo." }
      };
    }
    const byCurrency = /* @__PURE__ */ new Map();
    for (const e of expenses) {
      const cur = (e.currency ?? "EUR").toUpperCase();
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (e.amount ?? 0));
    }
    const primaryCurrency = byCurrency.keys().next().value ?? "EUR";
    const total = byCurrency.get(primaryCurrency) ?? 0;
    const summaryItems = expenses.slice(0, 10).map((e) => ({
      label: e.title,
      value: `${e.amount ?? 0} ${e.currency ?? primaryCurrency}`,
      detail: e.notes
    }));
    return {
      type: "expense_summary",
      status: "ok",
      period,
      total: Number(total.toFixed(2)),
      currency: primaryCurrency,
      count: expenses.length,
      summaryItems,
      block: {
        type: "money_summary",
        title: `Gastos ${period === "today" ? "de hoy" : period === "week" ? "de la semana" : "del mes"}`,
        total: Number(total.toFixed(2)),
        currency: primaryCurrency,
        summaryItems,
        recommendation: `${expenses.length} movimiento(s). ${byCurrency.size > 1 ? "Varias monedas: revis\xE1 detalle." : ""}`
      }
    };
  }
};
var expenseAlert = {
  definition: defineTool(
    "expense_alert",
    "Detecta gastos at\xEDpicos del usuario comparando contra su promedio hist\xF3rico. \xDAsala cuando el usuario pregunte '\xBFgast\xE9 algo raro?', 'hay alg\xFAn gasto inusual?'. Devuelve los gastos que superan el promedio en m\xE1s del doble.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["week", "month"], description: "Ventana a analizar. Default month." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Analiza gastos guardados."),
  async run(args, ctx) {
    const period = String(args.period ?? "month");
    const days = period === "week" ? 7 : 30;
    const expenses = expensesByPeriod(ctx.state.records ?? [], days).filter((e) => typeof e.amount === "number");
    if (expenses.length < 3) {
      return { type: "expense_alert", status: "ok", anomalies: [], note: "Pocos gastos para detectar anomal\xEDas." };
    }
    const amounts = expenses.map((e) => e.amount ?? 0);
    const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length;
    const threshold = Math.max(avg * 2, avg + 20);
    const anomalies = expenses.filter((e) => (e.amount ?? 0) > threshold).map((e) => ({ title: e.title, amount: e.amount, currency: e.currency, note: `${((e.amount ?? 0) / avg).toFixed(1)}x el promedio (${avg.toFixed(2)} ${e.currency})` }));
    return {
      type: "expense_alert",
      status: "ok",
      period,
      average: Number(avg.toFixed(2)),
      threshold: Number(threshold.toFixed(2)),
      anomalies
    };
  }
};
var budgetSet = {
  definition: defineTool(
    "budget_set",
    "Establece un presupuesto mensual para una categor\xEDa o gasto total. \xDAsala cuando el usuario diga 'poneme 400 de comida este mes', 'l\xEDmite de 1000 de gastos'. Se guarda como memory para que Koru avise al acercarse al l\xEDmite.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string", description: "Categor\xEDa o nombre del presupuesto (ej: 'comida', 'total', 'transporte')." },
        limit: { type: "number", description: "Monto l\xEDmite mensual." },
        currency: { type: "string", default: "EUR" }
      },
      required: ["category", "limit"]
    }
  ),
  policy: policies.localWrite("Guarda presupuesto como memory."),
  async run(args) {
    const category = String(args.category ?? "").trim();
    const limit = Number(args.limit);
    const currency = String(args.currency ?? "EUR").toUpperCase();
    if (!category || !Number.isFinite(limit)) {
      return { type: "budget_set", status: "failed", error: "Indic\xE1 categor\xEDa y l\xEDmite." };
    }
    return {
      type: "budget_set",
      status: "ok",
      category,
      limit,
      currency,
      memoryCandidates: [{
        kind: "goal",
        text: `Presupuesto mensual de ${category}: ${limit} ${currency}`,
        confidence: 0.95,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: `${category} ${limit} ${currency}`,
        useForSuggestions: true
      }]
    };
  }
};
var subscriptionReminder = {
  definition: defineTool(
    "subscription_reminder",
    "Programa un recordatorio para una suscripci\xF3n o cobro recurrente (Netflix, Spotify, gimnasio). \xDAsala cuando el usuario diga 'avisame antes de que cobren Spotify', 'recordame la cuota del gym cada mes'. Crea un commitment recurrente.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre de la suscripci\xF3n (ej: 'Netflix')." },
        amount: { type: "number" },
        currency: { type: "string", default: "EUR" },
        dueText: { type: "string", description: "Fecha del pr\xF3ximo cobro (ej: 'el 15', 'cada 1ro')." },
        recurrence: { type: "string", enum: ["daily", "weekly", "monthly"], default: "monthly" }
      },
      required: ["name", "dueText"]
    }
  ),
  policy: policies.localWrite("Crea recordatorio de suscripci\xF3n."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const dueText = String(args.dueText ?? "").trim();
    if (!name || !dueText) return { type: "subscription_reminder", status: "failed", error: "Indic\xE1 nombre y fecha." };
    const recurrence = String(args.recurrence ?? "monthly");
    const amount = args.amount;
    const currency = String(args.currency ?? "EUR").toUpperCase();
    return {
      type: "subscription_reminder",
      status: "ok",
      commitments: [{
        title: `${name}${typeof amount === "number" ? ` (${amount} ${currency})` : ""}`,
        dueHint: dueText,
        recurrence,
        status: "open"
      }],
      records: [{
        domain: "money",
        kind: "expense",
        title: name,
        amount: typeof amount === "number" ? amount : void 0,
        currency,
        dueHint: dueText,
        notes: `Suscripci\xF3n ${recurrence}`
      }]
    };
  }
};
var taxEstimate = {
  definition: defineTool(
    "tax_estimate",
    "Estima el IVA o impuesto sobre un monto. \xDAsala cuando el usuario pregunte '\xBFcu\xE1nto IVA tiene este producto?', 'IVA de 100 euros', 'precio con impuesto'. Default IVA 21% (Espa\xF1a).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        amount: { type: "number", description: "Monto base." },
        rate: { type: "number", description: "Tasa de impuesto en %. Default 21." },
        currency: { type: "string", default: "EUR" },
        mode: { type: "string", enum: ["add", "extract"], description: "add: suma impuesto al base; extract: desglosa desde monto con impuesto incluido. Default add." }
      },
      required: ["amount"]
    }
  ),
  policy: policies.readonly("C\xE1lculo local."),
  async run(args) {
    const amount = Number(args.amount);
    const rate = Number(args.rate ?? 21);
    const currency = String(args.currency ?? "EUR").toUpperCase();
    const mode = String(args.mode ?? "add");
    if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
      return { type: "tax_estimate", status: "failed", error: "Monto y tasa deben ser n\xFAmeros." };
    }
    if (mode === "extract") {
      const base = amount / (1 + rate / 100);
      const tax2 = amount - base;
      return { type: "tax_estimate", status: "ok", mode, gross: Number(amount.toFixed(2)), base: Number(base.toFixed(2)), tax: Number(tax2.toFixed(2)), rate, currency };
    }
    const tax = amount * (rate / 100);
    return { type: "tax_estimate", status: "ok", mode, base: Number(amount.toFixed(2)), tax: Number(tax.toFixed(2)), gross: Number((amount + tax).toFixed(2)), rate, currency };
  }
};
var inflationData = {
  definition: defineTool(
    "inflation_data",
    "Obtiene el dato oficial de inflaci\xF3n (IPC) de un pa\xEDs. \xDAsala cuando el usuario pregunte '\xBFc\xF3mo est\xE1 la inflaci\xF3n en Argentina?', 'IPC de Espa\xF1a'. Datos de FRED (Federal Reserve Economic Data).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        country: { type: "string", description: "Pa\xEDs (ej: 'Argentina', 'Espa\xF1a', 'United States')." }
      },
      required: ["country"]
    }
  ),
  policy: policies.readonly("Lee IPC p\xFAblico de FRED."),
  async run(args) {
    const country = String(args.country ?? "").trim();
    if (!country) return { type: "inflation_data", status: "failed", error: "Indic\xE1 pa\xEDs." };
    return {
      type: "inflation_data",
      status: "not_configured",
      country,
      note: "Para datos de inflaci\xF3n oficiales, configurala fuente (FRED API key gratuita) en .env. Mientras tanto pod\xE9s consultar https://fred.stlouisfed.org o el INE/BCRA de tu pa\xEDs.",
      sourceUrl: "https://fred.stlouisfed.org/categories/9"
    };
  }
};
var priceCompareProduct = {
  definition: defineTool(
    "price_compare_product",
    "Compara precios de un producto en varias tiendas online y ordena por precio total (incluyendo env\xEDo cuando es visible). \xDAsala cuando el usuario diga '\xBFd\xF3nde compro m\xE1s barato X?', 'mejor precio de Y'. Lee rese\xF1as y destacados de cada tienda. Reusa la l\xF3gica de shopping_compare del motor con anti-alucinaci\xF3n.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto a comparar (ej: 'AirPods Pro 2', 'iPhone 15 128GB')." },
        budget: { type: "string" }
      },
      required: ["query"]
    }
  ),
  policy: policies.externalSideEffect("Compara precios en tiendas reales.", { requiresApproval: true }),
  async run(args, ctx) {
    return {
      type: "price_compare_product",
      status: "delegate",
      delegateTo: "shopping_compare",
      query: String(args.query ?? ""),
      note: "Esta petici\xF3n se enruta a shopping_compare del motor, que ya tiene scraping multi-tienda + anti-alucinaci\xF3n.",
      userInput: ctx.userInput
    };
  }
};

// koru-mvp/src/tools/money/advanced.ts
var priceHistory = {
  definition: defineTool(
    "price_history",
    "Muestra el hist\xF3rico de precios que Koru registr\xF3 para un producto (cuando el usuario lo anot\xF3 antes). \xDAsala cuando el usuario pregunte '\xBFc\xF3mo vari\xF3 el precio de X?', 'historial de precios de Y'. Lee records tipo 'shopping_item' o 'expense' que coincidan.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto a buscar en el hist\xF3rico." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee hist\xF3rico local de precios."),
  async run(args, ctx) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "price_history", status: "failed", error: "Indic\xE1 el producto." };
    const matches = (ctx.state.records ?? []).filter((r) => (r.kind === "shopping_item" || r.kind === "expense") && r.title.toLowerCase().includes(q) && typeof r.amount === "number").sort((a, b) => a.createdAt < b.createdAt ? -1 : 1).slice(-15).map((r) => ({ date: r.createdAt.slice(0, 10), title: r.title, amount: r.amount, currency: r.currency ?? "EUR" }));
    if (matches.length === 0) {
      return { type: "price_history", status: "ok", query: args.query, samples: [], note: "Todav\xEDa no registraste precios de ese producto. Empez\xE1 a anotarlos cuando los veas." };
    }
    const amounts = matches.map((m) => m.amount);
    const first = amounts[0] ?? 0;
    const last = amounts[amounts.length - 1] ?? 0;
    return {
      type: "price_history",
      status: "ok",
      query: args.query,
      samples: matches,
      first,
      last,
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      changePct: first > 0 ? Number(((last - first) / first * 100).toFixed(2)) : 0
    };
  }
};
var productReview = {
  definition: defineTool(
    "product_review",
    "Lee rese\xF1as de un producto en varias fuentes y sintetiza pros/contras reales. \xDAsala cuando el usuario diga '\xBFqu\xE9 opinan de X?', 'rese\xF1as de Y', 'vale la pena Z'. Cruza rese\xF1as de tiendas y foros.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Producto (ej: 'DJI Mini 4 Pro', 'GoPro Hero 12')." }
      },
      required: ["query"]
    }
  ),
  policy: policies.externalSideEffect("Lee rese\xF1as web del producto.", { autoRun: true, requiresApproval: false }),
  async run(args) {
    return {
      type: "product_review",
      status: "delegate",
      delegateTo: "web_search",
      query: `${args.query} rese\xF1as pros contras opiniones`,
      mode: "research",
      note: "Se enruta a web_search del motor, que scrapea y valida con structureExtractor."
    };
  }
};
var budgetCheck = {
  definition: defineTool(
    "budget_check",
    "Verifica cu\xE1nto del presupuesto mensual de una categor\xEDa ya se gast\xF3 y avisa si se acerca al l\xEDmite. \xDAsala cuando el usuario pregunte '\xBFcu\xE1nto me queda de presupuesto de comida?', 'c\xF3mo voy con el l\xEDmite de transporte'. Compara gastos del mes contra memorias tipo 'goal' de presupuesto.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string", description: "Categor\xEDa a verificar (ej: 'comida', 'transporte')." }
      },
      required: ["category"]
    }
  ),
  policy: policies.readonly("Compara gastos vs presupuesto guardado."),
  async run(args, ctx) {
    const category = String(args.category ?? "").trim().toLowerCase();
    if (!category) return { type: "budget_check", status: "failed", error: "Indic\xE1 categor\xEDa." };
    const budgetMemory = (ctx.state.memories ?? []).find(
      (m) => m.kind === "goal" && m.status === "confirmed" && m.text.toLowerCase().includes("presupuesto") && m.text.toLowerCase().includes(category)
    );
    if (!budgetMemory) {
      return { type: "budget_check", status: "ok", category, hasBudget: false, note: `No tengo presupuesto guardado para "${category}". Establecelo con budget_set.` };
    }
    const amountMatch = budgetMemory.text.match(/(\d+(?:[.,]\d+)?)/);
    const limit = amountMatch ? Number(amountMatch[1].replace(",", ".")) : 0;
    if (limit <= 0) {
      return { type: "budget_check", status: "ok", category, hasBudget: true, note: "Tengo un presupuesto guardado pero no pude leer el monto." };
    }
    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1e3;
    const spent = (ctx.state.records ?? []).filter((r) => {
      if (r.kind !== "expense" || typeof r.amount !== "number") return false;
      const created = new Date(r.createdAt).getTime();
      return Number.isFinite(created) && created >= now - monthMs && r.title.toLowerCase().includes(category);
    }).reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const pct = limit > 0 ? spent / limit * 100 : 0;
    const remaining = limit - spent;
    const status = pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";
    return {
      type: "budget_check",
      status: "ok",
      category,
      hasBudget: true,
      limit,
      spent: Number(spent.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      pctUsed: Number(pct.toFixed(1)),
      budgetStatus: status,
      note: status === "exceeded" ? `Te pasaste del presupuesto de ${category}.` : status === "warning" ? `Cerca del l\xEDmite de ${category}: ${pct.toFixed(0)}% usado.` : `Vas bien con ${category}: ${pct.toFixed(0)}% del presupuesto.`
    };
  }
};
var expenseByCategory = {
  definition: defineTool(
    "expense_by_category",
    "Desglosa los gastos del mes por categor\xEDa (comida, transporte, ocio, etc.) agrupando por tags o palabras del t\xEDtulo. \xDAsala cuando el usuario pregunte 'en qu\xE9 gasto m\xE1s?', 'desglose de gastos por tipo', 'c\xF3mo se reparten mis gastos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["week", "month"], default: "month" }
      },
      required: []
    }
  ),
  policy: policies.readonly("Analiza gastos guardados."),
  async run(args, ctx) {
    const period = String(args.period ?? "month");
    const days = period === "week" ? 7 : 30;
    const now = Date.now();
    const since = now - days * 24 * 60 * 60 * 1e3;
    const expenses = (ctx.state.records ?? []).filter((r) => {
      if (r.kind !== "expense" || typeof r.amount !== "number") return false;
      const created = new Date(r.createdAt).getTime();
      return Number.isFinite(created) && created >= since;
    });
    if (expenses.length === 0) {
      return { type: "expense_by_category", status: "ok", period, categories: [], note: "Sin gastos en el per\xEDodo." };
    }
    const categoryKeywords = {
      "Comida": ["comida", "super", "mercado", "almuerzo", "cena", "desayuno", "cafe", "restaurant", "heladera", "yerba", "leche", "pan"],
      "Transporte": ["transporte", "gasolina", "subte", "colectivo", "taxi", "uber", "tren", "nafta", "estacionamiento"],
      "Ocio": ["ocio", "cine", "streaming", "netflix", "spotify", "juego", "bar", "cerveza", "salida"],
      "Hogar": ["hogar", "alquiler", "luz", "agua", "gas", "internet", "limpieza", "detergente"],
      "Salud": ["salud", "farmacia", "medicamento", "medico", "dentista", "clinica"],
      "Otros": []
    };
    const totals = /* @__PURE__ */ new Map();
    for (const e of expenses) {
      const text = `${e.title} ${(e.tags ?? []).join(" ")}`.toLowerCase();
      let matched = "Otros";
      for (const [cat, kws] of Object.entries(categoryKeywords)) {
        if (kws.some((kw) => text.includes(kw))) {
          matched = cat;
          break;
        }
      }
      const cur = (e.currency ?? "EUR").toUpperCase();
      const key = `${matched}|${cur}`;
      const existing = totals.get(key) ?? { amount: 0, count: 0 };
      existing.amount += e.amount ?? 0;
      existing.count += 1;
      totals.set(key, existing);
    }
    const categories = Array.from(totals.entries()).map(([key, v]) => {
      const [category, currency] = key.split("|");
      return { category, currency, total: Number(v.amount.toFixed(2)), count: v.count };
    }).sort((a, b) => b.total - a.total);
    return { type: "expense_by_category", status: "ok", period, categories };
  }
};

// koru-mvp/src/tools/money/index.ts
var moneyTools = [
  currencyConvert,
  exchangeHistory,
  cryptoPrice,
  stockQuote,
  expenseTrack,
  expenseSummary,
  expenseAlert,
  budgetSet,
  subscriptionReminder,
  taxEstimate,
  inflationData,
  priceCompareProduct,
  priceHistory,
  productReview,
  budgetCheck,
  expenseByCategory
];

// koru-mvp/src/tools/sports/football.ts
var TSDB_KEY = "3";
var TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`;
var ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
var ESPN_LEAGUES = [
  // Selecciones nacionales (prioridad — la mayoría de queries son selecciones)
  { id: "fifa.world", name: "FIFA World Cup / International Friendlies" },
  { id: "uefa.euro", name: "UEFA Euro" },
  { id: "uefa.nations", name: "UEFA Nations League" },
  // Top 5 ligas de clubes
  { id: "eng.1", name: "Premier League" },
  { id: "esp.1", name: "La Liga" },
  { id: "ita.1", name: "Serie A" },
  { id: "ger.1", name: "Bundesliga" },
  { id: "uefa.champions", name: "Champions League" }
];
var NATIONAL_TEAM_SYNONYMS = [
  { canonical: "Spain", aliases: ["espa\xF1a", "espana", "seleccion espanola", "la roja", "spain"] },
  { canonical: "Argentina", aliases: ["argentina", "la albiceleste", "seleccion argentina"] },
  { canonical: "France", aliases: ["francia", "france", "les bleus", "seleccion francesa"] },
  { canonical: "Brazil", aliases: ["brasil", "brazil", "selecao", "verdeamarela", "seleccion brasilena"] },
  { canonical: "Germany", aliases: ["alemania", "germany", "mannschaft", "seleccion alemana"] },
  { canonical: "Italy", aliases: ["italia", "italy", "azzurri", "seleccion italiana"] },
  { canonical: "England", aliases: ["inglaterra", "england", "three lions", "seleccion inglesa"] },
  { canonical: "Netherlands", aliases: ["paises bajos", "holanda", "netherlands", "dutch", "oranje"] },
  { canonical: "Portugal", aliases: ["portugal", "selecao portuguesa", "seleccion portuguesa"] },
  { canonical: "Belgium", aliases: ["belgica", "belgium", "red devils", "seleccion belga"] },
  { canonical: "Uruguay", aliases: ["uruguay", "charruas", "celeste", "seleccion uruguaya"] },
  { canonical: "Colombia", aliases: ["colombia", "cafeteros", "seleccion colombiana"] },
  { canonical: "Chile", aliases: ["chile", "la roja chilena", "seleccion chilena"] },
  { canonical: "Mexico", aliases: ["mexico", "m\xE9xico", "el tri", "seleccion mexicana"] },
  { canonical: "Switzerland", aliases: ["suiza", "switzerland", "swiss", "nati"] },
  { canonical: "Croatia", aliases: ["croacia", "croatia", "vatreni"] },
  { canonical: "Norway", aliases: ["noruega", "norway"] }
];
function detectNationalTeam(queryLower) {
  for (const team of NATIONAL_TEAM_SYNONYMS) {
    for (const alias of team.aliases) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i");
      if (re.test(queryLower)) return team.canonical;
    }
  }
  return null;
}
function detectDatesToQuery(queryLower) {
  const dates = [];
  const now = /* @__PURE__ */ new Date();
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  if (/\bayer\b|\bd'?ayer\b|last match|último partido|ultimo partido/.test(queryLower)) {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    dates.push(fmt(y));
    const y2 = new Date(now.getTime() - 48 * 60 * 60 * 1e3);
    dates.push(fmt(y2));
  } else if (/\bhoy\b|\btoday\b|\ben vivo\b|\blive\b/.test(queryLower)) {
    dates.push(fmt(now));
  } else if (/\bmañana\b|\bmanana\b|\btomorrow\b/.test(queryLower)) {
    const t = new Date(now.getTime() + 24 * 60 * 60 * 1e3);
    dates.push(fmt(t));
  } else {
    dates.push(fmt(now));
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    dates.push(fmt(y));
    const y2 = new Date(now.getTime() - 48 * 60 * 60 * 1e3);
    dates.push(fmt(y2));
  }
  return [...new Set(dates)];
}
async function searchEspnScoreboards(query) {
  const queryLower = query.toLowerCase();
  const results = [];
  const datesToQuery = detectDatesToQuery(queryLower);
  const nationalTeam = detectNationalTeam(queryLower);
  const matchTerms = [queryLower];
  if (nationalTeam) matchTerms.push(nationalTeam.toLowerCase());
  const promises = [];
  for (const league of ESPN_LEAGUES) {
    for (const date of datesToQuery) {
      promises.push((async () => {
        try {
          const url = `${ESPN_BASE}/${league.id}/scoreboard?dates=${date}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
          if (!res.ok) return;
          const data = await res.json();
          const events = data.events ?? [];
          const matching = events.filter((e) => {
            const eventName = (e.name ?? "").toLowerCase();
            const comps = e.competitions ?? [];
            const teams = comps.flatMap((c) => (c.competitors ?? []).map((comp) => comp.team?.displayName?.toLowerCase() ?? ""));
            return matchTerms.some(
              (term) => eventName.includes(term) || teams.some((t) => t.includes(term))
            );
          });
          results.push(...matching);
        } catch {
        }
      })());
    }
  }
  await Promise.all(promises);
  const seen = /* @__PURE__ */ new Set();
  const deduped = results.filter((e) => {
    const comps = e.competitions ?? [];
    const comp = comps[0];
    const id = `${e.name ?? ""}-${comp?.date ?? e.date ?? ""}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return deduped;
}
function normalizeEspnEvent(e) {
  const comps = e.competitions ?? [];
  const comp = comps[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const status = e.status?.type?.description ?? e.status?.type?.detail ?? "?";
  return {
    id: `${home?.team?.displayName ?? "?"}-${away?.team?.displayName ?? "?"}-${comp?.date ?? ""}`,
    match: `${home?.team?.displayName ?? "?"} vs ${away?.team?.displayName ?? "?"}`,
    homeTeam: home?.team?.displayName,
    awayTeam: away?.team?.displayName,
    homeScore: home?.score != null ? Number(home.score) : void 0,
    awayScore: away?.score != null ? Number(away.score) : void 0,
    status,
    date: comp?.date ?? e.date,
    live: /in progress|live|halftime/i.test(status)
  };
}
function normalizeEvent(e) {
  const homeScore = e.intHomeScore != null && e.intHomeScore !== "" ? Number(e.intHomeScore) : void 0;
  const awayScore = e.intAwayScore != null && e.intAwayScore !== "" ? Number(e.intAwayScore) : void 0;
  const live = homeScore !== void 0 && awayScore !== void 0 && /progress|q[1-5]|ht|1h|2h|live|in play/i.test(e.strStatus ?? "");
  return {
    id: e.idEvent,
    match: `${e.strHomeTeam ?? "?"} vs ${e.strAwayTeam ?? "?"}`,
    homeTeam: e.strHomeTeam,
    awayTeam: e.strAwayTeam,
    homeScore,
    awayScore,
    status: e.strStatus ?? (live ? "en juego" : homeScore !== void 0 ? "finalizado" : "programado"),
    league: e.strLeague,
    sport: e.strSport,
    date: e.dateEvent,
    time: e.strTime,
    live
  };
}
var matchLive = {
  definition: defineTool(
    "match_live",
    "Obt\xE9n el marcador en vivo o resultado FINAL de un partido. \xDAsala SIEMPRE que el usuario pregunte por un resultado deportivo (f\xFAtbol): '\xBFc\xF3mo sali\xF3 Espa\xF1a ayer?', '\xBFc\xF3mo le fue a Boca?', '\xBFva ganando el Madrid?', 'resultado de Barcelona', 'qui\xE9n gan\xF3 Argentina'. Devuelve equipos, marcador, minuto/estado, liga, fecha. Cubre selecciones nacionales (Espa\xF1a, Argentina, Francia, etc) y clubes de las principales ligas. NUNCA uses web_search para resultados de partidos \u2014 esta tool tiene datos exactos en tiempo real desde ESPN.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Equipo, selecci\xF3n o partido (ej: 'Espa\xF1a', 'Argentina', 'Boca River', 'Real Madrid', 'Champions'). Si el usuario menciona 'ayer', 'hoy' o 'ma\xF1ana', inclu\xED esa palabra." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee resultados deportivos de ESPN y TheSportsDB."),
  async run(args) {
    const query = String(args.query ?? args.__userInput ?? "").trim();
    if (!query) return { type: "match_live", status: "failed", error: "Indic\xE1 el partido." };
    const espnEvents = await searchEspnScoreboards(query);
    if (espnEvents.length > 0) {
      const matches = espnEvents.slice(0, 5).map(normalizeEspnEvent);
      return {
        type: "match_live",
        status: "ok",
        query,
        matches,
        source: "ESPN",
        sourceUrl: "https://www.espn.com/soccer/",
        text: matches.map((m) => `${m.homeTeam} ${m.homeScore ?? "?"} - ${m.awayScore ?? "?"} ${m.awayTeam} (${m.status})`).join("; ")
      };
    }
    const cacheKey = `match_live:${query.toLowerCase()}`;
    const events = await cached(cacheKey, ttls.sportsLive, async () => {
      const result = await fetchJson(
        `${TSDB_BASE}/searchevents.php?e=${encodeURIComponent(query)}`,
        { timeoutMs: 9e3 }
      );
      if (!result.ok) throw new Error(result.error);
      return result.data.events ?? [];
    });
    if (events.length > 0) {
      return {
        type: "match_live",
        status: "ok",
        query,
        matches: events.slice(0, 5).map(normalizeEvent),
        source: "TheSportsDB",
        sourceUrl: "https://www.thesportsdb.com/"
      };
    }
    try {
      const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${query} football team`)}&format=json&origin=*&srlimit=1`, { signal: AbortSignal.timeout(9e3) });
      const wikiData = await wikiRes.json();
      const results = wikiData.query?.search ?? [];
      if (results.length > 0) {
        const title = results[0].title;
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(9e3) });
        const summary = await summaryRes.json();
        return {
          type: "match_live",
          // 🔴 FIX: status "no_data" (no "ok") cuando no hay partidos reales.
          // El backend usa esto para bloquear alucinaciones del LLM.
          status: "no_data",
          query,
          matches: [],
          text: `No encontr\xE9 partidos recientes de "${query}" en ESPN ni TheSportsDB. La temporada puede estar en receso. Ac\xE1 va info general de Wikipedia sobre el equipo.`,
          wikipediaExtract: summary.extract,
          sources: [{ title, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }],
          source: "Wikipedia"
        };
      }
    } catch {
    }
    return {
      type: "match_live",
      status: "no_data",
      query,
      matches: [],
      note: `No encontr\xE9 partidos de "${query}" en este momento. La temporada puede estar en receso.`
    };
  }
};
var leagueStandings = {
  definition: defineTool(
    "league_standings",
    "Muestra la tabla de posiciones de una liga o campeonato. \xDAsala cuando el usuario pregunte 'tabla de la Liga', 'posiciones de la Premier', ' standings NBA Este'. Devuelve equipos ordenados con PJ, PTS, GF, GC.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        league: { type: "string", description: "Liga (ej: 'Spanish La Liga', 'English Premier League', 'NBA')." },
        season: { type: "string", description: "Temporada (ej: '2025-2026'). Default actual." }
      },
      required: ["league"]
    }
  ),
  policy: policies.readonly("Lee tabla de posiciones p\xFAblica."),
  async run(args) {
    const league = String(args.league ?? "").trim();
    if (!league) return { type: "league_standings", status: "failed", error: "Indic\xE1 la liga." };
    const cacheKey = `league_search:${league.toLowerCase()}`;
    const leagues = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(
        `${TSDB_BASE}/search_all_leagues.php?l=${encodeURIComponent(league)}`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.leagues ?? [];
    });
    if (leagues.length === 0) {
      return { type: "league_standings", status: "ok", league, standings: [], note: `No encontr\xE9 la liga "${league}".` };
    }
    const leagueId = leagues[0].idLeague;
    const season = String(args.season ?? "2025-2026");
    const standingsKey = `standings:${leagueId}:${season}`;
    const table = await cached(standingsKey, ttls.sportsStandings, async () => {
      const r = await fetchJson(
        `${TSDB_BASE}/lookuptable.php?l=${leagueId}&s=${encodeURIComponent(season)}`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.table ?? [];
    });
    if (table.length === 0) {
      return { type: "league_standings", status: "ok", league: leagues[0].strLeague, season, standings: [], note: "Sin tabla para esa temporada." };
    }
    return {
      type: "league_standings",
      status: "ok",
      league: leagues[0].strLeague,
      season,
      standings: table.slice(0, 20).map((row) => ({
        rank: Number(row.intRank ?? 0),
        team: row.strTeam,
        played: Number(row.intPlayed ?? 0),
        points: Number(row.intPoints ?? 0),
        goalsFor: Number(row.intGoalsFor ?? 0),
        goalsAgainst: Number(row.intGoalsAgainst ?? 0),
        form: row.strForm
      })),
      source: "TheSportsDB"
    };
  }
};
var matchSchedule = {
  definition: defineTool(
    "match_schedule",
    "Lista los pr\xF3ximos partidos (fixture) de un equipo o liga con fecha, rival y hora. \xDAsala cuando el usuario pregunte 'pr\xF3ximos partidos de Boca', 'cu\xE1ndo juega Messi', 'fixture de la Champions'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        team: { type: "string", description: "Equipo (ej: 'Boca Juniors', 'Real Madrid')." },
        league: { type: "string", description: "Liga (alternativa a team)." },
        next: { type: "number", description: "Cantidad de pr\xF3ximos partidos. Default 5." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee fixture deportivo p\xFAblico."),
  async run(args) {
    const team = String(args.team ?? "").trim();
    const league = String(args.league ?? "").trim();
    const next = Number(args.next ?? 5);
    if (!team && !league) return { type: "match_schedule", status: "failed", error: "Indic\xE1 equipo o liga." };
    let events = [];
    if (team) {
      const cacheKey = `team_next:${team.toLowerCase()}`;
      events = await cached(cacheKey, ttls.sportsStandings, async () => {
        const r = await fetchJson(
          `${TSDB_BASE}/searchevents.php?e=${encodeURIComponent(team)}`,
          { timeoutMs: 9e3 }
        );
        if (!r.ok) throw new Error(r.error);
        return r.data.events ?? [];
      });
    }
    if (events.length === 0 && league) {
      const cacheKey = `league_search:${league.toLowerCase()}`;
      const leagues = await cached(cacheKey, ttls.reference, async () => {
        const r = await fetchJson(
          `${TSDB_BASE}/search_all_leagues.php?l=${encodeURIComponent(league)}`,
          { timeoutMs: 9e3 }
        );
        if (!r.ok) throw new Error(r.error);
        return r.data.leagues ?? [];
      });
      const leagueId = leagues[0]?.idLeague;
      if (leagueId) {
        const nextKey = `league_next:${leagueId}`;
        events = await cached(nextKey, ttls.sportsStandings, async () => {
          const r = await fetchJson(
            `${TSDB_BASE}/eventsnextleague.php?id=${leagueId}`,
            { timeoutMs: 9e3 }
          );
          if (!r.ok) throw new Error(r.error);
          return r.data.events ?? [];
        });
      }
    }
    const now = Date.now();
    const upcoming = events.filter((e) => e.strTimestamp && new Date(e.strTimestamp).getTime() >= now - 3 * 60 * 60 * 1e3).sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1).slice(0, next);
    if (upcoming.length === 0) {
      const popularLeagues = [
        { id: "4328", name: "English Premier League" },
        { id: "4335", name: "Spanish La Liga" },
        { id: "4332", name: "Italian Serie A" },
        { id: "4331", name: "German Bundesliga" },
        { id: "4406", name: "Argentine Primera Divisi\xF3n" },
        { id: "4480", name: "UEFA Champions League" }
      ];
      const all = [];
      for (const pop of popularLeagues) {
        const r = await fetchJson(
          `${TSDB_BASE}/eventsnextleague.php?id=${pop.id}`,
          { timeoutMs: 15e3 }
        );
        if (r.ok && r.data?.events) {
          const evs = r.data.events.filter((e) => e.strTimestamp && new Date(e.strTimestamp).getTime() >= now - 3 * 60 * 60 * 1e3).sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1).slice(0, 3);
          all.push(...evs);
        }
      }
      const fallbackUpcoming = all.sort((a, b) => (a.strTimestamp ?? "") > (b.strTimestamp ?? "") ? 1 : -1).slice(0, next);
      if (fallbackUpcoming.length === 0) {
        return { type: "match_schedule", status: "ok", team: team || league, matches: [], note: "No encontr\xE9 pr\xF3ximos partidos." };
      }
      return {
        type: "match_schedule",
        status: "ok",
        team: team || league,
        matches: fallbackUpcoming.map(normalizeEvent),
        source: "TheSportsDB (liga popular)",
        note: `Pr\xF3ximos partidos de ligas destacadas.`
      };
    }
    return {
      type: "match_schedule",
      status: "ok",
      team: team || league,
      matches: upcoming.map(normalizeEvent),
      source: "TheSportsDB"
    };
  }
};
var teamFollow = {
  definition: defineTool(
    "team_follow",
    "Guarda un equipo como favorito para que Koru te avise cuando juegue o termine el partido. \xDAsala cuando el usuario diga 'segu\xED a Boca', 's\xE9gal a Real Madrid', 'avisame cuando juegue Nadal'. Crea una memory tipo 'interest'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        team: { type: "string", description: "Equipo o deportista a seguir (ej: 'Boca Juniors', 'Nadal')." },
        sport: { type: "string", description: "Deporte (ej: 'f\xFAtbol', 'tenis')." }
      },
      required: ["team"]
    }
  ),
  policy: policies.localWrite("Guarda equipo favorito como memory."),
  async run(args) {
    const team = String(args.team ?? "").trim();
    const sport = String(args.sport ?? "f\xFAtbol").trim();
    if (!team) return { type: "team_follow", status: "failed", error: "Indic\xE1 el equipo." };
    return {
      type: "team_follow",
      status: "ok",
      team,
      sport,
      memoryCandidates: [{
        kind: "interest",
        text: `Sigue a ${team} (${sport})`,
        confidence: 0.95,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: team,
        useForSuggestions: true
      }]
    };
  }
};

// koru-mvp/src/tools/sports/multi.ts
var ESPN_BASE2 = "https://site.api.espn.com/apis/site/v2/sports";
var playerStats = {
  definition: defineTool(
    "player_stats",
    "Obt\xE9n estad\xEDsticas de un deportista (goles, edad, equipo, t\xEDtulos). \xDAsala cuando el usuario pregunte 'cu\xE1ntos goles tiene Mbapp\xE9', 'edad de LeBron', 'estad\xEDsticas de Messi'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del deportista." },
        sport: { type: "string", enum: ["football", "basketball", "tennis", "golf", "f1"], default: "football" }
      },
      required: ["name"]
    }
  ),
  policy: policies.readonly("Busca stats en Wikipedia."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "player_stats", status: "failed", error: "Indic\xE1 el nombre." };
    try {
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} deportista`)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3) });
      const data = await res.json();
      const results = data.query?.search ?? [];
      if (results.length === 0) return { type: "player_stats", status: "ok", name, note: `No encontr\xE9 stats de ${name}.` };
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9e3) });
      const summary = await summaryRes.json();
      return {
        type: "player_stats",
        status: "ok",
        name,
        text: summary.extract ?? `Encontr\xE9 informaci\xF3n sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }]
      };
    } catch (err) {
      console.warn("[Koru] player_stats Wikipedia failed:", err instanceof Error ? err.message : err);
      return { type: "player_stats", status: "failed", error: `No pude buscar stats de ${name}.` };
    }
  }
};
var tournamentBracket = {
  definition: defineTool(
    "tournament_bracket",
    "Muestra la llave/eliminatoria de un torneo (Champions, Wimbledon, World Cup). \xDAsala cuando el usuario pregunte 'llave de la Champions', 'cuadro de Roland Garros'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tournament: { type: "string", description: "Torneo (ej: 'Champions League', 'Wimbledon', 'World Cup')." },
        sport: { type: "string", enum: ["soccer", "tennis", "basketball"], default: "soccer" }
      },
      required: ["tournament"]
    }
  ),
  policy: policies.readonly("Busca llave de torneo en Wikipedia."),
  async run(args) {
    const tournament = String(args.tournament ?? "").trim();
    if (!tournament) return { type: "tournament_bracket", status: "failed", error: "Indic\xE1 el torneo." };
    try {
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${tournament} torneo 2025`)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3) });
      const data = await res.json();
      const results = data.query?.search ?? [];
      if (results.length === 0) return { type: "tournament_bracket", status: "ok", tournament, note: `No encontr\xE9 la llave de ${tournament}.` };
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9e3) });
      const summary = await summaryRes.json();
      return {
        type: "tournament_bracket",
        status: "ok",
        tournament,
        text: summary.extract ?? `Encontr\xE9 informaci\xF3n sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }]
      };
    } catch (err) {
      console.warn("[Koru] tournament_bracket Wikipedia failed:", err instanceof Error ? err.message : err);
      return { type: "tournament_bracket", status: "failed", error: `No pude buscar la llave de ${tournament}.` };
    }
  }
};
var sportsNews = {
  definition: defineTool(
    "sports_news",
    "Noticias deportivas filtradas por deporte o equipo. \xDAsala cuando el usuario pregunte 'noticias del Bar\xE7a', 'qu\xE9 pas\xF3 en la F1', 'titulares de tenis'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema/equipo/deporte (ej: 'Barcelona', 'F1', 'tenis')." }
      },
      required: ["topic"]
    }
  ),
  policy: policies.readonly("Lee noticias deportivas de GDELT."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "sports_news", status: "failed", error: "Indic\xE1 tema." };
    try {
      const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      url.searchParams.set("query", `${topic} sport`);
      url.searchParams.set("mode", "ArtList");
      url.searchParams.set("maxrecords", "10");
      url.searchParams.set("sort", "DateDesc");
      url.searchParams.set("format", "json");
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(9e3) });
      const data = await res.json();
      const articles = (data.articles ?? []).slice(0, 5).map((a) => ({ title: a.title ?? "Sin t\xEDtulo", url: a.url ?? "", domain: a.domain ?? "", snippet: a.seendate ?? "" }));
      if (articles.length === 0) return { type: "sports_news", status: "ok", topic, note: `No encontr\xE9 noticias deportivas sobre ${topic}.` };
      return { type: "sports_news", status: "ok", topic, articles, source: "GDELT" };
    } catch (err) {
      console.warn("[Koru] sports_news GDELT failed:", err instanceof Error ? err.message : err);
      return { type: "sports_news", status: "failed", error: `No pude buscar noticias de ${topic}.` };
    }
  }
};
var golfLeaderboard = {
  definition: defineTool(
    "golf_leaderboard",
    "Tabla de posiciones de un torneo de golf en vivo con score par/under. \xDAsala cuando el usuario pregunte 'c\xF3mo va el Masters', 'posici\xF3n de Tiger hoy', 'leaderboard del PGA'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tournament: { type: "string", description: "Torneo (ej: 'Masters', 'PGA Championship', 'Open Championship')." }
      },
      required: ["tournament"]
    }
  ),
  policy: policies.readonly("Lee leaderboard de golf."),
  async run(args) {
    const tournament = String(args.tournament ?? "").trim();
    if (!tournament) return { type: "golf_leaderboard", status: "failed", error: "Indic\xE1 el torneo." };
    const cacheKey = `golf:${tournament.toLowerCase()}`;
    const data = await cached(cacheKey, ttls.sportsLive, async () => {
      await limiters.gdelt.acquire();
      const r = await fetchJson(
        `${ESPN_BASE2}/golf/pga/scoreboard`,
        { timeoutMs: 15e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    const leaders = (data.leaders ?? []).slice(0, 10).map((l) => ({
      player: l.name,
      score: l.score,
      thru: l.thru
    }));
    if (leaders.length === 0) {
      return { type: "golf_leaderboard", status: "ok", tournament, leaders: [], note: "No hay torneo en vivo ahora mismo." };
    }
    return { type: "golf_leaderboard", status: "ok", tournament, leaders, source: "ESPN", sourceUrl: "https://www.espn.com/golf/leaderboard" };
  }
};
var tennisAtpWta = {
  definition: defineTool(
    "tennis_atp_wta",
    "Ranking ATP/WTA actual y resultados de la semana. \xDAsala cuando el usuario pregunte 'top 10 ATP', 'ranking WTA', 'qui\xE9n gan\xF3 Alcaraz-Sinner'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tour: { type: "string", enum: ["atp", "wta"], default: "atp" }
      },
      required: []
    }
  ),
  policy: policies.readonly("Busca ranking de tenis en Wikipedia."),
  async run(args) {
    const tour = String(args.tour ?? "atp").toLowerCase();
    try {
      const searchQuery = tour === "wta" ? "WTA Tour rankings tennis" : "ATP Tour rankings tennis";
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3) });
      const data = await res.json();
      const results = data.query?.search ?? [];
      if (results.length === 0) return { type: "tennis_atp_wta", status: "ok", tour, note: `No encontr\xE9 ranking ${tour.toUpperCase()}.` };
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9e3) });
      const summary = await summaryRes.json();
      return {
        type: "tennis_atp_wta",
        status: "ok",
        tour,
        text: summary.extract ?? `Encontr\xE9 informaci\xF3n sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }]
      };
    } catch (err) {
      console.warn("[Koru] tennis_atp_wta Wikipedia failed:", err instanceof Error ? err.message : err);
      return { type: "tennis_atp_wta", status: "failed", error: `No pude buscar ranking ${tour.toUpperCase()}.` };
    }
  }
};
var f1Results = {
  definition: defineTool(
    "f1_results",
    "Resultado o clasificaci\xF3n de la \xFAltima carrera de F1 (ganador, podio, pole). \xDAsala cuando el usuario pregunte 'resultado de M\xF3naco', 'pole de Verstappen', 'c\xF3mo termin\xF3 la carrera'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        season: { type: "string", default: "2025" },
        round: { type: "string", description: "N\xFAmero de carrera. Default \xFAltima." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee resultados F1."),
  async run(args) {
    const season = String(args.season ?? "2025");
    const cacheKey = `f1:${season}:last`;
    const data = await cached(cacheKey, ttls.sportsStandings, async () => {
      const r = await fetchJson(
        `https://ergast.com/api/f1/current/last/results.json`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    const races = data.MRData?.RaceTable?.Races ?? [];
    if (races.length === 0) {
      return { type: "f1_results", status: "ok", season, results: [], note: "Sin datos de F1." };
    }
    const race = races[0];
    const results = (race.Results ?? []).slice(0, 10).map((r) => ({
      position: Number(r.position ?? 0),
      driver: `${r.Driver?.givenName ?? ""} ${r.Driver?.familyName ?? ""}`.trim(),
      constructor: r.Constructor?.name,
      time: r.Time?.time,
      grid: Number(r.grid ?? 0),
      points: Number(r.points ?? 0)
    }));
    return {
      type: "f1_results",
      status: "ok",
      season,
      raceName: race.raceName,
      date: race.date,
      results,
      source: "Ergast API",
      sourceUrl: "https://ergast.com/motor-racing/"
    };
  }
};

// koru-mvp/src/tools/sports/index.ts
var sportsTools = [
  matchLive,
  leagueStandings,
  matchSchedule,
  teamFollow,
  playerStats,
  tournamentBracket,
  sportsNews,
  golfLeaderboard,
  tennisAtpWta,
  f1Results
];

// koru-mvp/src/tools/shared/scrapers.ts
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
async function searchDuckDuckGo(query, max = 6) {
  await limiters.duckduckgo.acquire();
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const result = await fetchText(url, {
    headers: { Accept: "text/html" },
    timeoutMs: 12e3
  });
  if (!result.ok) return [];
  const sources = [];
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = resultRe.exec(result.text)) && sources.length < max) {
    let linkUrl = match[1];
    try {
      const parsed = new URL(linkUrl, "https://duckduckgo.com");
      linkUrl = parsed.searchParams.get("uddg") ?? parsed.href;
    } catch {
    }
    if (!/^https?:\/\//i.test(linkUrl)) continue;
    const domain = domainFromUrl(linkUrl);
    if (/duckduckgo\.com|google\.com|bing\.com/i.test(domain)) continue;
    sources.push({
      title: htmlToText(match[2]),
      url: linkUrl,
      domain,
      snippet: truncate(htmlToText(match[3]), 280)
    });
  }
  return sources;
}
async function fetchPageContent(url, maxChars = 1500) {
  const result = await fetchText(url, {
    headers: { Accept: "text/html" },
    timeoutMs: 9e3
  });
  if (!result.ok) return "";
  const html = result.text;
  let body = html;
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) {
    body = article[1];
  } else {
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (main) body = main[1];
  }
  if (body === html) {
    const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => m[1].replace(/<[^>]+>/g, " ").trim()).filter((t) => t.length > 60);
    if (paragraphs.length) body = paragraphs.slice(0, 6).join(" ");
  }
  return truncate(htmlToText(body ?? ""), maxChars);
}
function usableSources(sources) {
  const seen = /* @__PURE__ */ new Set();
  return sources.filter((s) => {
    if (!s.url || !/^https?:\/\//i.test(s.url)) return false;
    if (/duckduckgo\.com|google\.com|bing\.com/i.test(s.domain)) return false;
    if (!s.title || s.title.length < 3) return false;
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
async function searchAndEnrich(query, max = 5) {
  const base = await searchDuckDuckGo(query, max);
  const enriched = await Promise.all(
    base.slice(0, 3).map(async (source) => {
      const content = await fetchPageContent(source.url, 1500).catch(() => "");
      return content ? { ...source, content } : source;
    })
  );
  return usableSources(enriched);
}

// koru-mvp/src/tools/shared/extractor.ts
async function validateWithCitations(userInput, sources, chatFn) {
  return extractStructuredData({ userInput, sources, chatFn });
}
function extractionToDataCard(extracted) {
  if (!extracted || extracted.items.length === 0) return null;
  return {
    type: "data_card",
    title: extracted.title,
    items: extracted.items.map((it) => ({
      label: it.label,
      value: it.value,
      detail: it.detail,
      quote: it.quote,
      sourceUrl: it.sourceUrl,
      sourceDomain: it.sourceDomain
    }))
  };
}

// koru-mvp/src/tools/food/restaurants.ts
var restaurantDeepSearch = {
  definition: defineTool(
    "restaurant_deep_search",
    "Busca un lugar para comer cruzando rese\xF1as de varias fuentes (Google, Yelp, TripAdvisor, peri\xF3dicos gastron\xF3micos) y sintetiza un veredicto honesto destacando en qu\xE9 coinciden las fuentes. \xDAsala cuando el usuario diga 'buena parrilla en Palermo', 'd\xF3nde como sushi en Madrid centro', 'mejor paella de Valencia', 'restaurante italiano rom\xE1ntico'. Esta es la killer feature de Koru: no busca en Google, LEE varias rese\xF1as y dice d\xF3nde coinciden.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tipo de comida y zona (ej: 'parrilla en Palermo', 'sushi en Madrid centro')." },
        mood: { type: "string", description: "Contexto opcional (ej: 'rom\xE1ntico', 'familiar', 'barato')." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee rese\xF1as p\xFAblicas de restaurantes."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    const mood = String(args.mood ?? "").trim();
    if (!query) return { type: "restaurant_deep_search", status: "failed", error: "Indic\xE1 qu\xE9 y d\xF3nde." };
    const queries = [
      `${query} ${mood} mejor restaurante rese\xF1as`,
      `${query} recomendado gu\xEDa gastron\xF3mica`,
      `${query} cr\xEDtica restaurante peri\xF3dico`
    ];
    const allSources = await Promise.all(queries.map((q) => searchAndEnrich(q, 4)));
    const sources = usableSources(allSources.flat()).slice(0, 8);
    const sourceCount = sources.length;
    if (sourceCount === 0) {
      return {
        type: "restaurant_deep_search",
        status: "partial",
        query,
        mood,
        matches: [],
        pros: [],
        cons: [],
        sources: [],
        note: "No pude conseguir rese\xF1as \xFAtiles con los conectores abiertos. No invento recomendaciones."
      };
    }
    let matches = [];
    let pros = [];
    let cons = [];
    let synthesis;
    if (ctx.chatFn) {
      try {
        const prompt = [
          `Sos el sintetizador de rese\xF1as de Koru. Analiz\xE1 las siguientes fuentes sobre "${query}${mood ? ` (contexto: ${mood})` : ""}".`,
          `Devolv\xE9 SOLO JSON v\xE1lido con esta forma exacta:`,
          `{"matches":[{"name":"Nombre del lugar","sourcesMentioning":N,"quote":"frase corta de una fuente que lo respalda"}],"pros":["punto a favor 1","punto a favor 2"],"cons":["a considerar 1","a considerar 2"],"synthesis":"frase de s\xEDntesis honesta"}`,
          `Reglas:`,
          `- "matches": hasta 3 lugares m\xE1s mencionados, ordenados por sourcesMentioning desc.`,
          `- "sourcesMentioning": cu\xE1ntas de las ${sourceCount} fuentes mencionan ese lugar (entero, m\xE1ximo ${sourceCount}).`,
          `- "quote": frase literal corta (m\xE1x 80 chars) que aparezca en alguna fuente.`,
          `- "pros"/"cons": del lugar #1, m\xE1ximo 3 cada uno, en infinitivo.`,
          `- "synthesis": 1-2 oraciones honestas sobre el cruce de fuentes.`,
          `- NO inventes datos que no est\xE9n respaldados por las fuentes.`,
          ``,
          `FUENTES:`,
          ...sources.map((s, i) => `[${i + 1}] ${s.title} (${s.domain})
${s.snippet ?? s.content ?? ""}`)
        ].join("\n");
        const result = await ctx.chatFn(
          [{ role: "system", content: "Sos un asistente que sintetiza rese\xF1as gastron\xF3micas. Devolv\xE9s solo JSON." }, { role: "user", content: prompt }],
          { temperature: 0.2, maxTokens: 800 }
        );
        const jsonText = result.content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed.matches)) {
          matches = parsed.matches.slice(0, 3).map((m) => ({
            name: String(m.name ?? "").trim(),
            sourcesMentioning: Math.max(0, Math.min(sourceCount, Number(m.sourcesMentioning ?? 0))),
            quote: m.quote ? String(m.quote).slice(0, 120) : void 0
          })).filter((m) => m.name.length > 1);
        }
        if (Array.isArray(parsed.pros)) pros = parsed.pros.map((p) => String(p).trim()).filter(Boolean).slice(0, 3);
        if (Array.isArray(parsed.cons)) cons = parsed.cons.map((c) => String(c).trim()).filter(Boolean).slice(0, 3);
        if (typeof parsed.synthesis === "string") synthesis = parsed.synthesis.trim().slice(0, 300);
      } catch {
      }
    }
    if (matches.length === 0 && sourceCount >= 2) {
      const nameCount = /* @__PURE__ */ new Map();
      for (const s of sources) {
        const text = `${s.title} ${s.snippet ?? ""} ${s.content ?? ""}`;
        const candidates = text.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de|del|la|el)\s+|\s+)[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/g) ?? [];
        for (const c of candidates) {
          const lower = c.toLowerCase();
          if (/restaurante|bar|cafe|parrilla|sushi|trattoria|bistró|bistro|comida|gastronom/.test(lower)) continue;
          nameCount.set(c, (nameCount.get(c) ?? 0) + 1);
        }
      }
      matches = Array.from(nameCount.entries()).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, sourcesMentioning: Math.min(sourceCount, n) }));
    }
    const topScore = matches.length > 0 ? `${matches[0].sourcesMentioning}/${sourceCount}` : void 0;
    const status = sourceCount >= 3 && matches.length >= 1 ? "ok" : "partial";
    const note = status === "partial" ? `Solo cruc\xE9 ${sourceCount} fuente(s). Para una recomendaci\xF3n confiable prob\xE1 especificar barrio o tipo de cocina. No invento.` : `Cruzadas ${sourceCount} fuentes. Cada coincidencia respaldada por cita.`;
    const deferredDataCard = Promise.resolve({
      type: "restaurant_synthesis",
      status,
      query,
      mood,
      matches,
      topScore,
      pros,
      cons,
      synthesis,
      sources,
      note,
      labels: {
        cardTitle: "DeepHungry Synthesis",
        badge: "Alta Precisi\xF3n",
        top3Label: "Top 3 Seleccionados",
        topPickLabel: "RECOMENDACI\xD3N #1",
        prosLabel: "Puntos a favor",
        consLabel: "A considerar",
        chefLabel: "Recomendaci\xF3n del Chef",
        reserveAction: "Reservar",
        menuAction: "Men\xFA"
      }
    });
    return {
      type: "restaurant_deep_search",
      status,
      query,
      mood,
      matches,
      topScore,
      pros,
      cons,
      synthesis,
      sources,
      note,
      deferredDataCard
    };
  }
};
var restaurantReviewAggregate = {
  definition: defineTool(
    "restaurant_review_aggregate",
    "Dado un restaurante concreto, lee sus rese\xF1as en varias plataformas y resume pros/contras reales. \xDAsala cuando el usuario diga 'qu\xE9 dicen de Don Julio', 'resum\xED las rese\xF1as de El Cellercan', 'pros y contras de X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        restaurant: { type: "string", description: "Nombre del restaurante." },
        city: { type: "string", description: "Ciudad (para desambiguar)." }
      },
      required: ["restaurant"]
    }
  ),
  policy: policies.readonly("Lee rese\xF1as p\xFAblicas."),
  async run(args, ctx) {
    const restaurant = String(args.restaurant ?? "").trim();
    const city = String(args.city ?? "").trim();
    if (!restaurant) return { type: "restaurant_review_aggregate", status: "failed", error: "Indic\xE1 el restaurante." };
    const query = `${restaurant} ${city} rese\xF1a opini\xF3n pros contras`.trim();
    const sources = await searchAndEnrich(query, 5);
    const usable = usableSources(sources);
    let dataCard = null;
    if (ctx.chatFn && usable.length > 0) {
      try {
        const extraction = await validateWithCitations(`rese\xF1as de ${restaurant} ${city}`, usable, ctx.chatFn);
        dataCard = extractionToDataCard(extraction);
      } catch {
      }
    }
    return {
      type: "restaurant_review_aggregate",
      status: "ok",
      restaurant,
      city,
      sources: usable,
      dataCard
    };
  }
};
var menuExtract = {
  definition: defineTool(
    "menu_extract",
    "Extrae el men\xFA de la web de un restaurante. \xDAsala cuando el usuario diga 'mostrame el men\xFA de X', 'tienen opciones veganas?', 'qu\xE9 platos tiene Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        restaurant: { type: "string", description: "Nombre del restaurante." },
        city: { type: "string" }
      },
      required: ["restaurant"]
    }
  ),
  policy: policies.readonly("Lee men\xFA p\xFAblico."),
  async run(args) {
    const restaurant = String(args.restaurant ?? "").trim();
    const city = String(args.city ?? "").trim();
    if (!restaurant) return { type: "menu_extract", status: "failed", error: "Indic\xE1 el restaurante." };
    const sources = await searchAndEnrich(`${restaurant} ${city} men\xFA carta precios`, 4);
    return {
      type: "menu_extract",
      status: "ok",
      restaurant,
      city,
      sources: usableSources(sources),
      note: "Fuentes con el men\xFA. Revisa el sitio oficial del restaurante para precios actualizados."
    };
  }
};

// koru-mvp/src/tools/food/recipes.ts
var MEALDB_KEY = "1";
var MEALDB_BASE = `https://www.themealdb.com/api/json/v1/${MEALDB_KEY}`;
function extractIngredients(meal) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const meas = meal[`strMeasure${i}`];
    if (typeof ing === "string" && ing.trim()) {
      out.push({ ingredient: ing.trim(), measure: typeof meas === "string" ? meas.trim() : "" });
    }
  }
  return out;
}
var recipeFind = {
  definition: defineTool(
    "recipe_find",
    "Busca recetas por nombre, tipo de cocina o categor\xEDa. \xDAsala cuando el usuario diga 'receta de carbonara', 'algo con pollo', 'postre sin horno', 'plato italiano'. Devuelve ingredientes y pasos.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Nombre de plato o categor\xEDa (ej: 'carbonara', 'arrabiata', 'Seafood')." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee recetas p\xFAblicas."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "recipe_find", status: "failed", error: "Indic\xE1 qu\xE9 receta." };
    const cacheKey = `recipe:${query.toLowerCase()}`;
    const meals = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(
        `${MEALDB_BASE}/search.php?s=${encodeURIComponent(query)}`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.meals ?? [];
    });
    if (meals.length === 0) {
      return { type: "recipe_find", status: "no_data", query, recipes: [], note: `No encontr\xE9 recetas para "${query}" en TheMealDB.` };
    }
    return {
      type: "recipe_find",
      status: "ok",
      query,
      recipes: meals.slice(0, 5).map((m) => ({
        name: m.strMeal,
        category: m.strCategory,
        area: m.strArea,
        ingredients: extractIngredients(m),
        instructions: m.strInstructions,
        thumbnail: m.strMealThumb,
        videoUrl: m.strYoutube
      })),
      source: "TheMealDB",
      sourceUrl: "https://www.themealdb.com/"
    };
  }
};
var recipeByIngredients = {
  definition: defineTool(
    "recipe_by_ingredients",
    "Busca recetas que puedas hacer con los ingredientes que ya tienes. \xDAsala cuando el usuario diga 'tengo huevos, pan y queso', 'con zanahoria y arn\xE9s', 'qu\xE9 cocino con lo que tengo en heladera'. Reduce desperdicio.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        ingredients: { type: "array", items: { type: "string" }, description: "Lista de ingredientes disponibles." }
      },
      required: ["ingredients"]
    }
  ),
  policy: policies.readonly("Busca recetas por ingredientes."),
  async run(args) {
    const list = Array.isArray(args.ingredients) ? args.ingredients.map(String).filter(Boolean) : [];
    if (list.length === 0) return { type: "recipe_by_ingredients", status: "failed", error: "Indic\xE1 los ingredientes." };
    const main = list[0];
    const cacheKey = `recipe_ing:${main.toLowerCase()}`;
    const meals = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(
        `${MEALDB_BASE}/filter.php?i=${encodeURIComponent(main)}`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.meals ?? [];
    });
    return {
      type: "recipe_by_ingredients",
      status: "ok",
      ingredients: list,
      recipes: meals.slice(0, 8).map((m) => ({ name: m.strMeal, thumbnail: m.strMealThumb })),
      note: `Recetas con "${main}". Revisa que tengas los dem\xE1s ingredientes.`,
      source: "TheMealDB"
    };
  }
};
var recipeSave = {
  definition: defineTool(
    "recipe_save",
    "Guarda una receta para consultarl despu\xE9s. \xDAsala cuando el usuario diga 'guard\xE1 esa carbonara', 'esta de tortilla dejala', 'guardo esa receta'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        ingredients: { type: "array", items: { type: "string" } },
        steps: { type: "string", description: "Instrucciones." },
        source: { type: "string", description: "Origen (URL o nombre)." }
      },
      required: ["title"]
    }
  ),
  policy: policies.localWrite("Guarda receta como record."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    if (!title) return { type: "recipe_save", status: "failed", error: "Indic\xE1 el t\xEDtulo." };
    const record = {
      domain: "home",
      kind: "recommendation",
      title: `Receta: ${title}`,
      value: Array.isArray(args.ingredients) ? args.ingredients.join(", ") : void 0,
      notes: args.steps ? String(args.steps) : void 0,
      url: args.source ? String(args.source) : void 0,
      collection: "Recetas"
    };
    return {
      type: "recipe_save",
      status: "ok",
      title,
      records: [record],
      block: { type: "saved_record", title: "Receta guardada", records: [record] }
    };
  }
};
var recipeShow = {
  definition: defineTool(
    "recipe_show",
    "Muestra una receta guardada anteriormente. \xDAsala cuando el usuario diga 'mostrame la receta del flan que guard\xE9', 'cu\xE1l era esa de tortilla'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Parte del nombre de la receta guardada." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee receta guardada."),
  async run(args, ctx) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "recipe_show", status: "failed", error: "Indic\xE1 qu\xE9 receta buscar." };
    const matches = (ctx.state.records ?? []).filter((r) => r.collection === "Recetas" && r.title.toLowerCase().includes(q)).slice(-5).map((r) => ({ title: r.title, ingredients: r.value, steps: r.notes, source: r.url }));
    if (matches.length === 0) {
      return { type: "recipe_show", status: "ok", query: args.query, recipes: [], note: "No encontr\xE9 esa receta guardada." };
    }
    return { type: "recipe_show", status: "ok", query: args.query, recipes: matches };
  }
};
var foodInfo = {
  definition: defineTool(
    "food_info",
    "Info nutricional y de ingredientes de un producto por c\xF3digo de barras. \xDAsala cuando el usuario diga 'qu\xE9 tiene este yogurt del c\xF3digo 7622210449284', 'ingredientes de este producto', 'al\xE9rgenos del barcode X'. Datos abiertos de Open Food Facts.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        barcode: { type: "string", description: "C\xF3digo de barras (EAN/UPC)." }
      },
      required: ["barcode"]
    }
  ),
  policy: policies.readonly("Lee producto de Open Food Facts."),
  async run(args) {
    const barcode = String(args.barcode ?? "").replace(/\D/g, "");
    if (!barcode) return { type: "food_info", status: "failed", error: "Indic\xE1 el c\xF3digo de barras." };
    const cacheKey = `off:${barcode}`;
    const product = await cached(cacheKey, ttls.reference, async () => {
      await limiters.openFoodFacts.acquire();
      const r = await fetchJson(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.product ?? {};
    });
    if (!product.product_name) {
      return { type: "food_info", status: "ok", barcode, note: `Producto ${barcode} no encontrado en la base.` };
    }
    return {
      type: "food_info",
      status: "ok",
      barcode,
      name: product.product_name,
      brand: product.brands,
      ingredients: product.ingredients_text,
      allergens: product.allergens,
      nutriScore: product.nutriscore_grade?.toUpperCase(),
      nutrition: product.nutriments ? {
        energyKcal100g: product.nutriments["energy-kcal_100g"],
        fat100g: product.nutriments.fat_100g,
        sugars100g: product.nutriments.sugars_100g,
        salt100g: product.nutriments.salt_100g,
        proteins100g: product.nutriments.proteins_100g
      } : void 0,
      imageUrl: product.image_url,
      source: "Open Food Facts",
      sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`
    };
  }
};
var winePairing = {
  definition: defineTool(
    "wine_pairing",
    "Sugiere un vino para acompa\xF1ar una comida. \xDAsala cuando el usuario diga 'qu\xE9 vino va con cordero', 'tinto para pasta', 'maridaje para salm\xF3n'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        food: { type: "string", description: "Comida (ej: 'cordero', 'pasta', 'salm\xF3n')." },
        color: { type: "string", enum: ["red", "white", "ros\xE9", "any"], default: "any" }
      },
      required: ["food"]
    }
  ),
  policy: policies.readonly("Reglas locales de maridaje."),
  async run(args) {
    const food = String(args.food ?? "").trim().toLowerCase();
    if (!food) return { type: "wine_pairing", status: "failed", error: "Indic\xE1 la comida." };
    const pairings = [
      { match: /cordero|chivo|venado|caza|parrilla|asado|carne roja|res/i, wines: ["Malbec", "Cabernet Sauvignon", "Tempranillo"] },
      { match: /pasta|lasaña|risotto|hongos|setas/i, wines: ["Barolo", "Sangiovese", "Chianti"] },
      { match: /salmón|atún|pescado azul|sushi/i, wines: ["Pinot Noir", "Chardonnay", "Sauvignon Blanc"] },
      { match: /marisco|gamba|langostino|ostra|ceviche/i, wines: ["Albari\xF1o", "Sauvignon Blanc", "Champagne Brut"] },
      { match: /pollo|pavo|ave/i, wines: ["Chardonnay", "Pinot Noir", "Tempranillo joven"] },
      { match: /queso|tabla de quesos/i, wines: ["Rioja", "Malbec", "Port"] },
      { match: /postre|chocolate|frutilla|frutas/i, wines: ["Moscatel", "Sauternes", "Oporto"] },
      { match: /picante|curry|india|tailandesa/i, wines: ["Riesling", "Gew\xFCrztraminer"] },
      { match: /pescado blanco|merluza|lenguado/i, wines: ["Verdejo", "Sauvignon Blanc", "Albari\xF1o"] }
    ];
    const found = pairings.find((p) => p.match.test(food));
    const wines = found?.wines ?? ["Pinot Noir", "Chardonnay", "Malbec"];
    const filtered = args.color && args.color !== "any" ? wines : wines;
    return {
      type: "wine_pairing",
      status: "ok",
      food,
      color: args.color ?? "any",
      suggestions: filtered,
      note: found ? "Sugerencias basadas en reglas cl\xE1sicas de maridaje." : "No tengo match espec\xEDfico; estas son sugerencias vers\xE1tiles."
    };
  }
};
var NUTRITION_TABLE = {
  "huevo": { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  "pollo": { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  "carne": { kcal: 250, protein: 26, carbs: 0, fat: 17 },
  "pescado": { kcal: 206, protein: 22, carbs: 0, fat: 12 },
  "arroz": { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  "pasta": { kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  "pan": { kcal: 265, protein: 9, carbs: 49, fat: 3.2 },
  "leche": { kcal: 42, protein: 3.4, carbs: 5, fat: 1 },
  "queso": { kcal: 402, protein: 25, carbs: 1.3, fat: 33 },
  "yogur": { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  "manzana": { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  "banana": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "aceite": { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  "az\xFAcar": { kcal: 387, protein: 0, carbs: 100, fat: 0 },
  "miel": { kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  "garbanzos": { kcal: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  "lentejas": { kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  "papa": { kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  "tomate": { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  "zanahoria": { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  "cebolla": { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  "espinaca": { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  "br\xF3coli": { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  "palta": { kcal: 160, protein: 2, carbs: 9, fat: 15 },
  "aceitunas": { kcal: 115, protein: 0.8, carbs: 6, fat: 11 },
  "chocolate": { kcal: 546, protein: 4.9, carbs: 61, fat: 31 },
  "avena": { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  "mantequilla": { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  "mayonesa": { kcal: 680, protein: 1, carbs: 0.6, fat: 75 },
  "ketchup": { kcal: 112, protein: 1, carbs: 26, fat: 0.2 },
  "tortilla": { kcal: 218, protein: 10, carbs: 25, fat: 8 },
  "empanada": { kcal: 295, protein: 9, carbs: 28, fat: 16 },
  "milanesa": { kcal: 246, protein: 22, carbs: 11, fat: 13 },
  "hamburguesa": { kcal: 295, protein: 17, carbs: 30, fat: 12 },
  "pizza": { kcal: 266, protein: 11, carbs: 33, fat: 10 },
  "helado": { kcal: 207, protein: 3.5, carbs: 24, fat: 11 }
};
function parseQuantity(input) {
  const s = input.trim().toLowerCase();
  const match = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gramo|gramos|kg|kilo|kilos|ml|litro|litros|unidad|unidades|taza|tazas|cdita|cditas|cda|cucharada|cucharadas|cucharadita|cucharaditas|porción|porciones|rodaja|rodajas|plato|platos|rebanada|rebanadas)?$/i);
  if (!match) return { factor: 1, unit: "porci\xF3n", original: s || "100g" };
  const val = parseFloat(match[1]);
  const unit = (match[2] ?? "").toLowerCase();
  const unitMap = {
    g: 1,
    gr: 1,
    gramo: 1,
    gramos: 1,
    kg: 1e3,
    kilo: 1e3,
    kilos: 1e3,
    ml: 1,
    litro: 1e3,
    litros: 1e3,
    unidad: 55,
    unidades: 55,
    taza: 240,
    tazas: 240,
    cdita: 5,
    cditas: 5,
    cucharadita: 5,
    cucharaditas: 5,
    cda: 15,
    cucharada: 15,
    cucharadas: 15,
    porci\u00F3n: 150,
    porciones: 150,
    rodaja: 30,
    rodajas: 30,
    plato: 300,
    platos: 300,
    rebanada: 30,
    rebanadas: 30
  };
  const grams = unitMap[unit] ?? 100;
  const factor = val * grams / 100;
  return { factor, unit, original: s };
}
function bestMatch(food) {
  const q = food.toLowerCase().trim();
  if (NUTRITION_TABLE[q]) return q;
  for (const k of Object.keys(NUTRITION_TABLE)) {
    if (k.includes(q) || q.includes(k)) return k;
  }
  const words = q.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const k of Object.keys(NUTRITION_TABLE)) {
      if (k.includes(word)) return k;
    }
  }
  return null;
}
var nutritionCalc = {
  definition: defineTool(
    "nutrition_calc",
    "Calcula calor\xEDas y macros aproximados de un alimento o comida. \xDAsala cuando el usuario diga 'cu\xE1ntas calor\xEDas tiene esa carbonara', 'macros del pollo', 'cu\xE1nto aporta un huevo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        food: { type: "string", description: "Alimento o comida (ej: 'huevo', '1 taza de arroz', 'porci\xF3n de pizza')." },
        quantity: { type: "string", description: "Cantidad opcional (ej: '100g', '2 unidades')." }
      },
      required: ["food"]
    }
  ),
  policy: policies.readonly("C\xE1lculo nutricional aproximado."),
  async run(args) {
    const food = String(args.food ?? "").trim();
    const quantity = String(args.quantity ?? "").trim();
    if (!food) return { type: "nutrition_calc", status: "failed", error: "Indic\xE1 el alimento." };
    const match = bestMatch(food);
    if (!match) {
      return {
        type: "nutrition_calc",
        status: "ok",
        food,
        quantity,
        note: `No tengo datos nutricionales para "${food}". Prob\xE1 con un alimento m\xE1s com\xFAn (ej: pollo, arroz, huevo).`,
        items: [],
        block: { type: "data_card", title: food, items: [{ label: "Sin datos", value: "Alimento no encontrado", detail: "Us\xE1 un nombre m\xE1s com\xFAn" }] }
      };
    }
    const base = NUTRITION_TABLE[match];
    const q = parseQuantity(quantity || "100g");
    const kcal = Math.round(base.kcal * q.factor);
    const protein = Math.round(base.protein * q.factor * 10) / 10;
    const carbs = Math.round(base.carbs * q.factor * 10) / 10;
    const fat = Math.round(base.fat * q.factor * 10) / 10;
    return {
      type: "nutrition_calc",
      status: "ok",
      food,
      matchedFood: match,
      quantity: q.original,
      note: `Valores aproximados para ${q.original} de ${match} (base 100g: ${base.kcal} kcal, ${base.protein}g prot, ${base.carbs}g carb, ${base.fat}g grasa).`,
      items: [
        { label: "Calor\xEDas", value: `${kcal} kcal` },
        { label: "Prote\xEDnas", value: `${protein} g` },
        { label: "Carbohidratos", value: `${carbs} g` },
        { label: "Grasas", value: `${fat} g` }
      ],
      block: {
        type: "data_card",
        title: `${match} \u2014 ${q.original}`,
        items: [
          { label: "Calor\xEDas", value: `${kcal} kcal`, detail: "aprox." },
          { label: "Prote\xEDnas", value: `${protein} g`, detail: "aprox." },
          { label: "Carbohidratos", value: `${carbs} g`, detail: "aprox." },
          { label: "Grasas", value: `${fat} g`, detail: "aprox." }
        ]
      }
    };
  }
};

// koru-mvp/src/tools/food/index.ts
var foodTools = [
  restaurantDeepSearch,
  restaurantReviewAggregate,
  menuExtract,
  recipeFind,
  recipeByIngredients,
  recipeSave,
  recipeShow,
  foodInfo,
  winePairing,
  nutritionCalc
];

// koru-mvp/src/tools/travel/travel.ts
var flightSearch = {
  definition: defineTool(
    "flight_search",
    "Busca pasajes de avi\xF3n con precio, escalas, aerol\xEDnea y duraci\xF3n. \xDAsala cuando el usuario diga 'vuelo Madrid-Buenos Aires en noviembre', 'pasajes a Tokyo marzo', 'el m\xE1s barato a Roma'. Lee varias fuentes (Skyscanner, Google Flights, aerol\xEDneas) y cruza resultados.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Ruta y fecha (ej: 'Madrid a Buenos Aires en noviembre 2025')." },
        budget: { type: "string" }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Busca pasajes p\xFAblicos."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    const budget = String(args.budget ?? "").trim();
    if (!query) return { type: "flight_search", status: "failed", error: "Indic\xE1 ruta y fecha." };
    const sources = usableSources(await searchAndEnrich(`${query} pasaje vuelo precio ${budget}`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try {
        dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn));
      } catch {
      }
    }
    return { type: "flight_search", status: "ok", query, budget, sources, dataCard };
  }
};
var flightTrack = {
  definition: defineTool(
    "flight_track",
    "Sigue el estado de un vuelo en vivo (en hora, demorado, cancelado, posici\xF3n). \xDAsala cuando el usuario diga 'lleg\xF3 el IB6862?', 'estado del vuelo de mam\xE1', 'd\xF3nde est\xE1 el AA1234'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        flight: { type: "string", description: "N\xFAmero de vuelo (ej: 'IB6862', 'AA1234')." }
      },
      required: ["flight"]
    }
  ),
  policy: policies.readonly("Lee estado de vuelo p\xFAblico."),
  async run(args) {
    const flight = String(args.flight ?? "").trim();
    if (!flight) return { type: "flight_track", status: "failed", error: "Indic\xE1 el n\xFAmero de vuelo." };
    const sources = usableSources(await searchAndEnrich(`${flight} flight status live arrivals`, 4));
    return {
      type: "flight_track",
      status: "ok",
      flight,
      sources,
      note: sources.length ? "Estado consultado en fuentes p\xFAblicas." : "No pude conseguir el estado del vuelo."
    };
  }
};
var hotelSearch = {
  definition: defineTool(
    "hotel_search",
    "Busca hoteles, hostels u hospedajes con precio, rating, ubicaci\xF3n y amenities. \xDAsala cuando el usuario diga 'hotel en Roma centro 3 noches', 'hostel barato en Lisboa', 'airbnb en Tokyo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Destino, noches, preferencias." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Busca hospedajes p\xFAblicos."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "hotel_search", status: "failed", error: "Indic\xE1 destino y noches." };
    const sources = usableSources(await searchAndEnrich(`${query} hotel hostel precio rating`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try {
        dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn));
      } catch (err) {
        console.warn("[Koru] travel dataCard extraction failed:", err instanceof Error ? err.message : err);
      }
    }
    return { type: "hotel_search", status: "ok", query, sources, dataCard };
  }
};
var routePlan = {
  definition: defineTool(
    "route_plan",
    "Calcula ruta entre dos puntos con duraci\xF3n y distancia en auto. \xDAsala cuando el usuario diga 'c\xF3mo llego a Ezeiza', 'ruta a la playa', 'cu\xE1nto tardo en llegar a X'. Para transporte p\xFAblico o pie, deriva a web_search.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        origin: { type: "string", description: "Punto de origen (direcci\xF3n o ciudad)." },
        destination: { type: "string", description: "Destino." },
        mode: { type: "string", enum: ["driving", "walking", "transit"], default: "driving" }
      },
      required: ["origin", "destination"]
    }
  ),
  policy: policies.readonly("Calcula ruta via OSRM + geocoding."),
  async run(args) {
    const origin = String(args.origin ?? "").trim();
    const destination = String(args.destination ?? "").trim();
    const mode = String(args.mode ?? "driving");
    if (!origin || !destination) return { type: "route_plan", status: "failed", error: "Indic\xE1 origen y destino." };
    try {
      const [origGeo, destGeo] = await Promise.all([
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(origin)}&count=1&format=json`, { signal: AbortSignal.timeout(15e3) }).then((r) => r.json()),
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&format=json`, { signal: AbortSignal.timeout(15e3) }).then((r) => r.json())
      ]);
      const orig = origGeo.results?.[0];
      const dest = destGeo.results?.[0];
      if (!orig || !dest) return { type: "route_plan", status: "ok", origin, destination, mode, note: "No pude geolocalizar origen o destino. Prob\xE1 con nombres de ciudad m\xE1s espec\xEDficos." };
      const profile = mode === "walking" ? "foot" : "driving";
      const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${orig.longitude},${orig.latitude};${dest.longitude},${dest.latitude}?overview=false`;
      const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(15e3) });
      const osrmData = await osrmRes.json();
      const route = osrmData.routes?.[0];
      if (!route) return { type: "route_plan", status: "ok", origin, destination, mode, note: "No encontr\xE9 ruta entre esos puntos." };
      const km = route.distance ? (route.distance / 1e3).toFixed(1) : "?";
      const mins = route.duration ? Math.round(route.duration / 60) : "?";
      return {
        type: "route_plan",
        status: "ok",
        origin,
        destination,
        mode,
        text: `De ${orig.name} a ${dest.name}: ${km} km, ${mins} min en ${mode === "walking" ? "a pie" : "auto"}.`,
        distanceKm: km,
        durationMin: mins
      };
    } catch (err) {
      console.warn("[Koru] route_plan OSRM failed:", err instanceof Error ? err.message : err);
      return { type: "route_plan", status: "failed", error: "No pude calcular la ruta. Verific\xE1 los nombres de las ciudades." };
    }
  }
};
var transportNearby = {
  definition: defineTool(
    "transport_nearby",
    "Encuentra estaciones de tren/subte/bici/bus cerca de un punto. \xDAsala cuando el usuario diga 'estaci\xF3n de Ecobici cerca', 'subte m\xE1s cercano', 'd\xF3nde hay una parada de bus'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        location: { type: "string", description: "Zona o direcci\xF3n (ej: 'Palermo, Buenos Aires')." },
        type: { type: "string", enum: ["subway", "train", "bus", "bike", "any"], default: "any" }
      },
      required: ["location"]
    }
  ),
  policy: policies.readonly("Busca POIs de transporte via OpenStreetMap Overpass."),
  async run(args) {
    const location = String(args.location ?? "").trim();
    const transportType = String(args.type ?? "any");
    if (!location) return { type: "transport_nearby", status: "failed", error: "Indic\xE1 ubicaci\xF3n." };
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&format=json`, { signal: AbortSignal.timeout(15e3) });
      const geoData = await geoRes.json();
      const geo = geoData.results?.[0];
      if (!geo) return { type: "transport_nearby", status: "ok", location, transportType, note: `No encontr\xE9 coordenadas de ${location}.` };
      const transportFilter = transportType === "subway" ? "railway=subway" : transportType === "train" ? "railway=station" : transportType === "bus" ? "highway=bus_stop" : transportType === "bike" ? "amenity=bicycle_rental" : "(railway=subway|railway=station|highway=bus_stop|amenity=bicycle_rental)";
      const overpassQuery = `[out:json][timeout:8];(node["${transportFilter}"](around:2000,${geo.latitude},${geo.longitude}););out 10;`;
      const opRes = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: overpassQuery, signal: AbortSignal.timeout(9e3) });
      const opData = await opRes.json();
      const stations = (opData.elements ?? []).map((e) => ({ name: e.tags?.name ?? "Estaci\xF3n", kind: e.tags?.railway ?? e.tags?.highway ?? "transporte" })).slice(0, 5);
      if (stations.length === 0) return { type: "transport_nearby", status: "ok", location, transportType, note: `No encontr\xE9 estaciones de transporte cerca de ${geo.name}.` };
      return { type: "transport_nearby", status: "ok", location, transportType, stations, text: `Encontr\xE9 ${stations.length} estaciones cerca de ${geo.name}: ${stations.map((s) => s.name).join(", ")}.` };
    } catch (err) {
      console.warn("[Koru] transport_nearby Overpass failed:", err instanceof Error ? err.message : err);
      return { type: "transport_nearby", status: "failed", error: `No pude buscar transporte cerca de ${location}.` };
    }
  }
};
var currencyAtm = {
  definition: defineTool(
    "currency_atm",
    "Localiza cajeros autom\xE1ticos o casas de cambio cerca y trae la tasa del d\xEDa. \xDAsala cuando el usuario diga 'd\xF3nde cambio d\xF3lares', 'cajero sin comisi\xF3n cerca', 'casa de cambio'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        location: { type: "string" }
      },
      required: ["location"]
    }
  ),
  policy: policies.readonly("Busca tasa de cambio via Frankfurter API."),
  async run(args) {
    const location = String(args.location ?? "").trim();
    if (!location) return { type: "currency_atm", status: "failed", error: "Indic\xE1 ubicaci\xF3n." };
    try {
      const rateRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", { signal: AbortSignal.timeout(15e3) });
      const rateData = await rateRes.json();
      const eurRate = rateData.rates?.EUR;
      const date = rateData.date;
      return {
        type: "currency_atm",
        status: "ok",
        location,
        text: eurRate ? `Tasa del d\xEDa (${date}): 1 USD = ${eurRate} EUR. Para cajeros espec\xEDficos en ${location}, te sugiero buscar en Google Maps "cajero autom\xE1tico" o "casa de cambio" en esa zona.` : `No pude obtener la tasa del d\xEDa. Para cajeros en ${location}, busc\xE1 en Google Maps.`,
        rate: eurRate ? `${eurRate}` : void 0,
        date
      };
    } catch (err) {
      console.warn("[Koru] currency_atm Frankfurter failed:", err instanceof Error ? err.message : err);
      return { type: "currency_atm", status: "failed", error: `No pude obtener informaci\xF3n de cambio para ${location}.` };
    }
  }
};
var visaCheck = {
  definition: defineTool(
    "visa_check",
    "Verifica requisitos de visa y entrada a un pa\xEDs seg\xFAn tu pasaporte. \xDAsala cuando el usuario diga 'necesito visa para Jap\xF3n?', 'requisitos para ingresar a USA con pasaporte argentino', 'visa Schengen'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: { type: "string", description: "Pa\xEDs destino (ej: 'Jap\xF3n', 'USA')." },
        passport: { type: "string", description: "Pa\xEDs del pasaporte (ej: 'Argentina', 'Espa\xF1a')." }
      },
      required: ["destination", "passport"]
    }
  ),
  policy: policies.readonly("Lee requisitos de visa."),
  async run(args, ctx) {
    const destination = String(args.destination ?? "").trim();
    const passport = String(args.passport ?? "").trim();
    if (!destination || !passport) return { type: "visa_check", status: "failed", error: "Indic\xE1 destino y pasaporte." };
    const sources = usableSources(await searchAndEnrich(`requisitos visa ${destination} pasaporte ${passport} 2025 oficial`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try {
        dataCard = extractionToDataCard(await validateWithCitations(`visa para ${destination} con pasaporte ${passport}`, sources, ctx.chatFn));
      } catch (err) {
        console.warn("[Koru] travel visa dataCard failed:", err instanceof Error ? err.message : err);
      }
    }
    return {
      type: "visa_check",
      status: "ok",
      destination,
      passport,
      sources,
      dataCard,
      note: "Requisitos pueden cambiar. Verific\xE1 con la embajada o sitio oficial antes de viajar."
    };
  }
};
var travelItinerary = {
  definition: defineTool(
    "travel_itinerary",
    "Arma un itinerario de viaje d\xEDa a d\xEDa combinando atracciones, comida y tiempo. \xDAsala cuando el usuario diga 'armate un itinerario de 3 d\xEDas en Roma', 'plan para Tokyo 5 d\xEDas'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: { type: "string", description: "Destino." },
        days: { type: "number", description: "Cantidad de d\xEDas." },
        interests: { type: "array", items: { type: "string" }, description: "Intereses (ej: 'arte', 'comida', 'historia')." }
      },
      required: ["destination", "days"]
    }
  ),
  policy: policies.readonly("Genera itinerario de fuentes p\xFAblicas."),
  async run(args, ctx) {
    const destination = String(args.destination ?? "").trim();
    const days = Number(args.days ?? 0);
    const interests = Array.isArray(args.interests) ? args.interests.map(String) : [];
    if (!destination || days <= 0) return { type: "travel_itinerary", status: "failed", error: "Indic\xE1 destino y d\xEDas." };
    const sources = usableSources(await searchAndEnrich(`itinerario ${days} d\xEDas en ${destination} ${interests.join(" ")} qu\xE9 ver`, 5));
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try {
        dataCard = extractionToDataCard(await validateWithCitations(`itinerario ${days} d\xEDas ${destination}`, sources, ctx.chatFn));
      } catch (err) {
        console.warn("[Koru] travel itinerary dataCard failed:", err instanceof Error ? err.message : err);
      }
    }
    return {
      type: "travel_itinerary",
      status: "ok",
      destination,
      days,
      interests,
      sources,
      dataCard,
      note: "Itinerario base. Ajust\xE1 seg\xFAn ritmo y gustos personales."
    };
  }
};
var weatherTravel = {
  definition: defineTool(
    "weather_travel",
    "Predicci\xF3n de clima para un viaje futuro (pron\xF3stico extendido o promedio hist\xF3rico). \xDAsala cuando el usuario diga 'qu\xE9 clima va a hacer en Berl\xEDn en diciembre', 'pron\xF3stico para mi viaje a Roma en marzo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: { type: "string", description: "Destino." },
        date: { type: "string", description: "Fecha o mes (ej: '2025-12-15', 'diciembre')." }
      },
      required: ["destination", "date"]
    }
  ),
  policy: policies.readonly("Lee clima via Open-Meteo + Wikipedia."),
  async run(args) {
    const destination = String(args.destination ?? "").trim();
    const date = String(args.date ?? "").trim();
    if (!destination || !date) return { type: "weather_travel", status: "failed", error: "Indic\xE1 destino y fecha." };
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&format=json`, { signal: AbortSignal.timeout(15e3) });
      const geoData = await geoRes.json();
      const geo = geoData.results?.[0];
      if (!geo) return { type: "weather_travel", status: "ok", destination, date, note: `No encontr\xE9 coordenadas de ${destination}.` };
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto`, { signal: AbortSignal.timeout(15e3) });
      const weatherData = await weatherRes.json();
      const cur = weatherData.current;
      return {
        type: "weather_travel",
        status: "ok",
        destination,
        date,
        location: `${geo.name}${geo.country ? `, ${geo.country}` : ""}`,
        text: cur ? `Clima actual en ${geo.name}: ${cur.temperature_2m}\xB0C, precipitaci\xF3n ${cur.precipitation}mm, viento ${cur.wind_speed_10m} km/h. Para ${date}, consult\xE1 un pron\xF3stico extendido cerca de esa fecha.` : `Encontr\xE9 ${geo.name} pero no pude obtener el clima.`,
        temperature: cur?.temperature_2m,
        precipitation: cur?.precipitation,
        windSpeed: cur?.wind_speed_10m
      };
    } catch (err) {
      console.warn("[Koru] weather_travel Open-Meteo failed:", err instanceof Error ? err.message : err);
      return { type: "weather_travel", status: "failed", error: `No pude obtener clima para ${destination}.` };
    }
  }
};
var languagePhrase = {
  definition: defineTool(
    "language_phrase",
    "Frases \xFAtiles para viajar en un idioma (hola, gracias, \xBFd\xF3nde est\xE1...?, n\xFAmeros) con pronunciaci\xF3n. \xDAsala cuando el usuario diga 'frases \xFAtiles en japon\xE9s para viajar', 'c\xF3mo digo gracias en \xE1rabe', 'supervivencia en tailand\xE9s'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        language: { type: "string", description: "Idioma (ej: 'japon\xE9s', 'italiano', 'tailand\xE9s')." },
        context: { type: "string", description: "Contexto opcional (ej: 'restaurante', 'aeropuerto', 'hotel')." }
      },
      required: ["language"]
    }
  ),
  policy: policies.readonly("Genera frases de viaje."),
  async run(args, ctx) {
    const language = String(args.language ?? "").trim();
    const context = String(args.context ?? "").trim();
    if (!language) return { type: "language_phrase", status: "failed", error: "Indic\xE1 el idioma." };
    if (!ctx.chatFn) {
      return {
        type: "language_phrase",
        status: "not_configured",
        language,
        note: "Para generar frases hace falta el LLM local (Ollama). Configur\xE1 el modelo en Settings."
      };
    }
    const prompt = `Gener\xE1 12 frases \xFAtiles en ${language} para viajar${context ? ` (contexto: ${context})` : ""}. Formato: "ES|<traducci\xF3n>|<pronunciaci\xF3n aproximada>". Inclu\xED: saludo, gracias, por favor, \xBFd\xF3nde est\xE1...?, \xBFcu\xE1nto cuesta?, n\xFAmeros 1-5, ayuda, ba\xF1o. Solo las l\xEDneas, sin explicaciones.`;
    try {
      const result = await ctx.chatFn(
        [
          { role: "system", content: "Sos un asistente de viaje. Gener\xE1s frases pr\xE1cticas concisas." },
          { role: "user", content: prompt }
        ],
        { temperature: 0.3, maxTokens: 600 }
      );
      const phrases = result.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 12).map((l) => {
        const parts = l.split("|").map((p) => p.trim());
        return { es: parts[0] ?? l, translation: parts[1] ?? "", pronunciation: parts[2] ?? "" };
      });
      return { type: "language_phrase", status: "ok", language, context, phrases };
    } catch (e) {
      return { type: "language_phrase", status: "failed", language, error: e instanceof Error ? e.message : String(e) };
    }
  }
};

// koru-mvp/src/tools/travel/index.ts
var travelTools = [
  flightSearch,
  flightTrack,
  hotelSearch,
  routePlan,
  transportNearby,
  currencyAtm,
  visaCheck,
  travelItinerary,
  weatherTravel,
  languagePhrase
];

// koru-mvp/src/tools/trending/trending.ts
async function queryGdelt(query, maxrecords = 8) {
  await limiters.gdelt.acquire();
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(maxrecords));
  url.searchParams.set("sort", "DateDesc");
  const r = await fetchJson(url.toString(), { timeoutMs: 1e4 });
  if (!r.ok) return [];
  return (r.data.articles ?? []).filter((a) => a.title && a.url);
}
var newsUrgent = {
  definition: defineTool(
    "news_urgent",
    "Noticias urgentes y de \xFAltima hora del mundo de agencias fiables. \xDAsala cuando el usuario pregunte 'qu\xE9 pas\xF3 hoy importante?', 'noticias urgentes', '\xFAltima hora'. Ordena por fecha descendente.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        region: { type: "string", description: "Regi\xF3n o pa\xEDs opcional (ej: 'Argentina', 'Espa\xF1a', 'mundo')." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee noticias de GDELT."),
  async run(args) {
    const region = String(args.region ?? "mundo").trim();
    const cacheKey = `news_urgent:${region.toLowerCase()}`;
    const articles = await cached(cacheKey, ttls.news, () => queryGdelt(`(urgente OR \xFAltima hora OR breaking) ${region} sourcelang:spa`, 8));
    if (articles.length === 0) {
      const fallback = await cached(`news_urgent_fb:${region.toLowerCase()}`, ttls.news, () => queryGdelt(`noticias importantes ${region} sourcelang:spa`, 8));
      return { type: "news_urgent", status: "ok", region, articles: fallback, source: "GDELT", note: "Sin noticias marcadas como urgentes; muestro las m\xE1s recientes." };
    }
    return { type: "news_urgent", status: "ok", region, articles, source: "GDELT" };
  }
};
var newsTopic = {
  definition: defineTool(
    "news_topic",
    "Noticias filtradas por tema (pol\xEDtica, tech, ciencia, deporte, etc.). \xDAsala cuando el usuario pregunte 'noticias de IA', 'qu\xE9 pasa en Medio Oriente', 'tech de hoy', 'avances cient\xEDficos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema a buscar." }
      },
      required: ["topic"]
    }
  ),
  policy: policies.readonly("Lee noticias tem\xE1ticas de GDELT."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "news_topic", status: "failed", error: "Indic\xE1 el tema." };
    const cacheKey = `news_topic:${topic.toLowerCase()}`;
    const articles = await cached(cacheKey, ttls.news, () => queryGdelt(`${topic} sourcelang:spa`, 8));
    return { type: "news_topic", status: "ok", topic, articles, source: "GDELT" };
  }
};
var trendingTwitter = {
  definition: defineTool(
    "trending_twitter",
    "Tendencias actuales de X/Twitter (topics m\xE1s comentados con volumen). \xDAsala cuando el usuario diga 'de qu\xE9 se habla en X?', 'trending global', 'tendencias en Argentina'. NOTA: X elimin\xF3 su API gratuita; uso scraper (puede fallar por bloqueos).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        location: { type: "string", description: "Pa\xEDs o 'global'. Default worldwide." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Scrapea trends de X."),
  async run(args) {
    const location = String(args.location ?? "worldwide").trim();
    const geoMap = {
      worldwide: "worldwide",
      global: "worldwide",
      us: "united-states",
      usa: "united-states",
      unitedstates: "united-states",
      ar: "argentina",
      argentina: "argentina",
      es: "spain",
      espa\u00F1a: "spain",
      spain: "spain",
      mx: "mexico",
      m\u00E9xico: "mexico",
      mexico: "mexico",
      br: "brazil",
      brasil: "brazil",
      brazil: "brazil",
      co: "colombia",
      colombia: "colombia",
      cl: "chile",
      chile: "chile",
      pe: "peru",
      per\u00FA: "peru",
      peru: "peru",
      uk: "united-kingdom",
      gb: "united-kingdom",
      england: "united-kingdom",
      fr: "france",
      francia: "france",
      france: "france",
      de: "germany",
      alemania: "germany",
      germany: "germany",
      it: "italy",
      italia: "italy",
      italy: "italy",
      ca: "canada",
      canada: "canada",
      au: "australia",
      australia: "australia",
      in: "india",
      india: "india",
      jp: "japan",
      jap\u00F3n: "japan",
      japan: "japan"
    };
    const slug = geoMap[location.toLowerCase()] ?? "worldwide";
    const cacheKey = `twitter_trends:${slug}`;
    const trends = await cached(cacheKey, ttls.trending, async () => {
      const r = await fetchText(`https://trends24.in/${slug}/`, { timeoutMs: 9e3 });
      if (!r.ok) return [];
      const text = r.text;
      const items = [];
      const matches = Array.from(text.matchAll(/href="https:\/\/twitter\.com\/search\?q=([^"]+)" class=trend-link>([^<]+)/g));
      for (const m of matches.slice(0, 15)) {
        const title = m[2].trim();
        if (title) {
          items.push({ title, url: `https://twitter.com/search?q=${m[1]}` });
        }
      }
      return items;
    });
    if (trends.length === 0) {
      return { type: "trending_twitter", status: "ok", location, trends: [], note: "No pude obtener tendencias en este momento. El scraper puede estar bloqueado." };
    }
    return { type: "trending_twitter", status: "ok", location, trends, source: "trends24.in" };
  }
};
var trendingReddit = {
  definition: defineTool(
    "trending_reddit",
    "Posts m\xE1s votados de Reddit (un subreddit o front page). \xDAsala cuando el usuario diga 'top de r/worldnews', 'qu\xE9 est\xE1 furor en r/movies', 'mejor de Reddit hoy'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        subreddit: { type: "string", description: "Subreddit sin r/ (ej: 'worldnews'). Default 'popular'." },
        timeframe: { type: "string", enum: ["hour", "day", "week", "month"], default: "day" }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee JSON p\xFAblico de Reddit."),
  async run(args) {
    const sub = String(args.subreddit ?? "popular").trim().replace(/^r\//, "");
    const timeframe = String(args.timeframe ?? "day");
    const cacheKey = `reddit:${sub}:${timeframe}`;
    const posts = await cached(cacheKey, ttls.trending, async () => {
      await limiters.reddit.acquire();
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";
      let lastErr = "Reddit no disponible";
      for (const host of ["old.reddit.com", "www.reddit.com"]) {
        const r = await fetchJson(
          `https://${host}/r/${encodeURIComponent(sub)}/top.json?t=${timeframe}&limit=10`,
          { timeoutMs: 9e3, headers: { "User-Agent": ua, Accept: "application/json" } }
        );
        if (!r.ok) {
          lastErr = r.error ?? "Error desconocido";
          continue;
        }
        const children = r.data?.data?.children;
        if (Array.isArray(children)) {
          return children.map((c) => {
            const d = c.data ?? {};
            return {
              title: String(d.title ?? ""),
              url: String(d.url ?? ""),
              permalink: `https://reddit.com${d.permalink ?? ""}`,
              ups: Number(d.ups ?? 0),
              num_comments: Number(d.num_comments ?? 0),
              subreddit: String(d.subreddit ?? sub),
              created_utc: Number(d.created_utc ?? 0)
            };
          }).filter((p) => p.title);
        }
        lastErr = "Reddit devolvi\xF3 HTML en vez de JSON (API p\xFAblica inestable).";
      }
      throw new Error(lastErr);
    });
    return { type: "trending_reddit", status: "ok", subreddit: sub, timeframe, posts: posts.slice(0, 10), source: "Reddit" };
  }
};
var trendingYoutube = {
  definition: defineTool(
    "trending_youtube",
    "Videos en tendencia de YouTube por pa\xEDs. \xDAsala cuando el usuario diga 'trending YouTube Argentina', 'qu\xE9 es furor en YouTube Espa\xF1a', 'top videos hoy'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        country: { type: "string", description: "C\xF3digo ISO pa\xEDs (ej: 'AR', 'ES'). Default global." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Scrapea trending de YouTube."),
  async run(args) {
    const country = String(args.country ?? "").trim();
    const cacheKey = `yt_trending:${country.toLowerCase()}`;
    const videos = await cached(cacheKey, ttls.trending, async () => {
      const url = country ? `https://www.youtube.com/feed/trending?gl=${encodeURIComponent(country)}` : "https://www.youtube.com/feed/trending";
      const r = await fetchText(url, { timeoutMs: 1e4, headers: { Accept: "text/html" } });
      if (!r.ok) return [];
      const out = [];
      const matches = Array.from(r.text.matchAll(/"videoId":"([\w-]{11})"[^}]*?"title":\{"runs":\[\{"text":"([^"]+)"/g)).slice(0, 10);
      for (const m of matches) {
        out.push({ url: `https://www.youtube.com/watch?v=${m[1]}`, title: m[2] });
      }
      return out;
    });
    return { type: "trending_youtube", status: "ok", country: country || "global", videos, source: "YouTube" };
  }
};
var trendingGithub = {
  definition: defineTool(
    "trending_github",
    "Repos m\xE1s populares de GitHub del d\xEDa/semana. \xDAsala cuando el usuario diga 'trending GitHub de la semana', 'repos que rompen hoy', 'proyectos populares'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        since: { type: "string", enum: ["daily", "weekly", "monthly"], default: "weekly" },
        language: { type: "string", description: "Lenguaje opcional (ej: 'python', 'typescript')." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Scrapea trending de GitHub."),
  async run(args) {
    const since = String(args.since ?? "weekly");
    const language = String(args.language ?? "").trim();
    const cacheKey = `gh_trending:${since}:${language.toLowerCase()}`;
    const repos = await cached(cacheKey, ttls.trending, async () => {
      const url = new URL("https://github.com/trending");
      if (language) url.pathname += `/${encodeURIComponent(language)}`;
      url.searchParams.set("since", since);
      const r = await fetchText(url.toString(), { timeoutMs: 1e4, headers: { Accept: "text/html" } });
      if (!r.ok) return [];
      const out = [];
      const matches = Array.from(r.text.matchAll(/<h2 class="h3 lh-condensed">[\s\S]*?<a href="\/([^"]+)"[\s\S]*?<\/a>[\s\S]*?<p class="col-9[^"]*">([\s\S]*?)<\/p>[\s\S]*?(?:<a[^>]*>([\d,]+)\s*stars<\/a>)?/g)).slice(0, 15);
      for (const m of matches) {
        out.push({
          name: m[1],
          url: `https://github.com/${m[1]}`,
          description: m[2]?.trim(),
          stars: m[3]
        });
      }
      return out;
    });
    return { type: "trending_github", status: "ok", since, language: language || "any", repos, source: "GitHub" };
  }
};
var rssSubscribe = {
  definition: defineTool(
    "rss_subscribe",
    "Suscribe a un feed RSS como fuente para tu radar personal. \xDAsala cuando el usuario diga 'segu\xED el feed de The Verge', 'sum\xE1 El Chiringuito', 'agreg\xE1 este RSS'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre amigable de la fuente." },
        url: { type: "string", description: "URL del feed RSS." }
      },
      required: ["name", "url"]
    }
  ),
  policy: policies.localWrite("Guarda suscripci\xF3n RSS como memory."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const url = String(args.url ?? "").trim();
    if (!name || !url) return { type: "rss_subscribe", status: "failed", error: "Indic\xE1 nombre y URL del feed." };
    return {
      type: "rss_subscribe",
      status: "ok",
      name,
      url,
      memoryCandidates: [{
        kind: "interest",
        text: `Sigue el RSS: ${name} (${url})`,
        confidence: 0.95,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: name,
        useForSuggestions: true
      }]
    };
  }
};
var rssDigest = {
  definition: defineTool(
    "rss_digest",
    "Lee tus feeds RSS suscritos y resume lo importante del d\xEDa. \xDAsala cuando el usuario diga 'resum\xED mis feeds', 'qu\xE9 hay de interesante en mis fuentes hoy'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        hours: { type: "number", description: "Ventana de horas. Default 24." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee feeds suscritos."),
  async run(args, ctx) {
    const hours = Number(args.hours ?? 24);
    const feeds = (ctx.state.memories ?? []).filter((m) => m.status === "confirmed" && m.text.toLowerCase().includes("rss:")).map((m) => {
      const match = m.text.match(/RSS:\s*([^()]+)\s*\(([^)]+)\)/);
      return match ? { name: match[1].trim(), url: match[2].trim() } : null;
    }).filter((f) => !!f);
    if (feeds.length === 0) {
      return { type: "rss_digest", status: "ok", hours, items: [], note: "No ten\xE9s feeds suscritos. Us\xE1 rss_subscribe para agregar." };
    }
    const since = Date.now() - hours * 60 * 60 * 1e3;
    const items = [];
    for (const feed of feeds.slice(0, 5)) {
      const r = await fetchText(feed.url, { timeoutMs: 15e3 });
      if (!r.ok) continue;
      const itemMatches = Array.from(r.text.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>(?:[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>)?/gi)).slice(0, 5);
      for (const m of itemMatches) {
        const pubDate = m[3]?.trim();
        const ts = pubDate ? new Date(pubDate).getTime() : 0;
        if (ts && ts < since) continue;
        items.push({ title: m[1].trim(), link: m[2].trim(), source: feed.name, pubDate });
      }
    }
    return { type: "rss_digest", status: "ok", hours, items: items.slice(0, 15), sources: feeds.map((f) => ({ title: f.name, url: f.name, domain: f.name })) };
  }
};
var newsRadarTopic = {
  definition: defineTool(
    "news_radar_topic",
    "Configura un radar: monitorea un tema en fuentes m\xFAltiples y Koru te avisar\xE1 cuando aparezca novedad. \xDAsala cuando el usuario diga 'avisame cuando salga algo sobre el nuevo Zelda', 'radar de IA generativa', 'vigilar tema X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema a vigilar." }
      },
      required: ["topic"]
    }
  ),
  policy: policies.localWrite("Configura radar como memory/nudge."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "news_radar_topic", status: "failed", error: "Indic\xE1 el tema." };
    return {
      type: "news_radar_topic",
      status: "ok",
      topic,
      memoryCandidates: [{
        kind: "interest",
        text: `Radar de noticias: vigilar "${topic}"`,
        confidence: 0.9,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: topic,
        useForSuggestions: true
      }],
      note: `Radar activado para "${topic}". Te avisar\xE9 cuando aparezcan novedades relevantes.`
    };
  }
};
var worldSignal = {
  definition: defineTool(
    "world_signal",
    "S\xEDntesis de qu\xE9 se habla en el mundo sobre un tema (cross-fuente, sin ruido viral). \xDAsala cuando el usuario diga 'de qu\xE9 se habla en el mundo sobre Argentina?', 'el mundo habla de X?', 'radar global de Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", description: "Tema a analizar." }
      },
      required: ["topic"]
    }
  ),
  policy: policies.readonly("Analiza se\xF1ales globales de GDELT GKG."),
  async run(args) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return { type: "world_signal", status: "failed", error: "Indic\xE1 el tema." };
    const cacheKey = `world:${topic.toLowerCase()}`;
    const articles = await cached(cacheKey, ttls.news, () => queryGdelt(`${topic} (tono:positivo OR tono:negativo) sourcelang:spa`, 8));
    if (articles.length === 0) {
      const sources = usableSources(await searchAndEnrich(`${topic} cobertura mundial \xFAltimas semanas`, 5));
      return { type: "world_signal", status: "ok", topic, articles: [], sources, note: "Datos de cobertura cruzada." };
    }
    return { type: "world_signal", status: "ok", topic, articles, source: "GDELT GKG" };
  }
};

// koru-mvp/src/tools/trending/index.ts
var trendingTools = [
  newsUrgent,
  newsTopic,
  trendingTwitter,
  trendingReddit,
  trendingYoutube,
  trendingGithub,
  rssSubscribe,
  rssDigest,
  newsRadarTopic,
  worldSignal
];

// koru-mvp/src/tools/people/people.ts
var WIKI_HEADERS = { "User-Agent": "KoruBot/1.0 (personal assistant; contact: dev@koru.app)" };
var personInfo = {
  definition: defineTool(
    "person_info",
    "Biograf\xEDa, edad, profesi\xF3n, obras y premios de una figura p\xFAblica. \xDAsala cuando el usuario diga 'qui\xE9n es Taylor Swift?', 'decime de Messi', 'info de Nolan', 'cu\xE1ntos a\xF1os tiene Spielberg'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre de la persona." },
        lang: { type: "string", description: "Idioma (ej: 'es', 'en'). Default 'es'." }
      },
      required: ["name"]
    }
  ),
  policy: policies.readonly("Lee biograf\xEDa de Wikipedia."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const lang = String(args.lang ?? "es").trim();
    if (!name) return { type: "person_info", status: "failed", error: "Indic\xE1 el nombre." };
    const cacheKey = `person:${lang}:${name.toLowerCase()}`;
    const summary = await cached(cacheKey, ttls.reference, async () => {
      await limiters.wikipedia.acquire();
      const r = await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
        { timeoutMs: 9e3, headers: { Accept: "application/json" } }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    if (summary.type === "not_found" || !summary.extract) {
      return { type: "person_info", status: "ok", name, note: `No encontr\xE9 "${name}" en Wikipedia (${lang}). Prob\xE1 en ingl\xE9s o con otro nombre.` };
    }
    return {
      type: "person_info",
      status: "ok",
      name: summary.title ?? name,
      description: summary.description,
      extract: summary.extract,
      thumbnail: summary.thumbnail?.source,
      wikiUrl: summary.content_urls?.desktop?.page,
      source: "Wikipedia"
    };
  }
};
var personFollow = {
  definition: defineTool(
    "person_follow",
    "Guarda una persona como favorita para que Koru te avise cuando haya noticias suyas. \xDAsala cuando el usuario diga 'segu\xED a Tarantino', 'avisame cuando saque algo Elon Musk', 'vigilar a X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre de la persona." }
      },
      required: ["name"]
    }
  ),
  policy: policies.localWrite("Guarda persona favorita como memory."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "person_follow", status: "failed", error: "Indic\xE1 el nombre." };
    return {
      type: "person_follow",
      status: "ok",
      name,
      memoryCandidates: [{
        kind: "interest",
        text: `Sigue a ${name}`,
        confidence: 0.95,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: name,
        useForSuggestions: true
      }]
    };
  }
};
var personFilmography = {
  definition: defineTool(
    "person_filmography",
    "Lista de pel\xEDculas/\xE1lbumes/libros/obras de un artista. \xDAsala cuando el usuario diga 'pel\xEDculas de Scorsese', 'discograf\xEDa de Radiohead', 'libros de Murakami'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del artista." },
        kind: { type: "string", enum: ["film", "music", "books", "any"], default: "any" }
      },
      required: ["name"]
    }
  ),
  policy: policies.readonly("Busca obras en Wikipedia."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const kind = String(args.kind ?? "any");
    if (!name) return { type: "person_filmography", status: "failed", error: "Indic\xE1 el nombre." };
    const kindQuery = kind === "film" ? "filmograf\xEDa pel\xEDculas" : kind === "music" ? "discograf\xEDa \xE1lbumes" : kind === "books" ? "libros obra" : "filmograf\xEDa discograf\xEDa libros";
    try {
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} ${kindQuery}`)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
      const data = await res.json();
      const results = data.query?.search ?? [];
      if (results.length === 0) {
        return { type: "person_filmography", status: "ok", name, kind, note: `No encontr\xE9 informaci\xF3n sobre ${name} en Wikipedia.` };
      }
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
      const summary = await summaryRes.json();
      return {
        type: "person_filmography",
        status: "ok",
        name,
        kind,
        text: summary.extract ?? `Encontr\xE9 informaci\xF3n sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }]
      };
    } catch (err) {
      console.warn("[Koru] person_filmography Wikipedia fetch failed:", err instanceof Error ? err.message : err);
      return { type: "person_filmography", status: "failed", error: `No pude buscar informaci\xF3n sobre ${name}.` };
    }
  }
};
var movieInfo = {
  definition: defineTool(
    "movie_info",
    "Sinopsis, reparto, a\xF1o, rating y d\xF3nde ver una pel\xEDcula o serie. \xDAsala cuando el usuario diga 'de qu\xE9 va Oppenheimer?', 'rating de The Bear', 'd\xF3nde ver Severance', 'reparto de Dune'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "T\xEDtulo de la pel\xEDcula o serie." },
        year: { type: "string", description: "A\xF1o opcional para desambiguar." }
      },
      required: ["title"]
    }
  ),
  policy: policies.readonly("Busca info de pel\xEDcula en Wikipedia + TMDB."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const year = String(args.year ?? "").trim();
    if (!title) return { type: "movie_info", status: "failed", error: "Indic\xE1 el t\xEDtulo." };
    const TMDB_BEARER = process.env.TMDB_BEARER_TOKEN || "";
    const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
    const tmdbHeaders = TMDB_BEARER ? { "Authorization": `Bearer ${TMDB_BEARER}`, "Content-Type": "application/json" } : {};
    const tmdbAuthParam = TMDB_BEARER ? "" : TMDB_API_KEY ? `&api_key=${TMDB_API_KEY}` : "";
    const tmdbEnabled = Boolean(TMDB_BEARER || TMDB_API_KEY);
    let tmdbData = {};
    if (tmdbEnabled) {
      try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}&language=es-ES${tmdbAuthParam}`;
        const searchRes = await fetch(searchUrl, {
          headers: tmdbHeaders,
          signal: AbortSignal.timeout(9e3)
        });
        const searchData = await searchRes.json();
        const first = searchData.results?.[0];
        if (first) {
          tmdbData.poster = first.poster_path ? `https://image.tmdb.org/t/p/w500${first.poster_path}` : void 0;
          tmdbData.rating = typeof first.vote_average === "number" ? Math.round(first.vote_average * 10) / 10 : void 0;
          tmdbData.releaseDate = first.release_date;
          tmdbData.overview = first.overview;
          const detailsUrl = `https://api.themoviedb.org/3/movie/${first.id}?language=es-ES${tmdbAuthParam}&append_to_response=credits`;
          const detailsRes = await fetch(detailsUrl, {
            headers: tmdbHeaders,
            signal: AbortSignal.timeout(9e3)
          });
          const details = await detailsRes.json();
          if (details.runtime) tmdbData.runtime = `${details.runtime} min`;
          if (details.genres) tmdbData.genres = details.genres.map((g) => g.name);
          if (details.credits?.crew) {
            const dir = details.credits.crew.find((c) => c.job === "Director");
            if (dir) tmdbData.director = dir.name;
          }
          if (details.credits?.cast) {
            tmdbData.cast = details.credits.cast.slice(0, 5).map((c) => c.name);
          }
        }
      } catch (err) {
        console.warn("[Koru] movie_info TMDB fetch failed (continuing with Wikipedia only):", err instanceof Error ? err.message : err);
      }
    }
    try {
      const searchQuery = year ? `${title} ${year} pel\xEDcula` : `${title} pel\xEDcula`;
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
      const data = await res.json();
      const results = data.query?.search ?? [];
      const wikiExtract = results.length > 0 ? await (async () => {
        try {
          const firstTitle = results[0].title;
          const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
          const summary = await summaryRes.json();
          return {
            text: summary.extract,
            sourceUrl: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`,
            snippet: results[0].snippet?.replace(/<[^>]+>/g, ""),
            sourceTitle: firstTitle
          };
        } catch {
          return null;
        }
      })() : null;
      const hasTmdbData = Boolean(tmdbData.poster || tmdbData.overview || tmdbData.rating);
      const wikiFoundMovie = wikiExtract && wikiExtract.text && // Verificar que el extracto de Wikipedia realmente trata sobre una película
      // (no sobre el sentimiento "obsesión" u otros significados)
      /\b(pel[ií]cula|film|movie|director|estren|cinematogr|actriz|actor|drama|thriller|comedia|terror|acci[oó]n)\b/i.test(wikiExtract.text);
      if (!hasTmdbData && !wikiFoundMovie) {
        return {
          type: "movie_info",
          status: "failed",
          error: `No pude encontrar la pel\xEDcula "${title}" en mis fuentes. Prob\xE1 con web_search.`,
          query: title
        };
      }
      const text = tmdbData.overview || wikiExtract?.text || `Encontr\xE9 informaci\xF3n sobre ${title}.`;
      return {
        type: "movie_info",
        status: "ok",
        title,
        text,
        poster: tmdbData.poster,
        rating: tmdbData.rating,
        releaseDate: tmdbData.releaseDate,
        genres: tmdbData.genres,
        runtime: tmdbData.runtime,
        director: tmdbData.director,
        cast: tmdbData.cast,
        sources: wikiExtract?.sourceUrl ? [{ title: wikiExtract.sourceTitle ?? title, url: wikiExtract.sourceUrl, domain: "wikipedia.org", snippet: wikiExtract.snippet ?? "" }] : []
      };
    } catch (err) {
      console.warn("[Koru] movie_info Wikipedia fetch failed:", err instanceof Error ? err.message : err);
      if (tmdbData.poster || tmdbData.overview) {
        return {
          type: "movie_info",
          status: "ok",
          title,
          text: tmdbData.overview ?? `Encontr\xE9 informaci\xF3n sobre ${title}.`,
          poster: tmdbData.poster,
          rating: tmdbData.rating,
          releaseDate: tmdbData.releaseDate,
          genres: tmdbData.genres,
          runtime: tmdbData.runtime,
          director: tmdbData.director,
          cast: tmdbData.cast,
          sources: []
        };
      }
      return { type: "movie_info", status: "failed", error: `No pude buscar informaci\xF3n sobre ${title}.` };
    }
  }
};
var bookInfo = {
  definition: defineTool(
    "book_info",
    "Sinopsis, autor, a\xF1o, g\xE9nero y d\xF3nde comprar de un libro. \xDAsala cuando el usuario diga 'de qu\xE9 trata 1984?', 'info del \xFAltimo Murakami', 'autor de El Nombre de la Rosa'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "T\xEDtulo del libro." },
        author: { type: "string", description: "Autor opcional." }
      },
      required: ["title"]
    }
  ),
  policy: policies.readonly("Lee info de Open Library."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const author = String(args.author ?? "").trim();
    if (!title) return { type: "book_info", status: "failed", error: "Indic\xE1 el t\xEDtulo." };
    const cacheKey = `book:${title.toLowerCase()}:${author.toLowerCase()}`;
    const book = await cached(cacheKey, ttls.reference, async () => {
      const params = new URLSearchParams({ title });
      if (author) params.set("author", author);
      const r = await fetchJson(
        `https://openlibrary.org/search.json?${params.toString()}&limit=1`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok || !r.data.docs?.length) return null;
      return r.data.docs[0];
    });
    if (!book) {
      return { type: "book_info", status: "ok", title, note: `No encontr\xE9 "${title}" en Open Library.` };
    }
    return {
      type: "book_info",
      status: "ok",
      title: book.title ?? title,
      author: book.authors?.[0]?.name,
      firstPublished: book.first_publish_date,
      pages: book.number_of_pages_median,
      coverUrl: book.cover?.medium,
      openLibraryUrl: book.key ? `https://openlibrary.org${book.key}` : void 0,
      source: "Open Library"
    };
  }
};
var RAWG_KEY = process.env.RAWG_API_KEY || "1";
var RAWG_BASE = "https://api.rawg.io/api";
var gameInfo = {
  definition: defineTool(
    "game_info",
    "Informaci\xF3n y rese\xF1a de un videojuego: rating, metacritic, g\xE9neros, plataformas, desarrollador, fecha de lanzamiento, sinopsis. \xDAsala cuando el usuario diga 'rese\xF1a del juego X', 'informaci\xF3n de Y', 'c\xF3mo es Z', 'an\xE1lisis de W'. Devuelve datos estructurados desde RAWG con sinopsis de Wikipedia.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "T\xEDtulo del videojuego." }
      },
      required: ["title"]
    }
  ),
  policy: policies.readonly("Lee info de RAWG y Wikipedia."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    if (!title) return { type: "game_info", status: "failed", error: "Indic\xE1 el t\xEDtulo del juego." };
    let game = null;
    try {
      const searchRes = await fetchJson(
        `${RAWG_BASE}/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=1`,
        { timeoutMs: 9e3 }
      );
      if (searchRes.ok && searchRes.data.results?.length) {
        const id = searchRes.data.results[0].id;
        if (id) {
          const detailRes = await fetchJson(
            `${RAWG_BASE}/games/${id}?key=${RAWG_KEY}`,
            { timeoutMs: 9e3 }
          );
          if (detailRes.ok) game = detailRes.data;
        }
      }
    } catch (err) {
      console.warn("[Koru] game_info RAWG fetch failed:", err instanceof Error ? err.message : err);
    }
    if (!game) {
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${title} video game`)}&format=json&origin=*&srlimit=1`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const wikiTitle = searchData.query?.search?.[0]?.title;
          if (wikiTitle) {
            const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
            if (summaryRes.ok) {
              const summary = await summaryRes.json();
              if (summary.extract) {
                return {
                  type: "game_info",
                  status: "ok",
                  title: summary.title ?? title,
                  description: summary.extract.slice(0, 1500),
                  backgroundImage: summary.thumbnail?.source,
                  sources: [{ title: summary.title ?? title, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`, domain: "wikipedia.org", snippet: summary.extract.slice(0, 200) }],
                  source: "Wikipedia"
                };
              }
            }
          }
        }
      } catch {
      }
      return { type: "game_info", status: "failed", error: `No encontr\xE9 el juego "${title}".` };
    }
    let description = game.description_raw ?? game.description ?? "";
    let wikiUrl;
    description = description.replace(/<[^>]+>/g, "");
    if (description.length < 200) {
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${title} video game`)}&format=json&origin=*&srlimit=1`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const wikiTitle = searchData.query?.search?.[0]?.title;
          if (wikiTitle) {
            const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS });
            if (summaryRes.ok) {
              const summary = await summaryRes.json();
              if (summary.extract && summary.extract.length > description.length) {
                description = summary.extract;
                wikiUrl = summary.content_urls?.desktop?.page;
              }
            }
          }
        }
      } catch {
      }
    }
    return {
      type: "game_info",
      status: "ok",
      title: game.name ?? title,
      released: game.released,
      backgroundImage: game.background_image,
      description: description.slice(0, 1500),
      rating: typeof game.rating === "number" ? game.rating : void 0,
      metacritic: game.metacritic,
      playtime: game.playtime,
      genres: Array.isArray(game.genres) ? game.genres.map((g) => g.name).filter(Boolean) : void 0,
      platforms: Array.isArray(game.platforms) ? game.platforms.map((p) => p.platform?.name).filter(Boolean) : void 0,
      developer: Array.isArray(game.developers) ? game.developers.map((d) => d.name).filter(Boolean).join(", ") : void 0,
      publisher: Array.isArray(game.publishers) ? game.publishers.map((p) => p.name).filter(Boolean).join(", ") : void 0,
      publishers: Array.isArray(game.publishers) ? game.publishers.map((p) => p.name).filter(Boolean) : void 0,
      website: game.website,
      esrb: game.esrb_rating?.name,
      sources: [
        { title: game.name ?? title, url: `https://rawg.io/games/${game.id ?? ""}`, domain: "rawg.io", snippet: description.slice(0, 200) },
        ...wikiUrl ? [{ title: `${title} (Wikipedia)`, url: wikiUrl, domain: "wikipedia.org", snippet: description.slice(0, 200) }] : []
      ],
      source: "RAWG + Wikipedia"
    };
  }
};

// koru-mvp/src/tools/people/index.ts
var peopleTools = [personInfo, personFollow, personFilmography, movieInfo, bookInfo, gameInfo];

// koru-mvp/src/tools/apps/apps.ts
var appRecommend = {
  definition: defineTool(
    "app_recommend",
    "Recomienda apps m\xF3viles o de PC seg\xFAn la necesidad del usuario, con rating y por qu\xE9. \xDAsala cuando el usuario diga 'app para tomar notas en Android', 'mejor lector de RSS en iOS', 'app de meditaci\xF3n gratuita', 'editor de video gratis en PC'. Lee rese\xF1as de varias fuentes.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Necesidad o categor\xEDa (ej: 'tomar notas', 'meditar')." },
        platform: { type: "string", enum: ["android", "ios", "pc", "any"], default: "any" }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee rese\xF1as de apps."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const platform = String(args.platform ?? "any");
    if (!query) return { type: "app_recommend", status: "failed", error: "Indic\xE1 la necesidad." };
    const sources = usableSources(await searchAndEnrich(`mejor app ${query} ${platform === "any" ? "" : platform} recomendaci\xF3n rese\xF1a rating gratis`, 5));
    return {
      type: "app_recommend",
      status: "ok",
      query,
      platform,
      sources,
      note: sources.length ? "Apps sugeridas con fuentes cruzadas. Revisa ratings actuales en la tienda." : "No encontr\xE9 recomendaciones \xFAtiles."
    };
  }
};
var gameRecommend = {
  definition: defineTool(
    "game_recommend",
    "Recomienda juegos seg\xFAn gusto/plataforma con rating y rese\xF1as. \xDAsala cuando el usuario diga 'juegos parecidos a Stardew Valley', 'indies buenos en Steam', 'juego de Switch para jugar con amigos', 'RPG para PC'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "G\xE9nero, referencia o preferencia." },
        platform: { type: "string", enum: ["pc", "playstation", "xbox", "switch", "mobile", "any"], default: "any" }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee rese\xF1as de juegos."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const platform = String(args.platform ?? "any");
    if (!query) return { type: "game_recommend", status: "failed", error: "Indic\xE1 la preferencia." };
    const sources = usableSources(await searchAndEnrich(`juegos recomendados ${query} ${platform === "any" ? "" : platform} rese\xF1as rating`, 5));
    return {
      type: "game_recommend",
      status: "ok",
      query,
      platform,
      sources,
      note: sources.length ? "Sugerencias con fuentes cruzadas." : "No encontr\xE9 recomendaciones."
    };
  }
};
var gameDeals = {
  definition: defineTool(
    "game_deals",
    "Ofertas y descuentos actuales en juegos de Steam, GOG, Epic y otras tiendas. \xDAsala cuando el usuario diga 'ofertas de Steam hoy', 'algo barato y bueno en GOG', 'descuentos en juegos', 'promos Epic'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "T\xEDtulo opcional espec\xEDfico a buscar." },
        minRating: { type: "number", description: "Rating m\xEDnimo (0-10). Default 7." },
        maxPrice: { type: "number", description: "Precio m\xE1ximo en USD. Default sin l\xEDmite." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee ofertas de CheapShark."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const minRating = Number(args.minRating ?? 7);
    const maxPrice = args.maxPrice != null ? Number(args.maxPrice) : void 0;
    const cacheKey = `deals:${title.toLowerCase()}:${minRating}:${maxPrice ?? "any"}`;
    const deals = await cached(cacheKey, ttls.trending, async () => {
      const params = new URLSearchParams();
      params.set("sortBy", "Deal Rating");
      params.set("pageSize", "15");
      if (title) params.set("title", title);
      if (minRating) params.set("AAA", "1");
      const r = await fetchJson(
        `https://www.cheapshark.com/api/1.0/deals?${params.toString()}`,
        { timeoutMs: 1e4 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data ?? [];
    });
    const filtered = deals.filter((d) => Number(d.dealRating ?? 0) >= minRating).filter((d) => maxPrice === void 0 || Number(d.salePrice ?? 999) <= maxPrice).slice(0, 10).map((d) => ({
      title: d.title,
      salePrice: d.salePrice ? `${d.salePrice} USD` : void 0,
      normalPrice: d.normalPrice ? `${d.normalPrice} USD` : void 0,
      savingsPct: d.savings ? `${Number(d.savings).toFixed(0)}%` : void 0,
      dealRating: d.dealRating,
      dealUrl: d.dealID ? `https://www.cheapshark.com/redirect?dealID=${d.dealID}` : void 0,
      thumb: d.thumb
    }));
    return {
      type: "game_deals",
      status: "ok",
      title: title || "destacadas",
      deals: filtered,
      source: "CheapShark",
      sourceUrl: "https://www.cheapshark.com/"
    };
  }
};
var appDeals = {
  definition: defineTool(
    "app_deals",
    "Apps de pago gratis por tiempo limitado u ofertas en apps. \xDAsala cuando el usuario diga 'apps gratis hoy', 'promociones en Play Store', 'ofertas en apps de iOS'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        platform: { type: "string", enum: ["android", "ios", "any"], default: "any" }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee promos de apps."),
  async run(args) {
    const platform = String(args.platform ?? "any");
    const sources = usableSources(await searchAndEnrich(`apps gratis oferta ${platform} hoy temporalmente gratis promoci\xF3n`, 5));
    return {
      type: "app_deals",
      status: "ok",
      platform,
      sources,
      note: "Ofertas pueden caducar r\xE1pido. Revisa la tienda antes de instalar."
    };
  }
};

// koru-mvp/src/tools/apps/index.ts
var appsTools = [appRecommend, gameRecommend, gameDeals, appDeals];

// koru-mvp/src/tools/docs/documents.ts
var docCreateMd = {
  definition: defineTool(
    "doc_create_md",
    "Genera un documento Markdown (.md) con estructura: encabezados, listas, c\xF3digo, tablas. \xDAsala cuando el usuario diga 'hac\xE9 un doc con la minuta', 'escrib\xED un README', 'document\xE1 esta idea'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Contenido o instrucciones de qu\xE9 debe llevar el doc." }
      },
      required: ["title", "content"]
    }
  ),
  policy: policies.localWrite("Genera documento local."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!title || !content) return { type: "doc_create_md", status: "failed", error: "Indic\xE1 t\xEDtulo y contenido." };
    const body = `# ${title}

_Generado por Koru el ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}._

${content}
`;
    const artifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "documento"}.md`,
      kind: "markdown",
      mimeType: "text/markdown",
      sizeLabel: `${body.length} caracteres`,
      content: body
    };
    return {
      type: "doc_create_md",
      status: "ok",
      title,
      artifact,
      block: { type: "resource_bundle", title, files: [artifact] }
    };
  }
};
var docCreatePdf = {
  definition: defineTool(
    "doc_create_pdf",
    "Genera un PDF con formato (encabezados, p\xE1rrafos, tablas). \xDAsala cuando el usuario diga 'pas\xE1 eso a PDF', 'hac\xE9 un informe en PDF del viaje', 'documento PDF con estos apuntes'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string" }
      },
      required: ["title", "content"]
    }
  ),
  policy: policies.localWrite("Genera documento HTML listo para imprimir/PDF."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!title || !content) return { type: "doc_create_pdf", status: "failed", error: "Indic\xE1 t\xEDtulo y contenido." };
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}h1{border-bottom:2px solid #444;padding-bottom:8px}</style>
</head><body><h1>${title}</h1><p><em>Generado por Koru el ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.</em></p>${content.split(/\n+/).map((p) => `<p>${p}</p>`).join("\n")}</body></html>`;
    const artifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "documento"}.html`,
      kind: "document",
      mimeType: "text/html",
      sizeLabel: `${html.length} caracteres (imprimir como PDF)`,
      content: html
    };
    return {
      type: "doc_create_pdf",
      status: "ok",
      title,
      artifact,
      note: "Se gener\xF3 HTML listo para imprimir como PDF. \xC1brelo y usa Ctrl+P \u2192 Guardar como PDF.",
      block: { type: "resource_bundle", title, files: [artifact] }
    };
  }
};
var docCreateWord = {
  definition: defineTool(
    "doc_create_word",
    "Genera un documento Word (.doc) editable. \xDAsala cuando el usuario diga 'hac\xE9 un CV en Word', 'documento con estos apuntes', 'Word con la minuta'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string" }
      },
      required: ["title", "content"]
    }
  ),
  policy: policies.localWrite("Genera documento Word-compatible."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!title || !content) return { type: "doc_create_word", status: "failed", error: "Indic\xE1 t\xEDtulo y contenido." };
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${content.split(/\n+/).map((p) => `<p>${p}</p>`).join("\n")}</body></html>`;
    const artifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "documento"}.doc`,
      kind: "document",
      mimeType: "application/msword",
      sizeLabel: `${html.length} caracteres`,
      content: html
    };
    return {
      type: "doc_create_word",
      status: "ok",
      title,
      artifact,
      block: { type: "resource_bundle", title, files: [artifact] }
    };
  }
};
var docCreateExcel = {
  definition: defineTool(
    "doc_create_excel",
    "Genera una planilla Excel (.csv) con datos o tabla. \xDAsala cuando el usuario diga 'Excel con mis gastos del mes', 'planilla de notas del curso', 'tabla en Excel'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Filas de la tabla (cada fila es un array de celdas)." }
      },
      required: ["title", "rows"]
    }
  ),
  policy: policies.localWrite("Genera CSV/Excel."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const rows = Array.isArray(args.rows) ? args.rows : [];
    if (!title || rows.length === 0) return { type: "doc_create_excel", status: "failed", error: "Indic\xE1 t\xEDtulo y filas." };
    const escape = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map((row) => (Array.isArray(row) ? row : []).map((c) => escape(String(c))).join(",")).join("\n");
    const artifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 40) || "planilla"}.csv`,
      kind: "spreadsheet",
      mimeType: "text/csv",
      sizeLabel: `${rows.length} filas \xD7 ${rows[0]?.length ?? 0} columnas`,
      content: csv
    };
    return {
      type: "doc_create_excel",
      status: "ok",
      title,
      artifact,
      note: "Se gener\xF3 CSV (Excel lo abre directo). Para formato nativo .xlsx se necesita lib adicional.",
      block: { type: "resource_bundle", title, files: [artifact] }
    };
  }
};
var ocrText = {
  definition: defineTool(
    "ocr_text",
    "Extrae texto de una imagen (ticket, cartel, documento, captura). \xDAsala cuando el usuario diga 'le\xE9 este ticket de compra', 'qu\xE9 dice este cartel?', 'extra\xE9 el texto de esta imagen'. Usa VLM cloud (z-ai-web-dev-sdk).",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        imageUrl: { type: "string", description: "URL o data URL de la imagen." },
        prompt: { type: "string", description: "Qu\xE9 buscar (ej: 'total', 'fecha', 'productos')." }
      },
      required: ["imageUrl"]
    }
  ),
  policy: policies.readonly("Procesa imagen con VLM cloud."),
  async run(args, _ctx) {
    const imageUrl = String(args.imageUrl ?? "").trim();
    const prompt = String(args.prompt ?? "Extra\xE9 todo el texto visible en la imagen, preservando estructura.").trim();
    if (!imageUrl) return { type: "ocr_text", status: "failed", error: "Indic\xE1 la imagen." };
    try {
      let base64;
      if (imageUrl.startsWith("data:")) {
        base64 = imageUrl.split(",")[1] ?? "";
      } else {
        const imgRes = await fetch(imageUrl);
        const buf = await imgRes.arrayBuffer();
        base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      }
      const vlmRes = await fetch("/api/koru/vlm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, prompt })
      });
      if (!vlmRes.ok) throw new Error(`VLM HTTP ${vlmRes.status}`);
      const data = await vlmRes.json();
      const text = (data.text ?? "").trim();
      if (!text) return { type: "ocr_text", status: "failed", error: "No pude extraer texto de la imagen." };
      return { type: "ocr_text", status: "ok", text, prompt };
    } catch (err) {
      console.warn("[Koru] ocr_text VLM failed:", err instanceof Error ? err.message : err);
      return { type: "ocr_text", status: "failed", error: "No pude procesar la imagen. Intent\xE1 subirla directamente por el chat." };
    }
  }
};
var dataAnalyze = {
  definition: defineTool(
    "data_analyze",
    "Analiza datos pegados (CSV, tabla, lista de n\xFAmeros) calculando media, mediana, suma, m\xE1x, m\xEDn, tendencias y top. \xDAsala cuando el usuario diga 'analiz\xE1 estos gastos', 'tendencia de mis ventas', 'resumen estad\xEDstico de estos datos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        data: { type: "string", description: "Datos pegados (CSV, una fila por l\xEDnea, o lista de n\xFAmeros)." },
        focus: { type: "string", description: "Qu\xE9 analizar (ej: 'tendencia', 'top 5', 'promedio mensual')." }
      },
      required: ["data"]
    }
  ),
  policy: policies.readonly("C\xE1lculo estad\xEDstico local."),
  async run(args) {
    const raw = String(args.data ?? "").trim();
    const focus = String(args.focus ?? "resumen").trim();
    if (!raw) return { type: "data_analyze", status: "failed", error: "Peg\xE1 los datos." };
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const numbers = [];
    let csvMode = false;
    for (const line of lines) {
      const cells = line.split(/[,\t;|]/).map((c) => c.trim());
      if (cells.length > 1) {
        csvMode = true;
        break;
      }
      const n = Number(cells[0]);
      if (Number.isFinite(n)) numbers.push(n);
    }
    if (csvMode) {
      return {
        type: "data_analyze",
        status: "ok",
        mode: "csv",
        rows: lines.length,
        focus,
        note: "Datos tabulares detectados. Para an\xE1lisis profundo de CSV, el LLM del turno puede procesar el contenido directamente."
      };
    }
    if (numbers.length === 0) {
      return { type: "data_analyze", status: "failed", error: "No pude extraer n\xFAmeros de los datos." };
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((s, n) => s + n, 0);
    const mean = sum / numbers.length;
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return {
      type: "data_analyze",
      status: "ok",
      mode: "numbers",
      focus,
      count: numbers.length,
      sum: Number(sum.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      min,
      max,
      range: Number((max - min).toFixed(2)),
      top5: sorted.slice(-5).reverse(),
      bottom5: sorted.slice(0, 5)
    };
  }
};
var dataChart = {
  definition: defineTool(
    "data_chart",
    "Genera un gr\xE1fico (l\xEDneas, barras, torta) a partir de datos. \xDAsala cuando el usuario diga 'gr\xE1fico de mis gastos por mes', 'barras de mis h\xE1bitos de sue\xF1o', 'visualizar esta serie'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        type: { type: "string", enum: ["bar", "line", "pie"], default: "bar" },
        labels: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "number" } }
      },
      required: ["title", "labels", "values"]
    }
  ),
  policy: policies.localWrite("Genera HTML con gr\xE1fico."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const chartType = String(args.type ?? "bar");
    const labels = Array.isArray(args.labels) ? args.labels.map(String) : [];
    const values = Array.isArray(args.values) ? args.values.map(Number) : [];
    if (!title || labels.length === 0 || values.length === 0) {
      return { type: "data_chart", status: "failed", error: "Indic\xE1 t\xEDtulo, etiquetas y valores." };
    }
    const max = Math.max(...values, 1);
    const width = 480;
    const barH = chartType === "bar" ? 28 : 0;
    const chartH = chartType === "bar" ? labels.length * (barH + 6) + 30 : 200;
    let svgBody = "";
    if (chartType === "bar") {
      labels.forEach((label, i) => {
        const w = values[i] / max * (width - 160);
        const y = i * (barH + 6) + 10;
        svgBody += `<rect x="150" y="${y}" width="${w}" height="${barH}" fill="#3b82f6" rx="3"/><text x="10" y="${y + barH / 2 + 5}" font-size="13">${label}</text><text x="${155 + w}" y="${y + barH / 2 + 5}" font-size="13">${values[i]}</text>`;
      });
    } else if (chartType === "line") {
      const stepX = (width - 60) / Math.max(values.length - 1, 1);
      const points = values.map((v, i) => `${30 + i * stepX},${chartH - 20 - v / max * (chartH - 40)}`).join(" ");
      svgBody = `<polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2"/>${labels.map((l, i) => `<text x="${30 + i * stepX - 10}" y="${chartH - 5}" font-size="11">${l}</text>`).join("")}`;
    } else {
      const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
      let acc = 0;
      const cx = width / 2;
      const cy = chartH / 2;
      const r = Math.min(cx, cy) - 10;
      const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
      values.forEach((v, i) => {
        const start = acc / total * 2 * Math.PI;
        acc += Math.abs(v);
        const end = acc / total * 2 * Math.PI;
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        const large = end - start > Math.PI ? 1 : 0;
        svgBody += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>`;
        const midA = (start + end) / 2;
        svgBody += `<text x="${cx + r * 0.6 * Math.cos(midA)}" y="${cy + r * 0.6 * Math.sin(midA)}" font-size="11" fill="white">${labels[i]}</text>`;
      });
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${chartH}"><rect width="100%" height="100%" fill="white"/><text x="10" y="20" font-size="15" font-weight="bold">${title}</text>${svgBody}</svg>`;
    const artifact = {
      name: `${title.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 30) || "grafico"}.svg`,
      kind: "document",
      mimeType: "image/svg+xml",
      sizeLabel: `${labels.length} puntos`,
      content: svg
    };
    return { type: "data_chart", status: "ok", title, chartType, artifact, block: { type: "resource_bundle", title, files: [artifact] } };
  }
};

// koru-mvp/src/tools/docs/tasks.ts
var noteWrite = {
  definition: defineTool(
    "note_write",
    "Crea una nota de texto r\xE1pida. \xDAsala cuando el usuario diga 'anota: comprar pan', 'nota: idea de regalo para Lu', 'pon\xE9 en notas que debo llamar al m\xE9dico'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Contenido de la nota." },
        collection: { type: "string", description: "Carpeta/categor\xEDa opcional (ej: 'Ideas', 'Trabajo')." }
      },
      required: ["text"]
    }
  ),
  policy: policies.localWrite("Guarda nota."),
  async run(args) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "note_write", status: "failed", error: "Indic\xE1 el texto." };
    const record = {
      domain: "capture",
      kind: "idea",
      title: text.slice(0, 80) + (text.length > 80 ? "\u2026" : ""),
      value: text,
      collection: args.collection ? String(args.collection) : "Notas"
    };
    return {
      type: "note_write",
      status: "ok",
      text,
      records: [record],
      block: { type: "saved_record", title: "Nota guardada", records: [record] }
    };
  }
};
var noteShow = {
  definition: defineTool(
    "note_show",
    "Muestra las notas guardadas. \xDAsala cuando el usuario diga 'mostrame mis notas', 'qu\xE9 anot\xE9 ayer?', 'notas de esta semana'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        collection: { type: "string", description: "Filtrar por carpeta/categor\xEDa opcional." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee notas guardadas."),
  async run(args, ctx) {
    const collection = args.collection ? String(args.collection) : null;
    const notes = (ctx.state.records ?? []).filter((r) => r.kind === "idea" && (!collection || r.collection === collection)).slice(-15).reverse().map((r) => ({ title: r.title, text: r.value, collection: r.collection, date: r.createdAt.slice(0, 10) }));
    return { type: "note_show", status: "ok", collection, notes };
  }
};
var noteSearch = {
  definition: defineTool(
    "note_search",
    "Busca en tus notas por texto o palabra clave. \xDAsala cuando el usuario diga 'qu\xE9 anot\xE9 sobre vacaciones?', 'busc\xE1 en mis notas X', 'tengo algo sobre contabilidad?'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto a buscar." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Busca en notas."),
  async run(args, ctx) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "note_search", status: "failed", error: "Indic\xE1 qu\xE9 buscar." };
    const matches = (ctx.state.records ?? []).filter((r) => (r.kind === "idea" || r.kind === "recommendation") && `${r.title} ${r.value} ${r.notes ?? ""}`.toLowerCase().includes(q)).slice(-15).reverse().map((r) => ({ title: r.title, text: r.value, date: r.createdAt.slice(0, 10) }));
    return { type: "note_search", status: "ok", query: args.query, matches };
  }
};
var projectCreate = {
  definition: defineTool(
    "project_create",
    "Crea un proyecto con nombre que agrupa notas, recursos y tareas relacionadas. \xDAsala cuando el usuario diga 'cre\xE1 el proyecto Viaje a Jap\xF3n', 'proyecto Renovar cocina', 'nuevo proyecto Tesis'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del proyecto." },
        description: { type: "string" }
      },
      required: ["name"]
    }
  ),
  policy: policies.localWrite("Crea proyecto como memory."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "project_create", status: "failed", error: "Indic\xE1 el nombre." };
    return {
      type: "project_create",
      status: "ok",
      name,
      description: args.description ? String(args.description) : void 0,
      memoryCandidates: [{
        kind: "goal",
        text: `Proyecto: ${name}${args.description ? ` \u2014 ${args.description}` : ""}`,
        confidence: 0.95,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: name,
        useForSuggestions: true
      }]
    };
  }
};
var projectAdd = {
  definition: defineTool(
    "project_add",
    "Agrega una nota, recurso o tarea a un proyecto existente. \xDAsala cuando el usuario diga 'sum\xE1 esto al proyecto Viaje a Jap\xF3n', 'agreg\xE1 este link al proyecto Renovar'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        project: { type: "string", description: "Nombre del proyecto." },
        title: { type: "string" },
        note: { type: "string" },
        url: { type: "string" }
      },
      required: ["project", "title"]
    }
  ),
  policy: policies.localWrite("Agrega item a proyecto."),
  async run(args) {
    const project = String(args.project ?? "").trim();
    const title = String(args.title ?? "").trim();
    if (!project || !title) return { type: "project_add", status: "failed", error: "Indic\xE1 proyecto y t\xEDtulo." };
    const record = {
      domain: "capture",
      kind: "idea",
      title,
      notes: args.note ? String(args.note) : void 0,
      url: args.url ? String(args.url) : void 0,
      collection: project
    };
    return {
      type: "project_add",
      status: "ok",
      project,
      records: [record],
      block: { type: "saved_record", title: `Agregado a ${project}`, records: [record] }
    };
  }
};
var projectShow = {
  definition: defineTool(
    "project_show",
    "Muestra todo lo guardado de un proyecto. \xDAsala cuando el usuario diga 'mostrame el proyecto Viaje a Jap\xF3n', 'qu\xE9 tengo en Renovar cocina'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        project: { type: "string", description: "Nombre del proyecto." }
      },
      required: ["project"]
    }
  ),
  policy: policies.readonly("Lee proyecto guardado."),
  async run(args, ctx) {
    const project = String(args.project ?? "").trim();
    if (!project) return { type: "project_show", status: "failed", error: "Indic\xE1 el proyecto." };
    const items = (ctx.state.records ?? []).filter((r) => r.collection === project).slice(-20).reverse().map((r) => ({ title: r.title, note: r.notes, url: r.url, date: r.createdAt.slice(0, 10) }));
    return { type: "project_show", status: "ok", project, items };
  }
};
var taskCreate = {
  definition: defineTool(
    "task_create",
    "Crea una tarea con fecha y prioridad. \xDAsala cuando el usuario diga 'tarea: llamar al dentista ma\xF1ana', 'para el viernes: enviar CV', 'agreg\xE1 a pendientes comprar regalo'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        dueText: { type: "string", description: "Fecha natural (ej: 'ma\xF1ana', 'el viernes', 'pr\xF3xima semana')." },
        priority: { type: "string", enum: ["Alta", "Media", "Baja"], default: "Media" }
      },
      required: ["title"]
    }
  ),
  policy: policies.localWrite("Crea tarea/commitment."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const dueText = String(args.dueText ?? "").trim();
    if (!title) return { type: "task_create", status: "failed", error: "Indic\xE1 la tarea." };
    const commitment = {
      title,
      dueHint: dueText || "sin fecha",
      status: "open"
    };
    const record = {
      domain: "work",
      kind: "deadline",
      title,
      dueHint: dueText,
      notes: args.priority ? `Prioridad: ${args.priority}` : void 0
    };
    return {
      type: "task_create",
      status: "ok",
      commitments: [commitment],
      records: [record],
      block: { type: "reminder", title, dueText: dueText || "sin fecha", note: args.priority ? `Prioridad ${args.priority}` : void 0 }
    };
  }
};
var taskList = {
  definition: defineTool(
    "task_list",
    "Lista las tareas pendientes ordenadas por prioridad/fecha. \xDAsala cuando el usuario diga 'qu\xE9 tengo pendiente?', 'tareas de esta semana', 'lista de pendientes'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["open", "done", "all"], default: "open" }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lista tareas guardadas."),
  async run(args, ctx) {
    const status = String(args.status ?? "open");
    const tasks = (ctx.state.commitments ?? []).filter((c) => status === "all" || c.status === status).slice(-20).reverse().map((c) => ({ title: c.title, dueHint: c.dueHint, status: c.status, recurrence: c.recurrence }));
    return { type: "task_list", status: "ok", filter: status, tasks };
  }
};
var taskDone = {
  definition: defineTool(
    "task_done",
    "Marca una tarea como completada. \xDAsala cuando el usuario diga 'listo la de dentista', 'complet\xE9 el informe', 'ya hice X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto para encontrar la tarea." }
      },
      required: ["query"]
    }
  ),
  policy: policies.localWrite("Marca tarea como hecha."),
  async run(args, ctx) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "task_done", status: "failed", error: "Indic\xE1 qu\xE9 tarea completar." };
    const match = (ctx.state.commitments ?? []).find((c) => c.status === "open" && c.title.toLowerCase().includes(q));
    if (!match) {
      return { type: "task_done", status: "ok", found: false, query: args.query, note: "No encontr\xE9 esa tarea abierta." };
    }
    return { type: "task_done", status: "ok", found: true, title: match.title, note: "El store la marcar\xE1 como done cuando apliques el cambio." };
  }
};
var calendarAdd = {
  definition: defineTool(
    "calendar_add",
    "Agrega una cita al calendario local con fecha, hora y ubicaci\xF3n. \xDAsala cuando el usuario diga 'cita con el m\xE9dico el 15 a las 10', 'cumplea\xF1os de Marta el 22', 'reuni\xF3n el jueves 16hs'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "Fecha (YYYY-MM-DD o natural)." },
        time: { type: "string", description: "Hora (HH:MM o natural)." },
        location: { type: "string" }
      },
      required: ["title", "date"]
    }
  ),
  policy: policies.localWrite("Crea evento de calendario."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const date = String(args.date ?? "").trim();
    if (!title || !date) return { type: "calendar_add", status: "failed", error: "Indic\xE1 t\xEDtulo y fecha." };
    return {
      type: "calendar_add",
      status: "ok",
      title,
      date,
      time: args.time ? String(args.time) : void 0,
      location: args.location ? String(args.location) : void 0,
      note: "Evento local listo. Usa calendar_export_ics para sincronizar con Google/Apple Calendar."
    };
  }
};
var calendarShow = {
  definition: defineTool(
    "calendar_show",
    "Muestra los pr\xF3ximos eventos del calendario. \xDAsala cuando el usuario diga 'qu\xE9 tengo esta semana?', 'agenda de hoy', 'pr\xF3ximos eventos'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        days: { type: "number", description: "Ventana en d\xEDas. Default 7." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee agenda."),
  async run(args, ctx) {
    const days = Number(args.days ?? 7);
    const now = Date.now();
    const until = now + days * 24 * 60 * 60 * 1e3;
    const events = (ctx.state.calendarEvents ?? []).filter((e) => {
      const ts = new Date(e.startsAt).getTime();
      return Number.isFinite(ts) && ts >= now - 24 * 60 * 60 * 1e3 && ts <= until;
    }).sort((a, b) => a.startsAt < b.startsAt ? -1 : 1).slice(0, 15).map((e) => ({ title: e.title, startsAt: e.startsAt, location: e.location }));
    return { type: "calendar_show", status: "ok", days, events };
  }
};
var calendarExportIcs = {
  definition: defineTool(
    "calendar_export_ics",
    "Genera un archivo .ics con tus eventos para sincronizar con Google/Apple Calendar. \xDAsala cuando el usuario diga 'export\xE1 mi agenda a ICS', 'quiero mi calendario en Google Calendar'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        days: { type: "number", description: "Ventana en d\xEDas hacia adelante. Default 90." }
      },
      required: []
    }
  ),
  policy: policies.localWrite("Genera archivo ICS."),
  async run(args, ctx) {
    const days = Number(args.days ?? 90);
    const now = Date.now();
    const until = now + days * 24 * 60 * 60 * 1e3;
    const events = (ctx.state.calendarEvents ?? []).filter((e) => {
      const ts = new Date(e.startsAt).getTime();
      return Number.isFinite(ts) && ts >= now - 7 * 24 * 60 * 60 * 1e3 && ts <= until;
    });
    const fmt = (iso) => iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Koru//Local//ES"];
    for (const e of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${e.id}@koru`);
      lines.push(`DTSTAMP:${fmt((/* @__PURE__ */ new Date()).toISOString())}`);
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
      artifact: { name: "koru-agenda.ics", kind: "document", mimeType: "text/calendar", sizeLabel: `${events.length} eventos`, content },
      block: { type: "resource_bundle", title: "Agenda exportada", files: [{ name: "koru-agenda.ics", kind: "document", mimeType: "text/calendar", sizeLabel: `${events.length} eventos`, content }] }
    };
  }
};
var countdown = {
  definition: defineTool(
    "countdown",
    "Calcula cu\xE1nto falta (o cu\xE1nto pas\xF3) para una fecha/evento. \xDAsala cuando el usuario diga 'cu\xE1nto falta para mi cumplea\xF1os?', 'faltan para Navidad', 'cu\xE1ntos d\xEDas desde que empez\xF3 el a\xF1o'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string", description: "Fecha (YYYY-MM-DD o natural)." },
        label: { type: "string", description: "Nombre del evento opcional." }
      },
      required: ["date"]
    }
  ),
  policy: policies.readonly("C\xE1lculo de fechas local."),
  async run(args) {
    const dateStr = String(args.date ?? "").trim();
    if (!dateStr) return { type: "countdown", status: "failed", error: "Indic\xE1 la fecha." };
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      const lower = dateStr.toLowerCase().trim();
      const year = (/* @__PURE__ */ new Date()).getFullYear();
      const holidays2 = {
        navidad: () => {
          const d = new Date(year, 11, 25);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "nochebuena": () => {
          const d = new Date(year, 11, 24);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "fin de a\xF1o": () => {
          const d = new Date(year, 11, 31);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "a\xF1o nuevo": () => {
          const d = new Date(year + 1, 0, 1);
          return d;
        },
        "anio nuevo": () => {
          const d = new Date(year + 1, 0, 1);
          return d;
        },
        "reyes magos": () => {
          const d = new Date(year, 0, 6);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "dia del padre": () => {
          const d = new Date(year, 5, 15);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "dia de la madre": () => {
          const d = new Date(year, 9, 15);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "san valentin": () => {
          const d = new Date(year, 1, 14);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "dia del trabajo": () => {
          const d = new Date(year, 4, 1);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "halloween": () => {
          const d = new Date(year, 9, 31);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        },
        "pascua": () => {
          const d = new Date(year, 3, 20);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          return d;
        }
      };
      const matched = Object.keys(holidays2).find((k) => lower.includes(k));
      if (matched) {
        date.setTime(holidays2[matched]().getTime());
      }
    }
    if (Number.isNaN(date.getTime())) {
      const m = dateStr.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i);
      if (m) {
        const months = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
        const day = Number(m[1]);
        const month = months[m[2].toLowerCase()];
        if (month !== void 0) {
          const year = (/* @__PURE__ */ new Date()).getFullYear();
          const d = new Date(year, month, day);
          if (d.getTime() < Date.now()) d.setFullYear(year + 1);
          date.setTime(d.getTime());
        }
      }
    }
    if (Number.isNaN(date.getTime())) return { type: "countdown", status: "no_data", date: dateStr, error: `No pude interpretar "${dateStr}" como fecha. Prob\xE1 con "25 de diciembre" o "2025-12-25".` };
    const now = /* @__PURE__ */ new Date();
    const diffMs = date.getTime() - now.getTime();
    const days = Math.floor(Math.abs(diffMs) / (24 * 60 * 60 * 1e3));
    const hours = Math.floor(Math.abs(diffMs) % (24 * 60 * 60 * 1e3) / (60 * 60 * 1e3));
    return {
      type: "countdown",
      status: "ok",
      date: dateStr,
      label: args.label ? String(args.label) : void 0,
      targetDate: date.toISOString(),
      days,
      hours,
      direction: diffMs >= 0 ? "faltan" : "pasaron",
      note: `${diffMs >= 0 ? "Faltan" : "Pasaron"} ${days} d\xEDas y ${hours} horas${args.label ? ` para "${args.label}"` : ""}.`
    };
  }
};
var reminderSet = {
  definition: defineTool(
    "reminder_set",
    "Programa un recordatorio para una fecha/hora concreta. \xDAsala cuando el usuario diga 'recordame llamar a mam\xE1 a las 18', 'avisame el 20 del pago', 'no me dejes olvidar X ma\xF1ana'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        dueText: { type: "string", description: "Fecha/hora natural (ej: 'ma\xF1ana a las 9', 'el 20', 'en 3 horas')." },
        note: { type: "string" }
      },
      required: ["title", "dueText"]
    }
  ),
  policy: policies.localWrite("Crea recordatorio."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const dueText = String(args.dueText ?? "").trim();
    if (!title || !dueText) return { type: "reminder_set", status: "failed", error: "Indic\xE1 qu\xE9 y cu\xE1ndo." };
    const commitment = { title, dueHint: dueText, status: "open" };
    return {
      type: "reminder_set",
      status: "ok",
      commitments: [commitment],
      block: { type: "reminder", title, dueText, note: args.note ? String(args.note) : void 0 }
    };
  }
};
var alarmSet = {
  definition: defineTool(
    "alarm_set",
    "Crea una alarma a una hora concreta con repetici\xF3n opcional. \xDAsala cuando el usuario diga 'despertador 7am', 'alarma para recoger a los chicos a las 16', 'alarma diaria a las 6:30'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        time: { type: "string", description: "Hora (HH:MM o natural, ej: '07:00', '7 de la ma\xF1ana')." },
        repeat: { type: "string", description: "Repetici\xF3n (ej: 'diario', 'semanal', 'lunes a viernes')." },
        note: { type: "string" }
      },
      required: ["title", "time"]
    }
  ),
  policy: policies.localWrite("Crea alarma."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const time = String(args.time ?? "").trim();
    if (!title || !time) return { type: "alarm_set", status: "failed", error: "Indic\xE1 t\xEDtulo y hora." };
    const block = { type: "alarm", title, time, repeat: args.repeat ? String(args.repeat) : void 0, note: args.note ? String(args.note) : void 0 };
    const commitment = { title, dueHint: time, status: "open" };
    return { type: "alarm_set", status: "ok", block, commitments: [commitment] };
  }
};

// koru-mvp/src/tools/docs/productivity.ts
var summarizeUrl = {
  definition: defineTool(
    "summarize_url",
    "Resume un art\xEDculo o p\xE1gina web en 5 puntos clave. \xDAsala cuando el usuario diga 'resum\xED este art\xEDculo', 'de qu\xE9 va este link', 's\xEDntesis de esta URL'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string", description: "URL del art\xEDculo." },
        focus: { type: "string", description: "Aspecto a destacar (opcional)." }
      },
      required: ["url"]
    }
  ),
  policy: policies.readonly("Lee y resume URL p\xFAblica."),
  async run(args, ctx) {
    const url = String(args.url ?? "").trim();
    if (!url) return { type: "summarize_url", status: "failed", error: "Indic\xE1 la URL." };
    if (!ctx.chatFn) {
      return { type: "summarize_url", status: "not_configured", url, note: "Para resumir necesito el LLM local (Ollama). Configuralo en Settings." };
    }
    const sources = usableSources(await searchAndEnrich(url, 1));
    let dataCard = null;
    try {
      dataCard = extractionToDataCard(await validateWithCitations(String(args.focus ?? "resumen"), sources, ctx.chatFn));
    } catch (err) {
      console.warn("[Koru] productivity dataCard extraction failed:", err instanceof Error ? err.message : err);
    }
    return { type: "summarize_url", status: "ok", url, sources, dataCard };
  }
};
var summarizeText = {
  definition: defineTool(
    "summarize_text",
    "Resume cualquier texto pegado. \xDAsala cuando el usuario diga 'resum\xED estos apuntes', 's\xEDntesis de este email', 'acuortar este texto'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        focus: { type: "string" }
      },
      required: ["text"]
    }
  ),
  policy: policies.readonly("Resume texto local."),
  async run(args, ctx) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "summarize_text", status: "failed", error: "Peg\xE1 el texto." };
    if (!ctx.chatFn) return { type: "summarize_text", status: "not_configured", note: "Necesito el LLM local (Ollama) para resumir." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Sos un asistente que resume en espa\xF1ol. Devolv\xE9 solo 5 bullets concisos del texto, sin intro ni outro." },
          { role: "user", content: `${args.focus ? `Foco: ${args.focus}

` : ""}${text.slice(0, 8e3)}` }
        ],
        { temperature: 0.2, maxTokens: 500 }
      );
      const bullets = r.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
      return { type: "summarize_text", status: "ok", summary: bullets };
    } catch (e) {
      return { type: "summarize_text", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
};
var translate = {
  definition: defineTool(
    "translate",
    "Traduce texto entre idiomas. \xDAsala cuando el usuario diga 'traduc\xED esto al japon\xE9s', 'c\xF3mo se dice gracias en \xE1rabe', 'pas\xE1 este texto a ingl\xE9s'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        to: { type: "string", description: "Idioma destino (ej: 'ingl\xE9s', 'japon\xE9s')." },
        from: { type: "string", description: "Idioma origen (opcional, autodetecta)." }
      },
      required: ["text", "to"]
    }
  ),
  policy: policies.readonly("Traduce con LLM local."),
  async run(args, ctx) {
    const text = String(args.text ?? "").trim();
    const to = String(args.to ?? "").trim();
    if (!text || !to) return { type: "translate", status: "failed", error: "Indic\xE1 texto e idioma destino." };
    if (!ctx.chatFn) return { type: "translate", status: "not_configured", note: "Necesito el LLM local (Ollama) para traducir." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: `Sos traductor experto. Traduc\xED al ${to}${args.from ? ` desde el ${args.from}` : ""}. Devolv\xE9 SOLO la traducci\xF3n, sin explicaciones ni comillas.` },
          { role: "user", content: text }
        ],
        { temperature: 0.2, maxTokens: 1e3 }
      );
      return { type: "translate", status: "ok", original: text, to, translation: r.content.trim() };
    } catch (e) {
      return { type: "translate", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
};
var lyricsFind = {
  definition: defineTool(
    "lyrics_find",
    "Busca la letra de una canci\xF3n. \xDAsala cuando el usuario diga 'letra de Bohemian Rhapsody', 'c\xF3mo sigue esa de Cerati', 'letra de la canci\xF3n X de Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        artist: { type: "string" },
        title: { type: "string" }
      },
      required: ["artist", "title"]
    }
  ),
  policy: policies.readonly("Lee letra p\xFAblica via lyrics.ovh."),
  async run(args) {
    const artist = String(args.artist ?? "").trim();
    const title = String(args.title ?? "").trim();
    if (!artist || !title) return { type: "lyrics_find", status: "failed", error: "Indic\xE1 artista y t\xEDtulo." };
    const cacheKey = `lyrics:${artist.toLowerCase()}:${title.toLowerCase()}`;
    const lyrics = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
        { timeoutMs: 9e3 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data.lyrics?.trim() ?? "";
    });
    if (!lyrics) {
      return { type: "lyrics_find", status: "ok", artist, title, lyrics: "", note: "No encontr\xE9 esa letra. Prob\xE1 con otro nombre." };
    }
    return { type: "lyrics_find", status: "ok", artist, title, lyrics };
  }
};
var deepResearch = {
  definition: defineTool(
    "deep_research",
    "Investigaci\xF3n profunda: abre m\xFAltiples fuentes, contrasta, valida con citas y sintetiza con referencias. \xDAsala cuando el usuario diga 'investig\xE1 si conviene alquilar o comprar', 'investig\xE1 tratamientos para el insomnio', 'estudi\xE1 este tema a fondo'. Esta es la killer feature de investigaci\xF3n de Koru.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tema a investigar." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Investigaci\xF3n web multi-fuente."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "deep_research", status: "failed", error: "Indic\xE1 el tema." };
    const queries = [query, `${query} an\xE1lisis pros contras`, `${query} fuentes confiables 2025`];
    const all = await Promise.all(queries.map((q) => searchAndEnrich(q, 4)));
    const sources = usableSources(all.flat()).slice(0, 8);
    let dataCard = null;
    if (ctx.chatFn && sources.length > 0) {
      try {
        dataCard = extractionToDataCard(await validateWithCitations(query, sources, ctx.chatFn));
      } catch (err) {
        console.warn("[Koru] productivity dataCard extraction failed:", err instanceof Error ? err.message : err);
      }
    }
    return {
      type: "deep_research",
      status: "ok",
      query,
      sources,
      dataCard,
      note: sources.length >= 4 ? `Cruzadas ${sources.length} fuentes. Cada dato validado con cita literal.` : `Encontr\xE9 pocas fuentes (${sources.length}). Profundiz\xE1 la consulta.`
    };
  }
};
var extractActionItems = {
  definition: defineTool(
    "extract_action_items",
    "Extrae tareas/puntos de acci\xF3n de notas, minuta de reuni\xF3n o email. \xDAsala cuando el usuario diga 'qu\xE9 tareas surgen de esta minuta?', 'extra\xE9 los action items de este email', 'puntos pendientes de esta nota'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" }
      },
      required: ["text"]
    }
  ),
  policy: policies.localWrite("Extrae tareas y las propone como commitments."),
  async run(args, ctx) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "extract_action_items", status: "failed", error: "Peg\xE1 el texto." };
    if (!ctx.chatFn) return { type: "extract_action_items", status: "not_configured", note: "Necesito el LLM local (Ollama) para extraer tareas." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Extra\xE9 las tareas/puntos de acci\xF3n del texto. Devolv\xE9 solo la lista, una tarea por l\xEDnea, en infinitivo. Sin intro." },
          { role: "user", content: text.slice(0, 6e3) }
        ],
        { temperature: 0.1, maxTokens: 400 }
      );
      const items = r.content.split(/\r?\n/).map((l) => l.trim().replace(/^[-*\d.]+\s*/, "")).filter((l) => l.length > 3).slice(0, 12);
      const commitments = items.map((title) => ({ title, dueHint: "sin fecha", status: "open" }));
      return { type: "extract_action_items", status: "ok", actionItems: items, commitments };
    } catch (e) {
      return { type: "extract_action_items", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
};
var emailDraft = {
  definition: defineTool(
    "email_draft",
    "Redacta un email listo para revisar. \xDAsala cuando el usuario diga 'escribile a mi jefe pidiendo vacaciones', 'respuesta cort\xE9s a la queja', 'email formal para el cliente'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        purpose: { type: "string", description: "Qu\xE9 debe decir el email." },
        recipient: { type: "string", description: "A qui\xE9n va (nombre/rol)." },
        tone: { type: "string", enum: ["formal", "cordial", "directo"], default: "cordial" }
      },
      required: ["purpose"]
    }
  ),
  policy: policies.readonly("Genera borrador de email."),
  async run(args, ctx) {
    const purpose = String(args.purpose ?? "").trim();
    if (!purpose) return { type: "email_draft", status: "failed", error: "Indic\xE1 el prop\xF3sito." };
    if (!ctx.chatFn) return { type: "email_draft", status: "not_configured", note: "Necesito el LLM local (Ollama) para redactar." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: `Redact\xE1s emails en espa\xF1ol, tono ${args.tone ?? "cordial"}. Devolv\xE9 solo el cuerpo del email (con saludo y despedida), sin asunto ni explicaciones.` },
          { role: "user", content: `Para: ${args.recipient ?? "(destinatario)"}
Prop\xF3sito: ${purpose}` }
        ],
        { temperature: 0.4, maxTokens: 500 }
      );
      return { type: "email_draft", status: "ok", purpose, recipient: args.recipient, draft: r.content.trim() };
    } catch (e) {
      return { type: "email_draft", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
};
var messageDraft = {
  definition: defineTool(
    "message_draft",
    "Redacta un mensaje corto (SMS, WhatsApp) listo para enviar. \xDAsala cuando el usuario diga 'mensaje para mi novia que llego tarde', 'confirmaci\xF3n al cliente', 'mensaje breve a mam\xE1'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        purpose: { type: "string" },
        recipient: { type: "string" }
      },
      required: ["purpose"]
    }
  ),
  policy: policies.readonly("Genera borrador de mensaje."),
  async run(args, ctx) {
    const purpose = String(args.purpose ?? "").trim();
    if (!purpose) return { type: "message_draft", status: "failed", error: "Indic\xE1 el prop\xF3sito." };
    if (!ctx.chatFn) return { type: "message_draft", status: "not_configured", note: "Necesito el LLM local (Ollama) para redactar." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Redact\xE1s mensajes cortos de chat (WhatsApp/SMS) en espa\xF1ol, naturales y directos. M\xE1x 2-3 l\xEDneas. Sin explicaciones, solo el mensaje." },
          { role: "user", content: `Para: ${args.recipient ?? "(destinatario)"}
Prop\xF3sito: ${purpose}` }
        ],
        { temperature: 0.5, maxTokens: 200 }
      );
      return { type: "message_draft", status: "ok", purpose, recipient: args.recipient, draft: r.content.trim() };
    } catch (e) {
      return { type: "message_draft", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
};
var copyToClipboard = {
  definition: defineTool(
    "copy_to_clipboard",
    "Copia texto al portapapeles del usuario. \xDAsala cuando el usuario diga 'copi\xE1 eso', 'al portapapeles', 'mand\xE1 eso al clipboard'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" }
      },
      required: ["text"]
    }
  ),
  policy: policies.localWrite("Copia al portapapeles."),
  async run(args) {
    const text = String(args.text ?? "");
    if (!text) return { type: "copy_to_clipboard", status: "failed", error: "Indic\xE1 el texto." };
    return { type: "copy_to_clipboard", status: "ok", text, length: text.length, note: "Texto listo para copiar (la UI lo pondr\xE1 en el portapapeles)." };
  }
};
var qrGenerate = {
  definition: defineTool(
    "qr_generate",
    "Genera un c\xF3digo QR para texto, URL o datos de WiFi. \xDAsala cuando el usuario diga 'QR para mi WiFi', 'c\xF3digo QR para este link', 'gener\xE1 un QR'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Texto o URL a codificar." },
        size: { type: "number", description: "Tama\xF1o en px. Default 300." }
      },
      required: ["text"]
    }
  ),
  policy: policies.readonly("Genera QR via GoQR."),
  async run(args) {
    const text = String(args.text ?? "").trim();
    const size = Number(args.size ?? 300);
    if (!text) return { type: "qr_generate", status: "failed", error: "Indic\xE1 el texto." };
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    return { type: "qr_generate", status: "ok", text, size, qrUrl: url, source: "GoQR", sourceUrl: "https://goqr.me/" };
  }
};
var sunriseSunset = {
  definition: defineTool(
    "sunrise_sunset",
    "Hora de salida y puesta del sol para una ubicaci\xF3n y fecha. \xDAsala cuando el usuario diga 'a qu\xE9 hora sale el sol ma\xF1ana?', 'atardecer hoy en Madrid', 'cu\xE1ndo oscurece'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        lat: { type: "number", description: "Latitud." },
        lng: { type: "number", description: "Longitud." },
        date: { type: "string", description: "Fecha YYYY-MM-DD. Default hoy." }
      },
      required: ["lat", "lng"]
    }
  ),
  policy: policies.readonly("Lee datos solares de sunrise-sunset.org."),
  async run(args) {
    const lat = Number(args.lat);
    const lng = Number(args.lng);
    const date = String(args.date ?? "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { type: "sunrise_sunset", status: "failed", error: "Indic\xE1 lat y lng." };
    const cacheKey = `sun:${lat}:${lng}:${date}`;
    const data = await cached(cacheKey, ttls.weatherNow, async () => {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), formatted: "0" });
      if (date) params.set("date", date);
      const r = await fetchJson(`https://api.sunrise-sunset.org/json?${params.toString()}`, { timeoutMs: 15e3 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    return { type: "sunrise_sunset", status: "ok", lat, lng, date: date || "hoy", sunrise: data.results?.sunrise, sunset: data.results?.sunset, solarNoon: data.results?.solar_noon, dayLengthSec: data.results?.day_length };
  }
};
var moonPhase = {
  definition: defineTool(
    "moon_phase",
    "Fase lunar actual y pr\xF3xima luna llena/nueva. \xDAsala cuando el usuario diga 'qu\xE9 luna hay hoy?', 'cu\xE1ndo es la pr\xF3xima luna llena', 'fase lunar'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string", description: "Fecha YYYY-MM-DD. Default hoy." }
      },
      required: []
    }
  ),
  policy: policies.readonly("C\xE1lculo astron\xF3mico local."),
  async run(args) {
    const ref = (/* @__PURE__ */ new Date("2000-01-06T18:14:00Z")).getTime();
    const target = args.date ? new Date(String(args.date)).getTime() : Date.now();
    if (Number.isNaN(target)) return { type: "moon_phase", status: "failed", error: "Fecha inv\xE1lida." };
    const synodic = 29.530588853;
    const days = (target - ref) / (24 * 60 * 60 * 1e3);
    const phase = (days % synodic + synodic) % synodic;
    const phaseNames = ["Luna nueva", "Luna creciente", "Cuarto creciente", "Gibosa creciente", "Luna llena", "Gibosa menguante", "Cuarto menguante", "Gibosa menguante"];
    const idx = Math.floor(phase / synodic * 8) % 8;
    const illumination = (1 - Math.cos(phase / synodic * 2 * Math.PI)) / 2;
    const daysToFull = (synodic * 0.5 - phase + synodic) % synodic;
    const daysToNew = (synodic - phase) % synodic;
    return {
      type: "moon_phase",
      status: "ok",
      date: args.date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      phaseName: phaseNames[idx],
      phaseDay: Math.round(phase),
      illuminationPct: Number((illumination * 100).toFixed(1)),
      daysToFullMoon: Number(daysToFull.toFixed(1)),
      daysToNewMoon: Number(daysToNew.toFixed(1))
    };
  }
};
var holidays = {
  definition: defineTool(
    "holidays",
    "Feriados nacionales de un pa\xEDs. \xDAsala cuando el usuario diga 'cu\xE1ndo es el pr\xF3ximo feriado?', 'feriados de Espa\xF1a 2025', 'd\xEDas no laborables en Argentina'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        countryCode: { type: "string", description: "C\xF3digo ISO pa\xEDs (ej: 'ES', 'AR', 'US')." },
        year: { type: "number", description: "A\xF1o. Default actual." }
      },
      required: ["countryCode"]
    }
  ),
  policy: policies.readonly("Lee feriados de Nager.Date."),
  async run(args) {
    const cc = String(args.countryCode ?? "").toUpperCase().trim();
    const year = Number(args.year ?? (/* @__PURE__ */ new Date()).getFullYear());
    if (cc.length !== 2) return { type: "holidays", status: "failed", error: "Indic\xE1 c\xF3digo de pa\xEDs de 2 letras." };
    const cacheKey = `hol:${cc}:${year}`;
    const data = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`, { timeoutMs: 9e3 });
      if (!r.ok) throw new Error(r.error);
      return Array.isArray(r.data) ? r.data : [];
    });
    const holidays2 = data.map((h) => ({ date: h.date, name: h.localName ?? h.name, types: h.types }));
    return { type: "holidays", status: "ok", countryCode: cc, year, holidays: holidays2 };
  }
};
var timeZone = {
  definition: defineTool(
    "time_zone",
    "Convierte o consulta la hora en otra zona horaria. \xDAsala cuando el usuario diga 'qu\xE9 hora es en Tokyo?', 'si llamo a las 10am Madrid qu\xE9 hora es all\xE1?', 'zona horaria de San Francisco'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        city: { type: "string", description: "Ciudad o zona IANA (ej: 'Tokyo', 'America/Argentina/Buenos_Aires')." }
      },
      required: ["city"]
    }
  ),
  policy: policies.readonly("Conversi\xF3n de zona horaria local."),
  async run(args) {
    const city = String(args.city ?? "").trim();
    if (!city) return { type: "time_zone", status: "failed", error: "Indic\xE1 la ciudad o zona." };
    const map = {
      "tokyo": "Asia/Tokyo",
      "nueva york": "America/New_York",
      "new york": "America/New_York",
      "los angeles": "America/Los_Angeles",
      "londres": "Europe/London",
      "london": "Europe/London",
      "paris": "Europe/Paris",
      "madrid": "Europe/Madrid",
      "buenos aires": "America/Argentina/Buenos_Aires",
      "mexico": "America/Mexico_City",
      "sao paulo": "America/Sao_Paulo",
      "singapur": "Asia/Singapore",
      "dubai": "Asia/Dubai",
      "sidney": "Australia/Sydney",
      "sydney": "Australia/Sydney",
      "san francisco": "America/Los_Angeles",
      "chicago": "America/Chicago"
    };
    const tz = map[city.toLowerCase()] ?? (city.includes("/") ? city : `Europe/${city}`);
    try {
      const now = /* @__PURE__ */ new Date();
      const time = new Intl.DateTimeFormat("es", { timeZone: tz, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const offsetH = -(new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "");
      return { type: "time_zone", status: "ok", city, timezone: tz, currentTime: time, offset: offsetH, yourTime: now.toLocaleTimeString("es") };
    } catch {
      return { type: "time_zone", status: "failed", error: `No reconoc\xED la zona horaria de "${city}". Us\xE1 formato IANA como Europe/Madrid.` };
    }
  }
};

// koru-mvp/src/tools/docs/index.ts
var docsTools = [
  // Documents (7)
  docCreateMd,
  docCreatePdf,
  docCreateWord,
  docCreateExcel,
  ocrText,
  dataAnalyze,
  dataChart,
  // Notes & Projects (6)
  noteWrite,
  noteShow,
  noteSearch,
  projectCreate,
  projectAdd,
  projectShow,
  // Tasks & Calendar (9)
  taskCreate,
  taskList,
  taskDone,
  calendarAdd,
  calendarShow,
  calendarExportIcs,
  countdown,
  reminderSet,
  alarmSet,
  // Productivity (14)
  summarizeUrl,
  summarizeText,
  translate,
  lyricsFind,
  deepResearch,
  extractActionItems,
  emailDraft,
  messageDraft,
  copyToClipboard,
  qrGenerate,
  sunriseSunset,
  moonPhase,
  holidays,
  timeZone
];

// koru-mvp/src/tools/shared/embeddings.ts
var OLLAMA_BASE = "http://127.0.0.1:11434";
var EMBED_MODEL = "nomic-embed-text";
function makeEmbedFn(baseUrl = OLLAMA_BASE, model = EMBED_MODEL) {
  return async (text) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12e3);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!data.embedding || data.embedding.length === 0) throw new Error("Ollama no devolvi\xF3 embedding");
      return data.embedding;
    } finally {
      clearTimeout(timeout);
    }
  };
}
function cosineSimilarity2(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
async function isOllamaAvailable(baseUrl = OLLAMA_BASE) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2e3);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// koru-mvp/src/tools/knowledge/knowledge.ts
var memorySave = {
  definition: defineTool(
    "memory_save",
    "Guarda algo que Koru debe recordar del usuario de forma duradera. \xDAsala cuando el usuario diga 'soy al\xE9rgico a la penicilina', 'mi mam\xE1 se llama Marta', 'trabajo como dise\xF1ador', 'vivo en Madrid'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Hecho a recordar." },
        kind: { type: "string", enum: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"], default: "profile" },
        sensitivity: { type: "string", enum: ["normal", "sensitive"], default: "normal" }
      },
      required: ["text"]
    }
  ),
  policy: policies.localWrite("Guarda memoria duradera."),
  async run(args) {
    const text = String(args.text ?? "").trim();
    if (!text) return { type: "memory_save", status: "failed", error: "Indic\xE1 qu\xE9 recordar." };
    return {
      type: "memory_save",
      status: "ok",
      memoryCandidates: [{
        kind: args.kind ?? "profile",
        text,
        confidence: 0.95,
        sensitivity: args.sensitivity ?? "normal",
        status: "candidate",
        rootQuote: text,
        useForSuggestions: true
      }]
    };
  }
};
var memorySearch = {
  definition: defineTool(
    "memory_search",
    "Busca en lo que Koru sabe del usuario (memoria sem\xE1ntica). \xDAsala cuando el usuario diga 'qu\xE9 te dije sobre mi familia?', 'record\xE1s algo de mi dieta?', 'tengo algo guardado sobre X'. B\xFAsqueda por significado, no por palabra exacta.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Qu\xE9 buscar en la memoria." }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Busca en memorias del usuario."),
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "memory_search", status: "failed", error: "Indic\xE1 qu\xE9 buscar." };
    const memories = (ctx.state.memories ?? []).filter((m) => m.status === "confirmed");
    if (memories.length === 0) {
      return { type: "memory_search", status: "ok", query, matches: [], note: "Todav\xEDa no hay memorias confirmadas." };
    }
    const ollamaOn = await isOllamaAvailable().catch(() => false);
    if (ollamaOn) {
      try {
        const embed = makeEmbedFn();
        const qVec = await embed(query);
        const scored = await Promise.all(memories.map(async (m) => {
          let vec = m.embedding;
          if (!vec || vec.length === 0) {
            try {
              vec = await embed(m.text);
            } catch {
              vec = [];
            }
          }
          return { memory: m, score: vec.length ? cosineSimilarity2(qVec, vec) : 0 };
        }));
        const top = scored.filter((s) => s.score > 0.4).sort((a, b) => b.score - a.score).slice(0, 5);
        if (top.length) {
          return {
            type: "memory_search",
            status: "ok",
            query,
            mode: "semantic",
            matches: top.map((s) => ({ text: s.memory.text, kind: s.memory.kind, score: Number(s.score.toFixed(2)) }))
          };
        }
      } catch {
      }
    }
    const qTokens = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((t) => t.length > 2);
    const matches = memories.map((m) => {
      const hay = m.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const score = qTokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { memory: m, score };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    return {
      type: "memory_search",
      status: "ok",
      query,
      mode: "lexical",
      matches: matches.map((s) => ({ text: s.memory.text, kind: s.memory.kind })),
      note: "B\xFAsqueda l\xE9xica. Para sem\xE1ntica, activ\xE1 Ollama."
    };
  }
};
var memoryForget = {
  definition: defineTool(
    "memory_forget",
    "Elimina una memoria guardada. \xDAsala cuando el usuario diga 'olvid\xE1 lo de la alergia', 'borr\xE1 que viv\xEDa en Madrid', 'ya no quiero que recuerdes X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto para encontrar la memoria a borrar." }
      },
      required: ["query"]
    }
  ),
  policy: policies.localWrite("Marca memoria como rejected."),
  async run(args, ctx) {
    const q = String(args.query ?? "").trim().toLowerCase();
    if (!q) return { type: "memory_forget", status: "failed", error: "Indic\xE1 qu\xE9 olvidar." };
    const match = (ctx.state.memories ?? []).find((m) => m.text.toLowerCase().includes(q));
    if (!match) return { type: "memory_forget", status: "ok", found: false, query: args.query, note: "No encontr\xE9 esa memoria." };
    return { type: "memory_forget", status: "ok", found: true, text: match.text, id: match.id, note: "El store la marcar\xE1 como rejected." };
  }
};
var memoryEdit = {
  definition: defineTool(
    "memory_edit",
    "Corrige una memoria guardada. \xDAsala cuando el usuario diga 'mi direcci\xF3n nueva es...', 'cambia mi n\xFAmero', 'correg\xED que mi hijo se llama X no Y'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Texto para encontrar la memoria a editar." },
        newText: { type: "string", description: "Nuevo texto." }
      },
      required: ["query", "newText"]
    }
  ),
  policy: policies.localWrite("Edita memoria."),
  async run(args, ctx) {
    const q = String(args.query ?? "").trim().toLowerCase();
    const newText = String(args.newText ?? "").trim();
    if (!q || !newText) return { type: "memory_edit", status: "failed", error: "Indic\xE1 qu\xE9 editar y el nuevo texto." };
    const match = (ctx.state.memories ?? []).find((m) => m.text.toLowerCase().includes(q));
    if (!match) return { type: "memory_edit", status: "ok", found: false, query: args.query, note: "No encontr\xE9 esa memoria." };
    return { type: "memory_edit", status: "ok", found: true, oldText: match.text, newText, id: match.id };
  }
};
var memoryGardenShow = {
  definition: defineTool(
    "memory_garden_show",
    "Muestra todas las memorias guardadas (el jard\xEDn de Koru). \xDAsala cuando el usuario diga 'mostrame mi jard\xEDn', 'qu\xE9 sab\xE9s de m\xED', 'lista de memorias'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["confirmed", "candidate", "all"], default: "all" }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lista memorias."),
  async run(args, ctx) {
    const status = String(args.status ?? "all");
    const memories = (ctx.state.memories ?? []).filter((m) => status === "all" || m.status === status).slice(-30).reverse().map((m) => ({ text: m.text, kind: m.kind, status: m.status, sensitivity: m.sensitivity, date: m.createdAt.slice(0, 10) }));
    return { type: "memory_garden_show", status: "ok", filter: status, count: memories.length, memories };
  }
};
var WIKI_HEADERS2 = { "User-Agent": "KoruBot/1.0 (personal assistant; contact: dev@koru.app)" };
var wikipediaLookup = {
  definition: defineTool(
    "wikipedia_lookup",
    "Resumen enciclop\xE9dico de cualquier tema, concepto o lugar. \xDAsala cuando el usuario diga 'qu\xE9 es el efecto placebo?', 'qui\xE9n era Borges', 'info sobre el Renacimiento', 'qu\xE9 es la fotos\xEDntesis'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tema a buscar." },
        lang: { type: "string", default: "es" }
      },
      required: ["query"]
    }
  ),
  policy: policies.readonly("Lee Wikipedia."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const lang = String(args.lang ?? "es").trim();
    if (!query) return { type: "wikipedia_lookup", status: "failed", error: "Indic\xE1 el tema." };
    const cacheKey = `wiki:${lang}:${query.toLowerCase()}`;
    const data = await cached(cacheKey, ttls.reference, async () => {
      await limiters.wikipedia.acquire();
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(9e3), headers: WIKI_HEADERS2 });
      if (!searchRes.ok) throw new Error(`Wikipedia search HTTP ${searchRes.status}`);
      const searchData = await searchRes.json();
      const wikiTitle = searchData.query?.search?.[0]?.title;
      if (!wikiTitle) throw new Error("not_found");
      const r = await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
        { timeoutMs: 9e3, headers: WIKI_HEADERS2 }
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    }).catch(() => null);
    if (!data || data.type === "not_found" || !data.extract) {
      return { type: "wikipedia_lookup", status: "no_data", query, note: `No encontr\xE9 "${query}" en Wikipedia (${lang}).` };
    }
    return {
      type: "wikipedia_lookup",
      status: "ok",
      query,
      title: data.title,
      description: data.description,
      extract: data.extract,
      thumbnail: data.thumbnail?.source,
      wikiUrl: data.content_urls?.desktop?.page,
      source: "Wikipedia"
    };
  }
};
var dictionaryDefine = {
  definition: defineTool(
    "dictionary_define",
    "Define una palabra y da sin\xF3nimos. \xDAsala cuando el usuario diga 'qu\xE9 significa perenne?', 'sin\xF3nimos de ef\xEDmero', 'definici\xF3n de melancol\xEDa'. Ingl\xE9s por defecto.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        word: { type: "string", description: "Palabra a definir." }
      },
      required: ["word"]
    }
  ),
  policy: policies.readonly("Lee Free Dictionary API."),
  async run(args) {
    const word = String(args.word ?? "").trim();
    if (!word) return { type: "dictionary_define", status: "failed", error: "Indic\xE1 la palabra." };
    const cacheKey = `dict:${word.toLowerCase()}`;
    const entries = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeoutMs: 9e3 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    if (!entries.length) {
      return { type: "dictionary_define", status: "ok", word, note: `No encontr\xE9 "${word}" en el diccionario (ingl\xE9s).` };
    }
    const e = entries[0];
    const meanings = (e.meanings ?? []).slice(0, 3).map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions ?? []).slice(0, 2).map((d) => ({ definition: d.definition, example: d.example })),
      synonyms: (m.definitions?.[0]?.synonyms ?? []).slice(0, 5)
    }));
    return { type: "dictionary_define", status: "ok", word: e.word ?? word, phonetic: e.phonetic, meanings, source: "Free Dictionary API" };
  }
};
var slangTranslate = {
  definition: defineTool(
    "slang_translate",
    "Explica modismos, jerga o expresiones de un pa\xEDs o regi\xF3n. \xDAsala cuando el usuario diga 'qu\xE9 significa ch\xE9vere?', 'c\xF3mo se dice genial en M\xE9xico?', 'es pibe argentino?', 'modismo X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        term: { type: "string", description: "Modismo o expresi\xF3n." },
        region: { type: "string", description: "Pa\xEDs/regi\xF3n (ej: 'Argentina', 'M\xE9xico')." }
      },
      required: ["term"]
    }
  ),
  policy: policies.readonly("Explica modismos con LLM local."),
  async run(args, ctx) {
    const term = String(args.term ?? "").trim();
    const region = String(args.region ?? "").trim();
    if (!term) return { type: "slang_translate", status: "failed", error: "Indic\xE1 el modismo." };
    if (!ctx.chatFn) return { type: "slang_translate", status: "not_configured", note: "Necesito el LLM local (Ollama) para explicar modismos." };
    try {
      const r = await ctx.chatFn(
        [
          { role: "system", content: "Explic\xE1s modismos y jerga del espa\xF1ol de forma concisa. 2-3 l\xEDneas: significado, equivalente neutro y ejemplo de uso." },
          { role: "user", content: `Modismo: "${term}"${region ? ` (regi\xF3n: ${region})` : ""}` }
        ],
        { temperature: 0.3, maxTokens: 200 }
      );
      return { type: "slang_translate", status: "ok", term, region, explanation: r.content.trim() };
    } catch (e) {
      return { type: "slang_translate", status: "failed", error: e instanceof Error ? e.message : String(e) };
    }
  }
};
var UNITS = {
  m: { factor: 1, aliases: ["metro", "metros", "m"] },
  km: { factor: 1e3, aliases: ["km", "kilometro", "kilometros", "kil\xF3metro", "kil\xF3metros"] },
  cm: { factor: 0.01, aliases: ["cm", "centimetro", "centimetros"] },
  mm: { factor: 1e-3, aliases: ["mm", "milimetro", "milimetros"] },
  ft: { factor: 0.3048, aliases: ["ft", "pie", "pies", "feet"] },
  in: { factor: 0.0254, aliases: ["in", "pulgada", "pulgadas", "inch"] },
  mi: { factor: 1609.34, aliases: ["mi", "milla", "millas", "mile"] },
  yd: { factor: 0.9144, aliases: ["yd", "yarda", "yardas"] },
  g: { factor: 1e-3, aliases: ["g", "gramo", "gramos"] },
  kg: { factor: 1, aliases: ["kg", "kilo", "kilos", "kilogramo"] },
  lb: { factor: 0.453592, aliases: ["lb", "libra", "libras", "pound"] },
  oz: { factor: 0.0283495, aliases: ["oz", "onza", "onzas", "ounce"] },
  l: { factor: 1, aliases: ["l", "litro", "litros"] },
  ml: { factor: 1e-3, aliases: ["ml", "mililitro", "mililitros"] },
  gal: { factor: 3.78541, aliases: ["gal", "galon", "gal\xF3n", "gallons"] }
};
function findUnit(raw) {
  const r = raw.toLowerCase().trim();
  for (const [key, def] of Object.entries(UNITS)) {
    if (def.aliases.includes(r)) return key;
  }
  return null;
}
var unitConvert = {
  definition: defineTool(
    "unit_convert",
    "Convierte unidades: metros/pies, kg/libras, litros/galones, temperatura (\xB0C/\xB0F/K). \xDAsala cuando el usuario diga '200 gramos en onzas', '30\xB0C a Fahrenheit', '5 km en millas', '2 litros a galones'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "number" },
        from: { type: "string", description: "Unidad origen." },
        to: { type: "string", description: "Unidad destino." }
      },
      required: ["value", "from", "to"]
    }
  ),
  policy: policies.readonly("Conversi\xF3n local."),
  async run(args) {
    const value = Number(args.value);
    const fromRaw = String(args.from ?? "").trim();
    const toRaw = String(args.to ?? "").trim();
    if (!Number.isFinite(value)) return { type: "unit_convert", status: "failed", error: "Valor inv\xE1lido." };
    const tempUnits = ["c", "f", "k", "celsius", "fahrenheit", "kelvin"];
    const fromLow = fromRaw.toLowerCase();
    const toLow = toRaw.toLowerCase();
    if (tempUnits.includes(fromLow) || tempUnits.includes(toLow)) {
      let celsius;
      if (/^c/i.test(fromLow)) celsius = value;
      else if (/^f/i.test(fromLow)) celsius = (value - 32) * 5 / 9;
      else if (/^k/i.test(fromLow)) celsius = value - 273.15;
      else return { type: "unit_convert", status: "failed", error: "Unidad de temperatura inv\xE1lida." };
      let result2;
      if (/^c/i.test(toLow)) result2 = celsius;
      else if (/^f/i.test(toLow)) result2 = celsius * 9 / 5 + 32;
      else if (/^k/i.test(toLow)) result2 = celsius + 273.15;
      else return { type: "unit_convert", status: "failed", error: "Unidad destino inv\xE1lida." };
      return { type: "unit_convert", status: "ok", value, from: fromRaw, to: toRaw, result: Number(result2.toFixed(4)), category: "temperature" };
    }
    const fromUnit = findUnit(fromRaw);
    const toUnit = findUnit(toRaw);
    if (!fromUnit || !toUnit) {
      return { type: "unit_convert", status: "failed", error: `No reconoc\xED "${fromRaw}" o "${toRaw}". Unidades: m, km, cm, ft, in, mi, g, kg, lb, oz, l, ml, gal.` };
    }
    const isLength = (u) => ["m", "km", "cm", "mm", "ft", "in", "mi", "yd"].includes(u);
    const isWeight = (u) => ["g", "kg", "lb", "oz"].includes(u);
    const isVolume = (u) => ["l", "ml", "gal"].includes(u);
    if (isLength(fromUnit) !== isLength(toUnit) || isWeight(fromUnit) !== isWeight(toUnit) || isVolume(fromUnit) !== isVolume(toUnit)) {
      return { type: "unit_convert", status: "failed", error: "No puedo convertir entre categor\xEDas distintas (longitud/peso/volumen)." };
    }
    const valueInBase = value * UNITS[fromUnit].factor;
    const result = valueInBase / UNITS[toUnit].factor;
    return { type: "unit_convert", status: "ok", value, from: fromRaw, to: toRaw, result: Number(result.toFixed(4)) };
  }
};
var mathCalc = {
  definition: defineTool(
    "math_calc",
    "Calcula operaciones matem\xE1ticas con explicaci\xF3n. \xDAsala cuando el usuario diga '15% de 230', 'cu\xE1nto es 234 \xD7 18', 'ra\xEDz cuadrada de 144', 'porcentaje de cambio entre 100 y 150'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        expression: { type: "string", description: "Expresi\xF3n matem\xE1tica (ej: '15% of 230', '234*18', 'sqrt(144)', '(100+50)/2')." }
      },
      required: ["expression"]
    }
  ),
  policy: policies.readonly("C\xE1lculo local."),
  async run(args) {
    const expr = String(args.expression ?? "").trim();
    if (!expr) return { type: "math_calc", status: "failed", error: "Indic\xE1 la expresi\xF3n." };
    let safe = expr.replace(/[×x]/gi, "*").replace(/÷/g, "/").replace(/(\d+(?:\.\d+)?)\s*%\s*(?:de|of)?\s*(\d+(?:\.\d+)?)/gi, "($1*0.01*$2)").replace(/sqrt\s*\(/gi, "Math.sqrt(").replace(/\^/g, "**").replace(/,/g, ".");
    if (!/^[\d+\-*/().\s]|Math\.(sqrt|PI|E)|Math\.pow/g.test(safe) && /[a-zA-Z]/.test(safe.replace(/Math\.\w+/g, ""))) {
      return { type: "math_calc", status: "failed", error: "Expresi\xF3n con caracteres no permitidos." };
    }
    try {
      const fn = new Function(`"use strict"; return (${safe});`);
      const result = fn();
      if (!Number.isFinite(result)) return { type: "math_calc", status: "failed", error: "Resultado no num\xE9rico." };
      return { type: "math_calc", status: "ok", expression: expr, result: Number(Number(result).toFixed(6)) };
    } catch (e) {
      return { type: "math_calc", status: "failed", error: `No pude calcular: ${e instanceof Error ? e.message : "expresi\xF3n inv\xE1lida"}.` };
    }
  }
};

// koru-mvp/src/tools/knowledge/index.ts
var knowledgeTools = [
  memorySave,
  memorySearch,
  memoryForget,
  memoryEdit,
  memoryGardenShow,
  wikipediaLookup,
  dictionaryDefine,
  slangTranslate,
  unitConvert,
  mathCalc
];

// koru-mvp/src/tools/health/health.ts
var medicationReminder = {
  definition: defineTool(
    "medication_reminder",
    "Organiza un esquema de medicaci\xF3n y programa recordatorios horarios. \xDAsala cuando el usuario diga 'recordame el ibuprofeno cada 8 horas por 5 d\xEDas', 'necesito tomar amoxicilina cada 12 horas', 'avisame la pastilla de la presi\xF3n'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del medicamento." },
        frequency: { type: "string", description: "Frecuencia (ej: 'cada 8 horas', 'cada 12 horas', 'diario')." },
        duration: { type: "string", description: "Duraci\xF3n (ej: '5 d\xEDas', '10 d\xEDas', 'cr\xF3nico')." },
        note: { type: "string" }
      },
      required: ["name", "frequency"]
    }
  ),
  policy: policies.localWrite("Crea esquema de medicaci\xF3n."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const frequency = String(args.frequency ?? "").trim();
    if (!name || !frequency) return { type: "medication_reminder", status: "failed", error: "Indic\xE1 medicamento y frecuencia." };
    const record = {
      domain: "health",
      kind: "medication",
      title: name,
      value: frequency,
      dueHint: frequency,
      notes: args.duration || args.note ? `${args.duration ?? ""}${args.duration && args.note ? ` - ${args.note}` : args.note ?? ""}` : void 0
    };
    return {
      type: "medication_reminder",
      status: "ok",
      name,
      frequency,
      duration: args.duration,
      records: [record],
      note: "Esquema guardado. Los recordatorios se activar\xE1n seg\xFAn la frecuencia."
    };
  }
};
var sleepTrack = {
  definition: defineTool(
    "sleep_track",
    "Registra tus horas de sue\xF1o y calcula promedios. \xDAsala cuando el usuario diga 'dorm\xED 6 horas anoche', 'anoche dorm\xED 7.5h', 'c\xF3mo viene mi sue\xF1o esta semana'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        hours: { type: "number", description: "Horas dormidas." },
        quality: { type: "string", enum: ["buena", "regular", "mala"] }
      },
      required: ["hours"]
    }
  ),
  policy: policies.localWrite("Registra sue\xF1o."),
  async run(args, ctx) {
    const hours = Number(args.hours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) return { type: "sleep_track", status: "failed", error: "Indic\xE1 horas v\xE1lidas (0-24)." };
    const record = {
      domain: "health",
      kind: "sleep",
      title: `Sue\xF1o: ${hours}h`,
      value: String(hours),
      notes: args.quality ? `Calidad: ${args.quality}` : void 0
    };
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
      note: avg < 6.5 ? "Promedio bajo: conviene apuntar a 7-8h." : avg > 9 ? "Promedio alto: revis\xE1 calidad." : "Promedio saludable."
    };
  }
};
var hydrationRemind = {
  definition: defineTool(
    "hydration_remind",
    "Programa recordatorios para tomar agua seg\xFAn tu rutina. \xDAsala cuando el usuario diga 'avisame cada 2 horas que tome agua', 'recordame hidrataci\xF3n', 'necesito beber m\xE1s agua'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        intervalHours: { type: "number", description: "Intervalo en horas entre recordatorios. Default 2." },
        activeStart: { type: "string", description: "Hora inicio (HH:MM). Default 08:00." },
        activeEnd: { type: "string", description: "Hora fin (HH:MM). Default 22:00." }
      },
      required: []
    }
  ),
  policy: policies.localWrite("Configura recordatorio de hidrataci\xF3n."),
  async run(args) {
    const interval = Number(args.intervalHours ?? 2);
    return {
      type: "hydration_remind",
      status: "ok",
      intervalHours: interval,
      activeStart: args.activeStart ?? "08:00",
      activeEnd: args.activeEnd ?? "22:00",
      memoryCandidates: [{
        kind: "routine",
        text: `Hidrataci\xF3n: recordar beber agua cada ${interval} horas`,
        confidence: 0.9,
        sensitivity: "normal",
        status: "candidate",
        rootQuote: "hidrataci\xF3n",
        useForSuggestions: true
      }],
      note: `Recordatorios cada ${interval}h configurados. Beber agua mejora energ\xEDa y concentraci\xF3n.`
    };
  }
};
var moodTrack = {
  definition: defineTool(
    "mood_track",
    "Registra tu \xE1nimo para ver tendencias a lo largo del tiempo. \xDAsala cuando el usuario diga 'hoy me siento bien', 'vengo cansado esta semana', '\xE1nimo bajo', 'registro emocional'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        mood: { type: "string", enum: ["muy bien", "bien", "normal", "cansado", "bajo", "mal"] },
        note: { type: "string" }
      },
      required: ["mood"]
    }
  ),
  policy: policies.localWrite("Registra \xE1nimo."),
  async run(args) {
    const mood = String(args.mood ?? "").trim();
    if (!mood) return { type: "mood_track", status: "failed", error: "Indic\xE1 tu \xE1nimo." };
    const record = {
      domain: "health",
      kind: "medical_info",
      title: `\xC1nimo: ${mood}`,
      value: mood,
      notes: args.note ? String(args.note) : void 0
    };
    return {
      type: "mood_track",
      status: "ok",
      mood,
      records: [record],
      note: /bajo|mal/i.test(mood) ? "Lo registro. Si persiste varios d\xEDas, consider\xE1 hablar con alguien de confianza." : "Anotado."
    };
  }
};
var habitStreak = {
  definition: defineTool(
    "habit_streak",
    "Cuenta la racha de d\xEDas seguidos de un h\xE1bito y te alienta a mantenerla. \xDAsala cuando el usuario diga 'cu\xE1ntos d\xEDas seguidos gimnasio?', 'racha de meditaci\xF3n', 'mi racha de X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        habit: { type: "string", description: "Nombre del h\xE1bito." }
      },
      required: ["habit"]
    }
  ),
  policy: policies.readonly("Cuenta racha de h\xE1bito."),
  async run(args, ctx) {
    const habit = String(args.habit ?? "").trim().toLowerCase();
    if (!habit) return { type: "habit_streak", status: "failed", error: "Indic\xE1 el h\xE1bito." };
    const today = /* @__PURE__ */ new Date();
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const has = (ctx.state.records ?? []).some((r) => r.createdAt.slice(0, 10) === dStr && (r.title + r.value + (r.notes ?? "")).toLowerCase().includes(habit));
      if (has) days.push(dStr);
      else if (i > 0) break;
    }
    days.reverse();
    return {
      type: "habit_streak",
      status: "ok",
      habit,
      streak: days.length,
      days,
      note: days.length === 0 ? "No encontr\xE9 registros recientes de ese h\xE1bito." : days.length >= 7 ? `\xA1${days.length} d\xEDas seguidos! Excelente racha, no la rompas.` : `Racha de ${days.length} d\xEDa(s).`
    };
  }
};
var airQualityAdvice = {
  definition: defineTool(
    "air_quality_advice",
    "Consulta calidad del aire y aconseja actividad seg\xFAn PM2.5/PM10. \xDAsala cuando el usuario diga 'calidad del aire hoy', 'conviene correr afuera?', 'PM2.5 en mi zona', 'poluci\xF3n'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        city: { type: "string", description: "Nombre de ciudad (si no ten\xE9s coords)." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Lee calidad del aire de Open-Meteo."),
  async run(args) {
    const lat = Number(args.lat);
    const lng = Number(args.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { type: "air_quality_advice", status: "failed", error: "Indic\xE1 lat y lng (o us\xE1 weather_full que geolocaliza)." };
    }
    const cacheKey = `aq:${lat.toFixed(2)}:${lng.toFixed(2)}`;
    const data = await cached(cacheKey, ttls.weatherNow, async () => {
      const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lng));
      url.searchParams.set("current", "pm2_5,pm10,european_aqi,us_aqi");
      const r = await fetchJson(url.toString(), { timeoutMs: 15e3 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    const c = data.current;
    if (!c) return { type: "air_quality_advice", status: "failed", error: "Sin datos de calidad del aire." };
    const pm25 = c.pm2_5 ?? 0;
    let level;
    let advice;
    if (pm25 <= 12) {
      level = "Buena";
      advice = "Aire limpio: ideal para actividad al aire libre.";
    } else if (pm25 <= 35) {
      level = "Moderada";
      advice = "Aceptable; sensibles pueden reducir esfuerzo prolongado.";
    } else if (pm25 <= 55) {
      level = "Poco saludable (sensibles)";
      advice = "Conviene entrenar indoor si ten\xE9s asma o afecciones.";
    } else if (pm25 <= 150) {
      level = "Poco saludable";
      advice = "Evit\xE1 ejercicio intenso al aire libre.";
    } else {
      level = "Mala";
      advice = "Quedate indoor, cerr\xE1 ventanas, usa purificador si ten\xE9s.";
    }
    return {
      type: "air_quality_advice",
      status: "ok",
      lat,
      lng,
      pm25: c.pm2_5,
      pm10: c.pm10,
      europeanAqi: c.european_aqi,
      usAqi: c.us_aqi,
      level,
      advice,
      source: "Open-Meteo Air Quality"
    };
  }
};

// koru-mvp/src/tools/health/index.ts
var healthTools = [
  medicationReminder,
  sleepTrack,
  hydrationRemind,
  moodTrack,
  habitStreak,
  airQualityAdvice
];

// koru-mvp/src/tools/utils/utils.ts
var urlShorten = {
  definition: defineTool(
    "url_shorten",
    "Acorta una URL larga. \xDAsala cuando el usuario diga 'acort\xE1 este link', 'URL corta para compartir', 'shorten esto'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string" }
      },
      required: ["url"]
    }
  ),
  policy: policies.readonly("Acorta URL via is.gd."),
  async run(args) {
    const url = String(args.url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) return { type: "url_shorten", status: "failed", error: "Indic\xE1 una URL v\xE1lida (con http/https)." };
    const cacheKey = `short:${url}`;
    const short = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`, { timeoutMs: 15e3 });
      if (!r.ok) throw new Error(r.error);
      return r.data.shorturl ?? "";
    });
    if (!short) return { type: "url_shorten", status: "failed", error: "No pude acortar la URL." };
    return { type: "url_shorten", status: "ok", original: url, short, source: "is.gd" };
  }
};
var passwordGenerate = {
  definition: defineTool(
    "password_generate",
    "Genera una contrase\xF1a fuerte aleatoria. \xDAsala cuando el usuario diga 'gener\xE1 una contrase\xF1a', 'pass de 16 caracteres', 'contrase\xF1a segura'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        length: { type: "number", description: "Longitud. Default 16." },
        symbols: { type: "boolean", description: "Incluir s\xEDmbolos. Default true." }
      },
      required: []
    }
  ),
  policy: policies.readonly("Genera contrase\xF1a local con crypto."),
  async run(args) {
    const length = Math.max(8, Math.min(64, Number(args.length ?? 16)));
    const includeSymbols = args.symbols !== false;
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{}";
    const charset = lower + upper + digits + (includeSymbols ? symbols : "");
    const randomValues = new Uint32Array(length);
    const cryptoSource = globalThis.crypto ?? (await import("node:crypto")).webcrypto;
    cryptoSource.getRandomValues(randomValues);
    let password = "";
    for (let i = 0; i < length; i++) password += charset[randomValues[i] % charset.length];
    const ensure = (set) => {
      if (!password.split("").some((c) => set.includes(c))) {
        const idx = Math.floor(randomValues[0] % password.length);
        password = password.slice(0, idx) + set[randomValues[1] % set.length] + password.slice(idx + 1);
      }
    };
    ensure(lower);
    ensure(upper);
    ensure(digits);
    if (includeSymbols) ensure(symbols);
    return {
      type: "password_generate",
      status: "ok",
      length,
      password,
      entropyBits: Math.round(length * Math.log2(charset.length)),
      note: "Generada con crypto seguro. Guardala en un gestor de contrase\xF1as."
    };
  }
};
var quoteOfDay = {
  definition: defineTool(
    "quote_of_day",
    "Frase inspiradora del d\xEDa. \xDAsala cuando el usuario diga 'una cita para hoy', 'frase del d\xEDa', 'algo inspirador'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: []
    }
  ),
  policy: policies.readonly("Lee cita de ZenQuotes."),
  async run(_args) {
    const cacheKey = `quote:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
    const data = await cached(cacheKey, ttls.reference, async () => {
      const r = await fetchJson("https://zenquotes.io/api/today", { timeoutMs: 15e3 });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    });
    const q = Array.isArray(data) ? data[0] : null;
    if (!q?.q) return { type: "quote_of_day", status: "ok", note: "No pude conseguir una cita hoy." };
    return { type: "quote_of_day", status: "ok", quote: q.q, author: q.a, source: "ZenQuotes" };
  }
};
var selfHealthCheck = {
  definition: defineTool(
    "self_health_check",
    "Diagn\xF3stico honesto del estado de Koru: providers disponibles, Ollama, latencia, n\xFAmero de tools activas. \xDAsala cuando el usuario diga 'Koru, est\xE1s bien?', 'estado de tus servicios', 'autodiagn\xF3stico', 'funcionan tus herramientas?'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: []
    }
  ),
  policy: policies.readonly("Diagn\xF3stico local."),
  async run(_args) {
    const checks = [];
    const ollamaOn = await isOllamaAvailable().catch(() => false);
    checks.push({ service: "Ollama (LLM local)", status: ollamaOn ? "ok" : "down", detail: ollamaOn ? "Disponible para embeddings, resumen, traducci\xF3n." : "No detectado. Las tools que usan LLM local no funcionar\xE1n." });
    try {
      const r = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=EUR", { timeoutMs: 4e3 });
      checks.push({ service: "Frankfurter (divisas)", status: r.ok ? "ok" : "down" });
    } catch {
      checks.push({ service: "Frankfurter (divisas)", status: "down" });
    }
    try {
      const r = await fetchJson("https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=test", { timeoutMs: 5e3 });
      checks.push({ service: "TheSportsDB (deportes)", status: r.ok ? "ok" : "down" });
    } catch {
      checks.push({ service: "TheSportsDB (deportes)", status: "down" });
    }
    try {
      const r = await fetchJson("https://api.gdeltproject.org/api/v2/doc/doc?query=test&mode=ArtList&format=json&maxrecords=1", { timeoutMs: 6e3 });
      checks.push({ service: "GDELT (noticias)", status: r.ok ? "ok" : "down" });
    } catch {
      checks.push({ service: "GDELT (noticias)", status: "down" });
    }
    const upCount = checks.filter((c) => c.status === "ok").length;
    return {
      type: "self_health_check",
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      checks,
      summary: `${upCount}/${checks.length} servicios disponibles.`,
      note: ollamaOn ? "N\xFAcleo operativo. Puedo resumir, traducir y buscar en memoria sem\xE1ntica." : "Sin Ollama: las tools avanzadas (resumen, traducci\xF3n, memoria sem\xE1ntica) estar\xE1n limitadas. Las APIs p\xFAblicas siguen funcionando."
    };
  }
};

// koru-mvp/src/tools/utils/index.ts
var utilsTools = [urlShorten, passwordGenerate, quoteOfDay, selfHealthCheck];

// koru-mvp/src/tools/toolbox.ts
var allHandlers = [
  ...moneyTools,
  ...sportsTools,
  ...foodTools,
  ...travelTools,
  ...trendingTools,
  ...peopleTools,
  ...appsTools,
  ...docsTools,
  ...knowledgeTools,
  ...healthTools,
  ...utilsTools
];
var TOOL_BOX = new Map(
  allHandlers.map((handler) => [handler.definition.function.name, handler])
);
var ALL_TOOL_DEFINITIONS = allHandlers.map((h) => h.definition);

// koru-mvp/src/server/koruBackend.ts
var TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "weather",
      description: "Obt\xE9n el clima actual de una ciudad cuando el usuario necesite informaci\xF3n sobre condiciones meteorol\xF3gicas para planificar actividades, vestimenta o desplazamientos. El usuario puede expresar esta necesidad en cualquiera de estas formas: clima, lluvia, nieve, calor, fr\xEDo, sol, nublado, temporal, outfit, ropa, paraguas, campera, que me pongo, viste, layer, abrigo, o preguntas como '\xBFQu\xE9 tal est\xE1 afuera?', '\xBFNecesito chaqueta?', '\xBFHace fr\xEDo?'.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          city: { type: "string", description: "City or location. Do NOT guess. If the user has not stated a location, ask for it first." },
          purpose: { type: "string", description: "Why the user needs this weather, e.g. outfit, meeting, umbrella." }
        },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Busca informaci\xF3n actualizada en internet cuando el usuario pregunte sobre algo que ocurre en el mundo exterior y que no est\xE1 en su contexto personal. Esto incluye: eventos recientes, noticias, figuras p\xFAblicas, tendencias, avances cient\xEDficos, datos de mercados, precios de activos, deportes, pol\xEDtica, cultura, o cualquier tema que requiera consultar fuentes externas porque cambia con el tiempo. El usuario puede pedir esto de cualquier forma: '\xBFQu\xE9 pas\xF3 con...?', '\xBFC\xF3mo va...?', '\xBFQui\xE9n gan\xF3...?', '\xBFCu\xE1les son las \xFAltimas...?', o incluso solo mencionando el tema sin pedir expl\xEDcitamente una b\xFAsqueda.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          mode: { type: "string", enum: ["news", "research", "world"] }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "shopping_compare",
      description: "Compara productos con evidencia de precios, fuentes y pros/contras cuando el usuario est\xE9 considerando una compra o necesite evaluar opciones de productos. El usuario puede expresar esto de muchas formas: pidiendo recomendaciones de algo para comprar, mencionando que necesita un producto, comparando dos cosas, buscando la mejor opci\xF3n, o preguntando d\xF3nde comprar algo. Tambi\xE9n activa cuando el usuario pide review o comparativa de productos t\xE9cnicos.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          budget: { type: "string" },
          constraints: { type: "array", items: { type: "string" } }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "plan_day",
      description: "Crea un plan pr\xE1ctico para el d\xEDa considerando los compromisos abiertos, la energ\xEDa y el contexto del usuario cuando necesite organizar su tiempo o priorizar tareas. El usuario puede pedir esto de cualquier forma: '\xBFC\xF3mo organizo hoy?', '\xBFQu\xE9 hago primero?', 'Tengo muchas cosas', '\xBFMe ayudas a planificar?', '\xBFEn qu\xE9 orden?', 'Siento que no me da el tiempo', o mencionando m\xFAltiples tareas pendientes.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          focus: { type: "string" },
          energy: { type: "string", enum: ["low", "medium", "high", "unknown"] }
        },
        required: ["focus"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_personal_context",
      description: "Consulta el contexto personal guardado de Koru para responder preguntas sobre gastos, comida en casa, tareas pendientes, links guardados, notas m\xE9dicas, personas que conoce, o lo que Koru recuerda. \xDAsala SIEMPRE que la pregunta pueda resolverse con los datos personales del usuario. NO uses esta herramienta para hechos del mundo exterior.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: { type: "string", enum: ["expenses", "food_inventory", "shopping_list", "pending_tasks", "saved_links", "health", "relationships", "memory", "general"] },
          period: { type: "string", description: "Optional period, e.g. this week, today, this month." },
          query: { type: "string" }
        },
        required: ["topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save durable reusable memory about the user or people important to the user: preferences, identity, routines, goals, relationships, boundaries, wellbeing, teams/topics to follow. Use this when Koru should know it later.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          memories: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string", description: "Reusable memory sentence in the user's language." },
                kind: { type: "string", enum: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"] },
                sensitivity: { type: "string", enum: ["normal", "sensitive"] },
                useForSuggestions: { type: "boolean" },
                rootQuote: { type: "string" }
              },
              required: ["text", "kind"]
            }
          }
        },
        required: ["memories"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_personal_item",
      description: "Save a personal task, reminder, alarm, shopping item, expense, health item, idea, home task, relationship follow-up, tool link, or any user-owned information. Use instead of only saying it was saved.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          uiBlockType: { type: "string", enum: ["reminder", "alarm", "shopping_list", "saved_record", "money_summary", "birthday_calendar", "birthday_alarm", "social_interaction"] },
          title: { type: "string" },
          dueText: { type: "string" },
          time: { type: "string" },
          repeat: { type: "string" },
          note: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          domain: { type: "string", enum: ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"] },
          recordKind: { type: "string", enum: ["expense", "medication", "meal_inventory", "tool_link", "meeting_note", "deadline", "person_followup", "gift", "birthday", "home_task", "shopping_item", "idea", "recommendation", "medical_info", "sleep", "decision"] },
          amount: { type: "number" },
          currency: { type: "string" },
          expenses: {
            type: "array",
            description: "Use when the user mentions multiple expenses in one turn.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                amount: { type: "number" },
                currency: { type: "string" },
                notes: { type: "string" },
                tags: { type: "array", items: { type: "string" } }
              },
              required: ["title", "amount"]
            }
          },
          person: { type: "string" },
          url: { type: "string" },
          collection: { type: "string", description: "Optional named collection/folder, e.g. Mis enlaces, Regalos mama, Ideas de videos." },
          tags: { type: "array", items: { type: "string" } },
          rememberAs: { type: "string", description: "A durable memory sentence if this is a user preference, identity, routine, goal, relationship detail, or personal context Koru should reuse." },
          memoryKind: { type: "string", enum: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"] },
          sensitivity: { type: "string", enum: ["normal", "sensitive"] },
          useForSuggestions: { type: "boolean" },
          listTitle: { type: "string" },
          summaryTitle: { type: "string" }
        },
        required: ["uiBlockType", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deliver_response",
      description: "Deliver the final Koru response after tools. This is the only valid final answer.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reply: { type: "string" },
          understanding: {
            type: "object",
            additionalProperties: false,
            properties: {
              literalRequest: { type: "string" },
              userGoal: { type: "string" },
              unstatedNeeds: { type: "array", items: { type: "string" } },
              assumptions: { type: "array", items: { type: "string" } },
              confidence: { type: "number" }
            },
            required: ["literalRequest", "userGoal", "unstatedNeeds", "assumptions", "confidence"]
          },
          uiBlocks: {
            type: "array",
            items: { type: "object" },
            description: "Visual cards shown to the user. Each item MUST include a 'type' field. Available types: weather, restaurant_synthesis, comparison, product_analysis, smart_checklist, outfit, review_score, review_document, review_quote, plan, saved_record, personal_query, match_timeline, live_match, match_stats, crypto_portfolio, market, forex, election_results, election_vote, data_ticker, route_timeline, transport_compare, route_map, travel_planner, birthday_calendar, birthday_alarm, social_interaction, local_action, research_sources, data_card, web_nav, money_summary, morning_brief, generation."
          },
          suggestedActions: { type: "array", items: { type: "object" } },
          memoryCandidates: { type: "array", items: { type: "object" } },
          commitments: { type: "array", items: { type: "object" } },
          records: { type: "array", items: { type: "object" } },
          sentiment: { type: "string", enum: ["calm", "heavy", "busy", "good"] }
        },
        required: ["reply", "understanding", "uiBlocks", "suggestedActions", "memoryCandidates", "commitments", "records"]
      }
    }
  }
];
var ALL_TOOL_DEFINITIONS2 = [
  ...TOOL_DEFINITIONS,
  ...ALL_TOOL_DEFINITIONS
];
var CATEGORY_TOOLS = {
  weather: ["weather", "weather_travel"],
  world_info: [
    "web_search",
    "restaurant_deep_search",
    "news_topic",
    "trending_twitter",
    "person_info",
    "world_signal"
  ],
  shopping: ["shopping_compare", "price_history", "product_review"],
  planning: [
    "plan_day",
    "route_plan",
    "reminder_set",
    "alarm_set",
    "calendar_add",
    "travel_itinerary"
  ],
  personal_query: [
    "query_personal_context",
    "expense_track",
    "budget_check",
    "save_memory",
    "save_personal_item"
  ],
  action: [
    "save_memory",
    "save_personal_item",
    "expense_track",
    "reminder_set",
    "alarm_set",
    "restaurant_deep_search"
  ],
  // research se maneja con su propio pipeline (runDeepResearchFlow); si algo
  // cae al flujo nativo, web_search es el único apoyo razonable.
  research: ["web_search"],
  sports: ["match_schedule", "match_live", "team_follow", "league_standings"],
  market: ["crypto_price", "stock_quote", "exchange_history", "currency_convert"],
  travel: ["travel_itinerary", "flight_search", "hotel_search"],
  directions: ["route_traffic", "weather", "travel_itinerary"],
  elections: ["web_search", "news_topic"],
  review: ["shopping_compare", "web_search", "movie_info", "book_info", "game_info", "product_review"],
  birthday: ["save_personal_item", "query_personal_context"],
  // 🔴 FIX P1: nuevas categorías para tools que ya existían pero no se rutaban
  food: ["recipe_find", "recipe_by_ingredients", "food_info", "wine_pairing", "nutrition_calc", "restaurant_deep_search"],
  media: ["movie_info", "book_info", "game_info", "person_info", "person_filmography", "web_search"],
  knowledge: ["wikipedia_lookup", "dictionary_define", "math_calc", "unit_convert", "web_search"],
  conversation: []
};
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asString2(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function cleanText(value, fallback = "") {
  return asString2(value)?.replace(/\s+/g, " ").trim() ?? fallback;
}
function plainLower(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function timeFromText(value) {
  const match = /\b(?:a\s+las|las)\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(plainLower(value));
  if (!match) return void 0;
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = match[2] ? Math.max(0, Math.min(59, Number(match[2]))) : 0;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
function createId3(prefix) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}
function initialsFromName(name) {
  const clean = String(name ?? "").trim().toUpperCase();
  if (!clean) return "???";
  if (/^[A-Z]{2,4}$/.test(clean) && clean.length <= 4) return clean;
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1) return words[0].slice(0, 3);
  const filtered = words.filter((w) => !["DE", "DEL", "LA", "LAS", "EL", "LOS", "Y", "FC", "CF"].includes(w));
  return (filtered.slice(0, 3).map((w) => w[0]).join("") || words[0].slice(0, 3)).padEnd(3, "X");
}
function formatMatchDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = /* @__PURE__ */ new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((todayStart.getTime() - dStart.getTime()) / (24 * 60 * 60 * 1e3));
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays === -1) return "Ma\xF1ana";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return "";
  }
}
function safeJsonParse(raw) {
  try {
    return asRecord(JSON.parse(raw || "{}"));
  } catch {
    return {};
  }
}
function extractJsonBlock(text) {
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (c === "\\") {
      escapeNext = true;
      continue;
    }
    if (c === '"' && !inString) {
      inString = true;
      continue;
    }
    if (c === '"' && inString) {
      inString = false;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text;
}
function stripReasoning2(text) {
  if (!text) return "";
  let out = text;
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").replace(/<reflection>[\s\S]*?<\/reflection>/gi, "").replace(/<reflection>[\s\S]*$/gi, "").replace(/<\/?think>/gi, "").replace(/<\/?reasoning>/gi, "");
  const outputMatch = out.match(/<output>([\s\S]*?)<\/output>/i);
  if (outputMatch) {
    out = outputMatch[1];
  }
  const jsonStart = out.search(/\{\s*["']reply["']\s*:/);
  if (jsonStart > 0) {
    out = out.slice(jsonStart);
  }
  const hasJsonReply = /\{\s*["']reply["']\s*:/.test(out);
  if (hasJsonReply) {
    return out;
  }
  const thinkingStartPatterns = [
    /^(the user|the user is|the user wants|the user is asking|i should|i need to|let me|let's think|i'll|i will|i am going to|first,?\s*i|now i|the question|looking at|analyzing|to answer this|based on the|so,?\s*i|this is a|this is an|let's consider|step by step|i have to|i must|i'm going to|the request|the input|the message|i want to|i can|i could|i'm thinking|okay,?\s*(so|i|let|the)|alright,?\s*(so|i|let|the))\b/i
  ];
  const trimmed = out.trim();
  if (trimmed.length > 20 && thinkingStartPatterns.some((re) => re.test(trimmed))) {
    return "";
  }
  const thinkingIndicators = (out.match(/\b(i need to|let me|i should|i will|i'll|i am going to|i'm going to|i have to|i must|the user|i want to|i can|step by step|let's think|i think|i believe|first i|then i|next i|finally i)\b/gi) || []).length;
  if (thinkingIndicators >= 2 && trimmed.length > 30) {
    return "";
  }
  return out;
}
function safeJsonObjectFromContent(raw) {
  const cleaned = stripReasoning2(raw);
  const direct = safeJsonParse(cleaned);
  if (direct.reply !== void 0 || direct.uiBlocks !== void 0) return direct;
  const extracted = safeJsonParse(extractJsonBlock(cleaned));
  if (extracted.reply !== void 0 || extracted.uiBlocks !== void 0) return extracted;
  const reply = extractStringField(cleaned, "reply");
  const mascotState = extractStringField(cleaned, "mascotState") || extractStringField(cleaned, "mascot_state");
  if (reply && reply.length > 3) {
    return { reply, mascotState: mascotState || "idle", uiBlocks: [] };
  }
  return {};
}
function extractStringField(raw, field) {
  const idx = raw.toLowerCase().indexOf(`"${field.toLowerCase()}"`);
  if (idx === -1) return void 0;
  let start = raw.indexOf('"', idx + field.length + 2);
  if (start === -1) return void 0;
  start++;
  let i = start;
  let escaped = false;
  while (i < raw.length) {
    const c = raw[i];
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      i++;
      continue;
    }
    if (c === '"') break;
    i++;
  }
  return raw.slice(start, i);
}
function cleanReplyText(value) {
  return stripReasoning2(cleanText(value)).replace(/\*?\s*uiBlock\s*:\s*[a-z_]+\s*\*?/gi, "").replace(/\buiBlocks?\b\s*[:=]\s*\[[\s\S]*$/i, "").replace(/\b(Hola|Gracias|Perfecto|Listo)(?=[A-ZÁÉÍÓÚÑ])/g, "$1 ").replace(/\s+/g, " ").trim();
}
function formatCompactNumber(value, currency) {
  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    ...currency ? { style: "currency", currency } : {}
  });
  return formatter.format(value);
}
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
function providerUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
function hasUsableAssistantMessage(data) {
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  const message = asRecord(choice.message);
  return Boolean(asString2(message.content) || asString2(message.reasoning) || asArray(message.tool_calls).length);
}
async function callMinimax(config2, messages, timeoutMs, toolsEnabled = true) {
  const accessToken = config2.minimaxAccessToken;
  if (!accessToken) throw new Error("MiniMax access token not configured");
  logger.info("callMinimax", "Requesting MiniMax", { model: "MiniMax-M2.7", msgCount: messages.length, toolsEnabled });
  const minimaxMessages = messages.map((m) => {
    if (m.role === "tool") {
      let content2 = m.content ?? "";
      try {
        const data2 = JSON.parse(content2);
        if (data2.type === "search" && Array.isArray(data2.sources)) {
          const formatted = data2.sources.map((s, i) => {
            const text = s.content || s.snippet || "";
            return `${i + 1}. ${s.title} (${s.domain})
${text}`;
          }).filter((s) => s.trim().length > 3).join("\n\n");
          content2 = formatted || `B\xFAsqueda: ${data2.title || ""}`;
        } else if (data2.type === "weather") {
          content2 = `Clima - Ciudad: ${data2.city || "?"}, Ahora: ${data2.now || "?"}, Rango: ${data2.range || "?"}, Lluvia: ${data2.rain || "?"}, Viento: ${data2.wind || "?"}`;
        }
      } catch {
      }
      return { role: "user", content: `Resultado de herramienta (${m.tool_call_id ?? "unknown"}):
${content2}` };
    }
    if (m.role === "assistant" && m.tool_calls) {
      return {
        role: "assistant",
        content: m.content ?? `Voy a usar herramientas: ${m.tool_calls.map((t) => t.function.name).join(", ")}`
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });
  const response = await fetchWithTimeout("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: minimaxMessages,
      ...toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS2, tool_choice: "auto" } : {},
      temperature: 0.25,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
      reasoning_split: true
    })
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  const assistantMsg = asRecord(choice.message);
  const content = asString2(assistantMsg.content) ?? "";
  const toolCalls = asArray(assistantMsg.tool_calls);
  const reasoningContent = asString2(assistantMsg.reasoning_content) ?? "";
  logger.info("callMinimax", `Response HTTP ${response.status}`, { contentPreview: content.slice(0, 500), reasoningPreview: reasoningContent.slice(0, 200), hasTools: toolCalls.length > 0, usage: dump(data.usage, 300) });
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    logger.error("callMinimax", `MiniMax returned ${response.status}`, { body: dump(data, 1e3) });
    throw new Error(`MiniMax returned ${response.status}`);
  }
  return {
    provider: "minimax",
    model: asString2(asRecord(data).model) ?? "MiniMax-M2.7",
    message: assistantMsg
  };
}
async function callNvidia(config2, messages, timeoutMs, toolsEnabled = true, availableTools, modelOverride) {
  const isOllama = isOllamaUrl(config2.nvidiaBaseUrl);
  if (isOllama) {
    const body2 = {
      model: modelOverride ?? config2.nvidiaModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content ?? "" })),
      ...toolsEnabled ? {} : { format: "json" },
      options: { temperature: 0, top_p: 0.95, num_predict: 8192 },
      stream: false
    };
    if (toolsEnabled) {
      body2.tools = availableTools ?? ALL_TOOL_DEFINITIONS2;
    }
    const response2 = await fetchWithTimeout(providerUrl(config2.nvidiaBaseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body2)
    }, timeoutMs);
    const data2 = await response2.json().catch(() => ({}));
    if (!response2.ok || !data2.message) {
      throw new Error(`Ollama returned ${response2.status}`);
    }
    const msg = asRecord(data2.message);
    const rawToolCalls = asArray(msg.tool_calls);
    const toolCalls = rawToolCalls.map((tc, index) => {
      const t = asRecord(tc);
      const fn = asRecord(t.function);
      return {
        id: asString2(t.id) || `call_${Date.now()}_${index}`,
        type: asString2(t.type) || "function",
        function: {
          name: cleanText(fn.name),
          arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments)
        }
      };
    });
    return {
      provider: "nvidia",
      model: asString2(data2.model) ?? config2.nvidiaModel,
      message: {
        role: asString2(msg.role) ?? "assistant",
        content: asString2(msg.content),
        tool_calls: toolCalls
      }
    };
  }
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  if (config2.nvidiaApiKey && config2.nvidiaApiKey !== "dummy") {
    headers.Authorization = `Bearer ${config2.nvidiaApiKey}`;
  }
  const body = {
    model: modelOverride ?? config2.nvidiaModel,
    messages,
    ...toolsEnabled ? { tools: availableTools ?? TOOL_DEFINITIONS, tool_choice: "auto" } : {},
    temperature: 0.25,
    top_p: 0.95,
    max_tokens: 8192,
    stream: false
  };
  let response;
  try {
    response = await fetchWithTimeout(providerUrl(config2.nvidiaBaseUrl, "/v1/chat/completions"), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    }, timeoutMs);
  } catch (firstErr) {
    logger.warn("callNvidia", "First attempt failed, retrying in 2s", { error: firstErr instanceof Error ? firstErr.message : "unknown" });
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    response = await fetchWithTimeout(providerUrl(config2.nvidiaBaseUrl, "/v1/chat/completions"), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    }, timeoutMs);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    throw new Error(`NVIDIA returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "nvidia",
    model: asString2(asRecord(data).model) ?? config2.nvidiaModel,
    message: asRecord(choice.message)
  };
}
async function callOpenRouterCandidate(key, model, messages, timeoutMs, toolsEnabled = true) {
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": "Koru Agent Loop"
    },
    body: JSON.stringify({
      model,
      messages,
      ...toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS2, tool_choice: "auto" } : {},
      temperature: 0.25,
      max_tokens: 8192,
      stream: false,
      response_format: { type: "json_object" }
    })
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    throw new Error(`OpenRouter ${model} returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "openrouter",
    model: asString2(asRecord(data).model) ?? model,
    message: asRecord(choice.message)
  };
}
async function callOpenRouter(config2, messages, timeoutMs, toolsEnabled = true) {
  const candidates = config2.openRouterKeys.slice(0, 3).flatMap((key) => config2.openRouterModels.slice(0, 3).map((model) => ({ key, model })));
  if (!candidates.length) throw new Error("OpenRouter fallback is not configured.");
  return Promise.any(candidates.map((candidate) => callOpenRouterCandidate(candidate.key, candidate.model, messages, timeoutMs, toolsEnabled)));
}
async function callBlueSmindsCandidate(key, model, messages, timeoutMs, toolsEnabled = true) {
  const response = await fetchWithTimeout("https://api.bluesminds.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      ...toolsEnabled ? { tools: ALL_TOOL_DEFINITIONS2, tool_choice: "auto" } : {},
      temperature: 0.25,
      max_tokens: 8192,
      stream: false
    })
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !hasUsableAssistantMessage(data)) {
    throw new Error(`BlueSminds ${model} returned ${response.status}`);
  }
  const choice = asRecord(asArray(asRecord(data).choices)[0]);
  return {
    provider: "bluesminds",
    model: asString2(asRecord(data).model) ?? model,
    message: asRecord(choice.message)
  };
}
async function callBlueSminds(config2, messages, timeoutMs, toolsEnabled = true) {
  const keys = (config2.bluesmindsKeys ?? []).slice(0, 3);
  const model = config2.bluesmindsModel ?? "mimo-v2.5";
  if (!keys.length) throw new Error("BlueSminds is not configured.");
  let lastError;
  for (const key of keys) {
    try {
      return await callBlueSmindsCandidate(key, model, messages, timeoutMs, toolsEnabled);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn("callBlueSminds", `BlueSminds ${model} failed with a key, trying next`, { reason: lastError.message });
    }
  }
  throw lastError ?? new Error(`BlueSminds ${model} failed with all available keys.`);
}
function providerResultIsValid(result) {
  const content = result.message?.content ?? "";
  const trimmed = content.trim();
  const hasTools = asArray(result.message?.tool_calls).length > 0;
  const hasContent = trimmed.length > 0;
  return hasContent || hasTools;
}
function isOllamaUrl(baseUrl) {
  const value = (baseUrl ?? "").toLowerCase();
  return value.includes(":11434") || value.includes("ollama");
}
function inferProviderFromModel(model) {
  if (!model) return void 0;
  if (model === "MiniMax-M2.7") return "minimax";
  if (model === "mimo-v2.5") return "bluesminds";
  if (model.startsWith("hf.co/")) return "nvidia";
  if (!model.includes("/")) return "nvidia";
  if (model.startsWith("nvidia/") && !model.includes(":")) return "nvidia";
  if (model.startsWith("stepfun-ai/")) return "nvidia";
  if (model.includes("/") && model.includes(":")) return "openrouter";
  return void 0;
}
function nvidiaTimeoutMs(config2, isOllama, timeoutMs) {
  if (isOllama) return Math.min(15e4, timeoutMs);
  const isLargeNemotron = config2.nvidiaModel.toLowerCase().includes("nemotron-3-ultra");
  return Math.min(isLargeNemotron ? 18e4 : 6e4, timeoutMs);
}
function selectModelForInput(input, config2, isTrivial, isDeliverable) {
  if (!config2.nvidiaFastModel && !config2.nvidiaMediumModel) return void 0;
  if (isTrivial && config2.nvidiaFastModel) {
    logger.info("modelRouter", "Using fast model", { model: config2.nvidiaFastModel, reason: "trivial input" });
    return config2.nvidiaFastModel;
  }
  if (isDeliverable) {
    logger.info("modelRouter", "Using ultra model", { model: config2.nvidiaModel, reason: "deliverable" });
    return config2.nvidiaModel;
  }
  if (config2.nvidiaMediumModel) {
    logger.info("modelRouter", "Using medium model", { model: config2.nvidiaMediumModel, reason: "normal input" });
    return config2.nvidiaMediumModel;
  }
  return void 0;
}
async function callProvider(config2, messages, timeoutMs, toolsEnabled = true, preferredProvider, availableTools, modelOverride) {
  const isOllama = isOllamaUrl(config2.nvidiaBaseUrl);
  const nvidiaAvailable = Boolean(config2.nvidiaApiKey) || isOllama;
  const bluesmindsKeys = config2.bluesmindsKeys ?? [];
  const bluesmindsModel = config2.bluesmindsModel ?? "mimo-v2.5";
  const bluesmindsAvailable = bluesmindsKeys.length > 0 && bluesmindsModel.length > 0;
  if (preferredProvider === "bluesminds" && bluesmindsAvailable) {
    try {
      return await callBlueSminds(config2, messages, Math.min(6e4, timeoutMs), toolsEnabled);
    } catch (err) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "Preferred BlueSminds failed, falling through", { reason: err?.message });
    }
  }
  if (preferredProvider === "minimax" && config2.minimaxAccessToken) {
    try {
      const result = await callMinimax(config2, messages, timeoutMs, toolsEnabled);
      if (providerResultIsValid(result)) {
        logger.info("callProvider", "Preferred MiniMax succeeded");
        return result;
      }
      logger.warn("callProvider", "Preferred MiniMax responded but invalid, falling through");
    } catch (err) {
      logger.warn("callProvider", "Preferred MiniMax failed, falling through", { reason: err?.message });
    }
  }
  if (preferredProvider === "nvidia" && nvidiaAvailable) {
    try {
      const result = await callNvidia(config2, messages, nvidiaTimeoutMs(config2, isOllama, timeoutMs), toolsEnabled, availableTools, modelOverride);
      if (providerResultIsValid(result)) return result;
      logger.warn("callProvider", "Preferred NVIDIA responded but invalid, falling back");
    } catch (err) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "Preferred NVIDIA failed, falling back", { reason: err?.message });
    }
  }
  if (preferredProvider === "openrouter" && config2.openRouterKeys.length) {
    return callOpenRouter(config2, messages, Math.min(115e3, timeoutMs), toolsEnabled);
  }
  if (bluesmindsAvailable && (!preferredProvider || preferredProvider === "bluesminds")) {
    try {
      const result = await callBlueSminds(config2, messages, Math.min(6e4, timeoutMs), toolsEnabled);
      if (providerResultIsValid(result)) {
        logger.info("callProvider", "BlueSminds succeeded");
        return result;
      }
      logger.warn("callProvider", "BlueSminds responded but invalid, falling through");
    } catch (err) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "BlueSminds failed, falling through", { reason: err?.message });
    }
  }
  if (config2.minimaxAccessToken && (!preferredProvider || preferredProvider === "minimax")) {
    try {
      const result = await callMinimax(config2, messages, timeoutMs, toolsEnabled);
      if (providerResultIsValid(result)) {
        logger.info("callProvider", "MiniMax succeeded");
        return result;
      }
      logger.warn("callProvider", "MiniMax responded but invalid, falling through");
    } catch (err) {
      logger.warn("callProvider", "MiniMax failed, falling through", { reason: err?.message });
    }
  }
  if (!nvidiaAvailable) {
    return callOpenRouter(config2, messages, Math.min(115e3, timeoutMs), toolsEnabled);
  }
  if (!preferredProvider || preferredProvider !== "openrouter") {
    try {
      const result = await callNvidia(config2, messages, nvidiaTimeoutMs(config2, isOllama, timeoutMs), toolsEnabled, availableTools, modelOverride);
      if (providerResultIsValid(result)) return result;
      logger.warn("callProvider", "NVIDIA responded but invalid, falling back");
    } catch (err) {
      if (isRateLimitError(err)) throw err;
      logger.warn("callProvider", "NVIDIA failed, falling back to OpenRouter", { reason: err?.message });
    }
  }
  if (config2.openRouterKeys.length) {
    return callOpenRouter(config2, messages, Math.min(115e3, timeoutMs), toolsEnabled);
  }
  throw new Error("Ning\xFAn proveedor de IA respondi\xF3. Verific\xE1 la conexi\xF3n o las credenciales.");
}
var RateLimitError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RateLimitError";
  }
};
function isRateLimitError(error) {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota") || msg.includes("free-models-per-day");
}
function sourceFromUrl(title, url, snippet) {
  let domain = "fuente externa";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = "fuente externa";
  }
  return { title, url, domain, snippet };
}
async function geocodeCity(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 15e3);
  const data = await response.json().catch(() => ({}));
  const result = data.results?.[0];
  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") return null;
  return {
    name: [result.name, result.country].filter(Boolean).join(", "),
    latitude: result.latitude,
    longitude: result.longitude
  };
}
async function getWeather(args) {
  const requestedCity = cleanText(args.city);
  if (!requestedCity) {
    return {
      type: "weather",
      city: "",
      status: "need_city",
      advice: "No hay ciudad conocida del usuario. Preguntale con calidez en qu\xE9 ciudad est\xE1, avisale que la vas a recordar para la pr\xF3xima, y NO inventes datos de clima.",
      sources: []
    };
  }
  try {
    const wttrUrl = `https://wttr.in/${encodeURIComponent(requestedCity)}?format=j1`;
    const wttrRes = await fetchWithTimeout(wttrUrl, { headers: { "User-Agent": "Koru/1.0" } }, 1e4);
    if (wttrRes.ok) {
      const wttr = await wttrRes.json();
      const cur = wttr.current_condition?.[0];
      const area = wttr.nearest_area?.[0];
      const cityName = area?.areaName?.[0]?.value ?? requestedCity;
      const country = area?.country?.[0]?.value ?? "";
      const temp = cur?.temp_C ? parseInt(cur.temp_C) : void 0;
      const wind = cur?.windspeedKmph ? parseInt(cur.windspeedKmph) : void 0;
      const desc = cur?.weatherDesc?.[0]?.value?.trim() ?? "";
      const max = wttr.weather?.[0]?.maxtempC?.[0] ? parseInt(wttr.weather[0].maxtempC[0]) : void 0;
      const min = wttr.weather?.[0]?.mintempC?.[0] ? parseInt(wttr.weather[0].mintempC[0]) : void 0;
      const rain = wttr.weather?.[0]?.hourly?.[0]?.chanceofrain?.[0] ? parseInt(wttr.weather[0].hourly[0].chanceofrain[0]) : void 0;
      if (temp !== void 0) {
        const advice = [
          `${Math.round(temp)} C ahora`,
          rain !== void 0 && rain >= 50 ? "conviene paraguas" : rain !== void 0 ? "lluvia poco probable" : void 0,
          min !== void 0 && min <= 10 ? "lleva abrigo si sales tarde" : void 0
        ].filter(Boolean).join("; ");
        return {
          type: "weather",
          city: country ? `${cityName}, ${country}` : cityName,
          now: `${Math.round(temp)} C`,
          range: min !== void 0 && max !== void 0 ? `${Math.round(min)}-${Math.round(max)} C` : void 0,
          rain: rain !== void 0 ? `${rain}%` : void 0,
          wind: wind !== void 0 ? `${Math.round(wind)} km/h` : void 0,
          advice: advice || "Clima consultado.",
          sources: [sourceFromUrl("wttr.in", "https://wttr.in/", "Datos de clima en tiempo real.")]
        };
      }
    }
  } catch {
  }
  const location = await geocodeCity(requestedCity);
  if (!location) {
    return {
      type: "weather",
      city: requestedCity,
      advice: "No pude ubicar esa ciudad. No invento clima.",
      sources: []
    };
  }
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("timezone", "auto");
    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 1e4);
    const data = await response.json().catch(() => ({}));
    const temp = data.current?.temperature_2m;
    const max = data.daily?.temperature_2m_max?.[0];
    const min = data.daily?.temperature_2m_min?.[0];
    const rain = data.daily?.precipitation_probability_max?.[0];
    const wind = data.current?.wind_speed_10m;
    if (temp !== void 0) {
      const advice = [
        `${Math.round(temp)} C ahora`,
        rain !== void 0 && rain >= 50 ? "conviene paraguas" : rain !== void 0 ? "lluvia poco probable" : void 0,
        min !== void 0 && min <= 10 ? "lleva abrigo si sales tarde" : void 0
      ].filter(Boolean).join("; ");
      return {
        type: "weather",
        city: location.name,
        now: `${Math.round(temp)} C`,
        range: min !== void 0 && max !== void 0 ? `${Math.round(min)}-${Math.round(max)} C` : void 0,
        rain: rain !== void 0 ? `${rain}%` : void 0,
        wind: wind !== void 0 ? `${Math.round(wind)} km/h` : void 0,
        advice: advice || "Clima consultado.",
        sources: [sourceFromUrl("Open-Meteo", "https://open-meteo.com/", "Datos abiertos de clima.")]
      };
    }
  } catch {
  }
  return {
    type: "weather",
    city: requestedCity,
    advice: "No pude obtener el clima en este momento.",
    sources: []
  };
}
function htmlText(raw) {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
async function searchDuckDuckGo2(query) {
  const response = await fetchWithTimeout(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 KoruAgent/1.0",
      Accept: "text/html"
    }
  }, 1e4);
  const html = await response.text();
  const sources = [];
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = resultRe.exec(html)) && sources.length < 6) {
    const rawUrl = match[1];
    let url = rawUrl;
    try {
      const parsed = new URL(rawUrl, "https://duckduckgo.com");
      url = parsed.searchParams.get("uddg") ?? parsed.href;
    } catch {
      url = rawUrl;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    const domain = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "";
      }
    })();
    if (/duckduckgo\.com|google\.com|bing\.com/i.test(domain)) continue;
    sources.push(sourceFromUrl(htmlText(match[2]), url, htmlText(match[3]).slice(0, 260)));
  }
  return sources;
}
async function searchGdelt(query) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "6");
  url.searchParams.set("sort", "HybridRel");
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 1e4);
  const data = await response.json().catch(() => ({}));
  return (data.articles ?? []).filter((item) => item.title && item.url).slice(0, 6).map((item) => sourceFromUrl(item.title, item.url, item.seendate));
}
function extractMainImage(html, pageUrl) {
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ?? html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveImageUrl(ogMatch[1], pageUrl);
  const twMatch = html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i) ?? html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);
  if (twMatch?.[1]) return resolveImageUrl(twMatch[1], pageUrl);
  const linkMatch = html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
  if (linkMatch?.[1]) return resolveImageUrl(linkMatch[1], pageUrl);
  const contentBlock = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] ?? html;
  const imgMatches = contentBlock.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi);
  for (const m of imgMatches) {
    const src = m[1];
    if (isValidContentImage(src)) {
      return resolveImageUrl(src, pageUrl);
    }
  }
  return void 0;
}
function isValidContentImage(src) {
  if (!src) return false;
  const lower = src.toLowerCase();
  if (lower.startsWith("data:")) return false;
  if (/\b(logo|icon|avatar|sprite|placeholder|blank|spacer|pixel|favicon|tracking|beacon|1x1)\b/i.test(lower)) return false;
  if (lower.endsWith(".svg") || lower.endsWith(".gif")) return false;
  if (/(google-analytics|doubleclick|facebook\.com\/tr|pixel\.)/i.test(lower)) return false;
  if (/[?&](w|h|width|height)=(\d{1,2})\b/i.test(lower)) {
    const sizeMatch = lower.match(/[?&](w|h|width|height)=(\d{1,2})\b/i);
    if (sizeMatch && parseInt(sizeMatch[2]) < 100) return false;
  }
  return true;
}
function resolveImageUrl(src, baseUrl) {
  try {
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith("//")) {
      const proto = baseUrl.match(/^(https?)/i)?.[1] ?? "https";
      return `${proto}:${src}`;
    }
    if (src.startsWith("/")) {
      const origin = baseUrl.match(/^(https?:\/\/[^/]+)/i)?.[1];
      if (origin) return `${origin}${src}`;
    }
    const base = baseUrl.replace(/[^/]*$/, "");
    return `${base}${src}`;
  } catch {
    return src;
  }
}
async function fetchPageContent2(url, maxChars = 1200) {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 15e3);
    const html = await res.text();
    const imageUrl = extractMainImage(html, url);
    let contentHtml = html;
    const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      contentHtml = articleMatch[1];
    } else {
      const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) {
        contentHtml = mainMatch[1];
      } else {
        const classMatch = html.match(/<(?:div|section)\b[^>]*\b(?:class|id)="(?:entry-content|article-body|post-content|story-body|content-body|texto-nota|nota-content|article__content|main-content|nota-texto|content-text)[^"]*"[^>]*>([\s\S]*?)<\/\1>/i);
        if (classMatch) {
          contentHtml = classMatch[2] ?? classMatch[1];
        }
      }
    }
    if (contentHtml === html) {
      const pMatches = html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
      const paragraphs = [];
      for (const m of pMatches) {
        const text2 = m[1].replace(/<[^>]+>/g, " ").trim();
        if (text2.length > 40) paragraphs.push(text2);
      }
      if (paragraphs.length > 0) {
        contentHtml = paragraphs.slice(0, 8).join(" ");
      }
    }
    const text = contentHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { text: text.slice(0, maxChars), imageUrl };
  } catch {
    return { text: "" };
  }
}
async function runSearch(args, shopping = false, extractorCtx) {
  const query = cleanText(args.query, "noticias importantes hoy");
  const mode = shopping ? "shopping" : cleanText(args.mode, "research");
  const expanded = mode === "world" ? `${query} ultimos 30 dias tendencias` : mode === "news" ? `${query} noticias recientes` : shopping ? `${query} precio opiniones entrega` : query;
  const gdelt = mode === "news" || mode === "world" ? await searchGdelt(expanded).catch(() => []) : [];
  const duck = gdelt.length ? [] : await searchDuckDuckGo2(expanded).catch(() => []);
  let sources = [...gdelt, ...duck].slice(0, 6);
  const comparisonItems = shopping ? sources.slice(0, 4).map((source, index) => ({
    title: source.title,
    vendor: source.domain,
    url: source.url,
    evidence: source.snippet,
    score: Math.max(55, 88 - index * 8)
  })) : void 0;
  for (let i = 0; i < Math.min(sources.length, 3); i++) {
    const pageData = await fetchPageContent2(sources[i].url, 1200);
    sources[i].content = pageData.text;
    if (pageData.imageUrl) {
      sources[i].imageUrl = pageData.imageUrl;
    }
  }
  let deferredDataCard;
  if (extractorCtx && !shopping && sources.length > 0) {
    const sourcesCopy = sources.map((s) => ({ ...s }));
    const userInput = extractorCtx.userInput;
    const chatFn = extractorCtx.chatFn;
    const extractStart = Date.now();
    deferredDataCard = (async () => {
      try {
        const extracted = await extractStructuredData({ userInput, sources: sourcesCopy, chatFn });
        logger.info("runSearch", "Structure extraction (deferred)", {
          extracted: extracted ? `${extracted.items.length} items` : "none",
          durationMs: Date.now() - extractStart
        });
        if (!extracted || extracted.items.length === 0) return null;
        return {
          type: "data_card",
          title: extracted.title,
          items: extracted.items.map((it) => ({
            label: it.label,
            value: it.value,
            detail: it.detail,
            quote: it.quote,
            sourceUrl: it.sourceUrl,
            sourceDomain: it.sourceDomain
          }))
        };
      } catch (err) {
        logger.warn("runSearch", "Deferred structure extraction failed (non-fatal)", { reason: err?.message });
        return null;
      }
    })();
  }
  return {
    type: "search",
    mode,
    title: shopping ? "Comparativa" : mode === "news" ? "Noticias importantes" : mode === "world" ? "El mundo esta hablando de esto" : "Busqueda",
    summary: sources.length ? "" : "No pude conseguir fuentes \xFAtiles con los conectores abiertos. No inventes resultados.",
    sources,
    comparisonItems,
    deferredDataCard
  };
}
function planFromState(state, args) {
  const openCommitments = (Array.isArray(state.commitments) ? state.commitments : []).filter((item) => item && item.status === "open").slice(0, 5);
  const recentRecords = (Array.isArray(state.records) ? state.records : []).slice(0, 5);
  const focus = cleanText(args.focus, "ordenar el dia");
  const candidates = openCommitments.length ? openCommitments.map((item) => item.title) : recentRecords.length ? recentRecords.map((item) => item.title) : [focus, "Elegir el primer paso", "Cerrar con una accion chica"];
  const items = candidates.slice(0, 4).map((title, index) => ({
    time: index === 0 ? "Ahora" : index === 1 ? "+25m" : index === 2 ? "+50m" : "+75m",
    title: index === 0 ? `Primer paso: ${title}` : title,
    priority: index === 0 ? "Alta" : index === 1 ? "Media" : "Baja",
    durationMinutes: index === 0 ? 25 : 15,
    mode: index === 0 ? "focus" : "quick",
    rationale: index === 0 ? "Empieza por lo que mas reduce carga mental." : "Lo dejo chico para que no bloquee."
  }));
  return {
    type: "plan",
    title: "Plan accionable",
    items,
    context: [
      ...openCommitments.map((item) => `Pendiente: ${item.title} (${item.dueHint})`),
      ...recentRecords.map((item) => `Dato: ${item.title}`)
    ].slice(0, 8)
  };
}
function localReminderFromArgs(args, input = "") {
  const title = cleanText(args.title, input || "Recordatorio");
  const dueText = cleanText(args.dueText ?? args.dueHint ?? args.startsAt, "sin fecha");
  const note = cleanText(args.note);
  return {
    type: "local_action",
    requiresApproval: true,
    block: {
      type: "reminder",
      title,
      dueText,
      note
    },
    commitments: [{ title, dueHint: dueText, status: "open" }],
    records: [{
      domain: "capture",
      kind: "deadline",
      title,
      value: title,
      dueHint: dueText,
      notes: note
    }]
  };
}
function localAlarmFromArgs(args, input = "") {
  const title = cleanText(args.title, input || "Alarma");
  const time = cleanText(args.time ?? args.startsAt ?? args.hour) || timeFromText(`${title} ${cleanText(args.note)} ${cleanText(args.dueText)}`) || "hora pendiente";
  const repeat = cleanText(args.repeat);
  const note = cleanText(args.note);
  return {
    type: "local_action",
    requiresApproval: true,
    block: {
      type: "alarm",
      title,
      time,
      repeat,
      note
    },
    commitments: [{ title, dueHint: time, status: "open" }],
    records: [{
      domain: "capture",
      kind: "deadline",
      title,
      value: title,
      dueHint: time,
      notes: note
    }]
  };
}
function isRecordInPeriod(record, period) {
  const normalized = plainLower(period);
  if (!normalized || !record.createdAt) return true;
  const created = new Date(record.createdAt);
  if (Number.isNaN(created.getTime())) return true;
  const now = /* @__PURE__ */ new Date();
  const ageMs = now.getTime() - created.getTime();
  if (/\bhoy|today\b/.test(normalized)) return ageMs >= 0 && ageMs <= 36 * 60 * 60 * 1e3;
  if (/\bsemana|week\b/.test(normalized)) return ageMs >= 0 && ageMs <= 8 * 24 * 60 * 60 * 1e3;
  if (/\bmes|month\b/.test(normalized)) return ageMs >= 0 && ageMs <= 32 * 24 * 60 * 60 * 1e3;
  return true;
}
function rowsFromRecords(records) {
  return records.slice(0, 8).map((record) => ({
    title: record.title,
    detail: [record.value && record.value !== record.title ? record.value : void 0, record.notes].filter(Boolean).join(" - "),
    meta: [record.person, record.dueHint, record.amount !== void 0 ? `${record.amount} ${record.currency || ""}`.trim() : void 0].filter(Boolean).join(" \xB7 "),
    actionLabel: record.url ? "Abrir" : void 0
  }));
}
function emptyContextBlock(title, _note) {
  return {
    type: "activity_group",
    title,
    subtitle: "No tengo datos guardados para eso todavia.",
    sections: [
      {
        title: "Siguiente paso",
        tone: "neutral",
        rows: [{ title: _note }]
      }
    ],
    note: _note
  };
}
function recordSearchText(record) {
  return [
    record.kind,
    record.domain,
    record.title,
    record.value,
    record.notes,
    record.url,
    record.collection,
    record.person,
    ...record.tags ?? []
  ].filter(Boolean).join(" ");
}
function queryTokens(query) {
  return plainLower(query).replace(/[^\p{L}\p{N}\s:/._-]+/gu, " ").split(/\s+/).map((token) => token.trim()).filter((token) => token.length > 1 && !["que", "con", "por", "sin", "mas", "los", "las", "del", "una", "uno", "mis", "tengo", "sobre", "guarde", "guardado", "guardaste"].includes(token));
}
function semanticRecordMatches(records, query, limit = 8) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  return records.map((record) => {
    const haystack = plainLower(recordSearchText(record));
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    return { record, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.record).slice(0, limit);
}
function uniqueLifeRecords(records) {
  const seen = /* @__PURE__ */ new Set();
  return records.filter((record) => {
    const key = `${record.id}|${record.domain}|${record.kind}|${plainLower(record.title)}|${plainLower(record.value ?? "")}|${plainLower(record.url ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function queryPersonalContextFromState(state, args) {
  const topic = cleanText(args.topic, "general");
  const query = cleanText(args.query, cleanText(args.__userInput));
  const period = cleanText(args.period);
  const records = (Array.isArray(state.records) ? state.records : []).filter((record) => isRecordInPeriod(record, period));
  if (topic === "expenses") {
    const expenses = records.filter((record) => record.kind === "expense");
    if (!expenses.length) {
      return {
        type: "personal_query",
        block: {
          type: "money_summary",
          title: "Gastos",
          summaryItems: [{ label: "Registros", value: "0" }],
          recommendation: "No tengo gastos guardados para ese periodo. Si me decis uno, lo anoto y despues puedo sumarlo."
        }
      };
    }
    const currency = expenses.find((record) => record.currency)?.currency || "EUR";
    const withAmount = expenses.filter((record) => typeof record.amount === "number");
    const total = withAmount.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    return {
      type: "personal_query",
      block: {
        type: "money_summary",
        title: "Gastos registrados",
        total: withAmount.length ? Number(total.toFixed(2)) : void 0,
        currency,
        summaryItems: [
          { label: "Con monto", value: String(withAmount.length), detail: `${expenses.length} registro(s) en total` },
          ...expenses.length - withAmount.length > 0 ? [{ label: "Sin monto", value: String(expenses.length - withAmount.length), detail: "Los cuento, pero no los sumo." }] : []
        ],
        recommendation: withAmount.length ? `Tengo registrado ${Number(total.toFixed(2))} ${currency} en ${withAmount.length} gasto(s).` : "Tengo gastos guardados, pero sin monto. No invento el total."
      }
    };
  }
  if (topic === "food_inventory") {
    const food = records.filter((record) => record.kind === "meal_inventory");
    if (!food.length) return { type: "personal_query", block: { type: "saved_record", title: "Comida en casa", records: [] } };
    return {
      type: "personal_query",
      block: {
        type: "activity_group",
        title: "Comida en casa",
        subtitle: `Tengo ${food.length} cosa(s) guardadas.`,
        sections: [
          {
            title: "Disponible",
            tone: "green",
            tiles: food.slice(0, 6).map((record) => ({
              kind: "food",
              label: "En casa",
              value: record.title,
              detail: record.notes || record.value
            }))
          },
          {
            title: "Ideas rapidas",
            tone: "amber",
            rows: [{ title: `Con ${food.slice(0, 3).map((record) => record.title).join(", ")} podes armar algo simple sin comprar primero.` }]
          }
        ]
      }
    };
  }
  if (topic === "shopping_list") {
    const shopping = records.filter((record) => record.kind === "shopping_item");
    if (!shopping.length) return { type: "personal_query", block: emptyContextBlock("Compras", "No tengo una lista de compras activa guardada.") };
    const items = shopping.map((record) => record.title).filter(Boolean).slice(0, 30);
    return {
      type: "personal_query",
      block: {
        type: "shopping_list",
        title: "Lista del super",
        items,
        note: "La arme desde tus pendientes guardados."
      }
    };
  }
  if (topic === "pending_tasks") {
    const open = (Array.isArray(state.commitments) ? state.commitments : []).filter((item) => item && item.status === "open").slice(0, 8);
    if (!open.length) return { type: "personal_query", block: emptyContextBlock("Pendientes", "No veo pendientes abiertos. Si queres, tirame una descarga de cosas y las ordeno.") };
    return {
      type: "personal_query",
      block: {
        type: "plan",
        title: "Pendientes abiertos",
        items: open.map((item, index) => ({
          time: index === 0 ? "Ahora" : void 0,
          title: item.title,
          priority: index === 0 ? "Alta" : index < 3 ? "Media" : "Baja",
          durationMinutes: index === 0 ? 25 : 10,
          mode: index === 0 ? "focus" : "quick",
          rationale: item.dueHint
        })),
        note: "Los ordene desde lo que Koru tiene guardado."
      }
    };
  }
  const kindByTopic = {
    saved_links: ["tool_link"],
    health: ["medication", "medical_info", "sleep"],
    relationships: ["person_followup", "gift", "birthday"],
    memory: [],
    general: ["idea", "recommendation", "deadline", "home_task", "meeting_note", "decision"]
  };
  if (topic === "memory") {
    const useful = (Array.isArray(state.memories) ? state.memories : []).filter((memory) => memory && memory.status !== "rejected" && memory.useForSuggestions !== false).slice(0, 8);
    if (!useful.length) return { type: "personal_query", block: { type: "saved_record", title: "Memoria", records: [] } };
    return {
      type: "personal_query",
      block: {
        type: "activity_group",
        title: "Lo que tengo presente",
        subtitle: `${useful.length} recuerdo(s) utiles.`,
        sections: [
          {
            title: "Memoria",
            tone: "purple",
            rows: useful.map((memory) => ({
              title: memory.text,
              meta: memory.kind,
              detail: memory.rootQuote
            }))
          }
        ]
      }
    };
  }
  if (topic === "relationships") {
    const relationshipRecords = records.filter((record) => ["person_followup", "gift", "birthday"].includes(record.kind));
    const relationshipMemories = (Array.isArray(state.memories) ? state.memories : []).filter((memory) => memory && memory.status !== "rejected" && memory.useForSuggestions !== false).filter((memory) => memory.kind === "relationship" || semanticRecordMatches([{
      id: memory.id,
      domain: "relationship",
      kind: "person_followup",
      title: memory.text,
      value: memory.rootQuote,
      createdAt: memory.createdAt,
      sourceEntryId: memory.sourceEntryId
    }], query, 1).length > 0).slice(0, 8);
    const semanticRelationships = semanticRecordMatches(records, query).filter((record) => record.domain === "relationship" || ["person_followup", "gift", "birthday"].includes(record.kind));
    const finalRecords = uniqueLifeRecords([...relationshipRecords, ...semanticRelationships]).slice(0, 8);
    if (!finalRecords.length && !relationshipMemories.length) {
      return { type: "personal_query", block: emptyContextBlock("Relaciones", "No encontre datos guardados sobre esa persona todavia.") };
    }
    return {
      type: "personal_query",
      block: {
        type: "activity_group",
        title: "Relaciones",
        subtitle: `${finalRecords.length + relationshipMemories.length} dato(s) para tener en cuenta.`,
        sections: [
          ...finalRecords.length ? [{
            title: "Guardado",
            tone: "purple",
            rows: rowsFromRecords(finalRecords)
          }] : [],
          ...relationshipMemories.length ? [{
            title: "Memoria",
            tone: "purple",
            rows: relationshipMemories.map((memory) => ({
              title: memory.text,
              detail: memory.rootQuote,
              meta: memory.kind
            }))
          }] : []
        ]
      }
    };
  }
  const acceptedKinds = kindByTopic[topic] ?? kindByTopic.general;
  const queryLower = plainLower(query);
  const semanticMatches = semanticRecordMatches(records, query);
  const matching = topic === "saved_links" ? records.filter(
    (record) => record.kind === "tool_link" || Boolean(record.url) || Boolean(record.collection && queryLower.includes(plainLower(record.collection))) || Boolean(record.tags?.some((tag) => queryLower.includes(plainLower(tag))))
  ) : topic === "general" ? query ? [] : records : acceptedKinds.length ? records.filter((record) => acceptedKinds.includes(record.kind)) : records;
  const finalMatches = uniqueLifeRecords([...matching, ...semanticMatches]).slice(0, 8);
  if (!finalMatches.length) return { type: "personal_query", block: { type: "saved_record", title: "Contexto guardado", records: [] } };
  return {
    type: "personal_query",
    block: {
      type: "activity_group",
      title: topic === "saved_links" ? "Enlaces guardados" : topic === "health" ? "Salud" : topic === "relationships" ? "Relaciones" : "Contexto guardado",
      subtitle: `${finalMatches.length} dato(s) encontrados.`,
      sections: [
        {
          title: "Guardado",
          tone: topic === "health" ? "blue" : topic === "relationships" ? "purple" : "neutral",
          rows: rowsFromRecords(finalMatches)
        }
      ]
    }
  };
}
function inputMentionsValue(input, value) {
  if (!value) return false;
  return plainLower(input).includes(plainLower(value));
}
function argsWithCaptureHygiene(args, input) {
  const next = { ...args };
  let uiBlockType = cleanText(next.uiBlockType);
  let recordKind = cleanText(next.recordKind);
  const collection = cleanText(next.collection);
  const title = cleanText(next.title);
  const items = asArray(next.items).map((item) => cleanText(item)).filter(Boolean);
  const inputLower = plainLower(input);
  if (collection && !inputMentionsValue(input, collection) && !/\b(esa|ahi|alli|misma|mismo|carpeta|coleccion)\b/i.test(inputLower)) {
    delete next.collection;
  }
  if (uiBlockType === "shopping_list" || recordKind === "shopping_item") {
    next.uiBlockType = "shopping_list";
    next.recordKind = "shopping_item";
    next.domain = "home";
    uiBlockType = "shopping_list";
    recordKind = "shopping_item";
    if (!items.length && title) next.items = [title];
    if (!inputMentionsValue(input, cleanText(next.collection))) delete next.collection;
  }
  if (recordKind === "meal_inventory") {
    next.uiBlockType = "saved_record";
    next.recordKind = "meal_inventory";
    next.domain = "home";
    uiBlockType = "saved_record";
    recordKind = "meal_inventory";
  }
  if ((uiBlockType === "money_summary" || recordKind === "expense") && asArray(next.expenses).length) {
    next.uiBlockType = "money_summary";
    next.recordKind = "expense";
    next.domain = "money";
    uiBlockType = "money_summary";
    recordKind = "expense";
  }
  return next;
}
function memoryCaptureFromArgs(args, input = "") {
  const memories = asArray(args.memories).map(asRecord).map((item) => {
    const kind = ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(cleanText(item.kind)) ? cleanText(item.kind) : "profile";
    const sensitivity = cleanText(item.sensitivity) === "sensitive" ? "sensitive" : "normal";
    return {
      kind,
      text: cleanText(item.text),
      confidence: 0.84,
      sensitivity,
      status: "candidate",
      rootQuote: cleanText(item.rootQuote ?? item.root_quote, input),
      useForSuggestions: item.useForSuggestions === false || item.use_for_suggestions === false ? false : sensitivity !== "sensitive"
    };
  }).filter((memory) => memory.text.length > 4).slice(0, 8);
  return { type: "memory_capture", memoryCandidates: memories };
}
function inferLinkCollection(url, text) {
  const hay = `${url} ${text}`.toLowerCase();
  if (/\b(ia|ai|gpt|llm|claude|openai|anthropic|gemini|copilot|chatbot|hugg?ingface|midjourney|stable ?diffusion|ollama|inteligencia artificial)\b/.test(hay)) return "Sitios de IA";
  if (/youtube\.com|youtu\.be|vimeo\.|twitch\.|\bvideos?\b/.test(hay)) return "Videos";
  if (/\breceta|cocina|gastronom/.test(hay)) return "Recetas";
  if (/github\.com|gitlab\.|stackoverflow|npmjs|\bdocs?\b|documentaci[oó]n|programaci[oó]n/.test(hay)) return "Herramientas Dev";
  if (/mercadolibre|amazon\.|aliexpress|tienda|comprar|\bprecio/.test(hay)) return "Compras";
  if (/noticia|diario|clar[ií]n|lanacion|infobae|bbc\.|cnn\.|elpais/.test(hay)) return "Noticias";
  if (/medium\.com|substack|\bblog\b|art[ií]culo|\bpaper\b|\bleer\b/.test(hay)) return "Lecturas";
  if (/spotify|m[uú]sica|soundcloud|banda|canci[oó]n/.test(hay)) return "M\xFAsica";
  if (/viaje|hotel|vuelo|airbnb|booking/.test(hay)) return "Viajes";
  return "Enlaces";
}
function personalCaptureFromArgs(args, input = "") {
  const cleanArgs = argsWithCaptureHygiene(args, input);
  const requestedType = cleanText(cleanArgs.uiBlockType, "saved_record");
  const uiBlockType = ["reminder", "alarm", "shopping_list", "saved_record", "money_summary", "birthday_calendar", "birthday_alarm", "social_interaction"].includes(requestedType) ? requestedType : "saved_record";
  const title = cleanText(cleanArgs.title, input || "Dato guardado");
  const dueText = cleanText(cleanArgs.dueText);
  const note = cleanText(cleanArgs.note);
  const time = cleanText(cleanArgs.time) || timeFromText(`${cleanText(cleanArgs.time)} ${cleanText(cleanArgs.dueText)}`) || "";
  const repeat = cleanText(cleanArgs.repeat);
  const domain = ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"].includes(cleanText(cleanArgs.domain)) ? cleanText(cleanArgs.domain) : "capture";
  const url = cleanText(cleanArgs.url) || (input.match(/https?:\/\/[^\s"'<>)]+/i)?.[0] ?? "");
  const collection = cleanText(cleanArgs.collection) || (url ? inferLinkCollection(url, `${title} ${input}`) : "");
  const tags = [
    ...asArray(cleanArgs.tags).map((tag) => cleanText(tag)).filter(Boolean),
    ...collection ? [collection] : []
  ];
  const remembered = cleanText(cleanArgs.rememberAs);
  const requestedMemoryKind = cleanText(cleanArgs.memoryKind);
  const memoryKind = ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(requestedMemoryKind) ? requestedMemoryKind : "profile";
  const memorySensitivity = cleanText(cleanArgs.sensitivity) === "sensitive" ? "sensitive" : "normal";
  const memoryCandidates = remembered ? [{
    kind: memoryKind,
    text: remembered,
    confidence: 0.82,
    sensitivity: memorySensitivity,
    status: "candidate",
    rootQuote: input || remembered,
    useForSuggestions: cleanArgs.useForSuggestions === false ? false : memorySensitivity !== "sensitive"
  }] : [];
  const recordKind = url ? "tool_link" : ["expense", "medication", "meal_inventory", "tool_link", "meeting_note", "deadline", "person_followup", "gift", "birthday", "home_task", "shopping_item", "idea", "recommendation", "medical_info", "sleep", "decision"].includes(cleanText(cleanArgs.recordKind)) ? cleanText(cleanArgs.recordKind) : uiBlockType === "shopping_list" ? "shopping_item" : uiBlockType === "money_summary" ? "expense" : "idea";
  const items = asArray(cleanArgs.items).map((item) => cleanText(item)).filter(Boolean);
  const amount = typeof cleanArgs.amount === "number" ? cleanArgs.amount : void 0;
  const currency = cleanText(cleanArgs.currency) || (amount !== void 0 ? "EUR" : "");
  const expenses = asArray(cleanArgs.expenses).map(asRecord).map((expense) => ({
    title: cleanText(expense.title),
    amount: typeof expense.amount === "number" ? expense.amount : void 0,
    currency: cleanText(expense.currency, currency || "EUR"),
    notes: cleanText(expense.notes),
    tags: asArray(expense.tags).map((tag) => cleanText(tag)).filter(Boolean)
  })).filter((expense) => Boolean(expense.title && expense.amount !== void 0));
  const effectiveUiBlockType = recordKind === "expense" && amount !== void 0 ? "money_summary" : uiBlockType;
  const baseRecord = {
    domain,
    kind: recordKind,
    title,
    value: items.length ? items.join(", ") : title,
    amount,
    currency,
    person: cleanText(cleanArgs.person),
    url,
    collection,
    dueHint: dueText,
    notes: note,
    tags
  };
  if (effectiveUiBlockType === "alarm") {
    return {
      type: "personal_capture",
      block: { type: "alarm", title, time: time || dueText || "hora pendiente", repeat, note },
      commitments: [{ title, dueHint: time || dueText || "hora pendiente", status: "open" }],
      records: [baseRecord],
      memoryCandidates
    };
  }
  if (effectiveUiBlockType === "reminder") {
    return {
      type: "personal_capture",
      block: { type: "reminder", title, dueText, note },
      commitments: [{ title, dueHint: dueText || "sin fecha", status: "open" }],
      records: [baseRecord],
      memoryCandidates
    };
  }
  if (effectiveUiBlockType === "birthday_calendar") {
    const personName = cleanText(cleanArgs.person) || title;
    return {
      type: "personal_capture",
      block: {
        type: "birthday_calendar",
        month: dueText || "Junio 2025",
        highlightedDay: typeof cleanArgs.highlightedDay === "number" ? cleanArgs.highlightedDay : 12,
        startDay: typeof cleanArgs.startDay === "number" ? cleanArgs.startDay : 6,
        daysInMonth: typeof cleanArgs.daysInMonth === "number" ? cleanArgs.daysInMonth : 13
      },
      records: [{ ...baseRecord, title: `Cumplea\xF1os de ${personName}`, kind: "birthday" }],
      memoryCandidates
    };
  }
  if (effectiveUiBlockType === "birthday_alarm") {
    const personName = cleanText(cleanArgs.person) || title;
    return {
      type: "personal_capture",
      block: {
        type: "birthday_alarm",
        name: `Cumplea\xF1os ${personName}`,
        date: dueText || "12 jul",
        countdown: cleanText(cleanArgs.countdown, "08"),
        unit: cleanText(cleanArgs.unit, "d\xEDas"),
        eta: time || "En 30m"
      },
      records: [{ ...baseRecord, title: `Cumplea\xF1os de ${personName}`, kind: "birthday" }],
      memoryCandidates
    };
  }
  if (effectiveUiBlockType === "social_interaction") {
    const personName = cleanText(cleanArgs.person) || title;
    const gifts = asArray(cleanArgs.gifts).map((gift) => cleanText(gift)).filter(Boolean).map((gift) => ({ emoji: "gift", title: gift, detail: "Idea guardada" }));
    return {
      type: "personal_capture",
      block: {
        type: "social_interaction",
        name: personName,
        event: cleanText(cleanArgs.event, "Cumplea\xF1os"),
        date: dueText || "12 jul",
        remaining: cleanText(cleanArgs.remaining, "Faltan 8 d\xEDas"),
        gifts: gifts.length ? gifts : [{ emoji: "gift", title: "Regalo pendiente", detail: cleanText(cleanArgs.event, "Cumplea\xF1os") }]
      },
      records: [{ ...baseRecord, title: `Evento social: ${personName}`, kind: "person_followup" }],
      memoryCandidates
    };
  }
  if (effectiveUiBlockType === "shopping_list") {
    const shoppingItems = items.length ? items : [title];
    return {
      type: "personal_capture",
      block: { type: "shopping_list", title: cleanText(cleanArgs.listTitle, "Lista de compras"), items: shoppingItems, dueText, note },
      commitments: [{ title: `Comprar ${shoppingItems.join(", ")}`, dueHint: dueText || "proxima compra", status: "open" }],
      records: shoppingItems.map((item) => ({
        domain: "home",
        kind: "shopping_item",
        title: item,
        value: item,
        collection,
        dueHint: dueText,
        notes: note,
        tags
      })),
      memoryCandidates
    };
  }
  if (recordKind === "meal_inventory") {
    const inventoryItems = items.length ? items : [title];
    const records = inventoryItems.map((item) => ({
      domain: "home",
      kind: "meal_inventory",
      title: item,
      value: item,
      collection,
      notes: note,
      tags
    }));
    return {
      type: "personal_capture",
      block: { type: "saved_record", title: collection || "Comida en casa", records },
      records,
      memoryCandidates
    };
  }
  if (expenses.length) {
    const total = Number(expenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
    const expenseRecords = expenses.map((expense) => ({
      domain: "money",
      kind: "expense",
      title: expense.title,
      value: expense.title,
      amount: expense.amount,
      currency: expense.currency,
      notes: expense.notes,
      tags: expense.tags
    }));
    return {
      type: "personal_capture",
      block: {
        type: "money_summary",
        title: cleanText(cleanArgs.summaryTitle, "Gastos anotados"),
        total,
        currency: expenses[0]?.currency || "EUR",
        summaryItems: expenses.map((expense) => ({ label: expense.title, value: `${expense.amount} ${expense.currency}`, detail: expense.notes })),
        recommendation: note || `${expenses.length} gasto(s) registrados.`
      },
      records: expenseRecords,
      memoryCandidates
    };
  }
  if (effectiveUiBlockType === "money_summary") {
    return {
      type: "personal_capture",
      block: {
        type: "money_summary",
        title: cleanText(cleanArgs.summaryTitle, "Gasto anotado"),
        total: amount,
        currency: currency || "EUR",
        recommendation: note || title
      },
      records: [{ ...baseRecord, domain: "money", kind: "expense" }],
      memoryCandidates
    };
  }
  return {
    type: "personal_capture",
    // El título del bloque ES la colección: la card confirma "Guardado en X"
    // y su CTA abre la colección completa.
    block: { type: "saved_record", title: collection || "Guardado", records: [baseRecord] },
    records: [baseRecord],
    memoryCandidates: [
      ...memoryCandidates,
      ...recordKind === "idea" || recordKind === "recommendation" ? [{ kind: "preference", text: title, confidence: 0.65, sensitivity: "normal", status: "candidate", rootQuote: title, useForSuggestions: true }] : []
    ]
  };
}
function profileCityFromState(state) {
  const candidates = (state.memories ?? []).filter((m) => m.kind === "profile" && m.status !== "rejected").map((m) => m.text);
  for (const text of candidates) {
    const match = text.match(/(?:user location|ubicaci[oó]n|location)\s*[:=]\s*([^(,\n]{2,40})/i) ?? text.match(/\bviv[eo]\s+en\s+([A-ZÁÉÍÓÚÑ][^.,\n]{1,40})/i) ?? text.match(/\bciudad\s*[:=]?\s+([A-ZÁÉÍÓÚÑ][^.,\n]{1,40})/i);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}
async function executeTool(name, args, state, extractorCtx) {
  logger.info("executeTool", `Executing tool: ${name}`, { argsKeys: Object.keys(args) });
  let result;
  let deferredDataCard;
  try {
    if (name === "weather") {
      const argsWithCity = cleanText(args.city) ? args : { ...args, city: profileCityFromState(state) ?? "" };
      result = await getWeather(argsWithCity);
    } else if (name === "web_search") {
      const searchData = await runSearch(args, false, extractorCtx);
      deferredDataCard = searchData.deferredDataCard;
      result = searchData;
    } else if (name === "shopping_compare") result = await runSearch(args, true);
    else if (name === "route_traffic") result = await runSearch({ ...args, mode: "research", query: cleanText(args.query) || [cleanText(args.origin), cleanText(args.destination)].filter(Boolean).join(" a ") || cleanText(args.__userInput) }, false);
    else if (name === "calendar_reminder") result = localReminderFromArgs(args, cleanText(args.__userInput));
    else if (name === "alarm") result = localAlarmFromArgs(args, cleanText(args.__userInput));
    else if (name === "plan_day") result = planFromState(state, args);
    else if (name === "query_personal_context") result = queryPersonalContextFromState(state, args);
    else if (name === "save_memory") result = memoryCaptureFromArgs(args, cleanText(args.__userInput));
    else if (name === "save_personal_item") result = personalCaptureFromArgs(args, cleanText(args.__userInput));
    else {
      const handler = TOOL_BOX.get(name);
      if (handler) {
        const runResult = await handler.run({ ...args, __userInput: cleanText(args.__userInput) }, {
          userInput: cleanText(args.__userInput),
          state,
          chatFn: extractorCtx?.chatFn
        });
        result = runResult;
        deferredDataCard = runResult.deferredDataCard;
      } else {
        logger.warn("executeTool", `Unknown tool: ${name}`);
        return { result: { type: "unknown", status: "failed", error: `Unknown tool ${name}` } };
      }
    }
  } catch (err) {
    logger.warn("executeTool", `Tool ${name} threw error`, { error: err?.message });
    result = { type: name, status: "no_data", error: err?.message ?? "Tool failed" };
  }
  logger.info("executeTool", `Tool ${name} result`, { result: dump(result, 500) });
  return { result, deferredDataCard };
}
function stateSummary(state) {
  const memories = Array.isArray(state.memories) ? state.memories : [];
  const commitmentsArr = Array.isArray(state.commitments) ? state.commitments : [];
  const recordsArr = Array.isArray(state.records) ? state.records : [];
  const confirmedMemories = memories.filter((item) => item && item.status === "confirmed" && item.useForSuggestions !== false).slice(0, 12).map((item) => `- ${item.kind}: ${String(item.text ?? "").replace(/[\n\r`]+/g, " ").trim()}`).join("\n") || "- none";
  const candidateMemories = memories.filter((item) => item && item.status === "candidate" && item.useForSuggestions !== false).slice(0, 8).map((item) => `- ${item.kind}: ${String(item.text ?? "").replace(/[\n\r`]+/g, " ").trim()}`).join("\n") || "- none";
  const commitments = commitmentsArr.filter((item) => item && item.status === "open").slice(0, 12).map((item) => `- ${String(item.title ?? "").replace(/[\n\r`]+/g, " ").trim()} (${(item.dueHint || "sin fecha").replace(/[\n\r`]+/g, " ").trim()})`).join("\n") || "- none";
  const recordTitles = recordsArr.slice(-8).map((item) => `- ${String(item.title ?? "").replace(/[\n\r`]+/g, " ").trim()}${item.value ? ` (${String(item.value).replace(/[\n\r`]+/g, " ").trim()})` : ""} ${item.notes ? `\u2014 ${String(item.notes).replace(/[\n\r`]+/g, " ").trim()}` : ""} [${item.kind}]`).join("\n") || "- nada guardado todav\xEDa";
  const recordKinds = Array.from(new Set(recordsArr.map((item) => item.kind))).slice(0, 12).join(", ") || "none";
  const collectionCount = new Set(recordsArr.map((item) => item.collection).filter(Boolean)).size;
  return [
    `User name: ${state.userName ?? "unknown"}`,
    "Confirmed memories:",
    confirmedMemories,
    "Candidate memories awaiting user confirmation; use cautiously for continuity, do not present as certain:",
    candidateMemories,
    "Open commitments:",
    commitments,
    `Saved record count: ${(Array.isArray(state.records) ? state.records : []).length}`,
    `Saved record kinds: ${recordKinds}`,
    "Cosas que guardaste (\xFAltimas 8):",
    recordTitles,
    `Saved collection count: ${collectionCount}`
  ].join("\n");
}
function systemPrompt2(nowIso, state, relevantMemories) {
  const prefs = state.voicePreference ?? { warmth: 7, directness: 6, humor: 3, detail: 5, proactivity: 3 };
  const warmthLabel = prefs.warmth >= 7 ? "muy c\xE1lido" : prefs.warmth >= 5 ? "c\xE1lido" : "neutral";
  const humorLabel = prefs.humor >= 5 ? "con humor" : prefs.humor >= 3 ? "con un toque de humor" : "serio";
  return [
    `Sos Koru. Sos el asistente personal de ${state.userName?.trim() || "mi amigo"}. No sos un chatbot gen\xE9rico. Sos alguien que lo conoce y se preocupa por ayudarle.`,
    ``,
    `Tu personalidad: ${warmthLabel}, ${humorLabel}, directo pero sin ser fr\xEDo. Proactividad ${prefs.proactivity}/10.`,
    `Sos curioso, honesto, discreto. Te gusta descubrir cosas nuevas de ${state.userName?.trim() || "mi amigo"} y recordarlas.`,
    ``,
    `Reglas de voz:`,
    `- PRINCIPIO #1 \u2014 UTILIDAD POR ENCIMA DE TODO: cada respuesta debe entregar valor concreto, no ruido.`,
    `- NO sobre-valides: no termines mensajes con preguntas obvias tipo "\xBFquer\xE9s que armemos algo?" o "\xBFalguna otra cosa?". Si el usuario necesita m\xE1s, va a pedirlo.`,
    `- NO exageres: no celebres con exceso ("\xA1qu\xE9 maravilloso!", "\xA1incre\xEDble!"). Reaccion\xE1 como un amigo real, no como un animador de TV.`,
    `- NO agregues "+1" forzado: solo suger\xED un siguiente paso si es genuinamente \xFAtil y se conecta con lo que el usuario acaba de pedir. Si no hay nada \xFAtil, no agregues nada.`,
    `- NO repitas la pregunta del usuario en tu respuesta. Si pregunt\xF3 el clima, dale el clima, no le digas "mir\xE1 lo que encontr\xE9 sobre el clima".`,
    `- Respond\xE9 como alguien que conoce al usuario, no como asistente gen\xE9rico.`,
    `- Mir\xE1 las memorias de ${state.userName?.trim() || "mi amigo"} antes de responder. Usalas para personalizar.`,
    `- Si el usuario est\xE1 mal, mostr\xE1 empat\xEDa real, no frases de tarjeta.`,
    `- El texto puede ser de 1 l\xEDnea si es simple, o un p\xE1rrafo corto si es emocional. No te cort\xE9s.`,
    `- Las cards (uiBlocks) son para los datos; el texto es para conectar con ${state.userName?.trim() || "mi amigo"}.`,
    `- Cuando guard\xE1s algo, confirm\xE1 brevemente qu\xE9 guardaste y d\xF3nde. Una frase, no dos.`,
    `- Nunca inventes datos que no tengas. Si ejecutaste web_search, us\xE1 los snippets y contenidos proporcionados para dar un resumen honesto de lo que dicen las fuentes. No inventes detalles, pero S\xCD cont\xE1 lo que encontraste. Si no sab\xE9s, decilo con naturalidad.`,
    `- CR\xCDTICO: Si una tool externa (clima, b\xFAsqueda, ruta, precios) devuelve status "failed" o "not_configured", NO invent\xE9s los datos. Decile al usuario honestamente que no pudiste obtener esa informaci\xF3n.`,
    `- \u{1F534} CR\xCDTICO ANTI-ALUCINACI\xD3N DEPORTIVA: Si match_live devuelve status "no_data" o matches vac\xEDo, NO INVENTES RESULTADOS. NO digas "le ganaron 3-1 a Suiza" si la tool no devolvi\xF3 ese partido. Dec\xED honestamente: "No encontr\xE9 partidos recientes de [equipo]. La temporada puede estar en receso." Es PEOR inventar un resultado falso que admitir que no hay datos.`,
    `- \u{1F534} CR\xCDTICO ANTI-ALUCINACI\xD3N GENERAL: Si una tool devuelve status "no_data", "failed", o arrays vac\xEDos (matches:[], recipes:[], sources:[]), NO inventes datos para llenar el vac\xEDo. Dec\xED "no encontr\xE9" y ped\xED m\xE1s contexto si hace falta. Un usuario que recibe "no encontr\xE9" puede refinar su pregunta; un usuario que recibe datos inventados pierde la confianza para siempre.`,
    `- CR\xCDTICO: Si el usuario responde con una ciudad o ubicaci\xF3n directamente despu\xE9s de que preguntaste por clima o tr\xE1fico, interpretalo como su ubicaci\xF3n. Ejecut\xE1 la tool correspondiente con esa ciudad y guard\xE1 esa ciudad como memory de perfil.`,
    `- CR\xCDTICO: Si el usuario te dice una ciudad, pa\xEDs o barrio y no lo ten\xE9s guardado como memoria, incluilo en memoryCandidates como kind: profile.`,
    `- CR\xCDTICO: Si el usuario pregunta algo que YA aparece en "Cosas que guardaste" o "Memorias relevantes", NO uses query_personal_context. Respond\xE9 directamente desde ese contexto.`,
    `- CR\xCDTICO: Cuando guard\xE1s algo (save_personal_item) y el resultado tiene colecci\xF3n, tu reply empieza EXACTAMENTE con: "Listo, guardado en {colecci\xF3n}." y pod\xE9s agregar UNA frase corta despu\xE9s. El usuario debe saber SIEMPRE d\xF3nde qued\xF3 lo suyo.`,
    `- CR\xCDTICO: Cuando ejecutaste web_search, los datos concretos (resultados, precios, scores, cifras) ya vienen extra\xEDdos y validados en los tool results y se muestran al usuario en una tarjeta aparte. Tu texto SOLO debe ENMARCAR esos datos de forma cercana ("mir\xE1 lo que encontr\xE9", "esto es lo que dicen las fuentes"), NO repetirlos ni inventar valores que no est\xE9n en los resultados de la tool. Si un dato no est\xE1 en los tool results, no lo afirmes.`,
    `- \u{1F534} CR\xCDTICO \u2014 CONTINUIDAD DE CONVERSACI\xD3N (Bug "y ayer?"): Cuando el usuario hace una pregunta de seguimiento corta como "y ayer?", "y ma\xF1ana?", "y el otro?", "y el s\xE1bado?", "c\xF3mo le fue ayer?", deb\xE9s MANTENER EL CONTEXTO de la conversaci\xF3n reciente. Si en los \xFAltimos mensajes se habl\xF3 de un equipo/partido (ej: Argentina, Boca, Espa\xF1a), el seguimiento se refiere a ESE MISMO equipo. Ejecut\xE1 match_live con query "<equipo> ayer" o "<equipo> <fecha>" sin pedir aclaraci\xF3n. NO respondas "no entiendo" ni "\xBFa qu\xE9 te refer\xEDs?". El contexto SIEMPRE est\xE1 en el historial.`,
    `- \u{1F534} CR\xCDTICO \u2014 PRONOMBRES Y REFERENCIAS: Si el usuario dice "esa pel\xEDcula", "ese libro", "esa receta", "ese equipo", "esos resultados", asum\xED que se refiere al \xFAltimo tema mencionado en la conversaci\xF3n. NO pidas aclaraci\xF3n. Si el tema fue "obsesi\xF3n", "y esa pel\xEDcula?" significa "informaci\xF3n sobre la pel\xEDcula obsesi\xF3n". Mantener contexto es tu trabajo principal.`,
    `- \u{1F534} CR\xCDTICO \u2014 FOLLOW-UPS TEMPORALES: combin\xE1 el contexto del tema (equipo, pel\xEDcula, etc.) con el contexto temporal (ayer, hoy, ma\xF1ana, la semana pasada). "y ayer?" despu\xE9s de hablar de Argentina = match_live(query="Argentina ayer"). "y la anterior?" despu\xE9s de una pel\xEDcula = movie_info(title="<pel\xEDcula anterior>").`,
    ``,
    `Memorias relevantes para esta conversaci\xF3n (usalas para personalizar tu respuesta):`,
    ...relevantMemories.length ? relevantMemories.map((m) => `- [${m.kind}] ${m.text.replace(/[\n\r`]+/g, " ").trim()}`) : ["- No hay memorias relevantes a\xFAn."],
    ``,
    `Pendientes abiertos actuales del usuario:`,
    ...(Array.isArray(state.commitments) ? state.commitments : []).filter((c) => c && c.status === "open").slice(0, 5).map((c) => `- ${String(c.title ?? "").replace(/[\n\r`]+/g, " ").trim()} (${(c.dueHint || "sin fecha").replace(/[\n\r`]+/g, " ").trim()})`) || ["- Ninguno"],
    ``,
    `Cosas que guardaste (\xFAltimas 8):`,
    ...(Array.isArray(state.records) ? state.records : []).slice(-8).map((r) => `- ${String(r.title ?? "").replace(/[\n\r`]+/g, " ").trim()}${r.value ? ` (${String(r.value).replace(/[\n\r`]+/g, " ").trim()})` : ""}${r.notes ? ` \u2014 ${String(r.notes).replace(/[\n\r`]+/g, " ").trim()}` : ""} [${r.kind}]`) || ["- Nada guardado a\xFAn"],
    ``,
    `Instrucciones t\xE9cnicas:`,
    `Ejemplos de cu\xE1ndo usar cada herramienta (la forma de preguntar no importa; lo que importa es la intenci\xF3n):`,
    `  - weather: "\xBFQu\xE9 me pongo?" / "\xBFHace fr\xEDo?" / "\xBFLlevo paraguas?" / "\xBFC\xF3mo est\xE1 afuera?" / "\xBFQu\xE9 tal el d\xEDa?" / "\xBFNecesito campera?"`,
    `  - match_live: RESULTADOS DE F\xDATBOL. "\xBFC\xF3mo sali\xF3 Espa\xF1a ayer?" / "\xBFC\xF3mo le fue a Boca?" / "\xBFVa ganando el Madrid?" / "Resultado de Argentina" / "Qui\xE9n gan\xF3 el partido". INCLUYE selecciones nacionales (Espa\xF1a, Argentina, Francia, Brasil, etc). NUNCA uses web_search para esto \u2014 match_live tiene datos exactos desde ESPN en tiempo real.`,
    `  - match_schedule: PR\xD3XIMOS partidos. "Cu\xE1ndo juega Boca" / "A qu\xE9 hora juega Real Madrid" / "Fixture de la champions".`,
    `  - web_search: Noticias generales (NO deportivas). "\xBFQu\xE9 pas\xF3 en Argentina?" / "\xBF\xDAltimas noticias de tecnolog\xEDa?" / "\xBFQu\xE9 hay del clima pol\xEDtico?". NUNCA para resultados de partidos \u2014 para eso est\xE1 match_live.`,
    `  - shopping_compare: "\xBFQu\xE9 auriculares compro?" / "Necesito una bater\xEDa externa" / "\xBFD\xF3nde compro X m\xE1s barato?" / "\xBFCu\xE1l es mejor, A o B?"`,
    `  - restaurant_deep_search: "D\xF3nde cenar en Madrid" / "Qu\xE9 restaurante me recomend\xE1s" / "D\xF3nde como sushi" / "Necesito una parrilla" / "Qu\xE9 tal comer en Palermo"`,
    `  - recipe_find: "Receta de X" / "C\xF3mo hago X" / "Algo con Y" / "Postre sin horno" / "\xBFQu\xE9 cocino con...?". Devuelve ingredientes estructurados, pasos, imagen y video. NUNCA des una receta de memoria \u2014 us\xE1 la tool para traer recetas reales con foto.`,
    `  - movie_info: "\xBFQu\xE9 se dice de la pel\xEDcula X?" / "Rese\xF1a de X" / "Informaci\xF3n sobre la pel\xEDcula X" / "Qui\xE9n act\xFAa en X". Devuelve sinopsis, reparto, rating, g\xE9neros. NUNCA uses web_search para una pel\xEDcula espec\xEDfica \u2014 movie_info trae datos estructurados.`,
    `  - book_info: "Info del libro X" / "Qui\xE9n escribi\xF3 X" / "De qu\xE9 trata X". Devuelve cover, autor, a\xF1o, sinopsis.`,
    `  - wikipedia_lookup: "\xBFQu\xE9 es X?" / "Contame sobre X" / "Qui\xE9n fue X". Para temas enciclop\xE9dicos puntuales.`,
    `  - plan_day: "\xBFC\xF3mo organizo hoy?" / "Tengo muchas cosas" / "\xBFQu\xE9 hago primero?" / "\xBFMe ayudas a planificar?"`,
    `  - query_personal_context: "\xBFCu\xE1nto gast\xE9?" / "\xBFQu\xE9 ten\xEDa para comer?" / "\xBFRecord\xE1s que me dijiste?" / Cualquier cosa que Koru ya haya guardado del usuario.`,
    `  - save_memory: Cuando el usuario revela algo importante sobre s\xED mismo (rutinas, metas, preferencias, relaciones).`,
    `  - save_personal_item: Cuando el usuario pide guardar algo (gasto, recordatorio, lista de compras, alarma).`,
    `REGLA CR\xCDTICA DE ROUTING: si el usuario pregunta por un resultado o partido de f\xFAtbol (cualquier equipo o selecci\xF3n), US\xC1 match_live, NO web_search. web_search devuelve noticias gen\xE9ricas sin el marcador exacto; match_live te da el score real en tiempo real.`,
    `Us\xE1 tools SOLO cuando la intenci\xF3n del usuario REQUIERA datos reales del mundo (clima, b\xFAsqueda, ruta, precios, resultados deportivos, recetas, pel\xEDculas, libros). Por ejemplo: si el usuario dice 'hola', 'gracias', 'adi\xF3s', '\xBFc\xF3mo est\xE1s?' o cualquier frase de cortes\xEDa, NO uses tools. Respond\xE9 directamente con naturalidad.`,
    `- Para datos personales ya guardados, no llames tools; respond\xE9 directamente usando el contexto.`,
    `- \u{1F534} CR\xCDTICO \u2014 PROHIBIDO RAZONAMIENTO EN "reply": NUNCA incluyas tu razonamiento interno, an\xE1lisis de qu\xE9 tool llamar, ni texto en ingl\xE9s tipo "The user is asking...", "I should use...", "Let me think..." en "reply". El campo "reply" debe contener SOLO la respuesta final al usuario, en espa\xF1ol, c\xE1lido y directo. Si necesit\xE1s decidir una tool, EMITE tool_calls directamente en el JSON sin escribir tu razonamiento en el texto. Si est\xE1s pensando, NO escribas "thinking..." \u2014 simplemente devolv\xE9 el JSON final con la respuesta.`,
    `- \u{1F534} CR\xCDTICO \u2014 DIVISI\xD3N DE TRABAJO TEXTO \u2194 CARD: Cuando ejecutaste CUALQUIER tool que devuelve datos (weather, match_live, movie_info, recipe_find, book_info, crypto_price, web_search, wikipedia_lookup, etc.), los datos concretos (t\xEDtulos, ratings, reparto, ingredientes, pasos, scores, precios, sinopsis) ya est\xE1n estructurados y se muestran en la card. Tu reply SOLO debe ENMARCAR: 1-2 l\xEDneas c\xE1lidas que conecten con el usuario y eventualmente destaquen UN dato insignia. NUNCA repitas la lista de datos que ya est\xE1 en la card.`,
    `- Ejemplos de reply CORRECTO (corto, enmarca, NO repite datos de la card):`,
    `  \u2705 "Mir\xE1, la encontr\xE9. Te la dejo en la tarjeta con todo el detalle."`,
    `  \u2705 "Te dej\xE9 la receta en la tarjeta. Mir\xE1 el video al final, vale la pena."`,
    `  \u2705 "Espa\xF1a le gan\xF3 2-1. Te dej\xE9 las estad\xEDsticas en la tarjeta."`,
    `- Ejemplos de reply INCORRECTO (largo, repite datos que ya est\xE1n en la card):`,
    `  \u274C "Inception (2010). Director: Christopher Nolan. Reparto: Leonardo DiCaprio... Duraci\xF3n: 148 min. Rating: 8.8/10. Sinopsis: Dom Cobb..." (esto ya est\xE1 en la card)`,
    `- Agreg\xE1 mascotState al JSON final Elij\xED SOLO de esta lista exacta: "celebrating", "worried", "affectionate", "curious", "happy", "thinking", "working", "tired", "sleeping", "mistake", "planning", "product-search", "building", "cooking", "thinking-2". Si nada aplica, us\xE1 "idle".`,
    `- Formato de respuesta final (contrato M\xCDNIMO y OBLIGATORIO): {"reply":"...","mascotState":"..."}`,
    `  - reply: tu respuesta conversacional directa al usuario, respondiendo EXACTAMENTE a su \xFAltimo mensaje. Sin JSON anidado, sin c\xF3digo, sin listas t\xE9cnicas. Texto natural y c\xE1lido.`,
    `  - mascotState: eleg\xED de la lista exacta de arriba.`,
    `  - NO agregues uiBlocks ni ning\xFAn otro campo: las tarjetas visuales las arma el backend a partir de los resultados de las tools. Tu \xFAnico trabajo es el texto.`,
    `  - NUNCA inventes llamadas a funciones/tools dentro del texto ni campos tipo {"type":"function"}. Si no ten\xE9s una tool disponible para algo, respond\xE9 con honestidad en "reply".`,
    ``,
    `Ejemplos de respuestas EXCELSAS (few-shot):`,
    `Usuario: "hola" \u2192 {"reply":"Hola. \xBFC\xF3mo va todo?","mascotState":"happy"}`,
    `Usuario: "anota 1500 de cafe" \u2192 {"reply":"Listo, guardado en gastos.","mascotState":"idle"}`,
    `Usuario: "que clima hace en Madrid?" \u2192 {"reply":"Mir\xE1, te dej\xE9 el clima de Madrid en la tarjeta. D\xEDa para salir liviano.","mascotState":"thinking"}`,
    `Usuario: "gracias" \u2192 {"reply":"De nada, cuando quieras.","mascotState":"happy"}`,
    `Usuario: "estoy cansado" \u2192 {"reply":"Te entiendo. Si queres, bajo el ritmo y ordenamos lo minimo indispensable para hoy.","mascotState":"worried"}`,
    `Usuario: "como salio Espa\xF1a ayer" \u2192 TOOL: match_live(query="Espa\xF1a ayer"). Reply: "Espa\xF1a le gan\xF3 2-1. Te dej\xE9 el detalle en la tarjeta."`,
    `Usuario: "como le fue a Boca" \u2192 TOOL: match_live(query="Boca"). Reply con el score exacto que devuelva la tool.`,
    ``,
    `Not\xE1: las respuestas son CORTAS, DIRECTAS y UTILES. No exageran, no sobre-validan, no terminan con preguntas obvias.`,
    ``,
    `=== CONTEXTO TEMPORAL (CR\xCDTICO \u2014 siempre lo sab\xE9s) ===`,
    ...formatTemporalContext(nowIso),
    ``,
    `Reglas temporales CR\xCDTICAS:`,
    `- "Hoy" = ${formatDateLong(nowIso)}. "Ayer" = ${formatDateLong(new Date(Date.now() - 864e5).toISOString())}. "Ma\xF1ana" = ${formatDateLong(new Date(Date.now() + 864e5).toISOString())}.`,
    `- Cuando el usuario dice "hoy", "ayer", "ma\xF1ana", "esta semana", "este fin de semana", ya sab\xE9s a qu\xE9 fecha se refiere \u2014 NO preguntes "\xBFqu\xE9 d\xEDa?" ni "\xBFcu\xE1ndo?". Calcul\xE1 la fecha concreta.`,
    `- Si el usuario pregunta "como sali\xF3 X ayer", asum\xED que se refiere al partido/ evento de ${formatDateLong(new Date(Date.now() - 864e5).toISOString())}.`,
    `- Si pregunta "qu\xE9 hago hoy", sab\xE9s exactamente qu\xE9 d\xEDa es y qu\xE9 d\xEDa de la semana.`,
    `- NUNCA digas "no s\xE9 qu\xE9 d\xEDa es hoy" ni "no tengo acceso a la fecha". Siempre la sab\xE9s.`
  ].join("\n");
}
function formatDateLong(iso) {
  const d = new Date(iso);
  const dias = ["domingo", "lunes", "martes", "mi\xE9rcoles", "jueves", "viernes", "s\xE1bado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}
function formatTimeShort(iso) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function formatTemporalContext(nowIso) {
  const now = new Date(nowIso);
  const fecha = formatDateLong(nowIso);
  const hora = formatTimeShort(nowIso);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const diaSemana = ["domingo", "lunes", "martes", "mi\xE9rcoles", "jueves", "viernes", "s\xE1bado"][now.getDay()];
  const horaNum = now.getHours();
  let momentoDelDia;
  if (horaNum < 6) momentoDelDia = "madrugada";
  else if (horaNum < 12) momentoDelDia = "ma\xF1ana";
  else if (horaNum < 14) momentoDelDia = "mediod\xEDa";
  else if (horaNum < 19) momentoDelDia = "tarde";
  else if (horaNum < 22) momentoDelDia = "noche";
  else momentoDelDia = "noche tard\xEDa";
  const ayer = formatDateLong(new Date(now.getTime() - 864e5).toISOString());
  const manana = formatDateLong(new Date(now.getTime() + 864e5).toISOString());
  return [
    `- Fecha completa: ${fecha}`,
    `- D\xEDa de la semana: ${diaSemana}`,
    `- Hora actual: ${hora} (formato 24hs)`,
    `- Zona horaria: ${tz}`,
    `- Momento del d\xEDa: ${momentoDelDia}`,
    `- Ayer fue: ${ayer}`,
    `- Ma\xF1ana ser\xE1: ${manana}`,
    `- ISO timestamp: ${nowIso}`
  ];
}
function isTrivialInput(input) {
  const trimmed = input.trim().toLowerCase().replace(/[^a-záéíóúñ\s]/g, "");
  if (trimmed.length === 0) return true;
  if (trimmed.length < 3) return true;
  const trivial = [
    "hola",
    "buenos dias",
    "buen dia",
    "buenas",
    "buenas tardes",
    "buenas noches",
    "hey",
    "hi",
    "hello",
    "que tal",
    "como estas",
    "como va",
    "todo bien",
    "que onda",
    "che",
    "epa",
    "alo",
    "al\xF3",
    "buen",
    "epa",
    "adios",
    "adi\xF3s",
    "chau",
    "nos vemos",
    "hasta luego",
    "hasta pronto",
    "bye",
    "gracias",
    "muchas gracias",
    "mil gracias",
    "genial gracias",
    "ok gracias",
    "perfecto gracias",
    "ok",
    "vale",
    "si",
    "s\xED",
    "no",
    "bien",
    "todo bien",
    "genial",
    "perfecto",
    "listo"
  ];
  const hasPersonalReveal = /\b(me encanta|me gusta|me encantan|me gustan|amo|odio|prefiero|soy de|estoy trabajando|estoy aprendiendo|estoy leyendo|estoy escuchando|estoy viendo|estoy estudiando|estoy haciendo|estoy armando|estoy programando|estoy escribiendo|estoy cocinando|tengo que|mi madre|mi padre|mi mama|mi papa|mi hermano|mi hermana|mi hijo|mi hija|mi novio|mi novia|mi mujer|mi marido|mi esposa|mi esposo|mi amigo|mi amiga|juego al|juego a|practico|todos los dias|todas las semanas|cada semana|en una semana|en dos semanas|la semana que viene|el mes que viene|mañana cumplo|cumple años|mi cumple|aniversario)\b/i.test(input);
  if (hasPersonalReveal) return false;
  return trivial.some((t) => trimmed === t || trimmed.startsWith(t + " "));
}
function cityMemorySuggestion(toolCalls, state) {
  const weatherCall = toolCalls.find((call) => call.function.name === "weather");
  if (!weatherCall) return null;
  const city = cleanText(JSON.parse(weatherCall.function.arguments ?? "{}").city);
  if (!city) return null;
  const cityLower = city.toLowerCase();
  const alreadySaved = state.memories?.some((m) => m.kind === "profile" && m.text.toLowerCase().includes(cityLower));
  if (alreadySaved) return null;
  return {
    id: `save_city_${cityLower.replace(/\s+/g, "_")}`,
    label: `\xBFAgregar ${city} como mi ubicaci\xF3n?`,
    kind: "save",
    requiresApproval: false,
    payload: { enhancementType: "save_location", city }
  };
}
function buildMessages(request) {
  const relevantMemories = selectRelevantMemories(
    request.state.memories || [],
    request.input,
    5
  );
  const history = request.history.slice(-10).map((turn) => ({
    role: turn.role === "assistant" ? "assistant" : "user",
    content: turn.content
  }));
  return [
    { role: "system", content: systemPrompt2((/* @__PURE__ */ new Date()).toISOString(), request.state, relevantMemories) },
    ...history,
    { role: "user", content: request.input }
  ];
}
function toolObservationSummary(toolExecutions) {
  return JSON.stringify(toolExecutions.map((execution) => ({
    id: execution.id,
    tool: execution.name,
    result: execution.result
  })), null, 2);
}
function buildMemoryExtractorMessages(request, toolExecutions, composedRaw) {
  return [
    {
      role: "system",
      content: [
        "You are Koru's asynchronous memory extractor. Return ONLY valid JSON, no markdown.",
        'Schema: {"memoryCandidates":[],"commitments":[],"records":[],"behaviorNotes":[]}',
        "Extract only durable, reusable user-owned context from the current user turn and tool observations.",
        "If the user says 'prefiero...', 'soy de...', 'mi mama...', 'avisame si...', 'todos los dias...', or equivalent meaning, extract it as memory. Do not skip just because another tool was used.",
        "Capture preferences, identity, routines, goals, relationships, medication/health facts, important dates, interests to follow, folders/collections, saved links, inventory, expenses, tasks and decisions.",
        "Do not answer the user. Do not infer from generic chit-chat. Do not duplicate records already present in tool observations.",
        "Use Spanish wording when the user spoke Spanish. Preserve names and dates.",
        "Never inherit collection, person, tags, or domain from previous turns unless the current user explicitly refers to the same object.",
        "Capture behavior notes: if the user corrects Koru's behavior (e.g. 'do not ask me for summaries when I save links', 'I prefer you to be more direct'), extract it as behaviorNote so future turns are governed by it.",
        `If the user provides a city, country, or neighborhood name (e.g. 'Madrid', 'Buenos Aires', 'Barcelona') especially after a weather or traffic question, extract it as a location/profile memory. Example: user input 'Madrid' after assistant asked "what city?" -> memory: {kind: 'profile', text: 'User location: Madrid (city)'}. Do not skip just because it looks like a tool argument.`
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "Context:",
        stateSummary(request.state),
        "",
        `Current user input: ${request.input}`,
        "",
        composedRaw ? `Respuesta final que Koru envi\xF3 al usuario: "${cleanText(composedRaw.reply)}"` : "",
        composedRaw && composedRaw.understanding ? `Entendimiento del Composer: ${JSON.stringify(composedRaw.understanding)}` : "",
        "",
        "Tool observations:",
        toolObservationSummary(toolExecutions)
      ].filter(Boolean).join("\n")
    }
  ];
}
async function extractMemoryWithJsonPrompt(request, config2, toolExecutions, composedRaw, extractorTimeout) {
  const pp = inferProviderFromModel(request.model);
  const result = await callProvider(config2, buildMemoryExtractorMessages(request, toolExecutions, composedRaw), extractorTimeout, false, pp);
  const content = cleanText(result.message.content);
  const raw = safeJsonObjectFromContent(content);
  return {
    raw,
    provider: result.provider,
    model: result.model,
    fallbackReason: result.fallbackReason
  };
}
function toolCallArgs(call) {
  return safeJsonParse(call.function.arguments);
}
function normalizeUnderstanding(raw, input) {
  const value = asRecord(raw);
  return {
    literalRequest: cleanText(value.literalRequest, input),
    userGoal: cleanText(value.userGoal, "Resolver el pedido con el menor esfuerzo posible."),
    unstatedNeeds: asArray(value.unstatedNeeds).map((item) => cleanText(item)).filter(Boolean),
    assumptions: asArray(value.assumptions).map((item) => cleanText(item)).filter(Boolean),
    confidence: typeof value.confidence === "number" ? Math.max(0, Math.min(1, value.confidence)) : 0.65
  };
}
function normalizeSources(value) {
  return asArray(value).map(asRecord).map((item) => {
    const title = cleanText(item.title);
    const url = cleanText(item.url);
    if (!title || !url) return null;
    return sourceFromUrl(title, url, cleanText(item.snippet));
  }).filter((item) => Boolean(item)).slice(0, 8);
}
function normalizeUiBlock(value) {
  const block = asRecord(value);
  const type = cleanText(block.type);
  if (type === "reminder") {
    const title = cleanText(block.title);
    return title ? {
      type: "reminder",
      title,
      dueText: cleanText(block.dueText ?? block.due_text),
      note: cleanText(block.note)
    } : null;
  }
  if (type === "alarm") {
    const title = cleanText(block.title, "Alarma");
    const time = cleanText(block.time);
    return time ? {
      type: "alarm",
      title,
      time,
      repeat: cleanText(block.repeat),
      note: cleanText(block.note)
    } : null;
  }
  if (type === "shopping_list") {
    const items = asArray(block.items).map((item) => cleanText(item)).filter(Boolean).slice(0, 20);
    return items.length ? {
      type: "shopping_list",
      title: cleanText(block.title, "Lista de compras"),
      items,
      dueText: cleanText(block.dueText ?? block.due_text),
      note: cleanText(block.note)
    } : null;
  }
  if (type === "saved_record") {
    const records = normalizeRecords(block.records);
    return records.length ? {
      type: "saved_record",
      title: cleanText(block.title, "Guardado"),
      records
    } : null;
  }
  if (type === "money_summary") {
    return {
      type: "money_summary",
      title: cleanText(block.title, "Dinero"),
      total: typeof block.total === "number" ? block.total : void 0,
      currency: cleanText(block.currency),
      summaryItems: asArray(block.summaryItems ?? block.summary_items).map(asRecord).map((item) => ({
        label: cleanText(item.label, "Dato"),
        value: cleanText(item.value),
        detail: cleanText(item.detail)
      })).filter((item) => item.value).slice(0, 6),
      recommendation: cleanText(block.recommendation)
    };
  }
  if (type === "weather") {
    return {
      type: "weather",
      title: cleanText(block.title, "Clima"),
      city: cleanText(block.city),
      now: cleanText(block.now),
      range: cleanText(block.range),
      rain: cleanText(block.rain),
      wind: cleanText(block.wind),
      advice: cleanText(block.advice),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus)) ? cleanText(block.sourceStatus) : void 0,
      sources: normalizeSources(block.sources)
    };
  }
  if (type === "plan") {
    const items = asArray(block.items).map(asRecord).map((item) => ({
      time: cleanText(item.time),
      title: cleanText(item.title, "Paso"),
      priority: ["Alta", "Media", "Baja"].includes(cleanText(item.priority)) ? cleanText(item.priority) : void 0,
      durationMinutes: typeof item.durationMinutes === "number" ? item.durationMinutes : void 0,
      mode: ["focus", "quick", "admin", "recovery"].includes(cleanText(item.mode)) ? cleanText(item.mode) : void 0,
      rationale: cleanText(item.rationale)
    })).slice(0, 6);
    return items.length ? { type: "plan", title: cleanText(block.title, "Plan"), items, note: cleanText(block.note) } : null;
  }
  if (type === "comparison") {
    const items = asArray(block.items).map(asRecord).map((item) => ({
      title: cleanText(item.title, "Opcion"),
      price: cleanText(item.price),
      vendor: cleanText(item.vendor),
      url: cleanText(item.url),
      evidence: cleanText(item.evidence),
      score: typeof item.score === "number" ? item.score : void 0
    })).slice(0, 6);
    return items.length ? {
      type: "comparison",
      title: cleanText(block.title, "Comparativa"),
      items,
      criteria: asArray(block.criteria).map((item) => cleanText(item)).filter(Boolean),
      recommendation: cleanText(block.recommendation),
      sources: normalizeSources(block.sources)
    } : null;
  }
  if (type === "research_sources") {
    return {
      type: "research_sources",
      title: cleanText(block.title, "Fuentes"),
      summary: cleanText(block.summary, "Fuentes revisadas."),
      mode: ["news", "shopping", "research", "weather", "traffic", "market", "world"].includes(cleanText(block.mode)) ? cleanText(block.mode) : "research",
      sources: normalizeSources(block.sources),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus)) ? cleanText(block.sourceStatus) : void 0,
      followUpQuestion: cleanText(block.followUpQuestion)
    };
  }
  if (type === "clarifying_question") {
    return {
      type: "clarifying_question",
      title: cleanText(block.title, "Necesito un dato"),
      question: cleanText(block.question, "Que dato falta?"),
      expectedSlot: cleanText(block.expectedSlot),
      options: asArray(block.options).map((item) => cleanText(item)).filter(Boolean).slice(0, 3)
    };
  }
  if (type === "proactive_signal") {
    const category = cleanText(block.category);
    const severity = cleanText(block.severity);
    const title = cleanText(block.title);
    const body = cleanText(block.body);
    return title && body ? {
      type: "proactive_signal",
      category: ["world", "news", "market", "weather", "traffic", "health", "relationship", "home", "package", "sports", "general"].includes(category) ? category : "general",
      severity: ["info", "useful", "important", "urgent"].includes(severity) ? severity : "useful",
      title,
      body,
      timestampLabel: cleanText(block.timestampLabel ?? block.timestamp_label),
      sourceStatus: ["not_configured", "pending", "verified", "partial", "failed"].includes(cleanText(block.sourceStatus)) ? cleanText(block.sourceStatus) : void 0,
      actionLabel: cleanText(block.actionLabel ?? block.action_label),
      followUpQuestion: cleanText(block.followUpQuestion ?? block.follow_up_question),
      sources: normalizeSources(block.sources),
      summaryItems: asArray(block.summaryItems ?? block.summary_items).map(asRecord).map((item) => ({
        label: cleanText(item.label, "Dato"),
        value: cleanText(item.value),
        detail: cleanText(item.detail)
      })).filter((item) => item.value).slice(0, 4)
    } : null;
  }
  if (type === "web_nav") {
    const results = asArray(block.results).map(asRecord).map((item) => ({
      title: cleanText(item.title, "Resultado"),
      source: cleanText(item.source, "Web"),
      url: cleanText(item.url),
      type: ["article", "pdf", "description", "page"].includes(cleanText(item.type)) ? cleanText(item.type) : "page",
      readTime: cleanText(item.readTime ?? item.read_time)
    })).filter((item) => item.title && item.url).slice(0, 6);
    return results.length ? {
      type: "web_nav",
      title: cleanText(block.title, "Web Navigation"),
      status: cleanText(block.status) === "loading" ? "loading" : cleanText(block.status) === "report" ? "report" : "complete",
      query: cleanText(block.query),
      url: cleanText(block.url),
      results
    } : null;
  }
  return null;
}
function blocksFromToolResults(results) {
  const blocks = [];
  for (const execution of results) {
    const result = execution.result;
    if (result.type === "weather") {
      const weather = result;
      if (weather.status === "need_city" || !cleanText(weather.city)) continue;
      blocks.push({
        type: "weather",
        title: "Clima",
        city: weather.city,
        now: weather.now,
        range: weather.range,
        rain: weather.rain,
        wind: weather.wind,
        advice: weather.advice,
        sourceStatus: weather.sources.length ? "verified" : "failed",
        sources: weather.sources
      });
      continue;
    }
    if (result.type === "restaurant_deep_search") {
      const search = result;
      blocks.push({
        type: "restaurant_synthesis",
        title: search.query || "Restaurantes encontrados",
        status: search.status === "ok" ? "ok" : search.status === "failed" ? "failed" : "partial",
        matches: search.matches || [],
        topScore: search.topScore,
        pros: search.pros,
        cons: search.cons,
        synthesis: search.synthesis,
        sources: search.sources || []
      });
      continue;
    }
    if (result.type === "crypto_price") {
      const r = result;
      blocks.push({
        type: "crypto_portfolio",
        items: [{
          symbol: r.symbol || " BTC",
          name: r.coin || "Bitcoin",
          price: `${r.price || "?"} ${r.currency || "USD"}`,
          change: r.change24hPct ?? 0,
          color: "text-orange-500",
          bg: "bg-orange-50"
        }]
      });
      continue;
    }
    if (result.type === "stock_quote") {
      const r = result;
      blocks.push({
        type: "market",
        title: `${r.symbol}`,
        assets: [{
          symbol: String(r.symbol ?? "STOCK"),
          name: String(r.name ?? r.symbol ?? "Accion"),
          price: r.close != null ? String(r.close) : "?",
          change: r.change24hPct != null ? `${r.change24hPct >= 0 ? "up" : "down"} ${Math.abs(r.change24hPct)}%` : "-",
          changeUp: Number(r.change24hPct ?? 0) >= 0
        }]
      });
      continue;
    }
    if (result.type === "currency_convert") {
      const r = result;
      blocks.push({
        type: "forex",
        items: [{
          pair: `${r.from}/${r.to}`,
          rate: String(r.rate),
          change: 0,
          flag: "US",
          positive: true
        }]
      });
      continue;
    }
    if (result.type === "match_schedule") {
      const r = result;
      const matches = r.matches || [];
      blocks.push({
        type: "match_timeline",
        items: matches.slice(0, 5).map((m) => ({
          minute: m.date ? new Date(m.date).getDate() + "'" : "\u2014",
          text: `${r.team || "Equipo"} vs ${m.opponent || "Rival"}`,
          sub: `${m.competition || ""} \xB7 ${m.venue || ""}`,
          active: true
        }))
      });
      continue;
    }
    if (result.type === "match_live") {
      const r = result;
      if (r.status === "no_data" || r.status === "failed") {
        result.__forceHonestReply = true;
        result.__honestReplyText = r.note || r.error || `No encontr\xE9 partidos recientes para "${r.query ?? ""}". La temporada puede estar en receso.`;
        continue;
      }
      const matches = Array.isArray(r.matches) ? r.matches : [];
      if (matches.length === 0 && (r.homeName || r.homeTeam)) {
        matches.push({
          homeTeam: typeof r.homeTeam === "string" ? r.homeTeam : r.homeTeam?.name,
          awayTeam: typeof r.awayTeam === "string" ? r.awayTeam : r.awayTeam?.name,
          homeScore: r.homeScore ?? r.homeTeam?.score,
          awayScore: r.awayScore ?? r.awayTeam?.score,
          status: r.status,
          date: r.date,
          live: r.live
        });
      }
      if (matches.length >= 1) {
        const m = matches[0];
        const homeName = String(m.homeTeam ?? "Local");
        const awayName = String(m.awayTeam ?? "Visitante");
        const homeScore = Number(m.homeScore ?? 0);
        const awayScore = Number(m.awayScore ?? 0);
        const status = String(m.status ?? (m.live ? "En vivo" : "Final"));
        const homeInitials = initialsFromName(homeName);
        const awayInitials = initialsFromName(awayName);
        const dateStr = m.date ? formatMatchDate(m.date) : "";
        blocks.push({
          type: "live_match",
          homeName,
          awayName,
          homeScore,
          awayScore,
          homeInitials,
          awayInitials,
          minute: m.minute ?? m.time,
          globalAgg: status + (dateStr ? ` \xB7 ${dateStr}` : ""),
          homePossession: m.homePossession,
          awayPossession: m.awayPossession,
          homeShots: m.homeShots,
          awayShots: m.awayShots,
          time: m.minute ?? m.time,
          status,
          homeTeam: { name: homeName, abbrev: homeInitials, score: homeScore },
          awayTeam: { name: awayName, abbrev: awayInitials, score: awayScore },
          stats: [
            { label: "Posesion", leftPercent: Number.parseInt(m.homePossession ?? "50", 10) || 50, rightPercent: Number.parseInt(m.awayPossession ?? "50", 10) || 50 },
            { label: "Tiros", leftPercent: Number(m.homeShots ?? 0), rightPercent: Number(m.awayShots ?? 0) }
          ]
        });
        if (matches.length > 1) {
          blocks.push({
            type: "match_timeline",
            items: matches.slice(1, 5).map((mm) => ({
              minute: mm.date ? new Date(mm.date).getDate() + "'" : "\u2014",
              text: `${mm.homeTeam ?? "?"} ${mm.homeScore ?? "?"} - ${mm.awayScore ?? "?"} ${mm.awayTeam ?? "?"}`,
              sub: mm.status ?? (mm.live ? "En vivo" : "Final"),
              active: !!mm.live
            }))
          });
        }
      }
      continue;
    }
    if (result.type === "route_traffic") {
      const r = result;
      if (r.items && r.items.length > 0) {
        blocks.push({
          type: "route_timeline",
          eta: r.eta,
          items: r.items
        });
      }
      if (r.alternatives && r.alternatives.length > 0) {
        blocks.push({
          type: "transport_compare",
          items: r.alternatives
        });
      }
      if (r.from && r.to) {
        blocks.push({
          type: "route_map",
          from: r.from,
          to: r.to,
          progress: r.progress ?? 75,
          distance: r.distance,
          remaining: r.remaining
        });
      }
      continue;
    }
    if (result.type === "search") {
      const search = result;
      const sources = (search.sources ?? []).filter((s) => s.url?.startsWith("http")).slice(0, 6);
      if (search.mode === "shopping" && search.comparisonItems?.length) {
        blocks.push({
          type: "comparison",
          title: search.title,
          items: search.comparisonItems,
          recommendation: search.summary,
          sources: search.sources
        });
        continue;
      }
      const sections = [];
      const rawSummary = cleanText(search.summary);
      const looksLikeSnippets = rawSummary.length > 100 && (rawSummary.includes(". ") && rawSummary.split(". ").length > 4 && !/[¡!]/.test(rawSummary.slice(0, 20)));
      const synthesisText = !looksLikeSnippets && rawSummary || `Encontr\xE9 ${sources.length} fuentes sobre "${cleanText(search.title) || "este tema"}". ${sources.slice(0, 2).map((s) => s.title).filter(Boolean).join(" y ")}.` || "";
      if (synthesisText) {
        sections.push({
          icon: "auto_awesome",
          title: "S\xEDntesis",
          kicker: "LO ESENCIAL",
          kind: "text",
          paragraphs: [synthesisText.slice(0, 800)]
        });
      }
      if (search.extractedData && search.extractedData.items.length > 0) {
        sections.push({
          icon: "fact_check",
          title: "Datos verificados",
          kicker: "ENCONTRADOS",
          kind: "rows",
          items: search.extractedData.items.map((item) => ({
            title: item.label,
            subtitle: item.value,
            badge: item.sourceDomain
          }))
        });
      }
      if (sources.length > 0) {
        sections.push({
          icon: "fact_check",
          title: "Fuentes",
          kicker: "DE D\xD3NDE SALI\xD3",
          kind: "rows",
          items: sources.map((s) => ({
            title: s.title,
            subtitle: s.snippet?.slice(0, 120) || s.domain,
            badge: s.domain
          }))
        });
      }
      const query = cleanText(search.title) || "Resultado";
      const metrics = [];
      metrics.push({ value: String(sources.length), label: "Fuentes" });
      if (search.extractedData?.items.length) {
        metrics.push({ value: String(search.extractedData.items.length), label: "Datos" });
      }
      metrics.push({ value: String(sections.length), label: "Secciones" });
      blocks.push({
        type: "deliverable",
        status: "ready",
        kicker: "Tu B\xFAsqueda",
        topic: query,
        title: query.toUpperCase().slice(0, 40),
        description: synthesisText.slice(0, 160) || `Resultados sobre ${query}`,
        summary: synthesisText.slice(0, 500),
        categories: [
          { icon: "travel_explore", label: "B\xFAsqueda" },
          { icon: "fact_check", label: "Fuentes" },
          { icon: "insights", label: "Datos" }
        ],
        metrics,
        sections,
        sources
      });
      continue;
    }
    if (result.type === "plan") {
      const plan = result;
      blocks.push({
        type: "plan",
        title: plan.title,
        items: plan.items,
        note: plan.context.length ? `Use contexto: ${plan.context.slice(0, 2).join(" / ")}` : void 0
      });
      continue;
    }
    if (result.type === "personal_capture") {
      const capture = result;
      blocks.push(capture.block);
      continue;
    }
    if (result.type === "personal_query") {
      const query = result;
      blocks.push(query.block);
      continue;
    }
    if (result.type === "local_action") {
      const action = result;
      blocks.push(action.block);
      continue;
    }
    if (result.type === "crypto_price") {
      const crypto2 = result;
      const items = [];
      const price = typeof crypto2.price === "number" ? crypto2.price : void 0;
      const currency = String(crypto2.currency ?? "USD");
      if (price !== void 0) {
        items.push({ label: "Precio", value: new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price) });
      }
      if (typeof crypto2.marketCap === "number") {
        items.push({ label: "Market Cap", value: formatCompactNumber(crypto2.marketCap, currency) });
      }
      if (typeof crypto2.change24hPct === "number") {
        const sign = crypto2.change24hPct >= 0 ? "+" : "";
        items.push({ label: "24h", value: `${sign}${crypto2.change24hPct}%`, detail: crypto2.change24hPct >= 0 ? "\u25B2" : "\u25BC" });
      }
      if (typeof crypto2.change7dPct === "number") {
        const sign = crypto2.change7dPct >= 0 ? "+" : "";
        items.push({ label: "7d", value: `${sign}${crypto2.change7dPct}%`, detail: crypto2.change7dPct >= 0 ? "\u25B2" : "\u25BC" });
      }
      if (items.length) {
        blocks.push({
          type: "data_card",
          title: `${String(crypto2.coin ?? crypto2.symbol ?? "Crypto")} \xB7 ${currency}`,
          items
        });
      }
      continue;
    }
    if (result.type === "stock_quote") {
      const stock = result;
      const items = [];
      if (typeof stock.close === "number") {
        items.push({ label: "Cierre", value: String(stock.close), detail: String(stock.symbol ?? "") });
      }
      if (typeof stock.open === "number") {
        items.push({ label: "Apertura", value: String(stock.open) });
      }
      if (typeof stock.high === "number") {
        items.push({ label: "M\xE1x", value: String(stock.high) });
      }
      if (typeof stock.low === "number") {
        items.push({ label: "M\xEDn", value: String(stock.low) });
      }
      if (typeof stock.volume === "number") {
        items.push({ label: "Volumen", value: formatCompactNumber(stock.volume, "USD") });
      }
      if (items.length) {
        blocks.push({
          type: "data_card",
          title: `${String(stock.symbol ?? "Acci\xF3n")} \xB7 ${String(stock.date ?? "")}`,
          items
        });
      }
      continue;
    }
    if (result.type === "exchange_history") {
      const fx = result;
      const items = [];
      if (typeof fx.lastRate === "number") {
        items.push({ label: "\xDAltimo", value: String(fx.lastRate), detail: `${String(fx.from ?? "")}\u2192${String(fx.to ?? "")}` });
      }
      if (typeof fx.firstRate === "number") {
        items.push({ label: "Inicio", value: String(fx.firstRate) });
      }
      if (typeof fx.minRate === "number") {
        items.push({ label: "M\xEDn", value: String(fx.minRate) });
      }
      if (typeof fx.maxRate === "number") {
        items.push({ label: "M\xE1x", value: String(fx.maxRate) });
      }
      if (typeof fx.changePct === "number") {
        const sign = fx.changePct >= 0 ? "+" : "";
        items.push({ label: "Cambio", value: `${sign}${fx.changePct}%`, detail: fx.changePct >= 0 ? "\u25B2" : "\u25BC" });
      }
      if (typeof fx.samples === "number") {
        items.push({ label: "D\xEDas", value: String(fx.samples) });
      }
      if (items.length) {
        blocks.push({
          type: "data_card",
          title: `${String(fx.from ?? "")}/${String(fx.to ?? "")} \xB7 ${String(fx.startDate ?? "")} a ${String(fx.endDate ?? "")}`,
          items
        });
      }
      continue;
    }
    if (result.type === "election_data" || result.type === "election_results") {
      const r = result;
      blocks.push({
        type: "election_results",
        title: r.title,
        status: r.status,
        items: r.items || []
      });
      continue;
    }
    if (result.type === "election_vote") {
      const r = result;
      blocks.push({
        type: "election_vote",
        question: r.question,
        subtitle: r.subtitle,
        options: r.options || []
      });
      continue;
    }
    if (result.type === "data_ticker") {
      const r = result;
      blocks.push({
        type: "data_ticker",
        items: r.items || [],
        alert: r.alert
      });
      continue;
    }
    if (result.type === "product_analysis") {
      const r = result;
      blocks.push({
        type: "product_analysis",
        product: {
          name: r.title ?? r.product?.name,
          icon: r.icon ?? r.product?.icon,
          description: r.subtitle ?? r.product?.description
        },
        specs: r.specs || []
      });
      continue;
    }
    if (result.type === "smart_checklist") {
      const r = result;
      blocks.push({
        type: "smart_checklist",
        title: r.title,
        progress: r.progress,
        items: r.items || []
      });
      continue;
    }
    if (result.type === "outfit") {
      const r = result;
      blocks.push({
        type: "outfit",
        specs: r.specs || [],
        buttonLabel: r.buttonLabel
      });
      continue;
    }
    if (result.type === "review_score") {
      const r = result;
      blocks.push({
        type: "review_score",
        items: r.items || [],
        buttonLabel: r.buttonLabel
      });
      continue;
    }
    if (result.type === "review_document") {
      const r = result;
      blocks.push({
        type: "review_document",
        title: r.title,
        body: r.body
      });
      continue;
    }
    if (result.type === "review_quote") {
      const r = result;
      blocks.push({
        type: "review_quote",
        sourceName: r.sourceName,
        sourceType: r.sourceType,
        quote: r.quote,
        tags: r.tags || [],
        buttonLabel: r.buttonLabel
      });
      continue;
    }
    if (result.type === "birthday_calendar") {
      const r = result;
      blocks.push({
        type: "birthday_calendar",
        month: r.month,
        highlightedDay: r.highlightedDay,
        startDay: r.startDay,
        daysInMonth: r.daysInMonth
      });
      continue;
    }
    if (result.type === "birthday_alarm") {
      const r = result;
      blocks.push({
        type: "birthday_alarm",
        name: r.name,
        date: r.date,
        countdown: r.countdown,
        unit: r.unit,
        eta: r.eta
      });
      continue;
    }
    if (result.type === "social_interaction") {
      const r = result;
      blocks.push({
        type: "social_interaction",
        name: r.name,
        event: r.event,
        date: r.date,
        remaining: r.remaining,
        gifts: Array.isArray(r.gifts) ? r.gifts.map((gift) => typeof gift === "string" ? { emoji: "gift", title: gift, detail: r.event ?? "" } : gift) : []
      });
      continue;
    }
    if (result.type === "transport_compare") {
      const r = result;
      blocks.push({
        type: "transport_compare",
        items: r.items || []
      });
      continue;
    }
    if (result.type === "route_map") {
      const r = result;
      blocks.push({
        type: "route_map",
        progress: r.progress,
        from: r.from,
        to: r.to,
        distance: r.distance,
        remaining: r.remaining
      });
      continue;
    }
    if (result.type === "movie_info") {
      const r = result;
      if (r.status === "failed" || r.status === "no_data") {
        result.__movieInfoFailed = true;
        continue;
      }
      const title = r.title ?? "Pel\xEDcula";
      const poster = r.poster ?? r.thumbnail;
      const rating = typeof r.rating === "number" ? r.rating : void 0;
      const overview = r.text ?? r.summary ?? r.synopsis ?? r.overview ?? "";
      blocks.push({
        type: "movie_review",
        title,
        poster,
        rating,
        releaseDate: r.releaseDate,
        runtime: r.runtime,
        director: r.director,
        cast: Array.isArray(r.cast) ? r.cast : void 0,
        genres: Array.isArray(r.genres) ? r.genres : void 0,
        overview: overview.slice(0, 800),
        sources: Array.isArray(r.sources) ? r.sources : void 0
      });
      continue;
    }
    if (result.type === "recipe_find") {
      const r = result;
      const recipes = Array.isArray(r.recipes) ? r.recipes : [];
      if (recipes.length === 0) continue;
      const first = recipes[0];
      const instructions = String(first.instructions ?? "");
      const steps = instructions.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && /^(STEP\s*\d+|PASO\s*\d+|\d+[).])/.test(s.toUpperCase())).map((text, i) => ({ step: i + 1, text: text.replace(/^(STEP\s*\d+|PASO\s*\d+|\d+[).])\s*/i, "") }));
      blocks.push({
        type: "recipe",
        name: first.name ?? "Receta",
        title: first.name ?? "Receta",
        image: first.thumbnail,
        category: first.category,
        area: first.area,
        description: instructions.slice(0, 200),
        instructions: instructions.slice(0, 1500),
        videoUrl: first.videoUrl,
        ingredients: Array.isArray(first.ingredients) ? first.ingredients : void 0,
        steps: steps.length > 0 ? steps : void 0,
        source: { title: "TheMealDB", url: "https://www.themealdb.com/", domain: "themealdb.com" }
      });
      if (recipes.length > 1) {
        blocks.push({
          type: "comparison",
          title: "Otras recetas",
          items: recipes.slice(1, 5).map((rec) => ({
            title: rec.name ?? "Receta",
            subtitle: [rec.category, rec.area].filter(Boolean).join(" \xB7 "),
            image: rec.thumbnail
          }))
        });
      }
      continue;
    }
    if (result.type === "book_info") {
      const r = result;
      const title = r.title ?? "Libro";
      const cover = r.coverUrl ?? r.cover ?? r.thumbnail;
      const synopsis = r.text ?? r.summary ?? r.synopsis ?? r.description ?? "";
      blocks.push({
        type: "book_review",
        title,
        cover,
        author: r.author,
        year: r.year ?? r.firstPublished,
        pages: r.pages ?? r.number_of_pages_median,
        publisher: r.publisher,
        genre: r.genre,
        rating: typeof r.rating === "number" ? r.rating : void 0,
        synopsis: synopsis.slice(0, 800),
        isbn: r.isbn,
        sources: Array.isArray(r.sources) ? r.sources : void 0
      });
      continue;
    }
    if (result.type === "wikipedia_lookup" || result.type === "person_info") {
      const r = result;
      const title = r.title ?? r.query ?? "Informaci\xF3n";
      const text = r.text ?? r.extract ?? r.summary ?? "";
      if (!text) continue;
      const sources = Array.isArray(r.sources) ? r.sources : [];
      blocks.push({
        type: "research_sources",
        title,
        summary: text.slice(0, 1200),
        sources: sources.map((s) => ({
          title: s.title ?? title,
          url: s.url ?? "",
          domain: s.domain ?? "wikipedia.org",
          snippet: s.snippet ?? ""
        }))
      });
      continue;
    }
    if (result.type === "food_info") {
      const r = result;
      const specs = [];
      if (r.nutriscore) specs.push({ label: "Nutri-Score", value: String(r.nutriscore).toUpperCase() });
      if (r.calories) specs.push({ label: "Calor\xEDas", value: `${r.calories} kcal/100g` });
      if (r.fat) specs.push({ label: "Grasas", value: `${r.fat} g/100g` });
      if (r.carbs) specs.push({ label: "Carbohidratos", value: `${r.carbs} g/100g` });
      if (r.proteins) specs.push({ label: "Prote\xEDnas", value: `${r.proteins} g/100g` });
      if (r.ingredients && Array.isArray(r.ingredients)) {
        specs.push({ label: "Ingredientes", value: r.ingredients.slice(0, 5).join(", ") });
      }
      blocks.push({
        type: "product_analysis",
        product: {
          name: r.productName ?? r.title ?? "Producto",
          image: r.imageUrl ?? r.thumbnail,
          description: r.summary ?? ""
        },
        specs
      });
      continue;
    }
    if (result.type === "reminder_set") {
      const r = result;
      if (r.block) {
        blocks.push(r.block);
      } else {
        blocks.push({
          type: "saved_record",
          title: "Recordatorio guardado",
          records: [{
            kind: "deadline",
            domain: "capture",
            title: r.title ?? "Recordatorio",
            value: r.title ?? "Recordatorio",
            dueHint: r.dueText ?? "",
            notes: r.note ?? ""
          }]
        });
      }
      continue;
    }
    if (result.type === "alarm_set") {
      const r = result;
      if (r.block) {
        blocks.push(r.block);
      } else {
        blocks.push({
          type: "saved_record",
          title: "Alarma guardada",
          records: [{
            kind: "deadline",
            domain: "capture",
            title: r.title ?? "Alarma",
            value: r.title ?? "Alarma",
            dueHint: r.time ?? "",
            notes: [r.repeat, r.note].filter(Boolean).join(" \xB7 ")
          }]
        });
      }
      continue;
    }
    if (result.type === "countdown") {
      const r = result;
      const items = [];
      const days = Number(r.days ?? 0);
      const hours = Number(r.hours ?? 0);
      items.push({ label: "D\xEDas", value: String(days), detail: r.direction === "faltan" ? "faltan" : "pasaron" });
      items.push({ label: "Horas", value: String(hours) });
      if (r.targetDate) {
        const d = new Date(r.targetDate);
        if (!Number.isNaN(d.getTime())) {
          items.push({ label: "Fecha", value: d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) });
        }
      }
      blocks.push({
        type: "data_card",
        title: r.label ? `Cuenta regresiva \xB7 ${r.label}` : "Cuenta regresiva",
        items
      });
      continue;
    }
    if (result.type === "game_info") {
      const r = result;
      if (r.status === "failed" || r.status === "no_data") {
        result.__gameInfoFailed = true;
        continue;
      }
      blocks.push({
        type: "movie_review",
        title: r.title ?? "Juego",
        poster: r.backgroundImage ?? r.image,
        rating: typeof r.rating === "number" ? r.rating : void 0,
        releaseDate: r.released,
        runtime: r.playtime ? `${r.playtime}h+` : void 0,
        director: r.developer,
        cast: Array.isArray(r.publishers) ? r.publishers : void 0,
        genres: Array.isArray(r.genres) ? r.genres : void 0,
        overview: (r.description ?? r.summary ?? "").slice(0, 800),
        sources: Array.isArray(r.sources) ? r.sources : r.website ? [{ title: r.title, url: r.website, domain: "rawg.io" }] : void 0
      });
      continue;
    }
    if (result.type === "dictionary_define") {
      const r = result;
      const items = [];
      if (r.word) items.push({ label: "Palabra", value: r.word });
      if (r.phonetic) items.push({ label: "Fon\xE9tica", value: r.phonetic });
      if (Array.isArray(r.definitions) && r.definitions.length) {
        for (const d of r.definitions.slice(0, 3)) {
          items.push({ label: d.partOfSpeech ?? "Def", value: d.definition ?? "" });
        }
      } else if (r.definition) {
        items.push({ label: "Definici\xF3n", value: r.definition });
      }
      if (items.length) {
        blocks.push({
          type: "data_card",
          title: r.word ?? "Definici\xF3n",
          items
        });
      }
      continue;
    }
    if (result.type === "math_calc") {
      const r = result;
      blocks.push({
        type: "data_card",
        title: "C\xE1lculo",
        items: [
          { label: "Expresi\xF3n", value: r.expression ?? "" },
          { label: "Resultado", value: String(r.result ?? "?") }
        ]
      });
      continue;
    }
    if (result.type === "unit_convert") {
      const r = result;
      blocks.push({
        type: "data_card",
        title: "Conversi\xF3n",
        items: [
          { label: "De", value: `${r.value ?? ""} ${r.from ?? ""}` },
          { label: "A", value: `${r.result ?? "?"} ${r.to ?? ""}` }
        ]
      });
      continue;
    }
    if (result.type === "news_topic" || result.type === "trending_topic") {
      const r = result;
      const items = Array.isArray(r.articles) ? r.articles : Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) continue;
      blocks.push({
        type: "research_sources",
        title: r.topic ?? r.query ?? "Noticias",
        summary: (r.summary ?? "").slice(0, 800),
        sources: items.slice(0, 6).map((a) => ({
          title: a.title ?? a.headline ?? "",
          url: a.url ?? "",
          domain: a.source ?? a.domain ?? "",
          snippet: (a.summary ?? a.snippet ?? "").slice(0, 200)
        }))
      });
      continue;
    }
  }
  return blocks;
}
function hasUsefulBlockContent(block) {
  if (block.type === "weather") {
    return Boolean(block.city || block.now || block.range || block.rain || block.wind || block.advice || block.sources?.length);
  }
  if (block.type === "comparison") return block.items.length > 0;
  if (block.type === "research_sources") return Boolean(block.summary || block.sources.length);
  if (block.type === "plan") return block.items.length > 0;
  if (block.type === "saved_record") return block.records.length > 0;
  if (block.type === "money_summary") return Boolean(block.total || block.summaryItems?.length || block.recommendation);
  if (block.type === "recipe") return Boolean(block.name || block.title || block.instructions || block.ingredients?.length);
  if (block.type === "movie_review") return Boolean(block.title || block.poster || block.overview || block.rating);
  if (block.type === "book_review") return Boolean(block.title || block.cover || block.synopsis || block.author);
  return true;
}
function mergeModelAndToolBlocks(modelBlocks, toolBlocks) {
  const usefulModelBlocks = modelBlocks.filter(hasUsefulBlockContent);
  if (!toolBlocks.length) return usefulModelBlocks;
  if (!usefulModelBlocks.length) return toolBlocks;
  const merged = [];
  const usedToolIndexes = /* @__PURE__ */ new Set();
  for (const modelBlock of usefulModelBlocks) {
    const toolIndex = toolBlocks.findIndex((toolBlock2, index) => !usedToolIndexes.has(index) && toolBlock2.type === modelBlock.type);
    if (toolIndex < 0) {
      merged.push(modelBlock);
      continue;
    }
    const toolBlock = toolBlocks[toolIndex];
    usedToolIndexes.add(toolIndex);
    if (modelBlock.type === "weather" && toolBlock.type === "weather") {
      merged.push({
        ...modelBlock,
        city: modelBlock.city || toolBlock.city,
        now: modelBlock.now || toolBlock.now,
        range: modelBlock.range || toolBlock.range,
        rain: modelBlock.rain || toolBlock.rain,
        wind: modelBlock.wind || toolBlock.wind,
        advice: modelBlock.advice || toolBlock.advice,
        sourceStatus: modelBlock.sourceStatus ?? toolBlock.sourceStatus,
        sources: modelBlock.sources?.length ? modelBlock.sources : toolBlock.sources
      });
      continue;
    }
    if (modelBlock.type === "comparison" && toolBlock.type === "comparison") {
      merged.push({
        ...modelBlock,
        items: modelBlock.items.length ? modelBlock.items : toolBlock.items,
        recommendation: modelBlock.recommendation || toolBlock.recommendation,
        sources: modelBlock.sources?.length ? modelBlock.sources : toolBlock.sources
      });
      continue;
    }
    if (modelBlock.type === "research_sources" && toolBlock.type === "research_sources") {
      merged.push({
        ...modelBlock,
        summary: modelBlock.summary || toolBlock.summary,
        sources: modelBlock.sources.length ? modelBlock.sources : toolBlock.sources,
        sourceStatus: modelBlock.sourceStatus ?? toolBlock.sourceStatus
      });
      continue;
    }
    if (modelBlock.type === "plan" && toolBlock.type === "plan") {
      merged.push({
        ...modelBlock,
        items: modelBlock.items.length ? modelBlock.items : toolBlock.items,
        note: modelBlock.note || toolBlock.note
      });
      continue;
    }
    merged.push(modelBlock);
  }
  const finalBlocks = [
    ...merged,
    ...toolBlocks.filter((_, index) => !usedToolIndexes.has(index))
  ];
  const seen = /* @__PURE__ */ new Set();
  return finalBlocks.filter((block) => {
    if (block.type === "saved_record" && block.records.every((record) => /^dato guardado$/i.test(record.title))) return false;
    const key = `${block.type}|${plainLower("title" in block && typeof block.title === "string" ? block.title : replyFromBlocks([block], ""))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}
function replyFromBlocks(blocks, input) {
  const first = blocks[0];
  if (!first) return "";
  if (first.type === "weather") {
    const facts = [
      first.city ? `En ${first.city}` : "El clima",
      first.now ? `${first.now} ahora` : void 0,
      first.range ? `rango ${first.range}` : void 0,
      first.rain ? `lluvia ${first.rain}` : void 0
    ].filter(Boolean).join(", ");
    const outfit = /reuni[oó]n|poner|ropa|vestir|campera|chaqueta|paraguas/i.test(input) ? " Para reunion, ve prolijo y en capas; si sales tarde, lleva una chaqueta ligera." : "";
    return `${facts}. ${first.advice ?? ""}${outfit}`.replace(/\s+/g, " ").trim();
  }
  if (first.type === "plan") {
    const step = first.items[0];
    return step ? `Empezaria por: ${step.title}${step.durationMinutes ? ` (${step.durationMinutes} min)` : ""}.` : first.title ?? "Te deje un plan accionable.";
  }
  if (first.type === "comparison") {
    const best = first.items[0];
    return best ? `Te deje una comparativa inicial. Miraria primero ${best.title}${best.vendor ? ` en ${best.vendor}` : ""}.` : "Te deje una comparativa inicial con evidencia visible.";
  }
  if (first.type === "research_sources") {
    return first.sources.length ? `Traje fuentes para revisar sin inventar conclusiones: ${first.sources[0].domain}.` : first.summary;
  }
  if (first.type === "activity_group") {
    const firstSection = first.sections[0];
    const firstRow = firstSection?.rows?.[0];
    const firstTile = firstSection?.tiles?.[0];
    if (firstRow) return firstRow.title;
    if (firstTile) return `${firstTile.label}: ${firstTile.value}`;
    return first.subtitle ?? first.note ?? first.title;
  }
  if (first.type === "clarifying_question") return first.question;
  if (first.type === "reminder") return `Lo dejo como recordatorio: ${first.title}.`;
  if (first.type === "alarm") return `Prepare la alarma para ${first.time}.`;
  if (first.type === "shopping_list") {
    return /que|qué|cual|cu[aá]l|\?/i.test(input) ? `Tenes para comprar: ${first.items.join(", ")}.` : `Lo deje en compras: ${first.items.join(", ")}.`;
  }
  if (first.type === "saved_record") {
    const titles = first.records.map((record) => record.title).filter(Boolean);
    if (/comida/i.test(first.title ?? "") && titles.length) return `Guarde comida en casa: ${titles.slice(0, 4).join(", ")}.`;
    if (titles.length > 1) return `Guarde ${titles.length} datos: ${titles.slice(0, 3).join(", ")}.`;
    return `Guardado: ${titles[0] ?? "dato importante"}.`;
  }
  if (first.type === "money_summary") return first.recommendation ?? "Te deje el resumen de dinero.";
  if (first.type === "proactive_signal") return first.body;
  if (first.type === "product_analysis") {
    const name = first.product?.name ?? "Lo que pediste";
    const desc = first.product?.description;
    const rating = first.product?.rating;
    const parts = [];
    if (rating) parts.push(`Rating: ${rating}/10.`);
    if (desc) parts.push(desc.slice(0, 300));
    return parts.length > 0 ? `${name}. ${parts.join(" ")}` : `Te deje la info de ${name} en la tarjeta.`;
  }
  if (first.type === "recipe") {
    const name = first.name ?? first.title ?? "Receta";
    const parts = [name];
    if (first.category) parts.push(first.category);
    if (first.area) parts.push(first.area);
    if (first.ingredients?.length) parts.push(`${first.ingredients.length} ingredientes`);
    return `Te deje la receta de ${parts.join(" \xB7 ")} en la tarjeta.${first.videoUrl ? " Incluye video." : ""}`;
  }
  if (first.type === "movie_review") {
    const title = first.title ?? "Pel\xEDcula";
    const parts = [];
    if (first.rating) parts.push(`Rating: ${first.rating}/10`);
    if (first.director) parts.push(`Dir: ${first.director}`);
    if (first.runtime) parts.push(first.runtime);
    return parts.length > 0 ? `${title}. ${parts.join(" \xB7 ")}.` : `Te deje la info de ${title} en la tarjeta.`;
  }
  if (first.type === "book_review") {
    const title = first.title ?? "Libro";
    const parts = [];
    if (first.author) parts.push(first.author);
    if (first.year) parts.push(first.year);
    return parts.length > 0 ? `${title} \u2014 ${parts.join(", ")}.` : `Te deje la info de ${title} en la tarjeta.`;
  }
  if (first.type === "data_card") {
    return first.title ?? "Te deje los datos en la tarjeta.";
  }
  if (first.type === "live_match") {
    const home = first.homeName ?? first.homeTeam?.name ?? "";
    const away = first.awayName ?? first.awayTeam?.name ?? "";
    const hs = first.homeScore ?? first.homeTeam?.score;
    const as = first.awayScore ?? first.awayTeam?.score;
    if (home && away && hs !== void 0 && as !== void 0) {
      return `${home} ${hs} - ${as} ${away}. Te deje el detalle en la tarjeta.`;
    }
    return "Te deje el resultado del partido en la tarjeta.";
  }
  if (first.type === "restaurant_synthesis") {
    const topMatch = first.matches?.[0];
    if (topMatch) {
      return `Te deje el cruce de rese\xF1as en la tarjeta. El m\xE1s mencionado: ${topMatch.name}.`;
    }
    return "Te deje el cruce de rese\xF1as en la tarjeta.";
  }
  if (first.type === "crypto_portfolio") {
    const item = first.items?.[0];
    if (item) {
      const change = item.change !== void 0 ? item.change >= 0 ? ` Subi\xF3 ${item.change}%` : ` Baj\xF3 ${Math.abs(item.change)}%` : "";
      return `${item.name} est\xE1 en ${item.price}.${change} Te dej\xE9 el detalle en la tarjeta.`;
    }
    return "Te deje la cotizaci\xF3n en la tarjeta.";
  }
  if (first.type === "deliverable") {
    return first.summary ? `${first.summary.slice(0, 200)}` : "Te dej\xE9 el resultado en la tarjeta.";
  }
  return "";
}
function isGenericAgentReply(reply) {
  const normalized = reply.toLowerCase();
  return [
    "listo. te dejo lo importante y el siguiente paso.",
    "listo. te dejo lo importante en la tarjeta.",
    "no pude componer una respuesta util."
  ].some((item) => normalized === item);
}
function normalizeMemoryCandidates(value) {
  return asArray(value).map(asRecord).map((item) => ({
    kind: ["profile", "routine", "preference", "goal", "relationship", "boundary", "retail", "wellbeing", "task"].includes(cleanText(item.kind)) ? cleanText(item.kind) : "profile",
    text: cleanText(item.text),
    confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.7,
    sensitivity: cleanText(item.sensitivity) === "sensitive" ? "sensitive" : "normal",
    status: "candidate",
    rootQuote: cleanText(item.root_quote ?? item.rootQuote),
    useForSuggestions: item.use_for_suggestions === false || item.useForSuggestions === false ? false : true
  })).filter((item) => item.text.length > 4).slice(0, 5);
}
function synthesizeMemoryFromRevelation(input) {
  const candidates = [];
  const text = input.trim();
  let m;
  if (m = text.match(/\b(?:me encanta|me encantan|amo|me apasiona|me fascina|me gustan los|me gustan las|me gusta el|me gusta la|adoro)\s+([^.!?]{3,80})/i)) {
    candidates.push({ kind: "preference", text: `Le encanta ${m[1].trim()}.`, confidence: 0.88, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  if (m = text.match(/\b(?:estoy|ando|estuve)\s+(trabajando|aprendiendo|leyendo|escuchando|viendo|estudiando|haciendo|armando|programando|escribiendo|cocinando|preparando|investigando|diseñando|creando|desarrollando)\s+(?:en\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?([^.!?]{3,100})/i)) {
    const action = m[1].toLowerCase();
    const what = m[2].trim();
    const kind = action === "aprendiendo" ? "routine" : action === "trabajando" || action === "programando" || action === "desarrollando" || action === "creando" || action === "dise\xF1ando" ? "goal" : "routine";
    const verbMap = {
      trabajando: "Trabaja en",
      aprendiendo: "Aprende",
      leyendo: "Est\xE1 leyendo",
      escuchando: "Escucha",
      viendo: "Est\xE1 viendo",
      estudiando: "Estudia",
      haciendo: "Est\xE1 haciendo",
      armando: "Est\xE1 armando",
      programando: "Programa",
      escribiendo: "Est\xE1 escribiendo",
      cocinando: "Est\xE1 cocinando",
      preparando: "Est\xE1 preparando",
      investigando: "Investiga",
      dise\u00F1ando: "Dise\xF1a",
      creando: "Est\xE1 creando",
      desarrollando: "Desarrolla"
    };
    candidates.push({ kind, text: `${verbMap[action] ?? "Est\xE1 " + action} ${what}.`, confidence: 0.86, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  if (m = text.match(/\b(?:mi\s+)?(?:madre|padre|mam[áa]|pap[áa])\s+(?:cumple|tiene|es|está|va a)\s+([^.!?]{3,80})/i)) {
    candidates.push({ kind: "relationship", text: `Sobre su madre/padre: ${m[0].trim()}.`, confidence: 0.8, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  if (m = text.match(/\b(?:mi\s+)?cumple[años]*\s+(?:es|en|el|por)\s+([^.!?]{3,60})/i)) {
    candidates.push({ kind: "profile", text: `Cumplea\xF1os: ${m[1].trim()}.`, confidence: 0.85, sensitivity: "normal", status: "candidate", rootQuote: text, useForSuggestions: true });
  }
  return candidates;
}
function normalizeCommitments(value) {
  return asArray(value).map(asRecord).map((item) => ({
    title: cleanText(item.title),
    dueHint: cleanText(item.due_hint ?? item.dueHint, "sin fecha"),
    dueAt: cleanText(item.dueAt),
    recurrence: ["daily", "weekly", "monthly"].includes(cleanText(item.recurrence)) ? cleanText(item.recurrence) : void 0,
    status: "open"
  })).filter((item) => item.title.length > 3).slice(0, 5);
}
function normalizeRecords(value) {
  return asArray(value).map(asRecord).map((item) => ({
    domain: ["morning", "work", "money", "health", "relationship", "home", "interest", "capture"].includes(cleanText(item.domain)) ? cleanText(item.domain) : "capture",
    kind: cleanText(item.kind),
    title: cleanText(item.title),
    value: cleanText(item.value),
    amount: typeof item.amount === "number" ? item.amount : void 0,
    currency: cleanText(item.currency),
    person: cleanText(item.person),
    url: cleanText(item.url),
    collection: cleanText(item.collection),
    dueHint: cleanText(item.dueHint ?? item.due_hint),
    notes: cleanText(item.notes),
    tags: asArray(item.tags).map((tag) => cleanText(tag)).filter(Boolean)
  })).filter((item) => item.title.length > 2 && item.kind).slice(0, 8);
}
function normalizeSuggestedActions(value) {
  return asArray(value).map(asRecord).map((item) => ({
    id: cleanText(item.id, createId3("suggestion")),
    label: cleanText(item.label, "Usar"),
    kind: ["save", "remind", "watch", "compare_more", "approve", "calendar", "research"].includes(cleanText(item.kind)) ? cleanText(item.kind) : "research",
    requiresApproval: item.requiresApproval !== false,
    payload: asRecord(item.payload)
  })).filter((item) => item.label.length > 1).slice(0, 4);
}
function personalCapturesFromTools(toolExecutions) {
  return toolExecutions.map((execution) => execution.result).filter((result) => result.type === "personal_capture");
}
function localActionsFromTools(toolExecutions) {
  return toolExecutions.map((execution) => execution.result).filter((result) => result.type === "local_action");
}
function memoryCapturesFromTools(toolExecutions) {
  return toolExecutions.map((execution) => execution.result).filter((result) => result.type === "memory_capture");
}
function uniqueRecords(records) {
  const seen = /* @__PURE__ */ new Set();
  return records.filter((record) => {
    if (/^dato guardado$/i.test(record.title.trim())) return false;
    const key = `${record.domain}|${record.kind}|${plainLower(record.title)}|${plainLower(record.value ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function uniqueCommitments(commitments) {
  const seen = /* @__PURE__ */ new Set();
  return commitments.filter((commitment) => {
    const key = `${plainLower(commitment.title)}|${plainLower(commitment.dueHint)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeFinalPayload(raw, input, toolExecutions, extractedRaw, prebuiltToolBlocks) {
  const modelBlocks = asArray(raw.uiBlocks).map(normalizeUiBlock).filter((block) => Boolean(block));
  const mascotState = cleanText(raw.mascotState) || "idle";
  const validatedMascotState = VALID_MASCOT_STATES.includes(mascotState) ? mascotState : "idle";
  if (mascotState !== "idle" && !VALID_MASCOT_STATES.includes(mascotState)) {
    console.warn(`[Koru] LLM returned invalid mascotState: "${mascotState}". Falling back to "idle".`);
  }
  const toolBlocks = prebuiltToolBlocks ?? blocksFromToolResults(toolExecutions);
  const uiBlocks = toolBlocks.length > 0 ? toolBlocks : mergeModelAndToolBlocks(modelBlocks, toolBlocks);
  const captures = personalCapturesFromTools(toolExecutions);
  const localActions = localActionsFromTools(toolExecutions);
  const memoryCaptures = memoryCapturesFromTools(toolExecutions);
  const toolResults = toolExecutions.map((execution, index) => {
    const resultAny = execution.result;
    const rawStatus = typeof resultAny?.status === "string" ? resultAny.status : "ok";
    const status = rawStatus === "failed" || rawStatus === "error" ? "failed" : rawStatus === "partial" || rawStatus === "no_data" || rawStatus === "need_city" || rawStatus === "needs_context" ? "needs_context" : "ok";
    const toolMap = {
      weather: "weather",
      web_search: "web_search",
      shopping_compare: "shopping_compare",
      route_traffic: "route_traffic",
      calendar_reminder: "calendar_reminder",
      alarm: "alarm",
      alarm_set: "alarm",
      reminder_set: "calendar_reminder",
      countdown: "calendar_reminder",
      match_live: "match_live",
      match_schedule: "match_live",
      league_standings: "match_live",
      team_follow: "match_live",
      plan_day: "memory_recall",
      save_memory: "memory_recall",
      save_personal_item: "memory_recall",
      query_personal_context: "memory_recall",
      movie_info: "web_search",
      book_info: "web_search",
      game_info: "web_search",
      person_info: "web_search",
      person_filmography: "web_search",
      wikipedia_lookup: "web_search",
      dictionary_define: "web_search",
      math_calc: "web_search",
      unit_convert: "web_search",
      recipe_find: "web_search",
      recipe_by_ingredients: "web_search",
      food_info: "web_search",
      wine_pairing: "web_search",
      nutrition_calc: "web_search",
      restaurant_deep_search: "shopping_compare",
      restaurant_review_aggregate: "shopping_compare",
      crypto_price: "crypto_price",
      stock_quote: "crypto_price",
      exchange_history: "crypto_price",
      currency_convert: "crypto_price",
      news_topic: "web_search",
      trending_topic: "web_search",
      travel_itinerary: "route_traffic",
      flight_search: "route_traffic",
      hotel_search: "route_traffic",
      deep_research: "web_search",
      price_history: "shopping_compare",
      product_review: "shopping_compare"
    };
    return {
      id: execution.id || `tool_${index + 1}`,
      tool: toolMap[execution.name] ?? "web_search",
      status,
      summary: JSON.stringify(execution.result).slice(0, 500),
      data: execution.result,
      sources: normalizeSources(resultAny?.sources)
    };
  });
  const cleanedReply = cleanReplyText(raw.reply);
  const blockReply = replyFromBlocks(uiBlocks, input);
  const honestForcedReply = toolExecutions.map((e) => e.result).find((r) => r && r.__forceHonestReply);
  const looksLikeThinking = /^(the user|i need to|let me|i should|i will|i'll|i am going to|i'm going to|step by step|first,?\s*i|okay,?\s*(so|i|let)|alright,?\s*(so|i|let))\b/i.test(cleanedReply);
  let finalReply;
  if (honestForcedReply) {
    finalReply = honestForcedReply.__honestReplyText || "No encontr\xE9 datos sobre eso en este momento.";
  } else if (!cleanedReply || isGenericAgentReply(cleanedReply) || looksLikeThinking) {
    finalReply = blockReply || "Tuve un problema para armar la respuesta. \xBFMe lo repet\xEDs de otra forma para ayudarte bien?";
  } else {
    finalReply = cleanedReply;
  }
  const informativeBlockTypes = /* @__PURE__ */ new Set([
    "movie_review",
    "recipe",
    "book_review",
    "weather",
    "live_match",
    "deliverable",
    "market",
    "forex",
    "data_card",
    "web_nav",
    "restaurant_synthesis",
    "research_sources",
    "comparison",
    "crypto_portfolio",
    "data_ticker",
    "product_analysis"
  ]);
  const hasInformativeBlock = uiBlocks.some((b) => informativeBlockTypes.has(b.type));
  if (finalReply.length > 250 && hasInformativeBlock) {
    const firstSentence = finalReply.match(/^.{1,200}?[.!?](\s|$)/)?.[0];
    if (firstSentence && firstSentence.length < finalReply.length) {
      const trimmed = firstSentence.trim();
      if (/tarjeta/i.test(trimmed)) {
        finalReply = trimmed;
      } else {
        finalReply = trimmed + " Te dej\xE9 el detalle en la tarjeta.";
      }
    }
  }
  if (hasInformativeBlock) {
    finalReply = finalReply.replace(/Te dejé el detalle en la tarjeta\.?\s*$/i, "").trim();
    if (!/tarjeta/i.test(finalReply)) {
      finalReply += " Te dej\xE9 el detalle en la tarjeta.";
    }
  }
  return {
    reply: finalReply,
    uiBlocks,
    suggestedActions: normalizeSuggestedActions(raw.suggestedActions),
    understanding: normalizeUnderstanding(raw.understanding, input),
    memoryCandidates: [
      ...normalizeMemoryCandidates(raw.memoryCandidates),
      ...normalizeMemoryCandidates(extractedRaw?.memoryCandidates),
      ...captures.flatMap((capture) => capture.memoryCandidates ?? []),
      ...memoryCaptures.flatMap((capture) => capture.memoryCandidates ?? []),
      // 🔴 FIX: síntesis determinística — si el LLM no capturó la revelación
      // pasiva del input, generarla aquí.
      ...captures.length === 0 && memoryCaptures.length === 0 ? synthesizeMemoryFromRevelation(input) : []
    ].slice(0, 6),
    commitments: uniqueCommitments([
      ...normalizeCommitments(raw.commitments),
      ...normalizeCommitments(extractedRaw?.commitments),
      ...captures.flatMap((capture) => capture.commitments ?? []),
      ...localActions.flatMap((action) => action.commitments ?? []),
      // 🔴 FIX: extract commitments from any tool result that has them
      ...toolExecutions.flatMap((exec) => {
        const r = exec.result;
        return Array.isArray(r?.commitments) ? r.commitments : [];
      })
    ]).slice(0, 8),
    records: uniqueRecords([
      ...normalizeRecords(raw.records),
      ...normalizeRecords(extractedRaw?.records),
      ...captures.flatMap((capture) => capture.records ?? []),
      ...localActions.flatMap((action) => action.records ?? []),
      // 🔴 FIX: extract records from any tool result that has them
      ...toolExecutions.flatMap((exec) => {
        const r = exec.result;
        return Array.isArray(r?.records) ? r.records : [];
      })
    ]).slice(0, 12),
    toolResults,
    stateEvents: [
      { kind: "thinking", label: "Entendiendo objetivo real" },
      ...toolExecutions.length ? [{ kind: "searching", label: "Usando herramientas reales" }] : [],
      { kind: "done", label: "Respuesta lista" }
    ],
    provider: "nvidia",
    mascotState: validatedMascotState,
    skippedBecauseBoundary: [.../* @__PURE__ */ new Set([
      ...asArray(raw.skippedBecauseBoundary).map((v) => cleanText(v)).filter(Boolean),
      ...asArray(extractedRaw?.skippedBecauseBoundary).map((v) => cleanText(v)).filter(Boolean)
    ])],
    behaviorNotes: [.../* @__PURE__ */ new Set([
      ...asArray(raw.behaviorNotes).map((v) => cleanText(v)).filter(Boolean),
      ...asArray(extractedRaw?.behaviorNotes).map((v) => cleanText(v)).filter(Boolean)
    ])]
  };
}
async function finalizeFromPlainText(raw, toolCalls, request, config2, toolExecutions, extractorTimeout) {
  const cityAction = cityMemorySuggestion(toolCalls, request.state);
  if (cityAction) raw.suggestedActions = [...asArray(raw.suggestedActions || []), cityAction];
  if (asArray(raw.suggestedActions || []).length === 0) {
    try {
      const { enhancementActions } = await buildEnhancementInstruction(request, config2, toolExecutions);
      raw.suggestedActions = [...asArray(raw.suggestedActions || []), ...enhancementActions];
    } catch {
    }
  }
  return finalizePayload(request, config2, raw, toolExecutions, extractorTimeout);
}
async function finalizePayload(request, config2, raw, toolExecutions, extractorTimeout) {
  if (isTrivialInput(request.input)) {
    return normalizeFinalPayload(raw, request.input, toolExecutions);
  }
  try {
    const extracted = await extractMemoryWithJsonPrompt(request, config2, toolExecutions, raw, extractorTimeout);
    return {
      ...normalizeFinalPayload(raw, request.input, toolExecutions, extracted.raw),
      memoryProvider: extracted.provider,
      memoryModel: extracted.model,
      memoryFallbackReason: extracted.fallbackReason
    };
  } catch (error) {
    return {
      ...normalizeFinalPayload(raw, request.input, toolExecutions),
      memoryFallbackReason: error instanceof Error ? error.message : "memory-extractor-failed"
    };
  }
}
async function finalizePayloadWithFastModel(request, config2, raw, toolExecutions, timeout, prebuiltToolBlocks) {
  const existingReply = cleanText(raw.reply);
  if (existingReply && existingReply.length > 5) {
    if (!isTrivialInput(request.input)) {
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, config2, toolExecutions, raw, timeout);
        return normalizeFinalPayload(raw, request.input, toolExecutions, extracted.raw, prebuiltToolBlocks);
      } catch {
      }
    }
    return normalizeFinalPayload(raw, request.input, toolExecutions, void 0, prebuiltToolBlocks);
  }
  const messages = buildMessages(request);
  messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respond\xE9 con JSON puro v\xE1lido. Sin markdown, sin backticks. El JSON debe empezar con { y terminar con }." });
  try {
    const result = await callProvider(config2, messages, timeout, false, void 0, void 0, config2.nvidiaModel);
    const content = cleanText(result.message.content, "");
    let parsed;
    try {
      parsed = JSON.parse(extractJsonBlock(content));
    } catch {
      parsed = { reply: cleanReplyText(content) || "No pude armar una respuesta clara." };
    }
    if (!isTrivialInput(request.input)) {
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, config2, toolExecutions, parsed, timeout);
        return normalizeFinalPayload(parsed, request.input, toolExecutions, extracted.raw, prebuiltToolBlocks);
      } catch {
      }
    }
    return normalizeFinalPayload(parsed, request.input, toolExecutions, void 0, prebuiltToolBlocks);
  } catch {
    return normalizeFinalPayload(raw, request.input, toolExecutions);
  }
}
async function executeProviderToolCalls(toolCalls, messages, request, toolExecutions, config2) {
  messages.push({
    role: "assistant",
    content: "",
    tool_calls: toolCalls
  });
  const extractorChatFn = async (msgs, opts) => {
    const body = {
      model: config2.nvidiaModel || "llama3.1:8b",
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      format: opts.responseFormat?.type === "json_object" ? "json" : void 0,
      stream: false,
      options: { temperature: opts.temperature ?? 0.1, num_predict: opts.maxTokens ?? 900 }
    };
    if (!config2.nvidiaBaseUrl) throw new Error("Ollama no configurado para extractor");
    const r = await fetchWithTimeout(providerUrl(config2.nvidiaBaseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, 3e4);
    const d = await r.json().catch(() => ({}));
    return { content: d.message?.content ?? "" };
  };
  const extractorCtx = { userInput: request.input, chatFn: extractorChatFn };
  const deferredDataCards = [];
  for (const call of toolCalls) {
    const name = call.function.name;
    const args = { ...toolCallArgs(call), __userInput: request.input };
    if (name === "deliver_response") return args;
    const { result: toolResult, deferredDataCard } = await executeTool(name, args, request.state, extractorCtx);
    toolExecutions.push({ id: call.id, name, result: toolResult });
    if (deferredDataCard) deferredDataCards.push(deferredDataCard);
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(toolResult)
    });
  }
  toolExecutions.__deferredDataCards = deferredDataCards;
  return null;
}
async function buildEnhancementInstruction(request, config2, toolExecutions) {
  try {
    const uiBlocks = blocksFromToolResults(toolExecutions);
    const toolBlocks = toolExecutions.flatMap((t) => {
      const resultStatus = t.result?.status;
      const status = resultStatus === "verified" ? "ok" : resultStatus === "failed" ? "failed" : "partial";
      return [{
        id: t.id,
        tool: t.name,
        status,
        summary: typeof t.result === "object" && t.result !== null ? JSON.stringify(t.result).slice(0, 200) : "ok",
        data: typeof t.result === "object" && t.result !== null ? t.result : void 0
      }];
    });
    const chatFn = async (messages, _options) => {
      const pp = inferProviderFromModel(request.model);
      const chatTimeout = isOllamaUrl(config2.nvidiaBaseUrl) ? 6e4 : 15e3;
      const result = await callProvider(config2, messages.map((m) => ({ role: m.role, content: m.content })), chatTimeout, false, pp);
      return { content: result.message.content ?? "" };
    };
    const opportunities = await extractOpportunities({
      input: request.input,
      intent: { domain: "chat", kind: "user_request", confidence: 0.6 },
      uiBlocks,
      toolResults: toolBlocks,
      state: request.state,
      runtime: request.state.runtime
    }, chatFn);
    const candidates = generateEnhancements(opportunities, request.state);
    const prompt = enhancementPrompt(candidates);
    const enhancementBlocks = candidates.filter(
      (c) => c.action.mode === "auto" && "uiBlock" in c.action && Boolean(c.action.uiBlock)
    ).map((c) => c.action.uiBlock);
    const enhancementActions = candidates.filter(
      (c) => c.action.mode === "ask" || c.action.mode === "suggest"
    ).map((c) => ({
      id: c.id,
      label: c.action.mode === "ask" ? c.action.question : c.action.text,
      kind: c.action.mode === "ask" ? "approve" : "save",
      requiresApproval: c.action.mode === "ask",
      payload: {
        enhancementType: c.title,
        ...c.action.uiBlock ? { uiBlock: c.action.uiBlock } : {}
      }
    }));
    return { prompt, enhancementBlocks, enhancementActions };
  } catch {
    return { prompt: "", enhancementBlocks: [], enhancementActions: [] };
  }
}
var routerSingleton = null;
var routerNullWarned = false;
function buildEmbedFn(baseUrl) {
  return async (text) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15e3);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!data.embedding || data.embedding.length === 0) {
        throw new Error("Ollama no devolvi\xF3 embedding");
      }
      return data.embedding;
    } finally {
      clearTimeout(timeout);
    }
  };
}
function buildNvidiaEmbedFn(apiKey, baseUrl) {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/embeddings`;
  return async (text) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "nvidia/nv-embedqa-e5-v5",
          input: [text],
          input_type: "query"
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(`NVIDIA embeddings ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      const vec = data.data?.[0]?.embedding;
      if (!vec || vec.length === 0) {
        throw new Error("NVIDIA no devolvi\xF3 embedding");
      }
      return vec;
    } finally {
      clearTimeout(timeout);
    }
  };
}
async function getRouter(config2) {
  const embedBaseUrl = config2.ollamaEmbedBaseUrl ?? (isOllamaUrl(config2.nvidiaBaseUrl) ? config2.nvidiaBaseUrl : void 0);
  let embedFn = null;
  let embedSource = "none";
  if (embedBaseUrl) {
    embedFn = buildEmbedFn(embedBaseUrl);
    embedSource = `ollama:${embedBaseUrl}`;
  } else if (config2.nvidiaApiKey && config2.nvidiaApiKey !== "dummy") {
    embedFn = buildNvidiaEmbedFn(config2.nvidiaApiKey, config2.nvidiaBaseUrl);
    embedSource = `nvidia:${config2.nvidiaBaseUrl}`;
  }
  if (!embedFn) {
    if (!routerNullWarned) {
      logger.warn("getRouter", "Sin embeddings disponibles (ni Ollama ni NVIDIA key). Semantic Router desactivado.");
      routerNullWarned = true;
    }
    return null;
  }
  routerSingleton = new SemanticRouter(embedFn);
  try {
    await routerSingleton.initialize();
    logger.info("getRouter", "Semantic Router initialized", { source: embedSource });
  } catch (err) {
    logger.warn("getRouter", "Semantic Router init failed (non-fatal)", { reason: err?.message, source: embedSource });
    routerSingleton = null;
    return null;
  }
  return routerSingleton;
}
function searchLabelFromInput(input) {
  const clean = input.trim().replace(/\s+/g, " ");
  if (/\b(recordame|recordar|recuerdame|recuerda|no me dejes olvidar|avisame|avisa|anot[aá])\b/i.test(clean)) {
    const m = clean.match(/(?:recordame|recordar|recuerdame|recuerda|no me dejes olvidar|avisame|avisa|anot[aá])\s+(.+?)(?:\s+(?:a las|al|el|en|para|mañana|pasado)\b|$)/i);
    const what = m?.[1]?.trim() ?? clean.replace(/.*(?:recordame|recordar|recuerdame|recuerda|no me dejes olvidar|avisame|avisa|anot[aá])\s+/i, "").trim();
    return `Anotando ${what.slice(0, 40)}\u2026`;
  }
  if (/\b(alarma|despertador)\b/i.test(clean)) {
    const t = clean.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i)?.[0];
    return t ? `Programando alarma para las ${t}\u2026` : "Programando alarma\u2026";
  }
  if (/\b(cu[aá]ntos? d[ií]as? faltan|cu[aá]nto falta|faltan para)\b/i.test(clean)) {
    return "Calculando cuenta regresiva\u2026";
  }
  const stripped = clean.replace(/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|che|hey|koru|por favor|podr[ií]as|puedes|me dec[ií]s|decime|dame|quiero saber|necesito saber|busc[aá]\s*(info|informaci[oó]n|datos)?\s*(sobre|de|acerca)?)\b[,\s]*/gi, "").replace(/^(paso|pas[oó]|que paso|qué pasó|qu[eé] tal|c[oó]mo (va|le va|est[aá]))\s+(con|el|la|los|las)?\s*/i, "").trim();
  if (stripped.length < 5) return "Buscando en la web\u2026";
  const shortened = stripped.length > 50 ? stripped.slice(0, 50).trim() + "\u2026" : stripped;
  return `Buscando ${shortened}\u2026`;
}
function explicitDeliverableTopic(input, history) {
  const clean = input.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const hasDeliverableCue = /\b(?:informe\s+(?:sobre|de|del|acerca)|reporte\s+(?:sobre|de|del|acerca)|dossier|investigaci[oó]n\s+(?:sobre|de|del|acerca)|investig[aá]me|resumen completo|contame todo sobre|quiero saber todo sobre|explicame en profundidad|estudi[aá]me|hac[eé]\s+(?:un\s+)?informe|hac[eé]\s+(?:un\s+)?reporte)\b|an[aá]lisis\s+(?:completo|profundo|detallado|serio)/i.test(clean);
  if (!hasDeliverableCue) return null;
  const topicPatterns = [
    /(?:informe|reporte|dossier|investigaci[oó]n|an[aá]lisis)\s+(?:serio\s+|completo\s+|profundo\s+|detallado\s+)?(?:sobre|acerca de|del|de)\s+(.{3,180})/i,
    /(?:investig[aá](?:me)?|estudi[aá](?:me)?)\s+(?:todo\s+)?(?:(?:sobre|acerca de|del|de)\s+)?(.{3,180})/i,
    /(?:contame todo|quiero saber todo)\s+(?:sobre|acerca de|del|de)\s+(.{3,180})/i,
    /explicame en profundidad\s+(.{3,180})/i,
    /(?:hac[eé]\s+(?:un\s+)?(?:informe|reporte))\s+(?:sobre|acerca de|del|de)\s+(.{3,180})/i,
    /(?:hac[eé]\s+(?:un\s+)?(?:informe|reporte))\s+(?:sobre\s+)?(?:esa|ese|eso|este|esta|esto|la|el|lo|aquell[ao])\s+(.{3,180})/i
  ];
  let topic = null;
  for (const pattern of topicPatterns) {
    const match = clean.match(pattern);
    const t = match?.[1]?.trim().replace(/[.?!]+$/g, "");
    if (t && t.length >= 3) {
      topic = t;
      break;
    }
  }
  if (!topic) {
    topic = clean.replace(/[.?!]+$/g, "");
  }
  if (history && history.length > 0 && /\b(esa|ese|eso|este|esta|esto|la|el|lo|aquell[ao])\b/i.test(topic)) {
    const resolved = resolveCoreference(topic, history);
    if (resolved) {
      topic = resolved;
    } else {
      logger.info("explicitDeliverableTopic", "Coreference unresolved, returning null", { topic, historyLength: history.length });
      return null;
    }
  }
  return topic;
}
function resolveCoreference(topic, history) {
  const entityMatch = topic.match(/\b(pel[ií]cula|pel[ií]c|serie|libro|documental|juego|canci[oó]n|tema|persona|actor|actriz|autor|artista|equipo|partido|lugar|ciudad|pa[ií]s|empresa|app|producto)\b/i);
  const entityType = entityMatch?.[1]?.toLowerCase() ?? "";
  const recent = history.slice(-6, -1).reverse();
  for (const msg of recent) {
    if (msg.role !== "assistant" && msg.role !== "user") continue;
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    if (entityType) {
      let pattern;
      if (/(pel[ií]cula|pel[ií]c|serie|documental)/.test(entityType)) {
        pattern = /(?:pel[ií]cula|serie|documental)\s+(?:[""']([^""']+?)[""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,60}))/;
      } else if (/libro/.test(entityType)) {
        pattern = /(?:libro)\s+(?:[""']([^""']+?)[""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,60}))/;
      } else if (/(persona|actor|actriz|autor|artista)/.test(entityType)) {
        pattern = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/;
      } else {
        pattern = /([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,40})/;
      }
      const m = content.match(pattern);
      if (m) {
        const name = (m[1] ?? m[2] ?? "").trim();
        if (name && name.length >= 3) {
          return `${entityType} ${name}`;
        }
      }
    } else {
      if (msg.role === "assistant") {
        const m = content.match(/([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ\w][\wáéíóúñ]+){0,4})/);
        if (m && m[1].length >= 4) {
          return m[1].trim();
        }
      }
    }
  }
  return null;
}
var DELIVERABLE_ICONS = /* @__PURE__ */ new Set([
  "auto_awesome",
  "menu_book",
  "insights",
  "fact_check",
  "timeline",
  "castle",
  "groups",
  "strategy",
  "sports_soccer",
  "monitoring",
  "payments",
  "science",
  "public",
  "history_edu",
  "emoji_events",
  "lightbulb",
  "health_and_safety",
  "travel_explore",
  "psychology",
  "trending_up",
  "gavel",
  "eco",
  "movie",
  "music_note",
  "stadium",
  "rocket_launch",
  "school",
  "work",
  "restaurant"
]);
var DELIVERABLE_ICON_FALLBACKS = ["auto_awesome", "menu_book", "insights", "fact_check", "timeline", "category"];
function safeIcon(raw, index) {
  const icon = cleanText(raw).toLowerCase().replace(/\s+/g, "_");
  if (DELIVERABLE_ICONS.has(icon)) return icon;
  if (/^[a-z][a-z0-9_]{2,30}$/.test(icon)) return icon;
  return DELIVERABLE_ICON_FALLBACKS[index % DELIVERABLE_ICON_FALLBACKS.length];
}
function deliverableTitleFromTopic(topic) {
  const clean = topic.replace(/[.?!"]+$/g, "").trim();
  const short = clean.length > 28 ? clean.slice(0, 28).trim() + "\u2026" : clean;
  return short.toUpperCase();
}
function sanitizeSection(raw, index) {
  const title = cleanText(raw.title);
  if (!title) return null;
  const kindRaw = cleanText(raw.kind).toLowerCase();
  const kind = ["text", "bullets", "timeline", "grid", "rows"].includes(kindRaw) ? kindRaw : "text";
  const paragraphs = asArray(raw.paragraphs).map((p) => cleanText(p)).filter(Boolean).slice(0, 4);
  const bullets = asArray(raw.bullets).map((b) => cleanText(b)).filter(Boolean).slice(0, 6);
  const items = asArray(raw.items).map((it) => {
    const rec = asRecord(it);
    const itemTitle = cleanText(rec.title);
    if (!itemTitle) return null;
    return {
      title: itemTitle,
      subtitle: cleanText(rec.subtitle) || void 0,
      badge: cleanText(rec.badge) || void 0,
      icon: rec.icon ? safeIcon(rec.icon, index) : void 0
    };
  }).filter((it) => it !== null).slice(0, 8);
  if (!paragraphs.length && !bullets.length && !items.length) return null;
  return {
    icon: safeIcon(raw.icon, index),
    title,
    kicker: cleanText(raw.kicker) || void 0,
    kind,
    paragraphs: paragraphs.length ? paragraphs : void 0,
    bullets: bullets.length ? bullets : void 0,
    items: items.length ? items : void 0
  };
}
function fallbackDeliverable(topic, sources) {
  const usable = sources.filter((s) => cleanText(s.title) && cleanText(s.url)).slice(0, 8);
  const snippets = usable.map((s) => cleanText(s.snippet)).filter(Boolean);
  const first = snippets[0] || `Reun\xED ${usable.length || sources.length} fuentes para ordenar el tema sin inventar datos.`;
  const second = snippets[1] || "La s\xEDntesis autom\xE1tica no respondi\xF3 a tiempo, as\xED que te dejo un informe mec\xE1nico trazable con las fuentes encontradas.";
  const domains = Array.from(new Set(usable.map((s) => cleanText(s.domain)).filter(Boolean))).slice(0, 6);
  const sourceItems = usable.slice(0, 6).map((s) => ({
    title: cleanText(s.title).slice(0, 90),
    subtitle: cleanText(s.snippet).slice(0, 140) || cleanText(s.domain),
    badge: cleanText(s.domain).slice(0, 18) || void 0
  }));
  return {
    title: deliverableTitleFromTopic(topic),
    description: `Un mapa inicial sobre ${topic}, armado con fuentes reales aunque la s\xEDntesis profunda no haya respondido.`,
    summary: [first, second].join(" ").slice(0, 650),
    categories: [
      { icon: "travel_explore", label: "Hallazgos" },
      { icon: "fact_check", label: "Fuentes" },
      { icon: "insights", label: "Contexto" }
    ],
    metrics: usable.length > 0 ? [
      { value: String(usable.length), label: "Fuentes" },
      { value: String(domains.length), label: "Dominios" },
      { value: "4", label: "Secciones" }
    ] : [],
    sections: [
      {
        icon: "auto_awesome",
        title: "S\xEDntesis r\xE1pida",
        kicker: "PANORAMA",
        kind: "text",
        paragraphs: [
          `El pedido fue armar un informe sobre ${topic}. Koru encontr\xF3 fuentes reales y prepar\xF3 esta versi\xF3n trazable como respaldo.`,
          snippets.slice(0, 2).join(" ") || `Hay ${usable.length || sources.length} fuentes disponibles para profundizar el an\xE1lisis.`
        ]
      },
      {
        icon: "travel_explore",
        title: "Fuentes principales",
        kicker: "EVIDENCIA",
        kind: "rows",
        items: sourceItems.length ? sourceItems : [{ title: topic, subtitle: "No se pudieron resumir fuentes, pero el flujo de informe qued\xF3 armado." }]
      },
      {
        icon: "fact_check",
        title: "Lo verificable",
        kicker: "LECTURA",
        kind: "bullets",
        bullets: [
          "El informe conserva las fuentes para que cada afirmaci\xF3n importante pueda revisarse.",
          "Conviene priorizar dominios reconocibles y descartar p\xE1ginas sin contenido legible.",
          "Si la s\xEDntesis del modelo vuelve a responder, esta misma base puede convertirse en un informe narrativo m\xE1s completo.",
          "No se rellenaron cifras ni fechas que no aparezcan en las fuentes recuperadas."
        ]
      },
      {
        icon: "insights",
        title: "Pr\xF3ximo paso",
        kicker: "ACCION",
        kind: "grid",
        items: [
          { title: "Profundizar", subtitle: "Cruzar las fuentes m\xE1s s\xF3lidas y separar hechos de opini\xF3n." },
          { title: "Ordenar", subtitle: "Convertir los hallazgos en m\xF3dulos: contexto, evoluci\xF3n, estado actual e implicancias." },
          { title: "Citar", subtitle: "Mantener cada dato sensible vinculado a una fuente concreta." }
        ]
      }
    ]
  };
}
function deliverableSources(sources) {
  return sources.filter((s) => cleanText(s.title) && cleanText(s.url)).slice(0, 8).map((s) => ({
    title: cleanText(s.title),
    url: cleanText(s.url),
    domain: cleanText(s.domain) || "fuente externa",
    snippet: cleanText(s.snippet) || void 0
  }));
}
async function runDeepResearchFlow(topic, request, config2, preferredProvider, onChunk) {
  const startedAt = Date.now();
  const userName = cleanText(request.state.userName);
  const heroTitle = deliverableTitleFromTopic(topic);
  const isOllama = isOllamaUrl(config2.nvidiaBaseUrl);
  const isLargeRemoteNemotron = preferredProvider === "nvidia" && !isOllama && config2.nvidiaModel.toLowerCase().includes("nemotron-3-ultra");
  const planningTimeout = isOllama ? 9e4 : isLargeRemoteNemotron ? 9e4 : 25e3;
  const synthesisTimeout = isOllama ? 12e4 : isLargeRemoteNemotron ? 12e4 : 6e4;
  logger.info("runDeepResearchFlow", "=== DEEP RESEARCH START ===", { topic });
  const baseUnderstanding = {
    literalRequest: request.input,
    userGoal: `Informe completo sobre ${topic}`,
    unstatedNeeds: [],
    assumptions: [],
    confidence: 0.85
  };
  const emptyResponseBits = {
    suggestedActions: [],
    memoryCandidates: [],
    commitments: [],
    records: [],
    toolResults: []
  };
  const emit = (progress, phaseLabel, kind, reply) => {
    onChunk?.({
      reply,
      uiBlocks: [{
        type: "deliverable",
        status: "working",
        kicker: "Tu Informe",
        title: heroTitle,
        topic,
        progress,
        phaseLabel
      }],
      understanding: baseUnderstanding,
      ...emptyResponseBits,
      stateEvents: [{ kind, label: phaseLabel }],
      mascotState: "working",
      provider: "bluesminds",
      fallbackReason: "deep-research"
    });
  };
  emit(6, "Entendiendo el pedido\u2026", "thinking", `\xA1Buen\xEDsimo${userName ? `, ${userName}` : ""}! Me pongo a investigar ${topic} a fondo y te armo el informe.`);
  const researchNowIso = (/* @__PURE__ */ new Date()).toISOString();
  const researchTemporal = [
    `Contexto temporal: ${formatDateLong(researchNowIso)}, ${formatTimeShort(researchNowIso)} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
    `Para "actualidad reciente" prioriz\xE1 resultados del \xFAltimo mes. Para "datos" prioriz\xE1 los m\xE1s recientes verificables.`
  ].join(" ");
  let queries = [];
  try {
    const subqResult = await callProvider(config2, [
      { role: "system", content: `Sos un planificador de investigaci\xF3n. Respond\xE9s SOLO con JSON v\xE1lido, sin texto extra. ${researchTemporal}` },
      { role: "user", content: `Tema de investigaci\xF3n: "${topic}". Devolv\xE9 SOLO este JSON: {"queries":["q1","q2","q3","q4"]} con 4 b\xFAsquedas web en espa\xF1ol, cortas y distintas entre s\xED, que cubran: 1) qu\xE9 es / panorama general, 2) historia o contexto, 3) noticias y actualidad reciente, 4) datos, cifras o an\xE1lisis experto.` }
    ], planningTimeout, false, preferredProvider);
    const parsed = asRecord(JSON.parse(extractJsonBlock(cleanText(subqResult.message.content, ""))));
    queries = asArray(parsed.queries).map((q) => cleanText(q)).filter(Boolean).slice(0, 5);
  } catch (err) {
    logger.warn("runDeepResearchFlow", "Sub-query planning failed, using heuristics", { error: String(err) });
  }
  if (queries.length < 2) {
    queries = [topic, `${topic} historia`, `${topic} noticias recientes`, `${topic} datos cifras`];
  }
  const allSources = [];
  const corpus = [];
  const seenUrls = /* @__PURE__ */ new Set();
  for (let i = 0; i < queries.length; i++) {
    emit(12 + Math.round(i / queries.length * 43), `Buscando fuentes ${i + 1}/${queries.length}: ${queries[i].slice(0, 40)}\u2026`, "searching", `Estoy investigando ${topic} en la web\u2026`);
    try {
      const search = await runSearch({ query: queries[i], mode: "world" }, false);
      for (const source of search.sources) {
        if (source.url && seenUrls.has(source.url)) continue;
        if (source.url) seenUrls.add(source.url);
        allSources.push(source);
      }
      if (search.summary) corpus.push(`[B\xFAsqueda: ${queries[i]}]
${search.summary}`);
      corpus.push(...search.sources.map((s) => `\u2022 ${s.title} (${s.domain}): ${s.snippet ?? ""}`));
    } catch (err) {
      logger.warn("runDeepResearchFlow", "Search failed for query", { query: queries[i], error: String(err) });
    }
  }
  logger.info("runDeepResearchFlow", "Sources collected", { count: allSources.length, queries: queries.length });
  if (allSources.length === 0) {
    logger.warn("runDeepResearchFlow", "0 sources found \u2014 aborting with clarifying question", { topic });
    return {
      reply: `No pude encontrar informaci\xF3n sobre "${topic}". \xBFTe refer\xEDs a una pel\xEDcula, libro, persona o tema espec\xEDfico? Si me das el nombre exacto o m\xE1s contexto, lo intento de nuevo.`,
      uiBlocks: [{
        type: "clarifying_question",
        question: `No encontr\xE9 nada sobre "${topic}". \xBFPod\xE9s darme el nombre exacto o m\xE1s contexto?`,
        options: []
      }],
      toolCalls: [],
      toolResults: [],
      turnItems: [],
      mascotState: "worried",
      energyAwarded: 0,
      provider: "bluesminds"
    };
  }
  emit(62, "Comparando y cruzando fuentes\u2026", "comparing", `Encontr\xE9 ${allSources.length} fuentes. Estoy cruzando los datos\u2026`);
  let informe = fallbackDeliverable(topic, allSources);
  let provider = "bluesminds";
  let model;
  try {
    emit(78, "Redactando tu informe\u2026", "planning", "Ya tengo todo. Estoy redactando el informe\u2026");
    const synthesis = await callProvider(config2, [
      {
        role: "system",
        content: [
          "Sos Koru, redactor de informes personales. Escrib\xEDs en espa\xF1ol rioplatense, c\xE1lido pero preciso.",
          "Tu informe debe EXCEDER lo que el usuario espera: completo, con datos concretos, bien organizado.",
          "Us\xE1 EXCLUSIVAMENTE la informaci\xF3n de las fuentes provistas m\xE1s conocimiento general verificable. NUNCA inventes cifras que no puedas respaldar.",
          "Respond\xE9s SOLO con JSON v\xE1lido, sin markdown ni texto extra.",
          researchTemporal
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Arm\xE1 un informe completo sobre: "${topic}".`,
          `Estructura JSON EXACTA (respet\xE1 tipos y l\xEDmites):`,
          `{"title":"m\xE1x 28 caracteres, ser\xE1 el t\xEDtulo de la tarjeta","description":"1-2 l\xEDneas que enganchen","summary":"p\xE1rrafo de s\xEDntesis de 60-90 palabras","categories":[{"icon":"nombre_material_symbol","label":"m\xE1x 14 chars"} x3],"metrics":[{"value":"dato corto REAL de las fuentes (a\xF1o, cifra, cantidad)","label":"qu\xE9 es"} x3],"sections":[{"icon":"nombre_material_symbol","kicker":"subt\xEDtulo corto en may\xFAsculas","title":"t\xEDtulo del m\xF3dulo","kind":"text|bullets|timeline|grid|rows","paragraphs":["solo si kind=text"],"bullets":["solo si kind=bullets"],"items":[{"title":"...","subtitle":"...","badge":"opcional corto"}]} x4-5]}`,
          `Gu\xEDa de sections: 1\xBA una s\xEDntesis (kind text), despu\xE9s historia/contexto (timeline con items t\xEDtulo=a\xF1o o hito), despu\xE9s el desarrollo del tema (grid o rows), despu\xE9s actualidad/noticias (bullets o rows). Vari\xE1 los kinds.`,
          ``,
          `FUENTES (${allSources.length}):`,
          corpus.join("\n").slice(0, 9e3)
        ].join("\n")
      }
    ], synthesisTimeout, false, preferredProvider);
    provider = synthesis.provider;
    model = synthesis.model;
    const parsed = asRecord(JSON.parse(extractJsonBlock(cleanText(synthesis.message.content, ""))));
    const sections = asArray(parsed.sections).map((s, i) => sanitizeSection(asRecord(s), i)).filter((s) => s !== null).slice(0, 6);
    if (sections.length) {
      informe = {
        title: cleanText(parsed.title) ? deliverableTitleFromTopic(cleanText(parsed.title)) : heroTitle,
        description: cleanText(parsed.description) || informe.description,
        summary: cleanText(parsed.summary) || informe.summary,
        categories: asArray(parsed.categories).map((c, i) => {
          const rec = asRecord(c);
          const label = cleanText(rec.label);
          return label ? { icon: safeIcon(rec.icon, i), label: label.slice(0, 16) } : null;
        }).filter((c) => c !== null).slice(0, 3),
        metrics: asArray(parsed.metrics).map((m) => {
          const rec = asRecord(m);
          const value = cleanText(rec.value);
          const label = cleanText(rec.label);
          return value && label ? { value: value.slice(0, 12), label: label.slice(0, 18) } : null;
        }).filter((m) => m !== null).slice(0, 3),
        sections
      };
    }
  } catch (err) {
    logger.warn("runDeepResearchFlow", "Synthesis failed, delivering fallback informe", { error: String(err) });
  }
  const deliverable = {
    type: "deliverable",
    status: "ready",
    kicker: "Tu Informe",
    topic,
    progress: 100,
    ...informe,
    categories: informe.categories?.length ? informe.categories : fallbackDeliverable(topic, allSources).categories,
    sources: deliverableSources(allSources)
  };
  logger.info("runDeepResearchFlow", "=== DEEP RESEARCH DONE ===", {
    topic,
    sources: allSources.length,
    sections: deliverable.sections?.length ?? 0,
    durationMs: Date.now() - startedAt,
    provider
  });
  return {
    reply: `\xA1Listo${userName ? `, ${userName}` : ""}! \u{1F33F} Tu informe sobre ${topic} est\xE1 terminado. Lo investigu\xE9 en ${allSources.length} fuentes.`,
    uiBlocks: [deliverable],
    understanding: baseUnderstanding,
    ...emptyResponseBits,
    memoryCandidates: [{
      kind: "preference",
      text: `Le interesa ${topic} (pidi\xF3 un informe el ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}).`,
      confidence: 0.6,
      sensitivity: "normal",
      status: "candidate"
    }],
    stateEvents: [{ kind: "done", label: "Informe entregado" }],
    mascotState: "celebrating",
    provider,
    model,
    fallbackReason: "deep-research"
  };
}
function resolveFollowUpInput(input, history) {
  const trimmed = input.trim().toLowerCase();
  const followUpPatterns = [
    /^y\s+(ayer|mañana|manana|anteayer|pasado mañana|pasado manana|el otro|el sabado|el sabado pasado|el domingo|el lunes|el martes|el miercoles|el jueves|el viernes)\??$/i,
    /^y\s+(la anterior|el anterior|la proxima|el proximo|el ultimo|la ultima)\??$/i,
    /^y\s+(con|de|para|sin)\s+(.{1,40})\??$/i,
    /^(como le fue|como le va|como salio|como salio|que tal)\s+(ayer|anteayer|el sabado|el domingo)\??$/i
  ];
  const isFollowUp = followUpPatterns.some((p) => p.test(trimmed));
  if (!isFollowUp) return input;
  const recent = history.slice(-6).reverse();
  let team = null;
  let movie = null;
  let recipe = null;
  let book = null;
  let lastUserMessage = null;
  for (const msg of recent) {
    if (msg.role !== "user") continue;
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    if (!lastUserMessage) lastUserMessage = content;
    if (!team) {
      const teamMatch = content.match(/\b(argentina|espana|españa|brasil|francia|alemania|inglaterra|italia|portugal|holanda|belgica|bélgica|uruguay|chile|colombia|mexico|méxico|peru|perú|ecuador|paraguay|boca|river|real madrid|barcelona|barca|atletico madrid|atlético madrid|liverpool|manchester city|manchester united|chelsea|arsenal|tottenham|juventus|inter|milan|ac milan|bayern munich|dortmund|psg|napoli|roma|lazio|sevilla|valencia|villarreal|real sociedad|betis|athletic bilbao)\b/i);
      if (teamMatch) team = teamMatch[1];
    }
    if (!movie) {
      const movieMatch = content.match(/(?:pelicula|película|serie|documental)\s+(?:["""']([^"""']+?)["""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,40}))/i);
      if (movieMatch) movie = movieMatch[1] ?? movieMatch[2];
    }
    if (!recipe) {
      const recipeMatch = content.match(/(?:receta|comida|plato|preparar|hacer|cocinar)\s+(?:de\s+|un\s+|una\s+)?([^?.,]{3,40})/i);
      if (recipeMatch) recipe = recipeMatch[1].trim();
    }
    if (!book) {
      const bookMatch = content.match(/(?:libro|novela)\s+(?:["""']([^"""']+?)["""']|([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s]{2,40}))/i);
      if (bookMatch) book = bookMatch[1] ?? bookMatch[2];
    }
  }
  if (/^(y\s+)?(ayer|mañana|manana|anteayer|pasado)/i.test(trimmed)) {
    if (team) {
      const temporalMatch = trimmed.match(/(ayer|mañana|manana|anteayer|pasado mañana|pasado manana)/i);
      const temporal = temporalMatch?.[1] ?? "ayer";
      return `como salio ${team} ${temporal}?`;
    }
    if (movie) {
      return `informacion sobre la pelicula ${movie}`;
    }
  }
  if (/^(y\s+)?(la|el)\s+(anterior|ultimo|ultima|proxima|proximo)/i.test(trimmed)) {
    if (movie) return `pelicula anterior a ${movie}`;
    if (book) return `libro anterior a ${book}`;
    if (team) return `partido anterior de ${team}`;
  }
  if (/^y\s+(con|de|para|sin)\s+/i.test(trimmed)) {
    const variation = input.trim().replace(/^y\s+/i, "").replace(/[?!.]$/, "");
    const termMatch = variation.match(/(?:de|con|para|sin)\s+(.+)/i);
    const term = termMatch?.[1]?.trim() ?? variation;
    if (movie) {
      return `que se dice de la pelicula ${term}?`;
    }
    if (book) {
      return `informacion del libro ${term}`;
    }
    if (recipe) {
      return `receta de ${recipe} ${variation}`;
    }
    if (term.length >= 2) {
      return `que se dice de la pelicula ${term}?`;
    }
  }
  return input;
}
function fastPathKickerForCategory(category) {
  const kickerMap = {
    sports: "Tu Partido",
    weather: "Tu Clima",
    food: "Tu Receta",
    media: "Tu Rese\xF1a",
    knowledge: "Tu Consulta",
    world_info: "Tu B\xFAsqueda",
    review: "Tu An\xE1lisis",
    shopping: "Tu Comparativa",
    market: "Tu Cotizaci\xF3n",
    travel: "Tu Viaje",
    research: "Tu Informe",
    planning: "Tu Plan",
    action: "Tu Recordatorio"
  };
  return kickerMap[category] ?? "Tu Consulta";
}
async function runKoruBackendTurn(request, config2, onChunk) {
  const preferredProvider = inferProviderFromModel(request.model);
  if (request.model) {
    config2 = { ...config2, nvidiaModel: request.model };
  }
  logger.info("runKoruBackendTurn", "=== START TURN ===", { input: request.input.slice(0, 200), model: config2.nvidiaModel, preferredProvider });
  const messages = buildMessages(request);
  const toolExecutions = [];
  let provider = "nvidia";
  let model;
  let fallbackReason;
  const isOllama = isOllamaUrl(config2.nvidiaBaseUrl);
  const isLargeRemoteNemotron = preferredProvider === "nvidia" && !isOllama && config2.nvidiaModel.toLowerCase().includes("nemotron-3-ultra");
  const firstTimeout = isOllama ? 9e4 : isLargeRemoteNemotron ? 45e3 : 3e4;
  const secondaryTimeout = isOllama ? 12e4 : isLargeRemoteNemotron ? 6e4 : 3e4;
  const extractorTimeout = isOllama ? 9e4 : isLargeRemoteNemotron ? 45e3 : 3e4;
  let routeCategory;
  const resolvedInput = resolveFollowUpInput(request.input, request.history);
  if (resolvedInput !== request.input) {
    logger.info("runKoruBackendTurn", "Follow-up resolved", {
      original: request.input,
      resolved: resolvedInput
    });
    request = { ...request, input: resolvedInput };
  }
  const inputTrimmed = request.input.trim();
  const trivial = isTrivialInput(inputTrimmed);
  const modelOverride = request.model ? request.model : selectModelForInput(inputTrimmed, config2, trivial, false);
  const deliverableTopic = explicitDeliverableTopic(inputTrimmed, request.history);
  if (deliverableTopic) {
    logger.info("runKoruBackendTurn", "Explicit deliverable request detected", { topic: deliverableTopic });
    return await runDeepResearchFlow(deliverableTopic, request, config2, preferredProvider, onChunk);
  }
  if (trivial) {
    logger.info("runKoruBackendTurn", "Trivial input \u2014 fast path (skip router + memory extractor)");
    const fastResult = await callProvider(config2, messages, 3e4, false, preferredProvider, void 0, modelOverride);
    provider = fastResult.provider;
    model = fastResult.model;
    const fastContent = cleanText(fastResult.message.content, "");
    let fastParsed;
    try {
      fastParsed = JSON.parse(extractJsonBlock(fastContent));
    } catch {
      fastParsed = { reply: cleanReplyText(fastContent) || "Hola. \xBFC\xF3mo va todo?", mascotState: "happy" };
    }
    const fastResponse = normalizeFinalPayload(fastParsed, request.input, []);
    logger.info("runKoruBackendTurn", "Return fast-path", { replyPreview: (fastResponse.reply ?? "").slice(0, 60), provider, model });
    return {
      ...fastResponse,
      provider,
      model,
      fallbackReason: "trivial-fast-path",
      mascotState: fastParsed.mascotState ?? "happy"
    };
  }
  if (inputTrimmed.length >= 3) {
    const fastPathResult = keywordFastPath(request.input);
    if (fastPathResult?.tool === "save_personal_item") {
      const lastUserMessage = [...request.history ?? []].reverse().find((m) => m.role === "user");
      const inferredTitle = lastUserMessage?.content || cleanText(fastPathResult.toolArgs?.title);
      if (inferredTitle && inferredTitle.length > 3 && inferredTitle !== "Informe guardado") {
        fastPathResult.toolArgs = {
          ...fastPathResult.toolArgs,
          title: inferredTitle.slice(0, 100)
        };
      }
    }
    if (fastPathResult) {
      logger.info("runKoruBackendTurn", "Keyword fast-path match (minimal)", {
        category: fastPathResult.category,
        tool: fastPathResult.tool ?? "none",
        confidence: fastPathResult.confidence.toFixed(2)
      });
      routeCategory = fastPathResult.category;
      const route = fastPathResult;
      if (route.tool === "deep_research") {
        const topic = cleanText(route.toolArgs?.topic) || cleanText(route.toolArgs?.query) || inputTrimmed;
        return await runDeepResearchFlow(topic, request, config2, preferredProvider, onChunk);
      }
      if (route.tool) {
        const syntheticToolCall = {
          id: `fastpath_${Date.now()}`,
          type: "function",
          function: { name: route.tool, arguments: JSON.stringify(route.toolArgs ?? {}) }
        };
        const query = route.tool === "web_search" ? cleanText(route.toolArgs?.query) : void 0;
        const shortSearchLabel = query ? searchLabelFromInput(query) : "Buscando...";
        const taskKicker = fastPathKickerForCategory(route.category);
        onChunk?.({
          reply: shortSearchLabel,
          uiBlocks: [{
            type: "deliverable",
            status: "working",
            kicker: taskKicker,
            title: taskKicker,
            topic: request.input,
            progress: 15,
            phaseLabel: shortSearchLabel
          }],
          suggestedActions: [],
          understanding: { literalRequest: request.input, userGoal: route.category, unstatedNeeds: [], assumptions: [], confidence: route.confidence },
          memoryCandidates: [],
          commitments: [],
          records: [],
          toolResults: [],
          stateEvents: [{ kind: "thinking", label: shortSearchLabel }],
          mascotState: "working",
          provider,
          model,
          fallbackReason: "fastpath-" + route.category
        });
        const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config2);
        const LOCAL_ACTION_TOOLS = /* @__PURE__ */ new Set([
          "reminder_set",
          "alarm_set",
          "countdown",
          "save_personal_item",
          "save_memory",
          "plan_day",
          "query_personal_context",
          "note_write",
          "calendar_add"
        ]);
        if (delivered && toolExecutions.length > 0) {
          const lastTool = toolExecutions[toolExecutions.length - 1];
          const lastResult = lastTool?.result;
          const isLocalAction = LOCAL_ACTION_TOOLS.has(route.tool ?? "");
          const toolFailed = !isLocalAction && (lastResult?.status === "failed" || lastResult?.status === "no_data" || lastResult?.status === "need_city" || lastResult?.status === "not_configured" || lastResult?.status === "ok" && !lastResult?.text && !lastResult?.matches?.length && !lastResult?.recipes?.length && !lastResult?.now && !lastResult?.price && !lastResult?.overview && !lastResult?.extract && !lastResult?.block && !lastResult?.commitments?.length && !lastResult?.records?.length && !lastResult?.items?.length && !lastResult?.note && !lastResult?.result);
          if (toolFailed && route.tool !== "web_search") {
            logger.info("runKoruBackendTurn", "Fast-path tool failed or empty, falling back to web_search", {
              failedTool: route.tool,
              status: lastResult?.status,
              error: lastResult?.error ?? lastResult?.note ?? "no data"
            });
            const fallbackQuery = route.toolArgs?.title || route.toolArgs?.query || route.toolArgs?.city || request.input;
            const fallbackToolCall = {
              id: `fallback_search_${Date.now()}`,
              type: "function",
              function: { name: "web_search", arguments: JSON.stringify({ query: fallbackQuery, mode: "research" }) }
            };
            const searchLabel = searchLabelFromInput(String(fallbackQuery));
            onChunk?.({
              reply: searchLabel,
              uiBlocks: [{ type: "deliverable", status: "working", kicker: "Tu B\xFAsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
              suggestedActions: [],
              understanding: { literalRequest: request.input, userGoal: "web_search fallback", unstatedNeeds: [], assumptions: [], confidence: 0.9 },
              memoryCandidates: [],
              commitments: [],
              records: [],
              toolResults: [],
              stateEvents: [{ kind: "searching", label: searchLabel }],
              mascotState: "working",
              provider,
              model,
              fallbackReason: "fastpath-fallback-search"
            });
            const fallbackDelivered = await executeProviderToolCalls([fallbackToolCall], messages, request, toolExecutions, config2);
            if (fallbackDelivered) {
              const cleanedExecutions = toolExecutions.filter((exec) => {
                const r = exec.result;
                const isLocalAction2 = LOCAL_ACTION_TOOLS.has(exec.name);
                const failed = !isLocalAction2 && (r?.status === "failed" || r?.status === "no_data" || r?.status === "need_city" || r?.status === "not_configured" || r?.status === "ok" && !r?.text && !r?.matches?.length && !r?.recipes?.length && !r?.now && !r?.price && !r?.overview && !r?.extract && !r?.block && !r?.commitments?.length && !r?.records?.length && !r?.items?.length && !r?.note && !r?.result);
                return !failed;
              });
              const effectiveExecutions = cleanedExecutions.length > 0 ? cleanedExecutions : toolExecutions;
              const fastConfig2 = { ...config2, nvidiaModel: config2.nvidiaModel };
              const response2 = await finalizePayloadWithFastModel(request, fastConfig2, fallbackDelivered, effectiveExecutions, 3e4);
              return { ...response2, provider, model, fallbackReason: "fastpath-fallback-search" };
            }
          }
        }
        if (delivered) {
          const fastConfig = { ...config2, nvidiaModel: config2.nvidiaModel };
          const toolBlocks = blocksFromToolResults(toolExecutions);
          const blockReply = replyFromBlocks(toolBlocks, request.input);
          const taskKicker2 = fastPathKickerForCategory(route.category);
          const effectiveReply = blockReply || (toolBlocks.length > 0 ? `Te dej\xE9 ${taskKicker2.toLowerCase()} en la tarjeta.` : cleanText(delivered.reply) || "Listo.");
          const overridden = { ...delivered, reply: effectiveReply, uiBlocks: [] };
          let response2;
          try {
            const extracted = await extractMemoryWithJsonPrompt(request, fastConfig, toolExecutions, overridden, 15e3);
            response2 = normalizeFinalPayload(overridden, request.input, toolExecutions, extracted.raw);
          } catch {
            response2 = normalizeFinalPayload(overridden, request.input, toolExecutions);
          }
          return { ...response2, provider, model, fallbackReason: "fastpath-" + route.category };
        }
      }
    }
    if (toolExecutions.length > 0) {
      logger.info("runKoruBackendTurn", "Fast-path executed tools, skipping semantic router", {
        toolCount: toolExecutions.length
      });
      const fastConfig = { ...config2, nvidiaModel: config2.nvidiaModel };
      const toolBlocks = blocksFromToolResults(toolExecutions);
      const blockReply = replyFromBlocks(toolBlocks, request.input);
      const taskKicker = fastPathKickerForCategory(routeCategory ?? "conversation");
      const effectiveReply = blockReply || `Te dej\xE9 ${taskKicker.toLowerCase()} en la tarjeta.`;
      let response2;
      try {
        const extracted = await extractMemoryWithJsonPrompt(request, fastConfig, toolExecutions, { reply: effectiveReply, uiBlocks: [] }, 15e3);
        response2 = normalizeFinalPayload({ reply: effectiveReply, mascotState: "happy", uiBlocks: [] }, request.input, toolExecutions, extracted.raw);
      } catch {
        response2 = normalizeFinalPayload({ reply: effectiveReply, mascotState: "happy", uiBlocks: [] }, request.input, toolExecutions);
      }
      return { ...response2, provider, model, fallbackReason: "fastpath-skip-router" };
    }
    const router = await getRouter(config2);
    if (router) {
      try {
        const routeStart = Date.now();
        const route = await router.route(request.input);
        routeCategory = route.category;
        logger.info("runKoruBackendTurn", "Semantic Router decision", {
          category: route.category,
          tool: route.tool ?? "none",
          confidence: route.confidence.toFixed(2),
          durationMs: Date.now() - routeStart
        });
        const WEB_SEARCH_AUTOFIRE_CONFIDENCE = 0.78;
        const shouldAutofire = route.tool !== "web_search" || route.confidence >= WEB_SEARCH_AUTOFIRE_CONFIDENCE;
        if (route.tool && !shouldAutofire) {
          logger.info("runKoruBackendTurn", "web_search bajo el umbral extra, cae a flujo nativo", {
            confidence: route.confidence.toFixed(2),
            required: WEB_SEARCH_AUTOFIRE_CONFIDENCE
          });
        }
        if (route.tool === "deep_research") {
          const topic = cleanText(route.toolArgs?.topic) || cleanText(route.toolArgs?.query) || inputTrimmed;
          return await runDeepResearchFlow(topic, request, config2, preferredProvider, onChunk);
        }
        if (route.tool && shouldAutofire) {
          const syntheticToolCall = {
            id: `route_${Date.now()}`,
            type: "function",
            function: { name: route.tool, arguments: JSON.stringify(route.toolArgs ?? {}) }
          };
          const query = route.tool === "web_search" ? cleanText(route.toolArgs?.query) : void 0;
          const shortSearchLabel = query ? searchLabelFromInput(query) : "Buscando en la web";
          onChunk?.({
            reply: shortSearchLabel,
            uiBlocks: [{ type: "deliverable", status: "working", kicker: "Tu B\xFAsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
            suggestedActions: [],
            understanding: { literalRequest: request.input, userGoal: route.category, unstatedNeeds: [], assumptions: [], confidence: route.confidence },
            memoryCandidates: [],
            commitments: [],
            records: [],
            toolResults: [],
            stateEvents: [{ kind: "searching", label: shortSearchLabel }],
            mascotState: "working",
            provider,
            model,
            fallbackReason: "router-" + route.category
          });
          messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
          const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config2);
          if (delivered) {
            const synthConfig2 = { ...config2, nvidiaModel: config2.nvidiaModel };
            const synthMessages2 = buildMessages(request);
            for (const exec of toolExecutions) {
              synthMessages2.push({
                role: "assistant",
                content: "",
                tool_calls: [{
                  id: exec.id || `call_${Date.now()}`,
                  type: "function",
                  function: { name: exec.name, arguments: "{}" }
                }]
              });
              synthMessages2.push({
                role: "tool",
                content: JSON.stringify(exec.result).slice(0, 3e3),
                tool_call_id: exec.id || `call_${Date.now()}`
              });
            }
            synthMessages2.push({
              role: "user",
              content: [
                "REGLA ABSOLUTA: Solo respond\xE9 con JSON puro v\xE1lido. Sin markdown, sin backticks.",
                "Respond\xE9 SOLO con este JSON:",
                '{"reply":"1-2 lineas cortas","mascotState":"happy","summary":"sintesis de 60-120 palabras con datos concretos","sections":[{"title":"Sintesis","kind":"text","paragraphs":["texto redactado"]},{"title":"Datos clave","kind":"bullets","bullets":["dato 1","dato 2"]}]}',
                "Reglas:",
                "- reply: SOLO enmarca. Ej: 'Te dej\xE9 el detalle en la tarjeta.'",
                "- summary: REDACTA una sintesis con datos concretos (nombres, cifras, fechas). NO copies snippets.",
                "- sections: arma 2-3 secciones. kind puede ser 'text' (con paragraphs) o 'bullets' (con bullets).",
                "- NO inventes datos que no esten en las tools."
              ].join("\n")
            });
            let routerSynthReply = "";
            let routerSynthMascot = "happy";
            let routerSynthSummary = "";
            let routerSynthSections = [];
            try {
              const synthResult2 = await callProvider(synthConfig2, synthMessages2, 3e4, false, void 0, void 0, synthConfig2.nvidiaModel);
              const synthContent2 = cleanText(synthResult2.message.content, "");
              const synthParsed2 = safeJsonObjectFromContent(synthContent2);
              routerSynthReply = cleanReplyText(synthParsed2.reply || "");
              routerSynthMascot = cleanText(synthParsed2.mascotState) || "happy";
              routerSynthSummary = cleanText(synthParsed2.summary || "");
              const rawSections2 = Array.isArray(synthParsed2.sections) ? synthParsed2.sections : [];
              routerSynthSections = rawSections2.map((s, i) => ({
                icon: i === 0 ? "auto_awesome" : i === 1 ? "fact_check" : "insights",
                title: cleanText(s.title) || `Secci\xF3n ${i + 1}`,
                kicker: i === 0 ? "LO ESENCIAL" : i === 1 ? "DATOS" : "CONTEXTO",
                kind: s.kind === "bullets" ? "bullets" : "text",
                paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map((p) => String(p)) : void 0,
                bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b)) : void 0
              })).filter((s) => s.paragraphs?.length || s.bullets?.length);
            } catch (err) {
              logger.warn("runKoruBackendTurn", "Router synth LLM call failed", { error: err?.message });
            }
            logger.info("runKoruBackendTurn", "Router synth result", {
              hasReply: !!routerSynthReply,
              replyLen: routerSynthReply.length,
              hasSummary: !!routerSynthSummary,
              summaryLen: routerSynthSummary.length,
              sectionsCount: routerSynthSections.length,
              effectiveSummaryLen: (routerSynthSummary || (routerSynthReply.length > 20 ? routerSynthReply : "")).length
            });
            let effectiveSummary2 = routerSynthSummary || (routerSynthReply.length > 20 ? routerSynthReply : "");
            const response3 = await finalizePayloadWithFastModel(
              request,
              synthConfig2,
              { reply: routerSynthReply, mascotState: routerSynthMascot, uiBlocks: [] },
              toolExecutions,
              3e4
            );
            if (!effectiveSummary2 || effectiveSummary2.length < 20) {
              if (response3.reply && response3.reply.length > 60) {
                effectiveSummary2 = response3.reply;
              } else {
                effectiveSummary2 = "";
              }
            }
            logger.info("runKoruBackendTurn", "Router effectiveSummary2 final", {
              len: effectiveSummary2.length,
              preview: effectiveSummary2.slice(0, 100)
            });
            if (response3.uiBlocks) {
              for (const block of response3.uiBlocks) {
                if (block.type === "deliverable") {
                  if (effectiveSummary2 && effectiveSummary2.length > 20) {
                    logger.info("runKoruBackendTurn", "APPLYING effectiveSummary2 to deliverable", {
                      summaryLen: effectiveSummary2.length,
                      summaryPreview: effectiveSummary2.slice(0, 80)
                    });
                    block.summary = effectiveSummary2;
                    const synthSection = (block.sections ?? []).find((s) => s.title === "S\xEDntesis");
                    if (synthSection && synthSection.kind === "text") {
                      synthSection.paragraphs = [effectiveSummary2];
                    }
                  }
                  if (routerSynthSections.length > 0) {
                    const sourceSection = (block.sections ?? []).find((s) => s.title === "Fuentes");
                    block.sections = routerSynthSections;
                    if (sourceSection) block.sections.push(sourceSection);
                    block.metrics = [
                      { value: String((block.sources ?? []).length), label: "Fuentes" },
                      { value: String(routerSynthSections.length), label: "Secciones" }
                    ];
                  }
                }
              }
            }
            return { ...response3, provider, model, fallbackReason: "router-" + route.category };
          }
          messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respond\xE9 con JSON puro v\xE1lido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
          const fastConfig2 = { ...config2, nvidiaModel: config2.nvidiaFastModel || "meta/llama-3.1-8b-instruct" };
          const secondResult = await callProvider(fastConfig2, messages, 3e4, false, "nvidia", void 0, fastConfig2.nvidiaModel);
          provider = secondResult.provider;
          model = secondResult.model ?? model;
          const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");
          let parsedRoute;
          try {
            parsedRoute = JSON.parse(extractJsonBlock(secondContent));
          } catch {
            const rawFallback = {
              reply: cleanReplyText(secondContent) || "No pude armar una respuesta clara. \xBFMe lo repet\xEDs de otra forma?",
              understanding: { literalRequest: request.input, userGoal: route.category, unstatedNeeds: [], assumptions: [], confidence: 0.45 },
              uiBlocks: blocksFromToolResults(toolExecutions),
              suggestedActions: [],
              memoryCandidates: [],
              commitments: [],
              records: [],
              mascotState: "thinking"
            };
            const response3 = await finalizeFromPlainText(rawFallback, [syntheticToolCall], request, config2, toolExecutions, extractorTimeout);
            if (response3.uiBlocks) {
              for (const block of response3.uiBlocks) {
                if (block.type === "deliverable") {
                  const replyForSummary = cleanText(rawFallback.reply) || response3.reply || "";
                  if (replyForSummary && replyForSummary.length > 20) {
                    block.summary = replyForSummary;
                    const synthSection = (block.sections ?? []).find((s) => s.title === "S\xEDntesis");
                    if (synthSection && synthSection.kind === "text") {
                      synthSection.paragraphs = [replyForSummary];
                    }
                  }
                }
              }
            }
            return { ...response3, provider, model, fallbackReason: "router-" + route.category + "-invalid-json" };
          }
          const rawRoute = {
            reply: cleanText(parsedRoute.reply, secondContent),
            understanding: parsedRoute.understanding || {},
            uiBlocks: asArray(parsedRoute.uiBlocks || []),
            suggestedActions: asArray(parsedRoute.suggestedActions || []),
            memoryCandidates: asArray(parsedRoute.memoryCandidates || []),
            commitments: asArray(parsedRoute.commitments || []),
            records: asArray(parsedRoute.records || []),
            mascotState: parsedRoute.mascotState
          };
          const response2 = normalizeFinalPayload(rawRoute, request.input, toolExecutions);
          if (response2.uiBlocks) {
            for (const block of response2.uiBlocks) {
              if (block.type === "deliverable") {
                const replyForSummary = cleanText(rawRoute.reply) || response2.reply || "";
                if (replyForSummary && replyForSummary.length > 20) {
                  block.summary = replyForSummary;
                  const synthSection = (block.sections ?? []).find((s) => s.title === "S\xEDntesis");
                  if (synthSection && synthSection.kind === "text") {
                    synthSection.paragraphs = [replyForSummary];
                  }
                }
              }
            }
          }
          return { ...response2, provider, model, fallbackReason: "router-" + route.category };
        }
      } catch (err) {
        logger.warn("runKoruBackendTurn", "Semantic Router failed (non-fatal, falling to native)", { reason: err?.message });
      }
    }
  }
  const categoryToolNames = routeCategory ? CATEGORY_TOOLS[routeCategory] : void 0;
  const filteredTools = categoryToolNames && categoryToolNames.length > 0 ? ALL_TOOL_DEFINITIONS2.filter((t) => categoryToolNames.includes(t.function.name)) : void 0;
  let firstResult;
  try {
    firstResult = await callProvider(config2, messages, firstTimeout, !trivial, preferredProvider, filteredTools, modelOverride);
  } catch (err) {
    logger.error("runKoruBackendTurn", "callProvider failed with tools", { error: err.message });
    if (err instanceof RateLimitError) {
      return { reply: err.message, uiBlocks: [], suggestedActions: [], understanding: { literalRequest: request.input, userGoal: "Rate limit", unstatedNeeds: [], assumptions: [], confidence: 0 }, memoryCandidates: [], commitments: [], records: [], toolResults: [], stateEvents: [], mascotState: "tired", provider: "openrouter", model: "rate-limited", fallbackReason: "rate-limit" };
    }
    firstResult = await callProvider(config2, messages, secondaryTimeout, false, preferredProvider, void 0, modelOverride);
    fallbackReason = (fallbackReason ? fallbackReason + " + " : "") + "no-tools-fallback";
  }
  provider = firstResult.provider;
  model = firstResult.model;
  logger.info("runKoruBackendTurn", "Provider responded", { provider, model, hasTools: (firstResult.message?.tool_calls?.length ?? 0) > 0 });
  fallbackReason = firstResult.fallbackReason;
  const firstMessage = firstResult.message;
  const toolCalls = asArray(firstMessage.tool_calls);
  if (toolCalls.length > 0) {
    const query = toolCalls.find((t) => t.function?.name === "web_search")?.function?.arguments ? JSON.parse(toolCalls.find((t) => t.function?.name === "web_search").function.arguments).query : void 0;
    const loadingChunk = {
      reply: query ? `Buscando "${query}"...` : "Buscando en la web...",
      uiBlocks: [{ type: "deliverable", status: "working", kicker: "Tu B\xFAsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
      suggestedActions: [],
      understanding: { literalRequest: request.input, userGoal: "B\xFAsqueda web", unstatedNeeds: [], assumptions: [], confidence: 0.8 },
      memoryCandidates: [],
      commitments: [],
      records: [],
      toolResults: [],
      stateEvents: [{ kind: "searching", label: query ? `Buscando "${query}"` : "Buscando en la web" }],
      mascotState: "working",
      provider,
      model,
      fallbackReason
    };
    onChunk?.(loadingChunk);
    messages.push({ role: "assistant", content: "", tool_calls: toolCalls });
    const delivered = await executeProviderToolCalls(toolCalls, messages, request, toolExecutions, config2);
    if (delivered) {
      const response3 = await finalizePayload(request, config2, delivered, toolExecutions, extractorTimeout);
      return { ...response3, provider, model, fallbackReason: fallbackReason ?? response3.memoryFallbackReason };
    }
    if (onChunk && toolExecutions.length > 0) {
      const intermediateBlocks = blocksFromToolResults(toolExecutions).map((b) => {
        if (b.type === "web_nav") return null;
        return b;
      });
      logger.info("runKoruBackendTurn", "Emit intermediate chunk", { blockCount: intermediateBlocks.length });
      onChunk({
        reply: query ? `Buscando "${query}"...` : "Buscando...",
        uiBlocks: intermediateBlocks,
        suggestedActions: [],
        understanding: { literalRequest: request.input, userGoal: query ? "B\xFAsqueda web" : request.input, unstatedNeeds: [], assumptions: [], confidence: 0.8 },
        memoryCandidates: [],
        commitments: [],
        records: [],
        toolResults: [],
        stateEvents: [{ kind: "searching", label: query ? `Buscando "${query}"` : "Buscando..." }],
        mascotState: "working",
        provider,
        model,
        fallbackReason
      });
    }
    messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respond\xE9 con JSON puro v\xE1lido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
    const deferredCards = toolExecutions.__deferredDataCards ?? [];
    const [secondResult, ...resolvedCards] = await Promise.all([
      callProvider(config2, messages, secondaryTimeout, false, preferredProvider, void 0, modelOverride),
      ...deferredCards
    ]);
    provider = secondResult.provider;
    model = secondResult.model ?? model;
    const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");
    logger.info("runKoruBackendTurn", "Parsing second response JSON", { secondContentPreview: secondContent.slice(0, 500) });
    const validDeferredCards = resolvedCards.filter((b) => b !== null);
    let parsed2;
    try {
      parsed2 = JSON.parse(extractJsonBlock(secondContent));
    } catch (err) {
      logger.warn("runKoruBackendTurn", "Second response JSON parse failed", { error: String(err), secondContentPreview: secondContent.slice(0, 500) });
      const rawFallback = {
        reply: cleanReplyText(secondContent) || "No pude armar una respuesta clara. \xBFMe lo repet\xEDs de otra forma?",
        understanding: {
          literalRequest: request.input,
          userGoal: "Resolver el pedido con ayuda de Koru.",
          unstatedNeeds: [],
          assumptions: [],
          confidence: 0.45
        },
        uiBlocks: [...validDeferredCards, ...blocksFromToolResults(toolExecutions)],
        suggestedActions: [],
        memoryCandidates: [],
        commitments: [],
        records: [],
        mascotState: "thinking"
      };
      const response3 = await finalizeFromPlainText(rawFallback, toolCalls, request, config2, toolExecutions, extractorTimeout);
      logger.info("runKoruBackendTurn", "Return second-call-invalid-json", { replyPreview: (response3.reply ?? "").slice(0, 300), provider, model, fallbackReason });
      return { ...response3, provider, model, fallbackReason: fallbackReason ?? "second-call-invalid-json" };
    }
    const raw2 = {
      reply: cleanText(parsed2.reply, secondContent),
      understanding: parsed2.understanding || {},
      uiBlocks: asArray(parsed2.uiBlocks || []),
      suggestedActions: asArray(parsed2.suggestedActions || []),
      memoryCandidates: asArray(parsed2.memoryCandidates || []),
      commitments: asArray(parsed2.commitments || []),
      records: asArray(parsed2.records || []),
      mascotState: parsed2.mascotState
    };
    const cityAction2 = cityMemorySuggestion(toolCalls, request.state);
    if (cityAction2) raw2.suggestedActions = [...asArray(raw2.suggestedActions), cityAction2];
    if (cityAction2?.payload?.city) {
      const cityName = String(cityAction2.payload.city);
      raw2.memoryCandidates = [...asArray(raw2.memoryCandidates), {
        kind: "profile",
        text: `User location: ${cityName} (city)`,
        confidence: 0.8,
        sensitivity: "normal",
        status: "candidate",
        useForSuggestions: true
      }];
    }
    if (validDeferredCards.length > 0) {
      raw2.uiBlocks = [...validDeferredCards, ...asArray(raw2.uiBlocks)];
    }
    const response2 = await finalizePayload(request, config2, raw2, toolExecutions, extractorTimeout);
    return {
      ...response2,
      provider,
      model,
      fallbackReason: fallbackReason ?? response2.memoryFallbackReason ?? "after-tools"
    };
  }
  const content = cleanText(firstMessage.content, "No pude componer una respuesta util.");
  const simulatedCall = detectSimulatedToolCall(content);
  if (simulatedCall) {
    logger.info("runKoruBackendTurn", "Simulated tool-call detected", {
      tool: simulatedCall.name,
      format: simulatedCall.format,
      argsKeys: Object.keys(simulatedCall.arguments)
    });
    const syntheticToolCall = {
      id: `sim_${Date.now()}`,
      type: "function",
      function: {
        name: simulatedCall.name,
        arguments: JSON.stringify(simulatedCall.arguments)
      }
    };
    const query = simulatedCall.name === "web_search" ? cleanText(simulatedCall.arguments.query) : void 0;
    onChunk?.({
      reply: query ? `Buscando "${query}"...` : "Buscando en la web...",
      uiBlocks: [{ type: "deliverable", status: "working", kicker: "Tu B\xFAsqueda", title: "Buscando", topic: query || request.input, progress: 15, phaseLabel: "Buscando..." }],
      suggestedActions: [],
      understanding: { literalRequest: request.input, userGoal: query ? "B\xFAsqueda web" : request.input, unstatedNeeds: [], assumptions: [], confidence: 0.8 },
      memoryCandidates: [],
      commitments: [],
      records: [],
      toolResults: [],
      stateEvents: [{ kind: "searching", label: query ? `Buscando "${query}"` : "Buscando en la web" }],
      mascotState: "working",
      provider,
      model,
      fallbackReason
    });
    messages.push({ role: "assistant", content: "", tool_calls: [syntheticToolCall] });
    const delivered = await executeProviderToolCalls([syntheticToolCall], messages, request, toolExecutions, config2);
    if (delivered) {
      const response3 = await finalizePayload(request, config2, delivered, toolExecutions, extractorTimeout);
      return { ...response3, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool" };
    }
    messages.push({ role: "user", content: "REGLA ABSOLUTA: Solo respond\xE9 con JSON puro v\xE1lido. Sin markdown, sin backticks, sin texto introductorio, sin explicaciones. El JSON debe empezar con { y terminar con }." });
    const secondResult = await callProvider(config2, messages, secondaryTimeout, false, preferredProvider, void 0, modelOverride);
    provider = secondResult.provider;
    model = secondResult.model ?? model;
    const secondContent = cleanText(secondResult.message.content, "No pude componer una respuesta util.");
    let parsedSim;
    try {
      parsedSim = JSON.parse(extractJsonBlock(secondContent));
    } catch {
      const rawFallback = {
        reply: cleanReplyText(secondContent) || "No pude armar una respuesta clara. \xBFMe lo repet\xEDs de otra forma?",
        understanding: { literalRequest: request.input, userGoal: "Resolver el pedido con ayuda de Koru.", unstatedNeeds: [], assumptions: [], confidence: 0.45 },
        uiBlocks: blocksFromToolResults(toolExecutions),
        suggestedActions: [],
        memoryCandidates: [],
        commitments: [],
        records: [],
        mascotState: "thinking"
      };
      const response3 = await finalizeFromPlainText(rawFallback, [syntheticToolCall], request, config2, toolExecutions, extractorTimeout);
      return { ...response3, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool-invalid-json" };
    }
    const rawSim = {
      reply: cleanText(parsedSim.reply, secondContent),
      understanding: parsedSim.understanding || {},
      uiBlocks: asArray(parsedSim.uiBlocks || []),
      suggestedActions: asArray(parsedSim.suggestedActions || []),
      memoryCandidates: asArray(parsedSim.memoryCandidates || []),
      commitments: asArray(parsedSim.commitments || []),
      records: asArray(parsedSim.records || []),
      mascotState: parsedSim.mascotState
    };
    const response2 = await finalizePayload(request, config2, rawSim, toolExecutions, extractorTimeout);
    return { ...response2, provider, model, fallbackReason: (fallbackReason ? fallbackReason + " + " : "") + "simulated-tool" };
  }
  logger.info("runKoruBackendTurn", "Parsing first response JSON", { contentPreview: content.slice(0, 500) });
  let parsed;
  try {
    parsed = JSON.parse(extractJsonBlock(content));
  } catch (err) {
    logger.warn("runKoruBackendTurn", "First response JSON parse failed", { error: String(err), contentPreview: content.slice(0, 500) });
    const isOllama2 = config2.nvidiaBaseUrl.includes(":11434") || config2.nvidiaBaseUrl.includes("ollama");
    if (isOllama2) {
      try {
        const retryResult = await callProvider(config2, [
          ...messages,
          { role: "user", content: `Tu respuesta anterior no era JSON v\xE1lido. El usuario te pregunt\xF3 AHORA: \xAB${request.input.slice(0, 300)}\xBB. Respond\xE9 a ESA pregunta con SOLO este JSON, sin texto extra: {"reply":"tu respuesta al usuario","mascotState":"idle"}` }
        ], 15e3, false, preferredProvider);
        parsed = JSON.parse(extractJsonBlock(cleanText(retryResult.message.content, "")));
        logger.info("runKoruBackendTurn", "Ollama JSON retry succeeded");
      } catch (retryErr) {
        logger.warn("runKoruBackendTurn", "Ollama JSON retry also failed", { error: String(retryErr) });
      }
    }
    if (!parsed) {
      const rawFallback = {
        reply: cleanReplyText(content) || "No pude armar una respuesta clara. \xBFMe lo repet\xEDs de otra forma?",
        understanding: {
          literalRequest: request.input,
          userGoal: "Responder la consulta del usuario.",
          unstatedNeeds: [],
          assumptions: [],
          confidence: 0.45
        },
        uiBlocks: blocksFromToolResults(toolExecutions),
        suggestedActions: [],
        memoryCandidates: [],
        commitments: [],
        records: [],
        mascotState: "thinking"
      };
      const response2 = await finalizeFromPlainText(rawFallback, toolCalls, request, config2, toolExecutions, extractorTimeout);
      logger.info("runKoruBackendTurn", "Return first-call-invalid-json", { replyPreview: (response2.reply ?? "").slice(0, 300), provider, model, fallbackReason });
      return { ...response2, provider, model, fallbackReason: fallbackReason ?? "first-call-invalid-json" };
    }
  }
  const raw = {
    reply: cleanText(parsed.reply, content),
    understanding: parsed.understanding || {},
    uiBlocks: asArray(parsed.uiBlocks || []),
    suggestedActions: asArray(parsed.suggestedActions || []),
    memoryCandidates: asArray(parsed.memoryCandidates || []),
    commitments: asArray(parsed.commitments || []),
    records: asArray(parsed.records || []),
    mascotState: parsed.mascotState
  };
  const cityAction = cityMemorySuggestion(toolCalls, request.state);
  if (cityAction) raw.suggestedActions = [...asArray(raw.suggestedActions), cityAction];
  if (asArray(raw.suggestedActions).length === 0) {
    try {
      const { enhancementActions } = await buildEnhancementInstruction(request, config2, toolExecutions);
      raw.suggestedActions = [...asArray(raw.suggestedActions), ...enhancementActions];
    } catch {
    }
  }
  const response = await finalizePayload(request, config2, raw, toolExecutions, extractorTimeout);
  logger.info("runKoruBackendTurn", "Return first-call", { replyPreview: (response.reply ?? "").slice(0, 300), provider, model, fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "first-call" });
  return {
    ...response,
    provider,
    model,
    fallbackReason: fallbackReason ?? response.memoryFallbackReason ?? "first-call"
  };
}

// koru-mvp/server/index.ts
try {
  const undici = eval("require")("undici");
  globalThis.fetch = undici.fetch;
} catch {
}
var __dirname = dirname(fileURLToPath(import.meta.url));
var PROJECT_ROOT = existsSync(join(__dirname, "dist")) ? __dirname : join(__dirname, "..");
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
function loadEnv() {
  const envPath = join(PROJECT_ROOT, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();
function buildConfig() {
  const env = process.env;
  return {
    nvidiaApiKey: env.NVIDIA_API_KEY?.trim(),
    nvidiaBaseUrl: env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
    nvidiaModel: env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
    nvidiaFastModel: env.NVIDIA_FAST_MODEL && !env.NVIDIA_FAST_MODEL.includes("stepfun") && !env.NVIDIA_FAST_MODEL.includes("nemotron-3-nano") && !env.NVIDIA_FAST_MODEL.includes("llama-3.1-8b") ? env.NVIDIA_FAST_MODEL.trim() : "nvidia/nemotron-3-ultra-550b-a55b",
    nvidiaMediumModel: env.NVIDIA_MEDIUM_MODEL?.trim(),
    openRouterKeys: [env.OPENROUTER_API_KEY, env.OPENROUTER_FALLBACK_API_KEYS].filter(Boolean).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean),
    openRouterModels: (env.OPENROUTER_FALLBACK_MODELS || "").split(",").map((v) => v.trim()).filter(Boolean),
    minimaxAccessToken: env.MINIMAX_ACCESS_TOKEN?.trim(),
    ollamaEmbedBaseUrl: env.OLLAMA_EMBED_BASE_URL?.trim() || void 0
  };
}
var config = buildConfig();
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}
var server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }
  const url = req.url ?? "";
  if (url.startsWith("/api/health") && req.method === "GET") {
    sendJson(res, 200, {
      status: "ok",
      service: "koru-backend",
      provider: config.nvidiaApiKey ? "nvidia" : "none",
      model: config.nvidiaModel,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    return;
  }
  if (url.startsWith("/api/koru/models") && req.method === "GET") {
    const predefined = [];
    if (config.nvidiaApiKey) {
      predefined.push({ id: config.nvidiaModel, provider: "nvidia", label: "NVIDIA Nemotron 3 Ultra" });
    }
    for (const m of config.openRouterModels) {
      predefined.push({ id: m, provider: "openrouter", label: m });
    }
    sendJson(res, 200, { models: predefined });
    return;
  }
  if (url === "/api/koru/vlm" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      if (!body.image_base64) {
        sendJson(res, 400, { error: "Falta image_base64" });
        return;
      }
      const { default: ZAI } = await import("z-ai-web-dev-sdk");
      const zai = await ZAI.create();
      const prompt = body.prompt || "Extra\xE9 todo el texto visible en la imagen, preservando estructura. Si no hay texto, describ\xED qu\xE9 se ve.";
      const response = await zai.chat.completions.createVision({
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.image_base64}` } }
          ]
        }],
        thinking: { type: "disabled" }
      });
      const text = response.choices?.[0]?.message?.content ?? "";
      sendJson(res, 200, { text });
    } catch (err) {
      console.error("[koru-vlm]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error de VLM" });
    }
    return;
  }
  if (url === "/api/koru/asr" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      if (!body.audio_base64) {
        sendJson(res, 400, { error: "Falta audio_base64" });
        return;
      }
      const { default: ZAI } = await import("z-ai-web-dev-sdk");
      const zai = await ZAI.create();
      const response = await zai.audio.asr.create({ file_base64: body.audio_base64 });
      sendJson(res, 200, { text: response.text ?? "" });
    } catch (err) {
      console.error("[koru-asr]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error de ASR" });
    }
    return;
  }
  if (url.startsWith("/api/koru/turn") && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const request = JSON.parse(raw || "{}");
      if (!request.input?.trim() || !request.state || !Array.isArray(request.history)) {
        sendJson(res, 400, { error: "Payload incompleto para /api/koru/turn." });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no"
        // Render/nginx: no buffer
      });
      const heartbeat = setInterval(() => {
        try {
          res.write("\n");
        } catch {
        }
      }, 5e3);
      const onChunk = (chunk) => {
        try {
          res.write(JSON.stringify(chunk) + "\n");
        } catch {
        }
      };
      try {
        const result = await runKoruBackendTurn(request, config, onChunk);
        clearInterval(heartbeat);
        try {
          res.write(JSON.stringify(result) + "\n");
        } catch {
        }
      } catch (err) {
        clearInterval(heartbeat);
        const errorResponse = {
          error: err?.message ?? "Error interno",
          reply: "No pude procesar tu mensaje. El modelo no respondi\xF3 a tiempo.",
          uiBlocks: [],
          suggestedActions: [],
          understanding: { literalRequest: "", userGoal: "error", unstatedNeeds: [], assumptions: [], confidence: 0 },
          memoryCandidates: [],
          commitments: [],
          records: [],
          toolResults: [],
          stateEvents: [{ kind: "done", label: "Error" }],
          mascotState: "tired",
          provider: "nvidia",
          fallbackReason: "server-error"
        };
        try {
          res.write(JSON.stringify(errorResponse) + "\n");
        } catch {
        }
      }
      res.end();
    } catch (err) {
      console.error("[koru-turn]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error interno" });
    }
    return;
  }
  if (url.startsWith("/api/debug/weather") && req.method === "GET") {
    try {
      const city = new URL(req.url ?? "", "http://localhost").searchParams.get("city") || "Valencia";
      console.log("[debug/weather] Testing city:", city);
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`;
      console.log("[debug/weather] Geocoding:", geoUrl);
      const geoRes = await globalThis.fetch(geoUrl, { signal: AbortSignal.timeout(15e3) });
      console.log("[debug/weather] Geo status:", geoRes.status);
      const geoData = await geoRes.json();
      const geo = geoData.results?.[0];
      if (!geo) {
        sendJson(res, 200, { error: "Geocode failed", geoStatus: geoRes.status, geoData: JSON.stringify(geoData).slice(0, 200) });
        return;
      }
      console.log("[debug/weather] Geo result:", geo.name, geo.latitude, geo.longitude);
      let temp;
      let wind;
      let max;
      let min;
      let rain;
      let desc;
      let source = "unknown";
      try {
        const wttrUrl = `https://wttr.in/${encodeURIComponent(geo.name)}?format=j1`;
        console.log("[debug/weather] wttr.in:", wttrUrl);
        const wttrRes = await globalThis.fetch(wttrUrl, { signal: AbortSignal.timeout(15e3), headers: { "Accept": "application/json" } });
        if (wttrRes.ok) {
          const wttrData = await wttrRes.json();
          const cur = wttrData.current_condition?.[0];
          const today = wttrData.weather?.[0];
          temp = cur ? Number(cur.temp_C) : void 0;
          wind = cur ? Number(cur.windspeedKmph) : void 0;
          desc = cur?.weatherDesc?.[0]?.value;
          max = today ? Number(today.maxtempC) : void 0;
          min = today ? Number(today.mintempC) : void 0;
          rain = today?.hourly?.[0]?.chanceofrain ? Number(today.hourly[0].chanceofrain) : void 0;
          source = "wttr.in";
          console.log("[debug/weather] wttr.in OK:", temp, "\xB0C");
        }
      } catch (e) {
        console.error("[debug/weather] wttr.in failed:", e?.message);
      }
      if (temp === void 0) {
        try {
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
          console.log("[debug/weather] open-meteo:", weatherUrl);
          const weatherRes = await globalThis.fetch(weatherUrl, { signal: AbortSignal.timeout(15e3) });
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json();
            temp = weatherData.current?.temperature_2m;
            wind = weatherData.current?.wind_speed_10m;
            max = weatherData.daily?.temperature_2m_max?.[0];
            min = weatherData.daily?.temperature_2m_min?.[0];
            rain = weatherData.daily?.precipitation_probability_max?.[0];
            source = "open-meteo";
            console.log("[debug/weather] open-meteo OK:", temp, "\xB0C");
          } else {
            console.error("[debug/weather] open-meteo HTTP:", weatherRes.status);
          }
        } catch (e) {
          console.error("[debug/weather] open-meteo failed:", e?.message);
        }
      }
      sendJson(res, 200, {
        city: geo.name,
        country: geo.country,
        temp,
        wind,
        max,
        min,
        rain,
        desc,
        source
      });
    } catch (err) {
      sendJson(res, 200, { error: err?.message, stack: err?.stack?.slice(0, 200) });
    }
    return;
  }
  if (url === "/api/koru/proactive" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const { state, lastSeen } = body;
      console.log("[proactive] Request received, memories:", state?.memories?.length ?? 0);
      const { runProactiveCheck: runProactiveCheck2 } = await Promise.resolve().then(() => (init_proactiveEngine(), proactiveEngine_exports));
      const message = await runProactiveCheck2(state, config, lastSeen || Date.now());
      console.log("[proactive] Result:", message?.shouldShow ?? false, message?.reply?.slice(0, 60) ?? "");
      sendJson(res, 200, message || { shouldShow: false });
    } catch (err) {
      console.error("[proactive] Error:", err?.message);
      sendJson(res, 200, { shouldShow: false, error: err?.message });
    }
    return;
  }
  if (url === "/koru-audit/log" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const event = JSON.parse(raw || "{}");
      const logDir = join(PROJECT_ROOT, "manual-audits");
      if (!existsSync(logDir)) {
        const { mkdirSync: mkdirSync2 } = await import("node:fs");
        mkdirSync2(logDir, { recursive: true });
      }
      const { appendFileSync: appendFileSync2 } = await import("node:fs");
      appendFileSync2(join(logDir, "koru-current.jsonl"), JSON.stringify(event) + "\n");
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 200, { ok: true });
    }
    return;
  }
  if (req.method === "GET") {
    const distDir = join(PROJECT_ROOT, "dist");
    let filePath = join(distDir, url === "/" ? "index.html" : url);
    if (!filePath.startsWith(distDir)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const { statSync } = await import("node:fs");
      const s = statSync(filePath);
      if (s.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      filePath = join(distDir, "index.html");
    }
    const cached2 = getStaticFile(filePath);
    if (cached2) {
      res.writeHead(200, { "Content-Type": cached2.contentType, "Cache-Control": "no-cache" });
      res.end(cached2.data);
      return;
    }
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  sendJson(res, 404, { error: "Not found", url });
});
var staticCache = /* @__PURE__ */ new Map();
var STATIC_DIR = join(PROJECT_ROOT, "dist");
function getStaticFile(filePath) {
  if (staticCache.has(filePath)) return staticCache.get(filePath);
  try {
    const data = readFileSync(filePath);
    const ext = filePath.endsWith(".html") ? "text/html" : filePath.endsWith(".js") ? "application/javascript" : filePath.endsWith(".css") ? "text/css" : filePath.endsWith(".png") ? "image/png" : filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") ? "image/jpeg" : filePath.endsWith(".svg") ? "image/svg+xml" : filePath.endsWith(".json") ? "application/json" : filePath.endsWith(".woff") ? "font/woff" : filePath.endsWith(".woff2") ? "font/woff2" : filePath.endsWith(".mp4") ? "video/mp4" : filePath.endsWith(".webm") ? "video/webm" : filePath.endsWith(".webp") ? "image/webp" : filePath.endsWith(".gif") ? "image/gif" : filePath.endsWith(".ico") ? "image/x-icon" : "application/octet-stream";
    const entry = { data, contentType: ext };
    if (staticCache.size < 50 && data.length < 5e6) staticCache.set(filePath, entry);
    return entry;
  } catch {
    return null;
  }
}
function shutdown(signal) {
  console.log(`[Koru] ${signal} received, shutting down...`);
  server.close(() => {
    console.log("[Koru] Server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5e3).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("[Koru] Uncaught exception:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[Koru] Unhandled rejection:", err);
});
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > 400) {
    console.warn(`[Koru] Memory warning: ${Math.round(used)}MB heap used`);
  }
}, 6e4);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Koru] Running on http://localhost:${PORT}`);
  console.log(`[Koru] Provider: ${config.nvidiaApiKey ? "nvidia" : "none"}`);
  console.log(`[Koru] Model: ${config.nvidiaModel}`);
  console.log(`[Koru] Memory limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
});
