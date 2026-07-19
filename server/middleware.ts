/**
 * Task 9-ENG-FIX-v2 — Middleware de seguridad para server/index.ts.
 *
 * - corsOrigin(req): whitelist estricta. Devuelve el origen si está
 *   permitido, undefined si no. Reemplaza el `Access-Control-Allow-Origin: "*"`
 *   que exponía todos los endpoints a cualquier sitio web.
 * - rateLimitAllow(req): Map<ip, {count, resetAt}> en memoria. 30 req/min por IP
 *   para los endpoints costosos (/api/koru/turn, /api/koru/vlm, /api/koru/asr,
 *   /koru-audit/log).
 * - isAuthorized(req): si KORU_API_KEY está seteada, exige
 *   `Authorization: Bearer <key>` en /api/koru/*. Si no está seteada, loggea
 *   warning en startup y permite todo (modo dev-friendly).
 * - securityHeaders(res): headers defensivos estándar (X-Content-Type-Options,
 *   X-Frame-Options, Referrer-Policy, Permissions-Policy).
 */
import type http from "node:http";

// Whitelist de orígenes permitidos.
const CORS_WHITELIST = new Set<string>([
  "https://koru-mvp.onrender.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
]);

export function corsOrigin(req: http.IncomingMessage): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === "string" && CORS_WHITELIST.has(origin)) return origin;
  return undefined;
}

// ── Rate limiter en memoria ────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const RATE_LIMITED_PATHS = new Set([
  "/api/koru/turn",
  "/api/koru/vlm",
  "/api/koru/asr",
  "/koru-audit/log",
]);

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.resetAt < now) rateBuckets.delete(ip);
  }
}, 300_000).unref();

export function rateLimitAllow(req: http.IncomingMessage): boolean {
  const url = req.url ?? "";
  const path = url.split("?")[0];
  if (!RATE_LIMITED_PATHS.has(path)) return true;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT_MAX;
}

// ── API key opcional ───────────────────────────────────────────────────
const KORU_API_KEY = process.env.KORU_API_KEY?.trim();

if (!KORU_API_KEY) {
  console.warn("[koru] KORU_API_KEY no seteada — /api/koru/* endpoints permiten acceso anónimo. Seteala en prod.");
}

export function isAuthorized(req: http.IncomingMessage): boolean {
  if (!KORU_API_KEY) return true;
  const url = req.url ?? "";
  if (!url.startsWith("/api/koru/")) return true;
  const auth = req.headers.authorization ?? "";
  const expected = `Bearer ${KORU_API_KEY}`;
  return auth === expected;
}

// ── HTTP security headers (Task 10-P2-FIX, P2-4) ──────────────────────
export function securityHeaders(res: http.ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}
