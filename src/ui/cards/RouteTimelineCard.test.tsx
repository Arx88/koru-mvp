import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteTimelineCard } from "./RouteTimelineCard";

describe("RouteTimelineCard", () => {
  const baseBlock = {
    type: "route_timeline" as const,
    eta: "18 min",
    items: [
      { label: "Girá a la izquierda", detail: "Av. Corrientes", color: "bg-emerald-500" },
      { label: "Continuá por Acceso Norte", detail: "5.8 km", color: "bg-amber-400" },
    ],
  };

  it("renders items and eta", () => {
    render(<RouteTimelineCard block={baseBlock} />);
    expect(screen.getByText("Girá a la izquierda")).toBeInTheDocument();
    expect(screen.getByText("Av. Corrientes")).toBeInTheDocument();
    expect(screen.getByText(/18 min/)).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<RouteTimelineCard block={{ type: "route_timeline" }} />);
    expect(screen.getByText("Salida 12 Olivos")).toBeInTheDocument();
  });
});
