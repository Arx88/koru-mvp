# Koru — Plan de Proactividad y Voz Propia

## Diagnóstico actual

### Lo que NO funciona:
1. **Recordatorios nunca se disparan** — Se guardan como commitments pero solo se revisan si la app está abierta. Si cerrás el tab, el recordatorio se pierde.
2. **No hay notificaciones del navegador** — Cero uso de Notification API, service workers, o push.
3. **El motor proactivo está roto** — TalkOverlay envía state vacío hardcoded (`memories: [], userName: "Juan"`) al endpoint `/api/koru/proactive`. El server nunca recibe info real del usuario.
4. **Morning brief no existe** — Es solo una card que el LLM puede emitir on-demand. No hay scheduler.
5. **Sin voz propia** — Koru solo responde cuando le hablan. Nunca inicia conversación, nunca sugiere, nunca recuerda proactivamente.

### Lo que SÍ funciona:
- Heartbeat corre cada 60s mientras el tab está visible
- Commitments se almacenan con `dueAt` derivado del texto
- 5 proactive nudge generators existen (pero la mayoría están rotos o filtrados)
- El endpoint `/api/koru/proactive` existe y tiene un pipeline LLM+tools completo

---

## Plan de implementación (5 fases)

### FASE 1: Notificaciones del navegador (fundación)

**Objetivo:** Que los recordatorios realmente aparezcan, incluso si el usuario está en otra pestaña.

**Cambios:**

1. **`src/ui/NotificationManager.tsx`** (nuevo componente)
   - Request permission en el primer onboarding o primer reminder
   - Función `showNotification(title, body, icon)` que usa `Notification` API
   - Click en notificación → focus al tab + scroll al turno relevante
   - Fallback: si no hay permiso, mostrar in-app toast

2. **`src/domain/notificationScheduler.ts`** (nuevo)
   - `scheduleReminder(commitment)` → calcula ms hasta `dueAt`, programa `setTimeout`
   - `checkOverdueCommitments(state)` → al abrir la app, busca commitments vencidos no recordados
   - Persiste scheduled IDs en localStorage para no duplicar

3. **`KoruProvider.tsx`** — en el heartbeat tick (cada 60s):
   - Si un commitment tiene `dueAt` dentro de los próximos 2 minutos Y no fue notificado → `showNotification`
   - Si hay commitments vencidos (dueAt < now, status open) → notificación "Se te pasó: X"

4. **Service Worker básico** (`public/sw.js`)
   - `push` event listener para notificaciones push futuras
   - `notificationclick` → focus/abrir la app
   - Registro en `main.tsx`

**Criterio de éxito:** Usuario crea reminder "recordame llamar a las 18", minimiza el tab, a las 18:00 recibe notificación del navegador.

---

### FASE 2: Morning Brief automático

**Objetivo:** Koru te saluda por la mañana con info útil del día.

**Cambios:**

1. **`src/domain/morningBrief.ts`** (nuevo)
   - `shouldShowMorningBrief(state, now)` → true si: hora local entre 6-11, no se mostró hoy, hay ≥1 memoria o commitment
   - `generateMorningBrief(state)` → arma objeto con:
     - Saludo personalizado ("Buenos días, {userName}")
     - Clima (si hay ciudad guardada)
     - Compromisos del día (commitments con dueHint = "hoy")
     - Memoria aleatoria para reforzar conexión ("¿Sabías que recordé que te gusta X?")
     - Sugerencia basada en rutinas ("Los martes sueles practicar guitarra")

2. **`KoruProvider.tsx`** — en heartbeat tick:
   - Si `shouldShowMorningBrief` → llamar al backend para generar el brief
   - Mostrar como card especial en el home (no en el chat)
   - Marcar `lastBriefDate` en state para no repetir

3. **UI: `MorningBriefCard`** (nuevo componente)
   - Card expandible con secciones: saludo, clima, pendientes, memoria del día
   - Botón "Empezar el día" → abre el chat con Koru
   - Diseño glassmorphism consistente con MemoryToast
   - Animación de entrada: slide-up + fade-in

4. **Backend: `/api/koru/morning-brief`** (nuevo endpoint)
   - Recibe state completo (memorias, commitments, ciudad)
   - LLM genera saludo personalizado + sugerencia del día
   - Tools: weather (si hay ciudad), query_personal_context
   - Devuelve: `{ greeting, weather, tasks, memoryHighlight, suggestion }`

**Criterio de éxito:** Usuario abre la app a la mañana → ve un brief con clima, pendientes y una sugerencia basada en sus memorias.

---

### FASE 3: Proactividad contextual (heartbeat mejorado)

**Objetivo:** Koru sugiere cosas basadas en contexto (hora, clima, memorias, compromisos) sin que le pidas nada.

**Cambios:**

1. **Fix del endpoint proactivo** (`TalkOverlay.tsx:659`)
   - Reemplazar state hardcoded con state real del usuario
   - Enviar: memories (confirmed), commitments (open), userName, lastSeen
   - Esto desbloquea los triggers `match_live`, `weather`, `commitment_check`, `birthday_check`

2. **`src/domain/proactiveTriggers.ts`** (nuevo — reemplaza proactiveEngine)
   - `checkCommitmentReminder(state, now)` → commitments vencidos o por vencer
   - `checkRoutineReminder(state, now)` → rutinas según día/hora (usa memorias de kind routine)
   - `checkWeatherSuggestion(state, now)` → si llueve y el usuario tiene plan outdoor
   - `checkMemorySuggestion(state, now)` → sugerir algo basado en una memoria relevante
   - `checkInactivity(state, now)` → si pasaron >2 días sin interactuar

