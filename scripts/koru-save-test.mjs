// Test save functionality end-to-end — generate reports + save with same collection
import { writeFileSync } from "node:fs";

const URL = process.env.KORU_URL || "https://koru-mvp.onrender.com";

const baseBody = (input, state = null, history = []) => ({
  input,
  history,
  state: state || { userName: "Tester", records: [], commitments: [], memories: [] },
  model: "nvidia/nemotron-3-ultra-550b-a55b",
});

async function callKoru(input, state, history = []) {
  const res = await fetch(`${URL}/api/koru/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(baseBody(input, state, history)),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const objs = [];
  for (const line of lines) {
    try { objs.push(JSON.parse(line)); } catch (e) { /* skip */ }
  }
  return objs[objs.length - 1];
}

console.log("▶ Test: 5 informes con save (Que Koru se encargue) + grouping\n");

// 5 informes de temas diferentes, todos guardados en la MISMA colección "Koru · Informes IA"
const reports = [
  { input: "que es la inteligencia artificial" },
  { input: "quien era Alan Turing" },
  { input: "que es el machine learning" },
  { input: "que es una red neuronal" },
  { input: "que es el deep learning" },
];

let savedRecords = [];

for (const r of reports) {
  process.stdout.write(`▶ ${r.input.padEnd(45)} `);
  try {
    const result = await callKoru(r.input);
    const block = result.uiBlocks?.find(b => b.type === "research_sources" || b.type === "deliverable");
    if (!block) {
      console.log(`✗ no block (reply: ${(result.reply || "").slice(0, 80)})`);
      continue;
    }
    const topic = block.topic || block.title || "Informe";
    console.log(`✓ "${topic.slice(0, 50)}"`);

    // Simular "Que Koru se encargue" — guardar con colección "Koru · Informes IA"
    // Pasar history con la pregunta anterior para que el título del record sea el tema
    const saveInput = `guardame este informe en la coleccion Informes IA`;
    const saveResult = await callKoru(saveInput, {
      userName: "Tester",
      records: savedRecords,
      commitments: [],
      memories: [],
    }, [{ role: "user", content: r.input }, { role: "assistant", content: result.reply || "" }]);
    const records = saveResult.records || [];
    if (records.length > 0) {
      savedRecords.push(...records);
      console.log(`   ✓ saved ${records.length} record(s) in "${records[0]?.collection || "?"}"`);
    } else {
      console.log(`   ✗ no records saved (reply: ${(saveResult.reply || "").slice(0, 80)})`);
    }
  } catch (err) {
    console.log(`✗ error: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 1000));
}

// Group by collection
console.log(`\n▶ Grouping analysis:`);
const grouped = {};
for (const r of savedRecords) {
  const col = r.collection || "(sin colección)";
  if (!grouped[col]) grouped[col] = [];
  grouped[col].push(r);
}
for (const [col, recs] of Object.entries(grouped)) {
  console.log(`  📁 ${col} (${recs.length} informe(s))`);
  for (const r of recs) {
    console.log(`     - ${r.title?.slice(0, 60)}`);
  }
}

writeFileSync("/home/z/my-project/tool-results/save-test.json", JSON.stringify({ savedRecords, grouped }, null, 2));
console.log(`\n✓ Saved → /home/z/my-project/tool-results/save-test.json`);
