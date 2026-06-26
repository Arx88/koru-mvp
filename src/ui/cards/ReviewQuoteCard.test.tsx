import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewQuoteCard } from "./ReviewQuoteCard";

describe("ReviewQuoteCard", () => {
  const baseBlock = {
    type: "review_quote" as const,
    sourceName: "TechKoru",
    sourceType: "Review",
    quote: "El rey de la cancelación activa regresa.",
    tags: ["Calidad top", "Premium"],
    buttonLabel: "Leer completo",
  };

  it("renders source, quote and tags", () => {
    render(<ReviewQuoteCard block={baseBlock} />);
    expect(screen.getByText("TechKoru")).toBeInTheDocument();
    expect(screen.getByText(/El rey de la cancelación/)).toBeInTheDocument();
    expect(screen.getByText("Calidad top")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<ReviewQuoteCard block={{ type: "review_quote" }} />);
    expect(screen.getByText("TechKoru")).toBeInTheDocument();
  });
});
