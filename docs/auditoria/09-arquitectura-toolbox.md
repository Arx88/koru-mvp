# Koru — 09. Arquitectura del ToolBox (capa externa al motor)

> **Objetivo:** añadir 120 tools a Koru **sin tocar el motor** (`runKoruBackendTurn`, `callProvider`, fallbacks, streaming, Semantic Router, composición de respuesta).
>
> **Acuerdo:** solo 2 puntos quirúrgicos en `koruBackend.ts` (extensión, no cambio de lógica) + toda la implementación en archivos nuevos bajo `src/tools/`.

---

## 1. Qué NO se toca (contrato sagrado)

Estos elementos de `src/server/koruBackend.ts` quedan **idénticos línea por línea**:

| Elemento | Líneas aprox. | Razón |
|----------|---------------|-------|
| `runKoruBackendTurn` | 2827–3165 | El cerebro del agente. Decide, orquesta, compone. |
| `callProvider` + `callMinimax`/`callNvidia`/`callOpenRouter` | 499–756 | Fallbacks entre proveedores. |
| `executeProviderToolCalls` | 2650–2691 | Bucle que ejecuta tools nativas. |
| `buildEnhancementInstruction` | 2644–2710 | Sistema del +1. |
| `getRouter`/`buildEmbedFn`/routerSingleton | 2717–2755 | Semantic Router. |
| `finalizePayload`/`finalizeFromPlainText`/`normalizeFinalPayload` | 2580–2601, 2476–2559 | Composición de respuesta. |
| `systemPrompt` + `stateSummary` | 1735–1805 | Personalidad Koru. |
| Parser JSON defensivo (`safeJsonObjectFromContent`, etc.) | 405–471 | Robustez ante LLM. |

**No se añade ni se quita lógica de orquestación.** El motor sigue tomando las mismas decisiones.

---

## 2. Los 2 puntos quirúrgicos (lo único que se modifica en el motor)

### Punto 1 — `TOOL_DEFINITIONS` se vuelve dinámico (lín. 172)

**Hoy:** array literal con 9 tools hardcodeadas.
**Después:** se construye desde el ToolBox externo.

```ts
// ANTES:
const TOOL_DEFINITIONS = [
  { type: "function", function: { name: "weather", ... } },
  // ... 8 más hardcodeadas
] as const;

// DESPUÉS:
import { ALL_TOOL_DEFINITIONS } from "../tools/toolbox";
const TOOL_DEFINITIONS = ALL_TOOL_DEFINITIONS;
```

**Impacto:** 0 cambios en `callProvider`/`callNvidia`/etc. porque ya referencian `TOOL_DEFINITIONS` por nombre. Solo cambia de dónde viene el array. Las 9 tools actuales se migran al ToolBox para que todo viva en un solo sitio.

### Punto 2 — `executeTool` usa un dispatcher (lín. 1713)

**Hoy:** `if/else if` con 10 ramas hardcodeadas.
**Después:** lookup en un `Map<string, ToolHandler>`.

```ts
// ANTES:
async function executeTool(name, args, state, extractorCtx) {
  if (name === "weather") result = await getWeather(args);
  else if (name === "web_search") ...
  // ... 8 ramas más
  else return { result: { type: "unknown", error: `Unknown tool ${name}` } };
}

// DESPUÉS:
import { TOOL_BOX } from "../tools/toolbox";
async function executeTool(name, args, state, extractorCtx) {
  const handler = TOOL_BOX.get(name);
  if (!handler) return { result: { type: "unknown", error: `Unknown tool ${name}` } };
  const result = await handler.run(args, state, { userInput: cleanText(args.__userInput) });
  return { result: result as Record<string, unknown>, deferredDataCard: result.deferredDataCard };
}
```

**Impacto:** el comportamiento es idéntico para las tools existentes; las nuevas simplemente aparecen como nuevas entradas del `Map`. El contrato de `executeTool` (recibe `name/args/state/extractorCtx`, devuelve `{result, deferredDataCard?}`) no cambia, así que `executeProviderToolCalls` (lín. 2677) no se toca.

> **Nota sobre `weather`/`web_search`:** hoy viven como funciones privadas en `koruBackend.ts` (`getWeather`, `runSearch`). Las migraré a `src/tools/builtin/weather.ts` y `src/tools/builtin/web.ts`, exportándolas para que el dispatcher las encuentre. El código se mueve, no se reescribe — mismo comportamiento, mejor organización.

---

## 3. Estructura de archivos del ToolBox

