import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeliveryInterior } from "./DeliveryInterior";
import { deliveryBlock } from "../fixtures";

// DeliveryInterior — bind real del block `delivery`: carrier/status/
// trackingId/estimatedDate/steps con done real.

describe("DeliveryInterior", () => {
  it("bindea carrier, status, fecha estimada y trackingId", () => {
    render(<DeliveryInterior block={deliveryBlock} onClose={vi.fn()} />);
    expect(screen.getAllByText(/correo argentino/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/en reparto/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/llega mañana antes de las 14/i).length).toBeGreaterThan(0);
    expect(screen.getByText("CA-88213904-AR")).toBeInTheDocument();
  });

  it("los pasos del seguimiento vienen del block con su estado real", () => {
    render(<DeliveryInterior block={deliveryBlock} onClose={vi.fn()} />);
    expect(screen.getByText(/✓ salió del centro logístico/i)).toBeInTheDocument();
    expect(screen.getByText(/○ en reparto/i)).toBeInTheDocument();
    expect(screen.getByText(/3 de 5 pasos/i)).toBeInTheDocument();
  });

  it("stamp del ticket refleja el estado (no entregado)", () => {
    render(<DeliveryInterior block={deliveryBlock} onClose={vi.fn()} />);
    expect(screen.getByText("EN REPARTO")).toBeInTheDocument();
    expect(screen.queryByText("ENTREGADO")).toBeNull();
  });

  it("con todos los pasos done el ticket marca ENTREGADO", () => {
    render(
      <DeliveryInterior
        block={{ ...deliveryBlock, steps: deliveryBlock.steps.map((s) => ({ ...s, done: true })) }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/entregado/i).length).toBeGreaterThan(0);
  });

  it("primaria despacha complete (o dismiss si llegó) y cierra", () => {
    const onClose = vi.fn();
    const events: Array<{ action: string; blockData: { type: string } }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("koru-card-action", listener);
    render(<DeliveryInterior block={deliveryBlock} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /perfecto, gracias/i }));
    expect(events[0]?.action).toBe("complete");
    expect(events[0]?.blockData?.type).toBe("delivery");
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener("koru-card-action", listener);
  });

  it("compartir no rompe sin navigator.share (jsdom)", () => {
    render(<DeliveryInterior block={deliveryBlock} onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /compartir seguimiento/i });
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
});
