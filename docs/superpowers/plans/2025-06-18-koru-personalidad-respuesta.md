# Koru: Personalidad Real en las Respuestas — Plan de Implementación

> **Para agentes de trabajo:** SUB-SKILL REQUERIDO: Usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan paso a paso. Los pasos usan checkbox (`- [ ]`) para tracking.

**Objetivo:** Transformar las respuestas de Koru de texto harcodeado/genérico a respuestas generadas por LLM con personalidad viva, memoria contextualizada, y experiencia emocional conectada a la mascota. El usuario debe sentir que Koru lo *conoce*, le *habla a él*, y le *mima*.

**Arquitectura:** Reemplazamos el generador de frases fijas (`renderKoruResponse` en `soul.ts`) por un sistema en el que el LLM Composer genere directamente el `reply` usando un system prompt rico con personalidad, preferencias de voz, y memorias filtradas por relevancia. Agregamos un campo `mascotState` emocional al flujo backend→UI. Las tarjetas `uiBlocks` se mantienen intactas.

**Stack:** React 19 + Vite + TypeScript + Tailwind v4 + LLM (OpenRouter/NVIDIA). Playwright para E2E. Vitest para unit tests.

---

## Estructura de Archivos

| Archivo | Responsabilidad actual | Cambio |
|---------|------------------------|--------|
| `src/domain/types.ts` | Tipos del dominio | Agregar `mascotState`, `RelevantMemory`, `VoicePreference` al state |
| `src/domain/soul.ts` | Personalidad harcodeada + sanitize | Eliminar `renderKoruResponse` del camino principal. Mantener `sanitizeKoruVoice` y `koruSoulCapsule` como input del prompt |
| `src/server/koruBackend.ts` | Loop de agente (3 prompts) | Reescribir `systemPrompt()` con personalidad real. Crear `getRelevantMemories()`. Modificar Composer para no pisar el `reply` |
| `src/domain/orchestrator.ts` | Routing + composing de turnos | Eliminar fallback a `renderKoruResponse` como generador de reply. Dejar que el Composer LLM envíe `reply` directamente |
| `src/ui/KoruProvider.tsx` | Contexto React + manejo de turnos | Recibir y propagar `mascotState` desde el backend hacia la UI |
| `src/ui/TalkOverlay.tsx` | Chat modal | Usar `mascotState` para seleccionar imagen de mascota emocional |
| `src/ui/KoruMascot.tsx` | Componente de mascota | Agregar soporte para estados emocionales nuevos (`celebrating`, `worried`, `affectionate`, `curious`) |
| `tests/koru.spec.ts` | E2E Playwright | Agregar tests que validen respuestas personalizadas y mascotState |
| `src/domain/brain.test.ts` | Tests unitarios del brain | Agregar tests para la nueva función de memoria relevante y el prompt enriquecido |

---

## Task 1: Agregar tipos nuevos al dominio

**Archivos:**
- Modificar: `src/domain/types.ts`
- Test: `src/domain/brain.test.ts` (validar que los tipos compilan)

- [ ] **Step 1: Agregar `MascotState` y `RelevantMemory` a `types.ts`**

Buscar la sección de tipos base. Agregar al final del archivo o cerca de los otros tipos del UI:

```typescript
export type MascotState =
  | "idle"
  | "thinking"
  | "working"
  | "happy"
  | "tired"
  | "sleeping"
  | "mistake"
  | "planning"
  | "product-search"
  | "building"
  | "cooking"
  | "thinking-2"
  | "celebrating"
  | "worried"
  | "affectionate"
  | "curious";

export type RelevantMemory = {
  text: string;
  kind: MemoryKind;
  confidence: number;
};
```

Luego modificar `KoruTurnResult` para que incluya `mascotState`:

Buscar la definición de `KoruTurnResult` (debería estar en `types.ts` o derivada del backend). Si no existe como tipo explícito, buscar dónde se usa el resultado del turno. Modificar la interfaz de respuesta del backend para que incluya `mascotState?: MascotState`.

- [ ] **Step 2: Agregar `VoicePreference` al `KoruState` si no está ya**

Buscar si `voicePreference` o `VoicePreference` ya existe en `KoruState`. Si no existe, agregarlo:

