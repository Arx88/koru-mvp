# Koru — 06. Conclusiones de la auditoría

> Documento de cierre. Síntesis honesta de lo que Koru es, lo que hace bien, lo que arrastra y qué recomiendo hacer a continuación.

---

## 1. Veredicto general

**Koru es un proyecto personal ambicioso, sorprendentemente coherente en su narrativa y con varios módulos de calidad profesional.** No es un MVP descuidado: hay pensamiento real detrás de la metáfora del jardín, del modo efímero, de la memoria confirmable y del anti-alucinación. Como prototipo de asistente local-first con personalidad, cumple su propósito.

**Pero arrastra la deuda típica de un proyecto que creció por acumulación más que por refactor.** Tiene dos motores paralelos (uno vivo, uno muerto), un God-component de 1.800 líneas en la UI, regex léxicas por todas partes, constantes mágicas sin calibrar, y una sola decisión arquitectónica — el backend embebido en Vite — que bloquea cualquier salida del entorno de desarrollo.

**Ninguno de los problemas es bloqueante para uso personal.** Varios son bloqueantes para escalar o abrir a terceros.

---

## 2. Lo que Koru hace notablemente bien (a preservar)

1. **Diseño conceptual coherente.** La metáfora semilla→jardín, la memoria confirmable ("regar"/"podar"), la energía como moneda de confianza, el modo efímero real (no marketing): todo está implementado en el código, no solo en los docs. La narrativa emocional está calibrada para evitar el apego artificial (`forbiddenPhrases` en `soul.ts`).

2. **Anti-alucinación por diseño.** `structureExtractor` valida cada dato contra una cita literal del source. Es el módulo mejor diseñado del proyecto y un patrón que muchos asistentes "serios" no tienen. La regla del system prompt "status failed → no inventes" refuerza esto.

3. **Separación determinista/inteligente.** El patrón `enhancementExtractor` (LLM, propone) + `enhancementEngine` (determinista, filtra y rankea) es elegante y replicable a otros dominios. El comentario "Este módulo NO es inteligente" muestra madurez de diseño.

4. **Compatibilidad defensiva con modelos.** `simulatedToolDetector` (4 formatos de tool-call simulada) + `safeJsonObjectFromContent` (3 niveles de parseo) + `callValidatedJson` (validate-or-repair). El sistema sobrevive a modelos que no respetan el formato.

5. **Políticas de tools explícitas.** `toolRegistry` con `risk` (readonly→destructive), `requiresApproval`, `autoRun`. `shopping_compare` requiere aprobación del usuario antes de tocar tiendas.

6. **Auditoría excelente para QA.** `?koruAudit=1` con snapshot+delta por evento a `manual-audits/koru-current.jsonl`. Permite reproducir sesiones completas. Poco común en proyectos de este tamaño.

7. **Streaming con cuidado.** El merge por tipo de block preservando IDs para no desmontar componentes animados es un detalle que documenta un bug difícil ya resuelto.

8. **Fallback entre proveedores.** MiniMax→NVIDIA/Ollama→OpenRouter con carrera `Promise.any`. Robusto ante caídas de un proveedor.

9. **Memoria semántica + léxica.** `selectActiveMemories` (legacy) y `selectRelevantMemories` combinan matching vectorial y léxico. Buen diseño.

10. **Tipos centrales sólidos.** `types.ts` con `UiBlock` como unión discriminada de 15 variantes facilita el rendering seguro. Es la base correcta.

---

## 3. Lo que Koru arrastra (a abordar)

### 3.1 La deuda mayor: dos motores paralelos
~3.700 líneas del motor client-side (`orchestrator`+`brain`+`actions`+`pipeline`+`agentKernel`) están **efectivamente desconectadas** del producto. La UI solo llama a `runBackendAgentTurn`. Es código testeado, documentado, con heurísticas cuidadosas — y muerto. Genera:
- Falsa cobertura (los tests prueban código que el usuario no ejercita).
- Duplicación semántica (detección de shopping/clima/reminders en ambos lados).
- Confusión sobre qué está vivo.

