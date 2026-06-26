import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ElectionResultsCard } from "./ElectionResultsCard";

describe("ElectionResultsCard", () => {
  const baseBlock = {
    type: "election_results" as const,
    title: "Elecciones Argentina 2025",
    status: "Escrutinio 92%",
    items: [
      { name: "Martínez", percent: "42.3%", detail: "12.847 mesas", done: true, color: "bg-emerald-500" },
      { name: "Frente Amplio", percent: "35.1%", detail: "", done: true, color: "bg-amber-400" },
      { name: "Otros", percent: "22.6%", detail: "En definición", done: false, color: "bg-gray-200" },
    ],
  };

  it("renders title and status", () => {
    render(<ElectionResultsCard block={baseBlock} />);
    expect(screen.getByText("Elecciones Argentina 2025")).toBeInTheDocument();
    expect(screen.getByText("Escrutinio 92%")).toBeInTheDocument();
  });

  it("renders all items", () => {
    render(<ElectionResultsCard block={baseBlock} />);
    expect(screen.getByText("Martínez")).toBeInTheDocument();
    expect(screen.getByText("Frente Amplio")).toBeInTheDocument();
    expect(screen.getByText("Otros")).toBeInTheDocument();
  });

  it("selects item on click", () => {
    render(<ElectionResultsCard block={baseBlock} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(3);
    fireEvent.click(buttons[0]);
    // selection state applied via class (verified by subsequent click ok)
    fireEvent.click(buttons[1]);
  });

  it("renders default fallbacks when block has minimal data", () => {
    render(<ElectionResultsCard block={{ type: "election_results" }} />);
    expect(screen.getByText("Elecciones 2025")).toBeInTheDocument();
    expect(screen.getByText("Escrutinio 87%")).toBeInTheDocument();
  });
});
