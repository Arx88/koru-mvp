/**
 * Tono de la burbuja de bienvenida (greetingTurn).
 *
 * Queja en vivo 2026-09-12: "las conversaciones se sienten robóticas, no me
 * nombra". Después: "no debe sonar ARGENTINO". Guardian: la bienvenida debe
 * usar español neutro CÁLIDO (tuteo, cero voseo rioplatense) y el nombre del
 * usuario.
 */
import { describe, expect, it } from "vitest";
import { greetingTurn } from "./adapters";

describe("greetingTurn (tono de bienvenida)", () => {
  it("usa español neutro cálido y el nombre del usuario", () => {
    const t = greetingTurn("Arx");
    expect(t.text).toBe("¡Hola, Arx! ¿Cómo estás? ¿Qué me cuentas?");
    expect(t.role).toBe("koru");
    expect(t.status).toBe("done");
  });

  it("sin nombre no rompe y sigue siendo neutro cálido", () => {
    const t = greetingTurn();
    expect(t.text).toBe("¡Hola! ¿Cómo estás? ¿Qué me cuentas?");
  });

  it("mascota feliz al saludar (no idle)", () => {
    expect(greetingTurn("Arx").mascotState).toBe("happy");
  });

  it("no suena a asistente de call-center", () => {
    const t = greetingTurn("Arx");
    expect(t.text).not.toMatch(/puedo ayudarte|asistente|en qué/i);
  });

  it("no regresa al voseo rioplatense (feedback: 'no debe sonar ARGENTINO')", () => {
    const t = greetingTurn("Arx");
    expect(t.text).not.toMatch(/\b(andás|contame|vos\b|che\b)/i);
  });
});
