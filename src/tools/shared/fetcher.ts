/**
 * Fetcher con timeout, retry y User-Agent propio.
 * Todas las tools que llaman APIs externas deben usar este fetcher para
 * garantizar cortesía de red y trazabilidad.
 */

const KORU_USER_AGENT = "KoruLocal/1.0 (+local-first assistant)";

export type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Reintentos ante fallo de red (no ante 4xx/5xx). */
  retries?: number;
};

export type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

export type FetchTextResult = {
  ok: boolean;
  status: number;
  text?: string;
  error?: string;
};

/** fetch con AbortController y reintentos en fallo de red. */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<FetchJsonResult<T>> {
  const { method = "GET", headers = {}, body, timeoutMs = 10_000, retries = 1 } = options;
  const finalHeaders: Record<string, string> = {
    "User-Agent": KORU_USER_AGENT,
    Accept: "application/json",
    ...headers,
  };

  let lastError = "fetch failed";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      clearTimeout(timeout);
      // Detectar HTML (algunas APIs como Reddit sirven HTML para UAs no-navegador).
      const looksHtml = /^\s*(?:<!doctype html|<html|<body)/i.test(text);
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (looksHtml) return { ok: false, status: response.status, error: "El servidor devolvió HTML en vez de JSON (posible bloqueo de bot o cambio de API)." };
        if (response.ok) return { ok: false, status: response.status, error: "Respuesta no es JSON válido" };
        return { ok: false, status: response.status, error: text.slice(0, 200) || `HTTP ${response.status}` };
      }
      if (!response.ok) {
        const errMsg = (data as { error?: string; message?: string })?.error ?? (data as { message?: string })?.message ?? `HTTP ${response.status}`;
        return { ok: false, status: response.status, error: errMsg };
      }
      return { ok: true, status: response.status, data: data as T };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
      // Reintento solo si es error de red o timeout, no si es cancelación deliberada.
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return { ok: false, status: 0, error: lastError };
}

/** fetch de texto plano (HTML/XML), con timeout. */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchTextResult> {
  const { method = "GET", headers = {}, body, timeoutMs = 10_000 } = options;
  const finalHeaders: Record<string, string> = {
    "User-Agent": KORU_USER_AGENT,
    ...headers,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
    const text = await response.text();
    clearTimeout(timeout);
    if (!response.ok) return { ok: false, status: response.status, error: text.slice(0, 300) || `HTTP ${response.status}` };
    return { ok: true, status: response.status, text };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Helper: toma un string y lo recorta a maxLen añadiendo elipsis. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

/** Helper: normaliza un string para matching (lower + sin acentos). */
export function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Helper: dominio de una URL o fallback. */
export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "fuente externa";
  }
}
