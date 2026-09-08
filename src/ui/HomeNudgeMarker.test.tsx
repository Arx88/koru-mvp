/**
 * 🔴 FIX (2026-09-10): el marcador interno [proactive_shown] aparecía en el
 * Home ("Koru te sugiere: [proactive_shown] Buenos días"). Los nudges ya
 * inyectados al chat NO deben volver a mostrarse como cards ni exponer el
 * marcador.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeScreen } from "./HomeScreen";
import { createInitialState } from "../domain/store";

vi.mock("./KoruMascot", () => ({ KoruMascot: () => <div data-testid="mascot" /> }));

const noop = () => {};

function stateWithNudges(nudges: Array<{ id: string; title: string; body?: string; reason?: string; priority?: string; createdAt?: string; source?: string; sourceId?: string; dismissed?: boolean }>) {
  const state = createInitialState("test-user");
  return { ...state, nudges: nudges as any };
}

describe("HomeScreen — marcador [proactive_shown] invisible", () => {
  it("los nudges marcados [proactive_shown] NO aparecen en 'Koru te sugiere'", () => {
    const state = stateWithNudges([
      { id: "n1", title: "[proactive_shown] Buenos días", body: "Tu brief matutino está listo.", reason: "morning-brief", priority: "medium", createdAt: new Date().toISOString(), source: "brain", sourceId: "mb" },
      { id: "n2", title: "Tomar agua", body: "Vas 1.2L de 2L.", reason: "hydration", priority: "low", createdAt: new Date().toISOString(), source: "brain", sourceId: "hy" },
    ]);
    render(
      <HomeScreen
        state={state}
        onNavigate={noop}
        onCreate={noop}
        onSearch={noop}
        onTalk={noop}
        onDismissNudge={noop}
      />,
    );
    expect(screen.queryByText(/proactive_shown/i)).toBeNull();
    expect(screen.getByText("Tomar agua")).toBeTruthy();
  });

  it("un nudge normal se muestra con su título limpio", () => {
    const state = stateWithNudges([
      { id: "n3", title: "Deadline de diseño", body: "Vence hoy 18:00.", reason: "deadline", priority: "high", createdAt: new Date().toISOString(), source: "brain", sourceId: "dl" },
    ]);
    render(
      <HomeScreen
        state={state}
        onNavigate={noop}
        onCreate={noop}
        onSearch={noop}
        onTalk={noop}
        onDismissNudge={noop}
      />,
    );
    expect(screen.getByText("Deadline de diseño")).toBeTruthy();
  });
});
