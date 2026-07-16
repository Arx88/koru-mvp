#!/usr/bin/env python3
"""
Genera koru-ui-audit-funcionalidades.html — informe de funcionalidades nuevas
necesarias para llevar las cards de Koru de mockups a features reales.
Misma extensión que v2. Reutiliza CSS system de v2 (ya validado por juez).
"""
import json

# Lee v2 para extraer el <head> con todo el CSS (ya validado)
with open('/home/z/my-project/download/koru-ui-audit-v2.html', 'r', encoding='utf-8') as f:
    v2 = f.read()

# Extrae desde <!DOCTYPE hasta el cierre del side rail + apertura de <main>
head_end_marker = '    <!-- ============ COVER ============ -->'
head_css = v2[:v2.index(head_end_marker)]

# ===== CATÁLOGO DE SPECS FUNCIONALES POR CARD =====
# Cada card: id, group, name, icon, accent, funcionalidad_actual, gaps (P0/P1/P2),
# data_model, api_endpoints, external_integrations, offline, privacy, ux_flow, memory_connection

CARDS = [
    # ============ VIDA DIARIA ============
    {
        "id": "weather",
        "group": "daily",
        "name": "Clima",
        "icon": "wb_sunny",
        "accent": "#f59e0b",
        "funcionalidad_actual": "Mapper weather() en presentation.ts construye hero con icon/accent dinámico (sunny→amber, rain→blue) + 3 métricas (rango/humedad/viento). Detail con advice text + tiles 'Condiciones actuales' + sources. Datos vienen de TOOL_REGISTRY.weather → weatherBlock() que extrae now/range/rain de result.data.summaryItems. executeWeb trata clima como web research genérico — NO hay API de clima real, NO hay geolocalización, NO hay pronóstico por horas ni 7 días.",
        "gaps": [
            ("P0", "Pronóstico por horas (8h scroller)", "Mockup muestra 15:00 23° Soleado · 0% lluvia · UV 6. Requiere array {hour, temp, condition, rainPct, uv}. Sin esto la card es snapshot, no herramienta de planificación."),
            ("P0", "Pronóstico 7 días (tiles)", "Mockup muestra Lun 24°/16° … Jue 19°/14°. Requiere {dayAbbrev, hi, lo, conditionIcon}. Crítico para 'debería planear X para jueves'."),
            ("P1", "Agregación multi-fuente", "Mockup muestra 3 favicons (AEMET, OpenWeather, WeatherAPI). Hoy solo result.sources se renderiza; sin agregación, sin comparación, sin badge 'verificado hace X min'."),
            ("P1", "Badge de frescura 'Hace 5 min'", "Hero badge con icon verified implica verifiedAt timestamp. Ya existe en AssistantActionPayload.verifiedAt pero weatherBlock no lo expone en hero."),
            ("P1", "Índice UV", "Campo existe en UiBlock (uv?: string) pero weatherBlock() nunca lo popula."),
            ("P1", "Auto-detección de ciudad / memoria", "Hoy city viene de call.args.city. Sin geolocation fallback, sin 'ciudad de casa recordada' de MemoryFact."),
        ],
        "data_model": "Extender weather UiBlock con hourly?: Array<{hour, temp, conditionIcon, rainPct, uv}>, daily?: Array<{dayAbbrev, hi, lo, conditionIcon}>, verifiedAt?: string, freshnessLabel?: string. Agregar WeatherSchema a src/domain/schemas/weather.ts. State: state.weatherCache?: {city, fetchedAt, payload} con TTL 30min.",
        "api_endpoints": "GET /api/koru/weather?city=...&lat=...&lng=... que hace fan-out a Open-Meteo (gratis, sin key) + OpenWeatherMap (key) + AEMET (España), agrega, retorna payload normalizado + sources + verifiedAt.",
        "external_integrations": "Open-Meteo (gratis, sin key, hourly+daily), OpenWeatherMap (key, mejor precisión), Apple WeatherKit (PWA iOS), AEMET (España).",
        "offline": "Extender offlineCache.ts con store 'weather' keyeado por city, TTL 60min. En offline, renderizar último clima cacheado con badge 'Datos de hace X min' en lugar de fallar.",
        "privacy": "Ubicación debe ser opt-in, guardada solo como city name + lat/lng en state local (no en MemoryFact remoto por defecto), con flag sensitivity:'sensitive' para coords precisas.",
        "ux_flow": "Idle: sin city set → card colapsa a CTA 'Decime tu ciudad' → micro-flow onboarding. Active: scroller hourly highlighta tile 'current hour'. Tap en day tile abre mini-detail por día. Resolved: si user descarta advice (icon X), Koru recuerda preference.weather.skipAdvice y deja de mostrarlo. Proactive: heartbeat auto-pull a las 7am si morningBrief habilitado, datos tibios al abrir app.",
        "memory_connection": "Recordar profile.homeCity y profile.travelCity. Trackear wellbeing.weatherSensitivity ('user siente frío bajo 10°' extraído del chat) para personalizar advice. Trackear preference.weatherSources (qué fuente prefiere el user tras algunas quejas 'no es exacto'). Privacy: ubicación opt-in, local solo.",
    },
    {
        "id": "morning-brief",
        "group": "daily",
        "name": "Morning Brief",
        "icon": "wb_sunny",
        "accent": "#f59e0b",
        "funcionalidad_actual": "DOS implementaciones paralelas — inconsistencia crítica: (1) Server-side POST /api/koru/morning-brief retorna {greeting, weather, tasks[], memoryHighlight, suggestion}. Renderizado por MorningBriefCard.tsx (overlay separado, NO unified card). Trigger 5-11am si localStorage.koru.lastBriefDate !== today. (2) morning_brief UiBlock: solo emitido por LLM. Mapper morningBrief() renderiza hero + flat 'Tu día' tiles. SIN integración calendario, SIN clima, SIN reflexión, SIN conteo deadlines.",
        "gaps": [
            ("P0", "Unificar las dos implementaciones", "Matar MorningBriefCard.tsx overlay; hacer que LLM emita morning_brief UiBlock con estructura rica; que server endpoint devuelva mismo shape."),
            ("P0", "Integración calendario", "Mockup 'Calendario del día' scroller necesita {time, title, detail, durationMinutes} de state.calendarEvents filtrado a hoy. Hoy calendarEvents existe pero brief generator no lo lee."),
            ("P0", "Distinción deadlines vs eventos", "Hero metric 'Deadlines 2' requiere filtrar commitments donde dueAt es hoy Y kind='deadline'. Hoy commitments no tiene kind discriminator."),
            ("P1", "Métricas hidratación/wellbeing", "Mockup 'Agua 1.4L/2L' requiere nuevo WellbeingLog record (pasos/agua/sueño) que no existe en LifeRecordKind."),
            ("P1", "Módulo reflexión", "'Hoy es un día de foco: tienes 2 deadlines…' requiere síntesis LLM sobre commitments + calendar + sentiment. Hoy brief solo retorna suggestion, sin reflexión enfocada."),
            ("P1", "Módulo clima", "Mockup muestra 2 tiles (Hoy/Mañana). Requiere llamar weather API en misma pasada de brief generation."),
        ],
        "data_model": "Extender morning_brief UiBlock con date?: string, calendar?: Array<{time, title, detail, durationMinutes}>, deadlines?: Array<{title, dueText}>, weather?: {today: {hi,lo,condition}, tomorrow: {hi,lo,condition}}, reflection?: string, hydration?: {current, goal}. State: state.lastBriefDate?, state.lastBriefBlock? para no re-fetch al reabrir app.",
        "api_endpoints": "Reescribir /api/koru/morning-brief para aceptar KoruState completo, fan-out a getCalendarForToday(), getWeatherForUserCity(), getOpenDeadlinesForToday(), luego sintetizar con 1 LLM call retornando el bloque rico.",
        "external_integrations": "ICS calendar feed (ya en calendar.ts), weather API (ver card clima).",
        "offline": "Brief debe funcionar offline — pre-generar en heartbeat de la noche anterior, cachear en offlineCache.ts store 'turns' taggeado kind:'morning_brief'.",
        "privacy": "Brief es la superficie más sensible (calendario + memorias + salud). LLM call debe incluir solo memorias confirmed y NUNCA sensitivity:'sensitive' salvo durableMemoryEnabled=true.",
        "ux_flow": "Idle (antes 5am o después 11am): card no mostrada. Si user pide 'resumí mi día' mismo generador corre on-demand. Active (5-11am, primer open): card anima in, art '3' count-up, hero badge 'Jue 14 mar'. Resolved: tap calendar item abre calendar_event action proposal; tap deadline abre commitment; tap 'Empezar el día' marca brief como seen y dismiss. Proactive: regenerar si user abre app después 14:00 con lastBriefDate===today pero state cambió materialmente.",
        "memory_connection": "Guardar routine.morningWakeHour (inferido de cuándo abre app típicamente). Guardar preference.briefTone (concise vs detailed). Guardar routine.focusBlocks ('9-11h es foco para Ana'). Privacy: LLM solo recibe memorias confirmed, nunca sensitive salvo durableMemoryEnabled.",
    },
    {
        "id": "alarm",
        "group": "alarm",
        "name": "Alarma",
        "icon": "alarm",
        "accent": "#ef4444",
        "funcionalidad_actual": "alarm UiBlock tiene title, time, repeat, note. Mapper alarm() renderiza hero + 2 acciones inline (Apagar=dismiss, Postergar 10 min=snooze). SIN detail screen — mockup de 3 módulos (Detalles / Próximas alarmas timeline / Consejo) totalmente ausente. Action handler en KoruProvider.tsx:1425 matchea commitments por título (frágil — títulos duplicados colisionan) y flip status a done/dismissed. 'snooze' solo muestra toast y NO reagenda. TOOL_REGISTRY.alarm policy requiresApproval:true, risk:local_write. NO manejo de recurrencia, NO calendario feriados, NO alarma OS real (solo Notification).",
        "gaps": [
            ("P0", "Detail screen con 3 módulos", "Mockup muestra Detalles (Cuándo/Dónde/Frecuencia/Etiqueta tiles), Próximas alarmas (3-step timeline done/current/pending), Consejo. Hoy: cero detail."),
            ("P0", "Snooze real", "'Postergar 10 min' debe re-agendar notificación 10 min después y actualizar commitment.dueAt. Hoy es no-op toast."),
            ("P0", "Engine de recurrencia", "Mockup 'Se repite: Lunes a Viernes'. Commitment.recurrence existe pero alarm block solo tiene repeat string. Necesita structured repeat: {days:number[], frequency:'daily'|'weekdays'|'weekends'|'weekly'|'monthly'}."),
            ("P1", "Silencio consciente de feriados", "Mockup advice: 'Considera silenciarla los feriados automáticamente'. Requiere feed calendario feriados por país."),
            ("P1", "Timeline próximas alarmas", "Requiere calcular próximos 5 firings desde recurrence rule."),
            ("P2", "Badge 'Activa'", "Mockup hero badge 'Activa' con verified icon. Necesita alarm.state: 'armed'|'firing'|'snoozed'|'dismissed'."),
        ],
        "data_model": "Extender alarm UiBlock con state?: 'armed'|'firing'|'snoozed'|'dismissed', location?: string, meetingUrl?: string, tag?: string, nextFirings?: Array<{at, label}>, advice?: string. Reemplazar repeat?: string con recurrence?: {frequency, days?: number[]}. State: state.alarms?: Alarm[] separado de commitments, o extender Commitment con kind:'alarm'|'reminder'|'deadline'|'task'.",
        "api_endpoints": "POST /api/koru/alarms (create), POST /api/koru/alarms/:id/snooze (reschedule), POST /api/koru/alarms/:id/dismiss. GET /api/koru/holidays?country=AR&year=2025 proxy holiday API.",
        "external_integrations": "Web Notifications API (actual), Service Worker showNotification con tag para dedup, navigator.wakeLock para PWA viva, native bridge para alarma OS real (Android AlarmClock via Capacitor).",
        "offline": "Alarmas deben disparar offline — service worker notificationclick + IndexedDB queue. offlineCache.ts agregar store 'alarms'. Hoy si browser tab cerrada, alarma nunca dispara (solo setTimeout funciona con tab abierta).",
        "privacy": "Alarmas revelan horario laboral — sensitivity:'normal' por defecto pero meeting URL/location debe ser 'sensitive' si es dirección privada.",
        "ux_flow": "Idle: card no mostrada hasta 5 min antes time (estado 'firing' con glow rojo). Active (firing): full-screen takeover con dismiss/snooze; mascot worried si overdue >1 min. Resolved: card colapsa a 'Alarma apagada · 9:00' toast, commitea commitment.status='done', si recurring calcula próximo firing. Proactive: a firing time, push notification + chat injection 'Son las 9:00 — Reunión equipo empieza en Zoom' con deep link.",
        "memory_connection": "Guardar routine.wakeAlarm y routine.workAlarm (inferidos de alarmas recurrentes). Guardar preference.snoozeDuration (default 10 min, aprender si siempre snoozea 5). Trackear preference.alarmTone y preference.alarmVibration. Privacy: alarmas revelan horario, normal por defecto pero meeting URL sensitive.",
    },
    {
        "id": "reminder",
        "group": "alarm",
        "name": "Recordatorio",
        "icon": "notifications",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "reminder UiBlock tiene title, dueText, note. Mapper reminder() renderiza hero + 2 acciones inline (Listo=complete, Posponer=snooze). SIN detail screen — mockup 3 módulos (Detalles / Nota / Ideas chips) ausente. Action handler matchea commitments por título (frágil). TOOL_REGISTRY.calendar_reminder crea Commitment con dueHint. Notification scheduling via NotificationManager.tsx. 'Posponer' NO reagenda.",
        "gaps": [
            ("P0", "Detail screen con 3 módulos", "Mockup muestra Detalles (3 tiles: Cuándo/Motivo/Acción), Nota (texto personal), Ideas (4 chips Libro/Flores/Chocolates/Tarjeta). Hoy: cero detail."),
            ("P0", "Snooze real con opciones", "'Posponer' debe ofrecer 5min/15min/1h/tomorrow. Hoy es no-op fijo."),
            ("P0", "Metadata contextual (Motivo/Acción)", "Mockup tiles 'Motivo: Cumpleaños', 'Acción: Llamar'. Requiere reminder.reason?: string y reminder.actionType?: 'call'|'message'|'email'|'visit'|'task'."),
            ("P1", "Engine de ideas de regalo/acción", "Mockup 'Ideas: Libro/Flores/Chocolates/Tarjeta' requiere generador por tipo. Cumpleaños → catálogo regalos. Recordatorio llamada → script. Doctor visita → checklist."),
            ("P1", "Persona vinculada", "'Llamar a mamá' debe linkear a Person en memoria (nombre, cumple, relación, historial regalos). No existe Person type hoy — solo LifeRecord.person?: string."),
            ("P1", "Detección cumpleaños → conversión", "Si reminder es cumpleaños, generar birthday_alarm UiBlock (existe en types) con countdown, sugerencias regalo, tracking edad."),
        ],
        "data_model": "Extender reminder UiBlock con reason?: string, actionType?: 'call'|'message'|'email'|'visit'|'task', personId?: string, location?: string, ideas?: Array<{emoji, title, detail}>, personalNote?: string, state?: 'pending'|'done'|'snoozed'|'overdue'. Agregar Person type {id, name, relationship, birthday, giftPreferences, lastContactedAt} a state.people?: Person[].",
        "api_endpoints": "POST /api/koru/reminders (create con shape completo), POST /api/koru/reminders/:id/complete, POST /api/koru/reminders/:id/snooze con {durationMinutes}. GET /api/koru/ideas?type=birthday&personId=... retorna ideas LLM-generated desde giftPreferences de persona.",
        "external_integrations": "Phone dialer (tel: URL scheme), WhatsApp (wa.me), Maps (geo: para visit reminders), Contacts API (Web Contacts Picker en Android Chrome).",
        "offline": "Reminders deben disparar offline — mismo service-worker approach que alarmas. Store 'notifications' en offlineCache.ts persiste snooze history.",
        "privacy": "Person data es altamente sensible (PII). Default sensitivity:'sensitive'. NUNCA incluir phone numbers en LLM context salvo durableMemoryEnabled. Ideas engine debe correr local (LLM chico) o con consent explícito per-call.",
        "ux_flow": "Idle: reminder card surfacea 1h antes dueAt (lead time configurable por tipo). Active: hero muestra 'Hoy · Es su cumpleaños' con countdown; tap 'Listo' dispara actionType (ej abre tel:mom si call). Resolved: card morfea a 'Hecho ✓' con mascot celebrating; commitea LifeRecord.kind='person_followup' actualizando lastContactedAt. Proactive: si reminder es person_followup y último contacto >30 días, heartbeat inyecta nudge 'Hace 32 días no hablas con mamá'.",
        "memory_connection": "Guardar relationship.personId memories (cumple mamá, edad, preferencias regalo extraídas del chat). Guardar relationship.contactCadence (user llama a mamá cada ~10 días) → informar nudges proactivos. Trackear preference.giftStyle (practical vs sentimental). Guardar routine.reminderLeadTime (default 1h, aprender por tipo). Privacy: person data altamente sensible, default 'sensitive'.",
    },
    {
        "id": "wellbeing",
        "group": "wellbeing",
        "name": "Bienestar",
        "icon": "favorite",
        "accent": "#8127cf",
        "funcionalidad_actual": "wellbeing UiBlock tiene title, emoji, sections: Array<{icon, iconColor, bgColor, borderColor, value, label}>, sleep?, suggestion?. Mapper wellbeing() flattenea sleep+suggestion+sections en tiles array, renderiza hero con 3 métricas, detail con 1 sección 'Detalle' tiles. Sin data source real — puramente LLM-emitted, nunca poblado desde sensores. wellbeing MemoryKind existe pero ningún extractor produce wellbeing memories con valores cuantitativos.",
        "gaps": [
            ("P0", "Streak tracking ('Racha 4 días')", "Mockup hero badge muestra meditation streak. Requiere state.wellbeingStreaks?: {meditation: {current, best, lastDate}, water, sleep}. Nada existe hoy."),
            ("P0", "Métricas salud reales", "Mockup muestra Sueño 7.2h, Pasos 8.4k, HR 72bpm, Stress Bajo. Hoy son strings inventados LLM. Requiere HealthKit (iOS) / Health Connect (Android) bridge via Web APIs."),
            ("P1", "Library de sesiones meditación", "Mockup 'Sesión sugerida' scroller muestra Respiración 4-7-8 · 5 min · Fácil y Body scan · 10 min · Medio. Requiere catálogo estático + per-session lastPerformedAt tracking."),
            ("P1", "Aprendizaje ritmo circadiano", "Mockup advice 'Tu mejor hora es 18h según tu ritmo circadiano' requiere inferir peak focus hours de activity logs pasados."),
            ("P2", "Inferencia nivel stress", "'Stress Bajo' requiere correlacionar HRV (si disponible) + sentiment recent DailyEntry + sleep deficit."),
            ("P1", "Hero de 4 métricas", "Mockup compact muestra 3 métricas, extended muestra 4 tiles. Hoy mapper cap a 3."),
        ],
        "data_model": "Agregar WellbeingLog type {id, userId, date, metric: 'sleep'|'steps'|'hr'|'hrv'|'water'|'meditation'|'mood', value: number, unit, source: 'manual'|'healthkit'|'healthconnect'|'fitbit'}. Agregar a state.wellbeingLogs?: WellbeingLog[]. Extender wellbeing UiBlock con streak?: {current, label}, sessions?: Array<{id, title, durationMin, level, description}>, metrics?: Array<{key, value, unit, trend?}>. State: state.wellbeingSettings?: {meditationReminderHour, hydrationGoalMl, sleepGoalHours, enabledMetrics}.",
        "api_endpoints": "GET /api/koru/wellbeing/today agregando logs últimas 24h. POST /api/koru/wellbeing/log para entry manual. POST /api/koru/wellbeing/meditation/start → trackea session completion.",
        "external_integrations": "HealthKit Connector (iOS via PWA 16.4+ con apple-health: URL scheme), Health Connect (Android), Fitbit/Oura/Garmin via OAuth. Web API standardization pobre — probablemente necesite Capacitor/native shell para sensor access real.",
        "offline": "Wellbeing logs deben ser local-first. IndexedDB (extender offlineCache.ts con store 'wellbeing') para que card renderice offline. Sync remoto solo si durableMemoryEnabled.",
        "privacy": "🔴 Health data es la superficie más regulada (HIPAA, GDPR Art. 9). Debe ser opt-in per metric, NUNCA enviada a LLM context salvo durableMemoryEnabled Y consent explícito per-metric. System prompt debe stripear valores numéricos health cuando ephemeralMode on.",
        "ux_flow": "Idle: card surfacea solo cuando Koru detecta 'soft signal' (ej 4 días sin meditar). Si user no tiene streak ni goal set, card dormida. Active: hero muestra 'Racha 4 días' count-up; tap session card inicia timer overlay con breathing animation. Resolved: post-meditation, card morfea a 'Bien hecho — racha 5 días' celebration mascot, commitea WellbeingLog, sugiere próxima sesión. Proactive: heartbeat a meditationReminderHour (aprendido) inyecta ProactiveNudge source:'heartbeat'.",
        "memory_connection": "Guardar wellbeing.meditationStreak, wellbeing.bestFocusHour (inferido), wellbeing.circadianPeak — todos MemoryKind='wellbeing', sensitivity:'normal'. Guardar wellbeing.healthConditions (ej 'hipertensión') como sensitivity:'sensitive' — usar para gatear advice (no sugerir 4-7-8 si embarazada). Trackear preference.meditationStyle. Privacy: HIPAA/GDPR Art. 9, opt-in per metric, redactar de LLM context.",
    },
    # ============ PRODUCTIVIDAD ============
    {
        "id": "plan",
        "group": "productivity",
        "name": "Plan",
        "icon": "rocket_launch",
        "accent": "#8363f9",
        "funcionalidad_actual": "planFromState() en koruBackend.ts genera 4 AssistantPlanItem sintéticos desde primeros 5 Commitment abiertos. Hardcodea time ('Ahora', '+25m', '+50m', '+75m'), durationMinutes (25/15), rationale. Data sources: state.commitments (status='open') y state.records (slice 0..5). NO lee memoria ni calendario. PlanHeroCard renderiza hero + 3 categorías por regex deriveCategories + CTA → PlanRoadmapScreen. Persistencia: paso 'done' se guarda en localStorage con clave koru.plan.progress.<hash> — NO sobrevive multi-device ni uninstall.",
        "gaps": [
            ("P0", "Plan entity durable", "Mockup 'Lanzar producto MVP · 7 pasos · 3 semanas estimadas'. Hoy no existe 'Plan' como entidad persistente: cada turno regenera items. Crear Plan type {id, title, goalId, steps: PlanStep[], estimatedWeeks, status, createdAt, archivedAt} y guardar en state.plans."),
            ("P0", "PlanStep con estado real", "Mockup muestra is-done/is-current/is-pending. Hoy AssistantPlanItem.done? existe pero se descarta al regenerar. Persistir doneAt, order, phaseLabel (Discovery/Auditar/Diseñar MVP/Validar), detail, timeEstimate."),
            ("P0", "Prioridad Alta/Media/Baja real con conteo", "Mockup compact muestra métricas 'Alta 3 / Media 2 / Baja 2'. Hoy AssistantPlanItem.priority existe pero no se agregan cuentas."),
            ("P1", "Distribución de tiempo por fase", "Módulo mockup (4 tiles: Discovery 3 días, Diseño 5 días, Desarrollo 8 días, QA 3 días). Requiere PlanStep.phase + PlanStep.estimatedDays."),
            ("P1", "Notas del plan / Estrategia", "Módulo 'Notas del plan' con párrafo estratégico. Hoy solo block.note corto. Necesita Plan.notes[] con timestamp + autor."),
            ("P0", "Persistencia en IndexedDB", "Reemplazar localStorage.getItem(storageKey) de PlanRoadmapScreen por state.plans[i].steps[j].doneAt que sincroniza con writePersistedState."),
            ("P1", "Acción 'Guardar' + 'PDF'", "Botones inertes hoy. Conectar save → createRecord con sourceBlock. Conectar pdf → pdfExport.ts (ya existe)."),
        ],
        "data_model": "Nuevo slice plans: Plan[] en KoruState. Plan = {id, title, goalId?, steps: PlanStep[], createdAt, updatedAt, status: 'active'|'completed'|'archived', estimatedWeeks?, strategyNotes?[]}. PlanStep = AssistantPlanItem & {id, doneAt?, phase?, estimatedDays?, detail?}.",
        "api_endpoints": "Extender plan_day tool para aceptar mode:'day'|'project' y devolver Plan durable (no solo UiBlock). Nuevo tool plan_progress_update(planId, stepId, done).",
        "external_integrations": "Ninguna externa — todo local-first. Si sync futuro, plan viaja como snapshot.",
        "offline": "Todo local-first; plan vive 100% en cliente.",
        "privacy": "Planes pueden revelar objetivos personales/sensibles. Default sensitivity:'normal' pero plans con keywords salud/finanzas marcar 'sensitive'.",
        "ux_flow": "Lifecycle: draft (mientras LLM arma) → active (visible en chat) → paused → completed (todos steps done) → archived (7 días después, movido a Collections). Proactive: heartbeat encuentra plans[] con status='active' y steps pendientes >3 días → nudge 'Tu plan X tiene 3 pasos pendientes. ¿Seguimos?'. Cross-card: si Plan incluye steps tipo 'exercise', generar card-routine + card-exercise-plan vinculados via planId.",
        "memory_connection": "Al crear plan, guardar MemoryFact(kind='goal', text='Está trabajando en: {title}', useForSuggestions=true). Al completar, actualizar a 'Completó: {title} en N semanas' y marcar status='confirmed'. Collections: botón Guardar persiste Plan como LifeRecord(kind='decision', sourceBlock=planBlock, collection='Planes'). Reabrir desde Collections regenera detail screen. Habit loop: si Plan dura >2 semanas, último step dispara MemoryFact(kind='preference', text='Prefiere planes de {N} semanas con pasos de {M} días').",
    },
    {
        "id": "smart-checklist",
        "group": "productivity",
        "name": "Checklist",
        "icon": "checklist",
        "accent": "#8363f9",
        "funcionalidad_actual": "smart_checklist UiBlock: {title?, progress?, items: Array<{label, checked}>} — muy minimalista. Mapper koruBackend.ts solo lo construye cuando LLM emite bloque. No hay tool dedicado. No hay personal_query topic que lo genere desde records. Data sources: ningún LifeRecord.kind mapea a checklist. UI: chatCards.tsx enruta a KoruUnifiedCard sin handler especializado. checked son booleanos sin persistencia — al recargar, estado se pierde porque uiBlock vive en turno del chat, no en state.",
        "gaps": [
            ("P0", "Checklist entity durable", "Crear Checklist = {id, title, items: ChecklistItem[], dueAt?, collection?, status, createdAt, completedAt?} y persistir en state.checklists. Reemplazar UiBlock smart_checklist por referencia block.checklistId."),
            ("P0", "ChecklistItem con urgencia + metadata", "Mockup muestra item 'eSIM Japón · Urgente' con icon rojo y badge '!'. Hoy solo {label, checked}. Necesita urgency:'normal'|'urgent'|'blocked', dueAt?, detail?, doneAt?, source?."),
            ("P0", "Cálculo de progreso derivado", "Mockup compact: '8 de 12 completados · 4 pendientes' y badge '67% completo'. Hoy progress es número arbitrario LLM. Calcular Math.round(doneCount / items.length * 100)."),
            ("P0", "Toggle de items persistente", "Checkboxes del mockup no funcionan hoy. Handler toggleChecklistItem(checklistId, itemId) → update doneAt + recalcular progreso + nudge si todos done."),
            ("P1", "Métricas con count-up", "Mockup extended 4 tiles: Progreso / Días restantes / Urgentes / Completados. Derivar daysRemaining de dueAt - now."),
            ("P1", "Botones Guardar/PDF", "save → createRecord(kind='idea', sourceBlock=checklistBlock, collection='Checklists'). pdf → pdfExport.ts."),
        ],
        "data_model": "state.checklists: Checklist[]. ChecklistItem = {id, label, detail?, urgency, dueAt?, doneAt?, source?: 'manual'|'extracted'|'record'}.",
        "api_endpoints": "Nuevo tool create_checklist(title, items, dueAt?) y update_checklist_item(id, itemId, done). Extender schema LLM para emitir smart_checklist cuando user diga 'armame un checklist para X'.",
        "external_integrations": "Ninguna directa. Opcional: export a Todoist/Apple Reminders via webhook.",
        "offline": "Local-first. Si user comparte checklist, exportar como texto/markdown via pdfExport.ts.",
        "privacy": "Checklists pueden contener PII (ej 'pasaporte'). Items con keyword pasaporte/visa marcar 'sensitive'.",
        "ux_flow": "Lifecycle: created (turno chat o create_checklist tool) → active (card en chat, referenciada por checklistId) → in-progress (algunos items done) → completed (todos done) → archived (a Collections tras 14 días). Proactive: heartbeat — si checklist tiene dueAt en 3 días y quedan >50% items pendientes → nudge 'Tu checklist {title} vence en 3 días y faltan N items'. Cross-card: si checklist es de viaje (regex 'viaje|pasaporte|visa|eSIM'), ofrecer crear card-routine 'Pre-viaje: 7 días antes'.",
        "memory_connection": "Al completar checklist, MemoryFact(kind='task', text='Completó checklist: {title} en N días'). Si user rechaza/ignora items urgentes reiteradamente, MemoryFact(kind='boundary', text='No le gusta que le recuerde items de {tipo}'). Collections: botón Guardar persiste como LifeRecord(kind='idea', sourceBlock, collection='Checklists'). Reabrir permite seguir tachando items via reopenRecord. Habit loop: si user crea checklists con patrón recurrente (ej 'checklist viaje' cada 2 meses), ofrecer plantilla. Guardar MemoryFact(kind='routine', text='Arma checklists de viaje cada ~60 días').",
    },
    {
        "id": "routine",
        "group": "productivity",
        "name": "Rutina diaria",
        "icon": "repeat",
        "accent": "#3b82f6",
        "funcionalidad_actual": "NO existe como card ni como entidad. Mockup muestra 'Mañana productiva · 5 de 7 hábitos · Racha 7 días · Adherencia 82%'. Data sources más cercanos: MemoryFact(kind='routine') guarda oraciones pasivas ('Me despierto a las 7'). Commitment.recurrence existe pero solo genera next dueAt al completar — no lleva streak, no lleva log histórico. UI más cercana: PlanRoadmapScreen tiene sección 'Seguimiento de Hábitos' que en realidad muestra priorities (nudges+commitments+actions), no hábitos reales. Ningún log de hábitos en state.",
        "gaps": [
            ("P0", "Habit entity durable", "Crear Habit = {id, label, icon, cadence:'daily'|'weekly'|'mon-fri'|'custom', target:number, unit?, anchorTime?, active:boolean, createdAt, archivedAt?} y persistir en state.habits."),
            ("P0", "HabitLog diario", "Crear HabitLog = {id, habitId, date, value:number, completedAt} para trackear '1.4L hasta ahora' (mockup). Persistir en state.habitLogs (slice con TTL)."),
            ("P0", "Streaks reales", "Mockup muestra 'Racha 7 días · Mejor 21 días · Activos 7'. Calcular currentStreak (días consecutivos), bestStreak, activeCount. Función computeStreak(habitId, logs)."),
            ("P0", "Adherencia semanal", "Mockup 'Adherencia 82%'. Calcular doneCount / expectedCount en últimos 7 días."),
            ("P1", "Vista semanal con scroller", "Mockup k-scroller con cards Lun/Mar/Mié mostrando '7/7 · Completo · 100%'. Generar 7 cards desde habitLogs filtrados por día."),
            ("P1", "Hábitos de hoy con progreso parcial", "Mockup muestra 'Beber 2L agua · 1.4L hasta ahora · 70%'. Hoy solo boolean done/not-done. Necesita HabitLog.value + Habit.target + cálculo value/target."),
            ("P0", "Rutina agrupada", "Mockup es 'Mañana productiva' (5 de 7 hábitos). Rutina = conjunto de hábitos anclados a franja horaria. Crear Routine = {id, name, anchorTime, habitIds[], daysOfWeek[]}."),
        ],
        "data_model": "state.habits: Habit[], state.habitLogs: HabitLog[] (cap 1000 con FIFO), state.routines: Routine[]. Habit = {id, label, icon, cadence, target, unit?, anchorTime?, active, createdAt, archivedAt?}. Routine = {id, name, anchorTime, habitIds[], daysOfWeek[]}.",
        "api_endpoints": "create_habit(label, cadence, target, anchorTime?), log_habit(habitId, value?, date?), create_routine(name, anchorTime, habitIds, days). Exponer al LLM en system prompt.",
        "external_integrations": "Opcional: Apple Health / Google Fit / Health Connect para auto-log agua, sueño, pasos. Webhook en tools/health/ (ya existe sleepTrack, hydrationRemind).",
        "offline": "100% local. App ya tiene sleepTrack, hydrationRemind tools — extenderlas para escribir en habitLogs en vez de solo records.",
        "privacy": "Hábitos revelan rutina personal. Default 'normal' pero hábitos de salud (medicación, terapia) marcar 'sensitive'.",
        "ux_flow": "Lifecycle: propuesto (LLM detecta 'quiero hacer X todos los días') → confirmado → activo (entra al pool de hoy) → pausado (user congela sin perder streak) → archivado. Proactive: heartbeat a anchorTime de cada hábito activo, si no hay HabitLog hoy → nudge '¿Tomaste agua?'. Cross-card: hábitos tipo 'ejercicio' alimentan card-exercise-plan. Hábitos 'agua/sueño' alimentan card-wellbeing. Rutina 'Mañana' puede anclarse a card-morning-brief.",
        "memory_connection": "MemoryFact(kind='routine', text='Toma 2L de agua diarios') confirmado al primer HabitLog. Si adherencia cae <40% por 2 semanas, MemoryFact(kind='wellbeing', text='Le cuesta mantener hábito de hidratación') para suavizar tono en próximos nudges. Collections: rutinas completas se guardan como LifeRecord(kind='idea', sourceBlock=routineBlock, collection='Rutinas'). Permitir 'duplicar rutina' desde Collections. Habit loop: al cerrar día, si currentStreak > bestStreak, nudge celebratorio + EnergyEvent bonus. Si streak===0 por 3 días, nudge '¿Pausamos {habit} por una semana? No pasa nada.'",
    },
    {
        "id": "exercise-plan",
        "group": "productivity",
        "name": "Plan de ejercicio",
        "icon": "fitness_center",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "NO existe como card, ni como entidad, ni como UiBlock type. Mockup muestra 'Full Body 12 semanas · Sesión 5 de 12 · Kcal 1.240 · Tiempo 4h 30min · Fuerza +12%'. Data sources más cercanos: PlanHeroCard.deriveCategories() regex-detecta entren|ejercicio|hiit|yoga|correr|gym|caminar|cardio|fuerza. Pero plan block no lleva sets/reps/weight. Health tools existentes: sleepTrack, hydrationRemind, medicationReminder — NO hay log_workout ni exercise_plan. Ningún LifeRecord.kind para ejercicio.",
        "gaps": [
            ("P0", "ExercisePlan entity durable", "Crear ExercisePlan = {id, name, weeksTotal, sessions: ExerciseSession[], currentSessionIdx, createdAt, status}. Mockup 'Full Body 12 semanas' con sesión actual resaltada."),
            ("P0", "ExerciseSession con ejercicios", "ExerciseSession = {id, dayLabel ('Full Body B'), exercises: ExerciseSet[], completedAt?}. Mockup muestra timeline S1-S5 con is-done/is-current."),
            ("P0", "ExerciseSet con sets/reps/weight", "Mockup 'Sentadilla 4x8 80kg · Press banca 4x6 60kg · Peso muerto 3x5 100kg · Plancha 3x45s'. Necesita ExerciseSet = {exercise, sets, reps, weight?, durationSec?, restSec?, notes?}."),
            ("P1", "Progreso de fuerza con 1RM", "Mockup scroller '+12% Sentadilla 72kg → 80kg · 1RM 100kg'. Calcular 1RM con fórmula Epley (weight * (1 + reps/30)). Persistir ExerciseSet histórico para deltas."),
            ("P0", "Métricas agregadas", "Mockup compact: 'Kcal 1.240 · Tiempo 4h 30min · Fuerza +12%'. Derivar kcal (METs × peso × duración), totalTime (suma durationSec), strengthDelta (avg 1RM actual vs 4 semanas atrás)."),
            ("P0", "Timeline de sesiones", "Mockup extended timeline 12 sesiones con is-done/is-current/is-pending. Reusar k-timeline CSS."),
            ("P1", "Scroller de progresión", "Mockup k-scroller cards '+12% Sentadilla 72kg→80kg'. Una card por ejercicio tracked."),
        ],
        "data_model": "state.exercisePlans: ExercisePlan[], state.workoutLogs: WorkoutLog[]. WorkoutLog = {id, planId, sessionId, date, exercises: ExerciseSet[], durationMin, kcal?}. ExerciseSet = {exercise, sets, reps, weight?, durationSec?, restSec?, notes?}.",
        "api_endpoints": "create_exercise_plan(name, weeks, sessions[]), log_workout(planId, sessionId, sets[]), progress_session() (avanza currentSessionIdx).",
        "external_integrations": "Opcional: Apple Health / Google Fit para kcal y duración auto. Strava webhook opcional. Para MVP, todo manual.",
        "offline": "100% local-first. Gym sin señal = UX crítica. Asegurar logWorkout funciona offline y sincroniza al recuperar conexión.",
        "privacy": "Datos fitness generalmente 'normal' pero weight/body metrics marcar 'sensitive'.",
        "ux_flow": "Lifecycle: propuesto (LLM o create template) → activo (timeline visible) → en-curso (sesión actual) → descanso (entre sesiones) → completado (12/12) → archivado a Collections con stats finales. Proactive: heartbeat si última WorkoutLog >3 días y currentSessionIdx no avanzó → nudge 'Hoy toca Full Body B. ¿Lo hacemos?'. Respetar daysOfWeek del plan. Cross-card: cada sesión completada actualiza card-routine (hábito 'correr 5km'). Gasto calórico alimenta card-wellbeing. Si user descansa >5 días, sugerir card-decision-support '¿Pivoteamos a plan más suave?'.",
        "memory_connection": "Al crear plan, MemoryFact(kind='goal', text='Quiere completar plan de fuerza de 12 semanas'). Al completar, MemoryFact(kind='wellbeing', text='Completó plan Full Body 12 sem · +12% fuerza'). Si user abandona a mitad, MemoryFact(kind='boundary', text='Le cuesta sostener planes de >8 semanas') — usar para futuras sugerencias de planes más cortos. Collections: plan completo archivado como LifeRecord(kind='idea', sourceBlock=exercisePlanBlock, collection='Planes Fitness'). WorkoutLogs individuales NO se guardan en Collections (raw data). Habit loop: tras 4 sesiones en 2 semanas, MemoryFact(kind='preference', text='Responde mejor a planes de 4 sesiones/semana'). plan_day futuros respeta este patrón.",
    },
    {
        "id": "shopping-list",
        "group": "productivity",
        "name": "Lista de compras",
        "icon": "shopping_cart",
        "accent": "#f59e0b",
        "funcionalidad_actual": "shopping_list UiBlock: {title, items: string[], dueText, note, quantities?, checked?}. quantities y checked existen pero NO se persisten — viven solo en turno del chat. Mapper lee state.records filtrando kind='shopping_item' y mapea record.title → string plano (pierde value, amount, collection). CreateScreen template 'lista' produce kind='lista' (no en enum LifeRecordKind) con notes conteniendo bullets. NO produce shopping_list UiBlock ni items estructurados. Cada item es LifeRecord separado, sin noción de 'lista madre'. No hay estado 'en carrito', no hay precio por item, no hay total. Tachar items no funciona.",
        "gaps": [
            ("P0", "ShoppingList entity durable", "Crear ShoppingList = {id, title, store?, items: ShoppingItem[], dueAt?, status, totalSpent?, totalEstimate?, createdAt, completedAt?} y persistir en state.shoppingLists. Reemplazar mapeo shopping_item records sueltos por referencia listId."),
            ("P0", "ShoppingItem con precio, qty, estado", "Mockup muestra 'Leche entera 2L · €2.40 ✓ / Huevos 12 · €2.10 ✓'. Necesita ShoppingItem = {id, name, qty?, unit?, price?, currency?, checked, checkedAt?, category?}."),
            ("P0", "Cálculo de totales en vivo", "Mockup tiles: 'Ítems 8 / Comprados 3 / Gastado €12.40 / Restante €32.60'. Derivar spent = sum(checked items price), remaining = sum(unchecked price)."),
            ("P0", "Toggle de items persistente", "Checkboxes del mockup no funcionan. Handler toggleShoppingItem(listId, itemId) → update checked + checkedAt + recalcular totales."),
            ("P1", "Store binding", "Badge 'Mercadona' del hero. ShoppingList.store ya existe en mockup, hoy no."),
            ("P1", "Botones Guardar/PDF", "save → createRecord(kind='shopping_item', sourceBlock, collection='Listas'). pdf para imprimir/llevar al super."),
            ("P2", "Categorización automática", "Reordenar lista por pasillo del super. Mapa estático category → aisleOrder."),
        ],
        "data_model": "state.shoppingLists: ShoppingList[]. Migrar LifeRecord.kind='shopping_item' existentes a ShoppingList.items[]. ShoppingItem = {id, name, qty?, unit?, price?, currency?, checked, checkedAt?, category?}.",
        "api_endpoints": "Extender tool save_personal_item para aceptar listId?. Nuevo toggle_shopping_item(listId, itemId), add_shopping_item(listId, name, qty?, price?), complete_shopping_list(listId) (marca todo comprado + genera expense records).",
        "external_integrations": "Opcional: BarcodeDetector API para lookup producto + precio. MVP: manual.",
        "offline": "Crítico — lista se usa en super sin señal. Asegurar toggleShoppingItem funciona 100% offline.",
        "privacy": "Lista de compras revela hábitos alimenticios. Default 'normal' pero items de salud (medicación, higiene) marcar 'sensitive'.",
        "ux_flow": "Lifecycle: created (chat o CreateScreen template 'lista' — actualizar para producir shopping_list no lista) → active → in-progress (algunos checked) → completed (todos checked) → archived a Collections con totales finales. Proactive: heartbeat si es sábado 9am (día típico super) y hay ShoppingList status='active' con items unchecked → nudge '¿Llevás la lista al super? Faltan N items'. Cross-card: items de card-plan step 'comprar X' derivan a card-shopping-list. Items de card-recipe alimentan lista automáticamente. Al completar, dispara actualización de card-money-summary.",
        "memory_connection": "Al completar 3 listas del mismo store, MemoryFact(kind='routine', text='Compra semanal en {store} ~€{avg}'). Items comprados >5 veces → MemoryFact(kind='preference', text='Compra {item} regularmente') para auto-suggest. Collections: lista completa archivada como LifeRecord(kind='shopping_item', sourceBlock, collection='Listas') con amount=totalSpent. Reabrir permite ver/editar items. Habit loop: si user completa listas cada 7 días, ofrecer plantilla 'Lista del super semanal' pre-poblada. Si gasta >20% del promedio, nudge en próximo card-money-summary 'Esta semana gastaste €X sobre lo habitual'.",
    },
    # ============ SPORTS ============
    {
        "id": "live-match",
        "group": "sports",
        "name": "Partido en vivo",
        "icon": "sports_soccer",
        "accent": "#ef4444",
        "funcionalidad_actual": "match_live tool (football.ts:427) es la card más madura: consulta ESPN scoreboards en 8 ligas, enriquece primer match via /summary (goals, yellow/red cards, substitutions, lineups con formations, detailedStats con isPercent flag, venue, attendance), fallback TheSportsDB. Cache TTL sportsLive=30s. live_match UiBlock ya soporta todos los campos del mockup: scores, possession, shots, corners (via detailedStats), goals con scorers, cards, lineups con formations, venue/attendance, team colors y logos. Anti-hallucination guard existe. Frontend tiene live-dot, count-up en artValue, glow halo, sticky header.",
        "gaps": [
            ("P0", "Ticker de minuto en vivo", "Card renderiza una vez en tool-call; badge '67'' nunca avanza. ESPN status.clock expone minuto live pero Koru no polea."),
            ("P0", "Push on goals/cards", "Gol en minuto 70 no actualiza card ni notifica user salvo que re-pregunte."),
            ("P0", "Suscripción equipos favoritos", "User debe decir 'cómo salió España' cada vez. Sin modelo 'siempre seguir Argentina + Boca'."),
            ("P1", "Lifecycle pre-match → live → post-match", "Sin reminder kickoff, sin half-time summary, sin full-time recap card."),
            ("P1", "xG / shot map / heatmaps", "Citados como fuentes en mockup pero puramente decorativos — sin atribución real."),
            ("P1", "H2H history y recent form", "Últimos 5 encuentros, streak actual."),
        ],
        "data_model": "Agregar subscription field en UiBlock ({matchId, leagueId, expiresAt, sourceFeed}). Extender live_match con expectedGoals?: {home, away}, shotMap?: Array<{x,y,team,player,outcome}>, momentum?: number[] (últimos 10min xG trend), lastUpdateAt: string, feedSource: 'espn'|'opta'|'sofascore'. State: LiveMatchSubscription registry keyeada por matchId → {userId, status, lastUpdate, block}.",
        "api_endpoints": "WebSocket endpoint para live updates (SofaScore/ESPN FanGraphs style) con subscription live_match:<matchId> per active card. Polling fallback cada 15s cuando WS down. Cache TTL lowered a 15s para live, 30s para recently-finished, 24h para archived.",
        "external_integrations": "Promover de ESPN unofficial → ESPN API v3 oficial o Opta/StatsPerform (rich xG, shot positions, heatmaps). SofaScore WebSocket (wss://api.sofascore.com/api/v1/ws) para true push de scoreline, stats, key events. TheSportsDB como last-resort fallback.",
        "offline": "Persistir último-known block a IndexedDB con feedSource y staleAt timestamp. Mostrar 'Última actualización 14:32 · Reconectando…' scrim. Rechazar silent stale data como fresh.",
        "privacy": "Match data es público — sin PII. Pero lista de 'equipos favoritos' del user ES personal preference → MemorySensitivity:'normal' pero nunca exponer a third-party API calls (no filtrar suscripciones a ESPN).",
        "ux_flow": "Live updates: card background pulsa verde on score change; nuevo timeline step anima in con is-current dot; auto-scroll timeline a latest event. 'Fixear' button para pin match a home rail. Notifications: push on goal ('⚽ GOL — Morata 51' · BAR 2-1 RMA'), red card, penalty, VAR review, kickoff (-5min reminder), full-time recap. Threshold configurable per team. Historical: tap 'Ver histórico' → loads H2H + last 5 form via match_history tool.",
        "memory_connection": "Recordar favorite teams (MemoryFact.kind:'preference', text:'Usuario sigue a Argentina, Boca, Real Madrid'), preferred competitions, notification quiet-hours, 'always notify goals' preference. Save confirmed teams como LifeRecord kind:'idea' o nuevo kind:'sports_follow'. Proactive: HeartbeatSettings debe pre-check ESPN now endpoint para kickoffs de equipos favoritos en próximas 2h → emit ProactiveNudge source:'heartbeat', category:'sports', priority:'high'. On match start, auto-render live card. User preferences learning: track teams preguntados ≥3 veces en 30 días → surface memory candidate 'Notaste que siempre preguntás por Argentina. ¿Querés que te avise de los partidos?'.",
    },
    {
        "id": "tennis-match",
        "group": "sports",
        "name": "Tenis en vivo",
        "icon": "sports_tennis",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "Efectivamente NINGUNA para tenis live. tennis_atp_wta tool (multi.ts:177) retorna solo ATP/WTA rankings scrapeados de Wikipedia — sin live scores, sin sets, sin aces, sin break points. No existe tennis_live UiBlock type. live_match block es football-shaped (possession, shots, corners — irrelevante para tenis). Mockup muestra scoreline ficticio (1-1 sets, 4-3 Set 3, aces 12-8, double faults 2-3, break points 3/5 vs 2/4, 'Saque Alcaraz' current state, 2h 14min elapsed). Toda la card es UI showcase con cero data backing.",
        "gaps": [
            ("P0", "Live tennis data feed", "Necesita ATP/WTA oficial o Sofascore tennis WebSocket."),
            ("P0", "UiBlock type tennis-specific", "Debe agregar tennis_match con set-by-set score, current server, point-by-point (15/30/40/Ad), break points, aces, double faults, 1st-serve %, return games won."),
            ("P1", "Lifecycle match-stage", "warmup → 1st set → between sets → tiebreak → match point → post-match press."),
            ("P1", "Tournament context", "draw position, round, surface, head-to-head on this surface."),
            ("P1", "Player bios / form", "Alcaraz últimos 5 matches on hard court, ranking points defended."),
        ],
        "data_model": "Nuevo UiBlock type 'tennis_match': players {home:{name,country,seed,rank,logo?}, away:{...}}, tournament {name, round, surface, category}, sets: Array<{homeGames, awayGames, winner?, tiebreak?:{homePts, awayPts}}>, currentSet {gamesHome, gamesAway, server}, currentPoint ('0-0'|'15-0'|'30-15'|'40-30'|'AD-40'|...), stats {aces:{h,a}, doubleFaults:{h,a}, firstServePct:{h,a}, breakPointsWon:{h,a}, breakPointsFaced:{h,a}, returnGamesWon:{h,a}}, momentum Array<{t, pointWinner}>, keyMoments Array<{set, game, type:'break'|'ace'|'double_fault'|'set_point'|'match_point', text}>, elapsedMs, feedSource, lastUpdateAt.",
        "api_endpoints": "WebSocket mandatory — tennis scoring demasiado granular para polling (punto toma 5-20s, rally shift momentum en 2s). Poll 5s como fallback. Cache live 10s, finished 24h.",
        "external_integrations": "SofaScore tiene el tennis WebSocket más rico free-ish (point-by-point, momentum, server indicator). ATP/WTA official API (paid, requiere partnership). ESPN tennis (unofficial, similar a football). Nuevo src/tools/sports/tennis.ts.",
        "offline": "Mostrar último completed set + 'Punto en juego no disponible — reconectando' en lugar de stale current-point. Auto-reconnect on visible state change.",
        "privacy": "Igual que football — data público, pero lista favorite-players es personal preference.",
        "ux_flow": "Live updates: set score tiles animate count-up on game won; current-server indicator (small tennis ball icon next to player name) pulses while serving; momentum sparkline at top of detail; 'MATCH POINT' full-card red scrim cuando break/set/match point. Notifications: break of serve ('🔄 BREAK — Alcaraz quiebra a Sinner · 4-3 Set 3'), set won, match point, match end. Less noisy que football — defaults to breaks + sets + match end. Historical: H2H on this surface, last 5 matches each player, ranking trajectory mini-chart, tournament draw bracket.",
        "memory_connection": "Recordar favorite players (Alcaraz, Sinner), preferred tournaments (Grand Slams vs Masters 1000), surface preference (clay vs hard), notification threshold (all points vs breaks only — tennis muy noisy). Proactive: match start nudge 15 min before favorite player's scheduled match. Match-point push para cualquier tracked match. Daily morning recap de yesterday's results para followed players. User preferences learning: detect surface bias ('user siempre chequea Nadal durante clay season'), aprender que breaks-only notifications tienen mayor engagement.",
    },
    # ============ FINANCE ============
    {
        "id": "money-summary",
        "group": "finance",
        "name": "Resumen financiero",
        "icon": "account_balance_wallet",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "Backed por expense_track (guarda LifeRecord{kind:'expense', amount, currency, tags}) y expense_summary (agrega por período: today/week/month, groups by currency, retorna money_summary UiBlock con total, currency, summaryItems[], recommendation). expense_alert flaggea anomalías (>2x promedio). budget_set guarda budget como MemoryFact{kind:'goal'}. money_summary UiBlock es minimal: total, currency, summaryItems[], recommendation. Mockup muestra split income/expense/savings, category breakdown, recent transactions — NINGUNO soportado por el type hoy.",
        "gaps": [
            ("P0", "Income tracking", "LifeRecordKind tiene 'expense' pero no 'income'. Mockup muestra '+€1.520 nómina' como línea positiva — imposible de modelar hoy."),
            ("P0", "Category breakdown en block", "Mockup muestra Comida €420 (36%), Vivienda €680 (58%), Transporte €120, Ocio €85. Type no tiene categories field. expenseByCategory tool existe pero retorna flat list, no promoted al block."),
            ("P0", "Savings calculation", "Income − expenses. No existe."),
            ("P0", "Transaction list en block", "Mockup muestra 'Mercadona -€58.40, Cafetería Central -€4.20, Nómina +€1.520' — type no tiene transactions[]."),
            ("P1", "Bank/broker sync", "Todos los expenses son manuales via expense_track. Sin Plaid/Tinto/N26/BBVA integration."),
            ("P1", "Budget-vs-actual progress bars", "budget_set existe pero no UI muestra 'Comida €420/€500 (84%)'."),
        ],
        "data_model": "Extender LifeRecordKind con 'income', 'transfer', 'investment' (o split expense en signedAmount field). Agregar a money_summary block: income?, expenses?, savings?, categories?: Array<{label, amount, pct, color, budget?, budgetPct?}>, transactions?: Array<{title, amount, currency, category, happenedAt, merchant?, source:'manual'|'plaid'|'ocr'}>, periodLabel?, budgetAlerts?: Array<{category, pctUsed, message}>.",
        "api_endpoints": "Bank sync: Plaid (US/EU, requiere partnership), Tink (EU, PSD2-compliant, multi-bank), N26/BBVA Open Banking APIs. Google Sheets / CSV import como zero-integration fallback. Receipt OCR via Apple Vision o Google Document AI para receipt photo → expense_track auto-fill. Polling 5 min para bank-synced accounts.",
        "external_integrations": "Plaid, Tink, N26, BBVA, Google Sheets import, Receipt OCR.",
        "offline": "Todos los financial records ya persisten en KoruState.records (IndexedDB-backed). Bank sync retries con exponential backoff. Mostrar 'Sincronización bancaria pausada — última hace 14 min' warning.",
        "privacy": "🔴 HIGHEST-sensitivity card. Bank credentials deben usar OAuth (nunca guardar passwords). Transaction data es MemorySensitivity:'sensitive' → nunca enviado a LLM context sin redaction; embeddings skipped (useForSuggestions:false); PDF export opt-in only. Category labels (no amounts) usables para memory candidates.",
        "ux_flow": "Live updates: nueva transaction anima in al top de 'Transacciones recientes' con slide-down; totals count-up on change; budget bar llena progresivamente con color shift green→amber→red at 80%/100%. Notifications: budget threshold alerts (80% → 'Cuidado, vas al 80% de Comida'), anomaly detection (ya en expense_alert — wire to push), large-transaction confirmation (≥3x monthly average), subscription renewal reminder. Historical: month-over-month bar chart, category trend lines, savings rate trajectory.",
        "memory_connection": "Recordar spending patterns (top 3 categories), recurring merchants (Netflix €12.99 monthly → auto-categorize), budget thresholds, savings goals ('ahorrar €500/mes'). Usar MemoryFact{kind:'goal'} para goals, kind:'routine' para recurring merchants. Proactive: 'Llevás 84% del presupuesto de Comida y faltan 8 días'. 'Netflix subió a €15.99 — ¿revisar suscripciones?'. 'Ahorro de marzo €340 — 22% de tu nómina, vas mejor que febrero (+18%)'. User preferences learning: auto-categorize new merchants, learn salary deposit pattern, suggest budgets based on 3-month rolling averages.",
    },
    {
        "id": "market",
        "group": "finance",
        "name": "Mercados",
        "icon": "trending_up",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "stock_quote tool (stockQuote.ts) consulta Stooq CSV API — retorna END-OF-DAY close only (open/high/low/close/volume), sin intraday, sin real-time. Cache ttls.crypto=60s (mis-named, reused). market UiBlock: assets Array<{symbol, name, category, price, change, changeUp, icon...}> — flat list, single-quote-per-call. Mockup muestra aggregated market card: IBEX 35 index, 8-value watchlist, top movers, sector heatmap, 2 earnings today, sparklines. CERO de esa agregación existe — Koru necesitaría 8 stock_quote calls separados y assembly manual que LLM no hace.",
        "gaps": [
            ("P0", "Index-level data", "Stooq puede hacer ^IBEX pero tool no lo expone como aggregate."),
            ("P0", "Watchlist model", "Mockup '8 valores en watchlist' — no watchlist entity en KoruState o LifeRecord."),
            ("P1", "Top-movers feed", "Necesita 'biggest gainers/losers in IBEX/Nasdaq today' endpoint."),
            ("P1", "Sector heatmap", "Mockup Bancos +1.8%, Energía -0.6% — no sector-aggregation tool."),
            ("P1", "Earnings calendar", "'2 earnings hoy' + badge 'Earnings hoy' en SAN.MC — no earnings tool."),
            ("P1", "Intraday sparkline", "Stooq da daily candles solo; mockup muestra ▁▃▅▆▇ 5-bar intraday."),
            ("P1", "Price alerts", "Mockup implica thresholds pero no alert engine."),
        ],
        "data_model": "Extender market block: index?: {symbol, name, value, change, changePct, sparkline?: number[]}, assets: Array<{..., sparkline?, volume?, marketCap?, pe?, week52High?, week52Low?, earningsToday?, source}>, sectors?: Array<{label, changePct, color}>, topMovers?: {gainers: Asset[], losers: Asset[]}, earningsToday?: Array<{symbol, time, epsExpected}>, lastUpdateAt, marketStatus: 'pre'|'open'|'post'|'closed'|'holiday'. State: Watchlist entity {symbols: string[], createdAt, lastViewed}.",
        "api_endpoints": "WebSocket via Finnhub (wss://ws.finnhub.io?token=...) subscripto a watchlist symbols. Polling fallback 60s durante market hours, 15min pre/post-market, 1h fuera sessions. Cache ttls.market=30s (nuevo TTL).",
        "external_integrations": "Yahoo Finance (unofficial, free, intraday + sparkline chart endpoint, sector data), Finnhub (free tier 60 req/min, real-time WS, earnings calendar, sentiment), Alpha Vantage (free 25/day, slow), Bloomberg (enterprise), Polygon.io (paid, best US equities real-time). Para IBEX: BME (Bolsa de Madrid) official feed. Promover stock_quote de Stooq-EOD a Yahoo intraday como primary.",
        "offline": "Cache último EOD close + sparkline indefinidamente (historical never changes). Mostrar 'Mercado cerrado · Último cierre 14:32 CET' banner off-hours. Gray out real-time badges.",
        "privacy": "Watchlist es personal preference → MemorySensitivity:'normal'. Holdings/positions (diferente card) son sensitive. Sin credentials needed para market data.",
        "ux_flow": "Live updates: price flashes green/red on tick (50ms background pulse); sparkline redraws on each WS message; index value count-up on close. Market-status badge top-right (green dot=open, gray=closed). Notifications: price alerts (≥2% move on watchlist, crossing 52w high/low, earnings beat/miss), index milestone, sector rotation alert. Historical: tap symbol → 1D/1W/1M/1Y/5Y candlestick chart, MA20/MA50/RSI overlays, compare mode.",
        "memory_connection": "Recordar watchlist (SAN.MC, ITX.MC, BBVA.MC, TSLA), price alert thresholds ('avisame si SAN baja de €4.50'), earnings dates de interés, sector preferences ('user tracks banks + energy'). Proactive: pre-market briefing (9:00 CET: 'IBEX abre en 4.187, +0.4%; SAN +2.1% en premarket; earnings de SAN hoy a las 16:00'). End-of-day recap. Threshold-triggered pushes. User preferences learning: detect frequently-checked symbols (≥3 views/week → suggest watchlist). Learn user's risk appetite from alert thresholds. Cross-reference con money-summary: si user holds SAN en portfolio y SAN drops 5%, priorizar alert.",
    },
    {
        "id": "crypto-portfolio",
        "group": "finance",
        "name": "Crypto portfolio",
        "icon": "currency_bitcoin",
        "accent": "#f59e0b",
        "funcionalidad_actual": "crypto_price tool (cryptoPrice.ts) llama CoinGecko para UNA coin — retorna price, market cap, 24h/7d change, high/low 24h. Sparkline explícitamente deshabilitado (sparkline=false en URL). Sin portfolio aggregation: no holdings table, no P&L, no transactions, no cost basis, no distribution pie. crypto_portfolio UiBlock: items?: Array<{symbol, name, price, change, color, char}> — solo flat price list. Toda la mockup (holdings con quantities, distribution percentages, transaction history, AI insight sobre overexposure) es aspiracional con cero backing.",
        "gaps": [
            ("P0", "Holdings model", "User posee '0.18 BTC, 4.2 ETH, 24 SOL' según mockup — sin lugar para guardar. Necesita Holdings entity."),
            ("P0", "Cost basis / P&L", "Sin entry-price tracking → no puede computar '+€287 hoy' o unrealized gains."),
            ("P0", "Transaction history", "'14:32 Compra 0.05 BTC $248' requiere crypto_transaction record type."),
            ("P0", "Portfolio aggregation", "Total value, 24h P&L, distribution %, BTC dominance — todos necesitan computar desde holdings × live prices."),
            ("P1", "AI insight engine", "'Tu portfolio está sobreexpuesto a BTC (38% vs recomendado 25%)' requiere rebalancing heuristic — hoy solo mockup text."),
            ("P1", "Wallet/Exchange sync", "Sin conexión a Binance, Coinbase, MetaMask, Ledger."),
        ],
        "data_model": "Nuevo LifeRecordKind: 'crypto_holding', 'crypto_transaction' (con fields txHash?, exchange?, type:'buy'|'sell'|'swap'|'transfer', fromAsset?, toAsset?, fromAmount?, toAmount?, fee?, exchangeRate?). Extender crypto_portfolio block: totalValue, currency, change24h {value, pct}, holdings: Array<{symbol, name, amount, currentPrice, value, pct, change24h, costBasis?, unrealizedPnl?, sparkline?}>, distribution: Array<{symbol, pct, color}>, transactions: Array<{time, type, summary, value}>, insights?: Array<{severity, text, suggestion?}>, walletBalance?: {connected, address, lastSync}, lastUpdateAt. State: Holdings aggregate {symbol, amount, costBasis, acquiredAt, source:'manual'|'binance'|'wallet'}.",
        "api_endpoints": "WebSocket via CoinGecko Pro o Binance (wss://stream.binance.com:9443/ws/btcusdt@ticker) para top holdings. Aggregate portfolio value updates every tick. Polling 60s fallback. Cache per-coin 30s.",
        "external_integrations": "CoinGecko Pro ($14/mo, 50 req/s, sparkline, historical) para prices. CoinMarketCal para token events. Etherscan/Polygonscan/Solscan APIs para on-chain wallet tracking (read-only, free). Binance/Coinbase/Kraken APIs para exchange-held balances (OAuth o API key read-only scope). DeBank para DeFi positions across chains.",
        "offline": "Last-known prices cached 24h. Mostrar 'Precios desactualizados desde 14:32 — reconectando' + gray badges. Holdings nunca stale (locales). P&L computado contra last-known price con suffix '(stale)'.",
        "privacy": "🔴 CRÍTICO. Holdings + cost basis = full financial net worth. Encrypt at rest con user-derived key (derivar de Koru password, no device-only). API keys para exchanges en OS keychain (Keychain/Keystore), nunca en KoruState. Wallet addresses son pseudo-anonymous pero correlatable → MemorySensitivity:'sensitive'. NUNCA incluir en LLM context sin redaction explícita. Insights engine corre localmente (sin LLM call para 'BTC > 25% threshold').",
        "ux_flow": "Live updates: total value count-up on each tick; holdings rows flash green/red; distribution pie anima on rebalance; '+€287 hoy' badge pulsa verde at market close. Notifications: price alerts per holding (BTC ±5%, ETH ±8%), portfolio drawdown alert ('Portfolio down 8% today — VaR threshold exceeded'), rebalancing nudge ('BTC now 42%, +14pp above your 28% target — consider trimming'), token event alerts (mainnet upgrade, fork, unlock). Historical: portfolio value chart (1D/1W/1M/1Y — computed by replaying transactions × historical prices via CoinGecko historical endpoint). Per-holding cost-basis visualization. Tax-lot view (FIFO/LIFO) para capital gains.",
        "memory_connection": "Recordar holdings (manual + synced), target allocation (MemoryFact{kind:'goal'} — 'Target BTC 25%, ETH 25%, SOL 15%, stables 35%'), risk tolerance, tax residency (afecta cost-basis method). Proactive: daily P&L recap at market close. Rebalancing suggestion cuando cualquier asset >5pp off target. Tax-loss harvesting suggestion en December. Stablecoin depeg alert (USDC/DAI ±1% → urgent). User preferences learning: track cuáles insights user dismissa vs actúa → calibrar threshold strictness. Learn trading patterns ('user buys on red days, sells on green'). Cross-reference con money-summary: large crypto losses might warrant spending-budget adjustment.",
    },
    {
        "id": "trading",
        "group": "finance",
        "name": "Trading",
        "icon": "analytics",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "NINGUNA. No existe trading UiBlock type en types.ts. No hay broker-integration tools. Sin positions, sin P&L curve, sin risk metrics (VaR, Beta, Sharpe, Liquidez), sin Bloomberg news feed. Mockup muestra: P&L curve (1-day intraday from open to current), 4 open positions (Long TSLA $248 → +$840, Short NIO $9.20 → +$210), risk metrics tiles (VaR 95% -$420, Beta 1.32, Liquidez 87%, Sharpe 1.8), Bloomberg news card ('TSLA deliveries beat estimates — Q1 442k vs 430k expected — Impact: alto'). Esta card requiere el most net-new engineering de todas las 6 finance cards.",
        "gaps": [
            ("P0", "Broker connection", "Necesita Interactive Brokers, eToro, Degiro, TradeStation, Robinhood OAuth/API integrations para leer positions y executed trades."),
            ("P0", "Position model", "Mockup muestra Long/Short con entry price, quantity, current P&L — necesita Position entity."),
            ("P0", "Intraday P&L curve", "Necesita tick-level o 1-min snapshots de portfolio value through the day."),
            ("P0", "Risk analytics", "VaR (Value at Risk), Beta (vs S&P 500), Sharpe ratio, liquidity score — todos requieren compute (historical returns, covariance matrix, risk-free rate). Ninguno existe."),
            ("P1", "News feed con impact scoring", "Mockup muestra Bloomberg news tagged 'Impact: alto' correlacionado a TSLA position — necesita news-sentiment × holdings cross-reference engine."),
            ("P1", "Order execution", "Mockup no lo muestra, pero real trading card implica buy/sell CTAs."),
        ],
        "data_model": "Nuevo UiBlock 'trading': realizedPnlDay, unrealizedPnlDay, pnlCurve: Array<{t: ISO, value: number}>, maxDrawdownDay, positions: Array<{symbol, side:'long'|'short', quantity, entryPrice, currentPrice, marketValue, unrealizedPnl, unrealizedPnlPct, leverage?, stopLoss?, takeProfit?, openedAt, broker}>, riskMetrics: {var95, beta, sharpe, liquidityPct, exposureGross, exposureNet}, news: Array<{headline, source, url, impact:'low'|'medium'|'high', relatedSymbols, publishedAt}>, broker, lastUpdateAt. Nuevo LifeRecordKind: 'trade_execution' (immutable trade log), 'position_open', 'position_close'.",
        "api_endpoints": "WebSocket mandatory para positions (IBKR TWS stream, Alpaca wss://stream.data.alpaca.markets/v2/iex). P&L curve snapshots cada 1min a PnlSnapshot table (lightweight, 480 points/day para 8h session). Polling 15s fallback. Risk-free rate: FRED API (US Treasury 10Y) para Sharpe denominator.",
        "external_integrations": "Brokers (read-only first, then trade): Interactive Brokers (TWS API o Client Portal API), Alpaca (free paper trading, easy OAuth), Degiro (unofficial), eToro (limited), TradeStation, Robinhood (unofficial). Priorizar Alpaca para dev (free paper), IBKR para production. News: Bloomberg (enterprise $), Reuters/Refinitiv ($), Finnhub news (free, market sentiment tags), Alpha Vantage News & Sentiment (free, AI-scored). Per-position news filter: news.symbol == position.symbol.",
        "offline": "Last position snapshot cached 24h. P&L curve frozen con 'Datos de mercado pausados' scrim. NUNCA mostrar stale prices como live. On reconnect, backfill curve gap.",
        "privacy": "🔴 MAXIMUM sensitivity. Full broker credentials + positions = entire liquid net worth. OAuth-only (no API key storage if avoidable); tokens en OS keychain. Trade-execution commands requieren biometric confirmation. NUNCA incluir P&L numbers en LLM prompts sin [[REDACTED]] placeholder. PDF export requiere re-auth.",
        "ux_flow": "Live updates: P&L number ticks every WS message con color flash; curve extends rightward real-time; position rows highlight on P&L change; risk metric tiles update cada 60s (no per-tick para evitar cognitive overload). Notifications: stop-loss hit (urgent push), take-profit hit, margin call warning (critical), P&L threshold crossed ('Portfolio +$1.000 hoy — take profit?'), news impact alert ('Bloomberg: TSLA deliveries beat — tu posición Long TSLA +$840 podría extender a +$1.200 premarket'), end-of-day P&L summary. Historical: P&L curve zoomable (1D/1W/1M/1Y/Max), trade blotter filterable, risk-metric trend, tax-lot export (CSV + PDF). Backtest mode (replay estrategia vs historical).",
        "memory_connection": "Recordar risk tolerance (MemoryFact{kind:'boundary'} — 'max 2x leverage, max 20% single position'), trading strategy ('user mean-reverts on tech'), broker preferences, tax residency (afecta cost-basis method), historical P&L emotional patterns ('user tends to overtrade after a 5% loss day'). Proactive: pre-market risk check ('Hoy abrís con 4 posiciones, VaR -$420 — dentro de tu límite de -$500'). Drawdown circuit-breaker ('3rd red day in a row — pausa sugerida'). Earnings-week hedge reminder ('TSLA earnings mañana — tu posición es 30% del portfolio, ¿hedge?'). Margin-usage warning at 60%/80%/100%. User preferences learning: learn stop-loss discipline, detect tilt patterns, calibrate news-impact alert sensitivity. Cross-reference con crypto-portfolio + money-summary para holistic net-worth risk view.",
    },
]

