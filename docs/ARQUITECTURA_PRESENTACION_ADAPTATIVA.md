# Koru — Arquitectura de Presentación Adaptativa

> **Estado:** Diseño (pre-implementación)
> **Decisión rectora:** Calidad + Fluidez balanceadas. Detección híbrida: schema del dato + intención del agente.
> **Axioma:** La arquitectura NO depende del modelo. Funciona igual con cualquier proveedor.

---

## 0. Por qué este documento existe

Koru hoy genera respuestas de **texto** para todo. Cuando un usuario pregunta por resultados
deportivos, clima, gastos o comparativas, el LLM vuelca los datos en prosa. Eso produce:

- **Inconsistencia visual**: a veces card, a veces lista plana, a veces muro de texto.
- **Pérdida de estructura**: scores, horarios y precios se diluyen en oraciones.
- **Fragilidad**: el LLM puede alucinar o confundir datos que él mismo "recuerda".
- **Latencia**: el LLM pierde tiempo redactando lo que una card mostraría mejor.

La solución no es "21 cards sueltas elegidas al azar". Es un **sistema de presentación
adaptativa** que elige la forma visual óptima según la **forma de los datos** y la
**intención del momento**, de forma determinista y agnóstica al modelo.

---

## 1. Axiomas (no negociables)

| # | Axioma | Implicación |
|---|--------|-------------|
| A1 | **Agnosticismo del modelo** | Ninguna decisión de presentación depende de "qué modelo soporta". El contrato es el mismo con cualquier proveedor. |
| A2 | **El dato es la fuente de verdad** | Los datos numéricos/estructurados (scores, precios, horarios) **nunca** nacen del LLM. Nacen de tools. El LLM los enmarca, no los genera. |
| A3 | **La forma decide el visual** | La elección de card vs texto es una **función pura** sobre el schema del dato, validada por un motor determinista. No es una sugerencia del LLM. |
| A4 | **El agente propone, el motor gobierna** | El LLM puede enriquecer la card (destacar el equipo del usuario, sugerir ángulo). El motor **valida** esa propuesta contra el dato real. Si no calza, degrada a texto. |
| A5 | **Un solo turno de razonamiento** | No hay Router/Composer/Extractor aislados. Un único turno de agente con tool-use multi-paso, contexto compartido. |
| A6 | **Detección por concepto, no por vocabulario** | Cero palabras clave. La memoria se recupera por embeddings; la tool se elige por intención semántica; la card se elige por schema. |

---

## 2. Visión arquitectónica

```
   INTENCIÓN           DATOS            MARCO            VISUAL
   (embeddings)   →   (tool JSON)  →   (texto LLM)  →   (card motor)
        ↑                  ↑                ↑                  ↑
   concepto,           fuente de         voz de Koru       precisión,
   no palabras         verdad, no        cercanía,         control
                       prosa             no volcado        determinista
```

Cuatro columnas. Cada una resuelve **un problema distinto**. El error de hoy es que el
Composer intenta hacer las cuatro cosas a la vez, y por eso se le escapa la forma visual.

---

## 3. Flujo end-to-end

### 3.1 Diagrama

