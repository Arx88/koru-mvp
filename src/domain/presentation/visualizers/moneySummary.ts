import type { Visualizer } from "../types";
import type { MoneySummaryData } from "../../schemas/money";

export const MoneySummaryVisualizer: Visualizer = {
  id: "money_summary",
  render(data) {
    const m = data as MoneySummaryData;
    return {
      type: "money_summary",
      title: "Gastos",
      total: m.total,
      currency: m.currency ?? "EUR",
      recommendation: m.recommendation,
    };
  },
};
