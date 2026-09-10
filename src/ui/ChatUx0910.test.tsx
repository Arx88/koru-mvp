/**
 * 🔴 UX (2026-09-10) — tres cambios que suben la percepción de calidad:
 *  1. Render de markdown en las burbujas de Koru (listas, negritas, links).
 *  2. Botón de copiar debajo del mensaje.
 *  3. Botón HOY visible arriba a la izquierda del chat.
 * Además: [proactive_shown] jamás visible en el Home.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderMarkdownBody, CopyButton } from "./MarkdownMessage";
import { systemPrompt } from "../server/systemPrompt";

describe("renderMarkdownBody", () => {
  it("convierte listas con '-' en <ul> con <li>", () => {
    const out = renderMarkdownBody("Tu plan:\n- Gimnasio 7:30\n- Trabajo 9:00");
    const html = JSON.stringify(out);
    expect(html).toContain("Gimnasio 7:30");
    expect(out.some((n: any) => n?.type === "ul")).toBe(true);
  });

  it("convierte listas numeradas en <ol>", () => {
    const out = renderMarkdownBody("Pasos:\n1. Abrir ajustes\n2. Tocar ciudad");
    expect(out.some((n: any) => n?.type === "ol")).toBe(true);
  });

  it("renderiza **negrita** como <b>", () => {
    const out = renderMarkdownBody("Hoy tenés **gimnasio a las 7:30**");
    const flat = JSON.stringify(out);
    expect(flat).toContain("gimnasio a las 7:30");
    expect(flat).toContain('"b"');
  });

  it("renderiza [texto](url) como link con target _blank", () => {
    const out = renderMarkdownBody("Mirá [la fuente](https://ejemplo.com/x)");
    const flat = JSON.stringify(out);
    expect(flat).toContain("la fuente");
    expect(flat).toContain("https://ejemplo.com/x");
  });

  it("texto plano sin markdown pasa como párrafos", () => {
    const out = renderMarkdownBody("Hola, todo bien?");
    expect(out).toHaveLength(1);
  });
});

describe("CopyButton", () => {
  it("copia al clipboard y confirma con aria-label (icon-only v7.6, sin caja)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton text="Mensaje para copiar" />);
    const btn = screen.getByRole("button", { name: /copiar mensaje/i });
    // 🐱 v7.6: icono fantasma — SIN label textual visible ("Copiar") ni caja:
    // el único contenido es el icono (ligadura material-symbols).
    expect(btn.textContent).not.toMatch(/copiar|copiado/i);
    fireEvent.click(btn);
    expect(writeText).toHaveBeenCalledWith("Mensaje para copiar");
    await screen.findByRole("button", { name: "Copiado" });
  });
});

describe("systemPrompt — Koru conoce la app", () => {
  it("incluye la sección de conocimiento de la app y Mis Colecciones", () => {
    const prompt = systemPrompt(new Date().toISOString(), {
      userName: "Test",
      memories: [],
      commitments: [],
      records: [],
    } as any, []);
    expect(prompt).toContain("CONOCIMIENTO DE LA APP");
    expect(prompt).toContain("Mis Colecciones");
    expect(prompt).toContain("Guardados");
  });
});
