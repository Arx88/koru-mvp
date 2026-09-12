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
import { MoneyInterior } from "./panels/MoneyInterior";
import { TickerInterior } from "./panels/TickerInterior";
import { RouteTimelineInterior } from "./panels/RouteTimelineInterior";
import { RouteMapInterior } from "./panels/RouteMapInterior";
import { TransportCompareInterior } from "./panels/TransportCompareInterior";
import { DeliveryInterior } from "./panels/DeliveryInterior";
import { BirthdayCalendarInterior } from "./panels/BirthdayCalendarInterior";
import { BirthdayAlarmInterior } from "./panels/BirthdayAlarmInterior";
import { SocialInterior } from "./panels/SocialInterior";
import { ComparisonInterior } from "./panels/ComparisonInterior";
import { ProductInterior } from "./panels/ProductInterior";
import { ReviewScoreInterior } from "./panels/ReviewScoreInterior";
import { NoteInterior } from "./panels/NoteInterior";
import { EvoteInterior } from "./panels/EvoteInterior";
import { ElectInterior } from "./panels/ElectInterior";
import { MstatsInterior } from "./panels/MstatsInterior";
import { MemInterior } from "./panels/MemInterior";
import { MtlInterior } from "./panels/MtlInterior";
import { LinksInterior } from "./panels/LinksInterior";
import { FilesInterior } from "./panels/FilesInterior";
import { SavedRecordInterior } from "./panels/SavedRecordInterior";
import { TravelInterior } from "./panels/TravelInterior";
import { InfoInterior } from "./panels/InfoInterior";
import { DataInterior } from "./panels/DataInterior";
import { ReminderInterior } from "./panels/ReminderInterior";
import { ShopInterior } from "./panels/ShopInterior";
import { ReviewQuoteInterior } from "./panels/ReviewQuoteInterior";
import { TennisInterior } from "./panels/TennisInterior";
import { WebNavInterior } from "./panels/WebNavInterior";
import { SignalInterior } from "./panels/SignalInterior";
import { GenerationInterior } from "./panels/GenerationInterior";
import { ClarifyInterior } from "./panels/ClarifyInterior";
import { ActivityInterior } from "./panels/ActivityInterior";
import { UniversalInterior } from "./panels/UniversalInterior";

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
  money_summary: MoneyInterior as AnyInterior,
  data_ticker: TickerInterior as AnyInterior,
  route_timeline: RouteTimelineInterior as AnyInterior,
  route_map: RouteMapInterior as AnyInterior,
  transport_compare: TransportCompareInterior as AnyInterior,
  delivery: DeliveryInterior as AnyInterior,
  birthday_calendar: BirthdayCalendarInterior as AnyInterior,
  birthday_alarm: BirthdayAlarmInterior as AnyInterior,
  social_interaction: SocialInterior as AnyInterior,
  comparison: ComparisonInterior as AnyInterior,
  product_analysis: ProductInterior as AnyInterior,
  review_score: ReviewScoreInterior as AnyInterior,
  review_document: NoteInterior as AnyInterior,
  election_vote: EvoteInterior as AnyInterior,
  election_results: ElectInterior as AnyInterior,
  match_stats: MstatsInterior as AnyInterior,
  memory: MemInterior as AnyInterior,
  match_timeline: MtlInterior as AnyInterior,
  research_sources: LinksInterior as AnyInterior,
  resource_bundle: FilesInterior as AnyInterior,
  saved_record: SavedRecordInterior as AnyInterior,
  travel_plan: TravelInterior as AnyInterior,
  deliverable: InfoInterior as AnyInterior,
  data_card: DataInterior as AnyInterior,
  // 🔴 Cierre de la deuda de estética: los 15 tipos que caían al render
  // genérico Kimi (oscuro, viejo) ahora tienen interior Lectura Visual.
  // 9 a medida + UniversalInterior de respaldo para los de baja frecuencia
  // (y cualquier tipo futuro que se registre acá). CERO "VER MÁS" viejo.
  reminder: ReminderInterior as AnyInterior,
  shopping_list: ShopInterior as AnyInterior,
  review_quote: ReviewQuoteInterior as AnyInterior,
  tennis_match: TennisInterior as AnyInterior,
  web_nav: WebNavInterior as AnyInterior,
  proactive_signal: SignalInterior as AnyInterior,
  generation: GenerationInterior as AnyInterior,
  clarifying_question: ClarifyInterior as AnyInterior,
  activity_group: ActivityInterior as AnyInterior,
  decision_support: UniversalInterior as AnyInterior,
  travel_planner: UniversalInterior as AnyInterior,
  wellbeing: UniversalInterior as AnyInterior,
  activity_tracker: UniversalInterior as AnyInterior,
  urgent_now: UniversalInterior as AnyInterior,
  exercise_plan: UniversalInterior as AnyInterior,
};

export function lecturaInteriorFor(block: UiBlock): AnyInterior | null {
  if ((block.type === "research_sources" && block.mode === "news") || (block.type === "proactive_signal" && block.category === "news")) return NewsInterior as AnyInterior;
  return REGISTRY[block.type] ?? null;
}
