import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LinksInterior } from "./LinksInterior";

// LinksInterior — bind real del block `research_sources`: sources reales con
// dominio/snippet, preview solo con imageUrl real, click abre url.

const linksBlock = {
  type: "research_sources" as const,
  title: "La lectura pendiente",
  summary: "Lo que me pediste guardar para después, con preview real de cada página.",
  sources: [
    {
      title: "La carbonara de Roma que sí es carbonara",
      url: "https://lacucinaitaliana.it/carbonara",
      domain: "lacucinaitaliana.it",
      snippet: "La receta original sin crema: guanciale, pecorino y huevo.",
      imageUrl: "/stitch/outfits/recipe-pasta.jpg",
    },
    {
      title: "Por qué Europa apuesta fuerte a los chips propios",
      url: "https://eldiario.es/tecnologia/chips-europa",
      domain: "eldiario.es",
      snippet: "El plan de la UE para reducir dependencia de Asia en semiconductores.",
    },
    {
      title: "Magnifica Evo a €329 — histórico mínimo",
      url: "https://tucarro.com/magnifica-evo",
      domain: "tucarro.com",
      snippet: "Precio con descuento de temporada.",
      imageUrl: "/stitch/outfits/prod-espresso.jpg",
    },
  ],
  followUpQuestion: "¿Querés que te avise si baja de precio alguno?",
};

describe("LinksInterior", () => {
  it("bindea título, summary y el conteo real de sources", () => {
    render(<LinksInterior block={linksBlock} onClose={vi.fn()} />);
    expect(screen.getByText("La lectura pendiente")).toBeInTheDocument();
    expect(screen.getByText(/con preview real de cada página/i)).toBeInTheDocument();
    expect(screen.getByText("3 guardados")).toBeInTheDocument();
  });

  it("cada source muestra título, dominio y snippet reales", () => {
    render(<LinksInterior block={linksBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/la carbonara de roma que sí es carbonara/i)).toBeInTheDocument();
    expect(screen.getByText(/por qué europa apuesta fuerte/i)).toBeInTheDocument();
    expect(screen.getAllByText(/lacucinaitaliana\.it/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/la receta original sin crema/i)).toBeInTheDocument();
  });

  it("preview fotográfico SOLO con imageUrl real; sin ella va la inicial", () => {
    render(<LinksInterior block={linksBlock} onClose={vi.fn()} />);
    const imgs = document.body.querySelectorAll(".lk2-row .th img");
    expect(imgs.length).toBe(2); // recipe-pasta + prod-espresso
    expect(imgs[0]?.getAttribute("src")).toBe("/stitch/outfits/recipe-pasta.jpg");
    // eldiario no tiene imageUrl → inicial del dominio en un span
    const ths = document.body.querySelectorAll(".lk2-row .th");
    expect(ths[1]?.textContent).toContain("E");
  });

  it("la primera source va como pin (destacada)", () => {
    render(<LinksInterior block={linksBlock} onClose={vi.fn()} />);
    const pin = document.body.querySelector(".lk2-row.pin");
    expect(pin?.textContent).toContain("carbonara");
  });

  it("tocar una fila abre su url real", () => {
    const open = vi.fn();
    window.open = open as unknown as typeof window.open;
    render(<LinksInterior block={linksBlock} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(/por qué europa apuesta fuerte/i));
    expect(open).toHaveBeenCalledWith("https://eldiario.es/tecnologia/chips-europa", "_blank", "noopener");
  });

  it("followUpQuestion real y sin sources degrada honesto", () => {
    const { rerender } = render(<LinksInterior block={linksBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/¿querés que te avise si baja de precio/i)).toBeInTheDocument();
    rerender(
      <LinksInterior
        block={{ type: "research_sources", summary: "", sources: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("0 guardados")).toBeInTheDocument();
    expect(screen.getByText(/todavía no guardamos enlaces/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir el destacado/i })).toBeDisabled();
  });
});
