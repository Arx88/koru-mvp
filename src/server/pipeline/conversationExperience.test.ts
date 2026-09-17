import { describe, expect, it } from "vitest";
import { normalizeFinalPayload } from "./finalizePayload";
import { buildMessages } from "../koruBackend";
import { createInitialState } from "../../domain/store";
import { allowsOptionalSuggestions, polishConversationReply } from "../conversationExperience";
import type { KoruConversationMessage } from "../../domain/types";

const recipe = { type: "recipe", title: "Tortilla", name: "Tortilla", ingredients: [{ ingredient: "huevos" }], steps: [{ step: 1, text: "Batir y cocinar." }] } as const;
const executions = [{ id: "recipe-1", name: "recipe_show", result: { type: "recipe_show", status: "ok", recipes: [{ title: "Tortilla", ingredients: "huevos", steps: "Batir y cocinar." }] } }];

describe("conversation experience through the real finalizer", () => {
  it("does not duplicate an existing card announcement within one reply", () => {
    const result = normalizeFinalPayload({ reply: "Una cena fácil. Te dejé el detalle en la tarjeta.", uiBlocks: [recipe] }, "Una receta", executions);
    expect(result.reply.match(/Te dejé el detalle en la tarjeta/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(result.uiBlocks).toEqual([expect.objectContaining({ type: "recipe", name: "Tortilla" })]);
  });

  it("does not impose the same card announcement across consecutive turns", () => {
    for (const reply of ["Está lista en pocos pasos.", "Esta alternativa aprovecha lo que tienes.", "Sin queso también funciona."]) {
      const result = normalizeFinalPayload({ reply, uiBlocks: [recipe] }, "Otra receta", executions);
      expect(result.reply).toBe(reply);
      expect(result.uiBlocks[0].type).toBe("recipe");
    }
  });

  it("keeps useful task questions, facts and formatting while dropping repeated offers", () => {
    const history: KoruConversationMessage[] = [{ role: "assistant", content: "La compra cuesta 20 €. ¿Quieres que guarde la lista?" }];
    expect(polishConversationReply("Puedes usar arroz.\nSon 15 minutos. ¿Quieres que guarde la lista?", "Otra opción", history)).toBe("Puedes usar arroz.\nSon 15 minutos.");
    expect(polishConversationReply("¿Para cuántas personas cocinas?", "Dame una receta", history)).toBe("¿Para cuántas personas cocinas?");
    expect(polishConversationReply("Cuesta 12.50 €. ¿Hay algo más en lo que pueda ayudarte?", "Precio", [])).toBe("Cuesta 12.50 €.");
  });

  it("honors refusal across turns but permits a new explicit request", () => {
    const history: KoruConversationMessage[] = [{ role: "user", content: "No quiero que me ofrezcas recordatorios." }];
    expect(allowsOptionalSuggestions("Otra variante", history)).toBe(false);
    expect(polishConversationReply("Usa garbanzos. ¿Quieres un recordatorio?", "Otra variante", history)).toBe("Usa garbanzos.");
    expect(allowsOptionalSuggestions("Ahora recuérdame comprar garbanzos", history)).toBe(true);
  });

  it("honors companionship without advice in both prompt and finalizer", () => {
    const input = "Hoy tuve un día horrible. No quiero consejos ni preguntas, solo compañía.";
    const state = createInitialState();
    expect(allowsOptionalSuggestions(input)).toBe(false);
    expect(allowsOptionalSuggestions("Sigo triste", [{ role: "user", content: input }])).toBe(false);
    expect(buildMessages({ input, history: [], state })[0].content).toContain("No añadas ofertas opcionales");
    const result = normalizeFinalPayload({ reply: "Estoy aquí contigo. ¿Quieres estudiar un rato?", suggestedActions: [{ id: "s1", label: "Estudiar", kind: "approve", requiresApproval: true }] }, input, [], undefined, undefined, state, []);
    expect(result.reply).toBe("Estoy aquí contigo.");
    expect(result.suggestedActions).toEqual([]);
  });

  it("does not mistake food preferences for refusal of help", () => {
    expect(allowsOptionalSuggestions("No quiero pescado" )).toBe(true);
    expect(allowsOptionalSuggestions("Otra cena", [{ role: "user", content: "No quiero pescado" }])).toBe(true);
    expect(allowsOptionalSuggestions("Solo quiero una cena sencilla")).toBe(true);
  });

  it("filters optional suggestions using history in the real finalizer without losing recipe cards", () => {
    const state = createInitialState();
    const history: KoruConversationMessage[] = [{ role: "user", content: "Sin recordatorios ni sugerencias." }];
    const result = normalizeFinalPayload({ reply: "Prueba esta tortilla. ¿Quieres un recordatorio?", suggestedActions: [{ id: "s1", label: "Crear recordatorio", kind: "approve", requiresApproval: true }] }, "Otra cena", executions, undefined, undefined, state, history);
    expect(result.reply).toBe("Prueba esta tortilla.");
    expect(result.suggestedActions).toEqual([]);
    expect(result.uiBlocks[0].type).toBe("recipe");
  });

  it("feeds recent questions, constraints and novelty into the real prompt builder", () => {
    const state = createInitialState();
    const history: KoruConversationMessage[] = [
      { role: "user", content: "Cena vegetariana, 20 minutos. Sin recordatorios." },
      { role: "assistant", content: "Puedes hacer pasta. ¿Quieres que guarde la receta?" },
    ];
    const messages = buildMessages({ input: "Otra distinta", history, state });
    expect(messages[0].content).toContain("No añadas ofertas opcionales");
    expect(messages[0].content).toContain("cambia realmente la opción");
    expect(messages[0].content).toContain("¿Quieres que guarde la receta?");
    expect(messages.some(m => m.content.includes("Cena vegetariana, 20 minutos"))).toBe(true);
  });
});
