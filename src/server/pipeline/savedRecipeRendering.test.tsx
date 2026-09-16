import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MichiRecipeCard } from "../../ui/cards/unified/MichiNewCards";
import type { MichiProps } from "../../ui/cards/unified/MichiLayouts";
import { normalizeFinalPayload } from "./finalizePayload";

vi.mock("../../ui/KoruProvider", () => ({ useKoru: () => ({ records: [] }) }));

it("renders the saved recipe through the existing specialized card and opens its detail", () => {
  const response = normalizeFinalPayload({ reply: "Aquí tienes tu receta.", uiBlocks: [] }, "Mi tortilla", [{
    id: "recipe", name: "recipe_show", result: {
      type: "recipe_show", status: "ok", recipes: [{ title: "Tortilla guardada", ingredients: "huevos, sal", steps: "Batir.\nCocinar." }],
    },
  }]);
  const handleClick = vi.fn();
  const props = { block: response.uiBlocks[0], hero: { title: "Tortilla guardada" }, handleClick, overlay: null } as unknown as MichiProps;
  render(<MichiRecipeCard {...props} />);
  expect(screen.getByRole("heading", { name: "Tortilla guardada" })).toBeInTheDocument();
  expect(screen.getByRole("article")).toHaveAttribute("data-ui-block", "recipe");
  expect(screen.getByRole("button", { name: "Guardar Tortilla guardada" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Ver receta completa/ }));
  expect(handleClick).toHaveBeenCalledOnce();
});