```
src/tools/
├── toolbox.ts              ← El registry central. Exporta TOOL_BOX (Map) y ALL_TOOL_DEFINITIONS.
├── types.ts                ← Contrato ToolHandler, ToolDefinition, ToolRunContext.
├── shared/
│   ├── cache.ts            ← Cache TTL en memoria + IndexedDB (Nominatim 1/s, OSRM, GDELT).
│   ├── rateLimiter.ts      ← Rate limit por API (Nominatim 1 req/s estricto).
│   ├── fetcher.ts          ← fetch con timeout, retry, User-Agent propio (KoruLocal/1.0).
│   ├── extractor.ts        ← Wrapper de structureExtractor para tools que leen la web.
│   ├── scrapers.ts         ← DuckDuckGo/Bing/Playwright wrappers (reutiliza los de vite.config).
│   └── embeddings.ts       ← Ollama nomic-embed-text (reutiliza buildEmbedFn).
├── builtin/                ← Las 9 tools actuales migradas (mismo comportamiento).
│   ├── weather.ts
│   ├── webSearch.ts
│   ├── shoppingCompare.ts
│   ├── routeTraffic.ts
│   ├── planDay.ts
│   ├── queryPersonalContext.ts
│   ├── saveMemory.ts
│   ├── savePersonalItem.ts
│   └── deliverResponse.ts
├── sports/                 ← 10 tools nuevas
├── food/                   ← 10 tools nuevas
├── travel/                 ← 10 tools nuevas
├── money/                  ← 15 tools nuevas
├── trending/               ← 10 tools nuevas
├── people/                 ← 5 tools nuevas
├── apps/                   ← 4 tools nuevas
├── docs/                   ← 36 tools nuevas (md/pdf/word/excel/notes/projects/data)
├── knowledge/              ← 10 tools nuevas (wikipedia, dictionary, translate, etc.)
├── health/                 ← 6 tools nuevas
├── utils/                  ← 4 tools nuevas
└── index.ts                ← Barrel: importa todas y las registra en TOOL_BOX.
```

**Principio:** cada tool es un archivo `.ts` autocontenido que exporta su `definition` y su `handler`. El `toolbox.ts` los agrega al `Map`. Añadir/quitar una tool = añadir/quitar un archivo + una línea en `index.ts`.

---

## 4. El contrato `ToolHandler` (types.ts)

```ts
export type ToolRunContext = {
  userInput: string;              // el texto del usuario (para __userInput, capturas, etc.)
  state: KoruState;               // estado actual (memorias, records, commitments)
  signal?: AbortSignal;           // para cancelación (si el usuario cierra el chat)
  onProgress?: (note: string) => void;  // feedback durante ejecución larga
};

export type ToolHandler = {
  /** Esquema OpenAI-function-style que se envía al LLM. */
  definition: {
    type: "function";
    function: {
      name: string;
      description: string;        // en español, con variantes léxicas
      parameters: object;         // JSON Schema
    };
  };
  /** Política de seguridad (sigue toolRegistry.ts). */
  policy: {
    risk: "readonly" | "local_write" | "external_side_effect" | "financial" | "destructive";
    requiresApproval: boolean;
    autoRun: boolean;
  };
  /** Ejecuta la tool. Devuelve un resultado plano + opcional deferredDataCard. */
  run(args: Record<string, unknown>, ctx: ToolRunContext): Promise<ToolRunResult>;
};

export type ToolRunResult = Record<string, unknown> & {
  deferredDataCard?: Promise<UiBlock | null>;  // para data_card anti-alucinación diferida
};
```

**Por qué este contrato:**
- `definition` es lo que el LLM necesita ver (encaja directo en `TOOL_DEFINITIONS`).
- `policy` sigue el sistema existente de `toolRegistry.ts` (las `requiresApproval`/`destructive` se respetan).
- `run` recibe contexto suficiente sin acoplarse al motor (no recibe `messages` ni `config` de proveedores).
- `deferredDataCard` preserva el patrón anti-alucinación que ya tiene el motor.

---

## 5. Ejemplo de una tool nueva (patrón canónico)

`src/tools/sports/matchLive.ts`:

```ts
import type { ToolHandler } from "../types";

export const matchLive: ToolHandler = {
  definition: {
    type: "function",
    function: {
      name: "match_live",
      description: "Obtén el marcador en vivo, minuto y eventos de un partido de fútbol, básquet, tenis, golf u otro deporte que se esté jugando ahora. Formas de pedirlo: '¿cómo va el partido?', '¿va ganando X?', 'a qué hora juega Y', 'resultado en vivo'.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "Equipos, liga o jugador (ej: 'Boca River', 'Real Madrid', 'Wimbledon')." },
        },
        required: ["query"],
      },
    },
  },
  policy: { risk: "readonly", requiresApproval: false, autoRun: true },
  async run(args) {
    const query = String(args.query ?? "").trim();
    if (!query) return { type: "match", status: "failed", error: "Falta indicar el partido." };
    // 1. Cache check (TTL 30s para datos en vivo)
    // 2. Llamar a TheSportsDB + ESPN (vía shared/fetcher con User-Agent KoruLocal/1.0)
    // 3. Normalizar resultado
    // 4. Devolver estructura plana
    return { type: "match", status: "ok", query, /* ... datos */ };
  },
};
```

