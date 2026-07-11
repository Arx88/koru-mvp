/**
 * KORU UX Experiment Eval - 20 real interactions.
 *
 * Goal: validate the experimental UX contract, not just model cleverness:
 * immediate chat, quick hints for small tasks, real working progress for deep
 * deliverables, unified cards, useful detail, memory continuity, and no broken
 * UI payloads.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runKoruBackendTurn } from "../../src/server/koruBackend.ts";

function loadEnv() {
  const env = {};
  const raw = readFileSync(new URL("../../.env", import.meta.url), "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length) env[key] = valueParts.join("=");
  }
  return env;
}

const env = loadEnv();
const forcedModel = process.env.KORU_EVAL_MODEL?.trim() || "";
const forcedNvidiaBaseUrl = process.env.KORU_EVAL_NVIDIA_BASE_URL?.trim() || "";
const forcedNvidiaApiKey = process.env.KORU_EVAL_NVIDIA_API_KEY?.trim() || "";
const evalLimit = Number.parseInt(process.env.KORU_EVAL_LIMIT || "", 10);
const evalOnly = (process.env.KORU_EVAL_ONLY || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const envNvidiaBaseUrl = env.NVIDIA_BASE_URL?.trim() || "";
const envNvidiaIsOllama = envNvidiaBaseUrl.includes(":11434") || envNvidiaBaseUrl.toLowerCase().includes("ollama");
const providerConfig = {
  nvidiaApiKey: forcedNvidiaApiKey || env.NVIDIA_API_KEY?.trim(),
  nvidiaBaseUrl: forcedNvidiaBaseUrl || env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
  nvidiaModel: forcedModel || env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
  openRouterKeys: [
    env.OPENROUTER_API_KEY?.trim(),
    ...(env.OPENROUTER_FALLBACK_API_KEYS?.split(",") || []),
  ].filter(Boolean),
  openRouterModels: (env.OPENROUTER_FALLBACK_MODELS || "nvidia/nemotron-3-ultra-550b-a55b:free,openai/gpt-oss-120b:free,google/gemma-4-31b-it:free")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  minimaxAccessToken: env.MINIMAX_ACCESS_TOKEN?.trim() || env.MINIMAX_API_KEY?.trim(),
  bluesmindsKeys: [
    env.BLUESMINDS_API_KEY?.trim(),
    ...(env.BLUESMINDS_FALLBACK_API_KEYS?.split(",") || []),
  ].filter(Boolean),
  bluesmindsModel: env.BLUESMINDS_MODEL?.trim() || "mimo-v2.5",
  ollamaEmbedBaseUrl: env.OLLAMA_EMBED_BASE_URL?.trim() || env.OLLAMA_BASE_URL?.trim() || (envNvidiaIsOllama ? envNvidiaBaseUrl : undefined),
};

const BAD_PHRASES = [
  "gracias por contarmelo asi",
  "no hace falta convertirlo",
  "un segundo, lo ordeno",
  "te leo",
  "listo. te dejo lo importante",
  "te bajo esto a algo manejable",
  "lo marco como hecho",
  "criterio de decision listo",
];

const CASES = [
  {
    id: "01-greeting",
    group: "simple",
    input: "Buenos dias Koru, como estas hoy?",
    expect: { noDeep: true, maxBlocks: 0, tone: "warm" },
  },
  {
    id: "02-soft-day-plan",
    group: "plan",
    input: "Tengo bastante trabajo hoy y estoy disperso. Organizame el dia sin ponerme presion.",
    expect: { anyBlock: ["plan", "activity_group", "smart_checklist", "decision_support"], tone: "supportive" },
  },
  {
    id: "03-save-routine",
    group: "memory",
    input: "Acordate que los martes a la tarde juego al padel y prefiero no meter reuniones ahi.",
    expect: { memoryOrCommitment: true },
  },
  {
    id: "04-memory-followup",
    group: "memory",
    input: "Que sabes de mis martes a la tarde?",
    expect: { memoryUse: true, noDeep: true },
  },
  {
    id: "05-shopping-list",
    group: "records",
    input: "Necesito comprar leche, cafe, arroz y pilas. Guardamelo como lista del super.",
    expect: { anyBlock: ["shopping_list", "saved_record", "smart_checklist"] },
  },
  {
    id: "06-reminder",
    group: "commitment",
    input: "Recordame manana a las 9 mandar el presupuesto a Laura.",
    expect: { anyBlock: ["reminder", "alarm"], memoryOrCommitment: true },
  },
  {
    id: "07-quick-weather",
    group: "quick-web",
    input: "Voy a salir por Madrid en una hora. Decime rapido si necesito paraguas.",
    expect: { anyBlock: ["weather", "web_nav", "proactive_signal"], quickExternal: true },
  },
  {
    id: "08-deep-report-aoe2",
    group: "deep",
    input: "Quiero un informe completo sobre Age of Empires II: historia, civilizaciones y como se juega hoy.",
    expect: { deliverable: true, sources: true, detail: true },
  },
  {
    id: "09-deep-report-learning",
    group: "deep",
    input: "Armame un informe serio sobre como aprender ingles de adulto con poco tiempo.",
    expect: { deliverable: true, sources: true, detail: true },
  },
  {
    id: "10-comparison",
    group: "analysis",
    input: "Comparame Notion y Obsidian para organizar proyectos personales. Quiero recomendacion clara.",
    expect: { anyBlock: ["comparison", "decision_support", "deliverable", "research_sources"] },
  },
  {
    id: "11-decision",
    group: "decision",
    input: "No se si comprar una notebook nueva ahora o esperar dos meses. Ayudame a decidir.",
    expect: { anyBlock: ["decision_support", "comparison"] },
  },
  {
    id: "12-money",
    group: "money",
    input: "Gaste 23000 en super, 8900 en farmacia y 12000 en nafta. Registralo y dame resumen.",
    expect: { anyBlock: ["money_summary", "saved_record", "data_ticker"] },
  },
  {
    id: "13-health-safe",
    group: "health",
    input: "Me duele un poco la rodilla despues de caminar. Que ejercicios suaves puedo hacer en casa?",
    expect: { healthSafe: true, anyBlock: ["health_reminder", "wellbeing", "smart_checklist", "activity_group"] },
  },
  {
    id: "14-sports-signal",
    group: "quick-web",
    input: "River juega hoy? Si hay algo importante del partido avisame.",
    expect: { anyBlock: ["proactive_signal", "web_nav", "live_match"], quickExternal: true },
  },
  {
    id: "15-weekend-plan",
    group: "plan",
    input: "Armame un plan de fin de semana tranquilo en Madrid, con una salida y descanso.",
    expect: { anyBlock: ["plan", "travel_planner", "activity_group", "deliverable"] },
  },
  {
    id: "16-product-analysis",
    group: "analysis",
    input: "Analizame si me conviene comprar un Kindle para leer papers y novelas.",
    expect: { anyBlock: ["product_analysis", "comparison", "decision_support", "deliverable"] },
  },
  {
    id: "17-draft-message",
    group: "generation",
    input: "Escribime un mensaje amable para cancelar una reunion sin quedar mal.",
    expect: { anyBlock: ["generation", "review_document", "review_quote"], noDeep: true },
  },
  {
    id: "18-expiry-memory",
    group: "memory",
    input: "Guardame que mi seguro del auto vence el 12 de agosto y quiero verlo una semana antes.",
    expect: { memoryOrCommitment: true, anyBlock: ["reminder", "saved_record", "birthday_alarm"] },
  },
  {
    id: "19-emotional",
    group: "support",
    input: "Estoy bajon y un poco solo. No quiero productividad, solo compania.",
    expect: { noDeep: true, tone: "emotional" },
  },
  {
    id: "20-week-recap",
    group: "memory",
    input: "Que aprendiste de mi en estas interacciones y como me ayudarias mejor manana?",
    expect: { memoryUse: true, noDeep: true },
  },
];

function baseState() {
  const now = new Date().toISOString();
  return {
    userName: "Juan",
    stage: "born",
    trustedEnergy: 240,
    totalEnergy: 420,
    createdAt: now,
    updatedAt: now,
    runtime: {},
    heartbeat: { enabled: true, activeStartHour: 8, activeEndHour: 21, maxNudgesPerDay: 3, dailyNudgeCount: 0 },
    worldSignalsEnabled: true,
    actionPreparationEnabled: true,
    durableMemoryEnabled: true,
    ephemeralMode: false,
    voicePreference: { warmth: 8, directness: 6, humor: 3, detail: 6, proactivity: 7 },
    memories: [
      {
        id: "seed_memory_1",
        createdAt: now,
        sourceEntryId: "seed",
        status: "confirmed",
        kind: "preference",
        text: "Juan prefiere respuestas claras, visuales y sin vueltas.",
        confidence: 0.9,
        sensitivity: "normal",
        useForSuggestions: true,
      },
      {
        id: "seed_memory_2",
        createdAt: now,
        sourceEntryId: "seed",
        status: "confirmed",
        kind: "goal",
        text: "Juan esta validando si Koru puede ser una UX experimental util y funcional.",
        confidence: 0.9,
        sensitivity: "normal",
        useForSuggestions: true,
      },
    ],
    commitments: [],
    actions: [],
    calendarEvents: [],
    records: [],
    entries: [],
    energyEvents: [],
    nudges: [],
    modelCalls: [],
    learningPreferences: [],
  };
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function recordsFromBlock(block) {
  if (block.type === "saved_record") return block.records ?? [];
  if (block.type === "shopping_list") {
    return (block.items ?? []).map((item) => ({
      domain: "home",
      kind: "shopping_item",
      title: String(item),
      value: String(item),
    }));
  }
  return [];
}

function persistState(state, input, result) {
  const now = new Date().toISOString();
  const entryId = createId("entry");
  const uiBlockRecords = (result.uiBlocks ?? []).flatMap(recordsFromBlock);
  const memories = (result.memoryCandidates ?? [])
    .filter((memory) => memory.text && String(memory.text).trim().length > 3)
    .map((memory) => ({
      ...memory,
      id: createId("mem"),
      createdAt: now,
      sourceEntryId: entryId,
      status: "confirmed",
      sensitivity: memory.sensitivity ?? "normal",
      confidence: memory.confidence ?? 0.7,
      useForSuggestions: memory.useForSuggestions ?? true,
    }));
  const commitments = (result.commitments ?? [])
    .filter((commitment) => commitment.title && String(commitment.title).trim().length > 3)
    .map((commitment) => ({
      ...commitment,
      id: createId("commit"),
      createdAt: now,
      sourceEntryId: entryId,
      status: "open",
      dueHint: commitment.dueHint || "sin fecha",
    }));
  const records = [...(result.records ?? []), ...uiBlockRecords]
    .filter((record) => record.title && String(record.title).trim().length > 0)
    .map((record) => ({
      ...record,
      id: createId("rec"),
      createdAt: now,
      sourceEntryId: entryId,
    }));
  const actions = (result.uiBlocks ?? []).map((block) => ({
    id: createId("action"),
    createdAt: now,
    updatedAt: now,
    sourceEntryId: entryId,
    kind: block.type === "deliverable" ? "web_research" : block.type,
    title: block.title ?? block.kicker ?? block.question ?? block.type,
    body: result.reply,
    status: "proposed",
    approvalRequired: false,
    payload: { uiBlock: block },
  }));
  const entry = {
    id: entryId,
    createdAt: now,
    text: input,
    summary: result.understanding?.userGoal ?? result.reply?.slice(0, 120) ?? input,
    transcriptSource: "typed",
    energyAwarded: 12,
    sentiment: "neutral",
    memoryIds: memories.map((m) => m.id),
    commitmentIds: commitments.map((c) => c.id),
    actionIds: actions.map((a) => a.id),
    recordIds: records.map((r) => r.id),
    activeMemoryIds: [],
    brainProvider: result.provider,
    brainModel: result.model ?? result.provider,
  };
  return {
    ...state,
    updatedAt: now,
    trustedEnergy: state.trustedEnergy + 7,
    totalEnergy: state.totalEnergy + 12,
    memories: [...memories, ...(state.memories ?? [])],
    commitments: [...commitments, ...(state.commitments ?? [])],
    records: [...records, ...(state.records ?? [])].slice(0, 500),
    actions: [...actions, ...(state.actions ?? [])],
    entries: [entry, ...(state.entries ?? [])],
    modelCalls: [
      {
        id: createId("call"),
        createdAt: now,
        taskType: "ux_eval_turn",
        provider: result.provider,
        model: result.model ?? result.provider,
        success: true,
        latencyMs: 0,
        summary: result.understanding?.userGoal ?? input,
        error: result.fallbackReason,
      },
      ...(state.modelCalls ?? []),
    ].slice(0, 120),
  };
}

function flattenText(value) {
  return JSON.stringify(value ?? "").toLowerCase();
}

function hasBrokenFields(blocks) {
  return blocks.some((block) => {
    const text = JSON.stringify(block).toLowerCase();
    return text.includes("undefined") || text.includes("\"null\"") || text.includes("nan");
  });
}

function blockTypes(blocks) {
  return blocks.map((b) => b.type).filter(Boolean);
}

function scoreCase(testCase, result, chunks, appliedItems, latencyMs) {
  const blocks = result.uiBlocks ?? [];
  const types = blockTypes(blocks);
  const text = `${result.reply}\n${JSON.stringify(blocks)}`.toLowerCase();
  const notes = [];
  let score = 100;

  if (!result.reply || result.reply.trim().length < 20) {
    score -= 20;
    notes.push("respuesta demasiado corta");
  }
  if (result.reply && result.reply.length > 1800) {
    score -= 6;
    notes.push("respuesta larga para mobile");
  }
  const bad = BAD_PHRASES.find((p) => text.includes(p));
  if (bad) {
    score -= 15;
    notes.push(`frase rigida: ${bad}`);
  }
  if (hasBrokenFields(blocks)) {
    score -= 25;
    notes.push("payload UI con undefined/null/NaN");
  }

  const anyBlock = testCase.expect.anyBlock ?? [];
  if (anyBlock.length && !types.some((type) => anyBlock.includes(type))) {
    score -= 16;
    notes.push(`faltaba block esperado (${anyBlock.join("|")}); llego: ${types.join(",") || "ninguno"}`);
  }

  const hasWorkingDeliverable = chunks.some((chunk) =>
    (chunk.uiBlocks ?? []).some((b) => b.type === "deliverable" && b.status === "working"),
  );
  const readyDeliverable = blocks.find((b) => b.type === "deliverable" && b.status === "ready");
  if (testCase.expect.deliverable) {
    if (!hasWorkingDeliverable) {
      score -= 12;
      notes.push("deep flow sin deliverable working/progreso");
    }
    if (!readyDeliverable) {
      score -= 25;
      notes.push("deep flow sin deliverable ready");
    } else {
      if (!readyDeliverable.title || !readyDeliverable.description) {
        score -= 8;
        notes.push("deliverable sin titulo/descripcion solidos");
      }
      if ((readyDeliverable.categories ?? []).length < 2) {
        score -= 6;
        notes.push("deliverable con pocas categorias");
      }
      if ((readyDeliverable.sections ?? []).length < 3) {
        score -= 14;
        notes.push("detalle pobre: menos de 3 secciones");
      }
      if (testCase.expect.sources && (readyDeliverable.sources ?? []).length < 2) {
        score -= 12;
        notes.push("investigacion con pocas fuentes");
      }
    }
  }

  if (testCase.expect.noDeep && (hasWorkingDeliverable || readyDeliverable)) {
    score -= 20;
    notes.push("uso flujo profundo para una interaccion simple");
  }

  if (testCase.expect.maxBlocks != null && blocks.length > testCase.expect.maxBlocks) {
    score -= 8;
    notes.push(`demasiadas cards para una interaccion simple (${blocks.length})`);
  }

  if (testCase.expect.quickExternal) {
    const hasExternal = result.toolResults?.length || types.some((t) => ["weather", "web_nav", "live_match", "proactive_signal"].includes(t));
    if (!hasExternal) {
      score -= 12;
      notes.push("pedido externo rapido sin senal/herramienta externa");
    }
    if (hasWorkingDeliverable) {
      score -= 10;
      notes.push("pedido rapido tratado como informe profundo");
    }
  }

  if (testCase.expect.memoryOrCommitment) {
    const produced = (result.memoryCandidates?.length ?? 0) + (result.commitments?.length ?? 0) + (result.records?.length ?? 0) + appliedItems.filter((i) => i.kind !== "action").length;
    if (!produced) {
      score -= 14;
      notes.push("no produjo memoria, pendiente ni registro");
    }
  }

  if (testCase.expect.memoryUse) {
    const mentionsKnownContext = text.includes("padel") || text.includes("martes") || text.includes("juan") || text.includes("seguro") || text.includes("auto") || text.includes("kendu") || text.includes("koru");
    if (!mentionsKnownContext) {
      score -= 14;
      notes.push("no parece usar memoria/contexto previo");
    }
  }

  if (testCase.expect.healthSafe) {
    const safe = ["medico", "profesional", "dolor fuerte", "si empeora", "suave", "sin dolor"].some((needle) => text.includes(needle));
    if (!safe) {
      score -= 18;
      notes.push("salud sin disclaimer o limites claros");
    }
  }

  if (testCase.expect.tone === "emotional") {
    const warm = ["estoy", "aca", "solo", "acompan", "no tenes que", "vamos"].some((needle) => text.includes(needle));
    if (!warm) {
      score -= 12;
      notes.push("tono emocional poco contenido");
    }
  }

  if (chunks.length > 0 && chunks.every((chunk) => !(chunk.stateEvents?.length))) {
    score -= 4;
    notes.push("chunks sin stateEvents");
  }
  if (latencyMs > 90_000) {
    score -= 5;
    notes.push("latencia mayor a 90s");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    notes,
    blockTypes: types,
    chunks: chunks.map((chunk) => ({
      reply: chunk.reply,
      blocks: blockTypes(chunk.uiBlocks ?? []),
      events: chunk.stateEvents ?? [],
      deliverableProgress: (chunk.uiBlocks ?? []).find((b) => b.type === "deliverable")?.progress,
    })),
  };
}

async function main() {
  console.log("KORU UX Experiment Eval - 20 interactions\n");
  console.log(`Provider availability: bluesminds=${providerConfig.bluesmindsKeys.length}, nvidia=${providerConfig.nvidiaApiKey ? "yes" : "no"}, openrouter=${providerConfig.openRouterKeys.length}\n`);
  if (forcedModel) console.log(`Forced model per turn: ${forcedModel}\n`);
  if (forcedNvidiaBaseUrl) console.log(`Forced NVIDIA base URL: ${forcedNvidiaBaseUrl}\n`);
  if (forcedNvidiaApiKey) console.log("Forced NVIDIA API key: SET\n");

  let state = baseState();
  const history = [];
  const rows = [];

  const filteredCases = evalOnly.length ? CASES.filter((testCase) => evalOnly.includes(testCase.id)) : CASES;
  const casesToRun = Number.isFinite(evalLimit) && evalLimit > 0 ? filteredCases.slice(0, evalLimit) : filteredCases;
  for (let i = 0; i < casesToRun.length; i++) {
    const testCase = casesToRun[i];
    const chunks = [];
    const started = Date.now();
    console.log(`[${i + 1}/${casesToRun.length}] ${testCase.id}: ${testCase.input}`);
    try {
      const result = await runKoruBackendTurn({ input: testCase.input, state, history, model: forcedModel || undefined }, providerConfig, (chunk) => {
        chunks.push(chunk);
      });
      const latencyMs = Date.now() - started;
      state = persistState(state, testCase.input, result);
      history.push({ role: "user", content: testCase.input, createdAt: new Date().toISOString() });
      history.push({ role: "assistant", content: result.reply, createdAt: new Date().toISOString() });
      if (history.length > 24) history.splice(0, history.length - 24);

      const appliedItems = [
        ...(result.memoryCandidates ?? []).map((memory) => ({ kind: "memory", text: memory.text })),
        ...(result.commitments ?? []).map((commitment) => ({ kind: "commitment", text: commitment.title })),
      ];
      const evaluation = scoreCase(testCase, result, chunks, appliedItems, latencyMs);
      rows.push({
        id: testCase.id,
        group: testCase.group,
        input: testCase.input,
        reply: result.reply,
        provider: result.provider,
        model: result.model,
        fallbackReason: result.fallbackReason,
        mascotState: result.mascotState,
        latencyMs,
        uiBlocks: result.uiBlocks ?? [],
        appliedItems,
        toolResults: result.toolResults ?? [],
        memoryCandidates: result.memoryCandidates ?? [],
        commitments: result.commitments ?? [],
        records: result.records ?? [],
        stateEvents: result.stateEvents ?? [],
        evaluation,
      });
      console.log(`  -> ${evaluation.score}/100 blocks=[${evaluation.blockTypes.join(",") || "-"}] chunks=${chunks.length} ${evaluation.notes.length ? `WARN ${evaluation.notes.join(" | ")}` : "OK"}`);
    } catch (err) {
      const latencyMs = Date.now() - started;
      rows.push({
        id: testCase.id,
        group: testCase.group,
        input: testCase.input,
        error: err instanceof Error ? err.message : String(err),
        latencyMs,
        evaluation: { score: 0, notes: ["runtime error"], blockTypes: [], chunks: [] },
      });
      console.log(`  -> ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const valid = rows.filter((row) => !row.error);
  const avg = valid.length ? valid.reduce((sum, row) => sum + row.evaluation.score, 0) / valid.length : 0;
  const byGroup = {};
  for (const row of rows) {
    byGroup[row.group] ??= [];
    byGroup[row.group].push(row.evaluation.score);
  }
  const groupScores = Object.fromEntries(
    Object.entries(byGroup).map(([group, scores]) => [group, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)]),
  );
  const summary = {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    valid: valid.length,
    errors: rows.length - valid.length,
    averageScore: Math.round(avg),
    groupScores,
    worst: [...rows].sort((a, b) => a.evaluation.score - b.evaluation.score).slice(0, 5).map((row) => ({
      id: row.id,
      score: row.evaluation.score,
      notes: row.evaluation.notes,
      error: row.error,
    })),
  };

  mkdirSync("tests/agents/reports", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = `tests/agents/reports/koru-ux-20-${stamp}.json`;
  const mdPath = `tests/agents/reports/koru-ux-20-${stamp}.md`;
  writeFileSync(jsonPath, JSON.stringify({ summary, rows }, null, 2));
  writeFileSync(mdPath, renderMarkdown(summary, rows));

  console.log("\nSUMMARY");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nSaved JSON: ${jsonPath}`);
  console.log(`Saved MD:   ${mdPath}`);
}

function renderMarkdown(summary, rows) {
  const lines = [];
  lines.push("# KORU UX 20 Interaction Eval");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Average score: **${summary.averageScore}/100**`);
  lines.push(`Errors: **${summary.errors}/${summary.total}**`);
  lines.push("");
  lines.push("## Group Scores");
  for (const [group, score] of Object.entries(summary.groupScores)) {
    lines.push(`- ${group}: ${score}/100`);
  }
  lines.push("");
  lines.push("## Turns");
  for (const row of rows) {
    lines.push("");
    lines.push(`### ${row.id} - ${row.evaluation.score}/100`);
    lines.push(`Group: ${row.group}`);
    lines.push("");
    lines.push(`User: ${row.input}`);
    if (row.error) {
      lines.push("");
      lines.push(`Error: ${row.error}`);
      continue;
    }
    lines.push("");
    lines.push(`Reply: ${row.reply}`);
    lines.push("");
    lines.push(`Provider: ${row.provider}${row.model ? ` / ${row.model}` : ""}`);
    lines.push(`Latency: ${Math.round(row.latencyMs / 1000)}s`);
    lines.push(`Blocks: ${(row.evaluation.blockTypes ?? []).join(", ") || "-"}`);
    lines.push(`Chunks: ${(row.evaluation.chunks ?? []).length}`);
    if (row.evaluation.notes.length) {
      lines.push(`Notes: ${row.evaluation.notes.join("; ")}`);
    }
    if (row.uiBlocks?.length) {
      lines.push("");
      lines.push("UI block summary:");
      for (const block of row.uiBlocks) {
        lines.push(`- ${block.type}${block.status ? `/${block.status}` : ""}: ${block.title ?? block.kicker ?? block.question ?? "-"}`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
