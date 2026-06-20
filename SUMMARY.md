# KORU — Resumen Visual y Operativo

## 🏗️ Arquitectura Operativa

```
┌─────────────────────────────────────────────────────────────┐
│  USUARIO (habla con Koru)                                   │
│         ↓                                                   │
│  ┌─────────────────┐    ┌──────────────────────┐           │
│  │ runKoruBackend  │───▶│ enhancementExtractor │           │
│  │    Turn         │    │   (LLM: propone)     │           │
│  └─────────────────┘    └──────────────────────┘           │
│         ↓                          ↓                        │
│  ┌─────────────────┐    ┌──────────────────────┐           │
│  │   Composer      │◀───│ enhancementEngine    │           │
│  │ (respuesta final)│    │   (gobierna/rankea)  │           │
│  └─────────────────┘    └──────────────────────┘           │
│         ↓                                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  UI: sugerencias + heartbeatProactive + chatCards    │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Componentes nuevos creados

| Módulo | Archivo | Rol |
|--------|---------|-----|
| **Enhancement Extractor** | `src/domain/enhancementExtractor.ts` | LLM proposal → JSON con `opportunities[]` |
| **Enhancement Engine** | `src/domain/enhancementEngine.ts` | Gobernancia: ranking, límites, filtros, learning |
| **Heartbeat Proactive** | `src/domain/heartbeatProactive.ts` | Nudges: clima, tráfico, medicación, resultados |
| **Smart Fallback** | `src/domain/brain.ts` | Reemplaza `renderKoruResponse` por contexto real |
| **Action Labels** | `src/domain/actions.ts` | `alarm` → "Crear alarma" con Commitment real |
| **Learning Preferences** | `src/domain/store.ts` / `src/domain/types.ts` | Historial accept/reject por tipo |
| **Suggested Actions UI** | `src/ui/KoruProvider.tsx` | Mapea `suggestedActions` → `AssistantAction` visible |
| **Backend Integration** | `src/server/koruBackend.ts` | Pipeline async que inyecta enhancements |

### Flujo de datos del Enhancement

```
Input: "estoy quemado"
  │
  ▼
[Conversational Fast Path] ──▶ NO tools, NO risk
  │
  ▼
[enhancementExtractor] LLM propone:
  { type: "health_followup", confidence: 0.8,
    question: "¿Querés que sugiera pausas?" }
  │
  ▼
[enhancementEngine] scoreCandidate():
  ├─ confidence ≥ 0.65 ✓
  ├─ risk score = 0.1 (bajo) ✓
  ├─ noise: no duplicado ✓
  ├─ learningPreferences: ajusta +0.5/-1.0 ✓
  └─ MAX 1 enhancement por turno ✓
  │
  ▼
[runKoruBackendTurn] Inyecta:
  uiBlocks: [],
  suggestedActions: [
    { label: "Sugerir pausas", kind: "reminder", mode: "suggest" }
  ]
  │
  ▼
[UI] KoruProvider sugiere botón clickeable
  Usuario: [Aceptar] → approveAndExecuteAction()
         → guarda en learningPreferences
         → ejecuta creando commitment real