**Es la decisión pendiente más importante del proyecto.** Tres caminos: eliminar el legacy, reactivarlo como fallback offline (su justificación original), o unificarlo con el server.

### 3.2 El backend embebido en Vite
Decisión pragmática para MVP, pero ahora te atrapa: no puedes desplegar en Vercel/Netlify, las API keys viven en el env del dev, y el "server" es código Node que solo existe en `npm run dev`. Para cualquier salida a producción hay que extraerlo a un proceso Express/Hono.

### 3.3 El God-component `KoruProvider`
1.806 líneas es demasiado para un solo archivo. Mezcla store, orquestación de red, mapeos, streaming y auditoría. Cualquier cambio toca demasiadas cosas a la vez.

### 3.4 El abuso de regex léxicas
`intent.ts`, `actions.ts`, `brain.ts`, `orchestrator.ts`, `heartbeatProactive.ts` están llenos de patrones en español rioplatense. Funcionan hoy, pero son frágiles ante cualquier variación léxica y no escalan. El proyecto ya demostró que sabe hacerlo mejor (`semanticRouter` con embeddings); debería extender ese patrón.

### 3.5 Seguridad: la API key expuesta
Es lo único genuinamente urgente. `VITE_FREELLMAPI_API_KEY` con valor real en `.env` se incrusta en el bundle del cliente. Hay que rotarla ya y rediseñar el flujo de credenciales client-side.

---

## 4. Madurez por dimensión (valoración 1-5)

| Dimensión | Nota | Comentario |
|-----------|------|------------|
| **Concepto y diseño** | 5 | Metáfora coherente, modo efímero real, personalidad calibrada. |
| **Tipos y modelo de datos** | 5 | `types.ts` sólido, `UiBlock` discriminado, entidades claras. |
| **Anti-alucinación** | 5 | `structureExtractor` con validación por cita literal. Referencia. |
| **Compatibilidad multi-modelo** | 4 | Fallbacks, tool-call simulada, JSON repair. Robusto. |
| **Modularidad del dominio** | 3 | Módulos modernos excelentes, pero `actions.ts`/`brain.ts` son God-modules. |
| **Cobertura de testing** | 3 | Buena en dominio, pero testing del motor legacy da falsa cobertura; faltan tests del camino activo. |
| **Arquitectura general** | 3 | Dos motores paralelos, tres routers solapados, backend acoplado a Vite. |
| **UI / React** | 3 | Funcional y bonita, pero God-component, re-render global, mojibake, accesibilidad del modal. |
| **Seguridad** | 2 | La key expuesta es grave. Lo demás (whitelists, boundaries, sanitización) está bien. |
| **Rendimiento** | 3 | Aceptable para uso personal; jank en streaming largo por re-render global. |
| **Mantenibilidad** | 3 | Código legible y comentado donde importa, pero duplicación y código muerto pesan. |
| **Documentación viva** | 3 | Comentarios buenos en módulos clave, pero ausencia de lint/strict y config fragmentada. |

**Promedio: ~3.5/5.** Por encima de la mayoría de proyectos personales de este tamaño; por debajo de lo que se necesita para producto serio.

---

## 5. Roadmap recomendado (priorizado por ROI)

### Fase 0 — Urgente (esta semana)
1. **Rotar la API key expuesta** y mover `VITE_FREELLMAPI_*` al proxy server-side. Crear `.env.example`.
2. **Eliminar las funciones duplicadas** en `koruBackend.ts` (`stateSummary`/`systemPrompt`).
3. **Re-guardar `KoruProvider.tsx` y `chatCards.tsx` como UTF-8 sin BOM** (arregla el mojibake).
4. **Corregir "Ate cabos" → "Até cabos"** en `soul.ts` y `brain.ts`.

### Fase 1 — Decisión arquitectónica (este mes)
5. **Decidir el destino del motor legacy.** Recomendación: eliminarlo (vía `git rm` + ajuste de imports) a menos que haya un plan concreto de fallback offline. Mantenerlo como referencia en una rama `archive/legacy-engine`.
6. **Decidir el despliegue.** Si el objetivo es uso personal en LAN, dejarlo está. Si es producto, extraer el backend a un proceso Express/Hono.

