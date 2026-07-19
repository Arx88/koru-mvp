/**
 * Detector de tool-calls simuladas en texto.
 *
 * Algunos modelos NO usan la API nativa de tools. En cambio "simulan" la llamada
 * escribiéndola en el content con formatos predecibles:
 *   - Bloques ```json {"query":"..."} ``` (fences de código con JSON)
 *   - Bloques ```tool_call web_search {"query":"..."} ``` (formato Hermes-like)
 *   - Sintaxis <|tool_call|>call:NAME{...}<|tool_call|> (modelos de razonamiento)
 *   - call:NAME({...}) suelto en el texto
 *
 * Esto NO es un parche para un modelo específico. Es una capa de COMPATIBILIDAD
 * estándar: los formatos cubiertos son los que usan las familias de modelos sin
 * tool-use nativo (Hermes, R1, Qwen3 sin tools, etc.). Detectarlos y ejecutar
 * la tool manualmente hace que el flujo funcione igual sin importar el modelo.
 *
 * Agnóstico al modelo y al tema: detecta FORMA de tool-call, no vocabulario.
 */

export type SimulatedToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  /** Formato en que se detectó (para telemetría/debug). */
  format: "json_fence" | "tool_call_fence" | "pipe_call" | "call_prefix";
};

/**
 * Lista de nombres de tools válidos que aceptamos ejecutar desde una simulación.
 * Si el modelo simula una tool que no está acá, se ignora (seguridad).
 */
const VALID_TOOL_NAMES = new Set([
  "web_search",
  "shopping_compare",
  "weather",
  "route_traffic",
  "plan_day",
  "query_personal_context",
  "restaurant_deep_search",
  "crypto_price",
  "stock_quote",
  "match_schedule",
  "match_live",
  "nutrition_calc",
  "trending_twitter",
  "exchange_history",
  // 🔴 FIX P1: tools que existían pero no estaban reconocidas
  "recipe_find",
  "recipe_by_ingredients",
  "food_info",
  "wine_pairing",
  "movie_info",
  "book_info",
  "wikipedia_lookup",
  "dictionary_define",
  "news_topic",
  "news_urgent",
  "person_info",
  "flight_search",
  "hotel_search",
  "route_plan",
  "summarize_url",
  "translate",
  "math_calc",
  "unit_convert",
  "currency_convert",
  "team_follow",
  "league_standings",
  "player_stats",
]);

/**
 * Intenta parsear un objeto de argumentos desde un string JSON.
 * Devuelve null si no es JSON válido o no es un objeto.
 *
 * Es tolerante con JSON informal que algunos modelos emiten: claves sin comillas
 * ({mode:"world"} en vez de {"mode":"world"}), comillas simples, etc.
 */
