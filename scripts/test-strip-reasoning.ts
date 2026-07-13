/**
 * Test local de stripReasoning — verifica que los patrones de thinking del LLM
 * se strippen correctamente antes de hacer deploy.
 *
 * Ejecutar: npx tsx scripts/test-strip-reasoning.ts
 */

// Simular la función stripReasoning tal como está en koruBackend.ts
function stripReasoning(text: string): string {
  if (!text) return "";
  let out = text;
  out = out
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<reasoning>/gi, "")
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, "")
    .replace(/<reflection>[\s\S]*$/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/<\/?reasoning>/gi, "");
  const outputMatch = out.match(/<output>([\s\S]*?)<\/output>/i);
  if (outputMatch) {
    out = outputMatch[1];
  }
  const jsonStart = out.search(/\{\s*["']reply["']\s*:/);
  if (jsonStart > 0) {
    out = out.slice(jsonStart);
  }
  const hasJsonReply = /\{\s*["']reply["']\s*:/.test(out);
  if (hasJsonReply) {
    return out;
  }
  const thinkingStartPatterns = [
    /^(the user|the user is|the user wants|the user is asking|i should|i need to|let me|let's think|i'll|i will|i am going to|first,?\s*i|now i|the question|looking at|analyzing|to answer this|based on the|so,?\s*i|this is a|this is an|let's consider|step by step|i have to|i must|i'm going to|the request|the input|the message|i want to|i can|i could|i'm thinking|okay,?\s*(so|i|let|the)|alright,?\s*(so|i|let|the))\b/i,
  ];
  const trimmed = out.trim();
  if (trimmed.length > 20 && thinkingStartPatterns.some(re => re.test(trimmed))) {
    return "";
  }
  const thinkingIndicators = (out.match(/\b(i need to|let me|i should|i will|i'll|i am going to|i'm going to|i have to|i must|the user|i want to|i can|step by step|let's think|i think|i believe|first i|then i|next i|finally i)\b/gi) || []).length;
  if (thinkingIndicators >= 2 && trimmed.length > 30) {
    return "";
  }
  return out;
}

type TestCase = {
  name: string;
  input: string;
  shouldBeEmpty: boolean;
};

const testCases: TestCase[] = [
  // BUG REALES reportados por el usuario
  {
    name: "Bug 1: thinking corto de Argentina ayer",
    input: "The user is asking about Argentina's match yesterday. I need to use match_live tool to check the result. Let me call it with query 'Argentina ayer'.",
    shouldBeEmpty: true,
  },
  {
    name: "Bug 1: thinking largo de Argentina today",
    input: "The user is asking about Argentina's football match result today. This is a football/soccer result query, so I should use the match_live tool, not web_search. The user wants to know how Argentina played today. Let me use match_live with query 'Argentina hoy' or 'Argentina today'.",
    shouldBeEmpty: true,
  },
  // Variantes de thinking que podrían aparecer
  {
    name: "Thinking: 'I should use...'",
    input: "I should use the weather tool to check the temperature in Madrid. Let me call it now.",
    shouldBeEmpty: true,
  },
  {
    name: "Thinking: 'Let me think...'",
    input: "Let me think about this. The user wants a recipe for carbonara. I'll use recipe_find.",
    shouldBeEmpty: true,
  },
  {
    name: "Thinking: 'Step by step...'",
    input: "Step by step: 1) identify the intent, 2) call the tool, 3) format the response.",
    shouldBeEmpty: true,
  },
  {
    name: "Thinking con tags <think>",
    input: "<think>The user is asking about the weather. I should call weather tool.</think>En Madrid hace 29°C ahora.",
    shouldBeEmpty: false, // debería devolver solo "En Madrid hace 29°C ahora."
  },
  {
    name: "Thinking + JSON reply",
    input: "The user is asking about the weather. {\"reply\":\"En Madrid hace 29°C\",\"mascotState\":\"thinking\"}",
    shouldBeEmpty: false, // debería devolver solo el JSON
  },
  // Respuestas válidas que NO deben ser strippadas
  {
    name: "Valid: greeting",
    input: "¡Hola Juan! ¿Cómo va todo?",
    shouldBeEmpty: false,
  },
  {
    name: "Valid: weather report",
    input: "En Madrid hace 29°C ahora, con maximas de 32 y minimas de 21. Viento a 15 km/h y 0% de lluvia. Dia para salir liviano.",
    shouldBeEmpty: false,
  },
  {
    name: "Valid: short confirmation",
    input: "Listo, guardado en gastos.",
    shouldBeEmpty: false,
  },
  {
    name: "Valid: match result",
    input: "Argentina le ganó 2-1 a Bélgica ayer, cuartos del Mundial. Se adelantaron y aguantaron. Ahora les toca Francia en semis.",
    shouldBeEmpty: false,
  },
  {
    name: "Valid: recipe intro",
    input: "Acá tenés la receta de carbonara clásica. Es la versión romana tradicional, sin nata ni cebolla. Mirá los ingredientes abajo.",
    shouldBeEmpty: false,
  },
  {
    name: "Valid: starts with 'I' but not thinking",
    input: "Imaginate que es como un Spotify pero gratis. Tiene playlists, recomendaciones y todo.",
    shouldBeEmpty: false,
  },
  {
    name: "Valid: starts with 'Let's' but not thinking",
    input: "¡Let's go! Argentina ganó 3-0. Qué partido de Messi, dos asistencias y un gol.",
    shouldBeEmpty: false,
  },
];

let passed = 0;
let failed = 0;

console.log("=== Test stripReasoning ===\n");
for (const tc of testCases) {
  const result = stripReasoning(tc.input);
  const isEmpty = result.trim() === "";
  const ok = tc.shouldBeEmpty ? isEmpty : !isEmpty;

  if (ok) {
    passed++;
    console.log(`✓ ${tc.name}`);
    if (!tc.shouldBeEmpty && result !== tc.input) {
      console.log(`  → "${result.slice(0, 80)}${result.length > 80 ? "..." : ""}"`);
    }
  } else {
    failed++;
    console.log(`✗ ${tc.name}`);
    console.log(`  Input:  "${tc.input.slice(0, 100)}..."`);
    console.log(`  Output: "${result.slice(0, 100)}..."`);
    console.log(`  Expected: ${tc.shouldBeEmpty ? "EMPTY" : "NON-EMPTY"}`);
  }
}

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
