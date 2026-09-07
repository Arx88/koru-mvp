import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InfoInterior } from "./InfoInterior";

// InfoInterior — bind real del block `deliverable`: kicker/title/description/
// metrics/summary/sections(kind real)/sources + progreso cuando working.

const infoBlock = {
  type: "deliverable" as const,
  status: "ready" as const,
  kicker: "Informe",
  title: "Energía solar en España",
  description:
    "Radiación, costos reales y el punto exacto en que la solar doméstica conviene frente a la red.",
  topic: "Energía",
  categories: [{ icon: "sun", label: "Energía" }],
  metrics: [
    { value: "€1.100/año", label: "La cuenta que importa" },
    { value: "7,4 años", label: "Payback medio" },
  ],
  summary: "Ahorro medio de una casa con 3 kWp, excedentes incluidos.",
  sections: [
    {
      title: "Dónde pega más el sol",
      kicker: "Producción anual por kWp instalado",
      kind: "grid" as const,
      items: [
        { title: "Andalucía", subtitle: "kWh", badge: "1750" },
        { title: "Murcia", subtitle: "kWh", badge: "1700" },
        { title: "Madrid", subtitle: "kWh", badge: "1600" },
      ],
    },
    {
      title: "Qué cuesta de verdad",
      kind: "rows" as const,
      items: [
        { title: "3 kWp · casa típica", subtitle: "€7.400", badge: "REF" },
        { title: "Boletín eléctrico", subtitle: "€350–600" },
      ],
    },
    {
      title: "Las 3 trampas del contrato",
      kind: "bullets" as const,
      bullets: [
        "El precio “desde” €3.900 es por 1,5 kWp sin instalación.",
        "La batería se paga sola solo si la luz nocturna supera el 45%.",
      ],
    },
    {
      title: "Cómo se instala",
      kind: "timeline" as const,
      items: [
        { title: "Visita técnica", subtitle: "medición de techo y tablero", badge: "semana 1" },
        { title: "Obra y conexión", subtitle: "2 días de trabajo", badge: "semana 3" },
      ],
    },
    {
      title: "Contexto",
      kind: "text" as const,
      paragraphs: ["El autoconsumo doméstico creció 30% interanual en España."],
    },
  ],
  sources: [
    { title: "Atlas de radiación solar", url: "https://idae.es/atlas", domain: "idae.es" },
    { title: "Precio pool OMIE", url: "https://omie.es", domain: "omie.es" },
  ],
};

describe("InfoInterior", () => {
  it("bindea kicker+topic, título, bajada y tiempo de lectura derivado", () => {
    render(<InfoInterior block={infoBlock} onClose={vi.fn()} />);
    expect(document.body.querySelector(".rep-meta span")?.textContent).toBe("Informe · Energía");
    expect(screen.getByText(/energía solar/i)).toBeInTheDocument();
    expect(screen.getByText(/radiación, costos reales/i)).toBeInTheDocument();
    expect(screen.getByText(/min de lectura/i)).toBeInTheDocument();
  });

  it("la primera métrica real va como número gigante y el resto como datasheet", () => {
    render(<InfoInterior block={infoBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/la cuenta que importa/i)).toBeInTheDocument();
    const big = document.body.querySelector(".rep-count .rc-big");
    expect(big?.textContent).toContain("€1.100");
    expect(screen.getByText(/7,4 años/i)).toBeInTheDocument();
    expect(screen.getByText(/payback medio/i)).toBeInTheDocument();
  });

  it("section grid: barras proporcionales desde los badges reales", () => {
    render(<InfoInterior block={infoBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/dónde pega más el sol/i)).toBeInTheDocument();
    expect(screen.getByText("Andalucía")).toBeInTheDocument();
    const tracks = document.body.querySelectorAll(".rrow .rtrack i");
    expect(tracks[0]?.getAttribute("style")).toContain("width: 100%"); // 1750/1750
    expect(tracks[2]?.getAttribute("style")).toContain("width: 91%"); // 1600/1750
  });

  it("section rows: datasheet con badge em; bullets: cláusulas numeradas", () => {
    render(<InfoInterior block={infoBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/qué cuesta de verdad/i)).toBeInTheDocument();
    expect(screen.getByText("€7.400")).toBeInTheDocument();
    expect(screen.getByText("REF")).toBeInTheDocument();
    expect(screen.getByText(/las 3 trampas del contrato/i)).toBeInTheDocument();
    expect(screen.getByText("I")).toBeInTheDocument();
    expect(screen.getByText("II")).toBeInTheDocument();
    expect(screen.getByText(/el precio “desde” €3.900/i)).toBeInTheDocument();
  });

  it("sections timeline y text con contenido real", () => {
    render(<InfoInterior block={infoBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/cómo se instala/i)).toBeInTheDocument();
    expect(screen.getByText("Visita técnica")).toBeInTheDocument();
    expect(screen.getByText(/obra y conexión/i)).toBeInTheDocument();
    expect(screen.getByText(/creció 30% interanual/i)).toBeInTheDocument();
  });

  it("las sources reales cierran como notas al pie con dominio", () => {
    render(<InfoInterior block={infoBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/fuentes verificadas de este informe/i)).toBeInTheDocument();
    expect(screen.getByText(/idae\.es — atlas de radiación solar/i)).toBeInTheDocument();
    expect(screen.getByText(/omie\.es — precio pool omie/i)).toBeInTheDocument();
  });

  it("guardar informe despacha create_commitment con kicker y título", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; title?: string }> = [];
    const listener = (e: Event) => {
      const d = (e as CustomEvent).detail;
      events.push({ action: d.action, title: d.title });
    };
    window.addEventListener("koru-card-action", listener);
    render(<InfoInterior block={infoBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar informe/i }));
    expect(events[0]?.action).toBe("create_commitment");
    expect(events[0]?.title).toContain("Energía solar en España");
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener("koru-card-action", listener);
  });

  it("status working: progreso y phaseLabel reales, primario deshabilitado", () => {
    render(
      <InfoInterior
        block={{
          type: "deliverable",
          status: "working",
          kicker: "Tu Informe",
          title: "Age of Empires II",
          progress: 60,
          phaseLabel: "Buscando fuentes 2/4…",
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/buscando fuentes 2\/4…/i)).toBeInTheDocument();
    expect(screen.getByText(/60% listo/i)).toBeInTheDocument();
    const bar = document.body.querySelector(".rep-count div i");
    expect(bar?.getAttribute("style")).toContain("width: 60%");
    expect(screen.getByRole("button", { name: /se está armando…/i })).toBeDisabled();
    // sin métrica gigante cuando está working
    expect(document.body.querySelector(".rc-big")).toBeNull();
  });

  it("mínimo viable: title solo, sin métricas ni secciones, sin romper", () => {
    render(
      <InfoInterior
        block={{ type: "deliverable", status: "ready", kicker: "Tu Análisis", title: "Café de especialidad" }}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[aria-label="Café de especialidad"]')).toBeTruthy();
    expect(document.body.querySelector(".rep-count")).toBeNull();
    expect(screen.getByRole("button", { name: /guardar informe/i })).toBeEnabled();
  });
});
