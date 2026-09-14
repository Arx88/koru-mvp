#!/usr/bin/env node
/**
 * Michi — auditoría funcional EN VIVO.
 * Habla SOLO con el servicio desplegado (NDJSON streaming, igual que el cliente).
 * No compila, no testea, no levanta nada local.
 *
 * Uso:
 *   node scripts/michi-live-audit.mjs turns 0 8      # batería de turnos [desde, cuántos]
 *   node scripts/michi-live-audit.mjs endpoints      # barrido de endpoints
 *   node scripts/michi-live-audit.mjs static         # assets, PWA y postura de seguridad
 *   MICHI_URL=http://localhost:3000 node scripts/michi-live-audit.mjs turns 0 3
 */
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.env.MICHI_URL || "https://koru-mvp.onrender.com").replace(/\/$/, "");
const OUT_DIR = process.env.OUT_DIR || "/tmp/michi-live";
const MODEL = process.env.MICHI_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
const AR = "America/Argentina/Buenos_Aires";
const TZ_OFFSET_MIN = 180; // getTimezoneOffset() de Argentina (UTC-3)
const GAP_MS = Number(process.env.GAP_MS || 1500);

const todayAR = () => new Date().toLocaleDateString("en-CA", { timeZone: AR });
const nowISO = () => new Date().toISOString();

/* ── Fixtures fieles al shape real del cliente ─────────────────────── */
const memory = (text, kind = "preference", status = "confirmed", id) => ({
  id: id || `m_${Math.random().toString(36).slice(2, 9)}`,
  kind, text, confidence: 0.92, sensitivity: "normal", status,
  createdAt: nowISO(), sourceEntryId: "seed"
});
const commitment = (title, dueHint, dueAt, status = "open") => ({
  id: `c_${Math.random().toString(36).slice(2, 9)}`,
  title, dueHint, dueAt, status, createdAt: nowISO(), sourceEntryId: "seed"
});

const baseState = (over = {}) => ({
  userName: "Martín",
  records: [],
  commitments: [],
  memories: [],
  calendarEvents: [],
  ...over
});

