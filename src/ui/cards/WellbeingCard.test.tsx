import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WellbeingCard } from "./WellbeingCard";

describe("WellbeingCard", () => {
  it("renders sleep data in a div with correct colors", () => {
    render(
      <WellbeingCard
        block={{
          type: "wellbeing",
          title: "Tu bienestar",
          emoji: "🧘‍♀️",
          sleep: { icon: "bedtime", value: "7h 20m", label: "Sueño óptimo" },
        }}
      />,
    );
    expect(screen.getByText(/tu bienestar/i)).toBeInTheDocument();
    expect(screen.getByText("7h 20m")).toBeInTheDocument();
    expect(screen.getByText("Sueño óptimo")).toBeInTheDocument();

    const sleepDiv = screen.getByText("7h 20m").closest("div");
    expect(sleepDiv).toHaveClass("bg-[#F8F9FA]", "rounded-xl", "p-3", "flex", "flex-col", "items-center", "justify-center", "text-center");
    expect(screen.getByText("7h 20m")).toHaveClass("text-sm", "font-bold", "text-gray-800");
    expect(screen.getByText("Sueño óptimo")).toHaveClass("text-[10px]", "text-gray-500", "uppercase", "tracking-wide");
  });

  it("renders suggestion as a button with correct colors and hover", () => {
    render(
      <WellbeingCard
        block={{
          type: "wellbeing",
          suggestion: { icon: "directions_walk", value: "Salir a caminar", label: "Sugerencia tarde" },
        }}
      />,
    );
    const btn = screen.getByText("Salir a caminar").closest("button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass(
      "bg-purple-50",
      "border",
      "border-purple-100",
      "rounded-xl",
      "p-3",
      "flex",
      "flex-col",
      "items-center",
      "justify-center",
      "text-center",
      "hover:bg-purple-100",
      "transition-colors",
    );

    expect(screen.getByText("Salir a caminar")).toHaveClass("text-sm", "font-medium", "text-purple-700");
    expect(screen.getByText("Sugerencia tarde")).toHaveClass("text-[10px]", "text-purple-500/70");
  });

  it("renders both sleep and suggestion sections side by side", () => {
    render(
      <WellbeingCard
        block={{
          type: "wellbeing",
          sleep: { icon: "bedtime", value: "7h 20m", label: "Sueño óptimo" },
          suggestion: { icon: "directions_walk", value: "Salir a caminar", label: "Sugerencia tarde" },
        }}
      />,
    );
    const container = screen.getByText("7h 20m").parentElement?.parentElement;
    expect(container).toHaveClass("flex", "gap-3");
    expect(container?.querySelector('[class*="bg-[#F8F9FA]"]')).toBeInTheDocument();
    expect(container?.querySelector("button")).toBeInTheDocument();
  });
});
