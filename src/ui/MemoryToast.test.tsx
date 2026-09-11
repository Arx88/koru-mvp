/**
 * 🔴 MemoryToast v2 — el toast de memoria es un momento de CONFIRMACIÓN, no
 * solo una notificación. Tests de las acciones Guardar/Soltar y de las
 * fases visuales que celebran la acción.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryToast } from "./MemoryToast";

describe("MemoryToast v2 · acciones de confirmación", () => {
  it("sin memoryId NO muestra acciones (modo notificación, ej. records guardados)", () => {
    render(<MemoryToast kind="preference" text="Le encanta el sushi." onDismiss={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /soltar/i })).not.toBeInTheDocument();
  });

  it("con memoryId + handlers muestra Guardar y Soltar", () => {
    render(
      <MemoryToast
        kind="preference"
        text="Le encanta el sushi."
        onDismiss={vi.fn()}
        memoryId="mem_123"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /soltar/i })).toBeInTheDocument();
  });

  it("Guardar llama onConfirm con el id de la memoria", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <MemoryToast
        kind="wellbeing"
        text="Es celíaco."
        onDismiss={vi.fn()}
        memoryId="mem_cel"
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onConfirm).toHaveBeenCalledWith("mem_cel");
  });

  it("Soltar llama onReject con el id", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(
      <MemoryToast
        kind="preference"
        text="Le gusta el té."
        onDismiss={vi.fn()}
        memoryId="mem_tea"
        onConfirm={vi.fn()}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByRole("button", { name: /soltar/i }));
    expect(onReject).toHaveBeenCalledWith("mem_tea");
  });

  it("tras confirmar, el título cambia a 'Recuerdo guardado' (feedback visible)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryToast
        kind="preference"
        text="Le encanta el sushi."
        onDismiss={vi.fn()}
        memoryId="mem_1"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText(/recuerdo guardado/i)).toBeInTheDocument();
  });

  it("tras soltar, el título cambia a 'Soltado'", async () => {
    const user = userEvent.setup();
    render(
      <MemoryToast
        kind="preference"
        text="Le gusta el té."
        onDismiss={vi.fn()}
        memoryId="mem_2"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /soltar/i }));
    expect(screen.getByText(/^recuerdo soltado$/i)).toBeInTheDocument();
  });

  it("confirmar programa el auto-dismiss del toast", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <MemoryToast
          kind="preference"
          text="Le encanta el sushi."
          onDismiss={onDismiss}
          memoryId="mem_3"
          onConfirm={vi.fn()}
          onReject={vi.fn()}
        />,
      );
      await user.click(screen.getByRole("button", { name: /guardar/i }));
      // 1600ms de confirmación + 200ms de salida
      vi.advanceTimersByTime(1800);
      await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MemoryToast v3 · guardados con acción Ver → Mis Colecciones", () => {
  it("kind=saved muestra label e icono de guardado (no de memoria)", () => {
    render(
      <MemoryToast
        kind="saved"
        text="Creado en Notas"
        onDismiss={vi.fn()}
        collection="Notas"
      />,
    );
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    expect(screen.getByText("Creado en Notas")).toBeInTheDocument();
    // NO habla de "aprendí algo nuevo" (eso es para memorias)
    expect(screen.queryByText(/aprendí algo nuevo/i)).not.toBeInTheDocument();
  });

  it("con collection + onOpenCollections muestra el botón Ver", () => {
    render(
      <MemoryToast
        kind="saved"
        text="Creado en Notas"
        onDismiss={vi.fn()}
        collection="Notas"
        onOpenCollections={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /ver/i })).toBeInTheDocument();
  });

  it("sin collection NO muestra Ver (toasts genéricos tipo 'Listo ✓')", () => {
    render(<MemoryToast kind="saved" text="Listo ✓" onDismiss={vi.fn()} onOpenCollections={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^ver$/i })).not.toBeInTheDocument();
  });

  it("Ver llama onOpenCollections con la colección y auto-dismissa", async () => {
    const user = userEvent.setup();
    const onOpenCollections = vi.fn();
    const onDismiss = vi.fn();
    render(
      <MemoryToast
        kind="saved"
        text="Creado en Notas"
        onDismiss={onDismiss}
        collection="Notas"
        onOpenCollections={onOpenCollections}
      />,
    );
    await user.click(screen.getByRole("button", { name: /ver/i }));
    expect(onOpenCollections).toHaveBeenCalledWith("Notas");
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });
});
