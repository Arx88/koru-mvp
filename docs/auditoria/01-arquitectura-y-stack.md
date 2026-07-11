# Koru — 01. Arquitectura y Stack Técnico

> **Auditoría completa del código fuente.**
> **Fecha:** 2026-06-23
> **Repositorio:** `D:/ZomboidServer/koru-mvp`
> **Método:** Lectura íntegra de los ~19.000 líneas de TypeScript del `src/`, `vite.config.ts`, tests E2E y configuración. Documentación externa ignorada como fuente de verdad: el código es la única autoridad.

---

## 1. Qué es Koru (según el código)

Koru es una **PWA (aplicación web progresiva) local-first de asistente personal**, construida en torno a una **mascota virtual conversacional**. Funcionalmente intenta ser, simultáneamente:

- **Agenda y recordatorios** (alarmas, tareas, compromisos, eventos ICS).
- **Gestor de vida doméstica** (gastos, comidas/inventario, listas de compras, decisiones de compra).
- **Buscador web semántico** (noticias, clima, comparativas de productos, rutas, señales del mundo).
- **Sistema de memoria persistente confirmable** (preferencias, rutinas, objetivos, relaciones, límites).
- **Compañero empático con personalidad calibrada** (voz cálida/directriz/humor ajustable).

Su rasgo diferenciador es que la **memoria es confirmable**: Koru propone hechos como "candidatos" y el usuario los "riega" (confirma) o "poda" (descarta), usando la metáfora de un jardín que crece con la confianza (`seed → sprout → roots → born → garden`).

### 1.1 La decisión arquitectónica más inusual: backend embebido en Vite

El motor de IA **no es un servicio separado**. Vive dentro de un plugin del dev-server de Vite (`vite.config.ts`). Esto significa que:

- Mientras se ejecuta `npm run dev`, Vite sirve el frontend con HMR **y** expone un servidor HTTP que orquesta los LLM.
- No hay carpeta `server/` independiente en producción; el código "server" (`src/server/`) es código Node que **solo se invoca desde los middlewares de Vite**.
- En consecuencia, **no se puede desplegar en hosting estático** (Vercel/Netlify) sin refactorizar el backend a un endpoint serverless o un proceso separado.

Esta decisión fue deliberada para un MVP: evita configurar un servidor Node aparte, manejar CORS y desplegar dos servicios. El costo es la portabilidad de despliegue.

### 1.2 Tabla de localización de cada pieza

| Capa | Archivos clave | Líneas aprox. |
|------|----------------|---------------|
| **Infraestructura / Dev server** | `vite.config.ts` | ~952 |
| **Backend / Motor LLM** | `src/server/koruBackend.ts`, `src/server/logger.ts` | ~3.280 |
| **Tipos centrales** | `src/domain/types.ts` | 618 |
| **Estado y reducers** | `src/domain/store.ts` | ~914 |
| **Orquestador LLM (legacy)** | `src/domain/orchestrator.ts` | 666 |
| **Propuestas locales (legacy)** | `src/domain/actions.ts` | 1.667 |
| **Cerebro reflexivo (legacy)** | `src/domain/brain.ts` | 1.204 |
| **Motor activo de UI** | `src/ui/KoruProvider.tsx` | 1.806 |
| **Chat principal** | `src/ui/TalkOverlay.tsx` | 476 |
| **21 tipos de tarjetas** | `src/ui/chatCards.tsx` | 1.407 |
| **Persistencia** | `src/domain/persistence.ts`, `src/domain/calendar.ts` | ~216 |
| **Router semántico (embeddings)** | `src/domain/semanticRouter.ts` | 276 |
| **Anti-alucinación** | `src/domain/structureExtractor.ts` | 273 |
| **Mejoras +1** | `src/domain/enhancementExtractor.ts`, `src/domain/enhancementEngine.ts` | ~450 |
| **Compatibilidad modelos sin tools** | `src/domain/simulatedToolDetector.ts` | 149 |
| **Herramientas** | `src/domain/toolRegistry.ts` | 434 |
| **Tests E2E** | `tests/e2e/koru.spec.ts` | 403 |

