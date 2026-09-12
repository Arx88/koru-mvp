/**
 * Tono de la burbuja de bienvenida (greetingTurn).
 *
 * Queja en vivo 2026-09-12: "las conversaciones se sienten robóticas, no me
 * nombra". El primer mensaje que ve el usuario en una conversación nueva era
 * "Hola, X. Cuéntame cómo estás." — tuteo formal, cero voseo, cero Michi.
 * Guardian: la bienvenida debe usar voseo rioplatense y el nombre del usuario.
 */
import { describe, expect, it } from "vitest";
import { greetingTurn } from "./adapters";

describe("greetingTurn (tono de bienvenida)", () => {
  it("usa voseo rioplatense y el nombre del usuario", () => {
    const t = greetingTurn("Arx");
    expect(t.text).toBe("¡Hola, Arx! ¿Cómo andás? Contame.");
    expect(t.role).toBe("koru");
    expect(t.status).toBe("done");
  });

  it("sin nombre no rompe y sigue siendo voseo", () => {
    const t = greetingTurn();
    expect(t.text).toBe("¡Hola! ¿Cómo andás? Contame.");
  });

  it("mascota feliz al saludar (no idle)", () => {
    expect(greetingTurn("Arx").mascotState).toBe("happy");
  });

  it("no regresa al tuteo formal de asistente", () => {
    const t = greetingTurn("Arx");
    expect(t.text).not.toMatch(/Cu[eé]ntame|puedo ayudarte|asistente/i);
  });
});
