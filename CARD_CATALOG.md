# CARD_CATALOG — Koru UiBlock → Component Mapping

> Mapeo completo: ejemplo de prompt → categoría del router → herramienta(s) → UiBlock → componente renderizado.

## Convenciones

- `type` es el discriminante de `UiBlock` en `src/domain/types.ts`.
- `Componente` vive en `src/ui/cards/<Nombre>.tsx`.
- Los componentes rediseñados a partir de `public/design-cards.html` mantienen el estético exacto y ahora tienen `onClick` real.
- `blocksFromToolResults` en `src/server/koruBackend.ts` convierte el resultado crudo de cada tool en el `UiBlock` correspondiente.

---

## 1. Clima

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "¿cómo está el clima?" | `weather` | `weather` | `weather` | `WeatherCard` |
| "¿necesito paraguas?" | `weather` | `weather` | `weather` | `WeatherCard` |
| "¿qué me pongo hoy?" | `weather` | `weather` | `weather` | `WeatherCard` |

**Props clave:** `city`, `now`, `range`, `rain`, `wind`, `advice`, `sources`.

---

## 2. Restaurantes / Gastronomía

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "mejor parrilla de Palermo" | `world_info` | `restaurant_deep_search` | `restaurant_synthesis` | `RestaurantSynthesisCard` |
| "dónde cenar en Madrid" | `world_info` | `restaurant_deep_search` | `restaurant_synthesis` | `RestaurantSynthesisCard` |

**Props clave:** `query`, `matches`, `topScore`, `pros`, `cons`, `synthesis`, `sources`, `labels`.

---

## 3. Compras y Productos

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "¿qué auriculares compro?" | `shopping` / `review` | `shopping_compare` | `comparison` | `ComparisonCard` |
| "review de auriculares" | `review` | `shopping_compare` / `web_search` | `product_analysis` | `ProductAnalysisCard` |
| "comparativa de notebooks" | `review` | `shopping_compare` | `smart_checklist` | `SmartChecklistCard` |
| "mejor cafetera 2025" | `review` | `shopping_compare` | `outfit` / `review_score` | `OutfitCard` / `ReviewScoreCard` |
| "opiniones del iPhone 16" | `review` | `web_search` | `review_document` / `review_quote` | `ReviewDocumentCard` / `ReviewQuoteCard` |

**Nota:** En este dominio un mismo tool puede renderizar distintas cards según la estructura que devuelva el LLM/agente. Koru prioriza el bloque más específico cuando existe.

---

## 4. Planificación / Agenda

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "ayudame a planificar el día" | `planning` | `plan_day` | `plan` | `PlanCard` / `PlanTimelineCard` |
| "¿qué hago primero?" | `planning` | `plan_day` | `plan` | `PlanCard` / `PlanTimelineCard` |

---

## 5. Consultas personales

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "cumple de juan" | `personal_query` / `birthday` | `query_personal_context` / `save_personal_item` | `personal_query` → block | `SocialInteractionCard` / `MemoryCard` |
| "¿cuánto gasté?" | `personal_query` | `query_personal_context` | `personal_query` → block | `MoneySummaryCard` / `DataCard` |
| "¿qué links guardé?" | `personal_query` | `query_personal_context` | `saved_record` | `SavedRecordCard` |

---

## 6. Fútbol / Deportes

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "juega Boca hoy" | `sports` | `match_schedule` | `match_timeline` | `MatchTimelineCard` |
| "¿a qué hora juega Real Madrid?" | `sports` | `match_schedule` | `match_timeline` | `MatchTimelineCard` |
| "¿cómo va el partido?" | `sports` | `match_live` | `live_match` | `LiveMatchCard` |
| "resultados de ayer" | `sports` | `match_live` | `match_stats` / `live_match` | `MatchStatsCard` / `LiveMatchCard` |

**Props `live_match`:** `homeName`, `awayName`, `homeScore`, `awayScore`, `homeInitials`, `awayInitials`, `minute`, `globalAgg`, tabs interactivos (`Stats`, `Lineups`, `Timeline`).

---

## 7. Mercados / Finanzas

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "precio del bitcoin" | `market` | `crypto_price` | `crypto_portfolio` | `CryptoPortfolioCard` |
| "cotización de Apple" | `market` | `stock_quote` | `market` | `MarketCard` |
| "precio del dólar" | `market` | `currency_convert` | `forex` | `ForexCard` |

---

## 8. Elecciones

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "resultados de las elecciones" | `elections` | `web_search` / `election_data` | `election_results` | `ElectionResultsCard` |
| "escrutinio" | `elections` | `web_search` / `election_data` | `election_results` | `ElectionResultsCard` |
| "¿a quién le conviene votar?" | `elections` | `election_vote` | `election_vote` | `ElectionVoteCard` |

---

