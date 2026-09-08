import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useState } from "react";
import { KoruProvider, useKoruOptional } from "../KoruProvider";
import { CreateScreen } from "./CreateScreen";
import { CheckInterior } from "../cards/lectura/panels/CheckInterior";
import { NoteInterior } from "../cards/lectura/panels/NoteInterior";
import type { UiBlock } from "../../domain/types";

// CreateScreen — flujo REAL de Colecciones: Crear → guardar → reabrir.
// El contrato que estos tests clavan:
//   1. nota  → LifeRecord con sourceBlock `review_document` → reabre como
//      la card post-it (NoteInterior) con el texto VERBATIM + tags derivados.
//   2. lista → LifeRecord con sourceBlock `smart_checklist` + Checklist
//      durable con los ids sintéticos del contrato de la card (checklist_<slug>
//      / citem_<slug>_<i>) → el toggle de la card reabierta golpea ESE
//      checklist (sin duplicados) y la card hidrata el estado VIVO del store.

// ── Probe: expone el context del provider al scope del test ──
type KoruCtx = NonNullable<ReturnType<typeof useKoruOptional>>;
let probe: KoruCtx | null = null;
function Probe() {
  probe = useKoruOptional();
  return null;
}

// ── Harness: permite montar children extra (la card reabierta) DESPUÉS
// de crear el record, dentro del MISMO provider (mismo store vivo) ──
let mountExtra: ((node: ReactNode) => void) | null = null;
function Harness() {
  const [extra, setExtra] = useState<ReactNode>(null);
  mountExtra = (node: ReactNode) => setExtra(node);
  return (
    <KoruProvider>
      <Probe />
      <CreateScreen onClose={vi.fn()} />
      {extra}
    </KoruProvider>
  );
}

async function createList(items: string[]) {
  render(<Harness />);
  fireEvent.click(screen.getByText("Lista").closest("button") as HTMLElement);
  fireEvent.change(screen.getByPlaceholderText("Ej: Super de la semana"), {
    target: { value: "Super de la semana" },
  });
  const first = screen.getByPlaceholderText("Item 1");
  fireEvent.change(first, { target: { value: items[0] } });
  fireEvent.keyDown(first, { key: "Enter" });
  fireEvent.change(screen.getByPlaceholderText("Item 2"), { target: { value: items[1] } });
  if (items[2] != null) {
    fireEvent.keyDown(screen.getByPlaceholderText("Item 2"), { key: "Enter" });
    fireEvent.change(screen.getByPlaceholderText("Item 3"), { target: { value: items[2] } });
  }
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  await waitFor(() => expect(probe?.state.records.length).toBe(1));
}

beforeEach(() => {
  probe = null;
  mountExtra = null;
  localStorage.clear();
});

describe("Crear → Nota → Colecciones → reabrir", () => {
  it("guarda el record con sourceBlock review_document (título + body verbatim)", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Nota").closest("button") as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText("Ej: Idea para el proyecto"), {
      target: { value: "Idea app" },
    });
    fireEvent.change(screen.getByPlaceholderText("Escribí lo que quieras recordar..."), {
      target: { value: "Llamar al dentista el jueves a las 10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(probe?.state.records.length).toBe(1));
    const record = probe!.state.records[0];
    expect(record.title).toBe("Idea app");
    expect(record.collection).toBe("Notas");
    expect(record.sourceBlock?.type).toBe("review_document");
    const block = record.sourceBlock as Extract<UiBlock, { type: "review_document" }>;
    expect(block.title).toBe("Idea app");
    expect(block.body).toBe("Llamar al dentista el jueves a las 10");
  });

  it("el sourceBlock reabre como la card post-it (NoteInterior) con texto verbatim y tag derivado", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Nota").closest("button") as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText("Ej: Idea para el proyecto"), {
      target: { value: "Idea app" },
    });
    fireEvent.change(screen.getByPlaceholderText("Escribí lo que quieras recordar..."), {
      target: { value: "Llamar al dentista el jueves a las 10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(probe?.state.records.length).toBe(1));
    const block = probe!.state.records[0].sourceBlock as UiBlock;

    // Reabrir: montar NoteInterior con el sourceBlock (como hace CollectionsScreen
    // → reopenRecord → TalkOverlay → KoruUnifiedCard → interior).
    act(() => mountExtra?.(<NoteInterior block={block as never} onClose={vi.fn()} />));
    // post-it con el texto VERBATIM (highlight de día/hora no altera el contenido)
    expect(screen.getByText(/Llamar al dentista/i)).toBeInTheDocument();
    // tag derivado determinista del contenido real
    expect(screen.getByText("llamada")).toBeInTheDocument();
    // fecha detectada → aparece en el highlight del post-it y/o el chip de fecha
    expect(screen.getAllByText(/jueves/i).length).toBeGreaterThan(0);
  });
});

