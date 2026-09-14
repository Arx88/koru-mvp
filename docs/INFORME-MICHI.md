# Michi — Informe exhaustivo de arquitectura, estado y deuda

> **Fecha:** 2026-09-11
> **Método:** lectura íntegra de los módulos del núcleo + medición real (typecheck, build, suite de tests, sondas HTTP contra producción).
> **Fuente de verdad del código:** repo local en `main` @ `ada4a6c` (737 commits, último 2026-09-10 23:32 UTC).
> **Fuente de verdad del comportamiento:** `https://koru-mvp.onrender.com` (sondas del 2026-09-11 ~00:45–01:05 UTC).
> **Regla aplicada:** nada de este informe es inferencia sin marcar; lo que es hipótesis está rotulado como *(hipótesis, sin verificar)*.

---

## ⚠️ Correcciones posteriores (prueba funcional en vivo, 2026-09-10 21:45–22:15 AR)

Este informe se apoyaba en lectura de código **y en mediciones locales** (`npm ci`, `tsc`, `npm test`, `npm run build`).
Después corrí una prueba funcional **contra el servicio desplegado**: 24 turnos con el payload real del cliente, 14 endpoints y 7 assets.
Resultados crudos en `/d/tmp/michi-live/*.json`, arnés en `scripts/michi-live-audit.mjs`, y el documento con la evidencia en `docs/propuesta-michi.html`.

**Afirmaciones de este informe que la prueba en vivo desmintió:**

| Este informe decía | Lo medido en vivo |
|---|---|
| §8.3 «`ai-assist` devuelve siempre vacío» | **Falso.** Respondió en 6,6 s con 3 sugerencias útiles. Es *intermitente*: está al límite del presupuesto de 10 s. |
| §5.2 «`/api/debug/weather` expuesto en producción» | **Falso.** Responde 404. |
| §7.3 «los 502 son el proceso que muere» | **Sin confirmar.** En 24 turnos no hubo ninguno; en una pasada previa fueron 2 de 8. Sigue sin causa probada. |
| §8.4 «latencia 9–53 s» | **Se quedó corto.** Mediana real **25,1 s**, p75 33,8 s, máximo **125 s**; solo 2 de 24 turnos por debajo de 10 s. |

**Hallazgos nuevos que solo se ven en vivo (no deducibles del código):**

1. **Producción no es el repo.** `GET /sw.js` sirve `CACHE_NAME="michi-v7"` / «v8.2 — fix fútbol v2»; el repo —incluido `origin/main`— tiene `michi-v6` / v8.1, y `michi-v7` no aparece en ningún commit ni archivo. Hay trabajo desplegado sin commitear.
2. **`understanding` es un placeholder de código.** 22 de 24 turnos devolvieron el literal `"Resolver el pedido con el menor esfuerzo posible."` con `confidence` 0,65: son los fallbacks de `finalizePayload.ts:138` y `:141`. El módulo de comprensión nunca corre en el camino real.
3. **`dueAt` de los recordatorios está corrido.** «recordame llamar al dentista mañana a las 10» (hoy 10/9 21:57 AR) devolvió `2026-09-12T10:00:00.000Z` = **12/9 07:00 AR** en lugar de 11/9 10:00. El servidor usa el día UTC y el cliente no lo corrige (`candidate.dueAt ?? dueAtFromText(...)`).
4. **Un `"hola"` falló** con el mensaje de disculpa genérico tras caer a un modelo gratuito (14,5 s). Intermitente, pero visible.
5. **El flujo de aprobación no se alcanza**: 0 de 24 turnos pasaron por aprobación; `shopping_compare` y `email_draft` no se usaron y el mail salió con card de tipo `reminder`.
6. **Tool equivocada o ausente en 7 de 24 turnos** (`day_info`, `recipe_find`, `plan_day`, `shopping_compare`, `email_draft`, `restaurant_deep_search`, `crypto_price`); dos fallos con `needs_context`.
7. **`userName` del estado se ignora** en el chat («cómo me llamo?» → «todavía no me dijiste tu nombre») aunque el flujo de informe largo sí lo usa.
8. **Textos de memoria en inglés/técnicos**: `"User location: Buenos Aires (city)"`, visibles en la tarjeta de memoria; y fecha UTC dentro del texto (`pidió un informe el 2026-09-11` cuando en Argentina era el 10).
9. **`proactive` devolvió `shouldShow:false`** con un compromiso vencido desde ayer.
10. **Las galerías de diseño siguen servidas en producción** (`/preview.html`, `/lectura.html`, `/all-cards.html` → 200).

**Confirmado en vivo sin cambios:** duplicación de memorias en el mismo lote (2 de 2 veces que guardó), boundaries de privacidad firmes (rechazó guardar número de tarjeta y clave), recall fiel (5 de 5 memorias), prudencia en salud, coreferencia de follow-ups ("y ayer?" → Argentina) y heartbeat NDJSON cada 5 s en el 100 % de los turnos.

---

## 0. TL;DR — los 10 hallazgos que importan