```
Usuario: "Hola Koru, ¿podrías decirme qué paso hoy en el mundial?"
    │
    ▼
┌───────────────────────────────────────────────────────┐
│ 1. AGENTE — un solo turno, con tool-use multi-paso    │
│                                                        │
│ Entradas:                                             │
│   • input del usuario                                 │
│   • memoria recuperada por EMBEDDINGS (no palabras)   │
│   • catálogo de TOOLS con schemas tipados             │
│   • catálogo de VISUALIZADORES disponibles            │
│                                                        │
│ El agente:                                            │
│   1. comprende intención por concepto                 │
│   2. llama sports_results(tournament, date) si hace   │
│      falta (loop: puede llamar varias tools)          │
│   3. recibe JSON estructurado tipado                  │
│   4. genera:                                          │
│      • reply: marco afectivo (corto, con voz de Koru) │
│      • presentationHint: propuesta de card opcional   │
│      • NO genera los datos (ya los tiene del JSON)    │
└───────────────────────────────────────────────────────┘
    │
    ▼  reply (texto) + presentationHint + toolResults (datos crudos)
┌───────────────────────────────────────────────────────┐
│ 2. PRESENTATION ENGINE — determinista, SIN LLM        │
│                                                        │
│ Recibe: presentationHint + toolResults                │
│                                                        │
│ Pipeline:                                             │
│   a. Detección por SCHEMA: ¿qué forma tienen los      │
│      datos? {home,away,score} → sports_scores         │
│   b. Validación del HINT del agente: ¿la propuesta    │
│      del LLM calza con el schema detectado?           │
│   c. Enriquecimiento: si el agente propuso            │
│      highlightTeam="Argentina" y Argentina está en    │
│      los datos, se acepta. Si no está, se ignora.     │
│   d. Selección de visualizador: schema → componente   │
│                                                        │
│ Si todo pasa → emite presentationBlock                │
│ Si algo falla → degrada a texto plano (lo de hoy)     │
└───────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────┐
│ 3. UI — render                                        │
│   [reply: texto afectivo del agente]                  │
│   [presentationBlock: card con datos de la tool]      │
└───────────────────────────────────────────────────────┘
```

### 3.2 Ejemplo concreto: consulta deportiva

**Usuario:** "Hola Koru, ¿podrías decirme qué paso hoy en el mundial?"

**Agente produce:**
```jsonc
{
  "reply": "¡Ahí va lo del Mundial! 🏆 Estuvieron cargaditos, che. Te marco el del día: España le metió una goleada a Arabia. Y ojo que a la noche juega Argentina, ¿lo seguís?",
  "presentationHint": {
    "kind": "sports_scores",
    "confidence": 0.95,
    "enrichment": { "highlightTeam": "Argentina" }  // de la memoria del usuario
  }
  // NO incluye scores, ni escudos, ni horas — eso viene del JSON de la tool
}
```

**Tool produjo (antes, en el loop del agente):**
```jsonc
{
  "tournament": "FIFA World Cup 2026",
  "phase": "Group Stage",
  "completed": [
    { "home": {"name":"Spain","code":"ESP"}, "away": {"name":"Saudi Arabia","code":"KSA"},
      "score": {"home":3,"away":0}, "status":"finished" },
    // ...
  ],
  "upcoming": [
    { "home": {"name":"Argentina","code":"ARG"}, "away": {"name":"Austria","code":"AUT"},
      "time":"18:54", "status":"scheduled" }
  ]
}
```

**Presentation Engine decide:**
- Schema detectado: `sports_scores` (los datos tienen `completed[]` con `home/away/score`) ✓
- Hint del agente: `kind:"sports_scores"` coincide con schema ✓
- Enriquecimiento: `highlightTeam:"Argentina"` — Argentina está en `upcoming` → se acepta ✓
- Resultado: `SportsScoresCard` con Argentina destacada

**UI renderiza:**
> **Koru:** ¡Ahí va lo del Mundial! 🏆 Estuvieron cargaditos, che...
>
> ┌─────────────────────────────────────────────┐
> │ 🏆 Mundial 2026 · Fase de grupos           │
> │ 🇪🇸 España    3 — 0  🇸🇦 Arabia Saudita    │
> │ 🇮🇷 Irán      0 — 0  🇧🇪 Bélgica          │
> │ 📅 Próximos                                 │
> │ 🇦🇷 Argentina vs 🇦🇹 Austria  18:54  ⭐   │
> └─────────────────────────────────────────────┘

---

## 4. Las tres piezas nuevas

### 4.1 Catálogo de Visualizadores

Un registro finito y **curado** de `schema → componente UI`. No es "21 cards sueltas".
Cada entrada es un **par categoría/visualizador** con un contrato explícito.