---

## 2. Stack técnico exacto (de `package.json`)

**Runtime / framework:**
- `react@^19.2.3`, `react-dom@^19.2.3` (React 19 — APIs más recientes).
- `vite@^8.0.12` (Vite 8 con Rolldown como bundler).
- `typescript@~6.0.2` con `target: es2023`, `strict` implícito, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals/Parameters`.
- `tailwindcss@^4.3.1` con `@tailwindcss/vite`, `tw-animate-css`.
- `lucide-react@^0.561` (iconografía).

**Testing:**
- `vitest@^4.1.9` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` (unit/integración).
- `@playwright/test@^1.61` con proyectos `desktop` y `mobile (Pixel 7)` (E2E).

**Ausencias notables:**
- **No** usa Redux, Zustand, Jotai ni ningún gestor de estado externo. Todo el estado global vive en un único `KoruContext` con `useReducer`/`useState` + `useRef` espejo.
- **No** usa `zod` para validación (a pesar de que un agente lo mencionó; `schemas.ts` implementa validación a mano).
- **No** usa un framework de SSR; es 100% cliente.
- **No** tiene `eslint`/`prettier` configurados en `package.json` (hay `eslint-disable` sueltos en el código, indicando que existió linting pero no está formalizado).

---

## 3. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVEGADOR (cliente)                                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  React 19 UI                                             │    │
│  │  TalkOverlay (chat) · HomeScreen · MemoryScreen · ...    │    │
│  │            ▲                                             │    │
│  │            │ consume useKoru()                           │    │
│  │  ┌─────────┴───────────────────────────────────────┐     │    │
│  │  │ KoruProvider (Context + useReducer)              │     │    │
│  │  │  - domainState (KoruState)                       │     │    │
│  │  │  - chatTurns                                     │     │    │
│  │  │  - submitEntry → runBackendAgentTurn             │     │    │
│  │  │  - persistencia: localStorage + IndexedDB        │     │    │
│  │  └───────────────┬─────────────────────────────────┘     │    │
│  │                  │ fetch /api/koru/turn (NDJSON stream)   │    │
│  └──────────────────┼────────────────────────────────────────┘    │
└─────────────────────┼─────────────────────────────────────────────┘
                      │ HTTP (solo en `npm run dev`)