**Registro en `src/tools/sports/index.ts`:**
```ts
export { matchLive } from "./matchLive";
export { leagueStandings } from "./leagueStandings";
// ...
```

**Registro central en `src/tools/toolbox.ts`:**
```ts
import { matchLive, leagueStandings, /* ... */ } from "./sports";
import { restaurantDeepSearch, /* ... */ } from "./food";
// ...

export const TOOL_BOX = new Map<string, ToolHandler>([
  [matchLive.definition.function.name, matchLive],
  [leagueStandings.definition.function.name, leagueStandings],
  // ... 120 entradas
]);

export const ALL_TOOL_DEFINITIONS = Array.from(TOOL_BOX.values()).map((t) => t.definition);
```

---

## 6. El wrapper anti-alucinación (shared/extractor.ts)

Para que todas las tools que leen la web reutilicen el `structureExtractor` del motor **sin acoplarse a él**:

```ts
// src/tools/shared/extractor.ts
import { extractStructuredData, type ExtractionResult } from "../../domain/structureExtractor";
import type { AssistantSource } from "../../domain/types";

/**
 * Recibe fuentes crudas y devuelve items validados (cada uno con cita literal
 * que aparece en algún source). Si el LLM alucina un dato sin respaldo, se descarta.
 * Reutiliza el structureExtractor del motor — no reescribe la lógica.
 */
export async function validateWithCitations(
  userInput: string,
  sources: AssistantSource[],
  chatFn: (messages: { role: string; content: string }[], opts: { temperature: number; maxTokens: number }) => Promise<{ content: string }>,
): Promise<ExtractionResult> {
  return extractStructuredData({ userInput, sources, chatFn });
}
```

**Lo usan:** `restaurant_deep_search`, `product_review`, `price_compare_product`, `deep_research`, `restaurant_review_aggregate`, `visa_check`, etc. — todo lo que lee la web y necesita anti-alucinación.

---

## 7. Cache y rate limiting (shared/cache.ts + rateLimiter.ts)

Para respetar las políticas verificadas:

```ts
// src/tools/shared/rateLimiter.ts
export function rateLimiter(maxPerSec: number) {
  const queue: Array<() => void> = [];
  let running = 0;
  return async function acquire(): Promise<void> {
    if (running >= maxPerSec) await new Promise<void>((r) => queue.push(r));
    running++;
    setTimeout(() => { running--; queue.shift()?.(); }, 1000 / maxPerSec);
  };
}

export const nominatimLimiter = rateLimiter(1);  // 1 req/s estricto
export const gdeltLimiter = rateLimiter(2);
// ...
```

```ts
// src/tools/shared/cache.ts
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  // 1. IndexedDB lookup
  // 2. Si fresh, devuelve
  // 3. Si no, ejecuta fn, guarda, devuelve
}
```

**Lo usan:** todas las tools con APIs rate-limited. TTL por dominio (clima 10min, deportes 30s, divisas 1h).

---

## 8. Flujo completo de una tool nueva

```
Usuario: "¿cómo va Boca-River?"
  ↓
runKoruBackendTurn (MOTOR — intacto)
  ↓
LLM (MiniMax/NVIDIA/OpenRouter) decide llamar a "match_live"
  ↓ TOOL_DEFINITIONS ahora incluye match_live (Punto 1)
executeProviderToolCalls (MOTOR — intacto)
  ↓
executeTool("match_live", {query:"Boca River"}, state)  (Punto 2)
  ↓
TOOL_BOX.get("match_live").run(args, ctx)        (src/tools/sports/matchLive.ts)
  ↓
cache check → rate limiter → fetch TheSportsDB → normalizar
  ↓
result = { type:"match", status:"ok", score:"1-2", minute:"67'", events:[...] }
  ↓
vuelve a executeProviderToolCalls → segunda llamada LLM → composer arma reply
  ↓
Koru: "Boca 1 - River 2, van 67 minutos. River ganaba 0-2 y Boca descontó."
```

El motor hace exactamente lo mismo que hoy; solo que ahora sabe de 120 tools en vez de 9.

---

## 9. Compatibilidad con el motor legacy

