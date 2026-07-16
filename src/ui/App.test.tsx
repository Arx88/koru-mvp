import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../domain/backendAgentClient", () => ({
  runBackendAgentTurn: vi.fn(async (input: string) => {
    const lower = input.toLowerCase();
    const base = {
      suggestedActions: [],
      memoryCandidates: [],
      commitments: [],
      records: [],
      toolResults: [],
      stateEvents: [],
      provider: "openrouter" as const,
      model: "test",
      understanding: {
        literalRequest: input,
        userGoal: input,
        unstatedNeeds: [],
        assumptions: [],
        confidence: 0.9,
      },
    };

    if (lower.includes("muchas cosas")) {
      return {
        ...base,
        reply: "Vamos a encontrar el primer paso real. Necesito un poco de contexto.",
        mascotState: "thinking" as const,
        uiBlocks: [{
          type: "clarifying_question" as const,
          question: "Encontrar el primer paso real",
          options: ["Bloque corto", "Energía baja", "Algo urgente de hoy"],
        }],
      };
    }

    if (lower.includes("lanzar koru")) {
      return {
        ...base,
        reply: "Te lo ordeno en pasos concretos para que puedas empezar sin reconstruir todo.",
        mascotState: "planning" as const,
        uiBlocks: [{
          type: "plan" as const,
          title: "Plan de hoy",
          note: "Primer bloque corto, después proveedores.",
          items: [
            { time: "08:00", title: "Lanzar Koru", priority: "Alta" as const, icon: "flag" as const, durationMinutes: 30 },
            { time: "10:00", title: "Hablar con mi socio", priority: "Alta" as const, icon: "message" as const, durationMinutes: 20 },
            { time: "11:30", title: "Preparar una demo", priority: "Media" as const, icon: "calendar" as const, durationMinutes: 45 },
            { time: "16:00", title: "Comparar proveedores", priority: "Media" as const, icon: "book" as const, durationMinutes: 25 },
          ],
        }],
      };
    }

    if (lower.includes("estoy quemado")) {
      return {
        ...base,
        reply: "Entiendo, te veo agotado. ¿Querés que prepare algo para ayudarte?",
        mascotState: "thinking" as const,
        uiBlocks: [],
        suggestedActions: [{
          id: "sugg_1",
          label: "¿Querés que prepare alarmas para las tomas?",
          kind: "approve" as const,
          requiresApproval: true,
          payload: { enhancementType: "health_followup" },
        }],
      };
    }

    return {
      ...base,
      reply: "Estoy aca para seguir.",
      mascotState: "idle" as const,
      uiBlocks: [],
    };
  }),
}));

/**
 * NEW onboarding flow (Sprint 4 redesign):
 * 1. App renders → TalkOverlay with onboarding=true, phase="greeting"
 * 2. Greeting shows "Hola, soy Koru" + quick-action chips
 * 3. User clicks a chip OR types a message → sendMessage → after 3s, phase="waiting_for_name"
 * 4. User types name → onOnboardingComplete called → onboarded=true
 * 5. Press Escape (or click close) → App.tsx setScreen("hoy") → Home screen
 */
async function completeConversationalOnboarding(user: ReturnType<typeof userEvent.setup>) {
  // Wait for greeting to appear
  await waitFor(() => {
    expect(screen.getByText(/hola, soy koru/i)).toBeInTheDocument();
  }, { timeout: 3000 });

  // Type any message to start the conversation (will trigger greeting → waiting_for_name transition)
  const input = screen.getByPlaceholderText(/habla con koru|hablá con koru|pregunta|hablemos/i);
  await user.type(input, "Hola{Enter}");

  // Wait for the "waiting_for_name" phase to kick in (3s setTimeout in TalkOverlay)
  await waitFor(() => {
    expect(screen.getByText(/c[oó]mo te llamo/i)).toBeInTheDocument();
  }, { timeout: 5000 });

  // Now type the name — this triggers onOnboardingComplete
  await user.type(input, "Alex{Enter}");

  // Wait a tick for state to settle
  await new Promise((r) => setTimeout(r, 200));
}

describe("Koru MVP UI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows onboarding greeting when first visited", () => {
    render(<App />);
    // New conversational onboarding shows "Hola, soy Koru 🌿"
    expect(screen.getByText(/hola, soy koru/i)).toBeInTheDocument();
  });

  it("completes conversational onboarding and shows home screen after Escape", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeConversationalOnboarding(user);

    // After onboarding completes, App still shows TalkOverlay (screen="chat").
    // Press Escape to trigger onClose → setScreen("hoy") → Home screen.
    await user.keyboard("{Escape}");

    // Home dashboard shows the Koru brand + a time-of-day greeting with the
    // onboarded name (e.g. "Buenos días, Alex"). The greeting appears in both
    // the sticky header and the hero, so we assert at least one match.
    await waitFor(() => {
      expect(screen.getByText(/^Koru$/)).toBeInTheDocument();
      expect(
        screen.getAllByText(/buenos días, alex|buenas tardes, alex|buenas noches, alex/i)
          .length,
      ).toBeGreaterThan(0);
    }, { timeout: 3000 });
  }, 15000);

  it("asks for context first, then renders a real plan when the user gives tasks", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeConversationalOnboarding(user);

    // Type the "many things" message — mock returns a clarifying question
    const input = screen.getByPlaceholderText(/habla con koru|hablá con koru|pregunta|hablemos/i);
    await user.type(input, "Tengo muchas cosas en la cabeza y no se por donde empezar{Enter}");

    expect((await screen.findAllByText(/encontrar el primer paso real/i, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    const chat = screen.getByRole("region", { name: /conversacion con koru/i });
    expect(chat).toHaveTextContent(/responder/i);

    await user.type(input, "Tengo que lanzar Koru, hablar con mi socio, preparar una demo y comparar proveedores{Enter}");

    // The plan block should appear
    await waitFor(() => {
      const planCard = chat.querySelector('[data-ui-block="plan"]');
      expect(planCard).toBeInTheDocument();
      expect(planCard).toHaveTextContent(/de hoy|plan de hoy/i);
    }, { timeout: 3000 });
    expect(chat).toHaveTextContent(/ver plan completo/i);
  }, 20000);

  it("renders enhancement reply when user types 'estoy quemado'", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeConversationalOnboarding(user);

    const input = screen.getByPlaceholderText(/habla con koru|hablá con koru|pregunta|hablemos/i);
    await user.type(input, "estoy quemado{Enter}");

    // The mock returns a reply about preparing something to help — wait for that text
    await waitFor(() => {
      const chat = screen.getByRole("region", { name: /conversacion con koru/i });
      expect(chat).toHaveTextContent(/querés que prepare|estoy aca para seguir/i);
    }, { timeout: 5000 });
  }, 20000);
});
