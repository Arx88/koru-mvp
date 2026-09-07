import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KoruDetailScreen } from "./KoruDetailScreen";
import type { Detail } from "./presentation";
import {
  travelPlanBlock,
  savedRecordBlock,
  vaultBlock,
  memoryBlock,
  researchSourcesBlock,
  reviewDocumentBlock,
  resourceBundleBlock,
  electionResultsBlock,
  electionVoteBlock,
  matchTimelineBlock,
  matchStatsBlock,
  deliverableBlock,
} from "../lectura/fixtures";

// Integración end-to-end del REGISTRO Lectura: KoruDetailScreen recibe el
// UiBlock real y debe renderizar el interior bespoke del catálogo (no el
// genérico). Un caso por cada tipo del lote final.

const detail: Detail = { title: "Detalle", sections: [] };

describe("KoruDetailScreen × registro Lectura (lote final)", () => {
  const cases: Array<{ type: string; block: Parameters<typeof KoruDetailScreen>[0]["block"]; panel: string }> = [
    { type: "travel_plan", block: travelPlanBlock, panel: "#p-travel" },
    { type: "saved_record (1)", block: savedRecordBlock, panel: "#p-saved" },
    { type: "saved_record (N)", block: vaultBlock, panel: "#p-vault" },
    { type: "memory", block: memoryBlock, panel: "#p-mem" },
    { type: "research_sources", block: researchSourcesBlock, panel: "#p-links" },
    { type: "review_document", block: reviewDocumentBlock, panel: "#p-note" },
    { type: "resource_bundle", block: resourceBundleBlock, panel: "#p-files" },
    { type: "election_results", block: electionResultsBlock, panel: "#p-elect" },
    { type: "election_vote", block: electionVoteBlock, panel: "#p-evote" },
    { type: "match_timeline", block: matchTimelineBlock, panel: "#p-mtl" },
    { type: "match_stats", block: matchStatsBlock, panel: "#p-mstats" },
    { type: "deliverable", block: deliverableBlock, panel: "#p-info" },
  ];

  it.each(cases)("block $type → interior $panel (no genérico)", ({ block, panel }) => {
    const { unmount } = render(
      <KoruDetailScreen
        detail={detail}
        headerIcon="sparkles"
        onClose={vi.fn()}
        onSave={vi.fn()}
        block={block}
      />,
    );
    const found = document.body.querySelector(`.lcr-panel${panel}`);
    expect(found).toBeTruthy();
    // el genérico no debe renderizarse en paralelo
    expect(document.body.querySelector(".koru-roadmap-screen")).toBeNull();
    unmount();
  });

  it("un tipo SIN registro sigue cayendo al genérico (cero regresión)", () => {
    render(
      <KoruDetailScreen
        detail={{ title: "Shopping", sections: [{ kind: "text", icon: "cart", accent: { color: "#8363f9", soft: "rgba(131,99,249,0.12)" }, title: "Lista", body: "Café" }] }}
        headerIcon="cart"
        onClose={vi.fn()}
        block={{ type: "shopping_list", items: ["Café"] }}
      />,
    );
    expect(document.body.querySelector(".koru-roadmap-screen")).toBeTruthy();
    expect(document.body.querySelector(".lcr")).toBeNull();
  });
});
