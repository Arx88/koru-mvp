/**
 * Koru 7-Day Multi-Persona Evaluation Engine
 * 
 * This script runs 4 personas (ages 20,30,40,60) through 7 organic days of
 * interaction with the real Koru backend (NO HTTP server needed).
 * 
 * Usage: npx tsx tests/agents/eval-engine.mjs
 */

import { runKoruBackendTurn } from "../../src/server/koruBackend.ts";
import { readFileSync } from "node:fs";

// Load .env manually so it works regardless of how the script is invoked
const envContent = readFileSync("tests/agents/../../.env", "utf-8");
const envConfig = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...valueParts] = trimmed.split("=");
  if (key && valueParts.length) {
    envConfig[key] = valueParts.join("=");
  }
}

// ---------------------------------------------------------------------------
// Provider Config from .env
// ----------------------------------------------------------------------------
const providerConfig = {
  nvidiaApiKey: envConfig.NVIDIA_API_KEY?.trim(),
  nvidiaBaseUrl: envConfig.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com",
  nvidiaModel: envConfig.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b",
  openRouterKeys: [
    envConfig.OPENROUTER_API_KEY?.trim(),
    ...(envConfig.OPENROUTER_FALLBACK_API_KEYS?.split(",") || []),
  ].filter(Boolean),
  openRouterModels: (envConfig.OPENROUTER_FALLBACK_MODELS || "nvidia/nemotron-3-ultra-550b-a55b:free,openai/gpt-oss-120b:free,google/gemma-4-31b-it:free")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
};

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------
const PERSONAS = [
  {
    id: "camila-23",
    name: "Camila",
    age: 23,
    profile: "Diseñadora gráfica freelance, vive con 2 amigas, presupuesto ajustado, ansiedad social entre semana.",
    voice: { warmth: 8, directness: 5, humor: 4, detail: 4, proactivity: 6 },
    initialMemories: [
      { kind: "routine", text: "Trabajo de freelance desde casa, con deadlines los viernes" },
      { kind: "preference", text: "Prefiero avisos suaves, no alarmas fuertes" },
      { kind: "goal", text: "Quiero bajar la ansiedad y organizar mejor los proyectos" },
    ],
    schedule: [
      { day: 1, moments: [
        { time: "08:00", context: "Buenos días, lunes de entrega", input: "Buenos días Koru, tengo entrega de branding hoy y estoy nerviosa. ¿Me ayudás a organizar el día?" },
        { time: "14:30", context: "Después de almorzar", input: "Compré lápices de colores, marcadores y un cuaderno nuevo para el proyecto de Ana. Anotalo en gastos." },
        { time: "20:00", context: "Antes de cenar", input: "Estoy agotada. ¿Qué me recomendás para bajar la ansiedad?" },
      ]},
      { day: 2, moments: [
        { time: "09:00", context: "Martes tranqui", input: "Hoy no tengo deadlines. Quiero que me planifiques el día pero sin presiones." },
        { time: "18:00", context: "Juntada con amigas", input: "A las 21 ceno con Vicky y Laura en Palermo. Recordame y fijate si llueve." },
      ]},
      { day: 3, moments: [
        { time: "07:30", context: "Miércoles temprano", input: "Me desperté mal. ¿Qué podes hacer por mí hoy?" },
        { time: "15:00", context: "Procrastinando", input: "No puedo concentrarme. Ayudame con un primer paso chico." },
      ]},
      { day: 4, moments: [
        { time: "10:00", context: "Jueves productivo", input: "Necesito que busques paletas de color para branding de café. Compará opciones." },
      ]},
      { day: 5, moments: [
        { time: "11:00", context: "Viernes de entrega", input: "Entregué el branding. ¡Qué alivio!" },
      ]},
      { day: 6, moments: [
        { time: "11:00", context: "Sábado relajado", input: "Quiero hacer algo divertido este finde pero no sé qué." },
      ]},
      { day: 7, moments: [
        { time: "20:00", context: "Domingo noche", input: "¿Qué aprendiste de mí esta semana y cómo me ayudás a estar mejor?" },
      ]},
    ],
  },
  {
    id: "martin-34",
    name: "Martín",
    age: 34,
    profile: "Product Manager en startup. Padre primerizo. Sobrecargado, busca eficiencia y que nada se escape.",
    voice: { warmth: 5, directness: 9, humor: 2, detail: 7, proactivity: 9 },
    initialMemories: [
      { kind: "routine", text: "Standup diario a las 9, reuniones todo el día hasta las 19" },
      { kind: "relationship", text: "Mi hijo Tomás tiene 2 años, cita pediatra el primer martes de mes" },
      { kind: "goal", text: "Quiero desconectar los findes" },
    ],
    schedule: [
      { day: 1, moments: [
        { time: "08:30", context: "Lunes intenso", input: "Hoy tengo 4 reuniones, sprint review y necesito que me armes el día como un campamento militar." },
        { time: "12:00", context: "Almuerzo", input: "Ana, mi esposa, cumple 35 el 15. Necesito ideas de regalo." },
        { time: "19:30", context: "Llegando a casa", input: "Estoy quemado. ¿Qué hago para desconectar?" },
      ]},
      { day: 2, moments: [
        { time: "08:15", context: "Martes", input: "Hoy me toca liderar la retrospectiva. Dame un brief de 3 puntos." },
        { time: "13:00", context: "Durante almuerzo", input: "Necesito comprar pañales, toallitas y un yogur para Tomás. Sumalo a la lista del super." },
      ]},
      { day: 3, moments: [
        { time: "09:00", context: "Miércoles", input: "No sé si avanzar con la feature X o la Y. Necesito ayuda para decidir." },
      ]},
      { day: 4, moments: [
        { time: "08:45", context: "Jueves", input: "Mi jefe me pidió un reporte para mañana y no empiezo. Rompé el hielo." },
      ]},
      { day: 5, moments: [
        { time: "17:00", context: "Viernes tarde", input: "¡Es viernes! ¿Qué planificaste para el finde con mi familia?" },
      ]},
      { day: 6, moments: [
        { time: "10:00", context: "Sábado", input: "Quiero dedicarle tiempo a Tomás hoy. Ideas de actividades para un niño de 2 años." },
      ]},
      { day: 7, moments: [
        { time: "20:00", context: "Domingo", input: "¿Qué semana me espera y qué debería tener listo antes del lunes?" },
      ]},
    ],
  },
  {
    id: "laura-47",
    name: "Laura",
    age: 47,
    profile: "Docente universitaria, 2 hijos adolescentes. Organizada pero abrumada. Enfocada en práctica y resultado.",
    voice: { warmth: 6, directness: 7, humor: 3, detail: 6, proactivity: 7 },
    initialMemories: [
      { kind: "routine", text: "Clases de mañana, coordinación de padres por WhatsApp" },
      { kind: "health", text: "Presión alta, controles cada 3 meses con Dra. Giménez" },
      { kind: "goal", text: "Terminar el diplomado este año" },
    ],
    schedule: [
      { day: 1, moments: [
        { time: "07:00", context: "Lunes madrugadora", input: "Hoy empiezo a las 8 con clase, después reunión de padres a las 16. Organizame." },
        { time: "21:00", context: "Noche", input: "Los chicos están raros, Juani no quiere estudiar. ¿Qué hago?" },
      ]},
      { day: 2, moments: [
        { time: "14:00", context: "Martes", input: "Gasté 12.300 en farmacia y 8.500 en super. Registrá." },
      ]},
      { day: 3, moments: [
        { time: "19:00", context: "Miércoles", input: "Mañana tengo control médico a las 10 en el Centro Córdoba. Recordame y fijate el tráfico." },
      ]},
      { day: 4, moments: [
        { time: "08:00", context: "Jueves", input: "Salí del médico, me subieron la sertralina. Recordame todos los días a las 8." },
        { time: "17:00", context: "Tarde", input: "¿Qué tengo que hacer antes de que Juani vuelva del colegio?" },
      ]},
      { day: 5, moments: [
        { time: "18:00", context: "Viernes tarde", input: "¿Cómo va mi semana en números? Gastos y tareas." },
      ]},
      { day: 6, moments: [
        { time: "09:00", context: "Sábado", input: "Hoy limpio la casa y preparo presentación del lunes. Ayudame a planificar el día." },
      ]},
      { day: 7, moments: [
        { time: "20:00", context: "Domingo", input: "¿Cómo estuvo mi salud esta semana y qué debería tener en cuenta?" },
      ]},
    ],
  },
  {
    id: "roberto-61",
    name: "Roberto",
    age: 61,
    profile: "Jubilado contador, viudo. Hijo vive lejos. Busca compañía, estructura y emocionalidad. Muy cariñoso.",
    voice: { warmth: 9, directness: 4, humor: 5, detail: 5, proactivity: 6 },
    initialMemories: [
      { kind: "relationship", text: "Mi hijo Sebastián vive en Barcelona, llamamos los domingos" },
      { kind: "routine", text: "Todos los días riego el jardín por la tarde, hablo con las plantas" },
      { kind: "preference", text: "Me gusta el cine clásico y la música tangui" },
      { kind: "goal", text: "Quiero no sentirme solo" },
    ],
    schedule: [
      { day: 1, moments: [
        { time: "09:00", context: "Lunes", input: "Buenos días Koru, ¿cómo estás vos hoy?" },
        { time: "14:00", context: "Después de siesta", input: "Tengo un espacio en el jardín para una planta nueva. ¿Qué me recomendás?" },
        { time: "19:00", context: "Atardecer", input: "Me siento un poco solo. Contame algo lindo." },
      ]},
      { day: 2, moments: [
        { time: "11:00", context: "Martes", input: "River juega hoy. Si hay algo importante del partido avisame." },
        { time: "16:00", context: "Tarde", input: "Me duele un poco la rodilla. ¿Qué ejercicios puedo hacer en casa?" },
      ]},
      { day: 3, moments: [
        { time: "10:00", context: "Miércoles", input: "Quiero aprender algo nuevo esta semana. ¿Qué me sugerís?" },
      ]},
      { day: 4, moments: [
        { time: "20:00", context: "Jueves", input: "Estoy por llamar a Sebastián. Ayudame con temas de conversación." },
      ]},
      { day: 5, moments: [
        { time: "09:00", context: "Viernes", input: "¿Qué me contás del mundo hoy?" },
      ]},
      { day: 6, moments: [
        { time: "17:00", context: "Sábado", input: "Mi vecina cumplió 70 ayer y no le dije nada. ¿Qué le regalo?" },
      ]},
      { day: 7, moments: [
        { time: "10:00", context: "Domingo", input: "¿Qué semana me preparás esta vez?" },
        { time: "18:00", context: "Domingo noche", input: "Me voy a dormir. Decime algo que me haga sonreír." },
      ]},
    ],
  },
];

