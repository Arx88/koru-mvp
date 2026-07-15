// Koru live batch — handles streaming NDJSON responses
import { writeFileSync } from "node:fs";

const URL = process.env.KORU_URL || "https://koru-mvp.onrender.com";
const START = parseInt(process.argv[2] || "0", 10);
const COUNT = parseInt(process.argv[3] || "5", 10);

const scenarios = [
  { id: "reminder-pill", input: "recordame tomar la pastilla a las 18", wantTool: "reminder_set" },
  { id: "alarm-wake", input: "creame una alarma para las 7am", wantTool: "alarm_set" },
  { id: "countdown", input: "cuantos dias faltan para navidad?", wantTool: "countdown" },
  { id: "match-arg", input: "como salio Argentina ayer?", wantTool: "match_live" },
  { id: "movie-inception", input: "reseña de la pelicula Inception", wantTool: "movie_info" },
  { id: "game-zelda", input: "reseña del juego The Legend of Zelda Tears of the Kingdom", wantTool: "game_info" },
  { id: "compare-headphones", input: "comparar auriculares Sony WH-1000XM5 vs Bose QC Ultra", wantTool: "shopping_compare" },
  { id: "mem-1", input: "me encanta el helado de pistacho", wantTool: null },
  { id: "mem-2", input: "estoy trabajando en un proyecto de programacion con python", wantTool: null },
  { id: "mem-3", input: "estoy aprendiendo japonés los martes", wantTool: null },
  { id: "btc", input: "precio del bitcoin", wantTool: "crypto_price" },
  { id: "recipe-carbonara", input: "receta de carbonara", wantTool: "recipe_find" },
  { id: "recipe-multi", input: "dame 3 recetas con pollo", wantTool: "recipe_find" },
  { id: "tacos-madrid", input: "estoy en Madrid, donde puedo comer buenos tacos?", wantTool: "restaurant_deep_search" },
  { id: "plan-day", input: "planifica mi dia", wantTool: "plan_day" },
];

const slice = scenarios.slice(START, START + COUNT);

const baseBody = (input) => ({
  input,
  history: [],
  state: { userName: "Tester", records: [], commitments: [], memories: [] },
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

async function runOne(scn) {
  const start = Date.now();
  try {
    const res = await fetch(`${URL}/api/koru/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseBody(scn.input)),
      signal: AbortSignal.timeout(120_000),
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    if (!res.ok) return { id: scn.id, ok: false, status: res.status, elapsed, error: text.slice(0, 200) };
    const chunks = parseNdjson(text);
    if (chunks.length === 0) return { id: scn.id, ok: false, status: 200, elapsed, error: "empty stream" };
    const json = chunks[chunks.length - 1];
    const tools = Array.isArray(json.toolResults) ? json.toolResults : [];
    const blocks = Array.isArray(json.uiBlocks) ? json.uiBlocks : [];
    const memories = Array.isArray(json.memoryCandidates) ? json.memoryCandidates : [];
    const commitments = Array.isArray(json.commitments) ? json.commitments : [];
    const records = Array.isArray(json.records) ? json.records : [];
    const wantTools = new Set([scn.wantTool]);
    if (scn.wantTool === "reminder_set") wantTools.add("calendar_reminder");
    if (scn.wantTool === "alarm_set") wantTools.add("alarm");
    if (scn.wantTool === "countdown") wantTools.add("calendar_reminder");
    if (scn.wantTool === "movie_info" || scn.wantTool === "book_info" || scn.wantTool === "game_info" || scn.wantTool === "recipe_find") wantTools.add("web_search");
    const toolMatches = tools.filter(t => scn.wantTool && (wantTools.has(t.tool) || wantTools.has(t.type))).length;
    return {
      id: scn.id, ok: true, status: 200, elapsed, chunks: chunks.length,
      input: scn.input, wantTool: scn.wantTool,
      reply: (json.reply || "").slice(0, 240),
      mascot: json.mascotState,
      tools: tools.map(t => `${t.tool ?? t.type ?? "?"}:${t.status ?? "?"}`),
      toolMatches,
      blocks: blocks.map(b => b.type),
      memories: memories.map(m => `[${m.kind}] ${m.text?.slice(0, 80)}`),
      commitments: commitments.length,
      records: records.length,
    };
  } catch (err) {
    return { id: scn.id, ok: false, status: 0, elapsed: Date.now() - start, error: err.message };
  }
}

console.log(`▶ Koru batch [${START}-${START + COUNT - 1}] of ${scenarios.length} → ${URL}\n`);
const results = [];
for (const scn of slice) {
  process.stdout.write(`▶ ${scn.id.padEnd(18)} `);
  const r = await runOne(scn);
  results.push(r);
  if (r.ok) {
    const toolOk = r.wantTool === null || r.toolMatches > 0;
    const mark = toolOk ? "✓" : "✗";
    console.log(`${mark} ${r.elapsed}ms chunks=${r.chunks} tools=[${r.tools.join(",")}] mem=${r.memories.length} commits=${r.commitments} blocks=${r.blocks.length}`);
    console.log(`   reply: ${r.reply}`);
    if (r.memories.length) console.log(`   mem: ${r.memories.join(" | ")}`);
  } else {
    console.log(`✗ ${r.elapsed}ms ${r.error || `HTTP ${r.status}`}`);
  }
  await new Promise(r => setTimeout(r, 500));
}

writeFileSync(`/home/z/my-project/tool-results/batch-${START}-${START + COUNT - 1}.json`, JSON.stringify(results, null, 2));
console.log(`\n✓ Saved → /home/z/my-project/tool-results/batch-${START}-${START + COUNT - 1}.json`);
