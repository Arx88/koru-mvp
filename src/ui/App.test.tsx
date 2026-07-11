import { render, screen, waitFor } from "@testing-library/react";
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

async function completeOnboarding(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /o escribir/i }));
  await user.type(screen.getByPlaceholderText(/tu nombre/i), "Alex");
  const fields = screen.getAllByRole("textbox");
  await user.type(fields[1], "Trabajo con clientes por la manana");
  await user.type(fields[2], "Me cuesta arrancar con muchas cosas abiertas");
  await user.type(fields[3], "Quiero reducir carga mental");
  const saveButtons = screen.getAllByRole("button", { name: /guardar/i });
  await user.click(saveButtons[0]);
  await user.click(saveButtons[1]);
  await user.click(saveButtons[2]);
  await user.click(screen.getByRole("button", { name: /confirmar y continuar/i }));
  await user.click(screen.getByRole("button", { name: /entrar a mi/i }));
}

describe("Koru MVP UI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows onboarding when first visited", () => {
    render(<App />);

    expect(screen.getByText("Soy Koru")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hablar con koru/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /o escribir/i })).toBeInTheDocument();
  });

  it("completes onboarding and shows home screen", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeOnboarding(user);

    // Home shows "Koru`s Home" + tagline (no time-based greeting in current UI)
    expect(screen.getByText(/Koru`s Home/i)).toBeInTheDocument();
    expect(screen.getByText(/todo lo que koru te preparo para hoy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hablar con koru/i })).toBeInTheDocument();
  });

  it("asks for context first, then renders a real plan when the user gives tasks", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeOnboarding(user);
    await user.click(screen.getByRole("button", { name: /hablar con koru/i }));

    expect(screen.getByRole("heading", { name: "Koru" })).toBeInTheDocument();
    const chat = screen.getByRole("region", { name: /conversacion con koru/i });
    expect(chat).toHaveTextContent(/hola, alex.*cu[eé]ntame c[oó]mo est[aá]s/i);

    const input = screen.getByPlaceholderText(/habla con koru/i);
    await user.type(input, "Tengo muchas cosas en la cabeza y no se por donde empezar{Enter}");

    expect((await screen.findAllByText(/encontrar el primer paso real/i, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    // Unified card: options live behind the CTA "Responder" in the detail screen,
    // not inline. Verificamos que el CTA esté presente en lugar de las opciones.
    expect(chat).toHaveTextContent(/responder/i);
    expect(chat).not.toHaveTextContent(/aplicar plan/i);

    await user.type(input, "Tengo que lanzar Koru, hablar con mi socio, preparar una demo y comparar proveedores{Enter}");

    // Unified card: el plan se renderiza como hero con título "Plan de hoy"
    // + CTA "Ver plan completo". Los 4 ítems viven en la pantalla de detalle
    // detrás del CTA, no inline en el chat.
    await waitFor(() => {
      const planCard = chat.querySelector('[data-ui-block="plan"]');
      expect(planCard).toBeInTheDocument();
      // heroTitleFrom transforma "Plan de hoy" → "DE HOY" en el hero
      expect(planCard).toHaveTextContent(/de hoy|plan de hoy/i);
    }, { timeout: 3000 });
    expect(chat).toHaveTextContent(/ver plan completo/i);
    expect(chat).not.toHaveTextContent(/aplicar plan/i);
  });

  it("shows permissions screen with toggle switches", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeOnboarding(user);

    await user.click(screen.getByRole("button", { name: /permisos/i }));
    expect(screen.getByRole("heading", { name: /permisos/i })).toBeInTheDocument();
    expect(screen.getByText(/Koru no se alimenta de secretos/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /memoria duradera/i })).toBeInTheDocument();
  });

  it("shows memory garden with plants", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeOnboarding(user);

    await user.click(screen.getByRole("button", { name: /memoria/i }));
    expect(screen.getByRole("heading", { name: "Mi jardín" })).toBeInTheDocument();
  });

  it("shows enhancement card and creates commitment on approval", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completeOnboarding(user);
    await user.click(screen.getByRole("button", { name: /hablar con koru/i }));

    const input = screen.getByPlaceholderText(/habla con koru/i);
    await user.type(input, "estoy quemado{Enter}");

    await waitFor(() => expect(screen.getByText(/estoy quemado/i)).toBeInTheDocument(), { timeout: 3000 });

    const cards = await screen.findAllByText(/alarmas para las tomas/i, {}, { timeout: 3000 });
    expect(cards.length).toBeGreaterThan(0);

    const buttons = await screen.findAllByRole("button", {}, { timeout: 3000 });
    const approveButton = buttons.find((b) => b.textContent?.toLowerCase().includes("dejar visible"));
    expect(approveButton).toBeDefined();
    if (!approveButton) throw new Error("Approve button not found");

    await user.click(approveButton);

    await waitFor(() => {
      const remaining = screen.queryAllByRole("button").filter((b) => b.textContent?.toLowerCase().includes("dejar visible"));
      expect(remaining.length).toBe(0);
    }, { timeout: 3000 });
  });
});
