import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTickerCard } from "./DataTickerCard";

describe("DataTickerCard", () => {
  const baseBlock = {
    type: "data_ticker" as const,
    items: [
      { label: "Votos válidos", value: "28.4M" },
      { label: "Mesas", value: "12.847" },
      { label: "Participación", value: "77%", highlight: true },
    ],
    alert: "Diferencia 7.2 pp",
  };

  it("renders items and alert", () => {
    render(<DataTickerCard block={baseBlock} />);
    expect(screen.getByText("Votos válidos")).toBeInTheDocument();
    expect(screen.getByText("28.4M")).toBeInTheDocument();
    expect(screen.getByText("77%")).toBeInTheDocument();
    expect(screen.getByText("Diferencia 7.2 pp")).toBeInTheDocument();
  });

  it("renders defaults without block data", () => {
    render(<DataTickerCard block={{ type: "data_ticker" }} />);
    expect(screen.getByText("Votos válidos")).toBeInTheDocument();
    expect(screen.getByText("Diferencia 7.2 pp entre 1° y 2°")).toBeInTheDocument();
  });
});
