# Koru — 04. Seguridad, Rendimiento y Testing

---

## 1. Seguridad

### 1.1 Exposición de credenciales (CRÍTICO)
- **`.env` contiene una API key real de FreeLLMAPI en texto plano** (`VITE_FREELLMAPI_API_KEY=freellmapi-0e38...`). Al llevar prefijo `VITE_` se incrusta en el bundle del cliente y es **visible por cualquier usuario** que inspeccione la web. Hay que rotarla y mover las secrets client-side a un proxy controlado, o eliminar `VITE_FREELLMAPI_*` del cliente.
- **No existe `.env.example`** ni `.gitignore` efectivo documentado para secrets (`.gitignore` existe pero solo 258 bytes; habría que verificar que `.env` está excluido del git).
- `minimax-oauth-token.json` en la raíz con `accessToken` — archivo sensible sin protección.

### 1.2 Validación de tools (BIEN)
- `simulatedToolDetector.VALID_TOOL_NAMES` whitelist de 6 tools → bloquea ejecución de tools no permitidas aunque el LLM las "simule".
- `toolRegistry.TOO_REGISTRY` con `ToolPolicy` explícito (risk: readonly/local_write/external_side_effect/financial/destructive) y `requiresApproval`/`autoRun` por tool → `shopping_compare` requiere aprobación explícita del usuario.
- Boundaries respetados en `enhancementEngine.filterEnhancements`.

### 1.3 Sanitización de voz (BIEN)
- `soul.ts.koruSoulCapsule.voice.forbiddenPhrases` (8 frases tóxicas) + `sanitizeKoruVoice` que las reemplaza por "puedo ayudarte con eso". Previene que Koru diga cosas como "te extrane" o "soy la unica persona que te entiende" (patrones de apego artificial).

### 1.4 Anti-alucinación (MUY BIEN)
- `structureExtractor.findBackingSource` valida que cada dato extraído tenga `quote` que aparezca **literal** en algún source. Mejor perder datos que inventar.
- `systemPrompt` con reglas CRÍTICO explícitas: "Si una tool devuelve status failed/not_configured, NO inventes los datos".