```ts
type VisualizerId =
  | "sports_scores"
  | "weather"
  | "money_summary"
  | "agenda"
  | "news_list"
  | "comparison_table"
  | "recipe"
  | "generic_list";   // fallback SIEMPRE disponible
```

**Regla de admisión (A7):** una categoría visual nueva solo se agrega cuando un tipo de
contenido aparece **repetidamente** en uso real y merece su propia forma. No se agregan
"por si acaso". El catálogo crece por demanda observada, no por imaginación.

| Visualizador | Schema requerido (mínimo) | Origen típico |
|---|---|---|
| `sports_scores` | `{tournament, completed[]: {home,away,score}, upcoming[]}` | `sports_results` |
| `weather` | `{city, temp, condition, feelsLike, forecast[]}` | `weather` (ya existe) |
| `money_summary` | `{total, currency, byCategory[]: {label, amount}}` | `money_query` (ya existe) |
| `agenda` | `{events[]: {title, time, location?}}` | `calendar_query` |
| `news_list` | `{items[]: {headline, source, url, timestamp}}` | `news_search` |
| `comparison_table` | `{subjects[], criteria[], matrix}` | `compare` |
| `recipe` | `{title, ingredients[], steps[]}` | `recipe` |
| `generic_list` | `{items[]: string}` o cualquier cosa | fallback |

**Por qué cada visualizador mapea a UN schema:** así la decisión visual es determinista
y agnóstica al modelo. La UI nunca pregunta "¿qué card pinto?". Pregunta "¿qué schema
tienen estos datos?".

### 4.2 Schemas tipados (contracts)

Cada tool devuelve JSON que **calza con un schema conocido** o cae al genérico.
Esto es lo que permite que la detección sea por forma, no por intención.

```ts
// Ejemplo: schema de sports_scores
interface SportsScoresData {
  tournament: string;
  phase?: string;
  completed: Array<{
    home:  { name: string; code: string };
    away:  { name: string; code: string };
    score: { home: number; away: number };
    status: "finished" | "live" | "scheduled";
    minute?: number;
    note?: string;
  }>;
  upcoming: Array<{
    home: { name: string; code: string };
    away: { name: string; code: string };
    time: string;
  }>;
}
```

**Validación:** el Presentation Engine usa un schema matcher que responde
`{ matched: "sports_scores", confidence: 0.9 }` o `{ matched: null }`.
Si el JSON de la tool no calza con ningún schema conocido → `generic_list` o texto plano.

### 4.3 Presentation Engine

El corazón nuevo. **Determinista, sin LLM.** Recibe el hint del agente + los datos de la
tool, y decide el visualizador. Es el gemelo del Enhancement Engine existente: el LLM
propone, el motor gobierna.

```ts
interface PresentationInput {
  hint?: {
    kind: VisualizerId;
    confidence: number;        // 0..1, lo que el agente "cree"
    enrichment?: Record<string, unknown>;
  };
  toolResults: ToolResult[];   // datos crudos, fuente de verdad
  userMemories?: MemoryFact[]; // para enriquecer (ej: equipo favorito)
}

interface PresentationDecision {
  visualizer: VisualizerId;           // elegido
  props: Record<string, unknown>;     // datos mapeados AL visualizador
  reason: "schema_match" | "hint_validated" | "fallback_text" | "no_data";
  degraded: boolean;                  // true si cayó a texto
}
```

**Pipeline interno:**

