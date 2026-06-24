import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryCard } from "./DeliveryCard";

describe("DeliveryCard", () => {
  it("renders with title and status badge", () => {
    render(
      <DeliveryCard
        block={{
          type: "delivery",
          title: "Envío en curso",
          status: "En reparto",
          carrier: "Amazon",
          estimatedDate: "hoy antes de las 20:00",
        }}
      />,
    );
    expect(screen.getByText("Envío en curso")).toBeInTheDocument();
    expect(screen.getByText((content) => content.toLowerCase().includes("en reparto"))).toBeInTheDocument();
  });

  it("renders timeline with vertical line and colored dots, not numbered circles", () => {
    render(
      <DeliveryCard
        block={{
          type: "delivery",
          title: "Paquete en camino",
          status: "Actualizado",
          carrier: "Amazon",
          estimatedDate: "hoy antes de las 20:00",
          steps: [
            { label: "En reparto", done: true, time: "08:45 AM" },
            { label: "Entregado", done: false },
          ],
        }}
      />,
    );
    expect(screen.getByText("En reparto")).toBeInTheDocument();
    expect(screen.getByText("Entregado")).toBeInTheDocument();

    const timelineContainer = screen.getByText("En reparto").closest("div.relative.flex")?.parentElement;
    expect(timelineContainer).toBeTruthy();
    expect(timelineContainer!.querySelector('[class*="absolute"][class*="left-2"]')).toBeInTheDocument();
    expect(timelineContainer!.querySelector('[class*="absolute"][class*="left-2"][class*="w-0.5"]')).toBeInTheDocument();

    const dots = timelineContainer!.querySelectorAll('[class*="rounded-full"]');
    expect(dots?.length).toBe(2);

    const stepText = screen.getByText("En reparto");
    expect(stepText).toHaveClass("font-semibold", "text-gray-900");
  });

  it("renders time label inline for done steps", () => {
    render(
      <DeliveryCard
        block={{
          type: "delivery",
          steps: [{ label: "En reparto", done: true, time: "08:45 AM" }],
        }}
      />,
    );
    expect(screen.getByText("08:45 AM")).toBeInTheDocument();
  });
});
