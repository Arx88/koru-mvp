/**
 * 🔴 MICHI CONSCIENTE — prueba de INTEGRACIÓN del flujo completo, en el chat real.
 *
 * Los tests unitarios cubren la señal y las puertas; este cubre el camino que
 * de verdad ve el usuario, con los componentes reales (App → KoruProvider →
 * TalkOverlay) y solo el backend mockeado (mismo patrón que App.test.tsx):
 *
 *   1. "me aburro"      → Michi propone Tic Tac (card con Jugar / Más tarde)
 *   2. "Más tarde"      → queda registrado en el estado persistido
 *   3. "me aburro" otra vez → NO vuelve a proponer (la puerta cierra)
 *   4. "estoy triste"   → propone School con tono suave, no el juego
 *   5. "estoy harto del trabajo" → no propone NADA (control negativo)
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../domain/backendAgentClient", () => ({
  runBackendAgentTurn: vi.fn(async (input: string) => {
    const lower = input.toLowerCase();
    const reply = lower.includes("aburro")
      ? "Uf, esa tarde larga en la que no engancha nada."
      : lower.includes("triste")
        ? "Vaya. Estoy acá."
        : "Eso no se arregla con un juego. ¿Qué te está pesando?";
    return {
      reply,
      uiBlocks: [],
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
  }),
}));

/** Estado tal como quedó en disco (jsdom no tiene IndexedDB → fallback localStorage). */
function persistedState(): {
  michiInvites?: { lastOfferedAt?: string; pausedUntil?: Record<string, string> };
} | null {
  const key = Object.keys(localStorage).find((item) => item.startsWith("michi.mvp.state"));
  return key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
}

async function send(text: string) {
  const user = userEvent.setup();
  const input = await screen.findByPlaceholderText(/habla con michi/i);
  await user.type(input, `${text}{Enter}`);
  return user;
}

beforeEach(() => {
  localStorage.clear();
  // Onboarding resuelto: acá se prueba el chat, no el alta.
  localStorage.setItem("michi.onboarded", "true");
  localStorage.setItem("michi.username", "Alex");
  vi.clearAllMocks();
});

describe("Michi propone actividades desde el chat real", () => {
  it("propone jugar cuando hay aburrimiento, recuerda el \"más tarde\" y no insiste", async () => {
    render(<App />);

    await send("me aburro");

    // 1) La card aparece con las dos salidas.
    const card = await screen.findByRole("group", { name: /te propone tic tac mich/i }, { timeout: 8000 });
    expect(card).toHaveTextContent(/todav[ií]a no jugamos/i);
    expect(screen.getByRole("button", { name: /jugar al tic tac/i })).toBeTruthy();

    // 2) "Más tarde" desarma los botones y deja la constancia.
    await userEvent.setup().click(screen.getByRole("button", { name: /más tarde/i }));
    await waitFor(() => {
      expect(document.querySelector(".koru-invite.is-resolved")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /más tarde/i })).toBeNull();
    expect(document.querySelector(".koru-invite.is-resolved")).toHaveTextContent(/queda para más tarde/i);

    // 3) Y queda REGISTRADO en el estado: sobrevive al reload.
    const paused = persistedState()?.michiInvites?.pausedUntil?.ticTac;
    expect(paused).toBeTruthy();
    expect(Date.parse(paused as string)).toBeGreaterThan(Date.now());

    // 4) Insistir otra vez con "me aburro" no produce una propuesta nueva.
    await send("me aburro");
    await waitFor(() => {
      expect(screen.getAllByText(/esa tarde larga/i).length).toBe(2);
    }, { timeout: 8000 });
    expect(document.querySelectorAll(".koru-invite:not(.is-resolved)").length).toBe(0);
  }, 30000);

  it("con bajón propone algo liviano y NO el juego", async () => {
    render(<App />);

    await send("estoy triste hoy");

    const card = await screen.findByRole("group", { name: /te propone michi school/i }, { timeout: 8000 });
    expect(card.className).toContain("is-gentle");
    expect(card).toHaveTextContent(/algo liviano para la cabeza/i);
    expect(card).toHaveTextContent(/sin apuro/i);
    expect(document.querySelector('[aria-label*="Tic Tac Mich"]')).toBeNull();
  }, 20000);

  it("aceptar abre la pantalla real y retira la propuesta", async () => {
    render(<App />);

    await send("me aburro");
    await screen.findByRole("group", { name: /te propone tic tac mich/i }, { timeout: 8000 });

    await userEvent.setup().click(screen.getByRole("button", { name: /jugar al tic tac/i }));

    // Se abre Tic Tac Mich de verdad (la ruta del dominio "ticTac" es "tictac").
    await screen.findByRole("button", { name: /ajustes del juego/i }, { timeout: 8000 });
    expect(screen.getByRole("button", { name: /pausar partida/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ficha 1, ya jugada|ficha 1$/i })).toBeTruthy();
    // Y la propuesta ya no ofrece nada.
    expect(document.querySelector(".koru-invite")).toBeNull();
  }, 20000);

  it("no propone nada cuando el mensaje es de malestar real", async () => {
    render(<App />);

    await send("estoy harto del trabajo, no me rinde nada");

    await waitFor(() => {
      expect(screen.getAllByText(/no se arregla con un juego/i).length).toBeGreaterThan(0);
    }, { timeout: 8000 });
    expect(document.querySelector(".koru-invite")).toBeNull();
  }, 20000);
});