### Fase 2 — Refactor estructural (próximos 2 meses)
7. **Particionar `KoruProvider.tsx`** en `selectors.ts`, `adapters.ts`, `agentOrchestrator.ts`, `audit.ts`.
8. **Particionar `actions.ts`** en `intents.ts`, `builders.ts`, `planner.ts`, `executor.ts` (si se mantiene el legacy).
9. **Añadir `React.memo`** a `KoruTurnBubble`, `TurnItemCard`, `WebNavCardA` con comparación por `id`+`items`.
10. **Adoptar `zod`** para validación de respuestas del LLM (sustituye `schemas.ts`).
11. **Añadir `eslint`+`prettier`+`strict:true`** al `tsconfig.json`.

### Fase 3 — Calidad y robustez (próximos 3 meses)
12. **Tests del camino activo:** `runKoruBackendTurn` con `callProvider` mockeado, cubriendo los 3 fallbacks de proveedor.
13. **Unificar los tres routers** a una sola taxonomía de intenciones.
14. **Centralizar constantes mágicas** en `domain/config.ts`.
15. **Accesibilidad:** `role="dialog"`/`aria-modal` + focus trap en `TalkOverlay` y `MemoryDetail`.
16. **Pausa del heartbeat** con `document.visibilitychange`.
17. **Logger en cada catch silencioso.**

### Fase 4 — Mejoras opcionales (si hay tiempo)
18. **Migrar detección léxica a embeddings** (extender `semanticRouter`).
19. **Caché del Semantic Router** (persistir embeddings en IndexedDB para cold-start).
20. **Cache de `enhancementExtractor`** por hash de input+memorias.
21. **Snapshot tests del `systemPrompt`** para detectar regresiones de personalidad.

---

## 6. Una nota sobre el contexto del proyecto

Koru es **un proyecto personal en construcción**, no un producto terminado ni un encargo profesional. Evaluarlo con la vara de "código de producción en equipo" sería injusto: la inversión en anti-alucinación, en narrativa emocional y en auditoría QA supera lo que la mayoría de proyectos personales alcanzan. Los problemas encontrados (código muerto, God-components, regex léxicas, una key expuesta) son exactamente los que cabría esperar en esta etapa, y ninguno es irresoluble.

Lo que distingue a Koru no es la ausencia de deuda —todas las codebases la tienen— sino **la calidad de las piezas buenas**. `structureExtractor`, `enhancementEngine`, `semanticRouter`, `simulatedToolDetector`, `toolRegistry`, el `UiBlock` discriminado, la auditoría QA: son módulos que un equipo profesional firmaría sin sonrojo. Si el siguiente año se dedica a **consolidar en lugar de añadir**, Koru puede pasar de "prototipo ambicioso" a "asistente personal de referencia".

---

## 7. Cómo usar esta auditoría

Los cinco documentos anteriores desglosan lo resumido aquí:

- **01-arquitectura-y-stack.md** — Visión general, stack, flujo de un turno.
- **02-capas-del-codigo.md** — Análisis archivo por archivo de las cuatro capas.
- **03-ui-y-experiencia.md** — UI, chat, tarjetas, mascot, onboarding, auditoría QA.
- **04-seguridad-rendimiento-testing.md** — Riesgos, cuellos de botella, cobertura de tests.
- **05-bugs-y-deuda-tecnica.md** — Catálogo priorizado con fixes concretos.

Recomiendo abrir el roadmap (sección 5) por fases y tachar items. La Fase 0 se hace en una tarde y ya cambia la impresión del proyecto.

---

*Auditoría realizada el 2026-06-23 sobre el código fuente en `D:/ZomboidServer/koru-mvp`. Lectura íntegra de los ~19.000 líneas de TypeScript. Sin acceso a la documentación externa como fuente de verdad; el código es la única autoridad.*
