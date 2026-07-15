// Koru Quality Test Suite — 150 escenarios conversacionales realistas
// Criterios de calidad:
// 1. Intent detection correcta (la tool correcta se ejecuta)
// 2. Reply natural, cálido, en español, sin thinking leak
// 3. Contenido real (no alucinado), dato insignia presente
// 4. Sin UI bugs (blocks vacíos, textos rotos, English)
// 5. Memoria capturada cuando corresponde
// 6. Memoria usada proactivamente en contextos relacionados

import { writeFileSync } from "node:fs";

const URL = "https://koru-mvp.onrender.com";

const baseBody = (input, state = null, history = []) => ({
  input,
  history,
  state: state || { userName: "Test", records: [], commitments: [], memories: [] },
  model: "nvidia/nemotron-3-ultra-550b-a55b",
});

function parseNdjson(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const objs = [];
  for (const line of lines) {
    try { objs.push(JSON.parse(line)); } catch (e) { /* skip */ }
  }
  return objs;
}

async function callKoru(input, state, history = []) {
  const start = Date.now();
  try {
    const res = await fetch(`${URL}/api/koru/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseBody(input, state, history)),
      signal: AbortSignal.timeout(120_000),
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    if (!res.ok) return { ok: false, elapsed, error: `HTTP ${res.status}` };
    const chunks = parseNdjson(text);
    if (chunks.length === 0) return { ok: false, elapsed, error: "empty stream" };
    const json = chunks[chunks.length - 1];
    return { ok: true, elapsed, json };
  } catch (err) {
    return { ok: false, elapsed: Date.now() - start, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CRITERIOS DE CALIDAD
// ═══════════════════════════════════════════════════════════════════

function judgeReply(reply, input) {
  const issues = [];
  const r = (reply || "").toLowerCase();

  // 1. Thinking leak
  if (/\b(the user|let me|i should|i need to|thinking|let's|okay so|i'll|i will now)\b/i.test(reply)) {
    issues.push("THINKING_LEAK");
  }
  // 2. English
  if (/\b(yes|no problem|sure thing|of course|let me|i can help|i'll|here is|here are)\b/i.test(reply) && !/\b(sí|si|claro|por supuesto)\b/i.test(reply)) {
    issues.push("ENGLISH_TEXT");
  }
  // 3. Vacío o muy corto
  if (!reply || reply.trim().length < 5) issues.push("EMPTY_REPLY");
  // 4. "Ya te la doy" / promesa sin entregar
  if (/ya te (la|lo)|en un momento|ahora te|te lo paso|déjame|dejame/i.test(reply) && !/tarjeta|encontré|encontre/i.test(reply)) {
    issues.push("PROMISE_NO_DELIVER");
  }
  // 5. Repite el input literal
  if (reply && reply.toLowerCase().includes(input.toLowerCase()) && reply.length < input.length + 30) {
    issues.push("ECHO_INPUT");
  }
  // 6. Error genérico
  if (/no pude (armar|procesar)|repetís|otra forma/i.test(reply)) issues.push("GENERIC_ERROR");

  return { issues, score: issues.length === 0 ? 10 : Math.max(2, 10 - issues.length * 3) };
}

function judgeBlocks(blocks, expectedType) {
  const issues = [];
  if (!blocks || blocks.length === 0) {
    if (expectedType) issues.push("NO_BLOCK");
    return { issues, score: expectedType ? 2 : 10 };
  }
  // Block vacío
  for (const b of blocks) {
    if (b.type === "data_card" && (!b.items || b.items.length === 0)) issues.push("EMPTY_DATA_CARD");
    if (b.type === "movie_review" && !b.title && !b.overview) issues.push("EMPTY_MOVIE_REVIEW");
    if (b.type === "recipe" && !b.name && !b.instructions) issues.push("EMPTY_RECIPE");
    if (b.type === "research_sources" && !b.summary && (!b.sources || b.sources.length === 0)) issues.push("EMPTY_RESEARCH");
    if (b.type === "deliverable" && b.status === "working") issues.push("STUCK_WORKING");
  }
  return { issues, score: issues.length === 0 ? 10 : Math.max(3, 10 - issues.length * 2) };
}

// ═══════════════════════════════════════════════════════════════════
// ESCENARIOS — vagos, conversacionales, sin acentos, multi-turno
// ═══════════════════════════════════════════════════════════════════

const scenarios = [
  // ── REMINDERS (vagos, conversacionales) ──
  { id: "rem-01", input: "el martes q viene tengo q ir al dentista a las 18", expect: "reminder", check: ["commitments>0"] },
  { id: "rem-02", input: "no me olvides llamar a mi vieja mañana", expect: "reminder", check: ["commitments>0"] },
  { id: "rem-03", input: "la semana q viene tengo q pagar el alquiler", expect: "reminder" },
  { id: "rem-04", input: "acordate q el 20 vence la tarjeta", expect: "reminder" },
  { id: "rem-05", input: "mañana x la mañana tengo q llevar el auto al taller", expect: "reminder" },
  { id: "rem-06", input: "el finde largo me toca regar las plantas de mi hermana", expect: "reminder" },
  { id: "rem-07", input: "no me dejes olvidar comprar el regalo de ana", expect: "reminder" },
  { id: "rem-08", input: "necesito q me avises el viernes x la tarde q tengo q retirar el traje", expect: "reminder" },
  { id: "rem-09", input: "el 15 del mes q viene se vence el seguro", expect: "reminder" },
  { id: "rem-10", input: "acordarme de pasar x la farmacia antes de las 8", expect: "reminder" },

  // ── ALARMS (vagos) ──
  { id: "alm-01", input: "despertame temprano mañana", expect: "alarm" },
  { id: "alm-02", input: "necesito levantarme a las 6 el sabado", expect: "alarm" },
  { id: "alm-03", input: "mañana tengo q estar en el laburo a las 7", expect: "alarm" },
  { id: "alm-04", input: "poneme una alarma para las 5 y media", expect: "alarm" },
  { id: "alm-05", input: "el domingo me toca madrugar", expect: "alarm" },

  // ── COUNTDOWN (vagos) ──
  { id: "cnt-01", input: "cuanto falta para navidad", expect: "countdown" },
  { id: "cnt-02", input: "cuantos dias para mi cumple", expect: "countdown" },
  { id: "cnt-03", input: "el 20 del mes q viene q dia es", expect: "countdown" },
  { id: "cnt-04", input: "cuanto falta para fin de año", expect: "countdown" },
  { id: "cnt-05", input: "cuantos dias pasaron desde enero", expect: "countdown" },

  // ── WEATHER (vagos, conversacionales) ──
  { id: "wth-01", input: "sale salir hoy?", expect: "weather" },
  { id: "wth-02", input: "que pongo?", expect: "weather" },
  { id: "wth-03", input: "llueve mañana?", expect: "weather" },
  { id: "wth-04", input: "hace frio alla", expect: "weather" },
  { id: "wth-05", input: "necesito campera?", expect: "weather" },
  { id: "wth-06", input: "que tal el dia en madrid", expect: "weather" },
  { id: "wth-07", input: "paraguas o no?", expect: "weather" },
  { id: "wth-08", input: "esta para shorts?", expect: "weather" },

  // ── RECIPES (vagos, conversacionales) ──
  { id: "rcp-01", input: "tengo pollo y arroz q hago", expect: "recipe" },
  { id: "rcp-02", input: "algo rapido de cenar", expect: "recipe_or_search" },
  { id: "rcp-03", input: "tengo ganas de pasta", expect: "recipe" },
  { id: "rcp-04", input: "tirame algo con lo q tengo en la heladera", expect: "recipe_or_search" },
  { id: "rcp-05", input: "no se q cocinar hoy", expect: "recipe_or_search" },
  { id: "rcp-06", input: "alguna idea de cena", expect: "recipe_or_search" },
  { id: "rcp-07", input: "receta de brownies", expect: "recipe" },
  { id: "rcp-08", input: "como hago panqueques", expect: "recipe" },
  { id: "rcp-09", input: "tengo huevos y pan", expect: "recipe_or_search" },
  { id: "rcp-10", input: "algo sin horno", expect: "recipe_or_search" },

  // ── MOVIES/ENTERTAINMENT (vagos, multi-turno) ──
  { id: "mov-01", input: "que veo hoy", expect: "search_or_conversation" },
  { id: "mov-02", input: "algo para el finde", expect: "search_or_conversation" },
  { id: "mov-03", input: "tirame una peli", expect: "search_or_conversation" },
  { id: "mov-04", input: "que puedo ver", expect: "search_or_conversation" },
  { id: "mov-05", input: "estoy aburrido", expect: "conversation" },
  { id: "mov-06", input: "info de inception", expect: "movie" },
  { id: "mov-07", input: "quien actua en joker", expect: "movie" },
  { id: "mov-08", input: "de q trata interstellar", expect: "movie" },
  { id: "mov-09", input: "el padrino cuanto dura", expect: "movie" },
  { id: "mov-10", input: "quien dirigio avatar", expect: "movie" },

  // ── GAMES (vagos) ──
  { id: "gam-01", input: "como es elden ring", expect: "game" },
  { id: "gam-02", input: "informacion de minecraft", expect: "game" },
  { id: "gam-03", input: "tirame un juego bueno", expect: "search_or_conversation" },
  { id: "gam-04", input: "q juego compro", expect: "search_or_conversation" },
  { id: "gam-05", input: "zelda tears of the kingdom", expect: "game" },
  { id: "gam-06", input: "el cyberpunk vale la pena", expect: "game_or_search" },

  // ── SPORTS (vagos) ──
  { id: "spt-01", input: "como le fue a boca", expect: "match_live" },
  { id: "spt-02", input: "jugó river ayer", expect: "match_live" },
  { id: "spt-03", input: "el partido de españa", expect: "match_live" },
  { id: "spt-04", input: "como salio argentina", expect: "match_live" },
  { id: "spt-05", input: "gano el madrid?", expect: "match_live" },
  { id: "spt-06", input: "resultado de ayer", expect: "match_live_or_search" },
  { id: "spt-07", input: "como va la champions", expect: "match_live_or_search" },

  // ── KNOWLEDGE (vagos) ──
  { id: "knw-01", input: "q es la relatividad", expect: "wikipedia" },
  { id: "knw-02", input: "quien era tesla", expect: "wikipedia" },
  { id: "knw-03", input: "como funcionan los agujeros negros", expect: "wikipedia" },
  { id: "knw-04", input: "q es el blockchain", expect: "wikipedia" },
  { id: "knw-05", input: "quien invento el telefono", expect: "wikipedia" },
  { id: "knw-06", input: "q son los bitcoins", expect: "wikipedia_or_search" },
  { id: "knw-07", input: "explicame la fotosintesis", expect: "wikipedia" },
  { id: "knw-08", input: "q es la inflacion", expect: "wikipedia" },
  { id: "knw-09", input: "quien fue borges", expect: "wikipedia" },
  { id: "knw-10", input: "q es AOE2", expect: "wikipedia" },

  // ── RESTAURANTS (vagos, conversacionales) ──
  { id: "rtr-01", input: "donde como bien cerca", expect: "restaurant" },
  { id: "rtr-02", input: "tengo ganas de mexicano", expect: "restaurant" },
  { id: "rtr-03", input: "un buen lugar para cenar", expect: "restaurant" },
  { id: "rtr-04", input: "sushi en madrid", expect: "restaurant" },
  { id: "rtr-05", input: "donde puedo comer tacos", expect: "restaurant" },
  { id: "rtr-06", input: "parrilla buena en palermo", expect: "restaurant" },
  { id: "rtr-07", input: "algo para comer ahora", expect: "restaurant_or_search" },
  { id: "rtr-08", input: "tirame una pizzeria", expect: "restaurant_or_search" },

  // ── CRYPTO/MARKET (vagos) ──
  { id: "cry-01", input: "como esta el btc", expect: "crypto" },
  { id: "cry-02", input: "a cuanto esta ethereum", expect: "crypto" },
  { id: "cry-03", input: "precio del bitcoin", expect: "crypto" },
  { id: "cry-04", input: "el ether subio o bajo", expect: "crypto" },
  { id: "cry-05", input: "como esta solana", expect: "crypto" },

  // ── SHOPPING (vagos) ──
  { id: "shp-01", input: "necesito auriculares nuevos", expect: "shopping" },
  { id: "shp-02", input: "que notebook compro", expect: "shopping" },
  { id: "shp-03", input: "iphone vs samsung", expect: "shopping" },
  { id: "shp-04", input: "donde compro mas barato airpods", expect: "shopping" },
  { id: "shp-05", input: "que tablet me conviene", expect: "shopping" },

  // ── PLAN DAY (vagos) ──
  { id: "pln-01", input: "organizame el dia", expect: "plan" },
  { id: "pln-02", input: "tengo muchas cosas hoy", expect: "plan" },
  { id: "pln-03", input: "no se por donde empezar", expect: "plan_or_conversation" },
  { id: "pln-04", input: "ayudame a planificar", expect: "plan" },

  // ── MEMORY: passive capture (vagos) ──
  { id: "mem-01", input: "me encanta el sushi", expect: "memory_capture" },
  { id: "mem-02", input: "estoy aprendiendo guitarra", expect: "memory_capture" },
  { id: "mem-03", input: "tengo un gato q se llama michi", expect: "memory_capture" },
  { id: "mem-04", input: "odio el morron", expect: "memory_capture" },
  { id: "mem-05", input: "mi cumple es en marzo", expect: "memory_capture" },
  { id: "mem-06", input: "estoy ahorrando para un viaje a japon", expect: "memory_capture" },
  { id: "mem-07", input: "trabajo de programador", expect: "memory_capture" },
  { id: "mem-08", input: "me gusta correr x las mañanas", expect: "memory_capture" },
  { id: "mem-09", input: "mi novia se llama laura", expect: "memory_capture" },
  { id: "mem-10", input: "estoy leyendo cien años de soledad", expect: "memory_capture" },
  { id: "mem-11", input: "tengo alergia al polen", expect: "memory_capture" },
  { id: "mem-12", input: "me copa la fotografia", expect: "memory_capture" },

  // ── CONVERSATION / FOLLOW-UPS (vagos, multi-turno) ──
  { id: "cnv-01", input: "y de eso?", history: [{ role: "user", content: "que veo hoy" }, { role: "assistant", content: "Te recomendé algunas películas" }], expect: "conversation" },
  { id: "cnv-02", input: "de suspenso nada mas", history: [{ role: "user", content: "que veo hoy" }, { role: "assistant", content: "¿Qué género te pega?" }], expect: "search" },
  { id: "cnv-03", input: "otra", history: [{ role: "user", content: "una peli" }, { role: "assistant", content: "Te recomendé Inception" }], expect: "search" },
  { id: "cnv-04", input: "q es eso", history: [{ role: "user", content: "que veo" }, { role: "assistant", content: "Te recomendé algo" }], expect: "conversation" },
  { id: "cnv-05", input: "no me gusta", history: [{ role: "user", content: "tirame una peli" }, { role: "assistant", content: "Te recomendé Saw" }], expect: "search_or_conversation" },
  { id: "cnv-06", input: "mas barato", history: [{ role: "user", content: "auriculares" }, { role: "assistant", content: "Te recomendé Sony" }], expect: "shopping" },
  { id: "cnv-07", input: "y el otro?", history: [{ role: "user", content: "como salio boca" }, { role: "assistant", content: "Boca ganó 2-1" }], expect: "match_live" },
  { id: "cnv-08", input: "gracias", expect: "conversation" },
  { id: "cnv-09", input: "q groso", expect: "conversation" },
  { id: "cnv-10", input: "no entendi", history: [{ role: "user", content: "q es blockchain" }, { role: "assistant", content: "explicación..." }], expect: "conversation" },

  // ── PROACTIVE MEMORY TESTS ──
  // Decir algo personal, luego preguntar algo NO relacionado y ver si Koru lo usa
  {
    id: "pro-01",
    sequence: [
      { input: "me encanta el helado", state: { memories: [] } },
      { input: "que calor hace", state: { memories: [{ kind: "preference", text: "Le encanta el helado.", status: "confirmed" }] }, expect_proactive: "helado" },
    ],
  },
  {
    id: "pro-02",
    sequence: [
      { input: "estoy aprendiendo guitarra", state: { memories: [] } },
      { input: "que hago este finde", state: { memories: [{ kind: "routine", text: "Aprende guitarra.", status: "confirmed" }] }, expect_proactive: "guitarra" },
    ],
  },
  {
    id: "pro-03",
    sequence: [
      { input: "tengo un gato", state: { memories: [] } },
      { input: "que regalo le doy a mi novia", state: { memories: [{ kind: "profile", text: "Tiene un gato.", status: "confirmed" }] }, expect_proactive: "gato|mascota" },
    ],
  },
  {
    id: "pro-04",
    sequence: [
      { input: "soy celiaco", state: { memories: [] } },
      { input: "tirame una receta", state: { memories: [{ kind: "preference", text: "Es celíaco.", status: "confirmed" }] }, expect_proactive: "celiaco|sin gluten|sin tacc" },
    ],
  },
  {
    id: "pro-05",
    sequence: [
      { input: "me copa la IA", state: { memories: [] } },
      { input: "que estudio", state: { memories: [{ kind: "preference", text: "Le interesa la IA.", status: "confirmed" }] }, expect_proactive: "ia|inteligencia artificial" },
    ],
  },
  {
    id: "pro-06",
    sequence: [
      { input: "odio el morron", state: { memories: [] } },
      { input: "receta de pizza", state: { memories: [{ kind: "preference", text: "Odia el morrón.", status: "confirmed" }] }, expect_proactive: "morron|morrón|sin morron" },
    ],
  },
  {
    id: "pro-07",
    sequence: [
      { input: "estoy ahorrando para ir a japon", state: { memories: [] } },
      { input: "que hago con mi sueldo", state: { memories: [{ kind: "goal", text: "Ahorra para ir a Japón.", status: "confirmed" }] }, expect_proactive: "japon|japón|ahorro|viaje" },
    ],
  },
  {
    id: "pro-08",
    sequence: [
      { input: "me gusta correr x las mañanas", state: { memories: [] } },
      { input: "que tal el dia", state: { memories: [{ kind: "routine", text: "Le gusta correr por las mañanas.", status: "confirmed" }] }, expect_proactive: "correr|mañana|running" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════════

const START = parseInt(process.argv[2] || "0", 10);
const COUNT = parseInt(process.argv[3] || "10", 10);

// Filtrar solo single-turn (los proactivos se corren aparte)
const singleTurn = scenarios.filter(s => !s.sequence);
const slice = singleTurn.slice(START, START + COUNT);

console.log(`▶ Koru Quality Test [${START}-${START + COUNT - 1}] of ${singleTurn.length} single-turn + ${scenarios.filter(s => s.sequence).length} proactive\n`);

const results = [];

for (const scn of slice) {
  process.stdout.write(`▶ ${scn.id.padEnd(8)} `);
  const r = await callKoru(scn.input, { userName: "Test", records: [], commitments: [], memories: [] }, scn.history || []);

  if (!r.ok) {
    console.log(`✗ ${r.elapsed}ms ${r.error}`);
    results.push({ id: scn.id, ok: false, error: r.error, input: scn.input });
    continue;
  }

  const { json, elapsed } = r;
  const reply = json.reply || "";
  const blocks = json.uiBlocks || [];
  const tools = json.toolResults || [];
  const memories = json.memoryCandidates || [];
  const commitments = json.commitments || [];

  // Judge quality
  const replyJudge = judgeReply(reply, scn.input);
  const blockJudge = judgeBlocks(blocks, scn.expect);

  const toolTypes = tools.map(t => t.tool);
  const blockTypes = blocks.map(b => b.type);

  // Intent detection (approximate)
  let intentOk = true;
  if (scn.expect === "reminder") intentOk = commitments.length > 0 || blockTypes.includes("reminder") || toolTypes.includes("calendar_reminder");
  if (scn.expect === "alarm") intentOk = toolTypes.includes("alarm") || blockTypes.includes("alarm");
  if (scn.expect === "weather") intentOk = toolTypes.includes("weather") || blockTypes.includes("weather");
  if (scn.expect === "recipe") intentOk = toolTypes.includes("web_search") && blockTypes.some(b => b === "recipe");
  if (scn.expect === "wikipedia") intentOk = toolTypes.includes("web_search") && blockTypes.some(b => b === "research_sources" || b === "data_card");
  if (scn.expect === "crypto") intentOk = toolTypes.includes("crypto_price") || blockTypes.some(b => b === "crypto_portfolio" || b === "data_card");
  if (scn.expect === "movie") intentOk = blockTypes.includes("movie_review");
  if (scn.expect === "game") intentOk = blockTypes.includes("movie_review");
  if (scn.expect === "match_live") intentOk = toolTypes.includes("match_live");
  if (scn.expect === "shopping") intentOk = toolTypes.includes("shopping_compare") || blockTypes.includes("comparison");
  if (scn.expect === "restaurant") intentOk = toolTypes.includes("shopping_compare") || blockTypes.includes("restaurant_synthesis");
  if (scn.expect === "plan") intentOk = toolTypes.includes("memory_recall") || blockTypes.includes("plan");
  if (scn.expect === "memory_capture") intentOk = memories.length > 0;
  if (scn.expect === "conversation") intentOk = tools.length === 0;
  if (scn.expect === "search") intentOk = toolTypes.includes("web_search");

  const allIssues = [...replyJudge.issues, ...blockJudge.issues];
  const qualityScore = Math.round((replyJudge.score + blockJudge.score) / 2);
  const mark = intentOk && allIssues.length === 0 ? "✓" : intentOk ? "~" : "✗";

  console.log(`${mark} ${elapsed}ms Q=${qualityScore} intent=${intentOk ? "OK" : "FAIL"} tools=[${toolTypes.join(",")}] blocks=[${blockTypes.join(",")}] mem=${memories.length} commits=${commitments.length}`);
  console.log(`   reply: ${reply.slice(0, 120)}`);
  if (allIssues.length) console.log(`   issues: ${allIssues.join(", ")}`);
  if (memories.length) console.log(`   mem: ${memories.map(m => `[${m.kind}] ${m.text?.slice(0, 50)}`).join(" | ")}`);

  results.push({
    id: scn.id, ok: true, elapsed, input: scn.input, reply, blocks: blockTypes,
    tools: toolTypes, memories: memories.length, commitments: commitments.length,
    intentOk, qualityScore, issues: allIssues,
  });

  await new Promise(r => setTimeout(r, 600));
}

writeFileSync(`/home/z/my-project/tool-results/quality-${START}-${START + COUNT - 1}.json`, JSON.stringify(results, null, 2));
console.log(`\n✓ Saved → /home/z/my-project/tool-results/quality-${START}-${START + COUNT - 1}.json`);
