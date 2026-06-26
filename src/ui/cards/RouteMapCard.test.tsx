import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteMapCard } from "./RouteMapCard";

describe("RouteMapCard", () => {
  const baseBlock = {
    type: "route_map" as const,
    progress: 75,
    from: "Olivos",
    to: "Shopping",
    distance: "3 km",
    remaining: "18 min restantes",
  };

  it("renders route info and progress", () => {
    render(<RouteMapCard block={baseBlock} />);
    expect(screen.getByText(/Olivos/)).toBeInTheDocument();
    expect(screen.getByText(/Shopping/)).toBeInTheDocument();
    expect(screen.getByText(/3 km/)).toBeInTheDocument();
    expect(screen.getByText(/18 min restantes/)).toBeInTheDocument();
  });

  it("renders defaults", () => {
    render(<RouteMapCard block={{ type: "route_map" }} />);
    expect(screen.getByText(/Olivos/)).toBeInTheDocument();
  });
});
