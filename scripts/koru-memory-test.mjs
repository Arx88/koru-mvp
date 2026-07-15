// Test memory with context — give Koru personal data, then ask questions that should use it
import { writeFileSync } from "node:fs";

const URL = process.env.KORU_URL || "https://koru-mvp.onrender.com";

async function callKoru(input, state, history = []) {
  const res = await fetch(`${URL}/api/koru/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      history,
      state,
      model: "nvidia/nemotron-3-ultra-550b-a55b",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const objs = [];
  for (const line of lines) {
    try { objs.push(JSON.parse(line)); } catch (e) { /* skip */ }
  }
  return objs[objs.length - 1];
}

console.log("▶ Test: Memoria con contexto — dar datos personales, luego preguntar\n");

// Paso 1: dar 3 datos personales (sin pedir guardar)
const revelations = [
  "me encanta el helado de pistacho",
  "estoy trabajando en un proyecto de programacion con python",
  "estoy aprendiendo japonés los martes",
];

let memories = [];
let history = [];

for (const rev of revelations) {
  process.stdout.write(`▶ USER: ${rev.padEnd(55)} `);
  const result = await callKoru(rev, { userName: "Tester", records: [], commitments: [], memories }, history);
  const newMems = (result.memoryCandidates || []).filter(m => !memories.find(existing => existing.text === m.text));
  if (newMems.length > 0) {
    memories.push(...newMems);
    console.log(`✓ capturó ${newMems.length} memoria(s): ${newMems.map(m => `[${m.kind}] ${m.text.slice(0, 60)}`).join(", ")}`);
  } else {
    console.log(`✗ no capturó memoria`);
  }
  history.push({ role: "user", content: rev });
  history.push({ role: "assistant", content: result.reply || "" });
  await new Promise(r => setTimeout(r, 1000));
}

console.log(`\n▶ Memorias acumuladas (${memories.length}):`);
memories.forEach((m, i) => console.log(`   ${i + 1}. [${m.kind}] ${m.text}`));

// Paso 2: preguntar cosas que deberían usar las memorias
console.log(`\n▶ Paso 2: Preguntas que deberían usar las memorias\n`);

const questions = [
  "que helado me gusta?",  // debería decir "pistacho"
  "en que estoy trabajando?",  // debería decir "proyecto de programación con python"
  "que estoy aprendiendo?",  // debería decir "japonés los martes"
];

for (const q of questions) {
  process.stdout.write(`▶ USER: ${q.padEnd(45)} `);
  // Marcar las memorias como confirmed para que estén en el contexto
  const confirmedMemories = memories.map(m => ({ ...m, status: "confirmed" }));
  const result = await callKoru(q, { userName: "Tester", records: [], commitments: [], memories: confirmedMemories }, history);
  console.log(`\n   KORU: ${(result.reply || "").slice(0, 200)}`);
  // Check if reply mentions expected content
  const reply = (result.reply || "").toLowerCase();
  let expected = "";
  if (q.includes("helado")) expected = "pistacho";
  else if (q.includes("trabajando")) expected = "python";
  else if (q.includes("aprendiendo")) expected = "japonés";
  const hasExpected = expected && (reply.includes(expected.toLowerCase()) || reply.includes(expected));
  console.log(`   ${hasExpected ? "✓ USA MEMORIA" : "✗ NO USA MEMORIA"} (esperaba: "${expected}")`);
  history.push({ role: "user", content: q });
  history.push({ role: "assistant", content: result.reply || "" });
  await new Promise(r => setTimeout(r, 1000));
}

writeFileSync("/home/z/my-project/tool-results/memory-context-test.json", JSON.stringify({ memories, history }, null, 2));
console.log(`\n✓ Saved → /home/z/my-project/tool-results/memory-context-test.json`);
