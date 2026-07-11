# Koru — 05. Catálogo de bugs y deuda técnica

> Lista priorizada de problemas encontrados durante la auditoría del 100% del código.

---

## A. Bugs confirmados

### A1. API key real expuesta en `.env` (CRÍTICO — Seguridad)
**Archivo:** `.env`
**Problema:** `VITE_FREELLMAPI_API_KEY=freellmapi-0e38cd96f7b9e00da2bf800ab94f6aaca4c608eea1977b21`. El prefijo `VITE_` la incrusta en el bundle del cliente, visible para cualquier usuario.
**Fix:** Rotar la key. Eliminar `VITE_FREELLMAPI_*` del cliente; enrutar el chat de FreeLLMAPI por el proxy server-side (`/koru-ai/*`). Crear `.env.example`.

### A2. Código duplicado: `stateSummary` y `systemPrompt` definidos dos veces (ALTO)
**Archivo:** `src/server/koruBackend.ts` (lín. 1697/1740 y 1735/1778)
**Problema:** Las dos funciones están escritas dos veces idénticamente. TS no se queja por hoisting, pero indica descuido en merges.
**Fix:** Eliminar las definiciones duplicadas.

### A3. Mojibake en `KoruProvider.tsx` y `chatCards.tsx` (ALTO — UX)
**Archivo:** `src/ui/KoruProvider.tsx` (BOM + secuencias), `src/ui/chatCards.tsx`
**Problema:** Secuencias UTF-8 mal decodificadas: `RaÃ­ces`, `NacÃ­`, `JardÃ­n`, `reuniÃ³n`, `acciÃ³n`, `Confirmado Â·`. El usuario lee texto roto.
**Fix:** Re-guardar como UTF-8 sin BOM. Auditar pipeline de build.

### A4. "Ate cabos" sin tilde expuesto al usuario (MEDIO — UX)
**Archivos:** `src/domain/soul.ts` (lín. 116, 142), `src/domain/brain.ts` (lín. 1178)
**Problema:** Debería ser "Até cabos". Error de ortografía persistente.
**Fix:** Reemplazar por "Até cabos".

### A5. Inconsistencia puerto Vite vs Playwright (MEDIO — Testing)
**Archivos:** `vite.config.ts` (`port 5200`), `playwright.config.ts` (`baseURL 5173`)
**Problema:** Los tests solo pasan porque `webServer.command` pasa `--port 5173` por flag, sobreescribiendo el config. Confuso y frágil.
**Fix:** Unificar a un puerto (5173 default de Vite, o 5200 en ambos).

### A6. `sportsResultNudge` siempre filtrado (MEDIO — feature muerta)
**Archivo:** `src/domain/heartbeatProactive.ts`
**Problema:** El generador produce prioridad "low" pero `buildProactiveNudges` filtra `priority !== "low"` (lín. 176). El nudge nunca se muestra.
**Fix:** Cambiar prioridad a "medium" o ajustar el filtro.

### A7. TZ mezclado en `weatherWakeUpNudge` (MEDIO)
**Archivo:** `src/domain/heartbeatProactive.ts` (lín. 58-60)
**Problema:** Usa `getUTCHours()`/`getUTCMinutes()` pero el resto del código usa `getHours()` local. Desfase horario según zona.
**Fix:** Usar `getHours()`/`getMinutes()` consistentemente.

### A8. `cosineSimilarity` no usa `Math.min` (MEDIO)
**Archivo:** `src/domain/semanticRouter.ts` (lín. 145-153)
**Problema:** Itera hasta `a.length` no `Math.min(a.length, b.length)`. Si cambian dimensiones de embeddings (otro modelo), daría `NaN`.
**Fix:** `Math.min(a.length, b.length)`. Unificar con la versión de `brain.ts` (que sí lo hace).

### A9. `buildRestockNote` muta `const` array (BAJO)
**Archivo:** `src/domain/actions.ts` (lín. 1338-1357)
**Problema:** `const items = extractShoppingItems(...)` seguido de `items.push(...)`. Mutación; el `Array.from(new Set(items))` posterior lo salva pero es confuso.
**Fix:** Usar `[...items, ...]`.

### A10. `provider` en cliente no incluye "minimax" (BAJO)
**Archivo:** `src/domain/backendAgentClient.ts`
**Problema:** Tipo `provider: "nvidia"|"openrouter"` pero el server usa `"nvidia"|"openrouter"|"minimax"`.
**Fix:** Añadir `"minimax"` al tipo cliente.

### A11. `timeFromText` no maneja AM/PM ni "16hs" (BAJO)
**Archivos:** `src/domain/time.ts`, `src/domain/orchestrator.ts` (lín. 181-189)
**Problema:** Solo "a las X" en formato 24h. "3 de la tarde" falla.
**Fix:** Añadir patrones PM/AM y "Xhs".

### A12. `extractStringField` asume comilla simple (BAJO)
**Archivo:** `src/server/koruBackend.ts`
**Problema:** Parser regex que busca `"field"` con escape de backslash. Funciona pero es frágil ante JSON con caracteres unicode sin escape.
**Fix:** Documentar que es fallback último; el parser principal (`extractJsonBlock`) debería cubrir la mayoría.

### A13. `extractMemoryCandidatesLocal` umbral `input.length > 120` excesivo (BAJO)
**Archivo:** `src/domain/brain.ts` (lín. 462)
**Problema:** Cualquier mensaje largo se convierte en candidato a memoria → spamea memoria con charla larga.
**Fix:** Revisar criterio (es código legacy, baja prioridad).

