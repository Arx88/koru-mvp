// Simple Koru server — static files + API proxy
// Serves dist/ for frontend, proxies /api/ to backend
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const PORT = 3000;
const ROOT = process.cwd();
const DIST = join(ROOT, "dist");

// Load .env
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...v] = t.split("=");
    process.env[k.trim()] = v.join("=").trim();
  }
}

// Import backend
const { runKoruBackendTurn } = await import("./server-bundle.mjs");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url || "/";

  // API: /api/koru/turn
  if (url === "/api/koru/turn" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      const request = JSON.parse(raw);
      const config = {
        nvidiaApiKey: process.env.NVIDIA_API_KEY,
        nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com",
        nvidiaModel: process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
        nvidiaFastModel: process.env.NVIDIA_FAST_MODEL || "stepfun-ai/step-3.5-flash",
        openRouterKeys: [], openRouterModels: [],
      };
      if (request.stream) {
        res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "Connection": "keep-alive" });
        const onChunk = (chunk) => res.write(JSON.stringify(chunk) + "\n");
        const result = await runKoruBackendTurn(request, config, onChunk);
        res.write(JSON.stringify(result) + "\n");
        res.end();
      } else {
        const result = await runKoruBackendTurn(request, config);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      }
    } catch (e) {
      console.error("[turn]", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: /api/koru/models
  if (url === "/api/koru/models" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ models: [{ id: process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b", provider: "nvidia", label: "NVIDIA Nemotron 3 Ultra" }] }));
    return;
  }

  // API: /api/health
  if (url === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", model: process.env.NVIDIA_MODEL }));
    return;
  }

  // Static files
  if (req.method === "GET") {
    let filePath = join(DIST, url === "/" ? "index.html" : url);
    if (!existsSync(filePath)) {
      filePath = join(DIST, "index.html"); // SPA fallback
    } else if (statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    try {
      const data = readFileSync(filePath);
      const ext = Object.keys(MIME).find(e => filePath.endsWith(e)) || ".html";
      res.writeHead(200, { "Content-Type": MIME[ext], "Cache-Control": "no-cache" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Koru on http://localhost:${PORT}`);
  console.log(`📦 Static: ${DIST}`);
  console.log(`🤖 NVIDIA: ${process.env.NVIDIA_API_KEY ? "configured" : "NOT configured"}`);
});
