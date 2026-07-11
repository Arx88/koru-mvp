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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Load .env manually (no dotenv dependency)
function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
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
    nvidiaFastModel: env.NVIDIA_FAST_MODEL?.trim() || "stepfun-ai/step-3.5-flash",
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
  if (url === "/api/health" && req.method === "GET") {
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
  if (url === "/api/koru/models" && req.method === "GET") {
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

      // Import dinámico del backend (evita cargar todo al startup)
      const koruBackend = await import("./src/server/koruBackend.js");
      const streamEnabled = request.stream === true;

      if (streamEnabled) {
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        const onChunk = (chunk: any) => {
          res.write(JSON.stringify(chunk) + "\n");
        };
        const result = await koruBackend.runKoruBackendTurn(request, config as any, onChunk);
        res.end();
      } else {
        const result = await koruBackend.runKoruBackendTurn(request, config as any);
        sendJson(res, 200, result);
      }
    } catch (err: any) {
      console.error("[koru-turn]", err?.message);
      sendJson(res, 500, { error: err?.message ?? "Error interno" });
    }
    return;
  }

  // ── /koru-audit/log (auditoría QA) ───────────────────────────
  if (url === "/koru-audit/log" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const event = JSON.parse(raw || "{}");
      // Best-effort: append to log file
      const logDir = join(__dirname, "..", "manual-audits");
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

  // ── 404 ───────────────────────────────────────────────────────
  sendJson(res, 404, { error: "Not found", url });
});

server.listen(PORT, () => {
  console.log(`[Koru Backend] Running on http://localhost:${PORT}`);
  console.log(`[Koru Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[Koru Backend] Provider: ${config.nvidiaApiKey ? "nvidia" : "none"}`);
  console.log(`[Koru Backend] Model: ${config.nvidiaModel}`);
});
