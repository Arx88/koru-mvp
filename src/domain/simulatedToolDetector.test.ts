import { describe, expect, it } from "vitest";
import { detectSimulatedToolCall } from "./simulatedToolDetector";

describe("detectSimulatedToolCall", () => {
  it("detecta formato ```json con query (caso real del log: mundial)", () => {
    // Patrón real visto en logs/koru-turns.jsonl
    const content = '¡Hola! Déjame buscar qué pasó hoy en el mundial... 🎙️ ```json {"query": "mundial 2026 resultados hoy 22 junio", "recency": "1d"} ``` ```json {"reply":"..."} ```';
    const call = detectSimulatedToolCall(content);
    expect(call).not.toBeNull();
    expect(call!.name).toBe("web_search");
    expect(call!.arguments.query).toBe("mundial 2026 resultados hoy 22 junio");
  });

  it("detecta formato <|tool_call|>call:NAME{...} (caso real del log: Boca)", () => {
    const content = '<|tool_call|>call:google_search{mode:"world",query:"Boca Juniors partido hoy"}<|tool_call|>';
    // google_search no es tool válida → debe devolver null (no ejecutamos tools desconocidas)
    const call = detectSimulatedToolCall(content);
    expect(call).toBeNull();
  });

  it("detecta formato <|tool_call|> con tool VÁLIDA", () => {
    const content = '<|tool_call|>call:web_search{mode:"world",query:"Boca Juniors partido hoy 21 junio 2026"}<|tool_call|>';
    const call = detectSimulatedToolCall(content);
    expect(call).not.toBeNull();
    expect(call!.name).toBe("web_search");
    expect(call!.arguments.query).toContain("Boca Juniors");
  });

  it("detecta formato ```tool_call NAME {...}``` (Hermes)", () => {
    const content = '```tool_call web_search {"query": "precio del dolar hoy"} ```';
    const call = detectSimulatedToolCall(content);
    expect(call).not.toBeNull();
    expect(call!.name).toBe("web_search");
  });

  it("detecta tool de weather por campo city", () => {
    const content = 'Voy a chequear el clima. ```json {"city": "Buenos Aires"} ```';
    const call = detectSimulatedToolCall(content);
    expect(call).not.toBeNull();
    expect(call!.name).toBe("weather");
    expect(call!.arguments.city).toBe("Buenos Aires");
  });

  it("detecta shopping_compare por budget + query", () => {
    const content = '```json {"query": "auriculares bluetooth", "budget": "50000"} ```';
    const call = detectSimulatedToolCall(content);
    expect(call).not.toBeNull();
    expect(call!.name).toBe("shopping_compare");
  });

  it("RECHAZA tools desconocidas (seguridad)", () => {
    const content = '<|tool_call|>call:delete_database{"confirm":true}<|tool_call|>';
    const call = detectSimulatedToolCall(content);
    expect(call).toBeNull();
  });

  it("RECHAZA JSON fence sin campos de tool", () => {
    const content = '```json {"reply": "hola", "mascotState": "idle"} ```';
    const call = detectSimulatedToolCall(content);
    expect(call).toBeNull();
  });

  it("devuelve null para prosa normal sin tool-call", () => {
    const content = "¡Buenos días! ¿Cómo te puedo ayudar hoy?";
    const call = detectSimulatedToolCall(content);
    expect(call).toBeNull();
  });

  it("devuelve null para contenido vacío o muy corto", () => {
    expect(detectSimulatedToolCall("")).toBeNull();
    expect(detectSimulatedToolCall("ok")).toBeNull();
  });

  it("es agnóstico al tema: detecta web_search sin importar el contenido de query", () => {
    // No hay palabras clave de deportes/finanzas/etc. La detección es por FORMA (campo query).
    const content = '```json {"query": "zzz tema inventado xyz"} ```';
    const call = detectSimulatedToolCall(content);
    expect(call).not.toBeNull();
    expect(call!.name).toBe("web_search");
  });
});
