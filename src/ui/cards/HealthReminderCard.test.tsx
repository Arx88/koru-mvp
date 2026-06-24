import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthReminderCard } from "./HealthReminderCard";

describe("HealthReminderCard", () => {
  it("renders horizontal card with icon, title, reminder and action button", () => {
    const { container } = render(
      <HealthReminderCard
        block={{
          type: "health_reminder",
          title: "Vitamina C y D",
          reminder: "Con la comida",
          actionLabel: "Tomar",
        }}
      />,
    );

    expect(screen.getByText("Vitamina C y D")).toBeInTheDocument();
    expect(screen.getByText("Con la comida")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tomar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("medication")).toBeInTheDocument();
    expect(
      container.querySelector('[data-ui-block="health_reminder"]'),
    ).toBeInTheDocument();
  });

  it("uses default icon and title when optional fields are missing", () => {
    render(
      <HealthReminderCard
        block={{
          type: "health_reminder",
          reminder: "Beber agua",
        }}
      />,
    );

    expect(
      screen.getByText("Recordatorio de salud"),
    ).toBeInTheDocument();
    expect(screen.getByText("Beber agua")).toBeInTheDocument();
    expect(screen.getByText("medication")).toBeInTheDocument();
  });

  it("does not render button when actionLabel is absent", () => {
    const { container } = render(
      <HealthReminderCard
        block={{
          type: "health_reminder",
          title: "Descanso",
          reminder: "Estirar",
        }}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Structure should be horizontal flex
    const card = container.querySelector('[data-ui-block="health_reminder"]');
    expect(card).toHaveClass("flex", "items-center", "justify-between");
  });
});
