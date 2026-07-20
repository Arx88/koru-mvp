// FIX: Vite patchea global.fetch. Restaurar fetch nativo de Node.js antes de cualquier otra cosa.
try { const undici = eval("require")("undici"); globalThis.fetch = undici.fetch; } catch {}

/**
 * Fase 3.11 — Backend Express independiente de Vite.
 *
 * Extrae los middlewares de koruBackend del vite.config.ts a un proceso
 * Express independiente, habilitando deploy a Railway/Fly.io.
 *
 * Uso:
 *   npm run server  → arranca en puerto 3001
 *   npm run dev     → arranca Vite en :3000 (dev server con HMR)
 *
 * En producción:
 *   - Frontend: Vercel/Netlify (sirve dist/)
 *   - Backend: Railway/Fly.io (este archivo)
 *   - Frontend hace fetch a BACKEND_URL (env var)
 */
import http from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runKoruBackendTurn, type KoruBackendTurnRequest, type ProviderConfig } from "../src/server/koruBackend.ts";
import { exchangeCodeForToken } from "../src/tools/calendar/googleCalendar.ts";
import { corsOrigin, rateLimitAllow, isAuthorized, securityHeaders } from "./middleware.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Si estamos corriendo desde server-bundle.mjs, __dirname es la raíz del proyecto.
// Si desde server/index.ts, es server/. En ambos casos, dist/ está en la raíz.
const PROJECT_ROOT = existsSync(join(__dirname, "dist")) ? __dirname : join(__dirname, "..");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Load .env manually (no dotenv dependency)
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

// 🔴 KORU 3.0 — Crear .z-ai-config dinámicamente desde env vars.
// El SDK z-ai-web-dev-sdk (usado para ASR/HABLAR y generación de imágenes)
// requiere un archivo .z-ai-config en cwd/home/etc. En Render no existe,
// así que lo creamos al arrancar desde ZAI_API_KEY y ZAI_BASE_URL env vars.
// Sin esto, el botón HABLAR tira error 500 "Configuration file not found".
function ensureZaiConfig() {
  const apiKey = process.env.ZAI_API_KEY?.trim() || process.env.Z_AI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[zai] ZAI_API_KEY no configurada — ASR (HABLAR) e image generation no funcionarán.");
    return;
  }
  const baseUrl = process.env.ZAI_BASE_URL?.trim() || "https://api.z.ai/api/paas/v4";
  const config = JSON.stringify({ apiKey, baseUrl });
  const configPaths = [
    join(PROJECT_ROOT, ".z-ai-config"),
    join(process.env.HOME || process.env.HOMEPATH || "/tmp", ".z-ai-config"),
  ];
  for (const p of configPaths) {
    try { writeFileSync(p, config, { mode: 0o600 }); } catch { /* ignore */ }
  }
  console.log("[zai] .z-ai-config escrita desde ZAI_API_KEY");
}
ensureZaiConfig();

// Build ProviderConfig from env
function buildConfig() {
  const env = process.env;
  return {
    nvidiaApiKey: env.NVIDIA_API_KEY?.trim(),
    nvidiaBaseUrl: env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
    nvidiaModel: env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
    nvidiaFastModel: (env.NVIDIA_FAST_MODEL && !env.NVIDIA_FAST_MODEL.includes("stepfun") && !env.NVIDIA_FAST_MODEL.includes("nemotron-3-nano") && !env.NVIDIA_FAST_MODEL.includes("llama-3.1-8b")) ? env.NVIDIA_FAST_MODEL.trim() : "nvidia/nemotron-3-ultra-550b-a55b",
    nvidiaMediumModel: env.NVIDIA_MEDIUM_MODEL?.trim(),
    openRouterKeys: [env.OPENROUTER_API_KEY, env.OPENROUTER_FALLBACK_API_KEYS]
      .filter(Boolean)
      .flatMap((v) => v!.split(","))
      .map((v) => v.trim())
      .filter(Boolean),
    openRouterModels: (env.OPENROUTER_FALLBACK_MODELS || "nvidia/nemotron-3-ultra-550b-a55b:free,meta-llama/llama-3.3-70b-instruct:free")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    minimaxAccessToken: env.MINIMAX_ACCESS_TOKEN?.trim(),
    ollamaEmbedBaseUrl: env.OLLAMA_EMBED_BASE_URL?.trim() || undefined,
    ainativeApiKey: env.AINATIVE_API_KEY?.trim(),
  };
}

const config = buildConfig();

// Helper: read body as string
async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8");
}

// Helper: send JSON. CORS headers are set once at the top of
// koruRequestHandler via res.setHeader() — writeHead() merges with those.
function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(data));
}

// Helper: send HTML (used por el OAuth callback — la pestaña del popup
// recibe este HTML, escribe el flag en localStorage y se cierra sola).
function sendHtml(res: http.ServerResponse, status: number, html: string) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

