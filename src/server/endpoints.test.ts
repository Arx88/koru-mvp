/**
 * Endpoints tests — POST /api/koru/ai-assist, POST /api/koru/morning-brief,
 * GET /api/integrations/google-calendar/callback.
 *
 * Estrategia: mockeamos las dependencias externas (LLM via callProvider /
 * inferProviderFromModel, OAuth via exchangeCodeForToken) y llamamos
 * directamente al handler `koruRequestHandler` exportado por server/index.ts
 * con mock req/res. No levantamos un server real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type http from "node:http";

// ── Mocks (hoisted por vitest antes de cualquier import) ─────────────────
// Path relativo al test: ./koruBackend → src/server/koruBackend.ts.
// El server lo importa como ../src/server/koruBackend.ts (mismo absolute path).
vi.mock("./koruBackend", () => ({
  callProvider: vi.fn(),
  inferProviderFromModel: vi.fn(() => "nvidia" as const),
  runKoruBackendTurn: vi.fn(),
}));

// Path relativo al test: ../tools/calendar/googleCalendar.
// El server lo importa como ../src/tools/calendar/googleCalendar.ts.
vi.mock("../tools/calendar/googleCalendar", () => ({
  exchangeCodeForToken: vi.fn(),
}));

import { callProvider, inferProviderFromModel } from "./koruBackend";
import { exchangeCodeForToken } from "../tools/calendar/googleCalendar";
import { koruRequestHandler } from "../../server/index.ts";

// ── Tipos para mock req/res ──────────────────────────────────────────────
type MockRes = {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
  ended: boolean;
  writeHead: (status: number, headers?: Record<string, string | string[]>) => void;
  end: (data?: string | Buffer) => void;
};

type MockReq = {
  url: string;
  method: string;
  bodyChunks: Buffer[];
  [Symbol.asyncIterator](): AsyncIterator<Buffer>;
};

function makeReq(method: string, url: string, body?: unknown): MockReq {
  const bodyStr = body != null ? JSON.stringify(body) : "";
  const chunks = bodyStr ? [Buffer.from(bodyStr)] : [];
  return {
    url,
    method,
    bodyChunks: chunks,
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: "",
    ended: false,
    writeHead(status, headers) {
      res.statusCode = status;
      if (headers) res.headers = { ...res.headers, ...headers };
    },
    end(data) {
      res.ended = true;
      if (typeof data === "string") res.body = data;
      else if (Buffer.isBuffer(data)) res.body = data.toString("utf8");
    },
  };
  return res;
}

function jsonBody(res: MockRes): any {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

// ── Cast helper: el handler espera http.IncomingMessage/ServerResponse ──
function call(req: MockReq, res: MockRes): Promise<void> {
  return koruRequestHandler(req as unknown as http.IncomingMessage, res as unknown as http.ServerResponse);
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/koru/ai-assist
// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/koru/ai-assist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (inferProviderFromModel as ReturnType<typeof vi.fn>).mockReturnValue("nvidia");
  });

  it("returns suggestions array for gasto+Café when LLM responds valid JSON", async () => {
    (callProvider as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: {
        content: JSON.stringify({
          suggestions: [
            { field: "collection", label: "Colección", value: "Gastos" },
            { field: "currency", label: "Moneda", value: "ARS" },
            { field: "category", label: "Categoría", value: "Comida" },
          ],
        }),
      },
    });

    const req = makeReq("POST", "/api/koru/ai-assist", { template: "gasto", title: "Café" });
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(200);
    const body = jsonBody(res);
    expect(body).toBeTruthy();
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions[0]).toMatchObject({ field: expect.any(String), value: expect.any(String) });
    // callProvider fue invocado con messages que mencionan "gasto" y "Café"
    expect(callProvider).toHaveBeenCalled();
    const args = (callProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = args[1] as Array<{ role: string; content: string }>;
    const joined = messages.map((m) => m.content).join(" ");
    expect(joined).toContain("gasto");
    expect(joined).toContain("Café");
  });

  it("still returns suggestions (empty) when title is empty", async () => {
    // El endpoint valida que template y title sean no-vacíos; con title vacío
    // devuelve 400 + { error, suggestions: [] }. El contrato de la UI depende
    // de que siempre exista el campo `suggestions` (aunque sea vacío).
    const req = makeReq("POST", "/api/koru/ai-assist", { template: "gasto", title: "" });
    const res = makeRes();
    await call(req, res);

    // 400 porque falta title, pero la shape incluye suggestions.
    expect([400, 200]).toContain(res.statusCode);
    const body = jsonBody(res);
    expect(body).toBeTruthy();
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it("returns empty suggestions (not error 500) when LLM fails", async () => {
    (callProvider as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM timeout"));

    const req = makeReq("POST", "/api/koru/ai-assist", { template: "gasto", title: "Café" });
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(200);
    const body = jsonBody(res);
    expect(body).toBeTruthy();
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// /api/koru/morning-brief
// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/koru/morning-brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (inferProviderFromModel as ReturnType<typeof vi.fn>).mockReturnValue("nvidia");
    // Fake timers a las 09:00 local para que el endpoint considere "morning".
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 9, 0, 0) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns brief with greeting, items, reflection when state has events+commitments", async () => {
    (callProvider as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: {
        content: JSON.stringify({
          greeting: "¡Buenos días, Ana!",
          items: [
            { icon: "event", label: "Reunión", value: "10:00 Sync" },
            { icon: "check_circle", label: "Pendiente", value: "Enviar reporte" },
            { icon: "wb_sunny", label: "Clima", value: "18°" },
          ],
          reflection: "Arrancá con la reunión y dejá el reporte para la tarde.",
        }),
      },
    });

    const state = {
      userName: "Ana",
      lastBriefDate: "2026-06-14",
      calendarEvents: [
        { id: "ev1", title: "Sync", startsAt: "2026-06-15T10:00:00.000Z" },
      ],
      commitments: [
        { id: "c1", title: "Enviar reporte", status: "open", dueHint: "hoy" },
      ],
      entries: [],
      memories: [],
    };

    const req = makeReq("POST", "/api/koru/morning-brief", { state });
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(200);
    const body = jsonBody(res);
    expect(body).toBeTruthy();
    expect(body.shouldShow).toBe(true);
    expect(body.brief).toBeTruthy();
    expect(typeof body.brief.greeting).toBe("string");
    expect(body.brief.greeting.length).toBeGreaterThan(0);
    expect(Array.isArray(body.brief.items)).toBe(true);
    expect(body.brief.items.length).toBeGreaterThan(0);
    // Cada item debe tener icon/label/value (string).
    for (const it of body.brief.items) {
      expect(typeof it.icon).toBe("string");
      expect(typeof it.label).toBe("string");
      expect(typeof it.value).toBe("string");
    }
    expect(typeof body.brief.reflection).toBe("string");
  });

  it("returns fallback brief with static greeting when LLM fails", async () => {
    (callProvider as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM down"));

    const state = {
      userName: "Ana",
      lastBriefDate: "2026-06-14",
      calendarEvents: [],
      commitments: [],
      entries: [],
      memories: [],
    };

    const req = makeReq("POST", "/api/koru/morning-brief", { state });
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(200);
    const body = jsonBody(res);
    expect(body).toBeTruthy();
    expect(body.shouldShow).toBe(true);
    expect(body.brief).toBeTruthy();
    // Fallback greeting es `¡Buenos días, ${userName}!`.
    expect(body.brief.greeting).toContain("Buenos días");
    expect(body.brief.items).toBeInstanceOf(Array);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// /api/integrations/google-calendar/callback
// ═══════════════════════════════════════════════════════════════════════════
describe("GET /api/integrations/google-calendar/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTML with window.close() when code is valid", async () => {
    (exchangeCodeForToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      access_token: "access-123",
      refresh_token: "refresh-456",
    });

    const req = makeReq("GET", "/api/integrations/google-calendar/callback?code=valid-oauth-code");
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("window.close()");
    // Contiene el flag "Google Calendar conectado" como mensaje de éxito.
    expect(res.body).toMatch(/conectado/i);

    expect(exchangeCodeForToken).toHaveBeenCalledWith("valid-oauth-code");
  });

  it("returns error HTML when code is missing", async () => {
    const req = makeReq("GET", "/api/integrations/google-calendar/callback");
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("window.close()");
    // Mensaje menciona el parámetro faltante.
    expect(res.body).toMatch(/code/i);

    // No debe intentar intercambiar el code.
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("returns error HTML when error param is present", async () => {
    const req = makeReq("GET", "/api/integrations/google-calendar/callback?error=access_denied");
    const res = makeRes();
    await call(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("window.close()");
    // Mensaje menciona el error recibido.
    expect(res.body).toContain("access_denied");

    // No debe intentar intercambiar el code.
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });
});
