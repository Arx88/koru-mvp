# Koru — 03. UI y Experiencia

> Cómo se organiza la capa React 19 y qué experimenta el usuario.

---

## 1. Patrón arquitectónico: provider único de verdad

TODO el estado vivo de la app cuelga de un único `KoruContext` expuesto por `KoruProvider`. No hay Zustand/Redux; es **Context + `useState` + `useRef` espejo**.

El truco estructural clave está en las **refs espejo** (`domainStateRef`, `chatTurnsRef`): se mantienen sincronizadas con el estado mediante wrappers `commitDomainState`/`commitChatTurns` que escriben el ref **dentro** del updater de `setState`. Motivo: las `useCallback`/funciones async (`sendMessage`, `submitEntry`) necesitan leer el estado **actual** sin reincluirlo en deps (evitar closures obsoletos y re-renders en cascada).

Es correcto pero **frágil**: cualquier rama que olvide `commit*` desincronizará el ref. Es el patrón típico de "Context+useState crecido demasiado".

## 2. Pantallas y navegación

**Shell (`App.tsx`):** montaje de `KoruProvider` + `KoruApp` que decide entre `Onboarding` y el shell con tabs.

**Tabs (5) vía `BottomNav`:**
1. **Hoy** (`HomeScreen`): saludo por hora, mascot con estado derivado, prioridades toggleable, CTA "Hablar con Koru".
2. **Memoria** (`MemoryScreen`): grid de memorias tipo "jardín", bottom sheet modal para editar/confirmar/podar.
3. **Permisos** (`PermissionsScreen`): toggles de autonomía (memoria duradera, heartbeat, preparación de acciones, señales del mundo, modo efímero).
4. **Historial** (`HistoryScreen`): `<ol>` de entries con icono por kind.
5. **Ajustes** (`SettingsScreen`): selector de modelo LLM (`GET /api/koru/models`).

**`TalkOverlay`:** overlay a pantalla completa (`koru-chat-shell`) que se monta cuando `talking===true`. Header con mascot + estado, scroll de turnos, composer con input + micrófono + botón efímero.

## 3. Sistema de chat y streaming

`submitEntry(text)` (en `KoruProvider`) orquesta el turno:

1. Llama a `runBackendAgentTurn` (en `backendAgentClient.ts`) con callback de streaming.
2. En el **primer chunk** crea el `koruTurn` con status `"working"`.
3. En chunks sucesivos hace **merge por TIPO de block** (no por índice), **preservando IDs** para no desmontar/remontar componentes y perder estado interno (animación de `WebNavCardA`, `visibleCount`). Hay comentarios extensos explicando este bug histórico.
4. Mantiene `streamedItemsByType` (Map) para reutilizar ids al reemplazar con el resultado final.
5. Al terminar, `applyBackendTurnToState` aplica memories/commitments/actions/records/energy/modelCall, persiste y emite auditoría detallada (`turn_analyzed`).

`sendMessage` (envoltorio UX): añade user turn, infiere `activity` (spinner), maneja `autoWebAction` con `setTimeout(0)` (ejecución automática diferida), captura errores creando un `errorTurn`.

## 4. Las 21 tarjetas (`chatCards.tsx`)

`KoruSemanticCard({item, handlers})` es el dispatcher:
1. Si `kind` es `memory`/`commitment` → `MemoryCard`.
2. Si `stitchBlockFromLegacyItem(item)` produce un `UiBlock` → `UiBlockCardA` + `ActionButtons`.
3. Else → render "legacy modular": `ActionTitle` + secuencia de módulos (`QuestionList`, `ReminderMeta`, `DecisionCard`, `SummaryModule`, `RecordsModule`, `PlanPreview`, `ResearchBrief`, `ComparisonPreview`, `SourcePreview`, `ContextReview`, `FileBundle`, `WorkSteps`, `ActionButtons`).

**Tarjetas A (basadas en `UiBlock`):** ~15 variantes dentro de `UiBlockCardA`: `clarifying_question`, `weather`, `alarm`, `reminder`, `shopping_list`, `plan`, `comparison`, `research_sources`, `money_summary`, `saved_record`, `activity_group`, `proactive_signal`, `resource_bundle`, `data_card`, `web_nav`.

**Primitivas reutilizables:** `StitchHeader`, `StitchRow` (con `href` → `<a>`), `StitchNote`, `StitchPills`, `StitchSummaryGrid`. Tonos (`accent/amber/rose/purple/blue/muted`). Composición limpia y consistente.

**`WebNavCardA` (la tarjeta más compleja):**
- Estado interno: `visibleCount`, `showSummary`, `elapsedSeconds`, `stableTotalRef`.
- Animación escalonada de aparición de resultados (`setTimeout` 500ms por resultado).
- Revela `summary` 400ms después de que estén todos.
- Cronómetro de búsqueda (`setInterval(1000)` mientras loading).
- Barra de progreso dual: indeterminada (shimmer) si buscando; determinada por `visibleCount/total` si ya hay resultados.
- **Es la razón de los esfuerzos de preservación de IDs** en `KoruProvider`: su estado se perdería al desmontar.

## 5. Sistema de mascot y estados emocionales

