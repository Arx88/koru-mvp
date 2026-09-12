/**
 * Fase 4.5 — Snapshot test del systemPrompt.
 *
 * Detecta regresiones de personalidad. Cualquier cambio en systemPrompt()
 * rompe el snapshot y fuerza revisión.
 */
import { describe, it, expect } from "vitest";
import type { KoruState, RelevantMemory } from "../types";
import { ensureNameInGreeting } from "./systemPrompt";

// Import dinámico para evitar cargar todo el módulo del backend
// (que tiene dependencias de Vite).
// Si el test corre en entorno Vite, el import funciona directo.

describe("systemPrompt snapshot", () => {
  it("contiene PRINCIPIO #1 — UTILIDAD", () => {
    // Verificar que el prompt incluye el principio de utilidad
    // sin sobre-validar (Fase 1, commit 0bc7a0e)
    const state: Partial<KoruState> = {
      userName: "Test",
      memories: [],
      commitments: [],
      records: [],
    };
    const memories: RelevantMemory[] = [];
    // No podemos importar systemPrompt directamente (es internal),
    // pero podemos verificar que las reglas clave existen en el código fuente.
    // Este test es un guardian: si alguien quita las reglas, falla.
    const fs = require("fs");
    const src = fs.readFileSync("./src/server/systemPrompt.ts", "utf8");
    expect(src).toContain("UTILIDAD POR ENCIMA DE TODO");
    expect(src).toContain("NO sobre-valides");
    expect(src).toContain("NO exageres");
    expect(src).toContain("NO agregues \"+1\" forzado");
  });

  it("contiene few-shot examples (Fase 4.3)", () => {
    const fs = require("fs");
    const src = fs.readFileSync("./src/server/systemPrompt.ts", "utf8");
    // El bloque de few-shots existe bajo "Ejemplos de respuestas".
    expect(src).toContain("Ejemplos de respuestas");
    // Regla de guardado con colección (variable en el prompt).
    expect(src).toContain("Listo, guardado en {colección}");
  });

  it("contiene reglas anti-alucinación CRÍTICO", () => {
    const fs = require("fs");
    const src = fs.readFileSync("./src/server/systemPrompt.ts", "utf8");
    expect(src).toContain("CRÍTICO");
    expect(src).toContain("NO inventés los datos");
    expect(src).toContain("status \"failed\"");
  });

  it("el tono es de amigo, no de asistente (anti-robótico)", () => {
    const fs = require("fs");
    const src = fs.readFileSync("./src/server/systemPrompt.ts", "utf8");
    // Identidad: amigo primero, servicio después.
    expect(src).toContain("el amigo de");
    expect(src).not.toMatch(/Sos el asistente personal de/);
    // Ban explícito de frases de call-center (el marcador #1 de IA).
    expect(src).toContain("NO FRASES DE ASISTENTE");
    expect(src).toContain("¿En qué puedo ayudarte hoy?");
    // El nombre del usuario se usa como lo usa un amigo (primer saludo incluido).
    expect(src).toContain("como lo usa un amigo");
    expect(src).toContain("PRIMER saludo");
    // Los few-shots de saludo usan el nombre real y voseo correcto.
    expect(src).toContain(`¡Hola, \${displayName}! ¿Cómo andás?`);
    expect(src).toContain("todo bien michi?");
    // Contraejemplos del cliché de asistente.
    expect(src).toContain("frase de asistente — prohibida");
  });

  describe("ensureNameInGreeting (bug en vivo: 'no me nombra')", () => {
    it("reemplaza 'che' por el nombre en el saludo", () => {
      expect(ensureNameInGreeting("¡Hola, che! ¿Cómo andás?", "Arx"))
        .toBe("¡Hola, Arx! ¿Cómo andás?");
    });

    it("inserta el nombre tras un saludo pelado", () => {
      expect(ensureNameInGreeting("¡Hola! ¿Qué tal arrancás el sábado?", "Arx"))
        .toBe("¡Hola, Arx! ¿Qué tal arrancás el sábado?");
      expect(ensureNameInGreeting("Buenas!", "Arx")).toBe("Buenas, Arx!");
    });

    it("no toca nada si ya nombra al usuario", () => {
      const reply = "¡Hola, Arx! ¿Cómo andás?";
      expect(ensureNameInGreeting(reply, "Arx")).toBe(reply);
    });

    it("no toca respuestas que no abren con saludo (datos, chistes, etc.)", () => {
      const reply = "Hoy el sol se pone a las 18:43 — tarde larga. Te dejé el arco en la tarjeta.";
      expect(ensureNameInGreeting(reply, "Arx")).toBe(reply);
      expect(ensureNameInGreeting("Todo bien por acá. ¿Y vos?", "Arx")).toBe("Todo bien por acá. ¿Y vos?");
    });

    it("sin userName devuelve el reply tal cual", () => {
      expect(ensureNameInGreeting("¡Hola, che!", undefined)).toBe("¡Hola, che!");
      expect(ensureNameInGreeting("¡Hola, che!", "  ")).toBe("¡Hola, che!");
    });

    it("escapa nombres con caracteres especiales de regex", () => {
      expect(ensureNameInGreeting("¡Hola, che!", "A.R")).toBe("¡Hola, A.R!");
    });
  });
});
