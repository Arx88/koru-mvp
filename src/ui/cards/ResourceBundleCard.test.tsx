import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResourceBundleCard } from "./ResourceBundleCard";
import type { UiBlock } from "../../domain/types";

function makeBlock(overrides?: Partial<Extract<UiBlock, { type: "resource_bundle" }>>): Extract<UiBlock, { type: "resource_bundle" }> {
  return {
    type: "resource_bundle",
    files: [
      { name: "report.pdf", kind: "document", mimeType: "application/pdf", sizeLabel: "1.2 MB" },
      { name: "data.csv", kind: "csv", mimeType: "text/csv", sizeLabel: "45 KB" },
    ],
    ...overrides,
  } as Extract<UiBlock, { type: "resource_bundle" }>;
}

describe("ResourceBundleCard", () => {
  it("renders outer card with rounded-3xl p-5 card-shadow", () => {
    render(<ResourceBundleCard block={makeBlock()} />);
    const inner = document.querySelector('[data-ui-block="resource_bundle"] > div > div');
    expect(inner).toBeInTheDocument();
    expect(inner).toHaveClass("rounded-3xl", "p-5", "card-shadow");
  });

  it("renders file rows with icon, name, kind/size and chevron_right", () => {
    render(<ResourceBundleCard block={makeBlock()} />);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("document — 1.2 MB")).toBeInTheDocument();
    expect(screen.getByText("data.csv")).toBeInTheDocument();
  });

  it("does not render check_circle icon", () => {
    render(<ResourceBundleCard block={makeBlock()} />);
    expect(screen.queryByText("check_circle")).not.toBeInTheDocument();
  });
});
