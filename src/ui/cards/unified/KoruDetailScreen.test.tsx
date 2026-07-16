import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KoruDetailScreen } from "./KoruDetailScreen";
import type { Detail, DetailSection } from "./presentation";

// KoruDetailScreen — verifies sticky header, empty state, section rendering
// with stagger index, favicon when imageUrl is present, and YouTube thumbnail
// when source URL is on youtube.com. onClose / onSave / onExportPdf are mocked.

const accent = { color: "#8363f9", soft: "rgba(131,99,249,0.12)" };

function makeDetail(sections: DetailSection[] = []): Detail {
  return {
    title: "My Detail",
    subtitle: "A subtitle",
    sections,
  };
}

describe("KoruDetailScreen", () => {
  it("renders sticky header with back button and title", () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const onExportPdf = vi.fn();
    render(
      <KoruDetailScreen
        detail={makeDetail()}
        headerIcon="cloud"
        onClose={onClose}
        onSave={onSave}
        onExportPdf={onExportPdf}
      />,
    );
    // Back button (aria-label "Volver").
    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument();
    // Title rendered in both the sticky header and the hero title.
    const titles = screen.getAllByText("My Detail");
    expect(titles.length).toBeGreaterThan(0);
  });

  it("renders empty state when sections is empty", () => {
    render(
      <KoruDetailScreen
        detail={makeDetail([])}
        headerIcon="cloud"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/no hay secciones para mostrar/i),
    ).toBeInTheDocument();
  });

  it("renders sections with stagger index", () => {
    const sections: DetailSection[] = [
      {
        kind: "text",
        icon: "cloud",
        accent,
        title: "Section A",
        body: "Body A",
      },
      {
        kind: "text",
        icon: "cloud",
        accent,
        title: "Section B",
        body: "Body B",
      },
    ];
    render(
      <KoruDetailScreen
        detail={makeDetail(sections)}
        headerIcon="cloud"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    expect(screen.getByText("Section A")).toBeInTheDocument();
    expect(screen.getByText("Section B")).toBeInTheDocument();

    // The component renders through a portal to document.body, so query there.
    const cards = document.body.querySelectorAll<HTMLElement>(
      ".koru-magical-card",
    );
    expect(cards.length).toBe(2);
    expect(cards[0].style.getPropertyValue("--stagger-i")).toBe("0");
    expect(cards[1].style.getPropertyValue("--stagger-i")).toBe("1");
  });

  it("renders source favicon when imageUrl is present", () => {
    const sections: DetailSection[] = [
      {
        kind: "sources",
        icon: "link",
        accent,
        title: "Sources",
        sources: [
          {
            title: "Source A",
            url: "https://example.com",
            imageUrl: "https://example.com/favicon.ico",
          },
        ],
      },
    ];
    render(
      <KoruDetailScreen
        detail={makeDetail(sections)}
        headerIcon="cloud"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    const img = document.body.querySelector<HTMLImageElement>(
      "img.koru-source-favicon",
    );
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/favicon.ico");
  });

  it("renders YouTube thumbnail when source URL contains youtube.com", () => {
    const sections: DetailSection[] = [
      {
        kind: "sources",
        icon: "link",
        accent,
        title: "Sources",
        sources: [
          {
            title: "Video",
            url: "https://www.youtube.com/watch?v=abc123",
          },
        ],
      },
    ];
    render(
      <KoruDetailScreen
        detail={makeDetail(sections)}
        headerIcon="cloud"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    const sourceEl = document.body.querySelector(".koru-dsec-source-video");
    expect(sourceEl).not.toBeNull();
    const thumb = sourceEl!.querySelector<HTMLElement>(
      ".koru-source-video-thumb",
    );
    expect(thumb).not.toBeNull();
    expect(thumb!.style.backgroundImage).toContain(
      "img.youtube.com/vi/abc123",
    );
  });

  it("invokes onClose when the back button is clicked", () => {
    const onClose = vi.fn();
    render(
      <KoruDetailScreen
        detail={makeDetail()}
        headerIcon="cloud"
        onClose={onClose}
        onSave={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onSave with title + subtitle when the save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <KoruDetailScreen
        detail={makeDetail()}
        headerIcon="cloud"
        onClose={vi.fn()}
        onSave={onSave}
        onExportPdf={vi.fn()}
      />,
    );
    // Both the sticky-save icon button and the footer Save button have label "Guardar".
    const saveButtons = screen.getAllByRole("button", { name: /guardar/i });
    expect(saveButtons.length).toBeGreaterThan(0);
    fireEvent.click(saveButtons[0]);
    expect(onSave).toHaveBeenCalledWith("My Detail", "A subtitle");
  });

  it("invokes onExportPdf when the PDF button is clicked", () => {
    const onExportPdf = vi.fn();
    render(
      <KoruDetailScreen
        detail={makeDetail()}
        headerIcon="cloud"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onExportPdf={onExportPdf}
      />,
    );
    // Footer PDF button — accessible name combines the material-symbols icon
    // text ("picture_as_pdf") and the label ("PDF"), so use a contains match.
    fireEvent.click(screen.getByRole("button", { name: /pdf/i }));
    expect(onExportPdf).toHaveBeenCalledTimes(1);
  });
});