```

---

## 🎨 Componentes Visuales (21 Cards)

| # | Tema | Opción | Patrón visual de la muestra | Identidad distintiva |
|---|------|--------|----------------------------|----------------------|
| **1A** | Fútbol | Scoreboard | Live Match: tabs Stats/Lineups/Timeline + barras horizontales | Badge pulsante rojo + escudos reales |
| **1B** | Fútbol | Timeline | Deep Research timeline: puntos conectados por línea gradiente | Goles en timeline con badge circular |
| **1C** | Fútbol | Stats | Product Review specs grid | 4 celdas con mini gauge bar |
| **2A** | Elecciones | Escrutinio | Deep Research: pasos check/sync/more | 3 gauges SVG con animación stroke |
| **2B** | Elecciones | Votar | Web Navigation: íconos + radio buttons | Layout tipo lista con chevron |
| **2C** | Elecciones | Resumen | Smart List: checkbox custom SVG | Progress ring 77% + checkboxes animados |
| **3A** | Crypto | Precio | Market Live: sparkline SVG animado | Número grande + gráfico creciente + dot animado |
| **3B** | Crypto | Cartera | Outfit Card: grid 3×3 de emojis | Íconos crypto como "ropa" con variación % |
| **3C** | Crypto | Forex | Product Review specs | Banderas reales en grid 2×2 |
| **4A** | Indicaciones | Ruta | Deep Research timeline | Iconos numerados + direcciones |
| **4B** | Indicaciones | Transporte | Web Navigation list + chip badge | Iconos Material + tiempos + color destacado |
| **4C** | Indicaciones | Mapa | Activity Tracker ring | Progress ring 75% + dirección textual |
| **5A** | Cumpleaños | Persona | Birthday gradient + scroll horizontal | Gradient rosa→púrpura + gift card scroll |
| **5B** | Cumpleaños | Calendario | Document builder dark / calendario | Grid calendario con días marcados |
| **5C** | Cumpleaños | Recordatorio | Alarma compacta | Badge naranja + días restantes |
| **6A** | Comparativa | VS | Product Review: dos columnas | Escudos A/B + specs grid |
| **6B** | Comparativa | Benchmark | Smart checklist + checkbox | Lista con check + prioridad visual |
| **6C** | Comparativa | Specs | Document builder / feature list | Divider rows con label+valor |
| **7A** | Review | Scores | Outfit card: 4 tiles emoji | Tiles semánticos (🎧🔋☁️💰) |
| **7B** | Review | Pros/Cons | Document builder dark | Editor markdown + cursor parpadeante |
| **7C** | Review | Veredicto | Deep Research quote + pills | Gradient lila + quote + tags |

### Características visuales comunes
- **card-shadow**: `0 4px 20px rgba(0,0,0,.03)` + hover translateY(-2px)
- **rounded-3xl**: radio consistente 24px
- **Tag superior**: `text-[10px] uppercase tracking-widest` con icono + texto
- **Material Symbols**: opsz 24, wght 400, FILL 0
- **Plus Jakarta Sans**: fuente principal
- **Fira Code**: editor markdown
- **Universo claro**: bg `#FCFCFA`, cards blancas, gradientes suaves
- **Max width**: 420px (mobile first)

---

## 🧪 Tests y Validación

| Suite | Tests | Estado |
|-------|-------|--------|
| `enhancementEngine.test.ts` | 12 pass | ✅ |
| `enhancementExtractor.test.ts` | 4 pass | ✅ |
| `heartbeatProactive.test.ts` | 3 pass | ✅ |
| `koruBackend.test.ts` | 3 pass | ✅ |
| `heartbeat.test.ts` | 3 pass | ✅ |
| `App.test.tsx` | 1 pass (RTL enhancement card) | ✅ |
| **Total** | **95 pass / 0 fail** | ✅ |

### TypeScript
```
npx tsc --noEmit → 0 errores
```

---

## 📦 Commits generados

| Commit | Cambio |
|--------|--------|
| `b7c9f80` | Core fixes: extractor + engine + backend pipeline |
| `d015dcd` | Tests de backend conversacional |
| `740c477` | App.test.tsx con RTL (enhancement card) |
| `5763ea7` | Design v1 (caído) |
| `f88b853` | Design v2 (caído) |
| `eb4116e` | Design v3 (caído) |
| `59543b6` | Design v4: cards con layouts distintos |
| `0654af2` | Design v5: universo visual coherente |
| `68676db` | Design v6: Material Symbols + escudos + animaciones |
| `8dc3db3` | Design v7: layouts creativos variados |
| `74294bb` | Design v8: universo coherente premium (tone/severity) |
| `9cba63d` | Design v9: premium con animaciones/escudos reales |
| `e068376` | Design v10: chat mobile 420px con componentes reales |
| **d2fc82e** | **Design v11: EXACTAMENTE la muestra del usuario** |

---

## ✅ Checklist operativo

- [x] Enhancement Extractor con LLM propone contextualmente
- [x] Enhancement Engine gobierna (ranking, filters, learning)
- [x] Suggested Actions se renderizan como botones reales UI
- [x] Heartbeat proactive: clima, tráfico, meds, deportes
- [x] Learning preferences se actualizan en accept/reject
- [x] Smart fallback contextual (no genérico)
- [x] Action labels mapean a texto legible
- [x] Alarm/reminder crean commitments reales
- [x] 21 cards distintas en formato chat mobile
- [x] TypeScript limpio, 95 tests pass
