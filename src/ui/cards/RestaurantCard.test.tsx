import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RestaurantSynthesisCard } from "./RestaurantCard";
import type { RestaurantSynthesisResult } from "./RestaurantCard";

describe("RestaurantSynthesisCard", () => {
  const baseLabels = {
    cardTitle: "DeepHungry Synthesis",
    top3Label: "Top 3 Seleccionados",
    topPickLabel: "RECOMENDACIÓN #1",
    prosLabel: "Puntos a favor",
    consLabel: "A considerar",
    synthesisLabel: "Síntesis de las fuentes",
    navigateLabel: "Cómo llegar",
    callLabel: "Reservar",
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
        { name: "La Cabrera", sourcesMentioning: 3, quote: "Excelente bife de chorizo", imageUrl: "https://img1.test" },
        { name: "Don Julio", sourcesMentioning: 2, quote: "Ambiente clásico", imageUrl: "https://img2.test" },
        { name: "El Preferido", sourcesMentioning: 1, quote: "Parrilla tradicional", imageUrl: "https://img3.test" },
      ],
      pros: ["Carta de vinos excepcional", "Silencioso para conversar"],
      cons: ["Difícil estacionar cerca", "Requiere aviso 24h"],
      synthesis: "El Risotto de Setas Silvestres es obligatorio hoy.",
      labels: baseLabels,
      ...overrides,
    };
  }

  it("renders card title and source count from props", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getByText("DeepHungry Synthesis")).toBeInTheDocument();
    expect(screen.getByText(/3 fuentes/)).toBeInTheDocument();
  });

  it("renders default labels when custom labels are empty", () => {
    render(<RestaurantSynthesisCard result={makeResult({ labels: {} })} />);
    expect(screen.getByText("DeepHungry Synthesis")).toBeInTheDocument();
    expect(screen.getByText("Top coincidencias")).toBeInTheDocument();
    expect(screen.getByText("Puntos a favor")).toBeInTheDocument();
    expect(screen.getByText("A considerar")).toBeInTheDocument();
    expect(screen.getByText("Síntesis de las fuentes")).toBeInTheDocument();
    expect(screen.getByText("Cómo llegar")).toBeInTheDocument();
    expect(screen.getByText("Reservar")).toBeInTheDocument();
  });

  it("renders top 3 matches with image and quote", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getAllByText("La Cabrera").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Don Julio")).toBeInTheDocument();
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

  it("does not render quote line when quote is missing", () => {
    render(
      <RestaurantSynthesisCard
        result={makeResult({
          matches: [{ name: "La Cabrera", sourcesMentioning: 3 }],
        })}
      />,
    );
    expect(screen.getAllByText("La Cabrera").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Excelente bife de chorizo/)).not.toBeInTheDocument();
  });

  it("renders pros, cons, top pick label and synthesis in breakdown", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getByText("RECOMENDACIÓN #1")).toBeInTheDocument();
    expect(screen.getByText("Carta de vinos excepcional")).toBeInTheDocument();
    expect(screen.getByText("Difícil estacionar cerca")).toBeInTheDocument();
    expect(screen.getByText("Síntesis de las fuentes")).toBeInTheDocument();
    expect(screen.getByText(/El Risotto de Setas Silvestres es obligatorio hoy./)).toBeInTheDocument();
  });

  it("does not render synthesis section when synthesis is missing", () => {
    render(<RestaurantSynthesisCard result={makeResult({ synthesis: undefined })} />);
    expect(screen.queryByText("Síntesis de las fuentes")).not.toBeInTheDocument();
    expect(screen.queryByText(/El Risotto de Setas Silvestres/)).not.toBeInTheDocument();
  });

  it("does not render breakdown when there is no top match", () => {
    render(<RestaurantSynthesisCard result={makeResult({ matches: [], pros: [], cons: [] })} />);
    expect(screen.queryByText("RECOMENDACIÓN #1")).not.toBeInTheDocument();
    expect(screen.queryByText("Carta de vinos excepcional")).not.toBeInTheDocument();
  });

  it("renders action buttons from props", () => {
    render(<RestaurantSynthesisCard result={makeResult()} />);
    expect(screen.getByText("Cómo llegar")).toBeInTheDocument();
    expect(screen.getByText("Reservar")).toBeInTheDocument();
  });

  it("uses default labels when custom labels are missing", () => {
    render(<RestaurantSynthesisCard result={makeResult({ labels: { ...baseLabels, navigateLabel: undefined, callLabel: undefined } })} />);
    expect(screen.getByText("Cómo llegar")).toBeInTheDocument();
    expect(screen.getByText("Reservar")).toBeInTheDocument();
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
