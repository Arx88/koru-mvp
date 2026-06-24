import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoneySummaryCard } from "./MoneySummaryCard";

describe("MoneySummaryCard", () => {
  it("renders the simple emerald card with amount and recommendation split into two lines", () => {
    render(
      <MoneySummaryCard
        block={{
          type: "money_summary",
          total: 45,
          currency: "$",
          recommendation:
            "¡Vas muy bien! Puedes permitirte esa cena planeada para hoy.",
        }}
      />,
    );

    expect(screen.getByText("Gastado hoy")).toBeInTheDocument();
    expect(screen.getByText("45 $")).toBeInTheDocument();
    expect(screen.getByText("¡Vas muy bien!")).toBeInTheDocument();
    expect(
      screen.getByText("Puedes permitirte esa cena planeada para hoy."),
    ).toBeInTheDocument();
  });

  it("uses summaryItems label when total is absent", () => {
    render(
      <MoneySummaryCard
        block={{
          type: "money_summary",
          summaryItems: [{ label: "Presupuesto", value: "100 €" }],
        }}
      />,
    );

    expect(screen.getByText("Presupuesto")).toBeInTheDocument();
    expect(screen.getByText("100 €")).toBeInTheDocument();
  });

  it("renders with only recommendation when no punctuation to split", () => {
    render(
      <MoneySummaryCard
        block={{
          type: "money_summary",
          total: 1234.56,
          currency: "USD",
          recommendation: "Todo en orden",
        }}
      />,
    );

    expect(screen.getByText("1234.56 USD")).toBeInTheDocument();
    expect(screen.getByText("Todo en orden")).toBeInTheDocument();
  });

  it("has correct data-ui-block attribute", () => {
    const { container } = render(
      <MoneySummaryCard
        block={{
          type: "money_summary",
          total: 10,
        }}
      />,
    );

    expect(
      container.querySelector('[data-ui-block="money_summary"]'),
    ).toBeInTheDocument();
  });
});
