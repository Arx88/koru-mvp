import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { runKoruBackendTurn, type KoruBackendTurnRequest, type ProviderConfig } from "./src/server/koruBackend";

const PORT = 3000;
const DIST = join(process.cwd(), "dist");

const config: ProviderConfig = {
  nvidiaApiKey: process.env.NVIDIA_API_KEY?.trim(),
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
  nvidiaModel: process.env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
  nvidiaFastModel: process.env.NVIDIA_FAST_MODEL?.trim() || "stepfun-ai/step-3.5-flash",
  openRouterKeys: [],
  openRouterModels: [],
  minimaxAccessToken: undefined,
  bluesmindsKeys: [],
  bluesmindsModel: "mimo-v2.5",
  ollamaEmbedBaseUrl: undefined,
};

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  const url = req.url || "/";
  console.log(`${new Date().toISOString()} ${req.method} ${url}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // API: /api/koru/turn
  if (url === "/api/koru/turn" && req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      const request = JSON.parse(raw || "{}") as KoruBackendTurnRequest & { stream?: boolean; model?: string };
      if (request.model) (request as any).model = request.model;
      if (!request.input?.trim() || !request.state || !Array.isArray(request.history)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload incompleto." }));
        return;
      }

      const streamEnabled = request.stream === true;
      if (streamEnabled) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const onChunk = (chunk: any) => res.write(JSON.stringify(chunk) + "\n");
        const result = await runKoruBackendTurn(request, config, onChunk);
        res.write(JSON.stringify(result) + "\n");
        res.end();
      } else {
        const result = await runKoruBackendTurn(request, config);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      }
    } catch (error) {
      console.error("Turn error:", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Server error" }));
    }
    return;
  }

  // API: /api/koru/models
  if (url === "/api/koru/models" && req.method === "GET") {
    const models: any[] = [];
    if (config.nvidiaApiKey) {
      models.push({ id: config.nvidiaModel, provider: "nvidia", label: "NVIDIA Nemotron 3 Ultra" });
    }
    models.push(
      { id: "koru-qwen-32k:latest", provider: "ollama", label: "Koru Qwen 32k" },
      { id: "qwen3.6:27b", provider: "ollama", label: "Qwen 3.6 27B" },
    );
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ models }));
    return;
  }

  // Static files
  let filePath = join(DIST, url === "/" ? "index.html" : url);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // SPA fallback
    filePath = join(DIST, "index.html");
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Koru production server running on http://localhost:${PORT}/`);
  console.log(`📦 Serving dist/ with backend API`);
  console.log(`🤖 NVIDIA: ${config.nvidiaApiKey ? "configured" : "NOT configured"}`);
  console.log(`🧠 Model: ${config.nvidiaModel}\n`);
});