function tryParseArgs(jsonStr: string): Record<string, unknown> | null {
  const trimmed = jsonStr.trim();
  if (!trimmed.startsWith("{")) return null;
  // Intento 1: JSON estricto.
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // seguir a intento tolerante
  }
  // Intento 2: citar claves sin comillas. {mode:"world"} → {"mode":"world"}.
  try {
    const quoted = trimmed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    const parsed = JSON.parse(quoted);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extrae el primer bloque entre fences ```...``` del contenido.
 * Soporta ```json, ```tool_call, o ``` sin lenguaje.
 */
function extractFenceContent(content: string): { lang: string; body: string } | null {
  // ```lang\nbody```  o  ```\nbody```
  const match = content.match(/```([a-zA-Z_+-]*)\s*\n?([\s\S]*?)```/);
  if (!match) return null;
  return { lang: (match[1] || "").toLowerCase(), body: match[2].trim() };
}

/**
 * Detecta tool-calls simuladas en el content de la respuesta del modelo.
 * Devuelve la primera que encuentre con un nombre de tool válido, o null.
 *
 * El orden de los chequeos importa: vamos de los formatos más específicos a los
 * más genéricos para evitar falsos positivos.
 */
export function detectSimulatedToolCall(content: string): SimulatedToolCall | null {
  if (!content || content.length < 5) return null;

  // 0. JSON directo plano — múltiples formatos que el LLM puede emitir:
  //    - {"name":"tool","parameters":{...}}     (formato OpenAI-like)
  //    - {"name":"tool","arguments":{...}}      (formato OpenAI tool_call)
  //    - {"tool":"match_live","arguments":{...}} (formato Nemotron cuando no usa tools nativas)
  //    - {"tool_name":"X","args":{...}}         (variante snake_case)
  //    - {"function":"X","parameters":{...}}    (variante function)
  //    - {"call":"X","arguments":{...}}         (variante call)
  //    🔴 KORU 3.0 — Esto es CRÍTICO: Nemotron-3-Ultra cuando el prompt incluye
  //    tools pero el modelo decide "escribir" la tool call como texto en vez
  //    de usar el campo tool_calls nativo. El detector anterior solo reconocía
  //    "name"+"parameters"; agregamos todos los aliases comunes.
  try {
    const directJson = JSON.parse(content.trim());
    if (directJson && typeof directJson === "object" && !Array.isArray(directJson)) {
      // Buscar el nombre de la tool en cualquier clave común
      const toolName = directJson.name || directJson.tool || directJson.tool_name || directJson.function || directJson.call;
      if (typeof toolName === "string" && VALID_TOOL_NAMES.has(toolName.toLowerCase())) {
        const params = directJson.parameters || directJson.arguments || directJson.args || directJson.argumentos || directJson.payload;
        // Si no hay sub-objeto de parámetros, usar todo el objeto menos las claves que identifican la tool
        const finalParams = (typeof params === "object" && params !== null && !Array.isArray(params))
          ? params
          : Object.fromEntries(Object.entries(directJson).filter(([k]) => !["name", "tool", "tool_name", "function", "call"].includes(k)));
        if (typeof finalParams === "object" && finalParams !== null && !Array.isArray(finalParams)) {
          return { name: toolName.toLowerCase(), arguments: finalParams, format: "json_fence" };
        }
      }
      // 🔴 KIMI v8 — Caso adicional: el LLM devuelve {"tool_calls":[{"function":{"name":"X","arguments":{...}}}]}
      // (formato OpenAI crudo dentro del content). Lo respetamos igual.
      if (Array.isArray(directJson.tool_calls) && directJson.tool_calls.length > 0) {
        const first = directJson.tool_calls[0];
        const fn = first?.function || first;
        const fnName = fn?.name || first?.name;
        if (typeof fnName === "string" && VALID_TOOL_NAMES.has(fnName.toLowerCase())) {
          const fnArgs = fn?.arguments || fn?.parameters || first?.arguments || {};
          // arguments puede venir como string JSON o como objeto
          let parsedArgs = fnArgs;
          if (typeof fnArgs === "string") {
            try { parsedArgs = JSON.parse(fnArgs); } catch { parsedArgs = {}; }
          }
          if (typeof parsedArgs === "object" && parsedArgs !== null && !Array.isArray(parsedArgs)) {
            return { name: fnName.toLowerCase(), arguments: parsedArgs, format: "json_fence" };
          }
        }
      }

      // 🔴 KORU 3.0 — Caso: el LLM devuelve {"toolCalls":[{"name":"X","args":{...}}], "reply":"", ...}
      // Nemotron a veces emite este formato en el content en vez de usar tool_calls nativas.
      // Es distinto de tool_calls (camelCase) — usa "toolCalls" y "args" (no "arguments").
      if (Array.isArray(directJson.toolCalls) && directJson.toolCalls.length > 0) {
        const first = directJson.toolCalls[0];
        const fnName = first?.name || first?.tool || first?.function;
        if (typeof fnName === "string" && VALID_TOOL_NAMES.has(fnName.toLowerCase())) {
          const fnArgs = first?.args || first?.arguments || first?.parameters || {};
          let parsedArgs = fnArgs;
          if (typeof fnArgs === "string") {
            try { parsedArgs = JSON.parse(fnArgs); } catch { parsedArgs = {}; }
          }
          if (typeof parsedArgs === "object" && parsedArgs !== null && !Array.isArray(parsedArgs)) {
            return { name: fnName.toLowerCase(), arguments: parsedArgs, format: "json_fence" };
          }
        }
      }
    }
  } catch { /* no es JSON directo */ }

  // 1. Bloque ```tool_call NAME {json}```  (formato Hermes-like explícito)
  const toolCallFence = content.match(/```tool_call\s+([a-z_]+)\s*(\{[\s\S]*?\})\s*```/i);
  if (toolCallFence) {
    const name = toolCallFence[1].toLowerCase();
    const args = tryParseArgs(toolCallFence[2]);
    if (VALID_TOOL_NAMES.has(name) && args) {
      return { name, arguments: args, format: "tool_call_fence" };
    }
  }

  // 2. Bloque <|tool_call|>call:NAME{json}<|tool_call|>  (modelos de razonamiento)
  const pipeCall = content.match(/<\|tool_call\|>\s*call:([a-z_]+)\s*(\{[\s\S]*?\})\s*(?:<\|tool_call\|>|$)/i);
  if (pipeCall) {
    const name = pipeCall[1].toLowerCase();
    const args = tryParseArgs(pipeCall[2]);
    if (VALID_TOOL_NAMES.has(name) && args) {
      return { name, arguments: args, format: "pipe_call" };
    }
  }

  // 3. Bloque ```json {...} ``` donde el JSON tiene un campo típico de tool
  //    (query, city, topic, focus). Esto captura el caso más común visto en logs:
  //    el modelo escribe ```json {"query":"mundial 2026..."} ``` en vez de llamar web_search.
  const fence = extractFenceContent(content);
  if (fence && (fence.lang === "json" || fence.lang === "")) {
    const args = tryParseArgs(fence.body);
    if (args) {
      // Inferir la tool por la forma de los argumentos (no por palabras del usuario).
      const hasQuery = "query" in args;
      const hasCity = "city" in args;
      const hasTopic = "topic" in args;
      const hasFocus = "focus" in args;
      const hasBudget = "budget" in args;
      const hasLocation = "location" in args;
      if (hasLocation && hasQuery) {
        return { name: "restaurant_deep_search", arguments: args, format: "json_fence" };
      }
      if (hasBudget && hasQuery) {
        return { name: "shopping_compare", arguments: args, format: "json_fence" };
      }
      if (hasQuery) {
        return { name: "web_search", arguments: args, format: "json_fence" };
      }
      if (hasCity) {
        return { name: "weather", arguments: args, format: "json_fence" };
      }
      if (hasTopic) {
        return { name: "query_personal_context", arguments: args, format: "json_fence" };
      }
      if (hasFocus) {
        return { name: "plan_day", arguments: args, format: "json_fence" };
      }
      if (hasLocation) {
        return { name: "restaurant_deep_search", arguments: args, format: "json_fence" };
      }
    }
  }

  // 4. call:NAME({...}) suelto en el texto (sin fences)
  const callPrefix = content.match(/\bcall:([a-z_]+)\s*\((\{[\s\S]*?\})\)/i);
  if (callPrefix) {
    const name = callPrefix[1].toLowerCase();
    const args = tryParseArgs(callPrefix[2]);
    if (VALID_TOOL_NAMES.has(name) && args) {
      return { name, arguments: args, format: "call_prefix" };
    }
  }

  // 5. 🔴 KORU 3.0 — Lenguaje natural "Let me use the X tool" / "I should use X"
  // Nemotron-3-Ultra a veces ignora `chat_template_kwargs: { thinking: false }` y
  // emite texto de razonamiento en `content` en vez de usar tool_calls nativo.
  // Patrones comunes:
  //   "I should use the match_schedule tool to..."
  //   "Let me use the match_schedule tool."
  //   "I'll use match_schedule to find..."
  //   "Voy a usar match_schedule para..."
  //   "Debería usar match_schedule."
  // Extraemos el nombre de la tool y los argumentos del texto del usuario
  // (que se pasa como segundo argumento).
  const NL_PATTERNS = [
    /(?:i\s+(?:should|will|'ll|am\s+going\s+to|need\s+to|have\s+to)\s+(?:use|call|invoke|run))\s+(?:the\s+)?([a-z_]+)(?:\s+tool)?/i,
    /(?:let\s+me\s+(?:use|call|invoke|run))\s+(?:the\s+)?([a-z_]+)(?:\s+tool)?/i,
    /(?:i'?m\s+going\s+to\s+(?:use|call))\s+(?:the\s+)?([a-z_]+)(?:\s+tool)?/i,
    /(?:voy\s+a\s+(?:usar|llamar|invocar))\s+(?:la\s+|el\s+)?(?:tool\s+|herramienta\s+)?([a-z_]+)/i,
    /(?:deber[ií]a\s+(?:usar|llamar))\s+(?:la\s+|el\s+)?(?:tool\s+|herramienta\s+)?([a-z_]+)/i,
    /(?:use\s+the\s+|call\s+the\s+|invoke\s+the\s+)([a-z_]+)\s+tool/i,
  ];
  for (const pattern of NL_PATTERNS) {
    const m = content.match(pattern);
    if (m) {
      const name = m[1].toLowerCase().replace(/[^a-z_]/g, "");
      if (VALID_TOOL_NAMES.has(name)) {
        // Sin argumentos explícitos — devolver args vacío. El executor usa
        // __userInput como fallback y la tool hace su propio cleanup.
        return { name, arguments: {}, format: "call_prefix" };
      }
    }
  }

  return null;
}

/**
 * 🔴 KORU 3.0 — Extrae argumentos de la pregunta del usuario cuando el LLM
 * no los pasó explícitamente (caso: simulated tool call con arguments={}).
 *
 * NO es lexical routing — no decide la tool, solo limpia el input del usuario
 * para que se use como argumento (team, query, coin, city, etc.).
 *
 * Strippa prefijos comunes de pregunta: "cuando juega", "como le fue a",
 * "a q hora juega", "precio del", "info de", etc. Lo que queda es el
 * argumento que la tool necesita.
 *
 * Es agnóstico a acentos (normaliza con NFD) y a typos comunes.
 */
export function extractArgsFromUserInput(toolName: string, userInput: string): Record<string, unknown> {
  // 🔴 KORU 3.0 — Preservar acentos en el argumento capturado.
  // Normalizamos solo para MATCHING del prefijo ("cuando juega", "como le fue a"),
  // pero el argumento capturado (team, coin, city, etc.) se extrae del ORIGINAL
  // para no perder acentos. "españa" → "españa" (no "espana").
  const normalized = userInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const lower = userInput.toLowerCase().trim();

  // Helper: dado un match en `normalized`, extraer el mismo rango del `lower`
  // original (preserva acentos).
  const extractWithAccents = (regex: RegExp): string | null => {
    const m = normalized.match(regex);
    if (!m || !m[1]) return null;
    // Buscar el índice del match en normalized
    const matchStart = m.index ?? 0;
    const capturedStart = matchStart + (m[0].length - m[1].length);
    const capturedEnd = capturedStart + m[1].length;
    // Extraer el mismo rango del `lower` original (preserva acentos)
    return lower.slice(capturedStart, capturedEnd).trim().replace(/[?¿!¡.]+$/g, "").trim();
  };

  // Patrones de prefijo por tool. Cada uno captura el argumento relevante.
  // Si ningún patrón matchea, devolver el input original (sin prefijos genéricos).

  if (toolName === "match_schedule" || toolName === "match_live") {
    // "cuando juega argentina" → "argentina"
    // "como le fue a españa" → "españa"
    // "a q hora juega boca" → "boca"
    // "resultado de river" → "river"
    // "kmo le fue a la scaloneta" → "scaloneta"
    // "buscar partido de liverpool" → "liverpool"
    // "partido de boca" → "boca"
    // Para match_live: preservar "ayer" / "hoy" / "mañana" (la tool lo usa para filtro de fecha)
    // Para match_schedule: strippear "ayer" / "hoy" (no aplica a fixtures futuros)
    const prefixRegex = /(?:cuando\s+juega[n]?\s+(?:los\s+\w+\s+)?|cuand\s+juega\s+|como\s+(?:le\s+fue\s+a|salio|salio\s+)|kmo\s+le\s+fue\s+(?:a\s+|al\s+)?|resultado\s+(?:de\s+|del\s+)|a\s+q\s+hora\s+juega\s+|a\s+que\s+hora\s+juega\s+|proximo\s+partido\s+(?:de\s+|del\s+)|proximos\s+partidos\s+(?:de\s+|del\s+)|fixture\s+(?:de\s+|del\s+)|quien\s+gano\s+|el\s+partido\s+(?:de\s+)?|buscar\s+(?:partido\s+(?:de\s+|del\s+)?)|partido\s+(?:de\s+|del\s+)|juega\s+(?:el\s+|al\s+)?|juegan\s+(?:los\s+\w+\s+)?)(.+)/;
    let captured = extractWithAccents(prefixRegex);
    if (captured && captured.length >= 2) {
      // Para match_schedule, remover "ayer", "hoy", "mañana" del final
      if (toolName === "match_schedule") {
        captured = captured.replace(/\s+(?:ayer|hoy|manana|mañana)$/i, "").trim();
      }
      return toolName === "match_schedule" ? { team: captured } : { query: captured };
    }
  }

  if (toolName === "crypto_price") {
    // "btc a cuanto sta" → "btc"
    // "precio del ether" → "ether"
    // "a cuanto esta el bitcoin" → "bitcoin"
    const m = normalized.match(/(?:precio\s+(?:del\s+|de\s+la\s+|de\s+)?|a\s+cuanto\s+(?:esta|sta)\s+(?:el\s+)?|cotizacion\s+(?:del\s+|de\s+)?|cuanto\s+(?:esta\s+)?(?:el\s+)?)(btc|eth|ether|bitcoin|ethereum|solana|sol|cardano|ada|dogecoin|doge|ripple|xrp|litecoin|ltc|binance|bnb|polkadot|dot|usdt|usdc)/);
    if (m && m[1]) return { coin: m[1] };
    // Si solo menciona un ticker suelto
    const ticker = normalized.match(/\b(btc|eth|ether|bitcoin|ethereum|solana|sol|cardano|ada|dogecoin|doge|ripple|xrp|litecoin|ltc)\b/);
    if (ticker) return { coin: ticker[1] };
  }

  if (toolName === "weather") {
    // "que tiempo hace en madrid" → "madrid"
    const captured = extractWithAccents(/(?:tiempo\s+(?:hace\s+)?en|hace\s+(?:en\s+)?|clima\s+en\s+|temperatura\s+en\s+)(.+)/);
    if (captured) return { city: captured };
  }

  if (toolName === "restaurant_deep_search") {
    // "donde como algo rico" → "" (no city)
    // "donde como sushi en palermo" → "sushi en palermo"
    const captured = extractWithAccents(/(?:donde\s+(?:como|cenar|almorzar|comer)|restaurantes?\s+(?:en|cerca)|parrilla\s+(?:en|cerca)|sushi\s+(?:en|cerca))\s*(.+)/);
    if (captured) return { query: captured };
  }

  if (toolName === "recipe_find") {
    // "receta de pasta" → "pasta"
    const captured = extractWithAccents(/(?:receta\s+(?:de\s+|para\s+)?|como\s+hago\s+|que\s+cocino\s+(?:con\s+)?|algo\s+con\s+)(.+)/);
    if (captured) return { query: captured };
  }

  if (toolName === "movie_info" || toolName === "book_info") {
    // "info de inception" → "inception"
    const captured = extractWithAccents(/(?:info\s+(?:de\s+|del\s+|sobre\s+)|resena\s+(?:de\s+|del\s+)?|sobre\s+(?:la\s+pelicula\s+|el\s+libro\s+)?|quien\s+actua\s+en\s+|quien\s+escribio\s+)(.+)/);
    if (captured) return { title: captured };
  }

  if (toolName === "wikipedia_lookup") {
    // "que es la fotosintesis" → "la fotosintesis"
    const captured = extractWithAccents(/(?:que\s+es\s+(?:un\s+|una\s+|el\s+|la\s+|los\s+|las\s+)?|quien\s+fue\s+|contame\s+sobre\s+|defini\s+)(.+)/);
    if (captured) return { query: captured };
  }

  // Default: devolver el input sin prefijos genéricos
  const generic = lower.replace(/^(hola|buenas|che|hey|koru|por\s+favor|podrias|puedes|decime|dame|quiero\s+saber|necesito\s+saber)\s+/i, "").trim();
  return { query: generic || userInput };
}
