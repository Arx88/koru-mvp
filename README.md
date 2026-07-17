<div align="center">

# 🌱 Koru MVP

### _Asistente personal conversacional con memoria confirmable y personalidad calibrada._

**Una mascota que opera tu día a día. No un chatbot. Un compañero.**

[![Deploy](https://img.shields.io/badge/Deploy-koru--mvp.onrender.com-black?logo=render&logoColor=white)](https://koru-mvp.onrender.com)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Tests](https://img.shields.io/badge/tests-287%20pass%20%2F%200%20fail-22C55E?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/Uso-Privado-red)]()

**Koru · local-first · mobile 420px · stage: garden**

</div>

---

## 🌟 ¿Qué es Koru?

**Koru** es una **PWA local-first de asistente personal conversacional** construida en torno a una **mascota virtual** que actúa como compañero empático. No es un chatbot genérico: es un **operador cotidiano** que combina agenda, vida doméstica, búsqueda web semántica, memoria confirmable y personalidad calibrada, todo en una interfaz mobile-first de 420 px.

Funcionalmente, Koru intenta ser — simultáneamente:

| | | |
|---|---|---|
| 📅 | **Agenda y recordatorios** | Alarmas, tareas, compromisos, eventos ICS, Google Calendar |
| 🏠 | **Gestor de vida doméstica** | Gastos, comidas, inventario, listas de compras, decisiones de compra |
| 🔍 | **Buscador web semántico** | Noticias, clima, comparativas de productos, rutas, señales del mundo |
| 🧠 | **Memoria persistente confirmable** | Preferencias, rutinas, objetivos, relaciones, límites |
| 💜 | **Compañero empático** | Voz calibrada (cálida / directriz / humor ajustable) |

> _"Koru no se alimenta de secretos."_

### 🌿 El Jardín de la Memoria — la metáfora diferenciadora

La memoria de Koru es **confirmable, no absorbente**. Koru propone hechos como "candidatos" y el usuario los **riega** (confirma) o **poda** (descarta). El "stage" del usuario crece con la confianza:

```
seed → sprout → roots → born → garden
```

Es una arquitectura explícita de **consentimiento**: nada entra a la memoria sin que el usuario lo autorice. La confianza se gana, no se asume.

---

## ✨ Highlights

| | |
|---|---|
| 🧠 **Memoria confirmable** | Sistema de candidatos → confirmados/rechazados · 5 stages de confianza · edit history con diff |
| 🎭 **Mascota con 16 estados** | idle, thinking, working, happy, tired, sleeping, mistake, planning, celebrating, worried, affectionate, curious... |
| 🃏 **56 tipos de cards Tier-S** | Sistema unificado: hero + detail + cta + actions · 51 mapper functions · mobile 420 px |
| 🛠️ **121+ tools reales** | Clima, restaurantes, deportes, finanzas, noticias, rutas, viajes, gastos, salud, OCR, calendar... |
| 🤖 **Multi-LLM con fallback** | NVIDIA Nemotron-3-Ultra · MiniMax · OpenRouter · Ollama local · Semantic Router por embeddings |
| ✨ **Enhancement Engine** | Propone "+1 contextual" como botones clickeables tras cada respuesta |
| 🛡️ **Boundaries de autonomía** | Cada tool declara `risk`, `requiresApproval`, `autoRun` — el usuario aprueba lo sensible |
| 🔒 **Anti-alucinación** | `structureExtractor` valida datos contra citas literales de las fuentes |
| 📴 **Offline-first** | IndexedDB cache 24h + offline message queue + auto-replay al reconectar |
| 🌐 **i18n es/en** | Detección heurística + instrucción de idioma inyectada al LLM |
| 📄 **PDF export** | Genera HTML imprimible de los últimos 50 turnos con sources y tablas |
| 🎬 **36 motion patterns** | Sistema Tier-S sin framer-motion · CSS puro + `tw-animate-css` + hooks propios |
| 🧪 **287 tests pasando** | 95 unitarios (Vitest) + 13 E2E (Playwright desktop + Pixel 7) + 6 agents eval |
| 🚀 **5 deploy targets** | Vercel + Render · Railway · Fly.io · Docker · local prod |

---

## 🧱 Stack técnico

### Frontend
- **React 19** (`StrictMode`) + **Vite 8** (Rolldown bundler) + **TypeScript 6**
- **Tailwind 4** (CSS-first con `@theme inline`) + **tw-animate-css** + **lucide-react**
- **Sin Redux/Zustand/Jotai** — estado en único `KoruContext` con `useReducer`
- **Sin React Router** — navegación por estado interno (`useState<Screen>`)
- **Sin framer-motion** — animaciones CSS + hooks propios (`useTapRipple`, `KoruCountUp`)
- **PWA** con Service Worker (push notifications + background sync)
- **Tesseract.js** (OCR en cliente para receipts)

### Backend
- **Node.js 22** HTTP nativo (sin Express) — backend embebido en Vite middleware (dev) o bundle esbuild (prod)
- **Streaming NDJSON** para feedback de progreso en cada turno
- **5 proveedores LLM** con fallback automático:
  - **NVIDIA Integrate** — `nvidia/nemotron-3-ultra-550b-a55b` (default) + fast `stepfun-ai/step-3.5-flash`
  - **MiniMax** — vía OAuth token, modelo `MiniMax-M2.7`
  - **OpenRouter** — hasta 3 keys × 3 modelos (rotación con `Promise.any`)
  - **Ollama local** — para embeddings del Semantic Router (`nomic-embed-text`) y modelos locales
  - **BlueSminds** — `mimo-v2.5` (opcional)
- **Semantic Router** — decide intención por embeddings *antes* del LLM (ahorra tokens y latencia)
- **Simulated tool detector** — compatibilidad con modelos sin tool-calls nativos (Qwen3, DeepSeek-R1)
- **Multi-búsqueda web** — Brave, Serper, Tavily, NewsAPI, GNews, SearXNG, GDELT, Open-Meteo, OSRM + Playwright fallback

### Infra
- **Vercel + Render** (frontend estático + backend Node) — `vercel.json` rewrites `/api/* → koru-mvp.onrender.com`
- **Railway** — `nixpacks` builder, `node server-bundle.mjs --max-old-space-size=512`, healthcheck `/api/health`
- **Fly.io** — `app=koru-mvp`, region `iad`, 1 CPU shared + 1 GB RAM, force_https
- **Docker** multi-stage (`node:22-slim`), HEALTHCHECK cada 30s
- **CI/CD** vía GitHub Actions: `deploy-fly.yml` + `deploy-railway.yml` (auto-deploy on `main` push)

### Catálogo de Skills z.ai (65 skills)
- **`skills/`** contiene 65 skills del **z-ai-web-dev-sdk** como catálogo de blueprints instruccionales (173 `SKILL.md` totales contando anidados)
- Cubren: media AI (LLM, ASR, TTS, VLM, image-gen, video-gen), web/agent (browser, web-search, coding-agent), documentos (PDF, DOCX, XLSX, PPTX, charts), investigación académica, carrera, aprendizaje, contenido/marketing, finanzas, diseño/UX, bienestar, meta
- No son runtime — son capacidades disponibles para el coding agent

---

## 🏗️ Arquitectura — Pipeline de un turno

```
┌─────────────────────────────────────────────────────────────────────┐
│                       NAVEGADOR / PWA (420px)                        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  TalkOverlay │  │  HomeScreen  │  │    Service Worker        │  │
│  │  (chat)      │  │  (wheel +    │  │    (push + bg sync +     │  │
│  │  + Composer  │  │   widgets)   │  │     offline cache 24h)   │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────────┘  │
│         │                                                            │
│  ┌──────▼──────────────────────────────────────────────────┐        │
│  │           KoruProvider (useReducer + Context)            │        │
│  │  state · 6 pantallas · persistencia dual localStorage +  │        │
│  │  IndexedDB · memory garden (5 stages)                    │        │
│  └──────┬──────────────────────────────────────────────────┘        │
│         │                                                            │
│  ┌──────▼──────────────────────────────────────────────────┐        │
│  │      backendAgentClient (streaming NDJSON fetch)         │        │
│  └──────┬──────────────────────────────────────────────────┘        │
└─────────┼────────────────────────────────────────────────────────────┘
          │ POST /api/koru/turn {input, state, history, model}
          │
┌─────────▼────────────────────────────────────────────────────────────┐
│                    BACKEND NODE (server-bundle.mjs)                  │
│                                                                      │
│  1. buildMessages                                                    │
│     └─ systemPrompt (personalidad + memorias relevantes + records)   │
│     └─ historial (últimos 10 turnos)                                 │
│     └─ LANGUAGE instruction (es/en)                                  │
│                                                                      │
│  2. SemanticRouter (Ollama nomic-embed-text)                         │
│     └─ Decide tool por similitud ANTES del LLM                       │
│                                                                      │
│  3. callProvider (fallback chain)                                    │
│     └─ MiniMax → NVIDIA/Ollama → OpenRouter                          │
│                                                                      │
│  4. executeProviderToolCalls (121+ tools en src/tools/)              │
│     └─ Cada tool respeta: risk / requiresApproval / autoRun          │
│                                                                      │
│  5. detectSimulatedToolCall (compat Qwen3, DeepSeek-R1)              │
│                                                                      │
│  6. Segunda llamada LLM (sin tools) → componse reply JSON            │
│                                                                      │
│  7. structureExtractor — anti-alucinación vs citas literales         │
│  8. enhancementExtractor + enhancementEngine → "+1" contextual        │
│  9. finalizePayload → JSON → NDJSON stream                           │
└─────────┬────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       RESPUESTA (KoruBackendTurnResponse)            │
│                                                                      │
│  {                                                                   │
│    reply, uiBlocks: UiBlock[],                                       │
│    suggestedActions: KoruSuggestedAction[],                          │
│    understanding: {literalRequest, userGoal, unstatedNeeds, ...},    │
│    memoryCandidates: MemoryFact[],      ← el usuario riega/poda      │
│    commitments: Commitment[],                                       │
│    records: LifeRecord[],                                           │
│    toolResults: ToolResult[],                                       │
│    stateEvents: [{kind: thinking|searching|comparing|..., label}],  │
│    provider, model, mascotState, skippedBecauseBoundary             │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Principios clave

1. **Memoria confirmable.** Koru nunca guarda un hecho sin aprobación explícita del usuario. Los `memoryCandidates` se muestran como cards con botones "Regar" / "Poda" / "Archivar".

2. **Boundaries de autonomía.** Cada tool declara su política (`risk`, `requiresApproval`, `autoRun`). Las tools sensibles (gastos, alarmas, envío de mensajes) requieren aprobación explícita. `skippedBecauseBoundary` explica qué no se hizo y por qué.

3. **Anti-alucinación estructural.** El `structureExtractor` valida que todo dato numérico o factual en la respuesta tenga una cita literal en las sources. Si no la tiene, se descarta.

4. **Enhancement "+1".** Tras cada respuesta, el `enhancementEngine` propone una acción contextual como botón clickeable (ej: "¿Agregar esta compra a la lista?"). El usuario decide si la ejecuta. El motor aprende de aceptaciones/rechazos.

5. **Multi-LLM con fallback transparente.** Si NVIDIA cae por rate-limit, propagation. Si cae por otra causa, OpenRouter. Si MiniMax está configurado, va primero. El campo `fallbackReason` explica al usuario qué pasó.

6. **Streaming NDJSON.** Cada turno emite eventos de progreso (`thinking`, `searching`, `comparing`, `planning`, `saving`, `done`) para que la UI muestre qué está haciendo Koru en tiempo real.

---

## 🃏 Las 56 cards Tier-S

Cada respuesta de Koru puede emitir **UiBlocks** — bloques visuales tipados que se renderizan como "hojas" Stitch en mobile 420 px. El sistema **unificado Tier-S** colapsa toda card a un solo molde: `hero + detail + cta + actions + empty`.

### 13 dominios cubiertos

| Dominio | Cards principales |
|---|---|
| **Clima** | `WeatherCard` (ciudad, ahora, rango, lluvia, viento, advice, sources) |
| **Restaurantes** | `RestaurantSynthesisCard` (DeepHungry: 8 fuentes, top coincidencias, pros/cons, síntesis) |
| **Compras** | `ComparisonCard`, `ProductAnalysisCard`, `SmartChecklistCard`, `OutfitCard`, `ReviewScoreCard`, `ReviewDocumentCard`, `ReviewQuoteCard` |
| **Planificación** | `PlanCard`, `PlanTimelineCard` |
| **Consultas personales** | `MemoryCard`, `MoneySummaryCard`, `SavedRecordCard`, `SocialInteractionCard` |
| **Fútbol/Deportes** | `MatchTimelineCard`, `LiveMatchCard` (tabs Stats/Lineups/Timeline), `MatchStatsCard` |
| **Mercados/Finanzas** | `CryptoPortfolioCard`, `MarketCard`, `ForexCard` |
| **Elecciones** | `ElectionResultsCard`, `ElectionVoteCard` |
| **Direcciones/Rutas** | `RouteTimelineCard`, `TransportCompareCard`, `RouteMapCard` |
| **Viajes** | `TravelPlannerCard` |
| **Cumpleaños/Eventos** | `BirthdayCalendarCard`, `BirthdayAlarmCard` |
| **Acciones/Recordatorios** | `AlarmCard`, `UrgentNowCard`, `HealthReminderCard` |
| **Información general/Web** | `ResearchSourcesCard`, `DataCard` |

### La card estrella: `deliverable`

Todo resultado de peso (informe, investigación, análisis) llega como `deliverable`:

- `status: "working" | "ready"` — mientras `working`, UI muestra "Trabajando en tu {kicker}" con progreso **real** (`progress: 0..100`, `phaseLabel: "Buscando fuentes 2/4..."`)
- `kicker, title (UPPER), description, summary, categories[3], metrics[3]`
- `sections[{icon, title, kicker, kind: text|bullets|timeline|grid|rows, paragraphs, bullets, items}]`
- `sources: AssistantSource[]` — siempre con citación verificable

---

## 🛠️ Las 121+ tools reales

Las tools viven en `src/tools/` (59 archivos, 12.390 líneas). Cada una declara `definition` (schema OpenAI function-calling) + `policy` (`risk`, `requiresApproval`, `autoRun`) + `handler`. Distribuidas por dominio:

| Dominio | Ejemplos de tools |
|---|---|
| **Money** | `crypto_price`, `stock_quote`, `currency_convert`, `expense_track`, `expense_summary`, `budget_set`, `budget_check`, `subscription_reminder`, `tax_estimate`, `inflation_data`, `price_compare_product`, `price_history`, `product_review` |
| **Sports** | `match_schedule`, `match_live`, `league_standings`, `team_follow`, `player_stats`, `tennis_atp_wta`, `tennis_live`, `tournament_bracket`, `golf_leaderboard`, `sports_news` |
| **Food** | `recipe_find`, `recipe_by_ingredients`, `recipe_show`, `recipe_save`, `food_info`, `nutrition_calc`, `wine_pairing`, `restaurant_deep_search`, `restaurant_review_aggregate`, `menu_extract` |
| **Travel** | `route_plan`, `route_planner`, `travel_itinerary`, `flight_search`, `flight_track`, `hotel_search`, `transport_nearby`, `currency_atm`, `language_phrase`, `visa_check`, `weather_travel` |
| **Trending/News** | `news_urgent`, `news_urgent_search`, `news_radar_topic`, `news_topic`, `rss_digest`, `rss_subscribe`, `trending_twitter`, `trending_reddit`, `trending_youtube`, `trending_github` |
| **Docs/Tasks** | `task_create`, `task_done`, `task_list`, `reminder_set`, `alarm_set`, `countdown`, `note_write`, `note_show`, `note_search`, `project_create`, `project_add`, `project_show`, `calendar_add`, `calendar_show`, `calendar_export_ics` |
| **Productivity** | `translate`, `summarize_text`, `summarize_url`, `email_draft`, `message_draft`, `extract_action_items`, `deep_research`, `qr_generate`, `copy_to_clipboard`, `lyrics_find`, `sunrise_sunset`, `moon_phase`, `time_zone`, `holidays` |
| **Documents** | `doc_create_md`, `doc_create_word`, `doc_create_excel`, `doc_create_pdf`, `data_analyze`, `data_chart`, `ocr_text` |
| **Knowledge** | `wikipedia_lookup`, `dictionary_define`, `math_calc`, `unit_convert`, `slang_translate`, `memory_save`, `memory_search`, `memory_edit`, `memory_forget`, `memory_garden_show` |
| **Health** | `medication_reminder`, `hydration_remind`, `sleep_track`, `mood_track`, `habit_streak`, `air_quality_advice` |
| **People/Media** | `person_info`, `person_follow`, `person_filmography`, `movie_info`, `book_info`, `game_info`, `image_generate` |
| **Apps** | `app_deals`, `app_recommend`, `game_deals`, `game_recommend` |
| **Weather** | `weather_forecast` (open-meteo) |
| **OCR** | `receiptOCR` (Tesseract.js en cliente) |
| **Calendar** | `googleCalendar` (OAuth flow completo) |

---

## 📁 Estructura del repositorio

```
koru-mvp/
├── index.html                    # PWA entry · fuentes Google asíncronas · SW
├── all-cards-preview.html        # Galería standalone de cards (dev)
├── restaurant-real.html          # Mock pixel-fiel RestaurantSynthesisCard
├── package.json                  # ESM · scripts dev/server/build/test/e2e
├── vite.config.ts                # 1.094 líneas · backend embebido en plugin Vite
├── tsconfig.json                 # ES2023 · strict · verbatimModuleSyntax
├── vitest.config.ts              # jsdom + testing-library
├── playwright.config.ts          # desktop + Pixel 7 mobile
├── Dockerfile                    # Multi-stage node:22-slim · HEALTHCHECK
├── vercel.json                   # rewrites /api/* → koru-mvp.onrender.com
├── railway.toml                  # nixpacks · node server-bundle.mjs
├── fly.toml                      # app=koru-mvp · region=iad · 1cpu/1GB
├── .env.example                  # 5 providers + Ollama + VITE_*
├── .github/workflows/            # deploy-fly.yml + deploy-railway.yml
│
├── src/
│   ├── main.tsx                  # React 19 StrictMode · SW registration
│   ├── style.css                 # 8.292 líneas · Brand Bible · design tokens
│   ├── koru-motion.css           # 39 líneas · motion tokens
│   │
│   ├── domain/                   # 54 archivos · 11.181 líneas — EL CORE
│   │   ├── types.ts              # 1.554 líneas · 56 UiBlock · MascotState · MemoryFact
│   │   ├── store.ts              # 1.318 líneas · reducers · selectRelevantMemories
│   │   ├── soul.ts               # personalidad base
│   │   ├── brain.ts              # smart fallback contextual
│   │   ├── backendAgentClient.ts # POST /api/koru/turn con streaming
│   │   ├── semanticRouter.ts     # router por embeddings (Ollama nomic-embed-text)
│   │   ├── simulatedToolDetector.ts   # compat modelos sin tool-calls
│   │   ├── structureExtractor.ts # anti-alucinación vs citas literales
│   │   ├── enhancementExtractor.ts + enhancementEngine.ts  # "+1" contextual
│   │   ├── heartbeat.ts + heartbeatProactive.ts  # nudges proactivos
│   │   ├── commitments.ts        # alarmas/reminders → commitments reales
│   │   ├── decisionEngine.ts     # decisiones con "voto" claro
│   │   ├── stressEngine.ts + strengthEngine.ts   # carga emocional
│   │   ├── persistence.ts        # localStorage + IndexedDB
│   │   ├── calendar.ts           # Google Calendar
│   │   ├── i18n.ts               # es/en · detectLanguage · buildLanguageInstruction
│   │   ├── offlineCache.ts       # IndexedDB 24h + offline queue
│   │   ├── koruVoice.ts + kimiPrinciples.ts
│   │   ├── memory/               # semanticSearch.ts + embeddings.ts
│   │   ├── schemas/              # matcher, comparison, money, sports, weather, news
│   │   └── 30+ *.test.ts
│   │
│   ├── server/                   # 8.751 líneas — Backend Node
│   │   ├── koruBackend.ts        # 6.460 líneas · runKoruBackendTurn · pipeline completo
│   │   ├── providers/            # nvidia, openrouter, minimax, ollama, fetch, types, index
│   │   ├── tools/                # builtins, types
│   │   ├── logger.ts · json.ts · pdfExport.ts
│   │   └── 6 *.test.ts
│   │
│   ├── tools/                    # 59 archivos · 12.390 líneas — TOOLBOX
│   │   ├── toolbox.ts            # registry: ALL_TOOL_DEFINITIONS + TOOL_BOX map
│   │   ├── types.ts              # defineTool(name, description, parameters)
│   │   ├── apps/ docs/ food/ health/ knowledge/ media/ money/ news/
│   │   ├── ocr/ people/ shopping/ sports/ trending/ utils/ weather/
│   │   ├── calendar/ travel/
│   │   └── shared/               # fetcher, scrapers, cache, rateLimiter, embeddings
│   │
│   └── ui/                       # 30 .tsx + 2 .ts · 27.553 líneas
│       ├── App.tsx               # Root · 6 pantallas (chat|hoy|memoria|permisos|historial|config)
│       ├── KoruProvider.tsx      # 2.330 líneas · Context + useReducer + persistencia dual
│       ├── TalkOverlay.tsx       # 1.645 líneas · Chat principal (composer + stream + cards)
│       ├── HomeScreen.tsx        # wheel principal con widgets
│       ├── MemoryScreen.tsx      # "Mi jardín" — memoria como plantas
│       ├── HistoryScreen.tsx · SettingsScreen.tsx · PermissionsScreen.tsx
│       ├── CollectionsScreen.tsx · PlanRoadmapScreen.tsx · CreateScreen.tsx
│       ├── KoruBackground.tsx    # animación de fondo (orbes, gradientes)
│       ├── KoruMascot.tsx        # 16 estados · MP4s + PNGs
│       ├── KoruIconSprite.tsx    # sprite de iconos
│       ├── Onboarding.tsx        # 3 pantallas: greeting → waiting_for_name → confirm
│       ├── chatCards.tsx         # 808 líneas · dispatcher → KoruUnifiedCard
│       ├── MorningBriefCard.tsx · MemoryGraph.tsx · MemoryToast.tsx
│       ├── MemoryConflictResolver.tsx · BottomNav.tsx · ConfirmDialog.tsx
│       ├── ErrorBoundary.tsx · IconGallery.tsx · DevCardPreview.tsx
│       ├── NotificationManager.tsx · TypingDots.tsx · AnimatedIcon.tsx
│       ├── WorkoutSession.tsx · MeditationOverlay.tsx
│       ├── adapters.ts · audit.ts
│       ├── home/WidgetCards.tsx + homeWidgets.ts
│       └── cards/
│           ├── PlanHeroCard.tsx
│           └── unified/          # El molde unificado Tier-S
│               ├── presentation.ts     # 5.864 líneas · 51 mapper functions
│               ├── KoruUnifiedCard.tsx # 1.071 líneas · hero sheet
│               ├── KoruDetailScreen.tsx # 1.702 líneas · 8 section kinds
│               ├── DeliverableCard.tsx # card estrella (informes, análisis)
│               ├── CardSkeleton.tsx · CardError.tsx
│               ├── CookingMode.tsx · PriceHistoryChart.tsx
│               ├── KoruCountUp.tsx     # rAF + easeOutExpo
│               ├── useTapRipple.ts     # ripple magnético al tap
│               └── 3 *.test.tsx
│
├── server-prod.ts                # HTTP Node nativo · 133 líneas · /api/koru/turn + /api/koru/models
├── server-simple.mjs             # estático + proxy API · 122 líneas
├── server-bundle.mjs             # esbuild output · 14.443 líneas (produción)
│
├── public/                       # 71 assets
│   ├── manifest.json · favicon.svg · sw.js
│   ├── icons.svg                 # sprite de iconos
│   ├── koru-states/              # 4 MP4 + 11 PNG (16 estados de mascota)
│   ├── stitch/                   # ilustraciones (plan-bg, chat-bg, roadmap-hero)
│   ├── stitch-ref/               # referencias de diseño
│   └── 10 HTML standalone (guias, informes, tests e2e)
│
├── skills/                       # 65 skills del catálogo z.ai SDK (173 SKILL.md)
│   ├── ASR · LLM · TTS · VLM · image-edit · image-generation · image-search
│   ├── agent-browser · web-reader · web-search · coding-agent · fullstack-dev
│   ├── pdf · docx · xlsx · pptx · charts
│   ├── aminer-* · market-research-reports · contentanalysis
│   ├── interview-prep · resume-builder · jd-resume-tailor · job-intent-tracker
│   ├── quiz-mastery · study-buddy · cheat-sheet · writing-plans
│   ├── blog-writer · seo-content-writer · content-strategy · podcast-generate
│   ├── finance · stock-analysis-skill
│   ├── design/ (con 40+ brand refs: Apple, Stripe, Linear, Vercel, Notion...)
│   ├── mindfulness-meditation · dream-interpreter · gift-evaluator
│   ├── skill-creator · task-review · version-management
│   └── ai-news-collectors · skill-finder-cn · gaokao-*
│
├── finetune/                     # Fine-tuning de koru-qwen-27b
│   ├── README.md                 # workflow: schemas → dataset → train → eval → export
│   ├── Modelfile.koru-qwen       # Ollama Modelfile
│   ├── koru-tools.json           # 121 tool definitions para el LLM
│   ├── koru-builtin-tools.json   # tools builtin del motor
│   ├── koru-uiblock-types.json   # 56 tipos de UiBlock soportados
│   ├── koru-dataset-v1.jsonl     # dataset sintético
│   ├── extract-koru-schema.ts    # extrae schemas del código TS
│   ├── generate-dataset.ts       # genera dataset
│   ├── train-qwen-koru.py        # Unsloth + LoRA (24GB VRAM Q4)
│   ├── eval-qwen-koru.py         # evaluación de calidad
│   └── export-to-ollama.sh       # export a GGUF + Ollama
│
├── scripts/                      # 33 scripts de operación y QA
│   ├── start-koru.sh · restart-koru.sh · keep-koru-alive.sh
│   ├── koru-bug-hunt.mjs · koru-quality-test.mjs · koru-quality-v2.mjs
│   ├── koru-probe.mjs · koru-memory-test.mjs · koru-batch.mjs
│   ├── screenshot-card.mjs · screenshot-all-cards.mjs
│   ├── gen_funcionalidades.py · gen_cards_catalog.py
│   ├── inline_images.py · convert_videos.sh
│   ├── test-model-router.py · validate-tools.ts
│   └── minimax-oauth.ts
│
├── tests/
│   ├── e2e/koru.spec.ts          # 404 líneas · 13 tests Playwright
│   ├── agents/                   # framework de evaluación (6 archivos)
│   └── smoke-restaurant.test.ts
│
├── docs/
│   ├── auditoria/                # 9 docs · auditoría completa del código
│   │   ├── 01-arquitectura-y-stack.md
│   │   ├── 02-capas-del-codigo.md
│   │   ├── 03-ui-y-experiencia.md
│   │   ├── 04-seguridad-rendimiento-testing.md
│   │   ├── 05-bugs-y-deuda-tecnica.md
│   │   ├── 06-conclusiones.md
│   │   ├── 07-plan-100-tools-gratuitas.md
│   │   ├── 08-catalogo-tools-cotidianas.md
│   │   └── 09-arquitectura-toolbox.md
│   ├── MASTER_CARD_INVENTORY.md  # 959 líneas · 51 cards auditadas + 10 propuestas
│   ├── MICIDETAILS_MANIFESTO.md  # 110 microdetalles · WCAG ratios medidos
│   ├── PLAN_PROACTIVIDAD.md · PLAN_ROUTER_LLM.md
│   ├── ARQUITECTURA_PRESENTACION_ADAPTATIVA.md
│   ├── UI_AUDIT_REDESIGN_SPEC.md
│   └── superpowers/plans/        # 3 planes de mejora
│
├── SUMMARY.md                    # Resumen visual + operativo · commits v1→v11
├── CARD_CATALOG.md               # Mapeo UiBlock → componente (13 dominios)
├── KORU_MOTION_CATALOG.md        # 1.615 líneas · 36 animaciones Tier-S
├── DEPLOY.md                     # Guía Railway / Fly.io / Docker / local
├── worklog.md                    # Bitácora de Sprints
├── koru-integrations.json        # OAuth integrations state (Google Calendar)
└── .kimchi/docs/verification.md  # Reporte estabilización: 287 tests pass
```

---

## 🚀 Setup local

### Requisitos

- **Node.js 22+**
- **npm** o **bun**
- **Ollama** (opcional, para Semantic Router + modelos locales) — https://ollama.com
- Al menos **1 API key** de LLM provider (NVIDIA / OpenRouter / MiniMax)

### Paso a paso

```bash
# 1. Clonar
git clone https://github.com/Arx88/koru-mvp.git
cd koru-mvp

# 2. Instalar dependencias
npm install
# o
bun install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys:
#   NVIDIA_API_KEY=nvapi-...        (recomendado, default provider)
#   OPENROUTER_API_KEY=sk-or-...    (fallback)
#   MINIMAX_ACCESS_TOKEN=...        (opcional)
#   BLUESMINDS_API_KEY=...          (opcional)
#
# Opcionales para Ollama local:
#   OLLAMA_EMBED_BASE_URL=http://127.0.0.1:11434
#   VITE_OPEN_MODEL_BASE_URL=/ollama/v1
#   VITE_OPEN_MODEL_API_KEY=ollama
#   VITE_OPEN_MODEL_MODEL=llama3.1

# 4. Levantar dev server (backend embebido en Vite)
npm run dev
# App en http://localhost:5173

# 5. (Opcional) Levantar server backend por separado
npm run server    # http://localhost:3000

# 6. (Opcional) Levantar Ollama con modelos recomendados
ollama pull nomic-embed-text    # embeddings para Semantic Router
ollama pull qwen3:32b           # modelo local opcional
```

### Variables de entorno — regla crítica

```
Server-side only (SIN prefijo VITE_):
  NVIDIA_API_KEY, OPENROUTER_API_KEY, MINIMAX_ACCESS_TOKEN, BLUESMINDS_API_KEY
  → visibles SOLO en el backend

Client-side (CON prefijo VITE_):
  VITE_OPEN_MODEL_BASE_URL, VITE_OPEN_MODEL_API_KEY, VITE_OPEN_MODEL_MODEL
  → se incrustan en el bundle del cliente y son públicas
  → NUNCA poner API keys secretas acá
```

---

## 🧪 Tests

### Tests unitarios (Vitest)

```bash
npm test            # una vez
npm run test:watch  # modo watch
```

Cobertura: **287 tests pasando / 0 fallando / 39 skipped** distribuidos en 28 archivos.

### Tests E2E (Playwright)

```bash
# Requiere dev server corriendo en :5173 (Playwright lo levanta solo)
npx playwright test

# Modo UI interactivo
npx playwright test --ui

# Solo desktop
npx playwright test --project=desktop

# Solo mobile (Pixel 7)
npx playwright test --project=mobile
```

Cobertura: **13 tests** en `tests/e2e/koru.spec.ts` con 2 proyectos (Desktop Chrome + Pixel 7 mobile).

### Framework de evaluación de agentes

```bash
node tests/agents/eval-smoke-test.mjs   # smoke test rápido
node tests/agents/eval-reduced.mjs      # suite reducida
node tests/agents/eval-ux-20.mjs        # suite UX de 20 criterios
```

---

## 🌐 Deploy

### Opción 1 — Vercel + Render (frontend + backend separados)

El repo ya está configurado para esto. Frontend en Vercel, backend en Render.

**Frontend (Vercel)**:
```bash
npm i -g vercel
vercel --prod
# vercel.json ya rewrites /api/* → koru-mvp.onrender.com
```

**Backend (Render)**:
- Conectá el repo en Render → New Web Service
- Build Command: `npm run build && npx esbuild server/index.ts --bundle --platform=node --format=esm --outfile=server-bundle.mjs --external:z-ai-web-dev-sdk --external:playwright`
- Start Command: `node --max-old-space-size=512 server-bundle.mjs`
- Health Check: `/api/health`
- Configurar env vars: `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, etc.

### Opción 2 — Railway

```bash
npm i -g @railway/cli
railway login
railway init        # seguir prompts
railway up          # deploy

# Configurar secrets:
railway variables set NVIDIA_API_KEY=nvapi-...
railway variables set OPENROUTER_API_KEY=sk-or-...
```

`railway.toml` ya configurado con `nixpacks` builder + healthcheck `/api/health`.

### Opción 3 — Fly.io

```bash
# Instalar flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch         # primera vez (fly.toml ya existe, responder a prompts)
fly secrets set NVIDIA_API_KEY=nvapi-...
fly secrets set OPENROUTER_API_KEY=sk-or-...
fly deploy
```

Configurado: 1 CPU shared, 1 GB RAM, region `iad`, force_https, min_machines_running 1.

### Opción 4 — Docker

```bash
# Build
docker build -t koru-mvp .

# Run
docker run -d \
  -p 3000:3000 \
  -e NVIDIA_API_KEY=nvapi-... \
  -e OPENROUTER_API_KEY=sk-or-... \
  --name koru \
  koru-mvp

# Healthcheck
curl http://localhost:3000/api/health
```

`Dockerfile` multi-stage con `node:22-slim`, HEALTHCHECK cada 30s vía `/api/health`.

### Opción 5 — Local production (sin Docker)

```bash
npm run build
npx esbuild server/index.ts \
  --bundle --platform=node --format=esm \
  --outfile=server-bundle.mjs \
  --external:z-ai-web-dev-sdk --external:playwright

NVIDIA_API_KEY=nvapi-... \
  node --max-old-space-size=512 server-bundle.mjs
```

---

## 🤖 Fine-tuning de Koru-Qwen (opcional)

Koru viene con un pipeline de fine-tuning para tener un modelo local propio basado en Qwen 27B. El directorio `finetune/` incluye:

| Archivo | Función |
|---|---|
| `extract-koru-schema.ts` | Extrae los 121 tool definitions + 56 UiBlock types del código TS |
| `generate-dataset.ts` | Genera dataset sintético en formato JSONL |
| `koru-dataset-v1.jsonl` | Dataset final listo para entrenar |
| `train-qwen-koru.py` | Script Unsloth + LoRA (requiere 24 GB VRAM, Q4 quantization) |
| `eval-qwen-koru.py` | Evaluación de calidad del modelo entrenado |
| `export-to-ollama.sh` | Exporta a GGUF y carga en Ollama |
| `Modelfile.koru-qwen` | Ollama Modelfile para `koru-qwen-27b` |

**Workflow:**

```bash
cd finetune

# 1. Extraer schemas del código
npx tsx extract-koru-schema.ts

# 2. Generar dataset sintético
npx tsx generate-dataset.ts

# 3. Entrenar (requiere GPU 24GB)
python train-qwen-koru.py

# 4. Evaluar
python eval-qwen-koru.py

# 5. Exportar a Ollama
bash export-to-ollama.sh

# 6. Configurar Koru para usar el modelo local
# En .env:
#   OLLAMA_EMBED_BASE_URL=http://127.0.0.1:11434
# Y en Ajustes → Modelo, seleccionar "koru-qwen-27b:latest"
```

---

## 🎨 Brand & Motion System

### Brand Bible (`src/style.css` — 8.292 líneas)

| Token | Valor |
|---|---|
| `--koru-purple` | `#8363f9` (morado unificado, antes 3 distintos) |
| `--koru-purple-dark` | `#523a9e` |
| `--koru-purple-deep` | `#382b8c` |
| `--koru-cream` | `#f6f3fe` |
| Background base | `#FCFCFA` |
| Cards | blanco con `card-shadow: 0 4px 20px rgba(0,0,0,.03)` |
| Tipografía display | Bricolage Grotesque (600-800) |
| Tipografía body | Plus Jakarta Sans (400-800) |
| Tipografía mono | JetBrains Mono / Fira Code |
| Iconografía | Material Symbols Outlined (opsz 24, wght 400) |
| Radii | sm 8 / md 12 / lg 16 / xl 20 / full |
| Max width | 420 px (mobile-first) |

### Motion tokens (`KORU_MOTION_CATALOG.md` — 1.615 líneas)

**4 easings:**
- `--koru-spring` (overshoot sutil)
- `--koru-out` (deceleración natural)
- `--koru-in-out` (simétrico)
- `--koru-soft` (curva Stripe)

**5 durations:**
- `--t-instant` 120ms (taps)
- `--t-quick` 200ms (hovers)
- `--t-entrance` 500ms (entradas)
- `--t-ambient` 4s (loops)
- `--t-cinematic` 800ms (transiciones hero)

**36 animaciones production-ready:** breathe, pulse dot, bar pop, shine sweep, arrow pulse, ring pulse, count up, glow, typing bounce, indeterminate, shimmer, star pop, aurora, tilted card, magnetic, scrambled text, gradient text, spotlight card...

**Accesibilidad:** `@media (prefers-reduced-motion: reduce)` override global — todo pasa a instant 0.001ms.

---

## 🎭 Mascota — 16 estados

Koru se renderiza como una mascota con 16 estados emocionales que reflejan lo que está pasando:

| Estado | Cuándo aparece |
|---|---|
| `idle` | Esperando input |
| `thinking` | Procesando mensaje |
| `working` | Ejecutando tools |
| `happy` | Respuesta exitosa |
| `tired` | Muchos turnos seguidos |
| `sleeping` | Inactividad prolongada |
| `mistake` | Error o tool falló |
| `planning` | Generando un plan |
| `product-search` | Buscando productos |
| `building` | Construyendo algo complejo |
| `cooking` | Modo cocina activo |
| `thinking-2` | Reflexión profunda |
| `celebrating` | Logro desbloqueado |
| `worried` | Algo sensible detectado |
| `affectionate` | Tono cálido |
| `curious` | Pregunta aclaratoria |

Assets en `public/koru-states/` (4 MP4 animados + 11 PNG).

---

## 📊 Estadísticas del proyecto

| Métrica | Valor |
|---|---|
| **Líneas TS/TSX en `src/`** | ~64.000 |
| **Líneas CSS (Brand Bible)** | 8.292 |
| **Archivos en `src/`** | 196 (30 son tests) |
| **Components React** | 30 |
| **Cards Tier-S** | 56 variantes (51 mapper functions) |
| **Tools reales** | 121+ |
| **Skills z.ai en catálogo** | 65 (173 SKILL.md) |
| **Tests unitarios (Vitest)** | 287 pass / 0 fail / 39 skipped |
| **Tests E2E (Playwright)** | 13 (desktop + mobile) |
| **Commits en main** | 454 |
| **Duración del proyecto** | 28 días (19 jun → 17 jul 2026) |
| **Deploy targets soportados** | 5 (Vercel+Render, Railway, Fly, Docker, local) |
| **Proveedores LLM soportados** | 5 (NVIDIA, OpenRouter, MiniMax, Ollama, BlueSminds) |
| **Animaciones Tier-S** | 36 |
| **Idiomas soportados** | 2 (es, en) |

---

## 📜 Documentación adicional

El repo incluye documentación extensa más allá de este README:

| Documento | Contenido |
|---|---|
| [`SUMMARY.md`](SUMMARY.md) | Resumen visual + operativo · commits de diseño v1→v11 |
| [`CARD_CATALOG.md`](CARD_CATALOG.md) | Mapeo UiBlock → componente (13 dominios) |
| [`KORU_MOTION_CATALOG.md`](KORU_MOTION_CATALOG.md) | 1.615 líneas · 36 animaciones Tier-S con research |
| [`DEPLOY.md`](DEPLOY.md) | Guía detallada Railway / Fly.io / Docker / local |
| [`worklog.md`](worklog.md) | Bitácora de Sprints (i18n, offline cache, PDF export, Tier-S audit) |
| [`docs/MASTER_CARD_INVENTORY.md`](docs/MASTER_CARD_INVENTORY.md) | 959 líneas · auditoría de 51 cards + 10 propuestas |
| [`docs/MICRODETAILS_MANIFESTO.md`](docs/MICRODETAILS_MANIFESTO.md) | 110 microdetalles · WCAG ratios medidos |
| [`docs/auditoria/`](docs/auditoria/) | 9 docs de auditoría completa del código |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | 3 planes de mejora a futuro |
| [`.kimchi/docs/verification.md`](.kimchi/docs/verification.md) | Reporte de estabilización (287 tests pass) |

---

## 🔒 Seguridad y privacidad

### Local-first

- Los datos del usuario viven en **localStorage** y **IndexedDB** del navegador
- El backend **NO persiste** datos del usuario entre sesiones (stateless)
- La cola offline se guarda en IndexedDB y se replay al reconectar
- El Service Worker cachea respuestas 24h para funcionamiento offline

### Boundaries de autonomía

Cada tool declara su política:

```ts
{
  risk: "low" | "medium" | "high",
  requiresApproval: boolean,
  autoRun: boolean
}
```

Las tools con `requiresApproval: true` muestran una card de confirmación al usuario antes de ejecutarse. Las tools con `risk: "high"` NUNCA son `autoRun`. El campo `skippedBecauseBoundary` explica al usuario qué no se hizo y por qué.

### Memoria confirmable

Los `memoryCandidates` nunca se guardan automáticamente. El usuario debe hacer click en "Regar" (confirmar) para que pasen a `confirmed`. Los `rejected` se archivan. Los `sensitive` (salud, finanzas, relaciones) tienen tratamiento especial con `editHistory` y diff visible.

### Variables de entorno

```
Server-side only (SIN VITE_):
  → API keys de LLM providers, NO visibles en el cliente

Client-side (CON VITE_):
  → URLs de proxies, flags, configuraciones públicas
  → NUNCA API keys secretas
```

### Permissions screen

La pantalla "Permisos" muestra explícitamente al usuario qué puede y qué no puede hacer Koru, con toggles para revocar consentimiento en cualquier momento.

---

## 🛣️ Roadmap

Koru está diseñado por fases. El estado actual corresponde a la **fase MVP estabilizada**.

### Fases de la mascota (memory garden)

```
seed → sprout → roots → born → garden
 └── Etapa actual: garden (memoria confirmable + edición + diff)
```

### Próximas fases planificadas

| Fase | Nombre | Estado | Highlight |
|---|---|---|---|
| **F1** | MVP Estabilizado | ✅ Done | 287 tests pass · 56 cards · 121 tools · 5 LLM providers |
| **F2** | Personalización | 🚧 Plan | Voice preferences (cálida / directriz / humor ajustable) · Learning preferences model |
| **F3** | Proactividad avanzada | 📋 Plan | Heartbeat con nudges contextuales (clima, tráfico, medicación, resultados) |
| **F4** | Multi-dispositivo | 📋 Plan | Sync opcional cifrada entre dispositivos |
| **F5** | Koru-Qwen 27B local | 📋 Plan | Fine-tuning propio (pipeline en `finetune/`) · 100% offline |

Ver [`docs/superpowers/plans/`](docs/superpowers/plans/) para detalles.

---

## 🤝 Filosofía de diseño

> _"Se siente como un compañero. Funciona como un operador. Respeta como un amigo."_

Koru fue diseñado con 5 principios no negociables:

1. **Memoria confirmable.** El usuario es el único dueño de su memoria. Koru propone, el usuario decide.
2. **Boundaries explícitas.** Koru nunca hace algo sensible sin aprobación. Y siempre explica qué no hizo y por qué.
3. **Anti-alucinación estructural.** Todo dato en una respuesta debe tener una cita literal verificable. Si no la tiene, no se incluye.
4. **Enhancement "+1".** Koru no solo responde — propone la próxima acción relevante como botón clickeable. El usuario decide si la ejecuta.
5. **Personalidad calibrada.** Cálido pero directriz. No empalagoso. No convierte todo a plan. Respeta el estado emocional del usuario (stressEngine + strengthEngine).

---

## 📜 Licencia

Uso privado. Código propiedad de Arx88.

Las skills en `skills/` son catálogo del **z-ai-web-dev-sdk** y mantienen sus propias licencias (propietarias Z.AI o MIT según el caso).

---

## 🙋 Créditos

**Koru MVP** · 2026

- Diseño & producto: Arx88
- Stack: React 19 · Vite 8 · TypeScript 6 · Tailwind 4 · Node 22
- LLMs: NVIDIA Nemotron-3-Ultra · MiniMax · OpenRouter · Ollama
- Mascota: 16 estados · MP4 + PNG
- Motion: 36 animaciones Tier-S · CSS puro · `tw-animate-css`
- Tests: 287 unitarios (Vitest) + 13 E2E (Playwright)

---

<div align="center">

**¿Encontraste un bug? ¿Querés contribuir?**

Abrí un issue en [GitHub Issues](https://github.com/Arx88/koru-mvp/issues)

---

🌱 **Koru · local-first · mobile 420px · stage: garden** 🌱

</div>
