import { describe, expect, it } from "vitest";
import {
  isConversationalTurn,
  needsExternalTool,
  type KoruPerception,
} from "./pipeline";

describe("isConversationalTurn", () => {
  it("detecta saludos puros", () => {
    expect(isConversationalTurn("Hola")).toBe(true);
    expect(isConversationalTurn("Buenos días")).toBe(true);
    expect(isConversationalTurn("¿Cómo estás?")).toBe(true);
    expect(isConversationalTurn("Qué tal")).toBe(true);
  });

  it("detecta gracias y despedidas", () => {
    expect(isConversationalTurn("Gracias")).toBe(true);
    expect(isConversationalTurn("Ok")).toBe(true);
    expect(isConversationalTurn("Dale")).toBe(true);
    expect(isConversationalTurn("Adios")).toBe(true);
  });

  it("detecta estados emocionales cortos", () => {
    expect(isConversationalTurn("Me siento bien")).toBe(true);
    expect(isConversationalTurn("Hoy estoy mal")).toBe(true);
  });

  it("rechaza pedidos con acción", () => {
    expect(isConversationalTurn("Guardá este link")).toBe(false);
    expect(isConversationalTurn("Buscame precios")).toBe(false);
    expect(isConversationalTurn("Anotá gasto de 12.50")).toBe(false);
    expect(isConversationalTurn("Qué clima hace en Madrid")).toBe(false);
  });

  it("rechaza pedidos largos", () => {
    expect(isConversationalTurn("Hoy tengo una reunión con Juan")).toBe(false);
  });
});

describe("needsExternalTool", () => {
  const capturePerception: KoruPerception = {
    operation: "capture",
    intent: "guardar link de IA",
    entities: [],
    userGoal: "guardar link",
    unstatedNeeds: [],
    assumptions: [],
    confidence: 0.9,
    isConversational: false,
  };

  const researchPerception: KoruPerception = {
    operation: "research",
    intent: "buscar precios de auriculares",
    entities: [],
    userGoal: "comparar precios",
    unstatedNeeds: [],
    assumptions: [],
    confidence: 0.8,
    isConversational: false,
  };

  const executePerception: KoruPerception = {
    operation: "execute",
    intent: "consultar clima en Madrid",
    entities: [],
    userGoal: "saber si llueve",
    unstatedNeeds: [],
    assumptions: [],
    confidence: 0.85,
    isConversational: false,
  };

  it("capture no necesita tool externa", () => {
    expect(needsExternalTool(capturePerception)).toBe(false);
  });

  it("research sí necesita tool externa", () => {
    expect(needsExternalTool(researchPerception)).toBe(true);
  });

  it("execute sí necesita tool externa", () => {
    expect(needsExternalTool(executePerception)).toBe(true);
  });
});