| # | Severidad | Hallazgo | Evidencia |
|---|-----------|----------|-----------|
| 1 | 🔴 P0 | **`npm run dev` tiene la mitad del backend.** 8 endpoints existen solo en `server/index.ts`; el dev server de Vite no los implementa y las features fallan en silencio. | `vite.config.ts` (5 `middlewares.use`) vs `server/index.ts` (17 rutas) |
| 2 | 🔴 P0 | **Colisión de puerto 3000** entre `vite` y `npm run server`. No se pueden correr juntos. | `vite.config.ts:1121`, `server/index.ts:32` |
| 3 | 🔴 P0 | **502 intermitentes en producción**: 2 de 8 turnos fallaron con error de Render a los ~2s. | sondas en vivo |
| 4 | 🔴 P0 | **`KORU_API_KEY` no está seteada en prod** → `/api/koru/*` es anónimo y la cuota de LLM es abierta. | `GET /api/koru/models` devolvió 200 sin auth |
| 5 | 🔴 P0 | **Mensajes proactivos dicen "Juan"** hardcodeado, sin importar el usuario. 11 strings. | `src/domain/proactiveEngine.ts:223–332` |
| 6 | 🔴 P0 | **Carrera en `MemoryToast`**: un click en los primeros 50ms revierte el feedback "Guardado en tu jardín". | `MemoryToast.tsx:56` vs `:75` |
| 7 | 🟠 P1 | **El mismo recuerdo se guarda duplicado** en un turno: la dedupe solo compara contra memorias previas, no entre candidatos nuevos. | `turn.ts:433`, confirmado en vivo |
| 8 | 🟠 P1 | **Las tools dependen del proveedor**: NVIDIA/OpenRouter reciben 45 tools, MiniMax/BlueSminds 134. 89 tools son inalcanzables por el proveedor primario. | `koruBackend.ts:1020,1072,930,1136` |
| 9 | 🟠 P1 | **`CATEGORY_TOOLS` es código muerto**: el filtro por categoría se declara y nunca se usa. | `koruBackend.ts:553`, cero referencias |
| 10 | 🟠 P1 | **La latencia real es 9–53 s por turno** (medido). "y ayer?" tardó 53 s. | sondas en vivo |

Y un dato de identidad: **el repo dice "Koru" 1.161 veces y "Michi" 244** dentro de `src/`. La UI es Michi; los internos, los prompts y los comentarios siguen siendo Koru.

---

## 1. Qué es Michi

PWA de asistente personal conversacional, en español rioplatense, mobile-first. No es un chatbot que devuelve prosa: **devuelve cards**. El usuario habla, el sistema ejecuta herramientas reales (100+) y el resultado se presenta como una tarjeta visual con datos verificables, fuentes y botones de acción.

**Los 5 principios que están realmente implementados en el código** (no solo en el README):

1. **Memoria confirmable.** Nada personal se guarda sin proponerlo (`MemoryFact.status: candidate | confirmed | rejected | archived | superseded`). La UI de confirmación vive en el toast y en la card `memory`.
2. **Boundaries explícitas.** Cada tool declara `policy { risk, requiresApproval, autoRun }` (`src/tools/types.ts`, `src/domain/toolRegistry.ts`).
3. **Anti-alucinación estructural.** `structureExtractor` valida *cada dato* contra una **cita literal** presente en el contenido de una fuente. Cita < 25 chars normalizados = rechazado. Es el mejor módulo del proyecto.
4. **Enhancement "+1".** El LLM *propone* (`enhancementExtractor`); un motor **determinista** filtra, rankea y aprende (`enhancementEngine` + `learningPreferences`).
5. **Personalidad calibrada.** `voicePreference { warmth, directness, humor, detail, proactivity }` inyectada al system prompt; `soul.ts` con frases prohibidas para evitar apego artificial.

**Estado emocional y progresión:** `stage: seed → sprout → roots → born → garden` derivado de energía confiada; 16 estados de mascota.

---

## 2. Stack y cómo se ejecuta (verificado)

| Capa | Tecnología real |
|---|---|
| Frontend | React 19.2 · Vite 8 (bundler **rolldown**) · TypeScript 6.0 `strict` · Tailwind 4 |
| Estado | `useReducer` + Context en `KoruProvider` · persistencia IndexedDB + localStorage |
| Backend | Node 22 **HTTP nativo** (sin Express), en dos sabores: middleware de Vite (dev) y `server/index.ts` (prod) |
| Streaming | NDJSON + heartbeat de 5 s (evita el timeout de 30 s del proxy de Render) |
| PWA | Service Worker `michi-v6` (push + notificationclick; **no** intercepta fetch) |
| OCR | Tesseract.js en cliente |
| PDF | puppeteer en servidor (con fallback a HTML) |
| Tests | Vitest (jsdom) + Playwright (desktop + Pixel 7) |
| Deploy | Render (activo) · Railway · Fly · Docker · Vercel+rewrite |

### Cómo levantarlo

```bash
npm ci              # 221 paquetes, ~7 s
npx tsc --noEmit    # 0 errores
npm test            # 913 tests
npm run build       # tsc + vite build (1.2 s)
npm run dev         # Vite en :3000  ← backend INCOMPLETO
npm run server      # Node en  :3000  ← COLISIONA con el anterior
```