### 1.5 Riesgo de prompt injection (MEDIO)
- En `enhancementExtractor.userPrompt` se inserta `input` del usuario crudo en el prompt. Un usuario malicioso podría intentar inyección. En contexto personal el riesgo es bajo, pero conviene sanitizar/escapar antes de cualquier apertura a terceros.
- `systemPrompt` incluye records/memorias con `replace(/[\n\r`]+/g, " ")` (mitiga pero no elimina).

### 1.6 CORS / exposición del backend
- `server.host = "0.0.0.0"`: el dev-server escucha en todas las interfaces. En una red local, cualquier dispositivo puede consumir `/api/koru/turn` (y por tanto gastar cuota de OpenRouter/MiniMax/NVIDIA). Adecuado para LAN casera; inadecuado si se expone a Internet.

### 1.7 Scraping web
- `queryPlaywrightSearch` lanza Chromium headless contra DuckDuckGo/Bing. El user-agent incluye `KoruLocalBrowser/1.0`. No hay rate-limiting ni cache → riesgo de bloqueo de IP si se abusa. Las fuentes externas (Brave/Tavily/etc.) usan API keys dedicadas, más limpio.

### 1.8 Manejo de errores silenciado (MEDIO)
Múltiples `catch { return []; }`/`catch { return null; }` sin log en `enhancementExtractor`, `backendAgentClient`, `structureExtractor`. Difícil debugging en producción. El `logger` existe pero no se usa en estos puntos.

---

## 2. Rendimiento

### 2.1 Re-render global (ALTO)
Único `KoruContext` → cualquier mutación re-renderiza todos los consumidores (`HomeScreen`, `MemoryScreen`, `TalkOverlay`...). Sin split de contextos ni selectores finos. Impacto directo en streaming: cada chunk del stream reemplaza `chatTurns`, re-renderizando todas las burbujas aunque solo cambie la última. **Mitigación inmediata:** `React.memo` con comparación por `turn.id`+`turn.items` referencial en `KoruTurnBubble`/`TurnItemCard`.

### 2.2 `WebNavCardA` de alta frecuencia
No memoizado; re-renderiza en cada tick del cronómetro (1s) y cada `setTimeout` de aparición de resultados. Dentro de un turno que a su vez se re-renderiza por chunk. Combinación de alta frecuencia.

### 2.3 Trabajo duplicado en motor legacy
`brain.analyzeReflection` ejecuta dos veces `buildActionProposalsLocal` y `extractLifeRecordsLocal` (vía `extractTurnKnowledge` y dentro de `orchestrateTurn.localRoute`). No es 100% redundante pero indica falta de memoización. **Hoy es código muerto** así que no impacta producción.

### 2.4 Semantic Router singleton
Cold-start penaliza primer turno (~1s de latencia para embeber 41 ejemplos). Sin persistencia de caché; en serverless cold-start pagaría en cada arranque. En el dev-server local es despreciable tras el primer turno.

### 2.5 `enhancementExtractor` por turno
Se llama por cada turno con prompt de ~1.5k tokens. Costo API acumulado. Se podría cachear por hash de input+memorias activas.

### 2.6 `structureExtractor` truncamiento
`content.slice(0, 1000)` trunca contenido de sources. Cita después del char 1000 se pierde. En articles largos, pérdida de datos reales.

### 2.7 Heartbeat polling
`setInterval(60_000)` permanente desde `KoruProvider`, incluso con la app en background o sin foco. Barato (recálculo en memoria), pero debería pausar con `document.visibilitychange`.

### 2.8 Persistencia síncrona
`saveState` escribe `localStorage` (síncrono, bloquea main thread) + IndexedDB (async). Sin debouncing → en flujos de streaming intensivo puede generar pressure. `chatTurns.slice(-120)` en cada cambio.

### 2.9 Fallback Playwright
`queryPlaywrightSearch` lanza Chromium por búsqueda → costoso (~1-3s, ~100MB RAM). Solo se invoca si los providers de API devolvieron 0 resultados. Aceptable como último recurso.

### 2.10 `Promise.any` en OpenRouter
Carrera de hasta 3 keys × 3 modelos simultáneos → gasta cuota de todos los que pierden. Útil para latencia mínima, caro para presupuesto.

---

## 3. Testing

### 3.1 Cobertura unitaria (vitest)
Existen `*.test.ts` para: `brain`, `calendar`, `enhancementEngine`, `enhancementExtractor`, `heartbeat`, `heartbeatProactive`, `pipeline`, `orchestrator.eval`, `semanticRouter`, `simulatedToolDetector`, `structureExtractor`, `koruBackend`, `App`. **Buena cobertura del dominio**, pero:
- Los tests del motor legacy (`brain`, `orchestrator.eval`) prueban código que **no se ejecuta en producción**. Falsa sensación de cobertura del camino real.
- No hay tests de integración que validen el flujo completo UI→backend→UI con providers reales/mockeados.

### 3.2 E2E (Playwright, 403 líneas, 18 tests)
`tests/e2e/koru.spec.ts` con escenarios:
- Chat con web navigation + approval (mock de `/koru-web/search`).
- Greeting + clima rápido.
- Shopping reminder → shopping item + action.
- Decision support con voto claro.
- News → módulo semántico.
- Weather pide ciudad y continúa.
- World signal card dedicada.
- Onboarding → home screen.
- Plan + vida records → activity modules.
- Journey multi-sesión (memoria/tareas/cards).
- Permisos (boundaries).
- Memory garden.
- Mobile sin overflow horizontal.
- Reply personalizado, no canned.
- Mascot en celebration.
- Reply referencia memorias guardadas.

**Calidad:** mocks realistas de `/koru-web/search` y `/koru-ai/v1/chat/completions` (este último abort). Cubren happy paths y varios edge cases. Buenos timeouts (45-75s).

**Huecos:**
- `baseURL 5173` vs `port 5200` de Vite — solo funciona por flag en `webServer.command`.
- No cubren el Semantic Router (depende de Ollama local).
- No cubren fallbacks entre providers (rate-limit → OpenRouter).
- No cubren el motor legacy (probablemente bien, dado que está retirado).

### 3.3 Tests manuales / auditoría
Excelente instrumentación con `?koruAudit=1` + `POST /koru-audit/log` a `manual-audits/koru-current.jsonl`. Permite reproducir sesiones completas.

### 3.4 Evaluaciones automatizadas
Existen `tests/agents/eval-engine.mjs`, `eval-reduced.mjs`, `koru-agent-core-eval.mjs`, `koru-real-user-30day-eval.mjs` con reports JSON en `tests/agents/reports/`. Indica esfuerzo serio en evaluación de calidad del agente (no solo de código).

### 3.5 Recomendaciones de testing
1. Añadir tests del **camino activo**: `runKoruBackendTurn` con `callProvider` mockeado por provider, cubriendo MiniMax→NVIDIA→OpenRouter fallbacks.
2. Tests de `structureExtractor` con sources reales para validar anti-alucinación en producción.
3. Snapshot tests del `systemPrompt` para detectar regresiones en la personalidad.
4. Migrar tests E2E a `port 5200` o hacer que Vite use `5173` consistentemente.
5. Eliminar o marcar como `@deprecated` los tests del motor legacy para evitar falsa cobertura.
