import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UrgentNowCard } from "./UrgentNowCard";
import type { UiBlock } from "../../domain/types";

type UrgentNowBlock = Extract<UiBlock, { type: "urgent_now" }>;

function makeBlock(overrides?: Partial<UrgentNowBlock>): UrgentNowBlock {
  return {
    type: "urgent_now",
    eyebrow: "Urgente \u2022 Ahora",
    headline: "Acuerdo histórico en la cumbre climática",
    description:
      "Líderes mundiales firman un tratado vinculante para reducir emisiones en un 50% para 2030.",
    icon: "breaking_news_alt_1",
    iconColor: "#ef4444",
    iconBg: "#fef2f2",
    ...overrides,
  } as UrgentNowBlock;
}

describe("UrgentNowCard", () => {
  it("renders the card with the reference layout classes", () => {
    render(<UrgentNowCard block={makeBlock()} />);
    const inner = document.querySelector('[data-ui-block="urgent_now"] .card-shadow');
    expect(inner).toBeInTheDocument();
    expect(inner).toHaveClass("bg-white", "rounded-3xl", "p-5", "card-shadow");
    expect(inner).not.toHaveClass("border-gray-50");
  });

  it("renders the eyebrow label from props", () => {
    render(<UrgentNowCard block={makeBlock()} />);
    expect(screen.getByText("Urgente \u2022 Ahora")).toBeInTheDocument();
    expect(screen.getByText("Urgente \u2022 Ahora")).toHaveClass(
      "text-[10px]",
      "font-extrabold",
      "text-red-500",
      "uppercase",
      "tracking-widest",
    );
  });

  it("omits the eyebrow row when eyebrow is missing", () => {
    render(<UrgentNowCard block={makeBlock({ eyebrow: undefined })} />);
    expect(screen.queryByText("Urgente \u2022 Ahora")).not.toBeInTheDocument();
  });

  it("renders headline and description from props", () => {
    render(<UrgentNowCard block={makeBlock()} />);
    expect(screen.getByText("Acuerdo histórico en la cumbre climática")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Líderes mundiales firman un tratado vinculante para reducir emisiones en un 50% para 2030.",
      ),
    ).toBeInTheDocument();
  });

  it("uses default red icon styling when no custom colors are provided", () => {
    render(<UrgentNowCard block={makeBlock({ iconColor: undefined, iconBg: undefined })} />);
    const iconWrapper = document.querySelector('[data-ui-block="urgent_now"] .rounded-2xl');
    expect(iconWrapper).toHaveClass("bg-red-50", "text-red-500");
  });

  it("applies custom icon colors when provided", () => {
    render(<UrgentNowCard block={makeBlock({ iconBg: "#eef2ff", iconColor: "#6366f1" })} />);
    const iconWrapper = document.querySelector('[data-ui-block="urgent_now"] .rounded-2xl');
    expect(iconWrapper).toHaveStyle({ backgroundColor: "#eef2ff", color: "#6366f1" });
  });

  it("falls back to the default icon when icon is missing", () => {
    render(<UrgentNowCard block={makeBlock({ icon: undefined })} />);
    expect(document.querySelector(".material-symbols-outlined")).toHaveTextContent(
      "breaking_news_alt_1",
    );
  });

  it("does not render headline or description elements when values are empty", () => {
    render(<UrgentNowCard block={makeBlock({ headline: "", description: "" })} />);
    const headline = document.querySelector("h4");
    const paragraph = document.querySelector("p");
    expect(headline).not.toBeInTheDocument();
    expect(paragraph).not.toBeInTheDocument();
  });
});