**El flujo de desarrollo intencionado no está documentado en ningún lado.** En la práctica:
- `npm run dev` → chat, clima, VLM, ASR, auditoría funcionan. **Proactive, morning-brief, ai-assist, PDF export y Google Calendar NO.**
- `npm run build && npm run server` → todo funciona, pero sin HMR.
- `playwright.config.ts` fuerza `--port 5173` para que los E2E no choquen con la config (que dice 3000).

---

## 3. Mapa del código (líneas medidas)

```
src + server        97.643 líneas TS/TSX en 454 archivos
src/*.css           14.776 líneas CSS (style.css solo: 5.8k+)
tests               11.174 líneas en 102 archivos
```

| Zona | Líneas | Rol |
|---|---|---|
| `src/ui` | **50.568** | Todo el frontend |
| ├ `src/ui/cards/lectura` | 17.955 | 52 interiores + 50 CSS — **sistema de diseño paralelo, NO se renderiza en el chat** |
| ├ `src/ui/cards/unified` | 14.999 | Camino real: `presentation.ts` (6.946, 73 mappers) + `MichiLayouts` + `KoruUnifiedCard` |
| └ `src/ui/KoruProvider.tsx` | 2.638 | Dios-objeto: store + red + streaming + auditoría + notificaciones |
| `src/domain` | 15.103 | Reglas puras: store, turn, memoria, extractores, engines |
| `src/tools` | 14.015 | **124 tools** en 15 dominios |
| `src/server` | 13.290 | `koruBackend.ts` (5.406), `blocksFromToolResults` (1.450), `finalizePayload` (995), `pdfExport`, `middleware` |

Archivos más grandes: `presentation.ts` 6.946 · `koruBackend.ts` 5.406 · `KoruProvider.tsx` 2.638 · `SettingsScreen.tsx` 2.429 · `CreateScreen.tsx` 2.172.

### Los 3 sistemas de renderizado de cards que coexisten

```
TalkOverlay
 ├─ item.uiBlock  → KoruUnifiedCard → MichiLayouts.MichiCard   ← EL QUE VE EL USUARIO
 ├─ item legacy   → KoruSemanticCard (chatCards.tsx)           ← fallback para items sin uiBlock
 └─ (galerías)    → cards/lectura/*Interior (52 paneles)       ← /lectura.html + QA + fixtures
```

El sistema **Lectura** (17.955 líneas) solo es consumido por galerías, fixtures de preview y el harness de QA. Lo único que el código real importa de ahí es `slug.ts` (un helper de ids). Es la mayor masa de código no productivo del repo.

---

## 4. Un turno de punta a punta (con los caminos reales)

```
CLIENTE
  TalkOverlay.submitText → KoruProvider.submitEntry
    ├─ queueOffline si !navigator.onLine
    ├─ POST /api/koru/turn  (NDJSON, onChunk por progreso)
    │    └─ merge de uiBlocks por TIPO (no por índice) preservando ids
    │       → los componentes animados no se desmontan al cambiar el orden
    ├─ applyBackendTurnToState()  ← acá nacen commitments/records/memorias
    │    ├─ dueAt = dueAtFromText(`${title} ${dueHint}`)  ← recordatorios funcionan
    │    └─ dedupe de memorias SOLO contra las previas  ⚠️ bug #7
    ├─ updateWeatherCache si vino un block weather con datos
    ├─ schedulePreciseTimeout + scheduleReminderNotification por commitment nuevo
    ├─ detección de conflicto de memoria → modal
    ├─ MemoryToast si hay memoryCandidates
    └─ writeAuditEvent (snapshot + delta a manual-audits/koru-current.jsonl)

SERVIDOR  runKoruBackendTurn
  1. resolveFollowUpInput("y ayer?" → "Boca ayer")     ← determinístico, sin LLM
  2. isTrivialInput → FAST PATH (1 llamada, sin tools)   [medido: 1,85 s]
  3. explicitDeliverableTopic → runDeepResearchFlow      (4 búsquedas → síntesis → deliverable)
  4. Semantic Router (embeddings, 280 ejemplos, 18 categorías)
       ├─ route.tool === deep_research → runDeepResearchFlow
       ├─ autofire de la tool (web_search exige confianza ≥ 0.78)
       └─ si la tool falla → fallback automático a web_search
  5. Flujo nativo: LLM con CORE_TOOL_DEFINITIONS
       + parches determinísticos: review de producto, clima en multi-intent,
         multi-intent por conectores
  6. executeProviderToolCalls → executeTool → TOOL_BOX (124) | builtins (10)
       + validador semántico: si pediste info y la tool guardó → corrige
  7. Síntesis con modelo rápido → summary + sections
  8. blocksFromToolResults → UiBlock[]
  9. finalizePayload / normalizeFinalPayload → respuesta NDJSON
 10. enhancementEngine → el "+1" contextual
```

---

## 5. Inventarios

### 5.1 Tools: 134 disponibles, 45 ofrecidas

