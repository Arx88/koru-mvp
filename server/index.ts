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
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runKoruBackendTurn, type KoruBackendTurnRequest, type ProviderConfig } from "../src/server/koruBackend.ts";

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
    openRouterModels: (env.OPENROUTER_FALLBACK_MODELS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    minimaxAccessToken: env.MINIMAX_ACCESS_TOKEN?.trim(),
    ollamaEmbedBaseUrl: env.OLLAMA_EMBED_BASE_URL?.trim() || undefined,
  };
}

const config = buildConfig();

// Helper: read body as string
async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8");
}

// Helper: send JSON
function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = req.url ?? "";

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
      sendJson(res, 500, { error: err?.message ?? "Error de ASR" });
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
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no", // Render/nginx: no buffer
      });

      // Heartbeat: cada 5s enviar un comentario para mantener la conexión
      const heartbeat = setInterval(() => {
        try { res.write("\n"); } catch {}
      }, 5000);

      const onChunk = (chunk: any) => {
        try { res.write(JSON.stringify(chunk) + "\n"); } catch {}
      };

      try {
        const result = await runKoruBackendTurn(request, config as any, onChunk);
        clearInterval(heartbeat);
        try { res.write(JSON.stringify(result) + "\n"); } catch {}
      } catch (err: any) {
        clearInterval(heartbeat);
        const errorResponse = {
          error: err?.message ?? "Error interno",
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
      res.end();
    } catch (err: any) {
      console.error("[koru-turn]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error interno" });
    }
    return;
  }

  // ── /api/debug/weather — debug weather fetch ────────────────
  if (url.startsWith("/api/debug/weather") && req.method === "GET") {
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
});

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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Koru] Running on http://localhost:${PORT}`);
  console.log(`[Koru] Provider: ${config.nvidiaApiKey ? "nvidia" : "none"}`);
  console.log(`[Koru] Model: ${config.nvidiaModel}`);
  console.log(`[Koru] Memory limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
});
