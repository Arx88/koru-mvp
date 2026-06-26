import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchTimelineCard } from "./MatchTimelineCard";

describe("MatchTimelineCard", () => {
  const baseBlock = {
    type: "match_timeline" as const,
    items: [
      { minute: "34'", text: "Boca 1-0", sub: "Benedetto", active: true },
      { minute: "59'", text: "River 1-1", sub: "", active: false },
      { minute: "78'", text: "Boca 2-1", sub: "Benedetto · Ahora", now: true },
    ],
  };

  it("renders timeline events", () => {
    render(<MatchTimelineCard block={baseBlock} />);
    expect(screen.getByText("Boca 1-0")).toBeInTheDocument();
    expect(screen.getByText("River 1-1")).toBeInTheDocument();
    expect(screen.getByText(/Benedetto · Ahora/)).toBeInTheDocument();
  });

  it("renders defaults without block data", () => {
    render(<MatchTimelineCard block={{ type: "match_timeline" }} />);
    expect(screen.getByText("Boca 1-0")).toBeInTheDocument();
  });
});