| Grupo | Cantidad |
|---|---|
| Builtin declaradas al LLM (`TOOL_DEFINITIONS`) | **10** — day_info, weather, web_search, shopping_compare, comparison_deep, plan_day, query_personal_context, save_memory, save_personal_item, deliver_response |
| `TOOL_BOX` externo (`src/tools/`) | **124** |
| `ALL_TOOL_DEFINITIONS` | **134** |
| `CORE_TOOL_DEFINITIONS` (curado) | **45** |
| Despachables pero **no declaradas** al LLM | route_traffic, calendar_reminder, alarm (legado) |

Por dominio: money 16 · docs 32 · travel 11 · sports 11 · food 10 · knowledge 10 · trending 10 · health 6 · people 6 · apps 4 · utils 4 · media 1 · news 1 · shopping 1 · weather 1.

**Qué recibe cada proveedor** (esto es lo relevante):

| Proveedor | Tools enviadas |
|---|---|
| MiniMax | `ALL_TOOL_DEFINITIONS` → **134** |
| BlueSminds | `ALL_TOOL_DEFINITIONS` → **134** |
| **NVIDIA (el primario en prod)** | `availableTools ?? CORE` → **45** |
| OpenRouter | `CORE_TOOL_DEFINITIONS` → **45** |
| AI Native (fallback) | `availableTools ?? CORE` |

Consecuencia: pedir `recipe_by_ingredients`, `f1_results`, `golf_leaderboard`, `doc_create_excel`, `qr_generate`, `password_generate`, `holidays`, `person_follow`, `news_urgent` (vía tool), etc. **no puede resolverse por tool-calling nativo**; solo si el Semantic Router hace autofire. El comentario del motor dice literalmente *"pasar TODAS las tools al LLM siempre"* (`koruBackend.ts:4870`) y es falso para el proveedor que está en producción.

### 5.2 Endpoints

| Endpoint | `vite.config.ts` (dev) | `server/index.ts` (prod) |
|---|---|---|
| `/api/koru/turn` | ✅ | ✅ |
| `/api/koru/models` | ✅ | ✅ |
| `/api/koru/vlm` `/asr` | ✅ | ✅ |
| `/api/koru/weather` | ✅ | ✅ |
| `/koru-web/search` | ✅ | ❌ |
| `/koru-ai/*` | ✅ | ❌ |
| `/koru-audit/log` | ✅ | ✅ |
| `/api/koru/proactive` | ❌ | ✅ |
| `/api/koru/morning-brief` | ❌ | ✅ |
| `/api/koru/ai-assist` | ❌ | ✅ |
| `/api/koru/export-pdf` `/export-deliverable` | ❌ | ✅ |
| `/api/integrations/google-calendar/{callback,status}` | ❌ | ✅ |
| `/api/health`, `/api/debug/weather` | ❌ | ✅ |
| Static + SPA fallback | Vite | ✅ |

### 5.3 Cards

- **57 variantes** en la unión discriminada `UiBlock` (`src/domain/types.ts`).
- **73 mappers** en `presentation.ts` (documentados como 51 en `MASTER_CARD_INVENTORY.md`; el archivo pasó de 2.621 a 6.946 líneas y el doc no se actualizó).
- Moldes de render: `Default`, `Compact`, `Spotlight`, `Gallery`, `Banner`, `Tennis`, `Garden`, `Match` + `MichiIcard/Mission/Crypto/Receta/Fit/Game/Shop/Sleep/Focus/Futbol/Tenis`.
- 52 interiores "Lectura" con 50 hojas CSS propias.
- 38 assets WebP de arte/avatares.

### 5.4 Pantallas

`chat` (TalkOverlay) · `hoy` (HomeScreen) · `memoria` · `historial` · `configuracion` · `avatares` + overlays: Collections, CreateScreen, KoruDetailScreen, CookingMode, WorkoutSession, MeditationOverlay, MemoryGraph, MemoryConflictResolver.

### 5.5 Tests

102 archivos, 913 casos: **847 pass · 6 fail · 60 skip**. Distribución: `src/ui` 57 archivos, `src/domain` 21, `src/server` 11, `src/tools` 3, `src/test` 4, `src/qa` 1, `tests/` 2 (Playwright).

Los 60 saltados son los más valiosos y están apagados:
- `backend-e2e.test.ts` → `describe.skip` (necesita API key)
- `e2e-cards.test.ts` → `describe.skip`
- `router-intent-batch.test.ts` (23) → `skipIf(!ollama)`
- `tools-real.test.ts` → `it.skip` (AAPL real)

---

## 6. Estado medido

### 6.1 Local

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ **0 errores** |
| `npm run build` | ✅ 1,18 s · 4 entrypoints · chunks: main 269 kB, style 346 kB, michi-cards 524 kB (>500 kB → warning) |
| `npm test` | ⚠️ 913 tests · 847 pass · **6 fail** · 60 skip · inestable (entre corridas varía 4↔6 fallos) |

**Los 6 fallos, diagnosticados uno por uno:**

