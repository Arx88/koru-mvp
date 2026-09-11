/**
 * 🔴 BUG CRÍTICO EN VIVO (2026-09-10): Koru mostraba el JSON interno crudo al
 * usuario: {"reply": "Hoy lunes tenés gimnasio a las 7:30 AM...", "mascotState":
 * "happy"}. Causa: el LLM devolvía el JSON con truncado/coma colgante →
 * JSON.parse fallaba → el path de "texto plano" usaba TODO el JSON como reply.
 *
 * Fixes a testear:
 *  1. cleanReplyText / extractReplyFromJsonish (server) — recupera el reply.
 *  2. sanitizeReplyText (client) — red de seguridad en el render.
 *  3. mentionsWeatherIntent / weatherToolCallsToInject — el clima que el LLM
 *     no llamaba ("¿Qué tengo hoy? También dime cómo está el clima").
 *  4. sanitizeBriefGreeting — el "Buen día, Camila" con nombre inventado.
 */
import { describe, expect, it } from "vitest";
import { cleanReplyText, extractReplyFromJsonish } from "./pipeline/finalizePayload";
import { sanitizeReplyText } from "../domain/turn";
import { mentionsWeatherIntent, resolveWeatherCity, weatherToolCallsToInject } from "./koruBackend";
import { sanitizeBriefGreeting } from "../ui/adapters";

describe("extractReplyFromJsonish / cleanReplyText — leak de JSON crudo", () => {
  it("extrae el reply de un JSON válido entregado como texto", () => {
    const raw = '{"reply": "Hoy lunes tenés gimnasio a las 7:30 AM antes de trabajar.", "mascotState": "happy"}';
    expect(cleanReplyText(raw)).toBe("Hoy lunes tenés gimnasio a las 7:30 AM antes de trabajar.");
  });

  it("extrae el reply de un JSON TRUNCADO (el caso exacto del bug en vivo)", () => {
    const raw = '{"reply": "Hoy lunes tenés gimnasio a las 7:30 AM antes de trabajar. ", "mascotState": "happy"';
    expect(cleanReplyText(raw)).toBe("Hoy lunes tenés gimnasio a las 7:30 AM antes de trabajar.");
  });

  it("extrae el reply de un JSON con coma colgante", () => {
    const raw = '{"reply": "Te dejé el clima en la tarjeta.", "mascotState": "idle",}';
    expect(cleanReplyText(raw)).toBe("Te dejé el clima en la tarjeta.");
  });

  it("texto natural NO se toca (no es JSON)", () => {
    expect(cleanReplyText("¡Hola! ¿Cómo venís con el día?")).toBe("¡Hola! ¿Cómo venís con el día?");
  });

  it("preserva saltos de línea para el render de markdown (listas)", () => {
    const out = cleanReplyText("Te armo el plan:\n- Gimnasio 7:30\n- Trabajo 9:00");
    expect(out).toContain("Gimnasio 7:30\n- Trabajo");
    expect(out).not.toMatch(/Gimnasio 7:30 -/);
  });

  it("extrae escapes \\n y comillas internas del reply", () => {
    const raw = '{"reply": "Linea 1\\nLinea 2 con \\"comillas\\""}';
    expect(extractReplyFromJsonish(raw)).toBe('Linea 1\nLinea 2 con "comillas"');
  });

  it("JSON sin campo reply → null (no rompe texto plano)", () => {
    expect(extractReplyFromJsonish("hola, todo bien?")).toBeNull();
  });
});

describe("sanitizeReplyText — red de seguridad del cliente", () => {
  it("el caso exacto del usuario: JSON crudo → texto limpio", () => {
    expect(sanitizeReplyText('{"reply": "Hoy lunes tenés gimnasio a las 7:30 AM antes de trabajar. ", "mascotState": "happy"}'))
      .toBe("Hoy lunes tenés gimnasio a las 7:30 AM antes de trabajar.");
  });

  it("texto normal pasa intacto", () => {
    expect(sanitizeReplyText("Madrid está a 27° y despejado.")).toBe("Madrid está a 27° y despejado.");
  });

  it("JSON truncado también se recupera en el cliente", () => {
    expect(sanitizeReplyText('{"reply": "parcial", "mascotState')).toBe("parcial");
  });
});