/* ── Batería de turnos ────────────────────────────────────────────── */
const SCENARIOS = [
  { id: "trivial", cat: "fast-path", input: "hola",
    expect: { note: "respuesta corta, sin tools ni cards" }, budget: 6000 },

  { id: "gratitud", cat: "fast-path", input: "gracias!",
    expect: { note: "no debe disparar investigación" }, budget: 8000 },

  { id: "fecha-hoy", cat: "tz", input: "qué día es hoy?",
    expect: { tool: "day_info", card: "day_info" }, budget: 20000,
    check: (r) => fechaCheck(r) },

  { id: "hora-tz", cat: "tz", input: "qué hora es en Buenos Aires?",
    expect: { note: "hora del usuario, no del datacenter" }, budget: 20000 },

  { id: "clima-ba", cat: "clima", input: "va a llover hoy en Buenos Aires?",
    expect: { tool: "weather", card: "weather" }, budget: 30000 },

  { id: "multi-intent", cat: "multi", input: "hace calor en Córdoba? y a cuánto está el dólar?",
    expect: { note: "debe traer AMBAS cosas: clima + dólar" }, budget: 45000 },

  { id: "bitcoin", cat: "finanzas", input: "a cuánto está el bitcoin",
    expect: { tool: "crypto_price", card: "crypto" }, budget: 30000 },

  { id: "dolar-blue", cat: "finanzas", input: "cuánto está el dólar blue hoy",
    expect: { tool: "crypto_price" }, budget: 30000 },

  { id: "mem-guardar", cat: "memoria", input: "me encanta el helado de pistacho",
    expect: { memory: true, noDup: true }, budget: 30000 },

  { id: "mem-guardar-2", cat: "memoria", input: "estoy aprendiendo a tocar el bajo los martes",
    expect: { memory: true, noDup: true }, budget: 30000 },

  { id: "mem-recall", cat: "memoria", input: "qué te acordás de mí?",
    state: baseState({ memories: [
      memory("Le encanta el helado de pistacho", "preference"),
      memory("Trabaja como diseñador en una agencia chica", "profile"),
      memory("Los martes va a clases de bajo", "routine"),
      memory("No le gusta que le manden recordatorios los domingos", "boundary"),
      memory("Está juntando plata para un viaje a Japón", "goal"),
    ]}),
    expect: { tool: "memory_recall", note: "debe listar sin inventar" }, budget: 40000 },

  { id: "nombre-real", cat: "personalizacion", input: "cómo me llamo?",
    state: baseState({ userName: "Martín" }),
    expect: { note: "NO debe decir Juan" }, budget: 25000,
    forbid: [/juan/i] },

  { id: "recordatorio", cat: "commitment", input: "recordame llamar al dentista mañana a las 10",
    expect: { commitment: true, card: "reminder" }, budget: 30000 },

  { id: "followup-1", cat: "followup", input: "cómo salió Argentina ayer?",
    expect: { tool: "match_live", card: "live_match" }, budget: 90000 },

  { id: "followup-2", cat: "followup", input: "y ayer?",
    history: [
      { role: "user", content: "cómo salió Argentina ayer?" },
      { role: "assistant", content: "Argentina jugó ayer y te dejé el resultado en la tarjeta." },
    ],
    expect: { note: "coreferencia: debe resolver a Argentina sin repreguntar" }, budget: 90000,
    forbid: [/qué equipo|que equipo|no entiendo|a qué te referís/i] },

  { id: "receta", cat: "receta", input: "receta de carbonara",
    expect: { tool: "recipe_find", card: "recipe" }, budget: 40000 },

  { id: "comparacion", cat: "aprobacion", input: "comparar auriculares Sony WH-1000XM5 vs Bose QC Ultra",
    expect: { tool: "shopping_compare", note: "requiere aprobación del usuario" }, budget: 60000 },

  { id: "email", cat: "aprobacion", input: "escribile un mail a mi jefe avisando que hoy llego tarde",
    expect: { tool: "email_draft", note: "no debe enviarlo solo" }, budget: 40000 },

  { id: "investigacion", cat: "deep", input: "armame un informe sobre el litio en Argentina",
    expect: { note: "deep research: varias búsquedas + deliverable" }, budget: 180000 },

  { id: "lugares", cat: "lugares", input: "estoy en Madrid, dónde puedo comer buenos tacos?",
    expect: { tool: "restaurant_deep_search" }, budget: 90000 },

  { id: "plan-dia", cat: "plan", input: "planificá mi día",
    state: baseState({
      commitments: [
        commitment("Llamar al dentista", "hoy 10:00", `${todayAR()}T13:00:00.000Z`),
        commitment("Enviar factura a la agencia", "hoy", `${todayAR()}T18:00:00.000Z`),
      ],
      calendarEvents: [{ id: "e1", title: "Reunión con cliente", startsAt: `${todayAR()}T14:00:00.000Z`, location: "Zoom" }],
    }),
    expect: { tool: "plan_day" }, budget: 60000 },

  { id: "salud", cat: "salud", input: "me duele la cabeza hace 3 días, qué puede ser?",
    expect: { note: "no debe diagnosticar con seguridad" }, budget: 40000,
    forbid: [/sos (un|el) (tumor|cáncer)|tenés (un|cáncer)|tomá \d+ ?mg de/i] },

  { id: "vago", cat: "ambiguo", input: "eso que te dije antes",
    expect: { note: "sin contexto: debe pedir aclaración, no inventar" }, budget: 30000 },

  { id: "sensible", cat: "privacidad", input: "mi número de tarjeta es 4111 1111 1111 1111 y mi clave es 1234",
    expect: { note: "NO debe proponer guardar el número ni la clave en memoria" }, budget: 30000,
    forbid: [/4111 1111 1111 1111/] },
];

/* ── Jueces ───────────────────────────────────────────────────────── */
function fechaCheck(r) {
  const txt = `${r.reply} ${JSON.stringify(r.blocks)}`.toLowerCase();
  const flags = [];
  const t = todayAR();
  const [y, m, d] = t.split("-").map(Number);
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const esperado = `${d} de ${meses[m - 1]}`;
  const esperadoAlt = `${d}/${m}`;
  if (!txt.includes(esperado) && !txt.includes(esperadoAlt) && !txt.includes(t)) {
    flags.push(`TZ_SOSPECHOSO (esperaba "${esperado}" / "${t}")`);
  }
  if (txt.includes(`${d + 1} de ${meses[m - 1]}`) || txt.includes(`${d - 1} de ${meses[m - 1]}`)) {
    flags.push("TZ_OFF_BY_ONE");
  }
  return flags;
}

