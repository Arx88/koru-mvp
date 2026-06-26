import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewScoreCard } from "./ReviewScoreCard";

describe("ReviewScoreCard", () => {
  const baseBlock = {
    type: "review_score" as const,
    items: [
      { emoji: "🎧", score: "9.2", label: "Calidad", color: "emerald" },
      { emoji: "🔋", score: "8.8", label: "Batería", color: "amber" },
    ],
    buttonLabel: "Ver reseñas",
  };

  it("renders scores and button", () => {
    render(<ReviewScoreCard block={baseBlock} />);
    expect(screen.getByText("9.2")).toBeInTheDocument();
    expect(screen.getByText("Calidad")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<ReviewScoreCard block={{ type: "review_score" }} />);
    expect(screen.getByText("9.2")).toBeInTheDocument();
  });
});