El motor client-side (`orchestrator`+`brain`+`actions`) usa `toolRegistry.ts` (el registry viejo de 8 tools con `resultToUiBlocks`, `pendingUiBlocks`, etc.). **No se toca** — queda como está, en su isla legacy.

El ToolBox nuevo es consumido **solo por el motor server-side** (`koruBackend.ts`). Si en el futuro se elimina el legacy, no hay que tocar nada del ToolBox.

---

## 10. Plan de migración de las 9 tools actuales

Para que todo viva en un solo sitio (principio DRY), las 9 tools hardcodeadas se mueven a `src/tools/builtin/`. Es **mover código, no reescribirlo**:

| Tool actual (en koruBackend.ts) | Destino | Función origen |
|---------------------------------|---------|----------------|
| `weather` | `src/tools/builtin/weather.ts` | `getWeather` (se exporta) |
| `web_search` | `src/tools/builtin/webSearch.ts` | `runSearch` (se exporta) |
| `shopping_compare` | `src/tools/builtin/shoppingCompare.ts` | `runSearch(args, true)` |
| `route_traffic` | `src/tools/builtin/routeTraffic.ts` | `runSearch({mode:"research"})` |
| `plan_day` | `src/tools/builtin/planDay.ts` | `planFromState` |
| `query_personal_context` | `src/tools/builtin/queryPersonalContext.ts` | `queryPersonalContextFromState` |
| `save_memory` | `src/tools/builtin/saveMemory.ts` | `memoryCaptureFromArgs` |
| `save_personal_item` | `src/tools/builtin/savePersonalItem.ts` | `personalCaptureFromArgs` |
| `deliver_response` | `src/tools/builtin/deliverResponse.ts` | (especial: termina el turno) |

**Riesgo:** bajo. Cada tool se mueve con sus tests existentes como red de seguridad. Si algo rompe, el test lo caza antes de merge.

---

## 11. Activación/desactivación por config (opcional, futuro)

Como las tools viven en un `Map`, es trivial añadir un config que las active/desactive sin recompilar:

```ts
// .env
KORU_TOOLS_ENABLED=match_live,restaurant_deep_search,currency_convert
KORU_TOOLS_DISABLED=shell_run,file_write

// src/tools/toolbox.ts
const enabled = (env.KORU_TOOLS_ENABLED?.split(",").map(s=>s.trim()) ?? "*");
const disabled = new Set((env.KORU_TOOLS_DISABLED ?? "").split(","));
export const TOOL_BOX = new Map([...allTools].filter(([name]) => /* ... */));
```

Permite al usuario elegir qué tools quiere. **No se implementa ahora** pero la arquitectura lo permite sin tocar el motor.

---

## 12. Orden de implementación sugerido

Para no perderse en 120 archivos, conviene construir por capas:

1. **Esqueleto** (~1 día): `types.ts`, `toolbox.ts`, `shared/`, migración de las 9 builtin + los 2 puntos quirúrgicos. En este punto Koru funciona idéntico pero con la nueva arquitectura.
2. **FASE 1 cotidiana** (~3 días): sports + food + money + trending + memory (las 30 más usadas).
3. **FASE 2 planificación** (~4 días): travel + people + docs (los 50 de documentos y viajes).
4. **FASE 3 nicho** (~3 días): health + utils + knowledge + apps (los 40 restantes).

**Cada tool lleva su test mínimo** (happy path + caso de error de API). Las críticas (food deep search, money, memory) llevan tests más completos.

---

## 13. Validación final

Antes de generar 120 archivos, este diseño responde a:

- ✅ **¿El motor queda intacto?** Sí — `runKoruBackendTurn` y todo su flujo no se tocan.
- ✅ **¿Las 2 modificaciones son de extensión, no de cambio de lógica?** Sí — `TOOL_DEFINITIONS` se vuelve dinámico y `executeTool` usa un dispatcher; el comportamiento es idéntico para tools existentes.
- ✅ **¿Las tools nuevas viven aisladas?** Sí — todo bajo `src/tools/`.
- ✅ **¿Se reutiliza el anti-alucinación del motor?** Sí — vía `shared/extractor.ts` que envuelve `structureExtractor`.
- ✅ **¿Se respetan las políticas de rate-limit de las APIs?** Sí — `shared/rateLimiter.ts` por API.
- ✅ **¿Las 9 tools actuales siguen funcionando igual?** Sí — se migran con sus tests como red de seguridad.
- ✅ ✅ **¿Es mantenible añadir la tool 121?** Sí — un archivo + una línea.

---

*Siguiente paso tras validar este diseño: implementar el esqueleto (punto 12.1) y mostrar el diff de los 2 puntos quirúrgicos para aprobación antes de generar las 120 tools.*
