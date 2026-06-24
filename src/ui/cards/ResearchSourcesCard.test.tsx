import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResearchSourcesCard } from "./ResearchSourcesCard";
import type { UiBlock } from "../../domain/types";

function makeBlock(overrides?: Partial<Extract<UiBlock, { type: "research_sources" }>>): Extract<UiBlock, { type: "research_sources" }> {
  return {
    type: "research_sources",
    summary: "best pasta restaurants in rome",
    sources: [
      { title: "The 10 Best Pasta Places in Rome", domain: "timeout.com", url: "https://timeout.com/rome" },
      { title: "Rome Food Guide", domain: "eater.com", url: "https://eater.com/rome" },
    ],
    ...overrides,
  } as Extract<UiBlock, { type: "research_sources" }>;
}

describe("ResearchSourcesCard", () => {
  it("renders outer card with rounded-3xl p-4 card-shadow", () => {
    render(<ResearchSourcesCard block={makeBlock()} />);
    const inner = document.querySelector('[data-ui-block="research_sources"] > div > div');
    expect(inner).toBeInTheDocument();
    expect(inner).toHaveClass("rounded-3xl", "p-4", "card-shadow");
  });

  it("renders query row with sync icon and summary text", () => {
    render(<ResearchSourcesCard block={makeBlock()} />);
    expect(screen.getByText("best pasta restaurants in rome")).toBeInTheDocument();
  });

  it("renders source items with small icon, title, domain and chevron_right", () => {
    render(<ResearchSourcesCard block={makeBlock()} />);
    expect(screen.getByText("The 10 Best Pasta Places in Rome")).toBeInTheDocument();
    expect(screen.getByText("eater.com")).toBeInTheDocument();
  });

  it("does not render a Top badge", () => {
    render(<ResearchSourcesCard block={makeBlock()} />);
    expect(screen.queryByText("Top")).not.toBeInTheDocument();
  });
});
