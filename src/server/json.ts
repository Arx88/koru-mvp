/**
 * JSON parsing helpers for LLM outputs.
 * Kept separate from koruBackend.ts so they can be unit-tested and reused.
 */

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function cleanText(value: unknown, fallback = ""): string {
  return asString(value)?.replace(/\s+/g, " ").trim() ?? fallback;
}

export function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(raw || "{}"));
  } catch {
    return {};
  }
}

export function extractJsonBlock(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (c === "\\") {
      escapeNext = true;
      continue;
    }
    if (c === '"' && !inString) {
      inString = true;
      continue;
    }
    if (c === '"' && inString) {
      inString = false;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text;
}

export function safeJsonObjectFromContent(raw: string): Record<string, unknown> {
  const direct = safeJsonParse(raw);
  if (direct.reply !== undefined || direct.uiBlocks !== undefined) return direct;
  const extracted = safeJsonParse(extractJsonBlock(raw));
  if (extracted.reply !== undefined || extracted.uiBlocks !== undefined) return extracted;
  const reply = extractStringField(raw, "reply");
  const mascotState = extractStringField(raw, "mascotState") || extractStringField(raw, "mascot_state");
  if (reply && reply.length > 3) {
    return { reply, mascotState: mascotState || "idle", uiBlocks: [] };
  }
  return {};
}

export function extractStringField(raw: string, field: string): string | undefined {
  const idx = raw.toLowerCase().indexOf(`"${field.toLowerCase()}"`);
  if (idx === -1) return undefined;
  let start = raw.indexOf('"', idx + field.length + 2);
  if (start === -1) return undefined;
  start++;
  let i = start;
  let escaped = false;
  while (i < raw.length) {
    const c = raw[i];
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      i++;
      continue;
    }
    if (c === '"') break;
    i++;
  }
  return raw.slice(start, i);
}

export function cleanReplyText(value: unknown): string {
  return cleanText(value)
    .replace(/\*?\s*uiBlock\s*:\s*[a-z_]+\s*\*?/gi, "")
    .replace(/\buiBlocks?\b\s*[:=]\s*\[[\s\S]*$/i, "")
    .replace(/\b(Hola|Gracias|Perfecto|Listo)(?=[A-ZÁÉÍÓÚÑ])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}