```
1. DETECCIÓN POR SCHEMA
   - Por cada toolResult, intentar matchear contra schemas conocidos.
   - Resultado: candidato dominante (el schema con mejor cobertura).

2. VALIDACIÓN DEL HINT
   - Si el agente propuso kind="sports_scores" y el schema detectado es "sports_scores"
     → confianza combinada alta → aceptar.
   - Si el hint dice "sports_scores" pero el schema detectado es "weather" (alucinación)
     → RECHAZAR el hint, usar el schema.
   - Si no hay hint pero hay schema claro → usar el schema.

3. ENRIQUECIMIENTO VALIDADO
   - Si el agente propuso highlightTeam="Argentina":
     ¿"Argentina" aparece en los datos reales?
       SÍ → aceptar el enriquecimiento.
       NO → ignorar (no inventar destacado).

4. MAPEO A PROPS
   - Transformar el JSON de la tool a los props del visualizador.
   - Los recursos visuales (escudos, banderas) se buscan en un CATÁLOGO,
     nunca los genera el LLM. flag("ARG") → 🇦🇷 / asset path.

5. DEGRADACIÓN HONESTA
   - Si no hay datos estructurados → texto plano.
   - Si los datos están vacíos (sin partidos hoy) → card informativa o texto.
   - Nunca se renderiza una card "rota" con datos faltantes.
```

---

## 5. El `presentationHint`: contrato agnóstico

El agente **puede** emitir un `presentationHint`, pero la arquitectura **no depende** de él.
Esto es clave para el axioma A1.

```ts
interface PresentationHint {
  kind: VisualizerId;            // propuesta del agente
  confidence: number;            // 0..1
  enrichment?: {
    highlightTeam?: string;      // "destacá a Argentina"
    personalAngle?: string;      // "conectá con su meta de ahorrar"
    sortBy?: "relevance" | "time" | "amount";
  };
}
```

**Por qué es opcional y no requerido:**

- Si el modelo es bueno y soporta tool-use + JSON estructurado → emite hint → enriquece.
- Si el modelo es débil o no soporta JSON → no emite hint → el Presentation Engine
  igual detecta el schema y elige la card. **El usuario no nota la diferencia.**

Esto es agnosticismo real: el **piso** de calidad (card correcta con datos exactos) está
garantizado por el schema matcher, que no necesita LLM. El **techo** de calidad
(enriquecimiento personalizado) lo aporta el agente cuando puede.

---

## 6. Agnosticismo del modelo: cómo se logra

El axioma A1 exige que cambiar de modelo NO rompa nada. Esto se logra con tres capas:

### 6.1 Adaptador de modelo

Un interface único que cualquier proveedor implementa:

```ts
interface AgentAdapter {
  // Un turno de agente: puede llamar tools en loop y devolver texto + datos.
  runTurn(input: AgentTurnInput): Promise<AgentTurnOutput>;
}

interface AgentTurnInput {
  userMessage: string;
  memories: RelevantMemory[];      // ya recuperadas por embeddings
  tools: ToolDefinition[];         // schemas, no lógica
  visualizers: VisualizerId[];     // catálogo disponible (para que el agente sepa)
  history: ChatMessage[];
}

interface AgentTurnOutput {
  reply: string;                   // texto afectivo
  toolCalls: ToolCall[];           // lo que pidió
  toolResults: ToolResult[];       // lo que las tools devolvieron
  presentationHint?: PresentationHint;  // OPCIONAL
}
```

### 6.2 Tres niveles de capacidad del modelo

El adaptador detecta la capacidad del modelo y se adapta, **sin cambiar el contrato**:

| Nivel | Capacidad del modelo | Implementación | Calidad |
|---|---|---|---|
| **L3** | Tool-use nativo + JSON limpio | Una sola llamada, el modelo hace todo | Óptima |
| **L2** | Tool-use nativo, JSON sucio | Una llamada + parser tolerante + healing | Alta |
| **L1** | Sin tool-use, solo texto | Loop de 2 llamadas máx (pedir tool, ejecutar, componer) | Aceptable |

**Crítico:** en los TRES niveles, el `toolResults` (datos) y el `reply` (texto) salen del
adaptador con la misma forma. El Presentation Engine no sabe ni le importa qué nivel se
usó. Por eso cambiar de modelo no rompe la presentación.

