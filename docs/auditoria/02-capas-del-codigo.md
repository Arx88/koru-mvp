# Koru — 02. Las capas del código, archivo por archivo

> **Profundidad:** qué hace cada módulo, sus exports clave y observaciones técnicas directas.

---

## 1. Infraestructura y configuración

### `vite.config.ts` (~952 líneas)
**Propósito:** Define el dev-server y los 4 middlewares de backend. NO solo bundling: es el corazón del backend en desarrollo.

**Plugins definidos (orden de registro importa):**
1. `koruBackendAgent(env)` → `/api/koru/turn` (turno del agente con streaming NDJSON + log a `logs/koru-turns.jsonl`), `/api/koru/models` (lista de modelos, con detección de Ollama via `/api/tags`).
2. `koruAiProxy(env)` → `/koru-ai/*` proxy OpenAI-compatible con fallback NVIDIA→OpenRouter (carrera de keys y modelos).
3. `koruWebProxy(env)` → `/koru-web/search` búsqueda web multi-proveedor con cascada: Open-Meteo/OSRM/GDELT/SearXNG/NewsAPI/GNews/Brave/Serper/Tavily + fallback Playwright (navegación headless de DuckDuckGo/Bing).
4. `koruAuditLogger()` → `/koru-audit/log` append a `manual-audits/koru-current.jsonl`.

**Helpers clave:** `collectOpenRouterKeys/Models`, `parseOpenMeteoLocation` (ciudades hardcoded), `queryGdelt/Brave/Serper/Tavily/NewsApi/GNews/SearXng/OsrmRoute`, `queryPlaywrightSearch` (usa `chromium.launch({headless:true})`), `prepareJsonBody` (strips `plugins/reasoning/response_format` para NVIDIA), `fallbackSearchSources` (enlaces manuales a Google como último recurso).

**Observaciones:**
- **Bug puerto inconsistente:** Vite declara `port: 5200` pero Playwright apunta a `5173`. Los tests sobreviven porque `--port 5173` se pasa por flag en `webServer.command`, pero es confuso.
- **Playwright en el dev-server:** importación dinámica `await import("playwright")` dentro del middleware de búsqueda. Si Playwright no está instalado, el catch silencioso lo traga. Es una dependencia oculta.
- **Hardcoded user-agent** con `KoruLocalBrowser/1.0` para scraping.
- **Ciudades climáticas hardcoded** (`madrid`, `barcelona`, `buenos aires`, `cordoba argentina`, `new york`, `miami`, `san francisco`). Fuera de esa lista, Open-Meteo geocoding vía `geocodeCity` en `koruBackend.ts` lo resuelve dinámicamente.
- **`response-healing` plugin** de OpenRouter activado: intenta reparar JSON roto del modelo.

### `tsconfig.json`
TS estricto-ish pero **sin `strict: true`** explícito (solo checks individuales). `allowImportingTsExtensions` + `verbatimModuleSyntax` requiere imports type-only explícitos.

### `playwright.config.ts`
`timeout 30s`, `trace retain-on-failure`, proyectos Desktop Chrome + Pixel 7. `webServer` arranca `npm run dev -- --host 127.0.0.1 --port 5173` con timeout 120s.

### `package.json`
Ver documento 01. Scripts: `dev`, `build` (`tsc && vite build`), `test` (vitest run), `e2e` (playwright test). Sin `lint` ni `format`.

### `.env`
**⚠️ RIESGO DE SEGURIDAD:** contiene una API key real de FreeLLMAPI en texto plano (`VITE_FREELLMAPI_API_KEY=freellmapi-...`). Al tener prefijo `VITE_` se expone al bundle del cliente. No hay `.env.example`. Variables presentes: `VITE_FREELLMAPI_*` (3), `VITE_OPEN_MODEL_*` (4), `NVIDIA_*` (3), `OPENROUTER_*` (3).

### `src/main.tsx`
Punto de entrada React 19 con `StrictMode`. Renderiza `<App />`.

### `index.html`
HTML mínimo, `lang="es"`, carga Material Symbols Outlined desde Google Fonts. Script con `?v=2` cache-buster manual.

