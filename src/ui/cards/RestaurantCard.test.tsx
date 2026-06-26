import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RestaurantSynthesisCard } from "./RestaurantCard";
import type { RestaurantSynthesisResult } from "./RestaurantCard";

describe.skip("RestaurantSynthesisCard", () => {
  const baseLabels = {
    cardTitle: "DeepHungry Synthesis",
    badge: "Alta Precisión",
    top3Label: "Top 3 Seleccionados",
    topPickLabel: "RECOMENDACIÓN #1",
    prosLabel: "Puntos a favor",
    consLabel: "A considerar",
    chefLabel: "Recomendación del Chef",
    reserveAction: "Reservar",
    menuAction: "Menú",
  };

  function makeResult(overrides?: Partial<RestaurantSynthesisResult>): RestaurantSynthesisResult {
    return {
      type: "restaurant_synthesis",
      query: "parrilla palermo",
      status: "ok",
      sources: [
        { title: "S1", domain: "d1.com", url: "https://d1.com" },
        { title: "S2", domain: "d2.com", url: "https://d2.com" },
        { title: "S3", domain: "d3.com", url: "https://d3.com" },
      ],
      matches: [
        { name: "La Cabrera", sourcesMentioning: 3, quote: "Excelente bife de chorizo", imageUrl: "https://img1.test", rating: 4.9 },
        { name: "Don Julio", sourcesMentioning: 2, quote: "Ambiente clásico", imageUrl: "https://img2.test", rating: 4.7 },
        { name: "El Preferido", sourcesMentioning: 1, quote: "Parrilla tradicional", imageUrl: "https://img3.test", rating: 4.6 },
      ],
      pros: ["Carta de vinos excepcional", "Silencioso para conversar"],
      cons: ["Difícil estacionar cerca", "Requiere aviso 24h"],
      synthesis: "El Risotto de Setas Silvestres es obligatorio hoy.",
      labels: baseLabels,
      ...overrides,
    };
  }

  it("renders card title, badge and header icon from props", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getByText("DeepHungry Synthesis")).toBeInTheDocument();
    expect(screen.getByText("Alta Precisión")).toBeInTheDocument();
  });

  it("does not render hardcoded Spanish text when labels are empty", () => {
    render(<RestaurantSynthesisCard result={makeResult({ labels: {} })} />);
    expect(screen.queryByText("DeepHungry Synthesis")).not.toBeInTheDocument();
    expect(screen.queryByText("Alta Precisión")).not.toBeInTheDocument();
    expect(screen.queryByText("Top 3 Seleccionados")).not.toBeInTheDocument();
    expect(screen.queryByText("Puntos a favor")).not.toBeInTheDocument();
    expect(screen.queryByText("A considerar")).not.toBeInTheDocument();
    expect(screen.queryByText("Recomendación del Chef")).not.toBeInTheDocument();
    expect(screen.queryByText("Reservar")).not.toBeInTheDocument();
    expect(screen.queryByText("Menú")).not.toBeInTheDocument();
  });

  it("renders top 3 matches with image, rating and quote", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getAllByText("La Cabrera").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4.9")).toBeInTheDocument();
    expect(screen.getByText("Don Julio")).toBeInTheDocument();
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("El Preferido")).toBeInTheDocument();
    expect(screen.getByAltText("La Cabrera")).toHaveAttribute("src", "https://img1.test");
  });

  it("renders placeholder icon when match image is missing", () => {
    render(
      <RestaurantSynthesisCard
        result={makeResult({
          matches: [{ name: "La Cabrera", sourcesMentioning: 3, quote: "Excelente bife de chorizo" }],
        })}
      />,
    );
    expect(screen.getAllByText("La Cabrera").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByAltText("La Cabrera")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "La Cabrera" })).toBeInTheDocument();
  });

  it("does not render star rating when rating is missing", () => {
    render(
      <RestaurantSynthesisCard
        result={makeResult({
          matches: [{ name: "La Cabrera", sourcesMentioning: 3, quote: "Excelente bife de chorizo" }],
        })}
      />,
    );
    expect(screen.queryByText("4.8")).not.toBeInTheDocument();
    expect(screen.queryByText("4.9")).not.toBeInTheDocument();
  });

  it("does not render quote line when quote is missing", () => {
    render(
      <RestaurantSynthesisCard
        result={makeResult({
          matches: [{ name: "La Cabrera", sourcesMentioning: 3, rating: 4.9 }],
        })}
      />,
    );
    expect(screen.getAllByText("La Cabrera").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Excelente bife de chorizo/)).not.toBeInTheDocument();
  });

  it("renders pros, cons, top pick label and chef recommendation in breakdown", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getByText("RECOMENDACIÓN #1")).toBeInTheDocument();
    expect(screen.getByText("Carta de vinos excepcional")).toBeInTheDocument();
    expect(screen.getByText("Difícil estacionar cerca")).toBeInTheDocument();
    expect(screen.getByText("Recomendación del Chef")).toBeInTheDocument();
    expect(screen.getByText(/El Risotto de Setas Silvestres es obligatorio hoy./)).toBeInTheDocument();
  });

  it("does not render chef recommendation when synthesis is missing", () => {
    render(<RestaurantSynthesisCard result={makeResult({ synthesis: undefined })} />);
    expect(screen.queryByText("Recomendación del Chef")).not.toBeInTheDocument();
    expect(screen.queryByText(/El Risotto de Setas Silvestres/)).not.toBeInTheDocument();
  });

  it("does not render breakdown when there is no top match", () => {
    render(<RestaurantSynthesisCard result={makeResult({ matches: [], pros: [], cons: [] })} />);
    expect(screen.queryByText("RECOMENDACIÓN #1")).not.toBeInTheDocument();
    expect(screen.queryByText("Carta de vinos excepcional")).not.toBeInTheDocument();
  });

  it("renders action buttons from props", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getByRole("button", { name: "Reservar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar favorito" })).toBeInTheDocument();
  });

  it("does not render action buttons when labels are missing", () => {
    render(<RestaurantSynthesisCard result={makeResult({ labels: { ...baseLabels, reserveAction: undefined, menuAction: undefined } })} />);
    expect(screen.queryByRole("button", { name: "Reservar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menú" })).not.toBeInTheDocument();
  });

  it("renders partial status gracefully without matches", () => {
    render(
      <RestaurantSynthesisCard
        result={makeResult({ status: "partial", matches: [], pros: [], cons: [], synthesis: undefined })}
      />,
    );
    expect(screen.getByText("DeepHungry Synthesis")).toBeInTheDocument();
    expect(screen.queryByText("Top 3 Seleccionados")).not.toBeInTheDocument();
    expect(screen.queryByText("RECOMENDACIÓN #1")).not.toBeInTheDocument();
  });
});
