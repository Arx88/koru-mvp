/**
 * Bloque News — barrel de tools de noticias enriquecidas.
 *
 * Actualmente exporta `newsUrgentSearch`, el wrapper ToolHandler de
 * `fetchUrgentNews` (GDELT + USGS + NewsAPI + Google Fact Check Tools).
 *
 * No incluye `news_urgent` (histórico, solo GDELT) ni `news_topic` porque
 * esos viven en `trendingTools` (`src/tools/trending/trending.ts`); aquí
 * solo agregamos las tools nuevas que devuelven un `UrgentNewsResult` rico
 * (headline + severity + timeline + factChecks + location) listo para mapear
 * al UiBlock `news_urgent`.
 */

import { newsUrgentSearch } from "./newsUrgent";

export { newsUrgentSearch } from "./newsUrgent";
export type {
  UrgentNewsResult,
  UrgentNewsSeverity,
  UrgentNewsCategory,
  UrgentNewsFactVerdict,
  UrgentNewsTimelineItem,
  UrgentNewsFactCheck,
  UrgentNewsSource,
} from "./newsUrgent";

export const newsTools = [newsUrgentSearch];