### A14. `relationshipNames` regex `/g` con resets manuales (BAJO)
**Archivo:** `src/domain/brain.ts` (lín. 27, reset en 85 y 88)
**Problema:** Patrón clásico bug regex `/g` + `.test()`. Funciona pero frágil ante nuevos usos que olviden resetear.
**Fix:** Eliminar flag `/g` si no se usa `.match()` con capturas globales.

### A15. `enhancementEngine.filterEnhancements.recentIgnored >= 2` (BAJO)
**Archivo:** `src/domain/enhancementEngine.ts` (lín. 131-134)
**Problema:** 2 entries puramente conversacionales bloquean todos los `ask` mode. Demasiado reactivo.
**Fix:** Subir umbral o ventana, o distinguir "ignorar" de "conversar".

### A16. Docstring `heartbeatProactive` dice 24h, código 20h (BAJO)
**Archivo:** `src/domain/heartbeatProactive.ts` (lín. 6 vs 17)
**Fix:** Sincronizar.

---

## B. Deuda estructural

### B1. Dos motores paralelos (MAYOR)
Motor client-side (`orchestrator`+`brain`+`actions`+`pipeline`+`agentKernel`, ~3.700 líneas) y server-side (`koruBackend.ts`, ~3.165 líneas). La UI solo usa el segundo. El primero está testeado pero efectivamente muerto → duplicación semántica, confusión sobre qué código está vivo, riesgo de divergencia entre tests y experiencia real.
**Recomendación:** Decidir y ejecutar una de tres opciones: (a) eliminar el motor legacy, (b) reactivarlo como fallback offline, (c) unificarlo con el server. Hoy es la deuda más grande del proyecto.

### B2. `KoruProvider.tsx` God-component (MAYOR)
1.806 líneas mezclando store + orquestación de red + mapeos dominio↔UI + streaming + auditoría.
**Recomendación:** Split en `selectors.ts` (memos derivadas), `adapters.ts` (mappings), `agentOrchestrator.ts` (`submitEntry`/`sendMessage`/`runReadonlyWebAction`), `audit.ts`.

### B3. `actions.ts` God-module (MAYOR)
1.667 líneas con 30+ funciones privadas mezclando detección de intención, construcción de payloads, planificación temporal y ejecución de side effects.
**Recomendación:** Dividir en `actions/intents.ts`, `actions/builders.ts`, `actions/planner.ts`, `actions/executor.ts`.

### B4. Tres mecanismos de routing solapados
`localRoute` (heurístico, en `orchestrator.ts`), `SemanticRouter` (embeddings, en `koruBackend.ts`), router nativo vía tool-calls del LLM. Cada uno con su taxonomía. Sin contrato unificado.
**Recomendación:** Definir una sola taxonomía de intenciones y mapear los tres a ella.

### B5. Backend acoplado al dev-server de Vite
Bloquea cualquier despliegue estático. API keys viven en env del dev.
**Recomendación:** Extraer `koruBackend.ts` + middlewares a un proceso Express/Hono independiente para producción.

### B6. Doble vía de renderizado de tarjetas
Legacy modular vs. UiBlock-A con `stitchBlockFromLegacyItem` (puente costoso).
**Recomendación:** Migrar el backend a emitir siempre `UiBlock` y eliminar la rama legacy.

### B7. Validación sin zod
`schemas.ts` reimplementa validación a mano. Propenso a errores, duplica esfuerzo.
**Recomendación:** Adoptar `zod` (o `valibot`) para los esquemas de entrada del LLM.

### B8. Anti-patrón de palabras clave en español rioplatense
`actions.ts`, `brain.ts`, `intent.ts`, `orchestrator.ts`, `heartbeatProactive.ts` plagados de regex léxicas. Frágiles ante variaciones léxicas.
**Recomendación:** Migrar detección a embeddings (como ya hace `semanticRouter`) y deprecar las regex.

### B9. `cosineSimilarity` duplicada
En `brain.ts` y `semanticRouter.ts` con implementaciones ligeramente distintas.
**Recomendación:** Extraer a `domain/vector.ts`.

### B10. Constantes mágicas sin calibrar
Confianza 0.55/0.58/0.65/0.75/0.85/0.95; ventanas temporales 20h/25min/75s; límites 120/200/500. Sin documentar calibración.
**Recomendación:** Centralizar en `domain/config.ts` con comentarios.

### B11. Errores silenciados
Múltiples `catch { return []; }`/`catch { return null; }` sin log en puntos críticos.
**Recomendación:** Añadir `logger.warn` en cada catch silencioso.

---

## C. Mejoras de calidad

- **C1.** Añadir `eslint`+`prettier` al `package.json` (hay `eslint-disable` sueltos que sugieren que existió).
- **C2.** Añadir `strict: true` a `tsconfig.json`.
- **C3.** Tipar `parsed: any` en `koruBackend.ts` con un tipo intermedio validado.
- **C4.** `logger.ts` tiene `@ts-nocheck` — eliminar y tipar correctamente.
- **C5.** `CardPreview` montado siempre en producción — excluir del build via env.
- **C6.** `logRitual` no-op en `KoruProvider.tsx` — eliminar.
- **C7.** Importaciones intercaladas en `App.tsx` (`CardPreview` después de la función) — mover al bloque superior.
- **C8.** `App.tsx` sin gestión de foco/trap al abrir `TalkOverlay` — añadir `role="dialog"`/`aria-modal` y focus trap.
- **C9.** `SettingsScreen` con `fetch` directo sin capa `domain/*` — alinear con el resto.
- **C10.** `SettingsScreen` fallback silencioso a modelos inventados — avisar al usuario.
