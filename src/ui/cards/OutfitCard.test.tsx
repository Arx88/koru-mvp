import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutfitCard } from "./OutfitCard";

describe("OutfitCard", () => {
  const baseBlock = {
    type: "outfit" as const,
    specs: [
      { emoji: "☕", label: "Precio", value: "$89" },
      { emoji: "⚡", label: "Presión", value: "19b" },
    ],
    buttonLabel: "Verward ganador",
  };

  it("renders specs and button", () => {
    render(<OutfitCard block={baseBlock} />);
    expect(screen.getByText("Precio")).toBeInTheDocument();
    expect(screen.getByText("$89")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<OutfitCard block={{ type: "outfit" }} />);
    expect(screen.getByText("Depósito")).toBeInTheDocument();
  });
});
