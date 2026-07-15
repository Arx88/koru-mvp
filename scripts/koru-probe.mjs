// Koru live probe — calls production /api/koru/turn with a single message
// Usage: node /home/z/my-project/scripts/koru-probe.mjs "tu pregunta"
import { readFileSync } from "node:fs";

const ROOT = "/home/z/my-project/koru-mvp";
const envContent = readFileSync(`${ROOT}/.env`, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const [k, ...v] = t.split("=");
  if (k) env[k.trim()] = v.join("=").trim();
}

const URL = process.env.KORU_URL || "https://koru-mvp.onrender.com";
const input = process.argv[2] || "hola";
const history = process.argv[3] ? JSON.parse(process.argv[3]) : [];

const body = {
  input,
  history,
  state: {
    userName: "Tester",
    records: [],
    commitments: [],
    memories: [],
  },
  model: "nvidia/nemotron-3-ultra-550b-a55b",
};

const start = Date.now();
console.log(`▶ POST ${URL}/api/koru/turn — "${input.slice(0, 80)}"`);
try {
  const res = await fetch(`${URL}/api/koru/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - start;
  const text = await res.text();
  if (!res.ok) {
    console.log(`✗ HTTP ${res.status} (${elapsed}ms)`);
    console.log(text.slice(0, 600));
    process.exit(1);
  }
  const json = JSON.parse(text);
  console.log(`✓ HTTP 200 in ${elapsed}ms`);
  console.log(`  reply: ${(json.reply || "").slice(0, 240)}`);
  console.log(`  mascotState: ${json.mascotState}`);
  console.log(`  provider: ${json.provider}${json.model ? ` / ${json.model}` : ""}`);
  console.log(`  toolResults: ${Array.isArray(json.toolResults) ? json.toolResults.length : 0}`);
  if (Array.isArray(json.toolResults)) {
    for (const tr of json.toolResults) {
      console.log(`    - ${tr.type} ${tr.status ?? ""} ${tr.query ? `q="${tr.query}"` : ""}`);
    }
  }
  console.log(`  uiBlocks: ${Array.isArray(json.uiBlocks) ? json.uiBlocks.length : 0}`);
  if (Array.isArray(json.uiBlocks)) {
    for (const b of json.uiBlocks) {
      console.log(`    - ${b.type} ${b.title ? `title="${b.title.slice(0, 60)}"` : ""}`);
    }
  }
  console.log(`  records: ${Array.isArray(json.records) ? json.records.length : 0}`);
  console.log(`  commitments: ${Array.isArray(json.commitments) ? json.commitments.length : 0}`);
  console.log(`  memoryCandidates: ${Array.isArray(json.memoryCandidates) ? json.memoryCandidates.length : 0}`);
  if (Array.isArray(json.memoryCandidates) && json.memoryCandidates.length) {
    for (const m of json.memoryCandidates) {
      console.log(`    - [${m.kind}] ${m.text?.slice(0, 80)}`);
    }
  }
  // Save full JSON for inspection
  if (process.env.SAVE) {
    const fs = await import("node:fs/promises");
    const out = `/home/z/my-project/tool-results/probe-${Date.now()}.json`;
    await fs.writeFile(out, JSON.stringify(json, null, 2));
    console.log(`  saved → ${out}`);
  }
} catch (err) {
  const elapsed = Date.now() - start;
  console.log(`✗ Network error after ${elapsed}ms: ${err.message}`);
  process.exit(1);
}