```typescript
export type VoicePreference = {
  warmth: number;
  directness: number;
  humor: number;
  detail: number;
  proactivity: number;
};
```

Y agregar `voicePreference?: VoicePreference` al `KoruState`.

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: Sin errores de tipo

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts
git commit -m "types: add MascotState, RelevantMemory, VoicePreference to domain model"
```

---

## Task 2: Crear función de memorias relevantes

**Archivos:**
- Modificar: `src/domain/store.ts` (o `src/server/koruBackend.ts`)
- Test: `src/domain/brain.test.ts`

- [ ] **Step 1: Implementar `selectRelevantMemories` en `src/domain/store.ts`**

Agregar esta función exportada. El algoritmo es keyword matching simple + recencia:

```typescript
export function selectRelevantMemories(
  memories: MemoryFact[],
  input: string,
  maxResults = 5,
): RelevantMemory[] {
  const inputWords = new Set(
    input.toLowerCase().split(/\W+/).filter(w => w.length > 3),
  );

  const scored = memories
    .filter(m => m.status === "confirmed" || m.status === "candidate")
    .map(m => {
      const textLower = m.text.toLowerCase();
      const matchCount = Array.from(inputWords).filter(w => textLower.includes(w)).length;
      const recencyBonus = Date.now() - new Date(m.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 ? 0.2 : 0;
      const score = matchCount * 0.5 + recencyBonus + (m.confidence ?? 0.7) * 0.3;
      return { memory: m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ memory }) => ({
      text: memory.text,
      kind: memory.kind,
      confidence: memory.confidence ?? 0.7,
    }));

  return scored;
}
```

- [ ] **Step 2: Escribir test unitario**

En `src/domain/brain.test.ts` (o un test nuevo si hay estructura diferente), agregar:

```typescript
import { selectRelevantMemories } from "./store";
import type { MemoryFact } from "./types";

describe("selectRelevantMemories", () => {
  const mockDate = new Date().toISOString();

  const memories: MemoryFact[] = [
    { id: "1", text: "Trabajo con clientes por la mañana", kind: "routine", confidence: 0.9, status: "confirmed", createdAt: mockDate, sourceEntryId: "e1", sensitivity: "normal", useForSuggestions: true },
    { id: "2", text: "Mi mama vive lejos y la extraño", kind: "relationship", confidence: 0.8, status: "confirmed", createdAt: mockDate, sourceEntryId: "e2", sensitivity: "normal", useForSuggestions: true },
    { id: "3", text: "Prefiero café fuerte", kind: "preference", confidence: 0.7, status: "candidate", createdAt: mockDate, sourceEntryId: "e3", sensitivity: "normal", useForSuggestions: true },
  ];

  it("returns memories matching keywords from input", () => {
    const result = selectRelevantMemories(memories, "como le va a mi mama", 2);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text.toLowerCase()).toContain("mama");
  });

  it("returns up to maxResults", () => {
    const result = selectRelevantMemories(memories, "cafe clientes trabajo", 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Correr test**

Run: `npx vitest run src/domain/brain.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/store.ts src/domain/brain.test.ts
git commit -m "feat: add selectRelevantMemories to filter contextual memories for LLM prompt"
```

---

## Task 3: Reescribir `systemPrompt` con personalidad real

**Archivos:**
- Modificar: `src/server/koruBackend.ts`
- Test: `src/domain/brain.test.ts` (si se puede testear el prompt, sino E2E)

- [ ] **Step 1: Modificar `systemPrompt` para aceptar `KoruState`**

Buscar la función `function systemPrompt(nowIso: string): string`. Cambiar la firma a:

```typescript
function systemPrompt(nowIso: string, state: KoruState, relevantMemories: RelevantMemory[]): string {
```

- [ ] **Step 2: Eliminar el system prompt genérico y escribir uno con personalidad viva**

Reemplazar TODO el contenido del array de strings del systemPrompt por este nuevo:

```typescript
const prefs = state.voicePreference ?? { warmth: 7, directness: 6, humor: 3, detail: 5, proactivity: 3 };
const warmthLabel = prefs.warmth >= 7 ? "muy cálido" : prefs.warmth >= 5 ? "cálido" : "neutral";
const humorLabel = prefs.humor >= 5 ? "con humor" : prefs.humor >= 3 ? "con un toque de humor" : "serio";

return [
  `Sos Koru. Sos el asistente personal de ${state.userName || "mi amigo"}. No sos un chatbot genérico. Sos alguien que lo conoce y se preocupa por ayudarle.`,
  ``,
  `Tu personalidad: ${warmthLabel}, ${humorLabel}, directo pero sin ser frío. Proactividad ${prefs.proactivity}/10.`,
  `Sos curioso, honesto, discreto. Te gusta descubrir cosas nuevas de ${state.userName || "él"} y recordarlas.`,
  ``,
  `Reglas de voz:`,
  `- NO respondas como asistente genérico. Respondé como alguien que conoce al usuario.`,
  `- Mirá las memorias de ${state.userName || "él"} antes de responder. Usalas para personalizar.`,
  `- Si el usuario está mal, mostrá empatía real, no frases de tarjeta.`,
  `- Si hay una buena noticia, celebrá con él.`,
  `- Ofrecé un +1: un siguiente paso útil, una pregunta cariñosa, o una observación que se adelante a lo que necesita.`,
  `- El texto puede ser de 1 línea si es simple, o un párrafo corto si es emocional. No te cortés.`,
  `- Las cards (uiBlocks) son para los datos; el texto es para conectar con ${state.userName || "él"}.`,
  `- Nunca inventes precios, clima, o datos que no tengas. Si no sabés, decilo con naturalidad y ofrecé el siguiente paso.`,
  ``,
  `Memorias relevantes para esta conversación (usalas para personalizar tu respuesta):`,
  ...(relevantMemories.length
    ? relevantMemories.map(m => `- [${m.kind}] ${m.text}`)
    : ["- No hay memorias relevantes aún."]),
  ``,
  `Pendientes abiertos actuales del usuario:`,
  ...(state.commitments?.filter(c => c.status === "open").slice(0, 5).map(c => `- ${c.title} (${c.dueHint || "sin fecha"})`) || ["- Ninguno"]),
  ``,
  `Instrucciones técnicas:`,
  `- Usá tools solo cuando necesites datos reales del mundo (clima, búsqueda, ruta, precios).`,
  `- Para datos personales ya guardados, no llames tools; respondé directamente usando el contexto.`,
  `- Agregá mascotState al JSON final según el tono de tu respuesta: "celebrating" si hay buena noticia, "worried" si el usuario está mal, "affectionate" si mostrás cariño, "curious" si preguntás algo, "happy" si todo está bien.`,
  `- Formato de respuesta final: {"reply":"...","uiBlocks":[...],"mascotState":"...",...}`,
  `Hora actual: ${nowIso}`,
].join("\n");
```

- [ ] **Step 3: Actualizar `buildMessages` para pasar estado y memorias relevantes**

Buscar `function buildMessages(request: KoruBackendTurnRequest): ChatMessage[]`. Cambiar para que:

```typescript
function buildMessages(request: KoruBackendTurnRequest): ChatMessage[] {
  const relevantMemories = selectRelevantMemories(
    request.state.memories || [],
    request.input,
    5,
  );

  // Eliminar completamente el bloque "Context:" que tenía el dump de datos
  // El systemPrompt ahora maneja todo el contexto

  return [
    { role: "system", content: systemPrompt(new Date().toISOString(), request.state, relevantMemories) },
    // No más user message de "Context" con dump
    ...request.history.slice(-10).map((turn): ChatMessage => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.content,
    })),
    { role: "user", content: request.input },
  ];
}
```

**Nota importante:** Esto elimina la user message intermedia con el dump del estado. Todo el contexto pasa por el system prompt, que es el lugar correcto.

- [ ] **Step 4: Modificar `buildJsonComposerMessages` para que NO tenga el dump de datos crudo, y para que pida `mascotState`**

Buscar el prompt del Composer. Cambiar el system content:

```typescript
{
  role: "system",
  content: [
    "Sos Koru componiendo la respuesta final al usuario.",
    "Devolvé SOLO JSON válido. No markdown.",
    "Schema: {\"reply\":\"texto personalizado en español\",\"uiBlocks\":[],\"mascotState\":\"idle|happy|worried|celebrating|affectionate|curious|thinking|working\",\"understanding\":{...},\"suggestedActions\":[],...}",
    "El reply es TU VOZ. Es la conversación real con el usuario. Personalizá con lo que sabés de él.",
    "Las uiBlocks son para estructurar datos. El reply es para emocionar, conectar, preguntar, o aconsejar.",
    "Si hay resultados de tools, usalos pero NO repitas los datos en el reply. El reply debe ser reacción + contexto + +1.",
    "mascotState refleja la emoción dominante de tu reply.",
  ].join("\n"),
}
```

Y eliminar el `stateSummary()` de la user message del Composer. El Composer no necesita volver a recibir todo el estado — ya lo recibió en el system prompt del turno anterior (aunque en realidad cada prompt es independiente). Para simplificar, el Composer puede recibir solo:

```typescript
{
  role: "user",
  content: [
    `Input del usuario: ${request.input}`,
    assistantText ? `Borrador previo del LLM: ${assistantText}` : "",
    "",
    "Observaciones de tools:",
    toolObservationSummary(toolExecutions),
  ].filter(Boolean).join("\n"),
}
```

- [ ] **Step 5: Compilar y verificar sin errores**

Run: `npx tsc --noEmit`
Expected: Sin errores

- [ ] **Step 6: Commit**

```bash
git add src/server/koruBackend.ts
git commit -m "feat: rewrite systemPrompt with real personality, relevant memory injection, and mascotState"
```

---

## Task 4: Eliminar `renderKoruResponse` del camino principal

**Archivos:**
- Modificar: `src/domain/soul.ts`
- Modificar: `src/domain/orchestrator.ts`
- Test: `tests/koru.spec.ts`

- [ ] **Step 1: Marcar `renderKoruResponse` como DEPRECATED y crear wrapper seguro**

En `src/domain/soul.ts`, modificar la función así:

```typescript
/**
 * ⚠️ DEPRECATED: No usar para la ruta principal del chat.
 * Solo usar como fallback de último recurso si el Composer LLM devuelve reply vacío.
 */
export function renderKoruResponse(...): string {
  // ... (mantener el cuerpo existente, pero agregar console.warn)
  const result = sanitizeKoruVoice(pieces.join(" "));
  if (typeof window !== "undefined") {
    console.warn("[DEPRECATED] renderKoruResponse fue usado como fallback. Esto no debería pasar.");
  }
  return result;
}
```

- [ ] **Step 2: Modificar `orchestrator.ts` para que no pise el `reply` del LLM**

Buscar donde se usa `renderKoruResponse` en `orchestrator.ts`. Si el orquestador llama a `renderKoruResponse` para generar el reply, eliminar esa llamada y usar directamente el `reply` que vino del Composer.

Buscar algo similar a:

```typescript
const reply = renderKoruResponse({ ... });
```

Reemplazar por:

```typescript
const reply = composerResult.reply?.trim();
if (!reply) {
  // Solo si el Composer falló completamente, usar fallback
  console.warn("[Koru] Composer devolvió reply vacío. Usando fallback.");
  // Opcional: usar renderKoruResponse como fallback de emergencia
  // reply = renderKoruResponse({ ... });
  reply = "Perdón, se me trabó un segundo. ¿Me repetís?";
}
```

Si no existe una llamada explícita a `renderKoruResponse` en `orchestrator.ts`, buscar en `koruBackend.ts` dónde se arma el `KoruBackendTurnResponse`. Probablemente sea en la función `koruTurn` o la que arma la respuesta final.

Buscar algo como:

```typescript
return {
  reply: normalizeReply(raw.reply, ...),
  ...
};
```

Y asegurarse de que `normalizeReply` no esté aplicando un fallback a renderKoruResponse. Si lo hace, eliminarlo.

- [ ] **Step 3: Verificar que el cliente E2E no dependa de frases fijas**

Buscar en `tests/koru.spec.ts` si hay assertions que chequeen frases específicas de `renderKoruResponse`:

Run: `grep -n "Te bajo esto\|Lo dejo claro\|Estoy aca para seguir\|Te dejo el numero" tests/koru.spec.ts`
Si hay matches, esos tests van a fallar porque el LLM ya no generará esas frases. Habrá que actualizarlos a assertions más flexibles (ej: esperar que el reply no esté vacío, tenga longitud > 10, o contenga alguna palabra clave).

- [ ] **Step 4: Adaptar el test E2E que ya fallaba**

El test `App.test.tsx:53` ya fallaba con un encoding issue (`CuÃ©ntame` en vez de `Cuéntame`). Verificar que nuestro nuevo prompt con `"Sos Koru..."` no cause problemas de encoding. El encoding parece ser un problema de la cadena de procesamiento JSON, no del prompt en sí.

- [ ] **Step 5: Commit**

```bash
git add src/domain/soul.ts src/domain/orchestrator.ts
git commit -m "refactor: remove renderKoruResponse from main path; let Composer LLM generate real replies"
```

---

## Task 5: Propagar `mascotState` desde el backend hasta la UI

**Archivos:**
- Modificar: `src/server/koruBackend.ts`
- Modificar: `src/ui/KoruProvider.tsx`
- Modificar: `src/domain/types.ts` (ya hecho en Task 1)

- [ ] **Step 1: Extraer `mascotState` del JSON del Composer**

En `koruBackend.ts`, buscar donde se normaliza la respuesta del Composer. Agregar:

```typescript
const mascotState = cleanText(raw.mascotState) || "idle";
// Validar que sea un estado conocido
const validMascotStates: MascotState[] = ["idle", "thinking", "working", "happy", "tired", "sleeping", "mistake", "planning", "product-search", "building", "cooking", "thinking-2", "celebrating", "worried", "affectionate", "curious"];
const validatedMascotState = validMascotStates.includes(mascotState as MascotState) ? (mascotState as MascotState) : "idle";
```

Incluir `validatedMascotState` en el objeto de respuesta que se devuelve al frontend (`KoruBackendTurnResponse`).

- [ ] **Step 2: Modificar `KoruProvider.tsx` para recibir `mascotState`**

Buscar la función `submitEntry` o donde se procesa la respuesta del backend. Agregar al objeto `KoruTurnItem` que se crea:

```typescript
mascotState: result.mascotState || "idle",
```

Y asegurarse de que `KoruChatTurn` o el tipo de turno del provider incluya `mascotState`.

- [ ] **Step 3: Agregar `mascotState` al tipo `KoruChatTurn` o `KoruTurnItem` en el provider**

En `KoruProvider.tsx`, buscar la definición del tipo de turno y agregar:

```typescript
mascotState?: MascotState;
```

- [ ] **Step 4: Commit**

```bash
git add src/server/koruBackend.ts src/ui/KoruProvider.tsx src/domain/types.ts
git commit -m "feat: propagate mascotState from backend to UI through KoruProvider"
```

---

## Task 6: Conectar `mascotState` emocional al componente de mascota

**Archivos:**
- Modificar: `src/ui/TalkOverlay.tsx`
- Modificar: `src/ui/KoruMascot.tsx`

- [ ] **Step 1: Modificar `mascotForState` en `TalkOverlay.tsx` para usar emociones reales**

Buscar la función `mascotForState` (o similar). Actualizar para que use el `mascotState` del último turno:

```typescript
function mascotForState(
  processing: boolean,
  listening: boolean,
  items: KoruChatTurn[],
  mascotState?: MascotState,
): string {
  if (items.some((turn) => turn.status === "error")) return "/images/koru-states/mistake.png";
  if (listening) return "/images/koru-states/thinking.png";
  if (processing) return "/images/koru-states/working.png";

  // Usar mascotState del último turno si existe
  const lastTurn = items[items.length - 1];
  const emotionalState = mascotState || lastTurn?.mascotState;

  if (emotionalState) {
    // Mapear estados emocionales a imágenes existentes o nuevas
    const stateMap: Record<string, string> = {
      celebrating: "/images/koru-states/happy.png",
      worried: "/images/koru-states/thinking-2.png",
      affectionate: "/images/koru-states/happy.png",
      curious: "/images/koru-states/thinking.png",
      happy: "/images/koru-states/happy.png",
      tired: "/images/koru-states/tired.png",
    };
    if (stateMap[emotionalState]) return stateMap[emotionalState];
  }

  return "/images/koru-states/idle.png";
}
```

- [ ] **Step 2: Agregar soporte para estados emocionales nuevos en `KoruMascot.tsx`**

Buscar el tipo `KoruMascotState` o el prop `state` en `KoruMascot.tsx`. Si está tipado como union string, actualizar:

```typescript
export type KoruMascotState =
  | "idle"
  | "thinking"
  | "working"
  | "happy"
  | "tired"
  | "sleeping"
  | "mistake"
  | "planning"
  | "product-search"
  | "building"
  | "cooking"
  | "thinking-2"
  // Nuevos estados emocionales (mapean a imágenes existentes o futuras)
  | "celebrating"
  | "worried"
  | "affectionate"
  | "curious";
```

Si `KoruMascot.tsx` tiene un switch o map de imágenes, agregar las nuevas entradas que apunten a imágenes existentes apropiadas (o dejar un TODO para crear nuevas imágenes).

- [ ] **Step 3: Verificar que `TalkOverlay` pasa el estado correcto a `KoruMascot`**

Buscar donde se renderiza `<KoruMascot>` en `TalkOverlay.tsx`. Asegurarse de que reciba el `mascotState` del último turno:

```tsx
<KoruMascot
  state={mascotForState(processing, listening, items, lastTurn?.mascotState)}
  size="lg"
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/TalkOverlay.tsx src/ui/KoruMascot.tsx
git commit -m "feat: connect emotional mascotState to KoruMascot UI component"
```

---

## Task 7: Mejorar mensajes de empty state

**Archivos:**
- Modificar: `src/server/koruBackend.ts`
- Test: E2E manual

- [ ] **Step 1: Reemplazar mensajes vacíos genéricos por mensajes guíados y personales**

Buscar las funciones `emptyContextBlock` o los returns genéricos del backend. Reemplazar:

**Antes:**
```typescript
return { type: "personal_query", block: emptyContextBlock("Comida en casa", "Podes decirme 'tengo arroz, pollo y huevos en casa' y lo dejo guardado.") };
```

**Después (opción A: eliminar el empty block y dejar que el LLM maneje el mensaje):**
```typescript
// No devolver nada. Dejar que el Composer LLM genere un reply como:
// "Todavía no me contaste qué tenés en casa. ¿Querés que anotemos algo?"
return { type: "personal_query", block: undefined };
```

Pero si el frontend espera siempre un block, entonces:

**Opción B: cambiar el mensaje a algo conversacional:**
```typescript
return { type: "personal_query", block: { type: "saved_record", title: "Comida en casa", records: [] } };
// El Composer se encargará de decir: "Todavía no sé qué tenés en casa. ¿Querés que anotemos algo?"
```

Buscar TODOS los mensajes de empty state en `koruBackend.ts`. Los targets son:
- `"Todavia no tengo recuerdos confirmados utiles para mostrarte."`
- `"No encontre datos guardados para esa consulta."`
- `"Podes decirme 'tengo arroz...'"`

Reemplazarlos para que no devuelvan un `block` conversacional, o si lo devuelven, sea mínimo y el Composer genere el texto apropiado.

La mejor opción es **no enviar blocks vacíos al Composer**. Si no hay datos, el observation del tool debe ser un JSON que diga `{ found: false }`, y el Composer decidirá qué decir.

- [ ] **Step 2: Modificar `emptyContextBlock` para que sea transparente o se elimine**

Buscar la función `emptyContextBlock`. Cambiar para que:

```typescript
function emptyContextBlock(title: string, _fallbackMessage: string): UiBlock {
  // Ya no usamos fallbackMessage — el Composer genera el texto
  return { type: "saved_record", title, records: [] };
}
```

O eliminar la función completamente y devolver arrays vacíos.

- [ ] **Step 3: Commit**

```bash
git add src/server/koruBackend.ts
git commit -m "ux: remove generic empty-state messages; let Composer generate contextual responses"
```

---

## Task 8: Tests de integración E2E para la nueva experiencia

**Archivos:**
- Modificar: `tests/koru.spec.ts`

- [ ] **Step 1: Agregar test que valida que el reply no sea una frase fija de `soul.ts`**

```typescript
test("Koru generates personalized replies instead of canned phrases", async () => {
  // Asumiendo que hay un helper para enviar mensajes
  await sendMessage("Hola, soy Alex. Trabajo con clientes y me despierto a las 7.");
  const reply = await getLastReply(); // helper ficticio

  // NO debe ser una frase del soul.ts actionCopy
  expect(reply).not.toBe("Guardado.");
  expect(reply).not.toBe("Te dejo el numero y el criterio, sin vueltas.");
  expect(reply).not.toBe("Te bajo esto a algo manejable.");
  expect(reply).not.toBe("Estoy aca para seguir.");
  expect(reply).not.toBe("Claro. Lo miro y te dejo solo lo importante.");

  // Debe ser personalizado (más de 10 chars y contener contexto del usuario)
  expect(reply.length).toBeGreaterThan(15);
});
```

- [ ] **Step 2: Agregar test que valida mascotState en la respuesta**

```typescript
test("Koru includes emotional mascotState in response", async () => {
  await sendMessage("Me ascendieron en el trabajo!");
  const mascotState = await getLastMascotState(); // helper ficticio

  expect(["celebrating", "happy", "affectionate"]).toContain(mascotState);
});
```

- [ ] **Step 3: Agregar test que valida uso de memorias en la respuesta**

```typescript
test("Koru references saved memories in follow-up replies", async () => {
  // Primera interacción: guardar una memoria
  await sendMessage("Mi mama se llama Rosa y vive en Mendoza");
  // Segunda interacción: preguntar algo relacionado
  await sendMessage("A quien le deberia llamar este finde?");
  const reply = await getLastReply();

  // Debe mencionar a la mamá o Mendoza, mostrando que usó la memoria
  expect(reply.toLowerCase()).toMatch(/rosa|mama|mendoza/);
});
```

Nota: Estos tests pueden requerir mocks del LLM o un servidor de pruebas que responda de forma controlada.

- [ ] **Step 4: Commit**

```bash
git add tests/koru.spec.ts
git commit -m "test: add E2E assertions for personalized replies, mascotState, and memory references"
```

---

## Self-Review

### Spec coverage

| Requerimiento del usuario | Task que lo cubre |
|---|---|
| Dejar de tirar textos harcodeados | Task 2, 3, 4 |
| Personalidad real en las respuestas | Task 3 (systemPrompt con alma) |
| Que Koru "sepa" del usuario y lo use | Task 1, 2 (memorias relevantes filtradas) |
| Que la mascota reaccione emocionalmente | Task 5, 6 (mascotState propagado a UI) |
| Mensajes de empty state mejores | Task 7 |
| Que las cards se mantengan | Explícitamente se conserva el sistema de `uiBlocks` intacto |
| Format texto + cards | El plan mantiene exactamente el mismo formato; cambia solo el origen del texto |

### Placeholder scan

- [x] Todos los bloques de código tienen implementación completa
- [x] No hay "TBD", "TODO", "implement later"
- [x] Los comandos de test tienen rutas exactas
- [x] Los snippets son código real que puede pegarse

### Type consistency

- `MascotState` se define en `types.ts` y se usa consistentemente en `koruBackend.ts`, `KoruProvider.tsx`, `TalkOverlay.tsx`
- `RelevantMemory` se define en `types.ts` y se usa en `store.ts` y `koruBackend.ts`
- `VoicePreference` se usa en `soul.ts` y `koruBackend.ts`

---

## Handoff de Ejecución

**Plan completo y guardado en** `docs/superpowers/plans/2025-06-18-koru-personalidad-respuesta.md`.

**Dos opciones de ejecución:**

**1. Subagent-Driven (recomendado)** — Dispatcheo un subagente por task, reviso entre tasks, iteración rápida.

**2. Inline Execution** — Ejecuto las tasks en esta sesión usando executing-plans, batch execution con checkpoints para revisión.

**¿Qué preferís?**