### 6.3 Lo que NUNCA se delega al modelo

- **Los datos numéricos** → vienen de tools. El modelo no los genera.
- **La elección final de card** → la decide el Presentation Engine sobre el schema.
- **Los recursos visuales** (escudos, banderas, íconos) → catálogo determinista.
- **La validación de enriquecimiento** → el motor verifica contra datos reales.

El modelo solo hace lo que hace bien: **comprender intención, elegir tool, enmarcar con voz.**

---

## 7. Proactividad: cómo encaja

La proactividad (heartbeat) hoy es un generador de nudges con regex frágiles. Con esta
arquitectura, la proactividad se vuelve **un caso más del agente**:

```
┌───────────────────────────────────────────────────┐
│ SCHEDULER (cron / service worker / backend)       │
│   trigger: "07:00, usuario despierta a las 7"     │
│   invoca al AGENTE con input sintético:           │
│   "Proactive check: weather + commitments"        │
└───────────────────────────────────────────────────┘
    │
    ▼
   [MISMO FLUJO DEL AGENTE]
    │
    ▼
   reply + presentationBlock
    │
    ▼
   Notificación push / tarjeta proactiva
```

El agente no sabe si lo invocó un humano o un scheduler. El contrato es el mismo.
Por eso la presentación adaptativa **habilita** la proactividad de calidad: el mismo
motor que pinta una card deportiva a pedido, pinta una card de "hoy llueve, llevá
paraguas" de forma proactiva.

---

## 8. Memoria semántica (dependencia blocking)

La detección por concepto (A6) exige embeddings. Hoy `selectRelevantMemories` usa
keyword matching, que falla ("dormir" vs "descansar" vs "insomnio").

**Esto es bloqueante para la cercanía.** Sin memoria semántica, el agente recibe
ruido o vacío, y la presentación adaptativa no tiene con qué enriquecer
(`highlightTeam` sale de la memoria).

**Dos opciones agnósticas:**

| Opción | Cómo | Tradeoff |
|---|---|---|
| **Embeddings locales** | Modelo de embeddings en Ollama (ej: `nomic-embed-text`). Vector store en IndexedDB. | Privacidad total, sin costo, requiere cómputo local. |
| **Embeddings via API** | FreeLLMAPI ya tiene `runFreeLlmEmbedding` implementado. | Depende del proveedor de embeddings, pero desacoplado del modelo de chat. |

Recomendación: **API primero** (ya está medio hecho), migrar a local cuando la privacidad
sea prioridad de producto. El contrato `embed(text) → vector` no cambia.

---

## 9. Migración: de lo que hay a lo que queremos

No se reescribe Koru. Se **reescriben 3 piezas** y se **agregan 3**.

### Reescribir

| Pieza | Hoy | Destino |
|---|---|---|
| `selectRelevantMemories` | keyword overlap | embeddings + cosine similarity |
| Flujo Router→Composer→Extractor | 3 LLMs aislados | 1 agente con tool-use (adaptador L1-L3) |
| `renderKoruResponse` (deprecated) | frases fijas | eliminar del camino principal |

### Agregar

| Pieza | Rol |
|---|---|
| **Catálogo de Visualizadores** | registro `schema → componente` |
| **Schemas tipados** | contracts por categoría de contenido |
| **Presentation Engine** | detección por schema + validación de hint, determinista |

### Lo que NO se toca

- UI de chat (HomeScreen, TalkOverlay, Onboarding) — solo agrega render de `presentationBlock`.
- Persistencia (IndexedDB).
- Enhancement Engine existente — se reutiliza su patrón de governance.
- Sistema de aprobaciones.
- Tests E2E.

---

## 10. Orden de implementación (recomendado)

Cada etapa entrega valor **por sí sola** y es reversible.