describe("mentionsWeatherIntent / weatherToolCallsToInject — clima en multi-intent", () => {
  it("detecta el mensaje EXACTO del usuario", () => {
    expect(mentionsWeatherIntent("¿Qué tengo hoy? También dime cómo está el clima, así sé si ir caminando al gimnasio.")).toBe(true);
  });

  it("variantes: lluvia, paraguas, amanecer, 'qué tiempo hace'", () => {
    expect(mentionsWeatherIntent("va a llover mañana?")).toBe(true);
    expect(mentionsWeatherIntent("necesito paraguas hoy?")).toBe(true);
    expect(mentionsWeatherIntent("a que hora amanece?")).toBe(true);
    expect(mentionsWeatherIntent("qué tiempo hace en Madrid?")).toBe(true);
  });

  it("no dispara para texto sin clima (agenda, gastos)", () => {
    expect(mentionsWeatherIntent("¿Qué tengo hoy en la agenda?")).toBe(false);
    expect(mentionsWeatherIntent("anota 1500 de café")).toBe(false);
  });

  it("inyecta weather con la ciudad del cache cuando el LLM no la llamó", () => {
    const state = { weatherCache: { city: "Madrid" } };
    const inject = weatherToolCallsToInject(
      "¿Qué tengo hoy? También dime cómo está el clima",
      ["query_personal_context"],
      state,
    );
    expect(inject).toHaveLength(1);
    expect(inject[0].function.name).toBe("weather");
    expect(JSON.parse(inject[0].function.arguments).city).toBe("Madrid");
  });

  it("NO inyecta si ya hay weather (el LLM la llamó)", () => {
    expect(weatherToolCallsToInject("cómo está el clima", ["weather"], { weatherCache: { city: "Madrid" } })).toHaveLength(0);
  });

  it("NO inyecta sin ciudad conocida — el LLM debe pedir la ciudad", () => {
    expect(weatherToolCallsToInject("cómo está el clima", [], {})).toHaveLength(0);
  });

  it("resuelve ciudad: cache → perfil homeCity → perfil location → moneda", () => {
    expect(resolveWeatherCity({ weatherCache: { city: "Valencia" } })).toBe("Valencia");
    expect(resolveWeatherCity({ userProfile: { homeCity: "Sevilla" } })).toBe("Sevilla");
    expect(resolveWeatherCity({ userProfile: { location: "Bilbao" } })).toBe("Bilbao");
    expect(resolveWeatherCity({ userProfile: { currency: "EUR" } })).toBe("Madrid");
    expect(resolveWeatherCity({ userProfile: { currency: "ARS" } })).toBe("Buenos Aires");
    expect(resolveWeatherCity({})).toBeNull();
  });
});

describe("sanitizeBriefGreeting — fin del 'Buen día, Camila'", () => {
  it("nombre inventado + nombre real conocido → reemplaza por el real", () => {
    expect(sanitizeBriefGreeting("¡Buen día, Camila!", "Facundo")).toBe("¡Buen día, Facundo!");
  });

  it("nombre correcto → intacto", () => {
    expect(sanitizeBriefGreeting("Buenos días, Facundo!", "Facundo")).toBe("Buenos días, Facundo!");
  });

  it("sin nombre real → quita el nombre inventado", () => {
    expect(sanitizeBriefGreeting("¡Buen día, Camila!", undefined)).toBe("¡Buen día");
  });

  it("saludo sin nombre → intacto", () => {
    expect(sanitizeBriefGreeting("Buen martes", "Facundo")).toBe("Buen martes");
  });

  it("no confunde palabras comunes con nombres", () => {
    expect(sanitizeBriefGreeting("Buen día, empecemos con todo", "Facundo")).toBe("Buen día, empecemos con todo");
  });
});

describe("stripReasoning — CoT de nemotron-3.5-lightning-30b-a3b", () => {
  // Texto REAL devuelto por la API de NVIDIA cuando NO se manda
  // `chat_template_kwargs: { thinking: false }`. Su frase inicial es
  // "Here's a thinking process:", que los patrones viejos no cubrían
  // (buscaban "The user is asking", "I need to", etc.).
  // Ojo: este fixture tiene a propósito UN solo indicador viejo (ninguno de los
  // patrones originales: "I need to", "Let me", "The user", etc.). Así el test
  // prueba de verdad el patrón nuevo, y no pasa por casualidad con la regla de
  // "2+ indicadores" que ya existía.
  const COT_SIMPLE = `Here's a thinking process:

1.  **Analyze User Input:**
   - User says: "deci hola en una palabra"

2.  **Determine Response:**
   - A greeting is requested.
   - Respond with "Hola".`;

  it("CoT conversacional, sin JSON: se descarta por completo", () => {
    expect(cleanReplyText(COT_SIMPLE)).toBe("");
  });

  it("no filtra el preámbulo de razonamiento al usuario", () => {
    const out = cleanReplyText(COT_SIMPLE);
    expect(out).not.toContain("thinking process");
    expect(out).not.toContain("Analyze User Input");
    expect(out).not.toContain("Determine Response");
  });

  it("CoT con un JSON de ejemplo embebido: el razonamiento previo no pasa", () => {
    const withJson = `Here's a thinking process:

1.  **Analyze User Input:**
   - The requested format is {"reply":"...","mascotState":"idle"}
   - I need to fill the reply field with something appropriate.`;
    const out = cleanReplyText(withJson);
    expect(out).not.toContain("thinking process");
    expect(out).not.toContain("Analyze User Input");
  });

  it("una respuesta legítima no se toca", () => {
    expect(cleanReplyText("¡Hola! ¿Cómo va todo?")).toBe("¡Hola! ¿Cómo va todo?");
  });
});
