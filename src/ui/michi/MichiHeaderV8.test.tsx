import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MichiHeaderV8 } from "./MichiHeaderV8";

vi.mock("./useMichiProgress", () => ({ useMichiProgress: () => ({ level: 1, inLevel: 0 }) }));
vi.mock("./v8Shared", () => ({ MichiCat: () => <span>Michi</span> }));
afterEach(cleanup);

describe("Michi header menu", () => {
  it("opens, navigates, reopens and dismisses without changing the design", () => {
    const onMenuAction = vi.fn();
    render(<MichiHeaderV8 onMenuAction={onMenuAction} onAvatares={vi.fn()} />);
    const menu = screen.getByRole("button", { name: "Abrir menú" });
    fireEvent.click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("menuitem", { name: "Hoy" }));
    expect(onMenuAction).toHaveBeenCalledWith("hoy");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(menu);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(menu);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
