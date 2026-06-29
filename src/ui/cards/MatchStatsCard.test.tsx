import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchStatsCard } from "./MatchStatsCard";

describe("MatchStatsCard", () => {
  const baseBlock = {
    type: "match_stats" as const,
    stats: [
      { label: "Posesión", home: "62%", away: "38%", width: "62%" },
      { label: "Tiros", home: "14", away: "8", width: "64%" },
    ],
  };

  it("renders stats labels and values", () => {
    render(<MatchStatsCard block={baseBlock} />);
    expect(screen.getByText("Posesión")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
  });

  it("renders defaults without block data", () => {
    render(<MatchStatsCard block={{ type: "match_stats" }} />);
    expect(screen.getByText("Posesión")).toBeInTheDocument();
  });
});