| Test | Causa real | Clase |
|---|---|---|
| `tz-kickoff` ×2 | Asume runtime en **UTC**; en máquina UTC-3 espera `00:30` y recibe `02:30` | entorno (test mal escrito) |
| `heartbeatProactive > detects wake hour` | `weatherWakeUpNudge` usa `getHours()` local; el test fija `08:15Z` | entorno (test mal escrito) |
| `pdfExport > sparkline` | Espera `"65,000"`; `toLocaleString` da `"65.000"` en locale es-AR | entorno (test mal escrito) |
| `MemoryToast` ×2 | **Bug real** de carrera (ver 7.6) | producto |

Ninguno de los 6 es "flaky" en el sentido aleatorio: 4 están acoplados a la zona horaria/locale de quien ejecuta y 2 son un defecto de producto.

### 6.2 Producción (sondas reales)

`GET /api/health` → 200
```json
{"status":"ok","service":"koru-backend","provider":"nvidia",
 "model":"nvidia/nemotron-3-ultra-550b-a55b","ainative":"configured"}
```

`GET /api/koru/models` → 200 con **2 modelos** (sin auth → la API key no está configurada):
`nvidia/nemotron-3-ultra-550b-a55b` + `openrouter/free`.

| Sonda | Resultado | Latencia | Bloques | Tools |
|---|---|---|---|---|
| `"hola"` | 200 | **1,85 s** | — | — (trivial-fast-path) |
| `"a cuanto esta el bitcoin"` | 200 | **11,4 s** | `crypto_portfolio` | crypto_price:ok |
| `"recordame llamar al dentista manana a las 10"` | 200 | **8,9 s** | `reminder` | calendar_reminder:ok |
| `"me encanta el helado de pistacho"` | 200 | **12,2 s** | — | memory_recall:ok |
| `"que dia es hoy?"` | **502** | 2,0 s | — | — |
| `"y ayer?"` (con historial) | 200 | **53,0 s** | `live_match` + `match_timeline` | match_live:ok |
| `/api/koru/proactive` | 200 `{shouldShow:false}` | 0,55 s | — | — |
| `/api/koru/morning-brief` | 200 `{shouldShow:false,reason:"not_morning"}` | 0,17 s | — | — |
| `/api/koru/ai-assist` | 200 **`{suggestions:[]}`** | **10,2 s** | — | — |

Calidad de las respuestas observadas (transcripción literal):
- Bitcoin → `"El Bitcoin está en USD 76.769. Te dejé la cotización con la variación 24h en la tarjeta."` + card real. ✅
- Recordatorio → `"Listo, te aviso mañana a las 10 para que llames al dentista."` + commitment `{title:"Llamar al dentista", dueHint:"mañana a las 10"}` (sin `dueAt` en el wire; el cliente lo calcula bien). ✅
- Pístacho → respuesta cálida y correcta + **2 memory candidates idénticos**. ⚠️
- "y ayer?" → resolvió el follow-up a **Boca Juniors 1-0 São Paulo** con card rica. ✅ (a los 53 s)

---

## 7. Hallazgos P0

### 7.1 El backend de desarrollo está incompleto
`vite.config.ts` implementa 5 rutas de API; `server/index.ts` implementa 17. Las 8 que faltan se invocan desde el frontend con `fetch` relativo, así que en dev Vite responde `index.html` (200, HTML), el `res.json()` tira, y el `catch` silencioso traga el error.

**Síntoma que ve el usuario en dev:** el morning brief nunca aparece, los nudges proactivos nunca aparecen, el botón "IA" de Crear nunca sugiere nada, "Exportar PDF" no hace nada, y Google Calendar siempre figura desconectado.

**Fix sugerido:** convertir `server/index.ts` en un servidor Express/Node montable y registrarlo como middleware de Vite con `configureServer` (importando el handler compartido), o unificar ambos en un único módulo de rutas que los dos consuman. Es la intervención de mayor ROI del repo: elimina la clase de divergencia, no un caso.

### 7.2 Colisión de puerto
`vite.config.ts:1121` → `port: 3000`. `server/index.ts:32` → `PORT ?? 3000`. Los dos quieren el mismo puerto. `run-vite.bat` y `start-koru.bat` además apuntan a `D:\ZomboidServer\koru-mvp` (máquina del autor original) y anuncian `:5173`. `playwright.config.ts` esquiva el problema pasando `--port 5173` por CLI.

### 7.3 502 intermitentes en producción — 25% de los turnos de la sonda
Dos de ocho requests devolvieron `502` con la página de error de Render, a los ~2 s (no es timeout: el proxy de Render tolera 30 s y el NDJSON manda heartbeat).
*(hipótesis, sin verificar):* el proceso Node muere y Render devuelve 502 mientras reinicia. El contenedor corre con `--max-old-space-size=512`, el server loggea `Memory warning` por encima de 400 MB de heap, y `Presentation`/`blocksFromToolResults` construyen estructuras grandes por turno. **Cómo confirmarlo:** mirar los logs de Render y correlacionar con `Memory warning`; o instrumentar `/api/health` con `process.memoryUsage()`.
Esto es independiente de los rate limits del modelo — es el proceso.

