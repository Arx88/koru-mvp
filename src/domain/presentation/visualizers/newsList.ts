import type { Visualizer } from "../types";
import type { NewsListData } from "../../schemas/news";

export const NewsListVisualizer: Visualizer = {
  id: "news_list",
  render(data) {
    const n = data as NewsListData;
    return {
      type: "research_sources",
      title: n.title ?? "Fuentes",
      summary: n.sources.map((s) => s.title).join(" · "),
      sources: n.sources.map((s) => ({ title: s.title, url: s.url, domain: "" })),
    };
  },
};