┌─────────────────────┼─────────────────────────────────────────────┐
│  DEV SERVER DE VITE (vite.config.ts)                              │
│  Plugins:                                                         │
│   • koruBackendAgent → POST /api/koru/turn, GET /api/koru/models   │
│   • koruAiProxy     → POST /koru-ai/*                             │
│   • koruWebProxy    → POST /koru-web/search                       │
│   • koruAuditLogger → POST /koru-audit/log                        │
│   • proxy /ollama → http://127.0.0.1:11434                        │
│                                                                   │
│  runKoruBackendTurn()                                             │
│   ├─ SemanticRouter (Ollama nomic-embed-text) → decide tool       │
│   ├─ callProvider: MiniMax → NVIDIA/Ollama → OpenRouter           │
│   ├─ executeProviderToolCalls: weather/web_search/.../save_*      │
│   ├─ structureExtractor (deferred, anti-alucinación)              │
│   ├─ enhancementExtractor + enhancementEngine (+1)                │
│   └─ finalizePayload → JSON                                       │
└────────┬──────────────────┬───────────────┬────────────┬─────────┘
         │                  │               │            │
    ┌────▼────┐       ┌─────▼─────┐   ┌─────▼────┐  ┌────▼─────┐
    │ MiniMax │       │ NVIDIA /  │   │ OpenRouter│  │ Web APIs │
    │ api.m.  │       │ Ollama    │   │ (free)   │  │ DuckDuckGo│
    └─────────┘       └───────────┘   └──────────┘  │ GDELT     │
                                                     │ Open-Meteo│
                                                     │ OSRM      │
                                                     │ Brave/Tavily/
                                                     │  Serper/NewsAPI/
                                                     │  GNews/SearXNG │
                                                     └───────────┘
```

### 3.1 Flujo de un turno conversacional (en producción)

1. **Usuario escribe/habla** → `TalkOverlay.handleTextSubmit` → `sendMessage` (en `KoruProvider`).
2. `submitEntry(text)` construye el payload `{input, state, history, model}` y llama a `runBackendAgentTurn` (en `backendAgentClient.ts`) que hace `POST /api/koru/turn`.
3. El servidor (`vite.config.ts` → `koruBackendAgent`) invoca `runKoruBackendTurn` (en `koruBackend.ts`).
4. `buildMessages` arma los mensajes con `systemPrompt` (personalidad + memorias relevantes + records recientes) + historial (últimos 10 turnos) + input.
5. **Semantic Router** (si Ollama está disponible) decide la intención por similitud de embeddings *antes* de llamar al LLM. Si detecta una tool, la ejecuta directamente.
6. Si no, `callProvider` intenta **MiniMax → NVIDIA/Ollama → OpenRouter** con fallback entre proveedores.
7. Si el LLM pidió tool-calls nativos → `executeProviderToolCalls` las ejecuta (weather, web_search, shopping_compare, plan_day, query_personal_context, save_memory, save_personal_item, deliver_response).
8. Si el LLM no usó tools nativos pero simuló una tool-call en texto → `detectSimulatedToolCall` la intercepta (compatibilidad con modelos como Qwen3, DeepSeek-R1).
9. Tras las tools, segunda llamada al LLM (sin tools) para **componer el reply final en JSON**.
10. En paralelo: `structureExtractor` valida datos extraídos contra citas literales (anti-alucinación); `enhancementExtractor` + `enhancementEngine` generan el "+1".
11. El resultado final se `finalizePayload` y se devuelve (con streaming NDJSON intermedio para feedback de progreso).
12. El cliente hace **merge por tipo de block** (preservando IDs para no desmontar componentes animados) y aplica el resultado al `domainState`.

---

## 4. Proveedores de LLM soportados

| Proveedor | Rol | Endpoint | Modelos |
|-----------|-----|----------|---------|
| **MiniMax** | Default (si hay token) | `api.minimax.io/v1/chat/completions` | `MiniMax-M2.7` (hardcodeado) |
| **NVIDIA Integrate** | Default sin MiniMax | `integrate.api.nvidia.com/v1/chat/completions` | configurable (`nvidia/nemotron-3-ultra-550b-a55b` default) |
| **Ollama (local)** | Vía "NVIDIA" si base URL incluye `:11434` | `<base>/api/chat` | configurable (ej. `koru-qwen-32k`, `qwen3.6:27b`) |
| **OpenRouter** | Fallback (carrera `Promise.any`) | `openrouter.ai/api/v1/chat/completions` | hasta 3 modelos × 3 keys |
| **Ollama embeddings** | Solo para Semantic Router | `<base>/api/embeddings` | `nomic-embed-text` |

**Política de fallback en `callProvider`:**
1. MiniMax (si `minimaxAccessToken` vía `minimax-oauth-token.json`).
2. Si no hay NVIDIA key → OpenRouter directo.
3. NVIDIA/Ollama (timeout 20s cloud / 90s Ollama).
4. Si NVIDIA falla por rate-limit → propaga error; si falla por otra causa → OpenRouter.

**Modelos gratuitos del `.env`:** `OPENROUTER_FALLBACK_MODELS` default incluye `nemotron-3-ultra-550b`, `gpt-oss-120b:free`, `gemma-4-31b-it:free`.

---

## 5. Sistema de datos y persistencia

### 5.1 `KoruState` (verdad única del dominio)

Definido en `src/domain/types.ts:572`. Contiene:
- `userName`, `stage`, `trustedEnergy`, `totalEnergy`, `voicePreference`, `runtime`, `heartbeat`.
- Arreglos: `memories`, `commitments`, `actions`, `calendarEvents`, `records`, `entries`, `energyEvents`, `nudges`, `modelCalls`, `learningPreferences`.
- Flags de autonomía: `ephemeralMode`, `durableMemoryEnabled`, `actionPreparationEnabled`, `worldSignalsEnabled`.

### 5.2 Almacenamiento dual

- **IndexedDB** (`koru-local-first`, store `state`, key `current`): almacenamiento primario y asíncrono. Soporta volúmenes mayores que `localStorage`.
- **`localStorage`** (`koru.mvp.state.v1`): fallback síncrono "legacy". `normalizeState` al cargar hace merge y migración.

`saveState` escribe en ambos; `loadPersistedState` prefiere IndexedDB y migra desde legacy si hace falta.

### 5.3 Límites de compaction (hardcodeados en `KoruProvider.applyBackendTurnToState`)

- `chatTurns`: 120 turnos.
- `records`: 500.
- `modelCalls`: 120.
- `memories`/`nudges`: 200/80 (legacy).

Esto es necesario por el límite de ~5 MB de `localStorage`, aunque IndexedDB permitiría más.

---

## 6. Endpoints HTTP expuestos por el dev-server

| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/koru/turn` | Turno del agente (streaming NDJSON si `stream:true`). |
| GET | `/api/koru/models` | Lista de modelos disponibles (predefinidos + Ollama `/api/tags`). |
| POST | `/koru-ai/*` | Proxy OpenAI-compatible con fallback NVIDIA→OpenRouter. |
| POST | `/koru-web/search` | Búsqueda web multi-proveedor (Brave/Serper/Tavily/NewsAPI/GNews/SearXNG/GDELT/Open-Meteo/OSRM + Playwright fallback). |
| POST | `/koru-audit/log` | Log de auditoría para QA (`?koruAudit=1`). |
| ALL | `/ollama/*` | Proxy directo a Ollama local (`127.0.0.1:11434`). |

---

## 7. Configuración (`tsconfig.json`, `playwright.config.ts`)

- **TS**: `target es2023`, `module esnext`, `moduleResolution bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noEmit`. Linting estricto: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. **No** aparece `strict: true` explícito — ausencia notable para un proyecto de este tamaño.
- **Vite**: `host 0.0.0.0`, `port 5200`, `watch.ignored manual-audits`, proxy `/ollama`. Plugins: backend, ai-proxy, web-proxy, audit, tailwind, react.
- **Playwright**: `baseURL 127.0.0.1:5173` (¡inconsistencia con el `port 5200` de Vite! probablemente sobrescrito por flag en tests), `trace retain-on-failure`, proyectos desktop + mobile.

---

## 8. Observaciones críticas de arquitectura

1. **Dos motores paralelos.** El motor client-side (`orchestrator` + `brain` + `actions` + `pipeline` + `agentKernel`, ~3.700 líneas) y el server-side (`koruBackend.ts`, ~3.165 líneas) coexisten. La UI **solo** usa el segundo vía `runBackendAgentTurn`. El primero está testeado pero efectivamente muerto en runtime → deuda estructural mayor (ver documento 05).
2. **Backend acoplado al dev-server.** Bloquea cualquier despliegue estático. Para producción habría que extraer `koruBackend.ts` + los middlewares a un proceso Express/Hono independiente.
3. **Tres mecanismos de routing solapados**: `localRoute` (heurístico, legacy), `SemanticRouter` (embeddings, activo), y el router nativo vía tool-calls del LLM. Cada uno con su propia taxonomía de intenciones, sin contrato unificado.
4. **`KoruProvider.tsx` como God-component**: 1.806 líneas mezclando store + orquestación de red + mapeos dominio↔UI + streaming + auditoría.
5. **Validación sin `zod`**: `schemas.ts` reimplementa validación a mano, lo que duplica esfuerzo y es propenso a errores. La importación de `zod` sugerida por un agente no existe en el código.