### 7.4 Sin API key en producción
`server/middleware.ts` permite todo si `KORU_API_KEY` no está seteada (y loggea un warning al arrancar). La sonda lo confirma: `/api/koru/models` respondió sin `Authorization`. Cualquiera con la URL puede consumir la cuota de LLM del usuario (rate limit 30 req/min por IP, en memoria, por proceso → no sobrevive a un restart y no es un freno real).

### 7.5 Los mensajes proactivos le dicen "Juan" al usuario
`src/domain/proactiveEngine.ts` tiene el nombre hardcodeado en el prompt del sistema (línea 223: *"Sos Koru, el asistente personal de Juan"*) y en **11 mensajes generados** (289, 292, 295, 300, 309, 312, 319, 321, 326, 332). Es el ejemplo más visible de código que nunca se generalizó.

Relacionado, en el mismo camino: `TalkOverlay.tsx:954` arma el payload del engine con `commitments: []` y `records: []` hardcodeados, y `userName: history?.[0]?.userName` — un `KoruChatTurn` no tiene `userName`, así que **siempre llega vacío**. Resultado: los triggers de pendientes vencidos y la personalización por nombre nunca pueden funcionar. El comentario dice "FIX CRÍTICO: enviar el state REAL del usuario" — a medias.

### 7.6 Carrera en `MemoryToast` (bug de producto, 2 tests en rojo)
```
useEffect(() => { const t1 = setTimeout(() => setPhase("visible"), 50); return () => clearTimeout(t1); }, []);
handleConfirm → setPhase("confirmed") → onConfirm() → setTimeout(…1400)
```
Si el usuario toca **Guardar** dentro de los primeros 50 ms desde que el toast aparece, el timer de montaje pisa `"confirmed"` con `"visible"`: la acción se ejecuta igual pero **el feedback "Guardado en tu jardín" desaparece**. Fix: guardar el timer en un ref y cancelarlo en `handleConfirm`/`handleReject`, o transicionar a `visible` de forma idempotente (`setPhase(p => p === "enter" ? "visible" : p)`).

---

## 8. Hallazgos P1

### 8.1 Memorias duplicadas dentro de un mismo turno
`turn.ts:433` filtra cada candidato contra `updatedExistingMemories` (las memorias que ya existían). No compara los candidatos **entre sí**. El backend devolvió dos veces `"Le encanta el helado de pistacho"` en la sonda en vivo y las dos entran al state con ids distintos. Fix: dedupe intra-lote (Set de texto normalizado).

### 8.2 Las tools dependen del proveedor que responda
Ver 5.1. El mismo mensaje puede resolver distinto según quién conteste. Además `CATEGORY_TOOLS` (`koruBackend.ts:553`) —el filtrado por categoría del router— **nunca se usa**: 0 referencias. El comentario que lo justifica describe un comportamiento que no existe.

### 8.3 `ai-assist` devuelve siempre vacío en producción
`server/index.ts` da 10 s al LLM con un `Promise.race` y devuelve `{suggestions: []}` en cualquier fallo. Con Nemotron Ultra la sonda tardó **10,2 s** y volvió vacío → el timeout se come la feature de forma sistemática. Fix: subir el presupuesto a ~30 s (la UI ya es asíncrona y degrada a "sin sugerencias"), o usar el modelo rápido (`nvidiaFastModel`) para esta tarea.

### 8.4 Latencia real: 9–53 s por turno
Medido: 1,85 s (trivial) · 8,9 s (recordatorio) · 11,4 s (crypto) · 12,2 s (memoria) · **53,0 s (follow-up con partido)**. El seguimiento corto encadena: router → match_live (ESPN, varias llamadas) → síntesis con modelo grande → `blocksFromToolResults` con lineups y stats. No hay presupuesto de tiempo por fase ni cancelación por turno salvo el heartbeat que mantiene viva la conexión.

### 8.5 Naming: el repo es Koru, el producto es Michi
`Koru`: **1.161** ocurrencias en `src/`. `Michi`: **244**. Lo que ve el usuario ya es Michi (título, manifest, avatares, cards v8). Lo que no: prompts del sistema, mensajes proactivos, logs (`service: "koru-backend"`, `[Koru]`), comentarios, nombres de archivos (`koruBackend.ts`, `KoruProvider.tsx`), clases CSS (`koru-memory-toast`), claves de almacenamiento (`koru.onboarded`, `koru.username`, `koru.language`, `koru.lastBriefDate`, `koru.integrations`, IndexedDB `koru-local-first`) y los README/docs.

⚠️ **Cuidado con el rename de claves de storage:** renombrar `koru.*` / el nombre de la base IndexedDB **borra el estado de los usuarios existentes** (memorias, gastos, compromisos). La migración correcta es en dos velocidades: (a) strings user-facing y código interno ya; (b) claves de storage con migración explícita (leer `koru.*` → escribir `michi.*` una vez) o simplemente dejarlas como están para siempre.

