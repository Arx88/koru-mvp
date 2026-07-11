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
  "nutrition_calc",
  "trending_twitter",
  "exchange_history",
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

  // 0. JSON directo plano: {"name":"tool","parameters":{...}}
  try {
    const directJson = JSON.parse(content.trim());
    if (directJson && typeof directJson.name === "string" && VALID_TOOL_NAMES.has(directJson.name.toLowerCase())) {
      const params = directJson.parameters || directJson.arguments || directJson;
      if (typeof params === "object" && params !== null && !Array.isArray(params)) {
        return { name: directJson.name.toLowerCase(), arguments: params, format: "json_fence" };
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

  return null;
}