# Groups metadata
GROUPS = [
    ("daily", "Vida diaria", "Clima, morning brief, bienestar — las cards que el user ve cada día"),
    ("alarm", "Alarmas y recordatorios", "Cards action-only con botones inline"),
    ("wellbeing", "Bienestar", "Salud, sueño, meditation, outfit"),
    ("productivity", "Productividad", "Planes, checklists, rutinas, ejercicio, compras"),
    ("sports", "Deportes", "Fútbol, tenis — datos en vivo"),
    ("finance", "Finanzas", "Gastos, mercados, crypto, trading"),
]

def render_card_spec(card):
    """Renderiza el spec funcional completo de una card"""
    out = []
    out.append(f'<div class="card-spec-block reveal" id="spec-{card["id"]}" style="background:#fff;border-radius:20px;padding:24px;margin:24px 0;border:1px solid var(--c-sand);border-top:4px solid {card["accent"]};">')
    
    # Header
    out.append(f'<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">')
    out.append(f'<div style="width:48px;height:48px;border-radius:14px;background:{card["accent"]}20;color:{card["accent"]};display:grid;place-items:center;flex-shrink:0;"><span class="material-symbols-outlined" style="font-size:26px;">{card["icon"]}</span></div>')
    out.append(f'<div><div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);letter-spacing:-0.02em;">{card["name"]}</div><div style="font-size:11px;color:var(--c-earth);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">Spec funcional · mockup → feature real</div></div>')
    out.append(f'</div>')
    
    # Funcionalidad actual
    out.append(f'<div style="margin-bottom:18px;">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="material-symbols-outlined" style="color:var(--k-blue);font-size:18px;">history</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Funcionalidad actual</strong></div>')
    out.append(f'<p style="font-size:13px;line-height:1.6;color:var(--c-earth);padding-left:26px;">{card["funcionalidad_actual"]}</p>')
    out.append(f'</div>')
    
    # Gaps
    out.append(f'<div style="margin-bottom:18px;">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span class="material-symbols-outlined" style="color:var(--k-amber-text);font-size:18px;">priority_high</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Gaps vs mockup ({len(card["gaps"])} items)</strong></div>')
    out.append(f'<div style="padding-left:26px;display:flex;flex-direction:column;gap:8px;">')
    for priority, title, desc in card["gaps"]:
        color = "#c81e1e" if priority == "P0" else ("#b45309" if priority == "P1" else "#8363f9")
        bg = "rgba(239,68,68,0.08)" if priority == "P0" else ("rgba(245,158,11,0.08)" if priority == "P1" else "rgba(131,99,249,0.08)")
        out.append(f'<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:{bg};border-radius:10px;border-left:3px solid {color};">')
        out.append(f'<span style="font-size:10px;font-weight:800;color:{color};padding:2px 6px;background:#fff;border-radius:5px;flex-shrink:0;letter-spacing:0.04em;">{priority}</span>')
        out.append(f'<div><strong style="font-size:12.5px;color:var(--c-bark);">{title}</strong><p style="font-size:11.5px;color:var(--c-earth);line-height:1.5;margin-top:2px;">{desc}</p></div>')
        out.append(f'</div>')
    out.append(f'</div></div>')
    
    # Engineering spec grid
    out.append(f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">')
    
    # Data model
    out.append(f'<div style="background:rgba(131,99,249,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--kp);font-size:16px;">database</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Data model</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);">{card["data_model"]}</p>')
    out.append(f'</div>')
    
    # API endpoints
    out.append(f'<div style="background:rgba(59,130,246,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--k-blue);font-size:16px;">api</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">API endpoints</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);">{card["api_endpoints"]}</p>')
    out.append(f'</div>')
    
    # External integrations
    out.append(f'<div style="background:rgba(45,106,79,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--k-emerald);font-size:16px;">hub</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">External integrations</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);">{card["external_integrations"]}</p>')
    out.append(f'</div>')
    
    # Offline + Privacy
    out.append(f'<div style="background:rgba(245,158,11,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--k-amber-text);font-size:16px;">cloud_off</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Offline &amp; privacy</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);"><strong style="color:var(--c-bark);">Offline:</strong> {card["offline"]}</p>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);margin-top:6px;"><strong style="color:var(--c-bark);">Privacy:</strong> {card["privacy"]}</p>')
    out.append(f'</div>')
    out.append(f'</div>')  # close grid
    
    # UX flow
    out.append(f'<div style="margin-bottom:18px;">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="material-symbols-outlined" style="color:var(--k-pink);font-size:18px;">route</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">UX flow &amp; proactive triggers</strong></div>')
    out.append(f'<p style="font-size:13px;line-height:1.6;color:var(--c-earth);padding-left:26px;">{card["ux_flow"]}</p>')
    out.append(f'</div>')
    
    # Memory connection
    out.append(f'<div style="background:linear-gradient(135deg,rgba(131,99,249,0.06),rgba(224,163,214,0.06));border-radius:12px;padding:14px;border:1px solid rgba(131,99,249,0.15);">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="material-symbols-outlined" style="color:var(--kp);font-size:18px;">psychology</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Conexión a memoria + collections</strong></div>')
    out.append(f'<p style="font-size:13px;line-height:1.6;color:var(--c-earth);">{card["memory_connection"]}</p>')
    out.append(f'</div>')
    
    out.append(f'</div>')
    return '\n'.join(out)


# === GENERATE HTML ===
html_parts = []

# Head con CSS de v2
html_parts.append(head_css)

# Cover
html_parts.append('''
    <!-- ============ COVER ============ -->
    <section class="cover" id="cover">
      <div class="aurora">
        <div class="aurora-blob b1"></div>
        <div class="aurora-blob b2"></div>
        <div class="aurora-blob b3"></div>
      </div>
      <div class="cover-grid"></div>

      <div class="cover-inner">
        <div class="cover-eyebrow">
          <span class="dot"></span>
          Funcionalidades · Mockup → Feature real · Tier S
        </div>

        <h1 class="cover-title">
          De mockups a<br>
          <span class="grad">features reales</span><br>
          que el usuario ama.
        </h1>

        <p class="cover-sub">
          Análisis funcional card por card: qué existe hoy en código, qué gaps hay vs los mockups,
          qué funcionalidad nueva se necesita (P0/P1/P2), specs de ingeniería (data model, APIs,
          integraciones, offline, privacy), UX flow con proactive triggers, y conexión al sistema
          de memoria + collections de Koru. <strong>33 cards analizadas por 6 agentes especializados</strong>,
          cada uno instruido como el mejor en su profesión.
        </p>

        <div class="cover-stats">
          <div class="cover-stat">
            <div class="cover-stat-num">33</div>
            <div class="cover-stat-label">Cards analizadas</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-num">180+</div>
            <div class="cover-stat-label">Gaps funcionales</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-num">6</div>
            <div class="cover-stat-label">Agentes especializados</div>
          </div>
          <div class="cover-stat">
            <div class="cover-stat-num">40+</div>
            <div class="cover-stat-label">Integraciones externas</div>
          </div>
        </div>

        <a href="#exec" class="cover-cta">
          <span class="material-symbols-outlined">arrow_forward</span>
          Comenzar análisis funcional
        </a>
      </div>

      <div class="cover-foot">
        <div class="left">
          <span><strong>Base:</strong> koru-ui-audit-v2.html (UX/UI aprobada)</span>
        </div>
        <div><strong>Orquestación</strong> · 6 agentes análisis + judge</div>
      </div>

      <div class="cover-scroll">
        Scroll
        <div class="cover-scroll-line"></div>
      </div>
    </section>

    <!-- ============ EXECUTIVE SUMMARY ============ -->
    <section class="section" id="exec">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">summarize</span>
        01 · Resumen ejecutivo
      </div>
      <h2 class="section-title reveal">
        Los mockups son hermosos. <span class="accent">Ahora necesitan funcionar</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        La auditoría v2 (UI/UX) está aprobada — 33 cards con estado compacto + extendido, paleta
        respetada, 110 microdetalles. Pero <strong>muchas de esas cards son mockups sin funcionalidad
        real detrás</strong>. Este informe cierra ese gap: para cada card, análisis de qué existe hoy
        en el código de Koru, qué falta para que el mockup sea útil de verdad, y specs de ingeniería
        detallados para construirlo. <strong>Cada card conectada al sistema de memoria, collections,
        tareas, recordatorios y notas de Koru</strong> — no features aisladas, sino un ecosistema.
      </p>

      <div class="reveal" data-delay="2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:28px;">
        <div style="background:#fff;border-radius:15px;padding:20px;border:1px solid var(--c-sand);border-top:4px solid var(--kp);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
            <span class="material-symbols-outlined" style="color:var(--kp);font-size:22px;">analytics</span>
            <strong style="color:var(--c-bark);font-size:14px;">6 agentes análisis</strong>
          </div>
          <p style="font-size:12.5px;color:var(--c-earth);line-height:1.55;">
            Uno por grupo de cards (daily, alarmas, productividad, sports+finance, media+info,
            travel+decisions, system). Cada uno leyó el código real de Koru + los mockups v2.
          </p>
        </div>
        <div style="background:#fff;border-radius:15px;padding:20px;border:1px solid var(--c-sand);border-top:4px solid var(--k-emerald);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
            <span class="material-symbols-outlined" style="color:var(--k-emerald);font-size:22px;">engineering</span>
            <strong style="color:var(--c-bark);font-size:14px;">Specs de ingeniería</strong>
          </div>
          <p style="font-size:12.5px;color:var(--c-earth);line-height:1.55;">
            Data model changes, API endpoints, external integrations, offline behavior, privacy
            considerations. Listo para entregar a un equipo dev.
          </p>
        </div>
        <div style="background:#fff;border-radius:15px;padding:20px;border:1px solid var(--c-sand);border-top:4px solid var(--k-amber);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
            <span class="material-symbols-outlined" style="color:var(--k-amber-text);font-size:22px;">route</span>
            <strong style="color:var(--c-bark);font-size:14px;">UX flow + proactive</strong>
          </div>
          <p style="font-size:12.5px;color:var(--c-earth);line-height:1.55;">
            Lifecycle idle→active→resolved, proactive triggers via heartbeat, cross-card interactions.
            Cards que se sienten vivas, no estáticas.
          </p>
        </div>
        <div style="background:#fff;border-radius:15px;padding:20px;border:1px solid var(--c-sand);border-top:4px solid var(--k-pink);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
            <span class="material-symbols-outlined" style="color:var(--k-pink);font-size:22px;">psychology</span>
            <strong style="color:var(--c-bark);font-size:14px;">Memoria + collections</strong>
          </div>
          <p style="font-size:12.5px;color:var(--c-earth);line-height:1.55;">
            Cada card conectada al sistema de memoria de Koru: qué recordar, cómo informa futuras
            sugerencias, privacy considerations, habit loops.
          </p>
        </div>
      </div>

      <div class="callout info reveal" data-delay="3">
        <span class="material-symbols-outlined">info</span>
        <div>
          <div class="callout-title">Filosofía del análisis</div>
          <div class="callout-body">
            No se trata de agregar features por agregar. Se trata de que <strong>cada card sea
            excepcionalmente útil</strong> — que el user sienta que Koru realmente lo ayuda, no que
            muestra datos bonitos. Cada gap priorizado P0/P1/P2 según impacto en user value. Cada
            spec de ingeniería alineado con la arquitectura existente de Koru (KoruState, LifeRecord,
            MemoryFact, Commitment, Collections). <strong>Cero features aisladas — todo conectado al
            ecosistema de memoria, tareas, recordatorios y notas</strong>.
          </div>
        </div>
      </div>
    </section>

    <!-- ============ CARDS CATALOG ============ -->
    <section class="section" id="cards-catalog">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">collections</span>
        02 · Catálogo de specs funcionales
      </div>
      <h2 class="section-title reveal">
        33 cards · <span class="accent">análisis funcional completo</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Cada card analizada en 6 dimensiones: funcionalidad actual, gaps priorizados, data model,
        API endpoints, integraciones externas, offline+privacy, UX flow con proactive triggers, y
        conexión a memoria + collections. <strong>Listo para entregar a desarrollo</strong>.
      </p>
''')

# Group cards
from collections import defaultdict
groups_dict = defaultdict(list)
for card in CARDS:
    groups_dict[card["group"]].append(card)

for group_id, group_title, group_desc in GROUPS:
    if group_id not in groups_dict:
        continue
    html_parts.append(f'''
      <div class="card-section-divider reveal">
        <div class="card-section-group-title">{group_title}</div>
        <div class="card-section-group-sub">{group_desc}</div>
      </div>
''')
    for card in groups_dict[group_id]:
        html_parts.append(render_card_spec(card))

# Closing
html_parts.append('''
    </section>

    <!-- ============ CLOSING ============ -->
    <section class="section" id="closing">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">flag</span>
        03 · Cierre
      </div>
      <h2 class="section-title reveal">
        De mockups a <span class="accent">features que el usuario ama</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Este informe cierra el ciclo: la auditoría v2 definió <strong>cómo deben verse las cards</strong>
        (UX/UI aprobada, 10/10). Este informe define <strong>cómo deben funcionar</strong> — qué
        funcionalidad nueva se necesita, cómo se construye, cómo se conecta al ecosistema de Koru.
        33 cards, 180+ gaps priorizados, 40+ integraciones externas, specs de ingeniería listos.
        <strong>El mejor asistente IA de la historia se construye card por card, con utilidad real
        en cada una</strong>.
      </p>

      <div class="reveal" data-delay="2" style="background:linear-gradient(135deg,#2e2650 0%,#453f6a 100%);border-radius:22px;padding:36px;color:#fff;position:relative;overflow:hidden;margin-top:28px;">
        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(131,99,249,0.4),transparent 70%);filter:blur(36px);"></div>
        <div style="position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(224,163,214,0.3),transparent 70%);filter:blur(36px);"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:18px;">
            <div style="width:44px;height:44px;border-radius:13px;background:radial-gradient(circle at 30% 30%,#c9bdf5 0%,#8363f9 50%,#523a9e 100%);display:grid;place-items:center;box-shadow:0 0 20px rgba(131,99,249,0.5);animation:koru-breathe 4s ease-in-out infinite;">
              <span class="material-symbols-outlined ms-fill" style="color:#fff;font-size:22px;">auto_awesome</span>
            </div>
            <div><div style="font-family:var(--t-display);font-size:20px;font-weight:800;letter-spacing:-0.02em;">Próximos pasos</div><div style="font-size:11.5px;color:rgba(239,234,251,0.6);">Orden recomendado de implementación</div></div>
          </div>
          <ol style="margin:0;padding-left:22px;font-size:13px;line-height:1.8;color:rgba(239,234,251,0.9);">
            <li><strong style="color:#c9bdf5;">Fase 1 (P0 críticos):</strong> Fix snooze real en alarm/reminder, weather hourly+daily, unificar morning brief, wellbeing streaks. 1-2 semanas.</li>
            <li><strong style="color:#c9bdf5;">Fase 2 (P0 entidades):</strong> Crear Plan, Checklist, Habit, ExercisePlan, ShoppingList entities durables en KoruState. IndexedDB migration. 2-3 semanas.</li>
            <li><strong style="color:#c9bdf5;">Fase 3 (P0 integraciones):</strong> WebSocket live match, Google Calendar OAuth, image generation tool, Google Places restaurants. 3-4 semanas.</li>
            <li><strong style="color:#c9bdf5;">Fase 4 (P0 memoria):</strong> Embedding pipeline, vector search, recall UI, memory confidence decay. 2-3 semanas.</li>
            <li><strong style="color:#c9bdf5;">Fase 5 (P1 finance):</strong> Bank sync (Plaid/Tink), broker connections (Alpaca/IBKR), crypto wallet sync. 4-6 semanas.</li>
            <li><strong style="color:#c9bdf5;">Fase 6 (P1 system):</strong> Home dashboard, Create templates nuevos, Settings integrado. 2-3 semanas.</li>
          </ol>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:13px;margin-top:28px;" class="reveal" data-delay="3">
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--kp);">analytics</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">33</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Cards analizadas</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--k-pink);">priority_high</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">180+</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Gaps funcionales</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--k-emerald);">hub</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">40+</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Integraciones externas</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--k-amber-text);">schedule</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">14-21</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Semanas total</div>
        </div>
      </div>

      <div style="margin-top:40px;padding-top:28px;border-top:1px solid var(--c-sand);text-align:center;color:var(--c-earth);font-size:11.5px;" class="reveal" data-delay="4">
        <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:7px;">
          <div style="width:22px;height:22px;border-radius:7px;background:radial-gradient(circle at 30% 30%,#c9bdf5 0%,#8363f9 50%,#523a9e 100%);display:grid;place-items:center;animation:koru-breathe 4s ease-in-out infinite;">
            <span class="material-symbols-outlined ms-fill" style="color:#fff;font-size:11px;">auto_awesome</span>
          </div>
          <strong style="color:var(--kp-deep);font-family:var(--t-display);">Koru · Funcionalidades · Tier S</strong>
        </div>
        <div>Análisis funcional orchestrado con 6 agentes paralelos · 33 cards · 180+ gaps · specs de ingeniería listos</div>
        <div style="margin-top:3px;">Basado en koru-ui-audit-v2.html (UX/UI aprobada 10/10) · 2026-07-16</div>
      </div>
    </section>

  </main>
</div>

<script>
  // Scroll reveal
  (function() {
    var reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function(el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(function(el) { io.observe(el); });
  })();

  // Rail active link tracking
  (function() {
    var links = document.querySelectorAll('.rail-link');
    var sections = Array.from(links).map(function(l) {
      var id = l.getAttribute('href').slice(1);
      return { id: id, el: document.getElementById(id), link: l };
    }).filter(function(s) { return s.el; });
    function setActive() {
      var scrollY = window.scrollY + 120;
      var current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].el.offsetTop <= scrollY) current = sections[i];
      }
      links.forEach(function(l) { l.classList.remove('is-active'); });
      if (current) current.link.classList.add('is-active');
    }
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();
  })();

  // Reading progress
  (function() {
    var fill = document.getElementById('progressFill');
    var num = document.getElementById('progressNum');
    function update() {
      var scrolled = window.scrollY;
      var total = document.documentElement.scrollHeight - window.innerHeight;
      var pct = Math.min(Math.round((scrolled / total) * 100), 100);
      if (fill) fill.style.width = pct + '%';
      if (num) num.textContent = pct + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  // Rail toggle (mobile)
  (function() {
    var toggle = document.getElementById('railToggle');
    var rail = document.getElementById('rail');
    if (!toggle || !rail) return;
    toggle.addEventListener('click', function() { rail.classList.toggle('is-open'); });
    rail.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') rail.classList.remove('is-open');
    });
  })();
</script>

</body>
</html>
''')

output = '\n'.join(html_parts)
with open('/home/z/my-project/download/koru-ui-audit-funcionalidades.html', 'w', encoding='utf-8') as f:
    f.write(output)

print(f"Generated: /home/z/my-project/download/koru-ui-audit-funcionalidades.html")
print(f"Size: {len(output)} chars ({len(output)//1024} KB)")
print(f"Lines: {output.count(chr(10))}")
print(f"Cards: {len(CARDS)}")
