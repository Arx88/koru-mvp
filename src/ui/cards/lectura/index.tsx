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
import { OutfitInterior } from "./panels/OutfitInterior";
import { LiveMatchInterior } from "./panels/LiveMatchInterior";
import { NewsInterior } from "./panels/NewsInterior";
import { RestaurantInterior } from "./panels/RestaurantInterior";
import { RecipeInterior } from "./panels/RecipeInterior";
import { MovieInterior } from "./panels/MovieInterior";
import { BookInterior } from "./panels/BookInterior";
import { AlarmInterior } from "./panels/AlarmInterior";
import { CheckInterior } from "./panels/CheckInterior";
import { BriefInterior } from "./panels/BriefInterior";
import { HealthInterior } from "./panels/HealthInterior";
import { MarketInterior } from "./panels/MarketInterior";
import { CryptoInterior } from "./panels/CryptoInterior";
import { ForexInterior } from "./panels/ForexInterior";

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
  outfit: OutfitInterior as AnyInterior,
  live_match: LiveMatchInterior as AnyInterior,
  news_urgent: NewsInterior as AnyInterior,
  restaurant_synthesis: RestaurantInterior as AnyInterior,
  recipe: RecipeInterior as AnyInterior,
  movie_review: MovieInterior as AnyInterior,
  book_review: BookInterior as AnyInterior,
  alarm: AlarmInterior as AnyInterior,
  smart_checklist: CheckInterior as AnyInterior,
  morning_brief: BriefInterior as AnyInterior,
  health_reminder: HealthInterior as AnyInterior,
  market: MarketInterior as AnyInterior,
  crypto_portfolio: CryptoInterior as AnyInterior,
  forex: ForexInterior as AnyInterior,
};

export function lecturaInteriorFor(block: UiBlock): AnyInterior | null {
  return REGISTRY[block.type] ?? null;
}
