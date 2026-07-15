// Koru live batch — runs N scenarios, prints compact results
import { readFileSync, writeFileSync } from "node:fs";

const URL = process.env.KORU_URL || "https://koru-mvp.onrender.com";

const scenarios = [
  // 1. Recordatorios
  { id: "reminder-pill", input: "recordame tomar la pastilla a las 18", wantTool: "reminder_set" },
  // 2. Alarmas
  { id: "alarm-wake", input: "creame una alarma para las 7am", wantTool: "alarm_set" },
  // 3. Cuenta regresiva
  { id: "countdown", input: "cuantos dias faltan para navidad?", wantTool: "countdown" },
  // 5. Mundial de fútbol (más desafiantes)
  { id: "match-world", input: "como salio Argentina en el mundial?", wantTool: "match_live" },
  // 6. Review de película
  { id: "movie", input: "reseña de la pelicula Inception", wantTool: "movie_info" },
  // 7. Review de juego
  { id: "game", input: "reseña del juego The Legend of Zelda Tears of the Kingdom", wantTool: null },
  // 8. Comparación productos
  { id: "compare", input: "comparar auriculares Sony WH-1000XM5 vs Bose QC Ultra", wantTool: "shopping_compare" },
  // 9. Memoria pasiva (sin pedir guardar)
  { id: "mem-1", input: "me encanta el helado de pistacho", wantTool: null },
  { id: "mem-2", input: "estoy trabajando en un proyecto de programacion con python", wantTool: null },
  { id: "mem-3", input: "estoy aprendiendo japonés", wantTool: null },
  // 10. Bitcoin + recordatorio + cumple madre
  { id: "btc", input: "precio del bitcoin", wantTool: "crypto_price" },
  // 11. Recetas
  { id: "recipe-1", input: "receta de carbonara", wantTool: "recipe_find" },
  { id: "recipe-multi", input: "dame 3 recetas con pollo", wantTool: "recipe_find" },
  // 12. Restaurantes Madrid tacos
  { id: "tacos", input: "estoy en Madrid, donde puedo comer buenos tacos?", wantTool: "restaurant_deep_search" },
  // 13. Planifica mi día
  { id: "plan-day", input: "planifica mi dia", wantTool: "plan_day" },
];

const baseBody = (input) => ({
  input,
  history: [],
  state: {
    userName: "Tester",
    records: [],
    commitments: [],
    memories: [],
  },
  model: "nvidia/nemotron-3-ultra-550b-a55b",
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
    const json = JSON.parse(text);
    const tools = Array.isArray(json.toolResults) ? json.toolResults : [];
    const blocks = Array.isArray(json.uiBlocks) ? json.uiBlocks : [];
    const memories = Array.isArray(json.memoryCandidates) ? json.memoryCandidates : [];
    const commitments = Array.isArray(json.commitments) ? json.commitments : [];
    const records = Array.isArray(json.records) ? json.records : [];
    const toolMatches = tools.filter(t => scn.wantTool && t.type === scn.wantTool).length;
    return {
      id: scn.id,
      ok: true,
      status: 200,
      elapsed,
      input: scn.input,
      wantTool: scn.wantTool,
      reply: (json.reply || "").slice(0, 180),
      mascot: json.mascotState,
      tools: tools.map(t => `${t.type}:${t.status ?? "?"}`),
      toolMatches,
      blocks: blocks.map(b => b.type),
      memories: memories.map(m => `[${m.kind}] ${m.text?.slice(0, 60)}`),
      commitments: commitments.length,
      records: records.length,
    };
  } catch (err) {
    return { id: scn.id, ok: false, status: 0, elapsed: Date.now() - start, error: err.message };
  }
}

console.log(`▶ Koru batch — ${scenarios.length} scenarios against ${URL}\n`);
const results = [];
for (const scn of scenarios) {
  process.stdout.write(`▶ ${scn.id.padEnd(15)} `);
  const r = await runOne(scn);
  results.push(r);
  if (r.ok) {
    const toolOk = r.wantTool === null || r.toolMatches > 0;
    const mark = toolOk ? "✓" : "✗";
    console.log(`${mark} ${r.elapsed}ms tools=[${r.tools.join(",")}] mem=${r.memories.length} commits=${r.commitments}`);
    console.log(`   reply: ${r.reply}`);
    if (r.memories.length) console.log(`   mem: ${r.memories.join(" | ")}`);
    if (r.blocks.length) console.log(`   blocks: ${r.blocks.join(",")}`);
  } else {
    console.log(`✗ ${r.elapsed}ms ${r.error || `HTTP ${r.status}`}`);
  }
  await sleep(800);
}

writeFileSync("/home/z/my-project/tool-results/batch-baseline.json", JSON.stringify(results, null, 2));
console.log(`\n✓ Full results → /home/z/my-project/tool-results/batch-baseline.json`);