## 9. Direcciones / Rutas

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "cómo llego a Palermo" | `directions` | `route_traffic` | `route_timeline` | `RouteTimelineCard` |
| "ruta más rápida" | `directions` | `route_traffic` | `transport_compare` | `TransportCompareCard` |
| "cuánto tardo hasta el centro" | `directions` | `route_traffic` | `route_map` | `RouteMapCard` |

---

## 10. Viajes

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "quiero viajar a Madrid" | `travel` | `travel_itinerary` | `travel_planner` / `plan` | `TravelPlannerCard` / `PlanCard` |
| "armame un itinerario" | `travel` | `travel_itinerary` | `travel_planner` | `TravelPlannerCard` |

---

## 11. Cumpleaños / Eventos personales

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "cumpleaños de Ana" | `birthday` | `save_personal_item` | `birthday_calendar` | `BirthdayCalendarCard` |
| "cuándo es el cumple de Juan" | `birthday` | `save_personal_item` | `birthday_alarm` | `BirthdayAlarmCard` |
| "regalo para mi hermano" | `birthday` | `save_personal_item` | `social_interaction` | `SocialInteractionCard` |

---

## 12. Acciones / Recordatorios

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "creame una alarma" | `action` | builtin | `local_action` | `AlarmCard` / `UrgentNowCard` |
| "recordame tomar pastillas" | `action` | builtin | `local_action` | `HealthReminderCard` |
| "anotá un gasto" | `action` | builtin | `local_action` | `MoneySummaryCard` |

---

## 13. Información general / Web

| Prompt ejemplo | Categoría | Tool | UiBlock type | Componente |
|---|---|---|---|---|
| "últimas noticias de tecnología" | `world_info` | `web_search` | `research_sources` / `web_nav` | `ResearchSourcesCard` |
| "noticias urgentes" | `world_info` | `web_search` | `data_card` | `DataCard` |

---

## Resumen por tipo de UiBlock

| UiBlock type | Origen típico | Componente | Interacción implementada |
|---|---|---|---|
| `weather` | `weather` | `WeatherCard` | — |
| `restaurant_synthesis` | `restaurant_deep_search` | `RestaurantSynthesisCard` | Botones de navegación/call/share |
| `comparison` | `shopping_compare` | `ComparisonCard` | — |
| `product_analysis` | `shopping_compare` / `web_search` | `ProductAnalysisCard` | — |
| `smart_checklist` | `shopping_compare` | `SmartChecklistCard` | Toggle de checkboxes con recálculo de progreso |
| `outfit` | `shopping_compare` | `OutfitCard` | Botón de acción |
| `review_score` | `shopping_compare` | `ReviewScoreCard` | Botón de acción |
| `review_document` | `web_search` / `shopping_compare` | `ReviewDocumentCard` | Click en tarjeta |
| `review_quote` | `web_search` / `shopping_compare` | `ReviewQuoteCard` | Botón de acción |
| `plan` | `plan_day` | `PlanCard` / `PlanTimelineCard` | — |
| `saved_record` | `save_personal_item` | `SavedRecordCard` | — |
| `personal_query` | `query_personal_context` | `MemoryCard` / `MoneySummaryCard` / `SocialInteractionCard` | Varies |
| `match_timeline` | `match_schedule` | `MatchTimelineCard` | Click en eventos |
| `live_match` | `match_live` | `LiveMatchCard` | Tabs interactivos |
| `match_stats` | `match_live` | `MatchStatsCard` | Click en estadísticas |
| `crypto_portfolio` | `crypto_price` | `CryptoPortfolioCard` | Click en moneda |
| `market` | `stock_quote` | `MarketCard` | — |
| `forex` | `currency_convert` | `ForexCard` | Click en par |
| `election_results` | `web_search` / `election_data` | `ElectionResultsCard` | Selección de candidato |
| `election_vote` | `election_vote` | `ElectionVoteCard` | Radio buttons + confirmar |
| `data_ticker` | `web_search` / `election_data` | `DataTickerCard` | Click para copiar valor / alerta |
| `route_timeline` | `route_traffic` | `RouteTimelineCard` | Botón Iniciar GPS |
| `transport_compare` | `route_traffic` | `TransportCompareCard` | Click en modo |
| `route_map` | `route_traffic` | `RouteMapCard` | Click en tarjeta |
| `travel_planner` | `travel_itinerary` | `TravelPlannerCard` | — |
| `birthday_calendar` | `save_personal_item` | `BirthdayCalendarCard` | Click en día destacado |
| `birthday_alarm` | `save_personal_item` | `BirthdayAlarmCard` | Click en tarjeta |
| `social_interaction` | `save_personal_item` / `query_personal_context` | `SocialInteractionCard` | Botón de mensaje |

---

## Verificación

- `npx vite build` → exit 0.
- `npx vitest run src/ui/` → 88 PASS / 0 FAIL.