### 8.6 Documentación severamente desactualizada
| Documento | Dice | Realidad |
|---|---|---|
| `README.md` | "Koru", 287 tests, 64k líneas, 28 días, 454 commits | Michi, 913 tests, 97,6k líneas, 83 días, 737 commits |
| `docs/MASTER_CARD_INVENTORY.md` | `presentation.ts` 2.621 líneas, 51 mappers | 6.946 líneas, 73 mappers |
| `docs/auditoria/*` (2026-06-23) | analiza `brain.ts`, `orchestrator.ts`, `actions.ts`, `intent.ts` como motor vivo | **esos archivos ya no existen** (borrados en "Fase 2.14") |
| `SUMMARY.md` | 95 tests, design v11, "Plus Jakarta Sans" | obsoleto |
| `run-vite.bat`, `start-koru.bat` | ruta `D:\ZomboidServer\koru-mvp`, puerto 5173 | ruta inexistente, puerto 3000 |

La auditoría de junio sigue siendo útil como **historia** (explica por qué el código está como está), pero no como descripción del presente.

### 8.7 Tests acoplados al entorno
4 de los 6 fallos vienen de asumir "el contenedor corre en UTC". En la máquina del autor (Argentina, UTC-3) esos tests **siempre fallan**. Eso entrena a la gente a ignorar rojo. Fix: inyectar el offset/`TZ` explícitamente en los tests (`process.env.TZ = "UTC"` en el setup, o pasar un `now` con offset y comparar contra el valor local esperado).

---

## 9. Hallazgos P2 — código muerto y duplicación

### 9.1 Módulos sin un solo importador en producción

| Módulo | Líneas aprox. | Nota |
|---|---|---|
| `src/server/providers/{index,nvidia,minimax,openrouter,ollama}.ts` | ~400 | Duplican `callNvidia/callMinimax/callOpenRouter` que viven **inline** en `koruBackend.ts`. Solo `providers/ainative.ts` se usa. |
| `src/server/tools/builtins.ts` | 1.294 | Duplica `getWeather`, `runSearch`, `geocodeCity`, `searchDuckDuckGo*`, `planFromState`, `queryPersonalContextFromState`, `personalCaptureFromArgs`… |
| `src/server/json.ts` | ~110 | Duplica `asRecord`, `asString`, `safeJsonParse`, `extractJsonBlock`, `cleanReplyText` de `koruBackend.ts` |
| `src/domain/kimiPrinciples.ts` | — | Sin referencias |
| `src/domain/config.ts` | ~110 | **La centralización de constantes de la "Fase 3.9" nunca se adoptó**: 0 importadores, y `0.65/0.85/0.95` siguen hardcodeados en `koruBackend.ts` |
| `CATEGORY_TOOLS` | ~28 | Declarado, jamás leído |

### 9.2 El sistema "Lectura" fuera del producto
17.955 líneas (52 interiores + 50 hojas CSS) consumidas por `/lectura.html`, `/all-cards.html`, `preview-data.ts` y `qa/grade-cards.test.tsx`. El chat **no las usa**. O son el destino del rediseño, o son 18k líneas de costo de mantenimiento.

### 9.3 `server-build/index.js` commiteado
Es el bundle compilado del servidor, versionado en git (a diferencia de `server-bundle.mjs`, que sí está ignorado). Un artefacto generado que puede divergir del fuente sin que nadie lo note.

### 9.4 Galerías de desarrollo en el build de producción
`vite.config.ts` declara 4 entrypoints: `index`, `preview`, `lectura`, `allcards`. El build de producción incluye el harness de cards (`preview.html`, `lectura.html`, `all-cards.html`) — útiles para diseñar, pero quedan servidos en el sitio público y suman chunks (524 kB gzip 152 kB para `michi-cards`).

### 9.5 Otros
- `Permissions-Policy: microphone=()` en `server/middleware.ts`. *(hipótesis, sin verificar)* podría bloquear el botón HABLAR (Web Speech) en producción. Vale un test manual en el celular.
- CORS whitelist con `localhost:5173/4173` pero el dev server real corre en **3000**.
- `vercel.json` reescribe `/api/*` a `koru-mvp.onrender.com` — funciona, pero ata el frontend al host de Render.
- 11 archivos `.tsx` de gallery/QA en `src/` compilan dentro del mismo `tsconfig`.

---

## 10. Lo que está bien y hay que proteger

1. **`structureExtractor`** — validación por cita literal, normalización de acentos, mínimo de 25 chars, dos extractores (datos y comparación de productos). Es el patrón que distingue al proyecto.
2. **El par `enhancementExtractor` (LLM propone) + `enhancementEngine` (determinista gobierna)** con `learningPreferences`. Extensible a cualquier dominio.
3. **`toolRegistry` / `policy`** con `risk`, `requiresApproval`, `autoRun` y razones legibles.
4. **`simulatedToolDetector`** — tolera 4 formatos de tool-call simulada para modelos que no soportan tool-use nativo.
5. **Pipeline de parseo defensivo** — `stripReasoning` (borra `<think>`, `<reasoning>`), `safeJsonObjectFromContent`, `extractJsonBlock`, `cleanReplyText`, fallbacks en cascada.
6. **Streaming NDJSON con heartbeat de 5 s + merge de bloques por tipo preservando ids.** El comentario explica un bug difícil ya resuelto.
7. **Auditoría QA**: `?koruAudit=1` + `manual-audits/koru-current.jsonl` con snapshot y delta por evento, más el rubric de 3 contextos (`src/qa/rubric.ts`). Muy poco común en un proyecto personal.
8. **Diseño de datos.** `UiBlock` como unión discriminada de 57 variantes + `KoruPresentation` como molde único: hace que el render sea seguro y la presentación, sustituible.
9. **TZ del usuario**, resuelto de punta a punta (`tzOffsetMin` viaja en el turn, `localDateISO`, `formatKickoffUserTz`, `dueAtFromText` en local).
10. **Fallback entre proveedores** con `Promise.any`, detección de 429 y AI Native como red final.