### `src/style.css`
Hoja con tokens de design system (`forest`, `moss`, `bark`, `sand`, `cream`, `blush`, etc.), clases semánticas tipo BEM (`koru-chat-shell`, `koru-turn-bubble`, `glass-card`), keyframes de animación (`koru-progress-indeterminate`, `animate-breathe`). Convive con utilidades Tailwind de las pantallas → doble piel de estilos.

### `src/lib/utils.ts`
Solo `cn()` (clsx + tailwind-merge). 7 líneas.

### `src/test/setup.ts`
Importa `@testing-library/jest-dom/vitest`. 1 línea.

---

## 2. Capa `src/server/` (backend embebido)

### `src/server/koruBackend.ts` (~3.165 líneas) — EL MOTOR
**Propósito:** Orquesta un turno completo del agente. Es el archivo más grande y complejo del proyecto.

**Tipos exportados:** `ProviderConfig`, `KoruBackendTurnRequest`, `KoruUnderstanding`, `KoruSuggestedAction`, `KoruBackendTurnResponse`, `blocksFromToolResults`, `runKoruBackendTurn`.

**Definición de tools (`TOOL_DEFINITIONS`):** 9 herramientas OpenAI-function-style en español:
`weather`, `web_search`, `shopping_compare`, `plan_day`, `query_personal_context`, `save_memory`, `save_personal_item`, `deliver_response` (final). Las descripciones son extensas y enumeran variantes léxicas para ayudar al LLM.

**Llamada a proveedores:**
- `callMinimax`: formatea tool results a texto plano (MiniMax no soporta role `tool` nativo), `reasoning_split:true`, temperatura 0.25.
- `callNvidia`: si baseUrl incluye `:11434` → usa endpoint Ollama `/api/chat` con `format:"json"`; si no, OpenAI-compat con timeout 20s.
- `callOpenRouterCandidate` + `callOpenRouter`: **carrera `Promise.any`** hasta 3 keys × 3 modelos.
- `callProvider`: orquesta MiniMax→NVIDIA→OpenRouter con propagación de rate-limit.

**Tools ejecutoras:** `getWeather` (Open-Meteo con `geocodeCity`), `runSearch` (DuckDuckGo HTML + GDELT + scraping con `fetchPageContent`), `planFromState`, `localReminderFromArgs`, `localAlarmFromArgs`, `queryPersonalContextFromState` (matching léxico sobre records), `memoryCaptureFromArgs`, `personalCaptureFromArgs`.

**Parsing defensivo de JSON del LLM:** `safeJsonParse`, `extractJsonBlock` (parser manual con tracking de llaves/strings), `safeJsonObjectFromContent` (3 niveles: directo, extracto de bloque, regex campo a campo), `cleanReplyText`. Muy robusto ante respuestas malformadas.

**Semantic Router (singleton):** `routerSingleton`, `getRouter`, `buildEmbedFn` (Ollama `/api/embeddings`). Decide intención antes del LLM y ejecuta tools sintéticas.

**`systemPrompt`:** Personalidad Koru (cálido/directo según `voicePreference`), reglas de voz, anti-alucinación ("Nunca inventes datos", "status failed → no inventes"), regla CRÍTICA de ciudad → memory profile, inventario de tipos de `UiBlock` válidos. El LLM debe responder `{reply, uiBlocks:[], mascotState}`.

**`runKoruBackendTurn` (entrada principal):**
1. Override de modelo si viene en request.
2. `buildMessages` (system + historial 10 + user).
3. Semantic Router (si input ≥ 3 chars).
4. Si router detecta tool → ejecuta + segunda llamada.
5. Si no, `callProvider` con tools (excepto inputs triviales).
6. Si tool-calls nativos → `executeProviderToolCalls` + segunda llamada compositora.
7. Si tool-call simulada en texto → `detectSimulatedToolCall` + ejecuta.
8. Si nada → parse directo del JSON.

