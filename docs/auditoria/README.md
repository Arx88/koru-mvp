# Auditoría completa de Koru

> Revisión del 100% del código fuente del asistente personal **Koru** (`D:/ZomboidServer/koru-mvp`).
> **Fecha:** 2026-06-23
> **Método:** Lectura íntegra de los ~19.000 líneas de TypeScript (`src/`, `vite.config.ts`, tests E2E, configuración). El código es la única fuente de verdad.

## Documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [arquitectura-y-stack.md](./01-arquitectura-y-stack.md) | Qué es Koru, stack técnico, arquitectura, flujo de un turno, proveedores LLM, persistencia, endpoints. |
| 02 | [capas-del-codigo.md](./02-capas-del-codigo.md) | Análisis archivo por archivo de las cuatro capas (infra, server, domain, ui). |
| 03 | [ui-y-experiencia.md](./03-ui-y-experiencia.md) | UI React 19, patrón provider único, chat, 21 tarjetas, mascot, onboarding, auditoría QA. |
| 04 | [seguridad-rendimiento-testing.md](./04-seguridad-rendimiento-testing.md) | Seguridad, rendimiento, cobertura de tests unitarios y E2E. |
| 05 | [bugs-y-deuda-tecnica.md](./05-bugs-y-deuda-tecnica.md) | Catálogo priorizado de bugs confirmados (A1-A16) y deuda estructural (B1-B11). |
| 06 | [conclusiones.md](./06-conclusiones.md) | **Veredicto, lo bueno, lo malo, roadmap en 4 fases.** Empieza aquí si tienes poco tiempo. |
| 07 | [plan-100-tools-gratuitas.md](./07-plan-100-tools-gratuitas.md) | Plan para expandir Koru de 8 a **100 tools** usando solo APIs gratuitas, sin costo adicional. |
| 08 | [catalogo-tools-cotidianas.md](./08-catalogo-tools-cotidianas.md) | **Catálogo de 120 tools enfocado en el día a día** (deportes, comida, viajes, dinero, documentos, trending) con descripción y ejemplos de uso. |
| 09 | [arquitectura-toolbox.md](./09-arquitectura-toolbox.md) | **Diseño técnico del ToolBox**: cómo añadir las 120 tools sin tocar el motor (2 puntos quirúrgicos + capa aislada `src/tools/`). |

## Lectura recomendada

- **Poco tiempo:** lee solo `06-conclusiones.md`.
- **Tiempo medio:** `01` + `06`.
- **Tiempo completo:** en orden del `01` al `06`.

## Hallazgos críticos (resumen ejecutivo)

- ⚠️ **API key real expuesta** en `.env` con prefijo `VITE_` (visible en el bundle del cliente) → rotar urgente.
- 🏗️ **Dos motores paralelos:** ~3.700 líneas del motor client-side están efectivamente desconectadas del producto (UI solo usa `runBackendAgentTurn`).
- 🔒 **Anti-alucinación por diseño:** `structureExtractor` valida cada dato contra cita literal — módulo de calidad profesional.
- 🎨 **Mojibake visible** en `KoruProvider.tsx` y `chatCards.tsx` (texto roto que el usuario lee).
- 📊 **Madurez promedio: 3.5/5.** Por encima de la mayoría de proyectos personales; por debajo de producto serio.

## Veredicto en una frase

Koru es un prototipo ambicioso con varias piezas de calidad profesional, que arrastra la deuda típica del crecimiento por acumulación; ninguno de sus problemas es bloqueante para uso personal, pero la deuda estructural (motores paralelos, God-components, backend acoplado a Vite) conviene abordarla antes de escalar.