3. **Proactive nudge UI** (mejora del sistema existente)
   - Cuando un nudge se genera → mostrar como toast animado (similar a MemoryToast)
   - Toast con: icono según tipo, texto sugerencia, botón "Decime más" → abre chat
   - Auto-dismiss después de 10s si no hay interacción
   - Si el usuario está en el chat → insertar como mensaje de Koru

4. **`src/domain/voice.ts`** (nuevo — personalidad de Koru)
   - `generateProactiveMessage(type, context, memories)` → frase natural, cálida
   - Tipos: reminder, routine_suggestion, weather_alert, memory_callback, inactivity
   - Usa las memorias del usuario para personalizar ("¿Viste que hoy jugás al tenis?")
   - NO usa templates rígidos — le pide al LLM que genere el mensaje con contexto

**Criterio de éxito:** Usuario tiene memoria "me gusta correr por las mañanas" → a las 7am Koru sugiere "Buen día para correr, ¿no? Hoy hacen 18°".

---

### FASE 4: Recordatorios que funcionan de verdad

**Objetivo:** Recordatorios que disparan notificaciones reales, incluso si la app está cerrada (con limitaciones de PWA).

**Cambios:**

1. **Reminder scheduler mejorado** (`notificationScheduler.ts`)
   - Al crear un commitment con `dueAt`:
     - Programar `setTimeout` para notificación inmediata (tab abierto)
     - Guardar en `localStorage('koru.scheduledReminders')` para check al reabrir
   - Al reabrir la app:
     - Cargar scheduledReminders
     - Para cada uno vencido → notificación inmediata "Se te pasó: X"
     - Para cada uno futuro → reprogramar setTimeout

2. **Notification permission UX**
   - En el primer reminder creado → prompt "¿Te aviso con una notificación?"
   - Si acepta → `Notification.requestPermission()`
   - Si rechaza → fallback a in-app toast + badge en home

3. **Reminder card mejorado** (UI)
   - Card de reminder con countdown en tiempo real (ej: "en 2h 15min")
   - Botones: "Posponer 15min", "Listo", "Editar"
   - Cuando vence → card cambia a estado "vencido" con botón "¿Lo hiciste?"

4. **PWA básico** (para background notifications)
   - `manifest.json` con `display: standalone`
   - Service worker con `periodicSync` (cuando el navegador lo soporte)
   - Fallback: `visibilitychange` event → check overdue al volver al tab

**Criterio de éxito:** Usuario crea reminder, cierra el tab, al volver encuentra notificación de "se te pasó" + badge en home.

---

### FASE 5: Voz y personalidad propia

**Objetivo:** Koru tiene iniciativa, no solo responde. Tiene un carácter cálido, proactivo, que demuestra que te conoce.

**Cambios:**

1. **System prompt mejorado** — agregar sección "INICIATIVA"
   - "Si notás que el usuario tiene un compromiso pronto Y no lo mencionó, mencionáselo naturalmente"
   - "Si el clima cambia y el usuario tiene un plan outdoor, avisá"
   - "Si pasaron días sin hablar, saludá y preguntá cómo está"
   - "Si el usuario mencionó algo que te contó antes, referencialo naturalmente"

2. **`src/domain/proactivePersonality.ts`** (nuevo)
   - `pickProactiveTopic(state, now)` → elige qué decir proactivamente:
     - Prioridad 1: compromiso vencido/próximo
     - Prioridad 2: rutina del día/hora actual
     - Prioridad 3: clima relevante
     - Prioridad 4: memoria callback ("hace 2 semanas dijiste que querías X")
     - Prioridad 5: inactivity check
   - `generateProactiveOpener(topic, state)` → LLM genera frase natural

3. **Proactive message en el chat**
   - Cuando Koru tiene algo proactivo que decir → aparece como mensaje de Koru
   - NO interrumpe si el usuario está escribiendo
   - Aparece con sutil animación (no abrupto)
   - Badge "💡 Sugerencia de Koru" para diferenciar de respuestas

4. **Configuración de proactividad** (Settings)
   - Toggle: "Koru puede iniciar conversación"
   - Toggle: "Notificaciones del navegador"
   - Slider: "Horas activas" (default 8-21)
   - Slider: "Máximo sugerencias por día" (default 3)
   - Toggle: "Brief matutino"

**Criterio de éxito:** Usuario abre la app después de 3 días → Koru lo saluda con algo específico ("¡Qué bueno verte! ¿Cómo te fue con ese proyecto de Python?").

---

## Priorización de implementación

| Fase | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|
| F1: Notificaciones navegador | CRÍTICO | Medio | 🔴 Inmediato |
| F4: Recordatorios reales | CRÍTICO | Medio | 🔴 Inmediato |
| F2: Morning brief | ALTO | Alto | 🟡 Segundo |
| F3: Proactividad contextual | ALTO | Alto | 🟡 Segundo |
| F5: Voz y personalidad | ALTO | Bajo | 🟢 Tercero |

## Stack técnico

- **Notificaciones:** Web Notifications API + Service Worker
- **Scheduling:** setTimeout (tab abierto) + localStorage check (reabrir) + periodicSync (PWA futuro)
- **Morning brief:** Nuevo endpoint backend + LLM synthesis
- **Proactividad:** Fix del endpoint existente + nuevos triggers basados en memorias
- **Voz:** System prompt mejorado + LLM para generar mensajes proactivos
- **UI:** Nuevos componentes (NotificationManager, MorningBriefCard, ProactiveToast) con glassmorphism y animaciones consistentes
