import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewDocumentCard } from "./ReviewDocumentCard";

describe("ReviewDocumentCard", () => {
  const baseBlock = {
    type: "review_document" as const,
    title: "Sony WH-1000XM5",
    body: "Prueba concluyó cancelación top.",
  };

  it("renders title and body", () => {
    render(<ReviewDocumentCard block={baseBlock} />);
    expect(screen.getByText("# Sony WH-1000XM5")).toBeInTheDocument();
    expect(screen.getByText(/Prueba concluyó/)).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<ReviewDocumentCard block={{ type: "review_document" }} />);
    expect(screen.getByText(/Sony/)).toBeInTheDocument();
  });
});