**Observaciones:**
- **Código duplicado:** `stateSummary` (lín. 1697 y 1740) y `systemPrompt` (lín. 1735 y 1778) están **definidos dos veces** idénticamente. TS no se queja porque la segunda silencia a la primera por hoisting, pero es clara duplicación por descuido.
- **`extractorCtx = undefined` hardcoded** en `executeProviderToolCalls` (lín. 2622) con comentario explicando que el `data_card` está desactivado porque MiniMax serializa requests concurrentes. Hay código muerto para un futuro diferido.
- **Logs verbosos:** `logger.info/warn/error` por casi cada paso, con previews truncados. Útil para debug, ruidoso en producción.
- **`as any` en `parsed`** en varios sitios: pierde type-safety en el parseo del LLM.

### `src/server/logger.ts`
`@ts-nocheck` (⚠️). Logger append-only a `logs/koru-backend.log` en JSON-lines + mirror a consola. `dump(value, maxLen)` serializa y trunca. Niveles DEBUG/INFO/WARN/ERROR. Fallos de escritura silenciados.

### `src/server/koruBackend.test.ts` (~115 líneas)
Tests unitarios mínimos: parsers (`cleanText`, `extractJsonBlock`, `safeJsonObjectFromContent`), `timeFromText`, normalizadores. Cobertura parcial del motor.

---

## 3. Capa `src/domain/`

### `src/domain/types.ts` (618 líneas)
**Tipos centrales del sistema.** Define el modelo de datos completo:
- Etapas: `KoruStage = seed|sprout|roots|born|garden`.
- `MemoryKind` (9 tipos), `MascotState` (16 estados), `LifeDomain` (8), `LifeRecordKind` (16), `BrainProvider` (5).
- Entidades: `MemoryFact`, `Commitment`, `LifeRecord`, `DailyEntry`, `EnergyEvent`, `ProactiveNudge`, `CalendarEvent`, `ModelCall`, `AssistantAction`.
- `KoruState` (verdad única), `KoruAnalysis`, `KoruConversationMessage`.
- **`UiBlock`** (unión discriminada de **15 tipos**: `clarifying_question`, `weather`, `alarm`, `reminder`, `shopping_list`, `plan`, `comparison`, `research_sources`, `money_summary`, `saved_record`, `activity_group`, `proactive_signal`, `resource_bundle`, `web_nav`, `data_card`). Muy completo.
- `ToolCall` (9 tools), `ToolResult`, `ToolPolicy`, `RouterResult`, `ComposerResult`.
- `VALID_MASCOT_STATES` exportado como const (validación runtime).

**Observación:** bien diseñado, tipos estrictos. El `UiBlock` discriminado facilita el rendering seguro en `chatCards.tsx`.

### `src/domain/store.ts` (~914 líneas)
**Estado y reducers.** Funciones puras que mutan `KoruState` inmutablemente.

**Exports clave:**
- `createInitialState`, `loadState`, `loadPersistedState`, `saveState`, `resetState`.
- `stageFor` (cálculo de etapa por energía + memorias confirmadas + entries).
- `submitReflection` (punto de entrada del motor legacy: llama `analyzeReflection`).
- Mutadores: `confirmMemory`, `rejectMemory`, `updateMemoryText`, `toggleMemorySuggestions`, `completeCommitment`, `rejectAction`, `approveAndExecuteAction`, `dismissNudge`, `updateUserName`, `addOnboardingMemories`, `updateVoicePreference`, `toggleEphemeralMode`, `setDurableMemoryEnabled`, `setHeartbeatEnabled`, `setWorldSignalsEnabled`, `updateRuntimeSettings`, `addCalendarEvents`, `removeCalendarEvent`, `applyHeartbeatNudges`, `recordModelCall`.
- `exportState`/`importState` (backup/restore JSON).
- `selectRelevantMemories` (matching léxico sobre memorias confirmadas).

**`normalizeState`:** mergea estado persistido con defaults, migra `useForSuggestions`, deduplica commitments con `dueAt` calculado, sobreescribe runtime desde env vars.

**Observación:** función `saveEphemeralSessionSnapshot` preserva memorias/datos del estado anterior cuando se activa modo efímero — diseño cuidado de privacidad.

### `src/domain/persistence.ts` (102 líneas)
IndexedDB + localStorage dual. DB `koru-local-first`, store `state`, key `current`. Transacciones con manejo de error. `LEGACY_STORAGE_KEY = "koru.mvp.state.v1"`.

