/**
 * Registro de interiores Lectura Visual por card type.
 *
 * Cada card del catálogo se registra ACÁ cuando se bindea a su UiBlock
 * real (commit por card). Los tipos sin registro caen al render genérico
 * de KoruDetailScreen (comportamiento actual intacto).
 */
import type { ComponentType } from "react";
import type { UiBlock } from "../../../domain/types";
import type { Detail } from "../unified/presentation";
import { WeatherInterior } from "./panels/WeatherInterior";
import { PlanInterior } from "./panels/PlanInterior";

export interface LecturaInteriorProps<T extends UiBlock = UiBlock> {
  block: T;
  detail?: Detail;
  onClose: () => void;
  onSave?: (title: string, subtitle?: string) => void;
  onExportPdf?: () => void;
}

type AnyInterior = ComponentType<LecturaInteriorProps<any>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Partial<Record<UiBlock["type"], AnyInterior>> = {
  weather: WeatherInterior as AnyInterior,
  plan: PlanInterior as AnyInterior,
};

export function lecturaInteriorFor(block: UiBlock): AnyInterior | null {
  return REGISTRY[block.type] ?? null;
}
