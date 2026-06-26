import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ElectionVoteCard } from "./ElectionVoteCard";

describe("ElectionVoteCard", () => {
  const baseBlock = {
    type: "election_vote" as const,
    question: "¿Aprobás la reforma?",
    subtitle: "Reforma laboral · Vinculante",
    options: [
      { label: "Sí", sub: "Flexibilización" },
      { label: "No", sub: "Legislación vigente" },
    ],
  };

  it("renders question and subtitle", () => {
    render(<ElectionVoteCard block={baseBlock} />);
    expect(screen.getByText("¿Aprobás la reforma?")).toBeInTheDocument();
    expect(screen.getByText("Reforma laboral · Vinculante")).toBeInTheDocument();
  });

  it("renders options", () => {
    render(<ElectionVoteCard block={baseBlock} />);
    expect(screen.getByRole("radio", { name: /Sí/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /No/ })).toBeInTheDocument();
  });

  it("selects option on click", () => {
    render(<ElectionVoteCard block={baseBlock} />);
    const yes = screen.getByRole("radio", { name: /Sí/ });
    fireEvent.click(yes);
    expect(yes).toHaveAttribute("aria-checked", "true");
  });

  it("disable confirm until selected", () => {
    render(<ElectionVoteCard block={baseBlock} />);
    const confirm = screen.getByRole("button", { name: /Confirmar voto/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Sí/ }));
    expect(confirm).not.toBeDisabled();
  });
});
