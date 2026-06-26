import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransportCompareCard } from "./TransportCompareCard";

describe("TransportCompareCard", () => {
  const baseBlock = {
    type: "transport_compare" as const,
    items: [
      { mode: "Auto", time: "18 min", icon: "directions_car", active: false },
      { mode: "Transporte", time: "42 min", icon: "directions_bus", active: true },
    ],
  };

  it("renders items", () => {
    render(<TransportCompareCard block={baseBlock} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<TransportCompareCard block={{ type: "transport_compare" }} />);
    expect(screen.getByText("Caminando")).toBeInTheDocument();
  });
});
