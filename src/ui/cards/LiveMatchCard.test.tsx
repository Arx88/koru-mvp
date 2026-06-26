import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LiveMatchCard } from "./LiveMatchCard";

describe("LiveMatchCard", () => {
  it("renders score with correct large size and tracking", () => {
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          homeTeam: { name: "Real Madrid", abbrev: "RMA", score: 2 },
          awayTeam: { name: "Man City", abbrev: "MCI", score: 1 },
          globalStatus: "Global 3-3",
          stats: [],
        }}
      />,
    );
    const scoreSpan = document.querySelector("span.text-4xl.font-black.tracking-tighter");
    expect(scoreSpan).toBeInTheDocument();
    expect(scoreSpan).toHaveTextContent("2");
    expect(scoreSpan).toHaveTextContent("1");
    expect(scoreSpan).toHaveClass("text-4xl", "font-black", "tracking-tighter");
  });

  it("renders global status with gray bg and small text", () => {
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          globalStatus: "Global 3-3",
          stats: [],
        }}
      />,
    );
    const status = screen.getByText("Global 3-3");
    expect(status).toHaveClass("bg-gray-50", "px-2", "py-0.5", "rounded-full", "text-gray-400", "text-[10px]");
  });

  it("renders team badges with correct sizes and backgrounds", () => {
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          homeTeam: { name: "Real Madrid", abbrev: "RMA", score: 2 },
          awayTeam: { name: "Man City", abbrev: "MCI", score: 1 },
          stats: [],
        }}
      />,
    );
    const rmaBadge = screen.getByText("RMA");
    expect(rmaBadge).toHaveClass("w-14", "h-14", "bg-gray-50", "rounded-full", "text-gray-900");
    const mciBadge = screen.getByText("MCI");
    expect(mciBadge).toHaveClass("w-14", "h-14", "bg-blue-50", "rounded-full", "text-blue-700");
  });

  it("renders toggle segment control with Stats/Lineups/Timeline", () => {
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          stats: [],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lineups" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toBeInTheDocument();

    const statsBtn = screen.getByRole("button", { name: "Stats" });
    expect(statsBtn).toHaveClass("bg-white", "shadow-sm", "text-gray-800");
  });

  it("switches active tab on click", async () => {
    const user = userEvent.setup();
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          stats: [],
        }}
      />,
    );
    const lineupsBtn = screen.getByRole("button", { name: "Lineups" });
    await user.click(lineupsBtn);
    expect(lineupsBtn).toHaveClass("bg-white", "shadow-sm", "text-gray-800");

    const statsBtn = screen.getByRole("button", { name: "Stats" });
    expect(statsBtn).not.toHaveClass("bg-white");
  });

  it("renders stats bars in correct view", () => {
    render(
      <LiveMatchCard
        block={{
          type: "live_match",
          stats: [
            { label: "Possession", leftValue: "42%", rightValue: "58%", leftPercent: 42, rightPercent: 58 },
            { label: "Shots (On Target)", leftValue: "12", rightValue: "8", leftPercent: 60, rightPercent: 40 },
          ],
        }}
      />,
    );
    expect(screen.getByText("Possession")).toBeInTheDocument();
    expect(screen.getByText("Shots (On Target)")).toBeInTheDocument();

    const bars = document.querySelectorAll(".bg-gray-800");
    expect(bars.length).toBeGreaterThan(0);
  });
});
