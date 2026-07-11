# Evaluación Multi-Agente de Koru: Personas con Vida Real

## Qué es esto

Un sistema de evaluación donde **múltiples agentes con perfiles demográficos reales** (20, 30, 40, 60 años) simulan una semana completa usando Koru. Cada agente tiene una vida, un calendario, emociones y necesidades distintas. No es una prueba mecánica — es una simulación orgánica donde cada persona decide qué decirle a Koru según su contexto.

## Personas

| Persona | Edad | Perfil |
|---------|------|--------|
| **Camila** | 23 | Diseñadora freelance. Vive con amigas, presupuesto ajustado, ansiedad social. Necesita que Koru la ayude con deadlines, gastos y emociones. |
| **Martín** | 34 | PM en startup. Padre primerizo, carga mental extrema. Necesita que Koru organice su día, prepare reuniones y le recuerde la vida familiar. |
| **Laura** | 47 | Docente universitaria. Madre de adolescentes, pragmática. Necesita coordinación familiar, seguimiento de salud y orden semanal. |
| **Roberto** | 61 | Jubilado, viudo. Hijo lejos, jardín como hobbie. Necesita compañía conversacional, recordatorios médicos y acompañamiento emocional. |

## Dimensiones de Evaluación

Cada turno se evalúa en 7 dimensiones (escala 1-10):

1. **Inteligencia** — ¿Entendió Koru la intención real detrás del pedido?
2. **Proactividad** — ¿Se adelantó a algo que no le pedí pero sabía que necesitaba?
3. **Tarjetas (Cards)** — ¿Las tarjetas fueron relevantes, bien hechas, sin texto roto?
4. **Tono** — ¿El tono fue apropiado para la persona y el momento emocional?
5. **Memoria** — ¿Usó memorias guardadas para personalizar la respuesta?
6. **Sorpresa (+1)** — ¿Me dio algo extra que superó mis expectativas?
7. **Orgánico** — ¿Se sintió como un asistente real o como un bot?

## Cómo correr

```bash
# 1. Asegurate de tener el servidor de Koru corriendo
npm run dev

# 2. Las API keys deben estar configuradas en .env

# 3. Correr la evaluación
node tests/agents/run.mjs

# 4. El reporte se guarda en tests/agents/reports/
```

## Costo estimado

~140 turnos (4 personas × 7 días × ~5 interacciones).
Cada turno usa 2-3 llamadas LLM + tool calls.
Costo estimado: $5-15 USD dependiendo del proveedor (NVIDIA/OpenRouter).

## Output

El reporte incluye:
- **Score por persona** (promedio de 7 dimensiones)
- **Score por dimensión** (across all personas)
- **Transcript completo** con lo que dijo la persona y cómo respondió Koru
- **Hallazgos críticos** (donde Koru falló para un perfil específico)
- **Oportunidades** (qué podría hacer Koru para esa persona que no hace hoy)
