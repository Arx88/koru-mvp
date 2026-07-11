# Plan: Flujo del Agente con Router LLM

> **Objetivo:** que la búsqueda/ejecución de herramientas SIEMPRE funcione,
> sin importar si el modelo soporta tool-use nativo o no.
> **Agnóstico al modelo. Sin palabras clave. Mínima injerencia.**

---

## 0. El problema que resuelve

HOY el flujo depende de que el modelo llame `web_search` nativamente. Lo vimos
con evidencia: MiniMax a veces lo hace (bien), a veces escribe "Déjame buscar..."
en prosa (mal), a veces simula la tool en texto (medio mal). Eso hace a Koru
**no confiable**: la mitad de las veces no ejecuta lo que promete.

El Router LLM rompe esa dependencia: **el modelo ya no decide si ejecutar tools**.
Decide la intención. La ejecución es nuestra.

---

## 1. Principios (no negociables)

| # | Principio | Implicación |
|---|-----------|-------------|
| P1 | **Agnóstico al modelo** | Funciona igual con MiniMax, GPT, o un modelo local abierto. El Router usa la misma `chatFn` inyectada que ya usamos. |
| P2 | **Decide intención, no vocabulario** | El Router clasifica por **categoría semántica** (¿info del mundo? ¿contexto personal? ¿acción local? ¿charla?), no por palabras. "Qué onda el mundial" y "resultados de la copa" llegan a la misma clase. |
| P3 | **Mínima injerencia** | El Router solo decide: `¿necesita tool?` y `¿cuál?`. Todo lo demás (tono, +1, iniciativa, cómo enmarcar) lo sigue decidiendo el modelo libremente. El Router es guardarrayas, no dictador. |
| P4 | **Fallback honrado** | Si el Router no está seguro (confianza baja), NO fuerza tool → deja al modelo responder conversacional. Nunca inventa. |
| P5 | **Una sola intención por turno** | El Router emite a lo sumo UNA tool. Sin loops complejos. Simple y predecible. |

---

## 2. El flujo rediseñado

```
Usuario: "Hola Koru, ¿podrías decirme qué paso hoy en el mundial?"
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ PASO 1 — ROUTER LLM (1 llamada, ~2-4s)               │
│                                                       │
│ Input: mensaje del usuario (solo eso, sin tools)     │
│ Output JSON: {                                        │
│   category: "world_info" | "personal" | "action" |   │
│             "conversation",                           │
│   tool?: "web_search" | "weather" | "shopping_compare"│
│         | "plan_day" | "query_personal_context",      │
│   toolArgs?: { query, city, ... },                    │
│   confidence: 0..1                                    │
│ }                                                     │
│                                                       │
│ Reglas del Router:                                    │
│ - No decides tono ni respuesta. Solo categoría+tool. │
│ - Si confidence < 0.6 → tool=null (dejar al modelo).  │
│ - Si es "conversation" → tool=null siempre.           │
│ - Los toolArgs se extraen del mensaje (query, city).  │
└──────────────────────────────────────────────────────┘
    │
    ├─ tool=null (confianza baja o conversación)
    │     └─▶ ir al PASO 3 directo (Compositor sin tools)
    │
    └─ tool=web_search (u otra)
          │
          ▼
┌──────────────────────────────────────────────────────┐
│ PASO 2 — EJECUCIÓN DE TOOL (sin LLM, determinista)    │
│                                                       │
│ Ejecuta la tool indicada por el Router con toolArgs.  │
│ Ej: web_search({query}) → sources[]                  │
│                                                       │
│ Emite chunk intermedio de progreso (web_nav/loading).  │
└──────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────┐
│ PASO 3 — COMPOSER LLM (1 llamada, sin tools)          │
│                                                       │
│ Input: mensaje + memoria + toolResults (si los hay)  │
│ Output JSON: { reply, mascotState, uiBlocks? }        │
│                                                       │
│ El Composer NO decide tools. Solo compone texto       │
│ usando los datos que ya tiene (de memoria o tools).   │
│ Es libre para tono, +1, iniciativa, empatía.          │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ PASO 4 — PRESENTACIÓN (determinista, sin LLM)         │
│                                                       │
│ blocksFromToolResults → uiBlocks                      │
│ El Composer no genera datos: solo los enmarca.        │
└──────────────────────────────────────────────────────┘
    │
    ▼
UI: reply (texto) + uiBlocks (cards)
```

---

## 3. Comparación con el flujo actual

| Aspecto | HOY | CON ROUTER |
|---------|-----|------------|
| ¿Quién decide ejecutar tools? | El modelo (vía tool-use nativo, inconsistente) | El Router (LLM dedicado, decisión binaria) |
| Llamadas al LLM | 1-3 (Router nativo + Composer + a veces segunda) | 2 fijas (Router + Composer) |
| Fiabilidad | ~50% (depende del modelo) | ~95%+ (el Router decide, no el modelo) |
| Latencia | 30-60s (con reintentos por JSON inválido) | ~20-30s proyectado (sin reintentos) |
| Dependencia de tool-use nativo | Alta | Cero |
| Complejidad del prompt del Composer | Alta (tiene que decidir tools Y componer) | Baja (solo compone) |

---

## 4. Por qué esto NO mata la flexibilidad

