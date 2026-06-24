import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SavedRecordCard } from "./SavedRecordCard";

describe("SavedRecordCard", () => {
  it("renders greeting text and single record row with check_circle", () => {
    render(
      <SavedRecordCard
        block={{
          type: "saved_record",
          title: "¡Guardado! He añadido el enlace a tu sección de Herramientas IA en la Bóveda.",
          records: [
            {
              domain: "interest",
              kind: "tool_link",
              title: "Figma AI",
              collection: "Herramientas IA",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText(/¡Guardado! He añadido el enlace/),
    ).toBeInTheDocument();
    expect(screen.getByText("Figma AI")).toBeInTheDocument();
    expect(screen.getByText("Herramientas IA")).toBeInTheDocument();
    expect(screen.getByText("check_circle")).toBeInTheDocument();
  });

  it("shows fallback text when title is missing", () => {
    render(
      <SavedRecordCard
        block={{
          type: "saved_record",
          records: [
            {
              domain: "work",
              kind: "expense",
              title: "Café",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("¡Guardado!")).toBeInTheDocument();
    expect(screen.getByText("Café")).toBeInTheDocument();
    expect(screen.getByText("check_circle")).toBeInTheDocument();
  });

  it("handles empty records gracefully", () => {
    const { container } = render(
      <SavedRecordCard
        block={{
          type: "saved_record",
          title: "Guardado",
          records: [],
        }}
      />,
    );

    expect(screen.getByText("Guardado")).toBeInTheDocument();
    expect(
      container.querySelector('[data-ui-block="saved_record"]'),
    ).toBeInTheDocument();
    // No record row rendered
    expect(container.querySelectorAll("[data-ui-block='saved_record'] > div")).toHaveLength(0);
  });

  it("maps record kind to correct Material Symbol icon", () => {
    const { container } = render(
      <SavedRecordCard
        block={{
          type: "saved_record",
          records: [
            {
              domain: "health",
              kind: "medication",
              title: "Vitamina D",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("medication")).toBeInTheDocument();
    expect(
      container.querySelector('[data-ui-block="saved_record"]'),
    ).toBeInTheDocument();
  });
});