describe("Crear → Lista → Colecciones → reabrir (contrato de ids)", () => {
  it("guarda smart_checklist + checklist durable con ids sintéticos + shopping list", async () => {
    await createList(["Café", "Leche", "Pan"]);
    const record = probe!.state.records[0];
    expect(record.collection).toBe("Listas");
    expect(record.sourceBlock?.type).toBe("smart_checklist");
    const block = record.sourceBlock as Extract<UiBlock, { type: "smart_checklist" }>;
    expect(block.title).toBe("Super de la semana");
    expect(block.items).toEqual([
      { label: "Café", checked: false },
      { label: "Leche", checked: false },
      { label: "Pan", checked: false },
    ]);

    // Checklist durable con los ids del contrato de la card
    const checklist = probe!.state.checklists?.find((c) => c.id === "checklist_super_de_la_semana");
    expect(checklist).toBeTruthy();
    expect(checklist!.items.map((i) => i.id)).toEqual([
      "citem_cafe_0",
      "citem_leche_1",
      "citem_pan_2",
    ]);

    // Shopping list durable (TIER S)
    const shopping = probe!.state.shoppingLists?.[0];
    expect(shopping?.title).toBe("Super de la semana");
    expect(shopping?.items.map((i) => i.name)).toEqual(["Café", "Leche", "Pan"]);
  });

  it("el toggle de la card reabierta golpea el MISMO checklist (cero duplicados) y queda persistido", async () => {
    await createList(["Café", "Leche", "Pan"]);
    const block = probe!.state.records[0].sourceBlock as UiBlock;

    // Toggle como lo despacha CheckInterior (ids sintéticos del contrato)
    window.dispatchEvent(
      new CustomEvent("koru-card-action", {
        detail: {
          action: "toggle_checklist",
          blockType: "smart_checklist",
          blockData: block,
          checklistId: "checklist_super_de_la_semana",
          itemId: "citem_cafe_0",
        },
      }),
    );

    await waitFor(() => {
      const same = probe!.state.checklists?.filter(
        (c) => c.id === "checklist_super_de_la_semana",
      );
      expect(same).toHaveLength(1); // sin duplicado
      expect(
        same![0].items.find((i) => i.id === "citem_cafe_0")?.doneAt,
      ).toBeTruthy();
    });
  });

  it("la card reabierta hidrata el estado VIVO del store (1/3 marcado), no la foto del block", async () => {
    await createList(["Café", "Leche", "Pan"]);
    const block = probe!.state.records[0].sourceBlock as UiBlock;

    // marcar un item vía el store (como haría el widget de HomeScreen)
    window.dispatchEvent(
      new CustomEvent("koru-card-action", {
        detail: {
          action: "toggle_checklist",
          blockType: "smart_checklist",
          blockData: block,
          checklistId: "checklist_super_de_la_semana",
          itemId: "citem_cafe_0",
        },
      }),
    );
    await waitFor(() =>
      expect(
        probe!.state.checklists?.[0].items.find((i) => i.id === "citem_cafe_0")?.doneAt,
      ).toBeTruthy(),
    );

    // reabrir DESPUÉS del toggle: la card debe mostrar el progreso vivo (1/3)
    act(() => mountExtra?.(<CheckInterior block={block as never} onClose={vi.fn()} />));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    const cafe = screen.getByText("Café").closest("button");
    expect(cafe).toHaveAttribute("aria-pressed", "true");
    const leche = screen.getByText("Leche").closest("button");
    expect(leche).toHaveAttribute("aria-pressed", "false");
  });
});