### Etapa 1 — Memoria semántica (BLOCKING para cercanía)
- Implementar `embed()` agnóstico (API primero).
- Vector store en IndexedDB.
- Reemplazar `selectRelevantMemories` por cosine similarity.
- **Métrica de éxito:** "¿cómo estoy durmiendo?" recupera la memoria de insomnio.

### Etapa 2 — Catálogo + Schemas (fundamento de presentación)
- Definir 4 schemas iniciales: `sports_scores`, `weather`, `money_summary`, `news_list`.
- Definir `generic_list` como fallback.
- Schema matcher (función pura, testeable).
- **Métrica:** dado un JSON de tool, el matcher devuelve el visualizador correcto.

### Etapa 3 — Presentation Engine (gobierno determinista)
- Pipeline: detección → validación de hint → enriquecimiento → mapeo → degradación.
- Integración con el flujo existente (recibe toolResults del backend actual).
- **Métrica:** consulta deportiva devuelve SportsScoresCard con datos exactos, cero alucinación.

### Etapa 4 — Adaptador de agente unificado (efficiency)
- Colapsar Router+Composer en un solo turno con tool-use.
- Implementar niveles L1/L2/L3 según capacidad del modelo.
- **Métrica:** latencia cae de ~13s a <8s en consultas con tool.

### Etapa 5 — Proactividad real
- Scheduler que invoca al agente con input sintético.
- Mismas cards, canal notificación.
- **Métrica:** "hoy llueve" llega sin que el usuario pregunte.

---

## 11. Anti-patrones a evitar

| Anti-patrón | Por qué es malo |
|---|---|
| "Que el LLM decida la card y la llene" | Inconsistencia + alucinación visual. Es lo de hoy. |
| "Palabras clave del usuario → card" | Rompe la cercanía. "Dormir" ≠ "descansar". |
| "Una card por cada idea" | Catálogo infinito = caos. La regla A7 frena esto. |
| "Depender de que el modelo soporte X" | Mañana cambiás de modelo y se rompe todo. |
| "Datos en el texto del LLM" | El LLM alucina números. Los datos van en la card. |
| "Card sin fallback a texto" | Siempre debe poder degradar. Una card rota es peor que texto. |

---

## 12. Métricas de calidad (cómo sabemos que funciona)

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| **Latencia p50 con tool** | < 8s | Log de `/api/koru/turn` |
| **Card correcta (datos exactos)** | > 98% | Eval: comparar card vs fuente |
| **Cero alucinación visual** | 0 escudos/scores inventados | Eval manual + catálogo cerrado |
| **Memoria semántica recall** | > 80% en tests de sinónimos | Eval: "dormir" encuentra "insomnio" |
| **Degradación honesta** | 100% de fallos → texto, nunca card rota | Eval: tool vacía → texto |
| **Consistencia visual** | misma intención → misma forma | Eval: 10 frases deportivas → 1 card |

---

## 13. Resumen ejecutivo

**El problema:** Koru vuelca todo en prosa. El LLM hace de router, composer, extractor Y
diseñador visual. Sobrecargado, inconsistente, frágil.

**La solución:** Separar cuatro trabajos (intención / dato / marco / visual) en cuatro
piezas con contratos claros. El LLM solo hace intención + marco. Los datos vienen de
tools. La visualización la decide un motor determinista sobre el schema del dato.

**El principio rector:** la forma del dato decide la forma de mostrarlo. No las palabras
del usuario, no el capricho del LLM, no el modelo que tengas puesto.

**Lo que cambia para el usuario:** respuestas más rápidas, visuales precisos, Koru que se
acuerda por concepto, cards que nunca mienten. Cercanía en el texto, precisión en la card.

**Lo que NO cambia:** la UI que ya tenés, la persistencia, el enhancement engine, el tono
de Koru. Se agregan piezas, no se tira lo bueno.

**Agnosticismo:** todo el sistema funciona igual con cualquier modelo. El piso de calidad
(schema → card correcta) no necesita LLM. El techo (enriquecimiento personalizado) lo
aporta el agente cuando puede.