// ── Integrations store ────────────────────────────────────────────
// Persistencia simple en `koru-integrations.json` (PROJECT_ROOT).
// Shape:
//   {
//     "googleCalendar": {
//       "connected": true,
//       "accessToken": "...",
//       "refreshToken": "...",
//       "connectedAt": "2026-..."
//     }
//   }
// No es una DB — suficiente para MVP. El frontend consulta el flag
// `connected` via GET /api/integrations/google-calendar/status.
type GoogleCalendarIntegration = {
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
  connectedAt?: string;
};

type IntegrationsStore = {
  googleCalendar?: GoogleCalendarIntegration;
};

const INTEGRATIONS_FILE = join(PROJECT_ROOT, "koru-integrations.json");
// In-memory cache — arranca con lo que haya en disco (si existe) y se
// mantiene sincronizado con cada write. Evita leer el archivo en cada
// GET /status.
let integrationsCache: IntegrationsStore = (() => {
  try {
    if (existsSync(INTEGRATIONS_FILE)) {
      const raw = readFileSync(INTEGRATIONS_FILE, "utf8");
      return JSON.parse(raw) as IntegrationsStore;
    }
  } catch (err) {
    console.warn("[integrations] No se pudo leer koru-integrations.json:", (err as Error).message);
  }
  return {};
})();

function persistIntegrations() {
  try {
    writeFileSync(INTEGRATIONS_FILE, JSON.stringify(integrationsCache, null, 2), "utf8");
  } catch (err) {
    console.warn("[integrations] No se pudo escribir koru-integrations.json:", (err as Error).message);
  }
}

// Escape HTML para evitar XSS en los mensajes de error del OAuth callback.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const server = http.createServer(koruRequestHandler);

/**
 * Request handler del backend Koru. Exportado para que los tests puedan
 * invocarlo directamente con mock req/res sin levantar un server real.
 * Cada endpoint lee el body si necesita, mockea LLM/OAuth via dynamic imports
 * (que vitest puede interceptar con vi.mock) y responde con sendJson/sendHtml.
 */
