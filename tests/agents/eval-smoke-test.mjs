/**
 * Koru Evaluation Smoke Test
 * Only runs Camila Day 1, first moment (1 turn) to verify the setup works.
 */

import { runKoruBackendTurn } from "../../src/server/koruBackend.ts";

// Load .env directly to ensure it's parsed
import { readFileSync } from "node:fs";
const envContent = readFileSync("tests/agents/../../.env", "utf-8");
const config = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...valueParts] = trimmed.split("=");
  if (key && valueParts.length) {
    config[key] = valueParts.join("=");
  }
}

const providerConfig = {
  nvidiaApiKey: config.NVIDIA_API_KEY?.trim(),
  nvidiaBaseUrl: config.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
  nvidiaModel: config.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
  openRouterKeys: [
    config.OPENROUTER_API_KEY?.trim(),
    ...(config.OPENROUTER_FALLBACK_API_KEYS?.split(",") || []),
  ].filter(Boolean),
  openRouterModels: (config.OPENROUTER_FALLBACK_MODELS || "nvidia/nemotron-3-ultra-550b-a55b:free,openai/gpt-oss-120b:free,google/gemma-4-31b-it:free")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
};

console.log("Config debug:");
console.log("  NVIDIA_API_KEY:", providerConfig.nvidiaApiKey ? "SET" : "MISSING");
console.log("  OPENROUTER_API_KEY:", config.OPENROUTER_API_KEY ? "SET" : "MISSING");
console.log("  OPENROUTER_FALLBACK_API_KEYS:", config.OPENROUTER_FALLBACK_API_KEYS ? "SET" : "MISSING");
console.log("  openRouterKeys array length:", providerConfig.openRouterKeys.length);
console.log("  openRouterModels:", providerConfig.openRouterModels);

const now = new Date().toISOString();

const camila = {
  id: "camila-23",
  name: "Camila",
  age: 23,
  initialMemories: [
    { kind: "routine", text: "Trabajo de freelance desde casa, con deadlines los viernes" },
    { kind: "preference", text: "Prefiero avisos suaves, no alarmas fuertes" },
    { kind: "goal", text: "Quiero bajar la ansiedad y organizar mejor los proyectos" },
  ],
};

const state = {
  userName: camila.name,
  stage: "born",
  trustedEnergy: 200,
  totalEnergy: 400,
  createdAt: now,
  updatedAt: now,
  voicePreference: { warmth: 8, directness: 5, humor: 4, detail: 4, proactivity: 6 },
  runtime: {},
  heartbeat: { enabled: true, activeStartHour: 7, activeEndHour: 22, maxNudgesPerDay: 2, dailyNudgeCount: 0 },
  memories: camila.initialMemories.map((m, i) => ({
    id: `init_${i}`,
    createdAt: now,
    sourceEntryId: "init",
    status: "confirmed",
    ...m,
  })),
  commitments: [],
  records: [],
  entries: [],
  actions: [],
  calendarEvents: [],
  energyEvents: [],
  nudges: [],
  modelCalls: [],
  ephemeralMode: false,
  durableMemoryEnabled: true,
  actionPreparationEnabled: true,
  worldSignalsEnabled: true,
};

const history = [];
const input = "Buenos días Koru, tengo entrega de branding hoy y estoy nerviosa. ¿Me ayudás a organizar el día?";

console.log("\n🌿 KORU Smoke Test — Camila Day 1, Turn 1\n");
console.log(`→ "${input}"\n`);

try {
  const result = await turn(input, state, history);
  
  console.log(`← ${result.reply}\n`);
  console.log(`Provider: ${result.provider} | Model: ${result.model || "unknown"}`);
  console.log(`Mascot: ${result.mascotState || "unknown"}`);
  console.log(`UI Blocks: ${result.uiBlocks?.length || 0}`);
  console.log(`Tool Calls: ${result.toolResults?.length || 0}`);
  
  if (result.uiBlocks?.length > 0) {
    console.log("\nCards:");
    for (const block of result.uiBlocks) {
      console.log(`  - [${block.type}] ${block.title || "(sin título)"}`);
    }
  }
  
  // Check for hardcoded phrases
  const badPhrases = [
    "gracias por contarmelo asi", "no hace falta convertirlo", "un segundo, lo ordeno",
    "te leo", "listo. te dejo lo importante y el siguiente paso", "te dejo el numero y el criterio",
    "te bajo esto a algo manejable", "estoy aca para seguir", "lo marco como hecho",
    "listo. brief listo.", "listo. resumen de dinero listo.", "criterio de decision listo",
  ];
  const text = `${result.reply} ${JSON.stringify(result.uiBlocks || [])}`.toLowerCase();
  const foundBad = badPhrases.filter(p => text.includes(p));
  if (foundBad.length > 0) {
    console.log(`\n⚠️  HARDCODED PHRASES DETECTED: ${foundBad.join(", ")}`);
  } else {
    console.log("\n✅ No hardcoded phrases detected");
  }
  
  console.log("\n✅ Smoke test PASSED");
} catch (err) {
  console.error(`\n❌ Smoke test FAILED: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}

async function turn(input, state, history) {
  const payload = { input, state, history };
  const result = await runKoruBackendTurn(payload, providerConfig);
  history.push({ role: "user", content: input, createdAt: new Date().toISOString() });
  history.push({ role: "assistant", content: result.reply, createdAt: new Date().toISOString() });
  return result;
}