import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilesInterior } from "./FilesInterior";

// FilesInterior — bind real del block `resource_bundle`: files reales con
// sello por kind/mimeType, sizeLabel real, content como contexto.

const filesBlock = {
  type: "resource_bundle" as const,
  title: "Archivos de tu chat",
  summary: "El PDF del boleto ya quedó vinculado a tu viaje.",
  files: [
    {
      name: "boletos-madrid-sept.pdf",
      kind: "document" as const,
      mimeType: "application/pdf",
      sizeLabel: "412 KB",
      content: "IBERIA 0932 · MAD 12:10 → CIBELES 19:42 · asiento 14A",
    },
    {
      name: "gastos-viaje.csv",
      kind: "csv" as const,
      mimeType: "text/csv",
      sizeLabel: "3,4 KB",
      content: "concepto,monto\nvuelo,320\nhotel,540",
    },
    {
      name: "informe-solar.md",
      kind: "markdown" as const,
      mimeType: "text/markdown",
      sizeLabel: "11 KB",
    },
  ],
};

describe("FilesInterior", () => {
  it("bindea título, conteo real y summary del block", () => {
    render(<FilesInterior block={filesBlock} onClose={vi.fn()} />);
    expect(screen.getByText("Archivos de tu chat")).toBeInTheDocument();
    expect(screen.getByText("3 archivos")).toBeInTheDocument();
    expect(screen.getByText(/vinculado a tu viaje/i)).toBeInTheDocument();
  });

  it("cada archivo muestra nombre real, sello derivado y tamaño real", () => {
    render(<FilesInterior block={filesBlock} onClose={vi.fn()} />);
    expect(screen.getByText("boletos-madrid-sept.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("MD")).toBeInTheDocument();
    expect(screen.getByText("412 KB")).toBeInTheDocument();
    expect(screen.getByText("3,4 KB")).toBeInTheDocument();
  });

  it("el content real aparece como contexto; sin content va el mimeType", () => {
    render(<FilesInterior block={filesBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/IBERIA 0932 · MAD 12:10/i)).toBeInTheDocument();
    expect(screen.getByText(/concepto,monto/i)).toBeInTheDocument();
    expect(screen.getByText("text/markdown")).toBeInTheDocument();
  });

  it("el sello PDF viene del mimeType aunque el kind sea document", () => {
    render(<FilesInterior block={filesBlock} onClose={vi.fn()} />);
    const stamps = document.body.querySelectorAll(".fl-row .ft");
    expect(stamps[0]).toHaveClass("pdf");
    expect(stamps[1]).toHaveClass("doc");
  });

  it("sin files degrada honesto y el primario queda deshabilitado", () => {
    render(<FilesInterior block={{ type: "resource_bundle", files: [] }} onClose={vi.fn()} />);
    expect(screen.getByText("0 archivos")).toBeInTheDocument();
    expect(screen.getByText(/todavía no me pasaste archivos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /descargar el primero/i })).toBeDisabled();
  });

  it("onSave guarda el título con el conteo real", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<FilesInterior block={filesBlock} onClose={onClose} onSave={onSave} />);
    const fabs = document.body.querySelectorAll(".fab");
    fireEvent.click(fabs[fabs.length - 1] as HTMLElement); // el último es Guardar
    expect(onSave).toHaveBeenCalledWith("Archivos de tu chat", "3 archivos");
    expect(onClose).not.toHaveBeenCalled();
  });
});