**Observación:** escritura síncrona en localStorage con `try/catch` silencioso (cuota llena se ignora). Bien para best-effort pero el usuario no se entera de pérdida de datos.

### `src/domain/calendar.ts` (114 líneas)
Parser ICS completo: `unfoldIcs` (manejo de line-folding), `unescapeIcsText`, `parseIcsDate` (formato `YYYYMMDDTHHMMSS[Z]`), `parseIcsEvents`, `createManualCalendarEvent`, `upcomingCalendarEvents`. Limpio y correcto.

### `src/domain/time.ts` (92 líneas)
`recurrenceFromText`, `dueAtFromText` (manaña/hoy/en N horas/recurrencia), `nextDueAtFromRecurrence`, `dueLabel` (etiquetas en español: "hoy 09:00", "mañana ..."). Usa `foldAccents`.

**Bug menor:** `dueAtFromText` con "hoy" si la hora ya pasó suma `+1` hora sin validar cruce de medianoche; `setHours(getHours()+1)` podría pasar al día siguiente de forma imprevista en casos borde.

### `src/domain/web.ts` (106 líneas)
`runWebNavigation`: POST a `/koru-web/search`, normaliza modo por heurística léxica, deconstruye snippets de clima en `summaryItems`. `webResultToPayload` adapta a `AssistantActionPayload`. Cliente del web-proxy.

### `src/domain/speech.ts` (85 líneas)
STT (Speech-to-Text) vía Web Speech API. `getSpeechSupport`, `createSpeechSession` (lang es-ES, interimResults). No hay TTS en el código actual (a pesar de que docs antiguas mencionan ElevenLabs `/api/tts` — ese endpoint no existe en `vite.config.ts` actual).

### `src/domain/soul.ts` (152 líneas)
**Personalidad y voz de Koru.** `koruSoulCapsule` con identidad, `forbiddenPhrases` (8 frases tóxicas prohibidas: "te extrane", "no me abandones", "soy la unica persona que te entiende", etc.). `sanitizeKoruVoice` las reemplaza. `renderKoruResponse` **DEPRECATED** (solo fallback último).

**Bug ortográfico:** lín. 116 y 142 escriben "Ate cabos" (sin tilde); debería ser "Até cabos". Expuesto al usuario.

### `src/domain/commitments.ts` (134 líneas)
Tokenización de títulos de tareas: `ACTION_ALIASES`, `STOP_WORDS`, `canonicalDueHint`, `canonicalCommitmentCore` (normaliza "llamar al proveedor X" → "contactar proveedor"), `commitmentIdentityKey`, `mergeDueHint`, `uniqueCommitmentList`. `foldAccents` (exportado, usado por todo).

### `src/domain/intent.ts` (161 líneas)
Heurísticas léxicas en español rioplatense: `hasTaskCue`, `hasShoppingIntent`, `extractShoppingItems` (con `HOUSEHOLD_ITEMS` hardcoded de 26 productos), `cleanupShoppingTaskTitle`, `isAvailabilityStatement`, `isNewsIntent`, `isWorldSignalIntent`. **Anti-patrón de palabras clave** — frágil ante variaciones.

### `src/domain/schemas.ts` (~508 líneas)
Validación a mano (NO usa zod). `SchemaValidationError`, `Validation<T>` (ok/warnings | errors). Validadores para `SemanticIntent`, `RouterResult`, `ToolCall`, `UiBlock`, `AssistantActionPayload`. Whitelists `INTENT_DOMAINS`, `TOOL_NAMES`, `UI_BLOCK_TYPES`.

**Observación:** reinvención de zod. Funciona pero es código muerto en el motor activo (legacy).

### `src/domain/toolRegistry.ts` (434 líneas)
**Registro de 8 tools** con políticas explícitas: `weather` (auto, readonly), `web_search` (auto, readonly), `deep_research` (auto, readonly), `shopping_compare` (approval, external_side_effect), `route_traffic` (auto, readonly), `calendar_reminder` (approval, local_write), `alarm` (approval, local_write), `money_summary` (auto, readonly), `memory_recall` (auto, readonly).