export async function koruRequestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
  // ── HTTP security headers (Task 10-P2-FIX) — seteados ANTES de cualquier otra cosa.
  securityHeaders(res);

  // ── CORS whitelist (Task 9-ENG-FIX-v2) ────────────────────────────
  const origin = corsOrigin(req);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {});
    res.end();
    return;
  }

  const url = req.url ?? "";
  const path = url.split("?")[0];

  // ── Rate limit (Task 9-ENG-FIX-v2): 30 req/min por IP en endpoints costosos.
  if (!rateLimitAllow(req)) {
    sendJson(res, 429, { error: "Rate limit exceeded. Máximo 30 req/min por IP." });
    return;
  }

  // ── API key opcional (Task 9-ENG-FIX-v2) ──────────────────────────
  if (path.startsWith("/api/koru/") && !isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized — falta o es inválida la API key." });
    return;
  }

  // ── Health check ──────────────────────────────────────────────
  if (url.startsWith("/api/health") && req.method === "GET") {
    sendJson(res, 200, {
      status: "ok",
      service: "koru-backend",
      provider: config.nvidiaApiKey ? "nvidia" : "none",
      model: config.nvidiaModel,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ── /api/koru/models ──────────────────────────────────────────
  if (url.startsWith("/api/koru/models") && req.method === "GET") {
    const predefined: Array<{ id: string; provider: string; label: string }> = [];
    if (config.nvidiaApiKey) {
      predefined.push({ id: config.nvidiaModel, provider: "nvidia", label: "NVIDIA Nemotron 3 Ultra" });
    }
    for (const m of config.openRouterModels) {
      predefined.push({ id: m, provider: "openrouter", label: m });
    }
    sendJson(res, 200, { models: predefined });
    return;
  }

  // ── /api/koru/vlm (análisis de imágenes con VLM) ─────────────
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
      const prompt = body.prompt || "Extraé todo el texto visible en la imagen, preservando estructura. Si no hay texto, describí qué se ve.";
      const response = await zai.chat.completions.createVision({
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.image_base64}` } },
          ],
        }],
        thinking: { type: "disabled" },
      });
      const text = response.choices?.[0]?.message?.content ?? "";
      sendJson(res, 200, { text });
    } catch (err: any) {
      console.error("[koru-vlm]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error de VLM" });
    }
    return;
  }

  // ── /api/koru/asr (transcripción de audio) ───────────────────
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
    } catch (err: any) {
      console.error("[koru-asr]", err?.message);
      // 🔴 KORU 3.0 — Mensaje de error más útil para el usuario.
      const msg = err?.message ?? "Error de ASR";
      const userFriendly = msg.includes("Configuration file not found")
        ? "El servicio de voz no está configurado en el servidor. Contactá al admin."
        : msg.includes("fetch failed") || msg.includes("ECONNREFUSED")
          ? "No pude conectar con el servicio de transcripción. Probá de nuevo."
          : `No pude transcribir el audio: ${msg}`;
      sendJson(res, 500, { error: userFriendly });
    }
    return;
  }

  // ── /api/koru/turn (chat principal con NDJSON streaming) ─────
  if (url.startsWith("/api/koru/turn") && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const request = JSON.parse(raw || "{}");
      if (!request.input?.trim() || !request.state || !Array.isArray(request.history)) {
        sendJson(res, 400, { error: "Payload incompleto para /api/koru/turn." });
        return;
      }

      // SIEMPRE usar streaming con heartbeat para evitar timeout de Render (30s)
      // El heartbeat envía un chunk vacío cada 5s para mantener viva la conexión
      // CORS ya fue seteado vía res.setHeader() al inicio del handler.
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Render/nginx: no buffer
      });

      // Task 10-P2-FIX (P2-3): abortar el turno si el cliente se desconecta.
      // res.on('close') dispara cuando la response se cerró (normalmente vía
      // res.end()) O cuando el cliente cortó la conexión. Distinguimos ambos
      // casos con res.writableEnded.
      const ac = new AbortController();
      let aborted = false;
      res.on("close", () => {
        if (!aborted && !res.writableEnded) {
          aborted = true;
          ac.abort();
          console.log("[koru-turn] Client disconnected — aborting turn to save LLM quota.");
        }
      });

      // Heartbeat: cada 5s enviar un comentario para mantener la conexión.
      // Si el cliente ya se desconectó, no escribir (evita EPIPE).
      const heartbeat = setInterval(() => {
        if (aborted) return;
        try { res.write("\n"); } catch {}
      }, 5000);

      const onChunk = (chunk: any) => {
        if (aborted) return;
        try { res.write(JSON.stringify(chunk) + "\n"); } catch {}
      };

      try {
        // Pasar el abortSignal al runtime para que cancele los fetches al LLM.
        // (abortSignal es opcional en KoruBackendTurnRequest; si no se usa, no rompe.)
        const result = await runKoruBackendTurn({ ...request, abortSignal: ac.signal } as any, config as any, onChunk);
        clearInterval(heartbeat);
        if (!aborted) {
          try { res.write(JSON.stringify(result) + "\n"); } catch {}
        }
      } catch (err: any) {
        clearInterval(heartbeat);
        // Si el turno abortó por desconexión del cliente, no escribir nada
        // (el socket ya está cerrado). Solo loggeamos silenciosamente.
        if (aborted || err?.name === "AbortError") {
          console.log("[koru-turn] Turn aborted (client disconnect). No response sent.");
        } else {
          const errMsg = err?.message ?? "Error interno";
          console.error("[koru-turn] EXCEPTION:", errMsg, err?.stack?.slice(0, 500));
          const errorResponse = {
            error: errMsg,
            reply: "No pude procesar tu mensaje. El modelo no respondió a tiempo.",
            uiBlocks: [],
            suggestedActions: [],
            understanding: { literalRequest: "", userGoal: "error", unstatedNeeds: [], assumptions: [], confidence: 0 },
            memoryCandidates: [], commitments: [], records: [], toolResults: [],
            stateEvents: [{ kind: "done" as const, label: "Error" }],
            mascotState: "tired",
            provider: "nvidia",
            fallbackReason: "server-error",
          };
          try { res.write(JSON.stringify(errorResponse) + "\n"); } catch {}
        }
      }
      res.end();
    } catch (err: any) {
      console.error("[koru-turn]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error interno" });
    }
    return;
  }

  // ── /api/debug/weather — debug weather fetch ────────────────
  // Task 9-ENG-FIX-v2: gateado en prod. Exponer solo en dev/staging.
  if (url.startsWith("/api/debug/weather") && req.method === "GET") {
    if (process.env.NODE_ENV === "production") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    try {
      const city = new URL(req.url ?? "", "http://localhost").searchParams.get("city") || "Valencia";
      console.log("[debug/weather] Testing city:", city);

      // Step 1: Geocode
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`;
      console.log("[debug/weather] Geocoding:", geoUrl);
      const geoRes = await globalThis.fetch(geoUrl, { signal: AbortSignal.timeout(15000) });
      console.log("[debug/weather] Geo status:", geoRes.status);
      const geoData = await geoRes.json() as any;
      const geo = geoData.results?.[0];
      if (!geo) {
        sendJson(res, 200, { error: "Geocode failed", geoStatus: geoRes.status, geoData: JSON.stringify(geoData).slice(0, 200) });
        return;
      }
      console.log("[debug/weather] Geo result:", geo.name, geo.latitude, geo.longitude);

      // Step 2: Weather — try wttr.in first (no rate limits), then open-meteo
      let temp: number | undefined;
      let wind: number | undefined;
      let max: number | undefined;
      let min: number | undefined;
      let rain: number | undefined;
      let desc: string | undefined;
      let source: string = "unknown";

      // Try wttr.in (no rate limits, no API key)
      try {
        const wttrUrl = `https://wttr.in/${encodeURIComponent(geo.name)}?format=j1`;
        console.log("[debug/weather] wttr.in:", wttrUrl);
        const wttrRes = await globalThis.fetch(wttrUrl, { signal: AbortSignal.timeout(15000), headers: { "Accept": "application/json" } });
        if (wttrRes.ok) {
          const wttrData = await wttrRes.json() as any;
          const cur = wttrData.current_condition?.[0];
          const today = wttrData.weather?.[0];
          temp = cur ? Number(cur.temp_C) : undefined;
          wind = cur ? Number(cur.windspeedKmph) : undefined;
          desc = cur?.weatherDesc?.[0]?.value;
          max = today ? Number(today.maxtempC) : undefined;
          min = today ? Number(today.mintempC) : undefined;
          rain = today?.hourly?.[0]?.chanceofrain ? Number(today.hourly[0].chanceofrain) : undefined;
          source = "wttr.in";
          console.log("[debug/weather] wttr.in OK:", temp, "°C");
        }
      } catch (e: any) { console.error("[debug/weather] wttr.in failed:", e?.message); }

      // Fallback: open-meteo
      if (temp === undefined) {
        try {
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
          console.log("[debug/weather] open-meteo:", weatherUrl);
          const weatherRes = await globalThis.fetch(weatherUrl, { signal: AbortSignal.timeout(15000) });
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json() as any;
            temp = weatherData.current?.temperature_2m;
            wind = weatherData.current?.wind_speed_10m;
            max = weatherData.daily?.temperature_2m_max?.[0];
            min = weatherData.daily?.temperature_2m_min?.[0];
            rain = weatherData.daily?.precipitation_probability_max?.[0];
            source = "open-meteo";
            console.log("[debug/weather] open-meteo OK:", temp, "°C");
          } else {
            console.error("[debug/weather] open-meteo HTTP:", weatherRes.status);
          }
        } catch (e: any) { console.error("[debug/weather] open-meteo failed:", e?.message); }
      }

      sendJson(res, 200, {
        city: geo.name,
        country: geo.country,
        temp, wind, max, min, rain, desc, source,
      });
    } catch (err: any) {
      sendJson(res, 200, { error: err?.message, stack: err?.stack?.slice(0, 200) });
    }
    return;
  }

  // ── /api/koru/proactive — proactive engine ───────────────────
  if (url === "/api/koru/proactive" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const { state, lastSeen } = body;

      console.log("[proactive] Request received, memories:", state?.memories?.length ?? 0);

      // Import proactive engine
      const { runProactiveCheck } = await import("../src/domain/proactiveEngine.ts");
      const message = await runProactiveCheck(state, config, lastSeen || Date.now());

      console.log("[proactive] Result:", message?.shouldShow ?? false, message?.reply?.slice(0, 60) ?? "");

      sendJson(res, 200, message || { shouldShow: false });
    } catch (err: any) {
      console.error("[proactive] Error:", err?.message);
      sendJson(res, 200, { shouldShow: false, error: err?.message });
    }
    return;
  }

  // ── /api/koru/morning-brief — brief matutino automático ──────
  if (url === "/api/koru/morning-brief" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const { state } = body;

      const now = new Date();
      const hour = now.getHours();
      const isMorning = hour >= 5 && hour <= 11;

      if (!isMorning) {
        sendJson(res, 200, { shouldShow: false, reason: "not_morning" });
        return;
      }

      // Verificar si ya se mostró hoy
      const today = now.toISOString().slice(0, 10);
      if (state?.lastBriefDate === today) {
        sendJson(res, 200, { shouldShow: false, reason: "already_shown" });
        return;
      }

      // 🔴 FULL morning brief — gather context from KoruState, then call LLM.
      // Context sources (todos opcionales, el endpoint no falla si faltan):
      //   - today's calendar events (calendarEvents)
      //   - open commitments due today (commitments con dueAt/dueHint == hoy)
      //   - weather cache (weatherCache)
      //   - last entry sentiment (entries[last].sentiment)
      //   - confirmed/candidate memories (para contexto de personalidad)
      const userName = state?.userName ?? "";

      // Today's calendar events
      const todayEvents = (state?.calendarEvents ?? []).filter((ev: any) => {
        try {
          if (!ev?.startsAt) return false;
          return new Date(ev.startsAt).toISOString().slice(0, 10) === today;
        } catch { return false; }
      }).slice(0, 5);

      // Open commitments due today (por dueAt o dueHint que mencione "hoy"/"today"/fecha de hoy)
      const todayCommitments = (state?.commitments ?? []).filter((c: any) => {
        if (c?.status !== "open") return false;
        try {
          if (c.dueAt && new Date(c.dueAt).toISOString().slice(0, 10) === today) return true;
        } catch {}
        const hint = String(c?.dueHint ?? "").toLowerCase();
        return hint.includes("hoy") || hint.includes("today") || hint.includes(today);
      }).slice(0, 5);

      // Weather cache
      const weatherCache = state?.weatherCache;
      const weatherStr = weatherCache?.payload?.now
        ? `${weatherCache.payload.now} en ${weatherCache.city}`
        : "no disponible";

      // Last entry sentiment
      const entries: any[] = Array.isArray(state?.entries) ? state.entries : [];
      const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
      const lastSentiment = lastEntry?.sentiment ?? "neutral";

      // Confirmed/candidate memories (for personality context)
      const memories = (state?.memories ?? [])
        .filter((m: any) => m.status === "confirmed" || m.status === "candidate")
        .slice(0, 10);

      // 🔴 LLM prompt — formato especificado:
      // { greeting: string, items: [{icon, label, value}], reflection: string }
      const briefMessages = [
        {
          role: "system" as const,
          content: `Sos Koru. Generá el morning brief para ${userName}. Hoy es ${today}. Eventos: ${JSON.stringify(todayEvents.map((e: any) => e.title))}. Deadlines: ${JSON.stringify(todayCommitments.map((c: any) => c.title))}. Clima: ${weatherStr}. Último sentimiento registrado: ${lastSentiment}. Memorias relevantes: ${JSON.stringify(memories.map((m: any) => `[${m.kind}] ${m.text}`))}. Generá: greeting, 3-item summary, reflection. Respondé en JSON: { greeting: string, items: [{icon, label, value}], reflection: string }`,
        },
        {
          role: "user" as const,
          content: `Generá el morning brief ahora. Recordá: greeting cálido y personalizado, 3 items con icon (material symbols), label corto y value concreto, reflection breve para cerrar.`,
        },
      ];

      let brief: any = null;
      try {
        const { callProvider, inferProviderFromModel } = await import("../src/server/koruBackend.ts");
        const pp = inferProviderFromModel(config.nvidiaModel);
        const result = await callProvider(config, briefMessages, 30_000, false, pp);
        const content = (result.message as any).content?.trim() ?? "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validar estructura mínima: greeting + items + reflection
          if (parsed && typeof parsed.greeting === "string" && Array.isArray(parsed.items)) {
            brief = {
              greeting: String(parsed.greeting),
              items: parsed.items
                .filter((it: any) => it && typeof it === "object")
                .map((it: any) => ({
                  icon: String(it.icon ?? "wb_sunny"),
                  label: String(it.label ?? ""),
                  value: String(it.value ?? ""),
                })),
              reflection: String(parsed.reflection ?? ""),
            };
          }
        }
      } catch (llmErr: any) {
        console.error("[morning-brief] LLM failed:", llmErr?.message);
      }

      // 🔴 Fallback brief: si el LLM falló o devolvió JSON inválido,
      // construimos un brief estático con saludo + items derivados del state.
      if (!brief || typeof brief.greeting !== "string") {
        const fallbackItems: Array<{ icon: string; label: string; value: string }> = [];
        if (todayEvents.length > 0) {
          fallbackItems.push({
            icon: "event",
            label: "Eventos",
            value: `${todayEvents.length} evento(s) hoy: ${todayEvents.map((e: any) => e.title).join(", ")}`,
          });
        }
        if (todayCommitments.length > 0) {
          fallbackItems.push({
            icon: "check_circle",
            label: "Pendientes",
            value: `${todayCommitments.length} tarea(s): ${todayCommitments.map((c: any) => c.title).join(", ")}`,
          });
        }
        fallbackItems.push({
          icon: "wb_sunny",
          label: "Clima",
          value: weatherStr,
        });
        brief = {
          greeting: `¡Buenos días${userName ? `, ${userName}` : ""}!`,
          items: fallbackItems.slice(0, 3),
          reflection: "Hoy es un buen día para avanzar con lo que importa.",
        };
      }

      sendJson(res, 200, { shouldShow: true, brief, date: today });
    } catch (err: any) {
      console.error("[morning-brief] Error:", err?.message);
      sendJson(res, 200, { shouldShow: false, error: err?.message });
    }
    return;
  }

  // ── /api/koru/ai-assist — sugerencias para CreateScreen ──────
  // Body: { template: string, title: string, language?: "es"|"en" }
  // Usa el mismo LLM client que el chat principal (callProvider).
  // Timeout: 10s. Si el LLM falla, devuelve { suggestions: [] }.
  if (url === "/api/koru/ai-assist" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const template: string = typeof body.template === "string" ? body.template : "";
      const title: string = typeof body.title === "string" ? body.title : "";
      const language: "es" | "en" = body.language === "en" ? "en" : "es";

      if (!template || !title) {
        sendJson(res, 400, { error: "Faltan template o title", suggestions: [] });
        return;
      }

      // Reglas por template — indican al LLM qué campos incluir siempre.
      const templateRules: Record<string, string> = {
        gasto: 'Siempre incluí: collection="Gastos", currency="ARS". Además, categorizá el título (ej: "Comida", "Transporte", "Hogar", "Ocio", "Salud").',
        receta: 'Siempre incluí: collection="Recetas", servings=4, prepTime="20 min".',
        nota: 'Siempre incluí: collection="Notas".',
        plan: 'Generá 3 pasos (step1, step2, step3) basados en el título — cada uno como una sugerencia separada.',
        rutina: 'Siempre incluí: cadence="daily", target=1.',
        decision: 'Generá 3 factores relevantes (factor1, factor2, factor3) para decidir sobre el título — cada uno como una sugerencia separada.',
      };
      const templateRule = templateRules[template] ?? "";

      const systemPrompt = `Sos Koru. El usuario está creando un registro de tipo '${template}' con título '${title}'. Sugerí valores para los campos relevantes. ${templateRule} Respondé en JSON con formato: { suggestions: [{ field: string, label: string, value: string }] }`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: `Título: ${title}\nIdioma: ${language}\nGenerá las sugerencias ahora.` },
      ];

      let suggestions: Array<{ field: string; label: string; value: string }> = [];
      try {
        const { callProvider, inferProviderFromModel } = await import("../src/server/koruBackend.ts");
        const pp = inferProviderFromModel(config.nvidiaModel);
        // 🔴 Timeout 10s estricto: Promise.race con timeout absoluto.
        // callProvider internamente también respeta timeoutMs (min con 10s),
        // pero el race garantiza el techo incluso si hay retries/fallbacks.
        const result = await Promise.race([
          callProvider(config, messages, 10_000, false, pp),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("ai-assist-timeout")), 10_000),
          ),
        ]);
        const content = (result.message as any).content?.trim() ?? "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && Array.isArray(parsed.suggestions)) {
            suggestions = parsed.suggestions
              .filter((s: any) => s && typeof s.field === "string" && typeof s.value === "string")
              .map((s: any) => ({
                field: String(s.field),
                label: String(s.label ?? s.field),
                value: String(s.value),
              }));
          }
        }
      } catch (llmErr: any) {
        // Si el LLM falla (timeout, error de red, JSON inválido, etc.),
        // devolvemos suggestions vacías — el botón simplemente no muestra nada.
        console.error("[ai-assist] LLM failed:", llmErr?.message);
      }

      sendJson(res, 200, { suggestions });
    } catch (err: any) {
      console.error("[ai-assist] Error:", err?.message);
      // Error outer: también devolvemos suggestions vacías para no romper el UI.
      sendJson(res, 200, { suggestions: [] });
    }
    return;
  }

  // ── /koru-audit/log (auditoría QA) ───────────────────────────
  if (url === "/koru-audit/log" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const event = JSON.parse(raw || "{}");
      // Best-effort: append to log file
      const logDir = join(PROJECT_ROOT, "manual-audits");
      if (!existsSync(logDir)) {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(logDir, { recursive: true });
      }
      const { appendFileSync } = await import("node:fs");
      appendFileSync(join(logDir, "koru-current.jsonl"), JSON.stringify(event) + "\n");
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 200, { ok: true }); // Best-effort
    }
    return;
  }

  // ── /api/koru/export-pdf — export chat session to real PDF (puppeteer) ──
  if (url === "/api/koru/export-pdf" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      if (!body.turns || !Array.isArray(body.turns)) {
        sendJson(res, 400, { error: "Falta 'turns' en el payload" });
        return;
      }
      const { buildPdfHtml, renderPdf } = await import("../src/server/pdfExport.ts");
      const html = buildPdfHtml({
        title: body.title || "Conversación con Koru",
        userName: body.userName || "",
        language: body.language === "en" ? "en" : "es",
        turns: body.turns,
        generatedAt: body.generatedAt || new Date().toISOString(),
        deliverableOnly: !!body.deliverableOnly,
        blockType: body.blockType,
      });
      // 🔴 v2: render to real PDF binary via headless Chromium.
      // Falls back to HTML if puppeteer fails (e.g. sandbox issue).
      try {
        const pdfBuffer = await renderPdf(html, { format: body.format === "Letter" ? "Letter" : "A4" });
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="koru-${Date.now()}.pdf"`,
          "Cache-Control": "no-store",
          "Content-Length": pdfBuffer.length,
        });
        res.end(pdfBuffer);
      } catch (pdfErr: any) {
        console.error("[export-pdf] puppeteer failed, returning HTML fallback:", pdfErr?.message);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(html);
      }
    } catch (err: any) {
      console.error("[export-pdf]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error generando PDF" });
    }
    return;
  }

  // ── /api/koru/export-deliverable — export a SINGLE block as PDF ──
  // Body: { block: UiBlock, userName?, language?, title? }
  // Renders just that one deliverable (plan / recipe / comparison / etc.)
  // without the surrounding chat — much cleaner for sharing.
  if (url === "/api/koru/export-deliverable" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      if (!body.block || typeof body.block !== "object") {
        sendJson(res, 400, { error: "Falta 'block' en el payload" });
        return;
      }
      const { buildPdfHtml, renderPdf } = await import("../src/server/pdfExport.ts");
      // Wrap the single block as a "turn" with one item — deliverableOnly mode
      // will render only the items, ignoring the turn wrapper.
      const turns = [{
        role: "koru" as const,
        text: "",
        items: [body.block],
      }];
      const html = buildPdfHtml({
        title: body.title || body.block.title || "Informe de Koru",
        userName: body.userName || "",
        language: body.language === "en" ? "en" : "es",
        turns,
        generatedAt: body.generatedAt || new Date().toISOString(),
        deliverableOnly: true,
        blockType: body.block.type,
      });
      try {
        const pdfBuffer = await renderPdf(html);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="koru-deliverable-${Date.now()}.pdf"`,
          "Cache-Control": "no-store",
          "Content-Length": pdfBuffer.length,
        });
        res.end(pdfBuffer);
      } catch (pdfErr: any) {
        console.error("[export-deliverable] puppeteer failed, returning HTML:", pdfErr?.message);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(html);
      }
    } catch (err: any) {
      console.error("[export-deliverable]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error generando PDF del deliverable" });
    }
    return;
  }

  // ── /api/integrations/google-calendar/callback ───────────────────
  // OAuth redirect URI. Google redirige acá con ?code=XXX tras el consent.
  // 1. exchangeCodeForToken(code) → access_token + refresh_token.
  // 2. Persiste tokens en koru-integrations.json + actualiza in-memory cache.
  // 3. Devuelve HTML que escribe `googleCalendar: "connected"` en localStorage
  //    (mismo origen → el popup comparte localStorage con la app) y luego
  //    cierra la pestaña con window.close().
  // El frontend (SettingsScreen) está polleando localStorage cada 2s y
  // actualiza el badge a "Conectado ✓" cuando ve el flag.
  if (url.startsWith("/api/integrations/google-calendar/callback") && req.method === "GET") {
    try {
      const parsedUrl = new URL(url, "http://localhost");
      const code = parsedUrl.searchParams.get("code");
      const oauthError = parsedUrl.searchParams.get("error");

      // Google puede mandar ?error=access_denied si el usuario cancela.
      if (oauthError) {
        const errHtml = `<!doctype html><html lang="es"><body style="font-family:system-ui;padding:24px">
<p>No se conectó Google Calendar: ${oauthError}</p>
<script>window.close();</script>
</body></html>`;
        sendHtml(res, 400, errHtml);
        return;
      }
      if (!code) {
        const errHtml = `<!doctype html><html lang="es"><body style="font-family:system-ui;padding:24px">
<p>Falta el parámetro <code>code</code> en el callback de OAuth.</p>
<script>window.close();</script>
</body></html>`;
        sendHtml(res, 400, errHtml);
        return;
      }

      // Intercambio single-use: si falla la red a mitad de camino NO hay
      // retry (exchangeCodeForToken ya tiene retries:0).
      const tokens = await exchangeCodeForToken(code);

      // Persistir tokens en disco + in-memory cache.
      integrationsCache.googleCalendar = {
        connected: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        connectedAt: new Date().toISOString(),
      };
      persistIntegrations();

      // HTML que escribe el flag en localStorage y cierra el popup.
      // El popup está en el mismo origen que la app (la redirect URI es
      // nuestro propio server), así que comparten localStorage.
      const okHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Google Calendar conectado</title></head>
<body style="font-family:system-ui;padding:24px;text-align:center">
<p>Google Calendar conectado. Podés cerrar esta pestaña.</p>
<script>
try {
  var raw = localStorage.getItem('koru.integrations');
  var parsed = raw ? JSON.parse(raw) : {};
  parsed.googleCalendar = 'connected';
  localStorage.setItem('koru.integrations', JSON.stringify(parsed));
} catch (e) { /* noop */ }
window.close();
</script>
</body></html>`;
      sendHtml(res, 200, okHtml);
    } catch (err: any) {
      console.error("[google-calendar/callback]", err?.message);
      const errHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:system-ui;padding:24px;text-align:center">
<p>No se pudo conectar Google Calendar: ${escapeHtml(err?.message ?? "Error desconocido")}</p>
<script>window.close();</script>
</body></html>`;
      sendHtml(res, 500, errHtml);
    }
    return;
  }

  // ── /api/integrations/google-calendar/status ─────────────────────
  // Devuelve { connected: boolean, connectedAt?: string } basado en el
  // cache en memoria. Es el source-of-truth server-side — el frontend
  // puede consultarlo como fallback del flag en localStorage.
  if (url.startsWith("/api/integrations/google-calendar/status") && req.method === "GET") {
    const gc = integrationsCache.googleCalendar;
    sendJson(res, 200, {
      connected: !!gc?.connected,
      connectedAt: gc?.connectedAt,
    });
    return;
  }

  // ── Static files (serve dist/ with in-memory cache) ──────────
  if (req.method === "GET") {
    const distDir = join(PROJECT_ROOT, "dist");
    let filePath = join(distDir, url === "/" ? "index.html" : url);
    // Security: prevent path traversal
    if (!filePath.startsWith(distDir)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    // Check if file exists and is directory
    try {
      const { statSync } = await import("node:fs");
      const s = statSync(filePath);
      if (s.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      // File not found → SPA fallback to index.html
      filePath = join(distDir, "index.html");
    }
    // Use cache
    const cached = getStaticFile(filePath);
    if (cached) {
      res.writeHead(200, { "Content-Type": cached.contentType, "Cache-Control": "no-cache" });
      res.end(cached.data);
      return;
    }
    // File doesn't exist
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────
  sendJson(res, 404, { error: "Not found", url });
}

// ── Cache static files in memory (avoid disk I/O on every request) ──
const staticCache = new Map<string, { data: Buffer; contentType: string }>();
const STATIC_DIR = join(PROJECT_ROOT, "dist");

function getStaticFile(filePath: string): { data: Buffer; contentType: string } | null {
  if (staticCache.has(filePath)) return staticCache.get(filePath)!;
  try {
    const data = readFileSync(filePath);
    const ext = filePath.endsWith(".html") ? "text/html"
      : filePath.endsWith(".js") ? "application/javascript"
      : filePath.endsWith(".css") ? "text/css"
      : filePath.endsWith(".png") ? "image/png"
      : filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") ? "image/jpeg"
      : filePath.endsWith(".svg") ? "image/svg+xml"
      : filePath.endsWith(".json") ? "application/json"
      : filePath.endsWith(".woff") ? "font/woff"
      : filePath.endsWith(".woff2") ? "font/woff2"
      : filePath.endsWith(".mp4") ? "video/mp4"
      : filePath.endsWith(".webm") ? "video/webm"
      : filePath.endsWith(".webp") ? "image/webp"
      : filePath.endsWith(".gif") ? "image/gif"
      : filePath.endsWith(".ico") ? "image/x-icon"
      : "application/octet-stream";
    const entry = { data, contentType: ext };
    // Limit cache to 50 files to avoid memory bloat — but NOT for videos (too big)
    if (staticCache.size < 50 && data.length < 5_000_000) staticCache.set(filePath, entry);
    return entry;
  } catch {
    return null;
  }
}

// ── Graceful shutdown ──
function shutdown(signal: string) {
  console.log(`[Koru] ${signal} received, shutting down...`);
  server.close(() => {
    console.log("[Koru] Server closed.");
    process.exit(0);
  });
  // Force exit after 5s if connections don't close
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Catch uncaught errors (don't crash) ──
process.on("uncaughtException", (err) => {
  console.error("[Koru] Uncaught exception:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[Koru] Unhandled rejection:", err);
});

// ── Memory monitoring (log if getting close to limit) ──
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > 400) {
    console.warn(`[Koru] Memory warning: ${Math.round(used)}MB heap used`);
  }
}, 60000);

// ── Levantar el server sólo si este archivo es el entrypoint (no cuando
//    lo importan los tests). ESM no tiene `require.main === module`, así que
//    comparamos import.meta.url con el path del argv[1].
const __isMain = (() => {
  try {
    if (typeof process.argv[1] !== "string") return false;
    return fileURLToPath(import.meta.url) === (process.argv[1].startsWith("file:") ? fileURLToPath(process.argv[1]) : fileURLToPath(`file://${process.argv[1]}`));
  } catch {
    return false;
  }
})();

if (__isMain) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Koru] Running on http://localhost:${PORT}`);
    console.log(`[Koru] Provider: ${config.nvidiaApiKey ? "nvidia" : "none"}`);
    console.log(`[Koru] Model: ${config.nvidiaModel}`);
    console.log(`[Koru] Memory limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
  });
}
