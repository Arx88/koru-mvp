import type { UiBlock } from "../types";
import type { SchemaId } from "../schemas/types";

export interface Visualizer {
  id: SchemaId;
  render(data: unknown, enrichment?: Record<string, unknown>): UiBlock;
}