- El usuario puede pedir las cosas **como se le cante**: "qué onda el mundial",
  "resultados", "che lo de ayer", "cómo le va a mi equipo". El Router entiende
  intención semántica, no vocabulario.
- El Composer sigue siendo **libre**: tono cercano, humor, +1, iniciativa, empatía,
  preguntas de seguimiento. El Router no toca nada de eso.
- Lo único que cambia: **la ejecución de la tool siempre pasa** cuando corres.
  No más "déjame buscar..." sin búsqueda.

---

## 5. El prompt del Router (borrador)

```
Sos el router de Koru. Tu ÚNICO trabajo es clasificar la intención del mensaje
del usuario y decidir si necesita una herramienta. No respondés al usuario.

Categorías:
- world_info: información del mundo exterior que cambia (noticias, deportes,
  precios de mercado, resultados, actualidad). → web_search
- personal_query: datos que Koru ya guardó del usuario (gastos, listas,
  compromisos, memorias). → query_personal_context
- shopping: comparativa o recomendación de compra. → shopping_compare
- weather: condiciones meteorológicas. → weather
- plan: organizar el día o priorizar tareas. → plan_day
- action: crear alarma, recordatorio, guardar algo. → sin tool (Compositor decide)
- conversation: saludo, charla, emoción, opinión, agradecimiento. → sin tool

Reglas:
- Extraé los toolArgs del mensaje (query, city, etc.) cuando aplique.
- Si dudás (confidence < 0.6), devolvé tool=null. No inventes.
- No decidís tono ni respuesta. Solo categoría + tool + args.

Devolvé SOLO JSON: {"category":"...","tool":"...","toolArgs":{...},"confidence":0.0}
```

El prompt es corto (~300 tokens) y la salida es JSON chico. La llamada es rápida.

---

## 6. Por qué 2 llamadas y no 1

Se podría argumentar: "por qué no un solo LLM que haga todo (decida + ejecute + componga)".
Razones para separar:

1. **Confiabilidad.** Un LLM que hace todo es más propenso a fallar en algo
   (se distrae componiendo y olvida la tool). Separar aisla responsabilidades.
2. **Agnosticismo.** El Router necesita JSON estricto y poco. El Composer necesita
   texto rico. Requisitos opuestos. Modelos distintos los hacen mejor.
3. **Mantenibilidad.** Si el tono de Koru cambia, toco solo el Composer. Si las
   tools cambian, toco solo el Router. Sin acoplamiento.
4. **Latencia controlada.** 2 llamadas cortas (Router 2-4s + Composer 8-15s) son
   más predecibles que 1 llamada larga con reintentos.

---

## 7. Migración: del flujo actual al nuevo

### Qué se reemplaza
- `runKoruBackendTurn` principal → nuevo flujo Router → Tool → Composer.

### Qué se reutiliza
- `callProvider` (ya abstrae MiniMax/NVIDIA/OpenRouter).
- `executeTool` y todas las tools (weather, web_search, etc.).
- `blocksFromToolResults` (presentación).
- `selectRelevantMemories` (memoria, hoy keyword, futuro embeddings).
- El `simulatedToolDetector` queda como capa de compatibilidad adicional
  (si el Router devuelve tool pero el Composer igual simula, lo interceptamos).

### Qué NO toca
- UI (chatCards, KoruProvider stream handling).
- Persistencia.
- Enhancement engine.
- Los fixes de UX recientes (barra indeterminada, orden invertido).

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Router devuelve JSON inválido | `parseJsonObjectStrict` + fallback a "conversation" (deja al modelo responder) |
| Router clasifica mal (falso positivo) | confidence < 0.6 → sin tool. El usuario nota conversación, no error. |
| Router cae (timeout) | Fallback: saltar al Composer directo (como hoy) |
| Latencia extra del Router (~3s) | Aceptable: +3s garantiza que la tool funcione vs -3s con 50% de fallo |
| Router demasiado rígido | P3: decide solo categoría+tool, no tono. El Composer sigue libre. |

---

## 9. Orden de implementación

1. **`src/domain/router.ts`** — el Router LLM (chatFn inyectada, prompt, parser).
   Tests unitarios con casos reales (mundial, Boca, clima, charla, gastos).
2. **Integración en `runKoruBackendTurn`** — nuevo flujo: Router → si tool, ejecutar → Composer.
   Mantener el flujo viejo como fallback si el Router falla.
3. **Prueba E2E** con las 5 queries que históricamente fallaban:
   - "qué pasó hoy en el mundial"
   - "juega Boca hoy"
   - "últimas noticias de AGT"
   - "cómo le fue a mi equipo"
   - "hola Koru" (no debe disparar tool)
4. **Métrica de éxito:** 5/5 queries ejecutan lo correcto (tool cuando corres,
   conversación cuando no). Sin timeouts.

---

## 10. Lo que este plan NO incluye (deuda futura)

- **Memoria semántica (embeddings)** — sigue siendo keyword matching por ahora.
  Es bloqueante para cercanía pero ortogonal al Router. Trabajo separado.
- **data_card (extractor)** — desactivado del turno. Se reactiva como llamada
  diferida del frontend después, cuando el pipe base sea confiable.
- **Unificación Router+Composer en un turno con tool-use nativo** (nivel L3 del
  documento de arquitectura) — futuro, cuando confirmemos que el Router es robusto.
