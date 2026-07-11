/**
 * Fase 3.11 — Backend Express independiente de Vite.
 *
 * Este archivo extrae los middlewares de koruBackend del vite.config.ts
 * a un proceso Express independiente, habilitando deploy a Railway/Fly.io.
 *
 * Uso:
 *   npm run server  → arranca en puerto 3001
 *   npm run dev     → arranca Vite en :3000 (proxy a :3001)
 *
 * Pendiente: migrar todos los middlewares de vite.config.ts acá.
 * Por ahora es un stub que demuestra la arquitectura.
 */
import http from "node:http";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const server = http.createServer((req, res) => {
  // Health check
  if (req.url === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      service: "koru-backend",
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // TODO: migrar middlewares de vite.config.ts:
  // - /api/koru/models
  // - /api/koru/turn (NDJSON streaming)
  // - /api/koru/asr
  // - /api/koru/vlm
  // - /koru-ai/* (proxy FreeLLMAPI)
  // - /koru-web/* (proxy web search)

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", url: req.url }));
});

server.listen(PORT, () => {
  console.log(`[Koru Backend] Running on http://localhost:${PORT}`);
  console.log(`[Koru Backend] Health check: http://localhost:${PORT}/api/health`);
});