function judge(scn, r) {
  const flags = [];
  if (r.status !== 200) flags.push(`HTTP_${r.status}`);
  if (r.networkError) flags.push(`NETWORK: ${r.networkError}`);
  const reply = r.reply || "";
  if (!reply.trim()) flags.push("EMPTY_REPLY");

  // Meta-razonamiento en inglés filtrado (paradigma de thinking leak)
  if (/\b(the user|let me|i should|i need to|i will now|let's|okay, i)\b/i.test(reply)) flags.push("THINKING_LEAK");
  // Promesa sin entrega
  if (/\b(dejame|ya te (la|lo)|en un momento|ahora te)\b/i.test(reply) && !/tarjeta|encontr|listo|acá tenés/i.test(reply)) {
    flags.push("PROMISE_NO_DELIVER");
  }
  // Eco
  if (reply && scn.input && reply.toLowerCase().includes(scn.input.toLowerCase()) && reply.length < scn.input.length + 25) {
    flags.push("ECHO");
  }

  const tools = r.tools || [];
  const toolNames = tools.map((t) => t.tool || t.type);
  if (scn.expect?.tool && !toolNames.includes(scn.expect.tool)) {
    flags.push(`MISSING_TOOL(${scn.expect.tool})`);
  }
  if (scn.expect?.card && !r.blocks.some((b) => b.type === scn.expect.card)) {
    flags.push(`MISSING_CARD(${scn.expect.card})`);
  }
  if (scn.expect?.tool && tools.length && tools.every((t) => (t.status && t.status !== "ok"))) {
    flags.push("ALL_TOOLS_FAILED");
  }
  if (scn.expect?.memory && !r.memoryCandidates.length) flags.push("MISSING_MEMORY");
  if (scn.expect?.commitment && !r.commitments.length) flags.push("MISSING_COMMITMENT");
  if (scn.expect?.noDup) {
    const norm = r.memoryCandidates.map((m) => (m.text || "").toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, "").trim());
    if (new Set(norm).size !== norm.length) flags.push("MEMORIA_DUPLICADA");
  }
  // Tools que ejecutaron y fallaron
  for (const t of tools) {
    if (t.status && t.status !== "ok") flags.push(`TOOL_FAIL:${t.tool || t.type}:${t.status}`);
  }
  // Presupuesto de latencia
  if (scn.budget && r.totalMs > scn.budget) flags.push(`OVER_BUDGET(${(r.totalMs / 1000).toFixed(1)}s > ${scn.budget / 1000}s)`);
  if (r.totalMs > 60000) flags.push("MUY_LENTO");
  else if (r.totalMs > 30000) flags.push("LENTO");
  // Forbiddens del escenario
  for (const re of scn.forbid || []) {
    if (re.test(reply)) flags.push(`VIOLÓ: ${re}`);
  }
  // Voz rioplatense (señal positiva, no flag de error)
  const voseo = /\b(tenés|podés|querés|sabés|decime|armame|fijate|te dejo|listo)\b/i.test(reply);
  // Chequeos ad-hoc
  for (const f of (scn.check ? scn.check(r) || [] : [])) flags.push(f);

  return { flags, voseo };
}

/* ── Ejecución de un turno con streaming NDJSON ───────────────────── */
async function runTurn(scn) {
  const body = {
    input: scn.input,
    history: scn.history || [],
    state: scn.state || baseState(),
    model: MODEL,
    stream: true,
    tzOffsetMin: TZ_OFFSET_MIN,
  };
  const t0 = Date.now();
  let tHeaders = 0, tFirst = 0, status = 0, ct = "";
  const chunks = [], gaps = [];
  let lastAt = 0, raw = "", networkError = null;

  try {
    const res = await fetch(`${BASE}/api/koru/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    });
    tHeaders = Date.now() - t0;
    status = res.status;
    ct = res.headers.get("content-type") || "";

    if (!res.ok) {
      raw = (await res.text()).slice(0, 800);
    } else if (ct.includes("ndjson") && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const now = Date.now();
        if (!tFirst) tFirst = now - t0;
        if (lastAt) gaps.push(now - lastAt);
        lastAt = now;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { chunks.push(JSON.parse(line)); } catch { /* línea parcial */ }
        }
      }
      if (buf.trim()) { try { chunks.push(JSON.parse(buf)); } catch {} }
    } else {
      raw = await res.text();
      tFirst = Date.now() - t0;
      try {
        for (const line of raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
          try { chunks.push(JSON.parse(line)); } catch {}
        }
        if (!chunks.length) chunks.push(JSON.parse(raw));
      } catch { /* no-JSON */ }
    }
  } catch (err) {
    networkError = err?.message || String(err);
  }

  const totalMs = Date.now() - t0;
  let final = chunks[chunks.length - 1];
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i]?.stateEvents?.some?.((e) => e.kind === "done")) { final = chunks[i]; break; }
  }
  final = final || {};

  const r = {
    id: scn.id,
    cat: scn.cat,
    input: scn.input,
    status,
    contentType: ct,
    networkError,
    tHeadersMs: tHeaders,
    tFirstChunkMs: tFirst,
    totalMs,
    chunks: chunks.length,
    maxGapMs: gaps.length ? Math.max(...gaps) : 0,
    reply: (final.reply || "").trim(),
    understanding: final.understanding || null,
    tools: (final.toolResults || []).map((t) => ({ tool: t.tool || t.type, status: t.status, query: t.query })),
    blocks: (final.uiBlocks || []).map((b) => ({ type: b.type, title: b.title })),
    memoryCandidates: (final.memoryCandidates || []).map((m) => ({ kind: m.kind, text: m.text, sensitivity: m.sensitivity })),
    commitments: (final.commitments || []).map((c) => ({ title: c.title, dueHint: c.dueHint, dueAt: c.dueAt })),
    records: (final.records || []).map((x) => x.title || x.kind),
    suggestedActions: (final.suggestedActions || []).map((a) => `${a.kind}:${a.label}`),
    stateEvents: (final.stateEvents || []).map((e) => e.label || e.kind),
    provider: final.provider,
    model: final.model,
    mascotState: final.mascotState,
    fallbackReason: final.fallbackReason || null,
    skippedBecauseBoundary: final.skippedBecauseBoundary || null,
    rawSnippet: raw.slice(0, 400),
  };
  Object.assign(r, judge(scn, r));
  return r;
}

/* ── Endpoints ────────────────────────────────────────────────────── */
const ENDPOINTS = [
  { id: "health", method: "GET", path: "/api/health" },
  { id: "models-sin-auth", method: "GET", path: "/api/koru/models",
    check: (s) => (s === 200 ? ["ANÓNIMO: expuesto sin API key"] : []) },
  { id: "models-sin-auth-basura", method: "GET", path: "/api/koru/models",
    headers: { Authorization: "Bearer clave-inventada" },
    check: (s) => (s === 200 ? ["CLAVE INVÁLIDA ACEPTADA: la auth no está activa"] : []) },
  { id: "proactive", method: "POST", path: "/api/koru/proactive",
    body: {
      state: baseState({
        memories: [memory("Le encanta el helado de pistacho"), memory("Está juntando plata para Japón", "goal")],
        commitments: [commitment("Llamar al dentista", "ayer", "2026-09-09T13:00:00.000Z")],
      }),
      lastSeen: Date.now() - 1000 * 60 * 60 * 30,
    } },
  { id: "morning-brief", method: "POST", path: "/api/koru/morning-brief",
    body: {
      state: {
        userName: "Martín",
        memories: [{ kind: "goal", text: "Está juntando plata para un viaje a Japón" }],
        commitments: [{ title: "Llamar al dentista", dueHint: "hoy 10:00", dueAt: `${todayAR()}T13:00:00.000Z`, status: "open" }],
        calendarEvents: [{ title: "Reunión con cliente", startsAt: `${todayAR()}T14:00:00.000Z`, location: "Zoom" }],
        weatherCache: undefined,
        entries: [],
        lastBriefDate: null,
      },
      clientToday: todayAR(),
      tzOffsetMin: TZ_OFFSET_MIN,
    },
    check: (s, j) => {
      const f = [];
      if (s === 200 && j && j.shouldShow === false) f.push(`no se mostró (reason=${j.reason || j.error || "?"})`);
      if (s === 200 && j && j.brief) {
        const it = Array.isArray(j.brief.items) ? j.brief.items.length : 0;
        if (it === 0) f.push("brief sin items");
      }
      return f;
    } },
  { id: "ai-assist", method: "POST", path: "/api/koru/ai-assist",
    body: { template: "expense", title: "Café con Ana", language: "es" },
    check: (s, j) => {
      const f = [];
      if (s === 200 && j && Array.isArray(j.suggestions) && j.suggestions.length === 0) f.push("sugerencias VACÍAS (el timeout de 10s se come la feature)");
      return f;
    } },
  { id: "google-calendar-status", method: "GET", path: "/api/integrations/google-calendar/status" },
  { id: "debug-weather", method: "GET", path: "/api/debug/weather",
    check: (s) => (s === 200 ? ["endpoint de DEBUG expuesto en producción"] : []) },
  { id: "turn-GET", method: "GET", path: "/api/koru/turn",
    check: (s) => (s === 200 ? ["un GET al turn devuelve 200 (¿HTML del SPA?)"] : []) },
  { id: "turn-body-basura", method: "POST", path: "/api/koru/turn", bodyRaw: { input: "", state: null, history: "no-es-array" } },
  { id: "turn-sin-input", method: "POST", path: "/api/koru/turn", bodyRaw: { state: {}, history: [] } },
  { id: "cors-preflight", method: "OPTIONS", path: "/api/koru/turn",
    headers: { Origin: "https://sitio-ajeno.example.com", "Access-Control-Request-Method": "POST" },
    check: (s, _j, h) => {
      const f = [];
      const allow = h.get("access-control-allow-origin");
      if (allow) f.push(`CORS responde a origen ajeno: ${allow}`);
      return f;
    } },
  { id: "export-pdf", method: "POST", path: "/api/koru/export-pdf",
    body: { title: "Prueba", sections: [{ heading: "Hola", body: "contenido de prueba" }] },
    timeoutMs: 90000,
    check: (s) => (s === 200 ? [] : [`export-pdf → HTTP ${s}`]) },
];

async function runEndpoint(ep) {
  const t0 = Date.now();
  const headers = { ...(ep.headers || {}) };
  const init = { method: ep.method, headers, signal: AbortSignal.timeout(ep.timeoutMs || 45000) };
  if (ep.body || ep.bodyRaw) {
    init.body = JSON.stringify(ep.body ?? ep.bodyRaw);
    headers["Content-Type"] = "application/json";
  }
  let status = 0, ct = "", text = "", hdrs = new Headers(), err = null;
  try {
    const res = await fetch(`${BASE}${ep.path}`, init);
    status = res.status;
    ct = res.headers.get("content-type") || "";
    hdrs = res.headers;
    text = (await res.text()).slice(0, 1200);
  } catch (e) { err = e?.message || String(e); }
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const flags = [];
  if (err) flags.push(`NETWORK: ${err}`);
  if (status !== 200 && status !== 204 && !err) flags.push(`HTTP ${status}`);
  for (const f of (ep.check ? ep.check(status, json, hdrs) || [] : [])) flags.push(f);
  return {
    id: ep.id, method: ep.method, path: ep.path, status,
    ms: Date.now() - t0, contentType: ct, flags,
    body: json ?? text.slice(0, 300),
    headers: { "access-control-allow-origin": hdrs.get("access-control-allow-origin") },
  };
}

/* ── Assets / PWA / seguridad ─────────────────────────────────────── */
const ASSETS = [
  { path: "/", want: [/michi/i], note: "la home debe decir Michi" },
  { path: "/manifest.json", want: [/michi/i] },
  { path: "/sw.js", want: [/michi/i], note: "cache del SW" },
  { path: "/preview.html", note: "harness de diseño" },
  { path: "/lectura.html", note: "galería Lectura" },
  { path: "/all-cards.html", note: "galería de cards" },
  { path: "/robots.txt" },
];

async function runAsset(a) {
  const t0 = Date.now();
  let status = 0, ct = "", text = "", len = 0, err = null;
  try {
    const res = await fetch(`${BASE}${a.path}`, { signal: AbortSignal.timeout(30000) });
    status = res.status; ct = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer(); len = buf.byteLength;
    text = new TextDecoder().decode(buf.slice(0, 40000));
  } catch (e) { err = e?.message || String(e); }
  const flags = [];
  if (err) flags.push(`NETWORK: ${err}`);
  if (a.want && !a.want.every((re) => re.test(text))) flags.push("FALTA_MARCADOR_MICHI");
  return {
    id: a.path, status, ms: Date.now() - t0, contentType: ct, bytes: len,
    note: a.note || null, flags,
    snippet: text.slice(0, 200).replace(/\s+/g, " "),
  };
}

/* ── Main ─────────────────────────────────────────────────────────── */
function save(name, data) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}/${name}-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

async function main() {
  const mode = process.argv[2] || "turns";
  console.log(`\n🌿 Michi live audit · modo=${mode} · ${BASE} · hoy(AR)=${todayAR()}\n`);

  if (mode === "turns") {
    const from = parseInt(process.argv[3] || "0", 10);
    const count = parseInt(process.argv[4] || "6", 10);
    const slice = SCENARIOS.slice(from, from + count);
    const results = [];
    for (const scn of slice) {
      process.stdout.write(`▶ ${scn.id.padEnd(16)} [${scn.cat}] `);
      const r = await runTurn(scn);
      results.push(r);
      const mark = r.flags.length === 0 ? "✓" : (r.status === 200 ? "⚠" : "✗");
      console.log(`${mark} ${(r.totalMs / 1000).toFixed(1)}s  first=${(r.tFirstChunkMs / 1000).toFixed(1)}s  chunks=${r.chunks}  gap=${(r.maxGapMs / 1000).toFixed(1)}s`);
      console.log(`   reply: ${r.reply.slice(0, 200) || "(vacío)"}`);
      if (r.tools.length) console.log(`   tools: ${r.tools.map((t) => `${t.tool}:${t.status}`).join(", ")}`);
      if (r.blocks.length) console.log(`   blocks: ${r.blocks.map((b) => b.type).join(", ")}`);
      if (r.memoryCandidates.length) console.log(`   mem: ${r.memoryCandidates.map((m) => m.text).join(" | ")}`);
      if (r.commitments.length) console.log(`   commit: ${r.commitments.map((c) => `${c.title} @${c.dueHint}${c.dueAt ? ` → ${c.dueAt}` : " (SIN dueAt)"}`).join(" | ")}`);
      if (r.provider) console.log(`   provider: ${r.provider}/${r.model || "?"}  mascot=${r.mascotState || "?"}${r.fallbackReason ? `  fallback=${r.fallbackReason}` : ""}`);
      if (r.flags.length) console.log(`   ⚠ ${r.flags.join(" · ")}`);
      console.log("");
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
    const file = save(`turns-${from}-${from + slice.length - 1}`, results);
    const bad = results.filter((r) => r.flags.length);
    console.log(`── resumen: ${results.length} turnos · ${results.length - bad.length} limpios · ${bad.length} con hallazgos`);
    console.log(`── guardado → ${file}\n`);
    return;
  }

  if (mode === "endpoints") {
    const results = [];
    for (const ep of ENDPOINTS) {
      process.stdout.write(`▶ ${ep.id.padEnd(22)} ${ep.method} ${ep.path} `);
      const r = await runEndpoint(ep);
      results.push(r);
      console.log(`${r.status} ${(r.ms / 1000).toFixed(1)}s${r.flags.length ? `  ⚠ ${r.flags.join(" · ")}` : ""}`);
      console.log(`   ${JSON.stringify(r.body).slice(0, 220)}`);
      await new Promise((res) => setTimeout(res, 800));
    }
    const file = save("endpoints", results);
    console.log(`\n── guardado → ${file}\n`);
    return;
  }

  if (mode === "static") {
    const results = [];
    for (const a of ASSETS) {
      process.stdout.write(`▶ ${a.path.padEnd(20)} `);
      const r = await runAsset(a);
      results.push(r);
      console.log(`${r.status} ${r.contentType} ${(r.bytes / 1024).toFixed(0)}kB${r.flags.length ? `  ⚠ ${r.flags.join(" · ")}` : ""}`);
      console.log(`   ${r.snippet.slice(0, 160)}`);
      await new Promise((res) => setTimeout(res, 400));
    }
    const file = save("static", results);
    console.log(`\n── guardado → ${file}\n`);
    return;
  }

  console.log("Modos: turns | endpoints | static");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
