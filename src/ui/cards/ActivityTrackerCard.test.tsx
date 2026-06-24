import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityTrackerCard } from "./ActivityTrackerCard";

describe("ActivityTrackerCard", () => {
  it("renders circular SVG progress ring with step count", () => {
    render(
      <ActivityTrackerCard
        block={{
          type: "activity_tracker",
          title: "Casi logras tu meta",
          subtitle:
            "Te faltan 1,500 pasos para tu objetivo diario. ¿Una caminata corta después de comer?",
          metrics: [
            {
              icon: "footprints",
              iconColor: "#14b8a6",
              label: "Pasos",
              value: "8.5k",
              progress: 75,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("8.5k")).toBeInTheDocument();
    expect(screen.getByText("Casi logras tu meta")).toBeInTheDocument();
    expect(
      screen.getByText(
        /te faltan 1,500 pasos para tu objetivo diario/i,
      ),
    ).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
    const path = document.querySelectorAll("path")[1];
    expect(path).toHaveAttribute("stroke-dasharray", "75, 100");
  });

  it("uses defaults when title, subtitle and metrics are missing", () => {
    render(
      <ActivityTrackerCard
        block={{
          type: "activity_tracker",
          metrics: [],
        }}
      />,
    );

    expect(screen.getByText("Casi logras tu meta")).toBeInTheDocument();
    expect(
      screen.getByText(/te faltan 1,500 pasos/i),
    ).toBeInTheDocument();
    expect(screen.getByText("8.5k")).toBeInTheDocument();
  });

  it("derives progress from first metric", () => {
    render(
      <ActivityTrackerCard
        block={{
          type: "activity_tracker",
          metrics: [
            {
              icon: "directions_walk",
              iconColor: "#14b8a6",
              label: "Pasos",
              value: "6.2k",
              progress: 60,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("6.2k")).toBeInTheDocument();
    const path = document.querySelectorAll("path")[1];
    expect(path).toHaveAttribute("stroke-dasharray", "60, 100");
  });

  it("wraps in outer flex container with data attribute", () => {
    const { container } = render(
      <ActivityTrackerCard
        block={{
          type: "activity_tracker",
          metrics: [{ icon: "footprints", iconColor: "#14b8a6", label: "Pasos", value: "8.5k", progress: 75 }],
        }}
      />,
    );

    const wrapper = container.querySelector('[data-ui-block="activity_tracker"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("flex", "w-full");
  });
});