// ---------------------------------------------------------------------------
// Evaluation Engine
// ---------------------------------------------------------------------------

function baseState(persona) {
  const now = new Date().toISOString();
  return {
    userName: persona.name,
    stage: "born",
    trustedEnergy: 200,
    totalEnergy: 400,
    createdAt: now,
    updatedAt: now,
    voicePreference: persona.voice,
    runtime: {},
    heartbeat: { enabled: true, activeStartHour: 7, activeEndHour: 22, maxNudgesPerDay: 2, dailyNudgeCount: 0 },
    memories: persona.initialMemories.map((m, i) => ({
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
}

async function turn(input, state, history) {
  const payload = { input, state, history };
  const result = await runKoruBackendTurn(payload, providerConfig);
  history.push({ role: "user", content: input, createdAt: new Date().toISOString() });
  history.push({ role: "assistant", content: result.reply, createdAt: new Date().toISOString() });
  if (history.length > 30) history.splice(0, history.length - 30);
  return result;
}

function persist(state, result, label) {
  const now = new Date().toISOString();
  const prefix = label;
  state.records.push(...(result.records || []).map((r, i) => ({
    id: `${prefix}_rec_${i}`, createdAt: now, sourceEntryId: prefix, ...r,
  })));
  state.commitments.push(...(result.commitments || []).map((c, i) => ({
    id: `${prefix}_com_${i}`, createdAt: now, sourceEntryId: prefix, status: c.status ?? "open", ...c,
  })));
  state.memories.push(...(result.memoryCandidates || []).map((m, i) => ({
    id: `${prefix}_mem_${i}`, createdAt: now, sourceEntryId: prefix, confirmedAt: now, status: "confirmed", ...m,
  })));
}

function evaluationScore(label, result, persona) {
  const text = `${result.reply} ${JSON.stringify(result.uiBlocks || [])}`.toLowerCase();
  const blocks = result.uiBlocks || [];
  
  // Hardcoded known phrases that should NEVER appear
  const badPhrases = [
    "gracias por contarmelo asi", "no hace falta convertirlo", "un segundo, lo ordeno",
    "te leo", "listo. te dejo lo importante y el siguiente paso", "te dejo el numero y el criterio",
    "te bajo esto a algo manejable", "estoy aca para seguir", "lo marco como hecho",
    "listo. brief listo.", "listo. resumen de dinero listo.", "criterio de decision listo",
  ];
  
  const score = {
    intelligence: 0,    // 0-10
    proactivity: 0,     // 0-10
    cardsQuality: 0,    // 0-10
    toneFit: 0,         // 0-10
    memoryUsage: 0,     // 0-10
    surprise: 0,        // 0-10
    organicFeel: 0,     // 0-10
    notes: [],
  };

  // --- Intelligence ---
  if (result.reply && result.reply.length > 15) {
    score.intelligence = 5 + Math.min(result.reply.length / 40, 4);
  } else {
    score.intelligence = result.reply ? 3 : 0;
    score.notes.push("Reply muy corto o vacío");
  }
  if (badPhrases.some((p) => text.includes(p))) {
    score.intelligence = Math.max(1, score.intelligence - 3);
    score.notes.push(`Frase harcodeada detectada: ${badPhrases.find((p) => text.includes(p))}`);
  }

  // --- Proactivity ---
  const hasNextStep = text.includes("siguiente") || text.includes("próximo") || text.includes("podemos") || text.includes("quizás");
  const hasAnticipation = text.includes("también") || text.includes("además") || text.includes("te recomiendo");
  if (hasNextStep && hasAnticipation) score.proactivity = 8;
  else if (hasNextStep || hasAnticipation) score.proactivity = 6;
  else score.proactivity = 3;

  // --- Cards Quality ---
  if (blocks.length > 0) {
    const brokenBlock = blocks.some((b) => !b.title || b.title.includes("undefined") || b.title.includes("null"));
    if (brokenBlock) {
      score.cardsQuality = 2;
      score.notes.push("Tarjeta rota: título undefined/null");
    } else {
      score.cardsQuality = 7;
      if (blocks.every((b) => b.title && b.title.length < 60)) score.cardsQuality += 2;
      if (result.toolResults?.length > 0) score.cardsQuality += 1;
    }
  } else {
    score.cardsQuality = 5;
    score.notes.push("Sin tarjetas");
  }

  // --- Tone Fit ---
  if (persona.id === "roberto-61" && (text.includes("hola") || text.includes("amigo") || text.includes("querido"))) {
    score.toneFit = 8;
  } else if (persona.id === "martin-34" && text.includes("minutos")) {
    score.toneFit = 8;
  } else if (persona.id === "camila-23" && text.includes("tranqui")) {
    score.toneFit = 8;
  } else {
    score.toneFit = 6;
  }

  // --- Memory Usage ---
  if (text.includes(persona.name.toLowerCase()) || persona.initialMemories.some((m) => text.includes(m.text.toLowerCase()))) {
    score.memoryUsage = 8;
  } else if (result.toolResults?.some((t) => t.tool === "query_personal_context" || t.tool === "save_memory")) {
    score.memoryUsage = 6;
  } else {
    score.memoryUsage = 2;
    score.notes.push("No usó contexto guardado");
  }

  // --- Surprise (+1) ---
  const plusOne = text.includes("también") || text.includes("además") || text.includes("te aviso");
  score.surprise = plusOne ? 8 : 4;

  // --- Organic Feel ---
  if (result.reply.startsWith("Listo.") || result.reply.startsWith("Claro.")) {
    score.organicFeel = 3;
    score.notes.push("Empieza con 'Listo.' o 'Claro.' — suena robótico");
  } else {
    score.organicFeel = 7;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Main Evaluator
// ---------------------------------------------------------------------------

async function evaluatePersona(persona) {
  console.log(`\n🧑‍🤝‍🧑 Evaluando a ${persona.name} (${persona.age} años) — 7 días orgánicos\n`);
  const state = baseState(persona);
  const history = [];
  const transcript = [];
  let totalCost = 0;
  let turnCount = 0;

  for (const day of persona.schedule) {
    console.log(`\n--- Día ${day.day} ---`);
    for (const moment of day.moments) {
      turnCount++;
      // Show what's being asked
      console.log(`  [${moment.time}] ${moment.context}`);
      console.log(`  → "${moment.input}"`);

      try {
        const result = await turn(moment.input, state, history);
        persist(state, result, `${persona.id}_d${day.day}_${moment.time}`);

        // Evaluate turn
        const score = evaluationScore(`${persona.id}_d${day.day}`, result, persona);
        const realism = `${result.reply.slice(0, 70)}${result.reply.length > 70 ? "..." : ""}`;
        const mascot = result.mascotState || "idle";

        console.log(`  ← ${realism} [🐱 ${mascot}]`);
        console.log(`  Score: IQ=${Math.round(score.intelligence)} Pro=${Math.round(score.proactivity)} Card=${Math.round(score.cardsQuality)} Tone=${Math.round(score.toneFit)} Mem=${Math.round(score.memoryUsage)} +1=${Math.round(score.surprise)} Org=${Math.round(score.organicFeel)}`);
        if (score.notes.length) console.log(`  ⚠️ ${score.notes.join(" | ")}`);

        transcript.push({
          day: day.day, time: moment.time, context: moment.context,
          input: moment.input, reply: result.reply,
          mascotState: mascot, blocks: result.uiBlocks?.map((b) => b.type),
          tools: result.toolResults?.map((t) => t.tool),
          score,
        });

        // Estimate token cost (rough)
        totalCost += (JSON.stringify(result).length / 4) * 0.00001; // rough
      } catch (err) {
        console.log(`  💥 ERROR: ${err.message}`);
        transcript.push({
          day: day.day, time: moment.time, context: moment.context,
          input: moment.input, error: err.message,
          score: { intelligence: 0, proactivity: 0, cardsQuality: 0, toneFit: 0, memoryUsage: 0, surprise: 0, organicFeel: 0, notes: ["ERROR DE RED O API"] },
        });
      }
    }
  }

  // Compute averages
  const validTurns = transcript.filter((t) => !t.error);
  const avg = (key) => validTurns.reduce((s, t) => s + t.score[key], 0) / validTurns.length;
  const report = {
    persona: { id: persona.id, name: persona.name, age: persona.age },
    totalTurns: turnCount,
    errors: transcript.filter((t) => t.error).length,
    scores: {
      intelligence: avg("intelligence"),
      proactivity: avg("proactivity"),
      cardsQuality: avg("cardsQuality"),
      toneFit: avg("toneFit"),
      memoryUsage: avg("memoryUsage"),
      surprise: avg("surprise"),
      organicFeel: avg("organicFeel"),
      global: (avg("intelligence") + avg("proactivity") + avg("cardsQuality") + avg("toneFit") + avg("memoryUsage") + avg("surprise") + avg("organicFeel")) / 7,
    },
    worstTurns: [...validTurns].sort((a, b) => (Object.values(a.score).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0) - Object.values(b.score).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0))).slice(0, 3).map((t) => ({ day: t.day, input: t.input, reply: t.reply.slice(0, 60), score: t.score })),
    bestTurns: [...validTurns].sort((a, b) => (Object.values(b.score).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0) - Object.values(a.score).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0))).slice(0, 3).map((t) => ({ day: t.day, input: t.input, reply: t.reply.slice(0, 60), score: t.score })),
    estimatedCost: totalCost,
  };

  console.log(`\n🏁 Reporte de ${persona.name}:`);
  console.log(`  Global: ${report.scores.global.toFixed(1)}/10 | Errores: ${report.errors}/${report.totalTurns} | Costo estimado: ~$${report.estimatedCost.toFixed(2)}`);
  console.log(`  Detalle: IQ=${report.scores.intelligence.toFixed(1)} Pro=${report.scores.proactivity.toFixed(1)} Card=${report.scores.cardsQuality.toFixed(1)} Tone=${report.scores.toneFit.toFixed(1)} Mem=${report.scores.memoryUsage.toFixed(1)} +1=${report.scores.surprise.toFixed(1)} Org=${report.scores.organicFeel.toFixed(1)}`);

  return report;
}

async function main() {
  console.log("🌿 KORU — Evaluación Multi-Persona (7 días orgánicos)\n");
  console.log("⚠️  Esto ejecuta ~28-30 turnos reales contra el LLM. Costo estimado: $5-12 USD.");
  console.log("   Cada turno = Router + Composer + Memory Extractor + posibles tool calls.\n");

  const reports = [];
  for (const persona of PERSONAS) {
    reports.push(await evaluatePersona(persona));
    console.log("\n" + "=".repeat(60));
  }

  // Cross-persona comparison
  console.log("\n\n📊 COMPARACIÓN GLOBAL");
  for (const r of reports) {
    console.log(`${r.persona.name} (${r.persona.age}a): ${r.scores.global.toFixed(1)}/10`);
  }
  const best = reports.reduce((a, b) => a.scores.global > b.scores.global ? a : b);
  const worst = reports.reduce((a, b) => a.scores.global < b.scores.global ? a : b);
  console.log(`\n🏆 Mejor perfil: ${best.persona.name} (${best.scores.global.toFixed(1)})`);
  console.log(`⚠️  Perfil más crítico: ${worst.persona.name} (${worst.scores.global.toFixed(1)})`);

  const totalCost = reports.reduce((s, r) => s + r.estimatedCost, 0);
  console.log(`💰 Costo total estimado: ~$${totalCost.toFixed(2)}`);

  // Save full report
  const fs = await import("node:fs");
  fs.mkdirSync("tests/agents/reports", { recursive: true });
  const reportPath = `tests/agents/reports/koru-eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ reports, summary: { best: best.persona, worst: worst.persona, totalCost } }, null, 2));
  console.log(`\n📄 Reporte completo guardado en: ${reportPath}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
