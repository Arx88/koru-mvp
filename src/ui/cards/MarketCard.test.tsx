import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketCard } from "./MarketCard";

describe("MarketCard", () => {
  const baseBlock = {
    type: "market" as const,
    symbol: "BTC",
    name: "Bitcoin",
    pair: "BTC/USD",
    price: "$64.230",
    change: 2.45,
    time: "1D",
  };

  it("renders symbol, name, price and change", () => {
    render(<MarketCard block={baseBlock} />);
    expect(screen.getByText("BTC/USD")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("$64.230")).toBeInTheDocument();
    expect(screen.getByText(/2\.45/)).toBeInTheDocument();
  });

  it("shows negative change in red", () => {
    render(<MarketCard block={{ ...baseBlock, change: -1.2 }} />);
    expect(screen.getByText(/1\.2/)).toBeInTheDocument();
  });

  it("renders defaults without block data", () => {
    render(<MarketCard block={{ type: "market" }} />);
    expect(screen.getByText("BTC/USD")).toBeInTheDocument();
  });
});
