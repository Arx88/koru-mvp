import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MichiResearchLoading } from "./MichiResearchLoading";

vi.mock("./v8Shared", () => ({ MichiCat: () => <span /> }));
afterEach(cleanup);

describe("Michi research progress", () => {
  it("does not calculate a percentage from a pipeline phase", () => {
    render(<MichiResearchLoading phase="comparing" kind="searching" />);
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    expect(screen.getByText("En curso")).toBeTruthy();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("Explorando fuentes");
  });
  it("keeps the last stage active during saving instead of marking everything complete", () => {
    render(<MichiResearchLoading phase="saving" deliverable={{ kicker: "Tu Informe", progress: 94 }} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("94");
    expect(document.querySelectorAll(".mr-steps .is-done")).toHaveLength(2);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("Organizando la respuesta");
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])("does not display invalid backend progress (%s)", progress => {
    render(<MichiResearchLoading phase="searching" deliverable={{ kicker: "Tu Informe", progress }} />);
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
  });
  it("does not promise web research for a planning task", () => {
    render(<MichiResearchLoading phase="planning" kind="planning" />);
    expect(screen.getByRole("heading").textContent).toContain("Estoy armando tu plan");
    expect(screen.queryByText("Explorando fuentes confiables")).toBeNull();
  });
});
