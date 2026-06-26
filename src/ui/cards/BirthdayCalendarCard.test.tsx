import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BirthdayCalendarCard } from "./BirthdayCalendarCard";

describe("BirthdayCalendarCard", () => {
  const baseBlock = {
    type: "birthday_calendar" as const,
    month: "Junio 2025",
    highlightedDay: 12,
    startDay: 6,
    daysInMonth: 13,
  };

  it("renders month and highlighted day", () => {
    render(<BirthdayCalendarCard block={baseBlock} />);
    expect(screen.getByText("Junio 2025")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<BirthdayCalendarCard block={{ type: "birthday_calendar" }} />);
    expect(screen.getByText("Junio 2025")).toBeInTheDocument();
  });
});