Cada tool define: `buildPayload`, `execute`, `pendingUiBlock`, `resultToUiBlocks`. Helpers: `splitToolCallsByPolicy`, `pendingBlocksForToolCalls`, `uiBlocksFromToolResults`, `approvalRequiredForUiBlock`, `actionKindForUiBlock`, `shouldAutoRunAction`.

**Observación:** políticas de seguridad bien definidas y conservadoras. Es la base correcta para un sistema de tools.

### `src/domain/freellmapi.ts` (237 líneas)
**Cliente LLM legacy.** `runFreeLlmChat`, `runOpenModelChat` (con plugin `response-healing` para OpenRouter), `runFreeLlmEmbedding`, `testFreeLlmConnection`, `preferredBrainProvider`, `resolveProviderStatus`, `createDefaultRuntimeSettings`. Maneja timeouts con `AbortController`. Es el cliente que usaba el motor client-side (hoy legacy).

### `src/domain/orchestrator.ts` (666 líneas) — LEGACY
Orquestador del motor client-side. `orchestrateTurn`: router LLM (2 fases: route → compose), `localRoute` (heurística determinista, ~10 ramas), `callValidatedJson` (validate-or-repair), `fallbackRouteIsStronger` (desconfía del LLM), `uiBlocksToActionProposals`. **No se invoca en producción** (la UI usa `runBackendAgentTurn`).

### `src/domain/actions.ts` (1.667 líneas) — LEGACY
**God-module** de propuestas locales: `buildActionProposalsLocal`, `normalizeActionDrafts`, `executeApprovedAction`, 30+ funciones privadas (`isPlanningIntent`, `isMoneySummaryIntent`, `buildDayPlan`, `buildMoneySummary`, `buildDecisionSupport`, etc.). Candidato claro a dividir. Duplica detección de `orchestrator.localRoute`.

### `src/domain/brain.ts` (1.204 líneas) — LEGACY
Cerebro reflexivo del motor legacy. `analyzeReflection` (público), `selectActiveMemories` (vectorial + léxica), `extractLifeRecordsLocal` (13 categorías), `classifyMemoryKind` (7 tipos + `isSensitive`). Bug regex `/g` gestionado con resets manuales. **No se invoca en producción.**

### `src/domain/pipeline.ts` (~151 líneas) — DECLARATIVO MUERTO
Define tipos `KoruPerception`, `KoruPlan`, `KoruActResult`, etc. (modelo Think→Act→Enrich→Learn). `isConversationalTurn`, `needsExternalTool`. Ningún módulo los importa — manifiesto aspiracional desconectado.

### `src/domain/agentKernel.ts` (90 líneas)
Kernel mínimo: `inferActivity` (mapea input a `AgentActivity` visual), `rewritePendingFollowUp` (expande respuestas cortas), `rememberedLocation` (extrae ciudad de memorias).

### `src/domain/backendAgentClient.ts` (127 líneas)
**Cliente HTTP del frontend hacia `/api/koru/turn`.** `runBackendAgentTurn` con soporte streaming NDJSON, `AbortController` (timeout 75s), `KoruBackendAgentError`. **Único punto de entrada del motor en producción.**

**Bug menor:** tipo `provider: "nvidia"|"openrouter"` no incluye `"minimax"` que sí usa el server. Catch silencioso de chunks inválidos. Split por `\n` asume LF (debería ser `/\r?\n/`).

### `src/domain/enhancementEngine.ts` (228 líneas) — ACTIVO
**Sistema nervioso del +1.** `generateEnhancements`: `opportunities → filter confianza ≥0.65 → scoreCandidate → rankEnhancements → filterEnhancements`. Scoring determinista (userValue + confidence − risk − intrusion), ajustado por `learningPreferences`. Policy gate: score ≥1.5, no duplicar título, respetar boundaries, ignorar si usuario ignoró 2+ veces. **Comentario excelente y honesto:** "Este módulo NO es inteligente. NO decide frases finales."

### `src/domain/enhancementExtractor.ts` (223 líneas) — ACTIVO
**Capa LLM que detecta oportunidades +1 abstractas.** `extractOpportunities`, `systemPrompt` detallado con taxonomía de tipos y ejemplos buenos/malos, `callExtractorLlm`. **Separación limpia extractor (inteligente) ↔ engine (determinista).** Patrón correcto.

