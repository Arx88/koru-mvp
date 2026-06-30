import type { Visualizer } from "../types";
import type { ComparisonTableData } from "../../schemas/comparison";

export const ComparisonTableVisualizer: Visualizer = {
  id: "comparison_table",
  render(data) {
    const c = data as ComparisonTableData;
    return {
      type: "comparison",
      title: "Comparativa",
      items: c.items.map((it, i) => ({
        title: it.title,
        score: Math.max(50, 90 - i * 10),
      })),
      recommendation: c.recommendation,
    };
  },
};
