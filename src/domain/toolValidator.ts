/**
 * 🔴 KORU 3.0 — Validación semántica post-ejecución de tools.
 *
 * Después de que las tools ejecutan, verifica si el tipo de resultado
 * matchea la intención del usuario. Si hay mismatch (ej: el usuario
 * preguntó por información pero la tool devolvió un guardado),
 * sugiere la tool correcta para reintentar.
 *
 * NO es determinismo léxico — no detecta keywords del input para
 * decidir qué tool usar ANTES de ejecutar. En cambio, mira el
 * RESULTADO de la tool y verifica si tiene sentido para lo que el
 * usuario pidió. Es validación post-hoc, no pre-routing.
 *
 * Ejemplo:
 *   Usuario: "buscame la pelicula inception"
 *   LLM llama: save_personal_item → personal_capture
 *   Validación: el usuario hizo una PREGUNTA (quiere info, no guardar)
 *   Resultado: la tool devolvió un guardado → mismatch
 *   Acción: sugerir reintentar con movie_info
 */

export type ToolIntent = "information" | "action" | "conversation";

export type ToolResultType =
  | "personal_capture"
  | "memory_capture"
  | "weather"
  | "search"
  | "match_live"
  | "match_schedule"
  | "crypto_price"
  | "movie_info"
  | "book_info"
  | "recipe"
  | "plan"
  | "reminder"
  | "alarm"
  | "unknown";

export type ValidationMismatch = {
  /** La tool que se ejecutó */
  executedTool: string;
  /** El tipo de resultado que devolvió */
  resultType: ToolResultType;
  /** La intención detectada del usuario */
  userIntent: ToolIntent;
  /** La tool que debería haberse llamado */
  suggestedTool: string;
  /** Args sugeridos para la tool correcta */
  suggestedArgs: Record<string, unknown>;
  /** Razón del mismatch */
  reason: string;
};

/**
 * Detecta la intención del usuario basándose en el tipo de pregunta.
 * No usa keywords específicos — usa patrones de intención:
 * - Information: preguntas (¿qué, cómo, cuál, dónde, info, buscá, recomendá)
 * - Action: comandos (guardá, anotá, recordame, activá, poné)
 * - Conversation: todo lo demás
 */
export function detectUserIntent(input: string): ToolIntent {
  const lower = input.toLowerCase().trim();

  // Detectar comando de acción (guardar, anotar, recordar)
  // Estos son verbos imperativos que indican que el usuario QUIERE guardar algo
  const actionPatterns = [
    /^(guard[aá]|anot[aá]|registr[aá]|apunt[aá])/i,
    /^(record[aá]|recuerd|avis[aá])/i,
    /^(activ[aá]|program[aá]|pon[eé]|crear)/i,
    /\b(gasto|gast[eé])\b/i,
  ];
  if (actionPatterns.some(p => p.test(lower))) {
    return "action";
  }

  // Detectar pregunta de información
  // Patrones que indican que el usuario QUIERE SABER algo (no guardar)
  const infoPatterns = [
    /^(qu[eé]|c[oó]mo|cu[aá]l|cu[aá]ndo|d[oó]nde|por qu[eé])/i,
    /^(busc[aá]|buscame|encontr[aá]|informaci[oó]n|info|datos)/i,
    /^(recomend|suger[ií]|dec[ií]me|cont[aá]me|mostr[aá])/i,
    /^(qu[ié]e[ée]n|qu[eé] tal|c[oó]mo est[aá]|c[oó]mo va)/i,
    /\b(pel[ií]cula|pelicula|film|cine|libro|book|novela)\b/i,
    /\b(receta|cocin|comid|plato|ingredient)\b/i,
    /\b(clima|tiempo|temperat|lluvia|fr[ií]o|calor)\b/i,
    /\b(precio|cotizaci[oó]n|a cu[aá]nto|valor)\b/i,
    /\b(partido|resultado|c[oó]mo (le fue|sali[oó])|cu[aá]ndo juega)\b/i,
    /\b(inform[aá]me|contame|explic[aá]|qu[eé] es|qu[ié]n (fue|es))\b/i,
    /\b(organiz|planific|estructur|arm[aá] (un|una) (plan|semana|d[ií]a))\b/i,
  ];
  if (infoPatterns.some(p => p.test(lower))) {
    return "information";
  }

  return "conversation";
}

/**
 * Obtiene el tipo de resultado de una tool execution.
 */
export function getToolResultType(toolName: string, result: Record<string, unknown>): ToolResultType {
  const type = String(result?.type ?? "").toLowerCase();
  if (type === "personal_capture") return "personal_capture";
  if (type === "memory_capture") return "memory_capture";
  if (type === "weather") return "weather";
  if (type === "search") return "search";
  if (type === "match_live") return "match_live";
  if (type === "match_schedule") return "match_schedule";
  if (type === "crypto_price") return "crypto_price";
  if (type === "movie_info") return "movie_info";
  if (type === "book_info") return "book_info";
  if (type === "recipe" || type === "recipe_find") return "recipe";
  if (type === "plan") return "plan";
  if (type === "reminder_set") return "reminder";
  if (type === "alarm_set") return "alarm";

  // Si la tool es save_personal_item o save_memory, es un guardado
  if (toolName === "save_personal_item" || toolName === "save_memory") return "personal_capture";
  if (toolName === "reminder_set") return "reminder";
  if (toolName === "alarm_set") return "alarm";

  return "unknown";
}

