import { describe, expect, it } from "vitest";
import {
  computeAbsenceContext,
  formatAbsenceContext,
  tierForDays,
  absenceEventInstructions,
} from "./absence";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

describe("AbsenceEngine — tiers", () => {
  it("clasifica gaps en none/brief/notable/long", () => {
    expect(tierForDays(0)).toBe("none");
    expect(tierForDays(2)).toBe("none");
    expect(tierForDays(3)).toBe("brief");
    expect(tierForDays(6)).toBe("brief");
    expect(tierForDays(7)).toBe("notable");
    expect(tierForDays(29)).toBe("notable");
    expect(tierForDays(30)).toBe("long");
    expect(tierForDays(44)).toBe("long");
  });
});

describe("AbsenceEngine — computeAbsenceContext", () => {
  it("sin fuentes de actividad devuelve ausencia nula", () => {
    const ctx = computeAbsenceContext({});
    expect(ctx.days).toBe(0);
    expect(ctx.tier).toBe("none");
    expect(ctx.lastActiveAt).toBeNull();
    expect(formatAbsenceContext(ctx)).toEqual([]);
  });

  it("computa días desde lastSeen", () => {
    const ctx = computeAbsenceContext({ lastSeenMs: Date.now() - 44 * DAY_MS });
    expect(ctx.days).toBe(44);
    expect(ctx.tier).toBe("long");
  });

  it("toma la fuente más reciente entre lastSeen, último turno y entries", () => {
    // lastSeen viejo (44 días) pero entry reciente (2 días): la ausencia
    // real de conversación es de 2 días, no 44. El usuario abrió la app
    // sin hablar, pero el entry es la fuente durable.
    const ctx = computeAbsenceContext({
      lastSeenMs: Date.now() - 44 * DAY_MS,
      entries: [{ createdAt: daysAgo(2) }],
    });
    expect(ctx.days).toBe(2);
    expect(ctx.tier).toBe("none");
  });

  it("extrae últimos temas del usuario desde el historial", () => {
    const ctx = computeAbsenceContext({
      lastSeenMs: Date.now() - 10 * DAY_MS,
      history: [
        { role: "assistant", content: "¿En qué te ayudo?" },
        { role: "user", content: "me encanta el helado de pistacho" },
        { role: "assistant", content: "Anotado." },
        { role: "user", content: "también estoy aprendiendo guitarra" },
      ],
    });
    expect(ctx.lastTopics).toEqual([
      "también estoy aprendiendo guitarra",
      "me encanta el helado de pistacho",
    ]);
  });

  it("digest: pendientes vencidos DURANTE la ausencia, no antes de irse", () => {
    const ctx = computeAbsenceContext({
      lastSeenMs: Date.now() - 30 * DAY_MS,
      commitments: [
        // Venció mientras no estaba (10 días después de irse) → cuenta.
        { title: "Renovar pasaporte", dueHint: "", dueAt: daysAgo(20), status: "open" },
        // Venció antes de irse → ya era viejo, no es noticia del reencuentro.
        { title: "Viejo pendiente", dueHint: "", dueAt: daysAgo(40), status: "open" },
        // Vence en el futuro → no cuenta.
        { title: "Futuro", dueHint: "", dueAt: daysAgo(-5), status: "open" },
        // Cerrado → no cuenta.
        { title: "Hecho", dueHint: "", dueAt: daysAgo(10), status: "done" },
      ],
    });
    expect(ctx.overdueWhileAway).toEqual([
      { title: "Renovar pasaporte", dueHint: "" },
    ]);
  });
});

describe("AbsenceEngine — formatAbsenceContext (prompt del turno)", () => {
  it("no inyecta nada para ausencias cortas (< 7 días)", () => {
    const ctx = computeAbsenceContext({ lastSeenMs: Date.now() - 3 * DAY_MS });
    expect(formatAbsenceContext(ctx)).toEqual([]);
  });

  it("inyecto el hecho exacto para el reencuentro de 44 días", () => {
    const ctx = computeAbsenceContext({
      lastSeenMs: Date.now() - 44 * DAY_MS,
      history: [{ role: "user", content: "cómo va el proyecto koru" }],
    });
    const lines = formatAbsenceContext(ctx);
    expect(lines.join("\n")).toContain("44 días");
    expect(lines.join("\n")).toContain("cómo va el proyecto koru");
    // Guardas anti-manipulación presentes en el prompt.
    expect(lines.join("\n")).toContain("sin reproche");
  });
});

describe("AbsenceEngine — absenceEventInstructions (mensaje proactivo)", () => {
  it("instrucciones vacías para ausencia corta", () => {
    const ctx = computeAbsenceContext({ lastSeenMs: Date.now() - 3 * DAY_MS });
    expect(absenceEventInstructions(ctx)).toBe("");
  });

  it("instrucciones con días exactos y digest para 44 días", () => {
    const ctx = computeAbsenceContext({
      lastSeenMs: Date.now() - 44 * DAY_MS,
      history: [{ role: "user", content: "estoy armando koru" }],
      commitments: [{ title: "Renovar pasaporte", dueHint: "", dueAt: daysAgo(20), status: "open" }],
    });
    const text = absenceEventInstructions(ctx);
    expect(text).toContain("44 días sin entrar");
    expect(text).toContain("estoy armando koru");
    expect(text).toContain("Renovar pasaporte");
    expect(text).toContain("no entrabas hace 44 días");
  });
});
