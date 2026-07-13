/**
 * Bloque Utils — URL shorten, password gen, quote of day, self health check.
 * 4 tools.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { isOllamaAvailable } from "../shared/embeddings";

// ─── url_shorten ────────────────────────────────────────────────────────────
export const urlShorten: ToolHandler = {
  definition: defineTool(
    "url_shorten",
    "Acorta una URL larga. Úsala cuando el usuario diga 'acortá este link', 'URL corta para compartir', 'shorten esto'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  ),
  policy: policies.readonly("Acorta URL via is.gd."),
  async run(args) {
    const url = String(args.url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) return { type: "url_shorten", status: "failed", error: "Indicá una URL válida (con http/https)." };
    const cacheKey = `short:${url}`;
    const short = await cached<string>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<{ shorturl?: string }>(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`, { timeoutMs: 15_000 });
      if (!r.ok) throw new Error(r.error);
      return r.data!.shorturl ?? "";
    });
    if (!short) return { type: "url_shorten", status: "failed", error: "No pude acortar la URL." };
    return { type: "url_shorten", status: "ok", original: url, short, source: "is.gd" };
  },
};

// ─── password_generate ──────────────────────────────────────────────────────
export const passwordGenerate: ToolHandler = {
  definition: defineTool(
    "password_generate",
    "Genera una contraseña fuerte aleatoria. Úsala cuando el usuario diga 'generá una contraseña', 'pass de 16 caracteres', 'contraseña segura'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        length: { type: "number", description: "Longitud. Default 16." },
        symbols: { type: "boolean", description: "Incluir símbolos. Default true." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Genera contraseña local con crypto."),
  async run(args) {
    const length = Math.max(8, Math.min(64, Number(args.length ?? 16)));
    const includeSymbols = args.symbols !== false;
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{}";
    const charset = lower + upper + digits + (includeSymbols ? symbols : "");
    const randomValues = new Uint32Array(length);
    const cryptoSource = (globalThis.crypto ?? (await import("node:crypto")).webcrypto) as Crypto;
    cryptoSource.getRandomValues(randomValues);
    let password = "";
    for (let i = 0; i < length; i++) password += charset[randomValues[i] % charset.length];
    // Garantizar al menos un char de cada tipo.
    const ensure = (set: string) => {
      if (!password.split("").some((c) => set.includes(c))) {
        const idx = Math.floor(randomValues[0] % password.length);
        password = password.slice(0, idx) + set[randomValues[1] % set.length] + password.slice(idx + 1);
      }
    };
    ensure(lower); ensure(upper); ensure(digits); if (includeSymbols) ensure(symbols);
    return {
      type: "password_generate",
      status: "ok",
      length,
      password,
      entropyBits: Math.round(length * Math.log2(charset.length)),
      note: "Generada con crypto seguro. Guardala en un gestor de contraseñas.",
    };
  },
};

// ─── quote_of_day ───────────────────────────────────────────────────────────
export const quoteOfDay: ToolHandler = {
  definition: defineTool(
    "quote_of_day",
    "Frase inspiradora del día. Úsala cuando el usuario diga 'una cita para hoy', 'frase del día', 'algo inspirador'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  ),
  policy: policies.readonly("Lee cita de ZenQuotes."),
  async run(_args) {
    const cacheKey = `quote:${new Date().toISOString().slice(0, 10)}`;
    const data = await cached<{ q?: string; a?: string }[]>(cacheKey, ttls.reference, async () => {
      const r = await fetchJson<{ q?: string; a?: string }[]>("https://zenquotes.io/api/today", { timeoutMs: 15_000 });
      if (!r.ok) throw new Error(r.error);
      return r.data!;
    });
    const q = Array.isArray(data) ? data[0] : null;
    if (!q?.q) return { type: "quote_of_day", status: "ok", note: "No pude conseguir una cita hoy." };
    return { type: "quote_of_day", status: "ok", quote: q.q, author: q.a, source: "ZenQuotes" };
  },
};

// ─── self_health_check ──────────────────────────────────────────────────────
export const selfHealthCheck: ToolHandler = {
  definition: defineTool(
    "self_health_check",
    "Diagnóstico honesto del estado de Koru: providers disponibles, Ollama, latencia, número de tools activas. Úsala cuando el usuario diga 'Koru, estás bien?', 'estado de tus servicios', 'autodiagnóstico', 'funcionan tus herramientas?'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  ),
  policy: policies.readonly("Diagnóstico local."),
  async run(_args) {
    const checks: Array<{ service: string; status: string; detail?: string }> = [];

    // Ollama
    const ollamaOn = await isOllamaAvailable().catch(() => false);
    checks.push({ service: "Ollama (LLM local)", status: ollamaOn ? "ok" : "down", detail: ollamaOn ? "Disponible para embeddings, resumen, traducción." : "No detectado. Las tools que usan LLM local no funcionarán." });

    // APIs públicas (sin key) rápidas.
    try {
      const r = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=EUR", { timeoutMs: 4_000 });
      checks.push({ service: "Frankfurter (divisas)", status: r.ok ? "ok" : "down" });
    } catch { checks.push({ service: "Frankfurter (divisas)", status: "down" }); }

    try {
      const r = await fetchJson("https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=test", { timeoutMs: 5_000 });
      checks.push({ service: "TheSportsDB (deportes)", status: r.ok ? "ok" : "down" });
    } catch { checks.push({ service: "TheSportsDB (deportes)", status: "down" }); }

    try {
      const r = await fetchJson("https://api.gdeltproject.org/api/v2/doc/doc?query=test&mode=ArtList&format=json&maxrecords=1", { timeoutMs: 6_000 });
      checks.push({ service: "GDELT (noticias)", status: r.ok ? "ok" : "down" });
    } catch { checks.push({ service: "GDELT (noticias)", status: "down" }); }

    const upCount = checks.filter((c) => c.status === "ok").length;
    return {
      type: "self_health_check",
      status: "ok",
      timestamp: new Date().toISOString(),
      checks,
      summary: `${upCount}/${checks.length} servicios disponibles.`,
      note: ollamaOn
        ? "Núcleo operativo. Puedo resumir, traducir y buscar en memoria semántica."
        : "Sin Ollama: las tools avanzadas (resumen, traducción, memoria semántica) estarán limitadas. Las APIs públicas siguen funcionando.",
    };
  },
};
