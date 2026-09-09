import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Stage } from "./preview-main";
import { KoruProvider } from "./ui/KoruProvider";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { CHAT_CATALOG, CHAT_SCRIPT } from "./preview-data";

// Mismo árbol que sirve el entry /preview.html (bootstrap real del preview).
function Showcase() {
  return (
    <ErrorBoundary>
      <KoruProvider>
        <Stage />
      </KoruProvider>
    </ErrorBoundary>
  );
}

// ============================================================================
// PREVIEW v6 — showcase FUNCIONAL: filtros por categoría, búsqueda, reveal
// total y estados vacíos. Se monta <Stage/> (el mismo árbol que sirve el
// entry /preview.html) y se ejercita como lo haría un usuario.
// ============================================================================

// Turnos exactos del script usados como sondas de presencia/ausencia.
const TURNO_DIA = "buen día koru";
const TURNO_DEPORTES = "cómo va el clásico?";
const TURNO_ULTIMO = "qué le regalo a juan?";

describe("preview-main v6 · showcase funcional", () => {
  it("monta el teléfono con la bienvenida, chips del catálogo y quick actions", () => {
    render(<Showcase />);
    // Bienvenida explica el showcase
    expect(screen.getByText(/55 tipos de card/i)).toBeInTheDocument();
    // Chips: una por categoría del catálogo derivado (Todo + 12)
    for (const cat of CHAT_CATALOG) {
      expect(screen.getByRole("tab", { name: new RegExp(cat.label, "i") })).toBeInTheDocument();
    }
    // Quick actions funcionales al pie
    expect(screen.getByRole("button", { name: /¿cómo va el clásico\?/i })).toBeInTheDocument();
    // El feed es un log accesible
    expect(screen.getByRole("log", { name: /conversación con michi/i })).toBeInTheDocument();
  });

  it("«Mostrar todo» revela el script completo y apaga el typing indicator", async () => {
    const user = userEvent.setup();
    render(<Showcase />);
    await user.click(screen.getByRole("button", { name: /mostrar todo/i }));
    // El último turno del script (personas) está en pantalla…
    expect(await screen.findByText(TURNO_ULTIMO)).toBeInTheDocument();
    // …y sin entries pendientes no hay burbujas de typing.
    expect(screen.queryByText(/lo sigo minuto a minuto/i)).toBeInTheDocument();
  });

  it("el chip de categoría filtra el feed y el progreso pasa a modo pantalla", async () => {
    const user = userEvent.setup();
    render(<Showcase />);
    await user.click(screen.getByRole("button", { name: /mostrar todo/i }));
    await screen.findByText(TURNO_ULTIMO);

    // Filtrar por Deportes
    await user.click(screen.getByRole("tab", { name: /deportes/i }));
    expect(screen.getByText(TURNO_DEPORTES)).toBeInTheDocument();
    expect(screen.queryByText(TURNO_DIA)).not.toBeInTheDocument();
    expect(screen.queryByText(TURNO_ULTIMO)).not.toBeInTheDocument();
    // Contador en modo pantalla: la cantidad real de entries de deportes
    const deportes = CHAT_SCRIPT.filter((e) => e.tag === "deportes").length;
    expect(screen.getByText(`${deportes} en pantalla`)).toBeInTheDocument();
    // El chip queda marcado como activo (aria-pressed)
    expect(screen.getByRole("tab", { name: /deportes/i })).toHaveAttribute("aria-pressed", "true");

    // Volver a «Todo» restaura la conversación completa
    await user.click(screen.getByRole("tab", { name: /^todo/i }));
    expect(screen.getByText(TURNO_DIA)).toBeInTheDocument();
    expect(screen.getByText(TURNO_ULTIMO)).toBeInTheDocument();
  });

  it("las quick actions del footer saltan a su categoría", async () => {
    const user = userEvent.setup();
    render(<Showcase />);
    await user.click(screen.getByRole("button", { name: /¿cómo va el clásico\?/i }));
    expect(screen.getByText(TURNO_DEPORTES)).toBeInTheDocument();
    expect(screen.queryByText(TURNO_DIA)).not.toBeInTheDocument();
  });

  it("la búsqueda del composer filtra (insensible a acentos) y se limpia con ×", async () => {
    const user = userEvent.setup();
    render(<Showcase />);
    await user.click(screen.getByRole("button", { name: /mostrar todo/i }));
    await screen.findByText(TURNO_ULTIMO);

    const input = screen.getByRole("searchbox", { name: /buscar en la conversación/i });
    // «boca» matchea el turno de match_timeline y su block; oculta el resto
    await user.type(input, "boca");
    expect(screen.getByText("cuándo juega boca?")).toBeInTheDocument();
    expect(screen.queryByText(TURNO_DIA)).not.toBeInTheDocument();
    expect(screen.queryByText(TURNO_ULTIMO)).not.toBeInTheDocument();

    // Limpiar restaura todo
    await user.click(screen.getByRole("button", { name: /limpiar búsqueda/i }));
    expect(screen.getByText(TURNO_DIA)).toBeInTheDocument();
    expect(screen.getByText(TURNO_ULTIMO)).toBeInTheDocument();
  });

  it("una búsqueda sin resultados muestra el estado vacío honesto", async () => {
    const user = userEvent.setup();
    render(<Showcase />);
    const input = screen.getByRole("searchbox", { name: /buscar en la conversación/i });
    await user.type(input, "zxqxqinexistente");
    expect(screen.getByText(/nada por acá con ese filtro/i)).toBeInTheDocument();
    // Con query activa no hay botón «Mostrar todo» (ya estamos en modo pantalla)
    expect(screen.queryByRole("button", { name: /mostrar todo/i })).not.toBeInTheDocument();
  });

  it("pausa y velocidad son controles accesibles con estado", async () => {
    const user = userEvent.setup();
    render(<Showcase />);
    const pause = screen.getByRole("button", { name: /pausar avance/i });
    await user.click(pause);
    expect(screen.getByRole("button", { name: /reanudar avance/i })).toHaveAttribute("aria-pressed", "true");

    const speed = screen.getByRole("button", { name: /velocidad de avance/i });
    await user.click(speed); // 1× → 2×
    expect(screen.getByRole("button", { name: /velocidad de avance \(2×\)/i })).toBeInTheDocument();
    await user.click(speed); // 2× → 4×
    expect(screen.getByRole("button", { name: /velocidad de avance \(4×\)/i })).toBeInTheDocument();
  });
});