### `src/domain/semanticRouter.ts` (276 líneas) — ACTIVO
**Router de intención por similitud coseno de embeddings.** `ROUTE_EXAMPLES` (41 frases modelo en 7 categorías), `initialize` (embebe y cachea, idempotente), `route` (coseno contra caché, umbral 0.55), `extractToolArgs` (regex ciudad). **Agnóstico al modelo vía `EmbedFn` inyectada.** Bien documentado.

**Bug menor:** `cosineSimilarity` itera hasta `a.length` no `Math.min` → frágil si cambian dimensiones de embeddings.

### `src/domain/simulatedToolDetector.ts` (149 líneas) — ACTIVO
**Compatibilidad para modelos sin tool-use nativo.** Detecta 4 formatos: `tool_call fence`, `<|tool_call|> pipe`, `json fence`, `call:NAME(...)`. `VALID_TOOL_NAMES` whitelist (6). `tryParseArgs` tolerante a JSON informal. Diseño defensivo excelente.

### `src/domain/structureExtractor.ts` (273 líneas) — ACTIVO (pero diferido)
**Anti-alucinación por diseño.** `extractStructuredData`: prompt estricto + `stripReasoning` (elimina `<think>`/`<reasoning>`) + `parseJsonObjectStrict` + **validación determinista `findBackingSource`** (cada item debe tener `quote` que aparezca literal en algún source). **El módulo mejor diseñado del proyecto.**

**Bug menor:** `content.slice(0, 1000)` trunca; citas después del char 1000 se pierden.

### `src/domain/heartbeat.ts` (125 líneas) y `heartbeatProactive.ts` (180 líneas) — ACTIVO
`buildHeartbeatNudges` (invocado cada 60s desde `KoruProvider`): compuertas de horas activas/capacidad/frescura. `heartbeatProactive.ts`: 5 generadores (`weatherWakeUpNudge`, `meetingTrafficNudge`, `energyPauseNudge`, `sportsResultNudge`, `routineReminderNudge`).

**Bugs:** TZ mezclado (`getUTCHours` vs `getHours`); `sportsResultNudge` prioridad "low" → siempre filtrado (código muerto); docstring 24h vs código 20h.

---

## 4. Capa `src/ui/` (React 19)

Resumen extendido en el documento 03 (UI). Aquí los puntos estructurales:

- `KoruProvider.tsx` (1.806): único Context, todo el estado. Refs espejo (`domainStateRef`, `chatTurnsRef`) para evitar closures obsoletos. `submitEntry` orquesta `runBackendAgentTurn` con streaming. **God-component.**
- `TalkOverlay.tsx` (476): chat fullscreen, tema light/dark (Ctrl+Shift+D), micrófono Web Speech, scroll inteligente.
- `chatCards.tsx` (1.407): 21 tipos de tarjetas. `KoruSemanticCard` dispatcher. `WebNavCardA` (cronómetro, animación escalonada). Doble vía (legacy modular + UiBlock-A con `stitchBlockFromLegacyItem`).
- `App.tsx` (56): shell con tabs + `TalkOverlay` + `CardPreview` (QA backdoor).
- `HomeScreen`/`MemoryScreen`/`HistoryScreen`/`Onboarding`/`PermissionsScreen`/`SettingsScreen`/`BottomNav`/`KoruMascot`/`CardPreview`.

**Problema transversal grave (mojibake):** `KoruProvider.tsx` y partes de `chatCards.tsx` tienen secuencias UTF-8 mal decodificadas (`RaÃ­ces`, `reuniÃ³n`, `NacÃ­`) con BOM visible. Texto que el usuario lee mal. Deuda cosmética alta.

**Problema transversal (rendimiento):** único Context → cualquier mutación re-renderiza todos los consumidores. Faltan `React.memo` en `KoruTurnBubble`/`TurnItemCard`/`WebNavCardA`.

**Problema transversal (accesibilidad):** `TalkOverlay` no es `role="dialog"`/`aria-modal`, sin focus trap. `MemoryDetail` modal sin Escape.