`KoruMascot.tsx`: mapea `KoruMascotState` (16 estados) → imagen PNG en `/images/koru-states/`. `MASCOT_IMAGE` tabla canónica. Animación `animate-breathe` (salvo en `listening`). Filtros de brillo según estado.

**Duplicación:** `TalkOverlay.mascotForState` redefine un sub-mapa casi idéntico inline (~11 estados). Debería importar de `KoruMascot`.

## 6. Onboarding

3 pasos: `welcome` (CTA hablar o escribir) → `review` (nombre + 3 prompts de perfil: Rutina/Cuidado/Objetivo) → `grown` (confirmación). Respeta el principio de "no inventar perfil, solo lo que el usuario comparte". Permite "Dejar vacío" explícito.

## 7. Auditoría para QA

Activada por `?koruAudit=1` (persistido en `sessionStorage`). `?koruAudit=1&reset=1` limpia localStorage, resetea estado, reescribe URL con `history.replaceState`, emite `audit_reset`. `writeAuditEvent` hace `POST /koru-audit/log` con snapshot + delta por evento. Excelentemente instrumentado para QA manual.

## 8. Modo efímero

Toggle en `PermissionsScreen` y `TalkOverlay` (botón Sparkles). Cuando activo, `applyBackendTurnToState` **no crea** memories/commitments/records ni entries/energyEvents: `trustedEnergy += round(awarded * 0.35)` en vez de 0.6. La privacidad está diseñada en el código.

## 9. Deudas y problemas de UI (priorizados)

### 9.1 Mojibake (ALTO, cosmético pero visible)
`KoruProvider.tsx` (BOM + secuencias mal decodificadas) y partes de `chatCards.tsx`. Re-guardar como UTF-8 sin BOM.

### 9.2 Re-render global (ALTO, rendimiento)
Único context con `value` memoizado pero deps amplias; cualquier mutación re-renderiza todos los consumidores. Faltan `React.memo` en `KoruTurnBubble`/`TurnItemCard`/`WebNavCardA` y/o split del context (chat vs. dominio vs. UI efímera). Impacto directo en fluidez del streaming.

### 9.3 Accesibilidad del overlay/modal (MEDIO-ALTO)
`TalkOverlay` no es `role="dialog"`/`aria-modal`, sin focus trap ni restauración de foco. `App` oculta el fondo con `invisible`+`aria-hidden` pero AT puede igualmente navegar. `MemoryDetail` similar, sin Escape.

### 9.4 Complejidad del Provider (MEDIO)
1.806 líneas mezclando store + orquestación + adaptadores + auditoría. Recomendar split: `selectors.ts`, `adapters.ts`, `agentOrchestrator.ts`, `audit.ts`.

### 9.5 Doble vía de renderizado de tarjetas (MEDIO)
Legacy modular vs. UiBlock-A con `stitchBlockFromLegacyItem` como puente costoso. Migrar el backend a emitir siempre `UiBlock` y eliminar la rama legacy.

### 9.6 Persistencia frágil (MEDIO)
`localStorage` síncrono sin cuota/backpressure; fallos silenciados. Considerar debouncing, IndexedDB exclusiva o capa `domain/storage`.

### 9.7 Inconsistencias de mutación (BAJO-MEDIO)
`togglePermission` mezcla `commitDomainState(prev=>...)` con `domainStateRef.current` según rama; `completeOnboarding` persiste condicionalmente; `setEphemeral` y `togglePermission("perm4")` son dos caminos al mismo estado.

### 9.8 Claves de lista no únicas (BAJO-MEDIO)
En `chatCards` (`record.domain-kind-title`, `plan.time-title`); pueden colisionar con datos repetidos.

### 9.9 SettingsScreen fuera del patrón (BAJO)
`fetch` directo + fallback silencioso a modelos inventados + estilo divergente + doble fuente para `selectedModel`.

### 9.10 Mapeos duplicados (BAJO)
`mascotForState` (TalkOverlay) vs. `MASCOT_IMAGE` (KoruMascot); listas hardcoded de actionKind "no accionables" repetidas en `statusText`/`headerStatus`/`ActionButtons`.

### 9.11 Higiene (BAJO)
`logRitual` no-op; `CardPreview` siempre montado en prod; importación intercalada en `App`; heartbeat cada 60s sin pausar en background/blur (debería escuchar `visibilitychange`).

## 10. Puntos fuertes de la UI a preservar

- **Narrativa y diseño coherentes** (jardín/energía/confianza), tono de copy diferenciado, emocional sin caer en fórmulas de tarjeta.
- **Auditoría muy bien instrumentada** con snapshot+delta por evento: excelente para QA.
- **Manejo cuidadoso de identidad de ítems durante el streaming** (merge por tipo, preservación de ids): documenta un bug difícil ya resuelto.
- **Accesibilidad básica correcta** en toggles (`role="switch"`), nav (`aria-current`), lista semántica (`<ol>`).
- **Separación dominio/UI razonable**: el provider adapta pero la lógica de negocio pura vive en `domain/*`.
- **Componentes presentacionales (`Stitch*`) bien compuestos** y reutilizables dentro de `chatCards`.
- **Modo efímero real**: no es marketing, está implementado en `applyBackendTurnToState` con reducción de energía y sin persistencia de datos sensibles.
