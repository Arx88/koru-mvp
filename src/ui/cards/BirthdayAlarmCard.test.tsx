import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BirthdayAlarmCard } from "./BirthdayAlarmCard";

describe("BirthdayAlarmCard", () => {
  const baseBlock = {
    type: "birthday_alarm" as const,
    name: "Cumpleaños Ana",
    date: "12 jul",
    countdown: "08",
    unit: "días",
    eta: "En 30m",
  };

  it("renders alarm info", () => {
    render(<BirthdayAlarmCard block={baseBlock} />);
    expect(screen.getByText("Cumpleaños Ana")).toBeInTheDocument();
    expect(screen.getByText("12 jul")).toBeInTheDocument();
    expect(screen.getByText("08")).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<BirthdayAlarmCard block={{ type: "birthday_alarm" }} />);
    expect(screen.getByText("Cumpleaños Ana")).toBeInTheDocument();
  });
});