---

## 11. Roadmap propuesto (por ROI)

### Fase 0 — Verdad y estabilidad (días)
1. Unificar las rutas del backend en un módulo compartido → `npm run dev` con paridad total; mover el puerto de Vite a 5173 y ajustar `playwright.config.ts`.
2. Setear `KORU_API_KEY` en Render y definir la CORS whitelist real.
3. Investigar los 502 con logs de Render + `memoryUsage()` en `/api/health`.
4. `proactiveEngine`: sacar "Juan" (usar `userName` real) y mandar `commitments`/`records` reales desde `TalkOverlay`.
5. `MemoryToast`: cancelar el timer de montaje. *(2 tests vuelven a verde.)*
6. Dedupe intra-lote de memorias.
7. Tests: fijar `TZ`/locale en el setup → suite verde y reproducible.

### Fase 1 — Identidad (una semana)
8. Migrar strings user-facing y código interno a Michi (prompts, mensajes, logs, comentarios, clases CSS). **Dejar las claves de storage y, si se renombran, con migración explícita.**
9. Reescribir `README.md` con los números reales y archivar `docs/auditoria/` como histórico, marcándolo.

### Fase 2 — Consistencia (2–4 semanas)
10. Decidir y ejecutar: **una sola** definición de tools ofrecida al LLM (si 45 son suficientes, borrar las 89 restantes del envío y documentarlo; si no, subir el límite y medir). Eliminar o implementar `CATEGORY_TOOLS`.
11. Eliminar los módulos duplicados (`providers/*`, `tools/builtins.ts`, `json.ts`, `config.ts`) o hacer que el motor los consuma. Hoy son dos verdades.
12. Presupuesto de latencia por fase + cancelación real por turno; subir el timeout de `ai-assist` o moverlo al modelo rápido.
13. Partir `koruBackend.ts` (5.406) y `KoruProvider.tsx` (2.638) por responsabilidad.

### Fase 3 — Producto (mes)
14. Decidir el destino del sistema Lectura (18k líneas): adoptarlo en el chat o archivarlo.
15. Red de tests del camino vivo: `runKoruBackendTurn` con `callProvider` mockeado cubriendo los 3 fallbacks; reactivar los 60 tests apagados.
16. Convertir la deuda de las personas/voz en algo medible: un arnés que corra los 5 guiones del README contra producción y saque tiempo + calidad.

---

## 12. Apéndices

### A. Comandos útiles

```bash
cd koru-mvp
npx tsc --noEmit                     # 0 errores hoy
npm test -- src/ui/MemoryToast.test.tsx   # reproducir el bug real
npm test                             # suite completa (~30 s)
npm run build                        # tsc + vite build
npm run dev                          # :3000 (backend parcial)
npm run server                       # :3000 (backend completo) — no correr con dev
npx playwright test                  # E2E (fuerza :5173)
npm run qa:grade                     # rubric de calidad de cards
```

### B. Ramas con trabajo sin mergear

| Rama | Único commit | Estado |
|---|---|---|
| `origin/codex/michi-ui-unification` | "unify secondary screens with Michi and expand avatar selection" (+347 líneas, incluye `tests/e2e/michi-pages.spec.ts` y `MichiPage.tsx`) | **candidata a rescatar** |
| `origin/fix-deficiente-cards` | "AI Native Studio fallback + crypto empty state fix" | **superada** (main ya tiene `providers/ainative.ts`) |
| `audit-fixes-p0-p1` · `fix-comparison-v2` · `fix-crypto-empty` · `koru-2.0` · `v5-deploy` | 0 commits únicos | obsoletas, se pueden borrar |

### C. Contribuidores (por commits en el repo)

`Z User` 315 · `root` 187 · `Koru Dev` 180 · `Koru Audit Agent` 48 · `Arx88` 9.

### D. Presupuesto de tiempo de un turno (configurado en el código)

| Fase | Timeout |
|---|---|
| Primera llamada (Nemotron Ultra, remoto) | 60 s |
| Segunda llamada / síntesis | 30 s |
| Extractor | 30–45 s |
| Router (embeddings) | 10 s |
| `ai-assist` | 10 s (duro, con `Promise.race`) |
| Heartbeat NDJSON | cada 5 s |

---

*Informe generado sobre el estado real del repo y del servicio en producción. Cada afirmación de comportamiento fue medida; cada afirmación de código cita archivo y línea. Lo que quedó como hipótesis está marcado.*