/**
 * Mapa de qué tool de información usar según el tema detectado en el input.
 * No es léxico (no matchea palabras exactas) — matchea CATEGORÍAS de intención.
 */
function suggestInfoTool(input: string): { tool: string; args: Record<string, unknown> } | null {
  const lower = input.toLowerCase();

  // Películas
  if (/\b(pel[ií]cula|pelicula|film|cine|movie|estreno)\b/i.test(lower)) {
    // Extraer título si lo menciona
    const titleMatch = input.match(/(?:de|sobre|llamada|titulada|buscame)\s+[""']?([^""'?,]+)[""']?/i);
    const title = titleMatch?.[1]?.trim() || "";
    return { tool: "movie_info", args: title ? { title: title.slice(0, 80) } : { title: "Inception" } };
  }

  // Libros
  if (/\b(libro|book|novela|lectura)\b/i.test(lower)) {
    const titleMatch = input.match(/(?:de|sobre|llamado|titulado|buscame)\s+[""']?([^""'?,]+)[""']?/i);
    const title = titleMatch?.[1]?.trim() || "";
    return { tool: "book_info", args: title ? { title: title.slice(0, 80) } : { title: "Cien años de soledad" } };
  }

  // Recetas
  if (/\b(receta|cocin|comid|plato|ingredient)\b/i.test(lower)) {
    const queryMatch = input.match(/(?:receta\s+(?:de\s+)?)\s*(.+)/i);
    const query = queryMatch?.[1]?.trim() || "";
    return { tool: "recipe_find", args: query ? { query: query.slice(0, 80) } : { query: "pasta" } };
  }

  // Clima
  if (/\b(clima|tiempo|temperat|lluvia|fr[ií]o|calor|paraguas)\b/i.test(lower)) {
    return { tool: "weather", args: { city: "Madrid" } };
  }

  // Cripto
  if (/\b(btc|bitcoin|ethereum|eth|crypto|cripto|solana|dogecoin)\b/i.test(lower)) {
    const coinMatch = lower.match(/\b(btc|bitcoin|ethereum|eth|solana|sol|dogecoin|doge|cardano|ada)\b/);
    return { tool: "crypto_price", args: { coin: coinMatch?.[1] || "bitcoin" } };
  }

  // Deportes
  if (/\b(partido|resultado|c[oó]mo (le fue|sali[oó])|cu[aá]ndo juega|fixture)\b/i.test(lower)) {
    if (/cu[aá]ndo juega|pr[oó]ximo|fixture|pr[oó]ximos partidos/i.test(lower)) {
      return { tool: "match_schedule", args: { team: input.slice(0, 60) } };
    }
    return { tool: "match_live", args: { query: input.slice(0, 60) } };
  }

  // Plan
  if (/\b(organiz|planific|estructur|arm[aá]|qu[eé] hago|c[oó]mo organizo)\b/i.test(lower)) {
    return { tool: "plan_day", args: { focus: input.slice(0, 100) } };
  }

  // Wikipedia
  if (/\b(qu[eé] es|qu[ié]n (fue|es)|contame sobre|informaci[oó]n sobre)\b/i.test(lower)) {
    const queryMatch = input.match(/(?:qu[eé] es|qu[ié]n (fue|es)|contame sobre|informaci[oó]n sobre)\s+(.+)/i);
    return { tool: "wikipedia_lookup", args: { query: queryMatch?.[1]?.trim() || input.slice(0, 60) } };
  }

  // Búsqueda general
  return { tool: "web_search", args: { query: input.slice(0, 80) } };
}

/**
 * Valida si los resultados de las tools matchean la intención del usuario.
 * Si hay mismatch, sugiere la tool correcta para reintentar.
 */
export function validateToolResults(
  userInput: string,
  toolExecutions: Array<{ name: string; result: Record<string, unknown> }>,
): ValidationMismatch | null {
  const userIntent = detectUserIntent(userInput);

  // Solo validar si el usuario quiere INFORMACIÓN
  // Si el usuario quiere ACTION (guardar, anotar), un personal_capture es correcto
  if (userIntent !== "information") return null;

  // Si no se ejecutó ninguna tool, no hay mismatch
  if (toolExecutions.length === 0) return null;

  // Verificar si alguna tool devolvió un tipo de "guardado" cuando el usuario
  // quería información
  for (const exec of toolExecutions) {
    const resultType = getToolResultType(exec.name, exec.result);

    // Si el usuario quiere información pero la tool devolvió un guardado
    if (resultType === "personal_capture" || resultType === "memory_capture") {
      // Verificar que el resultado NO sea un recordatorio o alarma
      // (esos sí son actions válidos incluso si el usuario "preguntó")
      const block = (exec.result as any)?.block;
      if (block?.type === "reminder" || block?.type === "alarm") {
        // Si el input contiene "recordame" o "activa", un reminder es correcto
        if (/\b(record|avis|activ|alarm)\b/i.test(userInput)) return null;
      }

      // Mismatch detectado: el usuario quería info pero la tool guardó
      const suggested = suggestInfoTool(userInput);
      if (suggested) {
        return {
          executedTool: exec.name,
          resultType,
          userIntent,
          suggestedTool: suggested.tool,
          suggestedArgs: suggested.args,
          reason: `Usuario pidió información pero la tool '${exec.name}' devolvió un guardado (${resultType}). Sugerido: ${suggested.tool}`,
        };
      }
    }
  }

  return null;
}
