/**
 * 🔴 FIX PROCESANDO MÚLTIPLE + PROACTIVE DUPLICADO (bug en vivo 2026-09-08).
 *
 * Reproducción real en koru-mvp.onrender.com:
 *  - Mientras el turno streamtea, se veían TRES indicadores a la vez:
 *    "Buscando..." (texto del turno), "Buscando información..." (nota del item)
 *    y "Procesando…" (TypingDots global).
 *  - "Buenos días / Tu brief matutino está listo…" aparecía 2 veces
 *    (scheduler del morning brief + endpoint /api/michi/proactive) y además se
 *    inyectaba en MEDIO de una conversación en proceso.
 *
 * Este archivo testea la lógica pura extraída: lastKoruTurnIsStreaming
 * (cuándo mostrar el TypingDots) y la firma de dedupe del listener proactive.
 */
import { describe, it, expect } from "vitest";
import { lastKoruTurnIsStreaming, type KoruChatTurn } from "./turn";

const t = (over: Partial<KoruChatTurn>): KoruChatTurn => ({
  id: Math.random().toString(36).slice(2),
  role: "koru",
  text: "",
  createdAt: new Date().toISOString(),
  ...over,
});

describe("lastKoruTurnIsStreaming — TypingDots solo antes del primer chunk", () => {
  it("sin turns no hay stream (TypingDots visible)", () => {
    expect(lastKoruTurnIsStreaming([])).toBe(false);
  });

  it("usuario como último turn → sin stream (TypingDots visible mientras espera respuesta)", () => {
    const turns = [t({ role: "user", text: "dame review de airpods" })];
    expect(lastKoruTurnIsStreaming(turns)).toBe(false);
  });

  it("turno de Koru en working → hay stream (TypingDots OCULTO, no duplicar)", () => {
    const turns = [
      t({ role: "user", text: "dame review de airpods" }),
      t({ text: "Buscando \"airpods\"...", status: "working" }),
    ];
    expect(lastKoruTurnIsStreaming(turns)).toBe(true);
  });

  it("turno de Koru done → sin stream (TypingDots oculto porque terminó)", () => {
    const turns = [
      t({ role: "user", text: "hola" }),
      t({ text: "¡Hola! ¿Cómo va todo?", status: "done" }),
    ];
    expect(lastKoruTurnIsStreaming(turns)).toBe(false);
  });

  it("turnos proactivos viejos (done) después de un user working siguen sin stream", () => {
    const turns = [
      t({ text: "Buenos días\nTu brief matutino está listo.", status: "done" }),
      t({ role: "user", text: "que tiempo hace" }),
      t({ text: "Madrid está a 27° y despejado.", status: "working" }),
    ];
    expect(lastKoruTurnIsStreaming(turns)).toBe(true);
  });
});

describe("firma de dedupe del listener koru:proactive (misma lógica que KoruProvider)", () => {
  // Misma función que usa el listener: normaliza y compara contra recientes.
  const signature = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60);

  it("dos textos iguales con distinta forma → misma firma (no se duplica)", () => {
    expect(signature("Buenos días\nTu brief matutino está listo. Tocá para revisar el día."))
      .toBe(signature("buenos días   tu brief matutino está listo. tocá para revisar el día."));
  });

  it("textos distintos → firmas distintas (sí se inyecta)", () => {
    expect(signature("Buenos días, arrancamos?")).not.toBe(signature("Llueve en 20 min, llevá paraguas."));
  });
});
