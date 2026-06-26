import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SmartChecklistCard } from "./SmartChecklistCard";

describe("SmartChecklistCard", () => {
  const baseBlock = {
    type: "smart_checklist" as const,
    title: "Benchmark",
    items: [
      { label: "Item A", checked: true },
      { label: "Item B", checked: false },
    ],
  };

  it("renders title and items", () => {
    render(<SmartChecklistCard block={baseBlock} />);
    expect(screen.getByText("Benchmark")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });

  it("toggles item on click", () => {
    render(<SmartChecklistCard block={baseBlock} />);
    const itemB = screen.getByText("Item B");
    fireEvent.click(itemB);
    expect(itemB).toHaveClass("line-through");
  });
});
