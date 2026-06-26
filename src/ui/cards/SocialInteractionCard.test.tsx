import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialInteractionCard } from "./SocialInteractionCard";

describe("SocialInteractionCard", () => {
  it("renders birthday card with name, date, age, remaining", () => {
    render(
      <SocialInteractionCard
        block={{
          type: "social_interaction",
          name: "Mamá",
          date: "12 jul",
          age: "62 años",
          remaining: "Faltan 3 días",
        }}
      />,
    );
    expect(screen.getByText("Cumpleaños de Mamá")).toBeInTheDocument();
    expect(screen.getByText("12 jul · 62 años · Faltan 3 días")).toBeInTheDocument();
  });

  it("renders default gifts when none provided", () => {
    render(<SocialInteractionCard block={{ type: "social_interaction", name: "Ana" }} />);
    expect(screen.getByText("Ramo Primaveral")).toBeInTheDocument();
    expect(screen.getByText("Caja regalo")).toBeInTheDocument();
    expect(screen.getAllByText("Enviar").length).toBeGreaterThanOrEqual(2);
  });

  it("renders custom gifts when provided", () => {
    render(
      <SocialInteractionCard
        block={{
          type: "social_interaction",
          name: "Aniversario",
          gifts: [
            { emoji: "🍷", title: "Vino Reserva", detail: "Llega en 30 min" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Vino Reserva")).toBeInTheDocument();
    expect(screen.getByText("Llega en 30 min")).toBeInTheDocument();
    expect(screen.queryByText("Ramo Primaveral")).not.toBeInTheDocument();
  });
});
