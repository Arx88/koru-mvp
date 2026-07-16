#!/usr/bin/env python3
"""
Genera el catálogo masivo de cards para Koru UI Audit v2.
Cada card muestra: estado compacto (chat card) + estado extendido (detail screen mockup).
Output: HTML fragment que se inserta en koru-ui-audit-v2.html
"""
import json

# === CARD CATALOG ===
# Cada card: id, group, name, icon, accent (hex), accent_soft (rgba), kicker, title, desc,
# artValue, metrics[], compact extras, extended modules[]

CARDS = [
    # ============ DAILY LIFE ============
    {
        "id": "weather",
        "group": "daily",
        "group_title": "Vida diaria",
        "name": "Clima",
        "icon": "wb_sunny",
        "accent": "#f59e0b",
        "accent_soft": "rgba(245,158,11,0.12)",
        "kicker": "Tu Clima · Buenos Aires",
        "title": "Parcialmente nublado",
        "desc": "Llevá una campera liviana. Posibles ráfagas hacia la tarde.",
        "artValue": "23°",
        "metrics": [
            ("device_thermostat", "#b45309", "Mín/Máx", "18°/26°"),
            ("water_drop", "#3b82f6", "Humedad", "62%"),
            ("air", "#2d6a4f", "Viento", "12 km/h"),
        ],
        "extended_badge": ("Hace 5 min", "#2d6a4f"),
        "extended_sections": [
            ("scroller", "schedule", "Próximas horas", "8 horas", [
                {"badge": "15:00", "title": "23° Soleado", "detail": "0% lluvia", "metrics": ["UV 6"]},
                {"badge": "16:00", "title": "23°", "detail": "5% lluvia", "metrics": ["UV 5"]},
                {"badge": "17:00", "title": "22°", "detail": "10% lluvia", "metrics": ["UV 3"]},
            ]),
            ("tiles", "calendar_month", "Pronóstico 7 días", "Lun-Dom", [
                ("wb_sunny", "#b45309", "Lun", "24°/16°"),
                ("wb_sunny", "#b45309", "Mar", "25°/17°"),
                ("cloud", "#8363f9", "Mié", "22°/15°"),
                ("rainy", "#3b82f6", "Jue", "19°/14°"),
            ]),
            ("text", "lightbulb", "Recomendación", "Consejo del día",
             "Llevá gafas de sol entre 13–16h. Cielo despejado toda la tarde, pero cuidado con el viento."),
            ("sources", "link", "Fuentes", "3 orígenes", [
                ("AEMET", "aemet.es"),
                ("OpenWeather", "openweathermap.org"),
                ("WeatherAPI", "weatherapi.com"),
            ]),
        ],
    },
    {
        "id": "morning-brief",
        "group": "daily",
        "group_title": "Vida diaria",
        "name": "Morning Brief",
        "icon": "wb_sunny",
        "accent": "#f59e0b",
        "accent_soft": "rgba(245,158,11,0.12)",
        "kicker": "Buenos días",
        "title": "Buenos días, Ana",
        "desc": "Tienes 3 eventos hoy y 2 deadlines. Empieza con café y revisa ACME.",
        "artValue": "3",
        "metrics": [
            ("event", "#b45309", "Eventos", "3"),
            ("flag", "#c81e1e", "Deadlines", "2"),
            ("local_drink", "#3b82f6", "Agua", "1.4L"),
        ],
        "extended_badge": ("Jue 14 mar", "#8363f9"),
        "extended_sections": [
            ("tiles", "event", "Items del día", "6 items", [
                ("event", "#8363f9", "Reunión Q1", "16:00"),
                ("flag", "#c81e1e", "Deadlines", "2 hoy"),
                ("local_drink", "#3b82f6", "Agua", "1.4L/2L"),
                ("directions_run", "#2d6a4f", "Correr", "5km"),
            ]),
            ("scroller", "calendar_month", "Calendario del día", "4 eventos", [
                {"badge": "9:00", "title": "Standup", "detail": "Equipo producto", "metrics": ["30 min"]},
                {"badge": "11:00", "title": "1:1 con María", "detail": "Review semanal", "metrics": ["45 min"]},
                {"badge": "16:00", "title": "Q1 Review", "detail": "8 asistentes", "metrics": ["45 min"]},
            ]),
            ("tiles", "wb_sunny", "Clima", "Hoy y mañana", [
                ("wb_sunny", "#b45309", "Hoy", "18°/12°"),
                ("partly_cloudy_day", "#8363f9", "Mañana", "16°/10°"),
            ]),
            ("text", "psychology", "Reflexión del día", "Koru AI",
             "Hoy es un día de foco: tienes 2 deadlines y la Q1 review. Bloquea 9-11h para ACME sin interrupciones."),
        ],
    },
    {
        "id": "alarm",
        "group": "alarm",
        "group_title": "Alarmas y recordatorios",
        "name": "Alarma",
        "icon": "alarm",
        "accent": "#ef4444",
        "accent_soft": "rgba(239,68,68,0.12)",
        "kicker": "Alarma",
        "title": "Reunión equipo",
        "desc": "Se repite: Lunes a Viernes · Sala Zoom",
        "artValue": "09:00",
        "metrics": [],
        "actions": [
            ("alarm_off", "Apagar", "primary"),
            ("snooze", "Postergar 10 min", "secondary"),
        ],
        "extended_badge": ("Activa", "#ef4444"),
        "extended_sections": [
            ("tiles", "alarm", "Detalles", "4 datos", [
                ("schedule", "#c81e1e", "Cuándo", "Lun-Vie 9:00"),
                ("videocam", "#8363f9", "Dónde", "Zoom"),
                ("repeat", "#2d6a4f", "Frecuencia", "Diaria"),
                ("label", "#b45309", "Etiqueta", "Trabajo"),
            ]),
            ("timeline", "history", "Próximas alarmas", "5 días", [
                ("Lun 9:00", "Reunión equipo", "done"),
                ("Mar 9:00", "Reunión equipo", "current"),
                ("Mié 9:00", "Reunión equipo", "pending"),
            ]),
            ("text", "lightbulb", "Consejo", "Koru",
             "Esta alarma se repite cada día laborable. Considera silenciarla los feriados automáticamente."),
        ],
    },
    {
        "id": "reminder",
        "group": "alarm",
        "group_title": "Alarmas y recordatorios",
        "name": "Recordatorio",
        "icon": "notifications",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "Recordatorio",
        "title": "Llamar a mamá",
        "desc": "Hoy · Es su cumpleaños",
        "artValue": "18:00",
        "metrics": [],
        "actions": [
            ("check", "Listo", "primary"),
            ("snooze", "Posponer", "secondary"),
        ],
        "extended_badge": ("Hoy", "#2d6a4f"),
        "extended_sections": [
            ("tiles", "notifications", "Detalles", "3 datos", [
                ("schedule", "#2d6a4f", "Cuándo", "Hoy 18:00"),
                ("cake", "#ec4899", "Motivo", "Cumpleaños"),
                ("phone", "#8363f9", "Acción", "Llamar"),
            ]),
            ("text", "favorite", "Nota", "Personal",
             "Es el cumpleaños número 65 de mamá. Considera enviar flores además de llamar."),
            ("chips", "card_giftcard", "Ideas", "4 sugerencias", [
                "📚 Libro", "🌷 Flores", "🍫 Chocolates", "🎁 Tarjeta",
            ]),
        ],
    },
    {
        "id": "wellbeing",
        "group": "wellbeing",
        "group_title": "Bienestar",
        "name": "Bienestar",
        "icon": "favorite",
        "accent": "#8127cf",
        "accent_soft": "rgba(129,39,207,0.12)",
        "kicker": "Tu Bienestar",
        "title": "Hora de meditar",
        "desc": "Llevas 4 días sin meditar. 5 minutos alcanzan.",
        "artValue": "5min",
        "metrics": [
            ("bedtime", "#4f46e5", "Sueño", "7.2h"),
            ("directions_walk", "#2d6a4f", "Pasos", "8.4k"),
            ("favorite", "#ec4899", "Heart", "72bpm"),
        ],
        "extended_badge": ("Racha 4 días", "#8127cf"),
        "extended_sections": [
            ("tiles", "monitoring", "Métricas de hoy", "4 datos", [
                ("bedtime", "#4f46e5", "Sueño", "7.2h"),
                ("directions_walk", "#2d6a4f", "Pasos", "8.4k"),
                ("favorite", "#ec4899", "HR", "72bpm"),
                ("psychology", "#8363f9", "Stress", "Bajo"),
            ]),
            ("scroller", "self_improvement", "Sesión sugerida", "3 min", [
                {"badge": "5 min", "title": "Respiración 4-7-8", "detail": "Reduce ansiedad", "metrics": ["Fácil"]},
                {"badge": "10 min", "title": "Body scan", "detail": "Conciencia corporal", "metrics": ["Medio"]},
            ]),
            ("text", "lightbulb", "Sugerencia", "Koru",
             "Meditar 5 minutos al día reduce el cortisol en 23%. Tu mejor hora es 18h según tu ritmo circadiano."),
        ],
    },
    # ============ PRODUCTIVITY ============
    {
        "id": "plan",
        "group": "plan",
        "group_title": "Planes y checklists",
        "name": "Plan",
        "icon": "rocket_launch",
        "accent": "#8363f9",
        "accent_soft": "rgba(131,99,249,0.12)",
        "kicker": "Tu Plan",
        "title": "Lanzar producto MVP",
        "desc": "7 pasos para hoy · 3 semanas estimadas",
        "artValue": "2/7",
        "metrics": [
            ("flag", "#c81e1e", "Alta", "3"),
            ("schedule", "#b45309", "Media", "2"),
            ("check_circle", "#2d6a4f", "Baja", "2"),
        ],
        "extended_badge": ("3 semanas", "#8363f9"),
        "extended_sections": [
            ("timeline", "checklist_rtl", "Pasos del plan", "7 etapas", [
                ("1. Discovery", "Definir objetivos OKR", "done"),
                ("2. Auditar", "Recursos actuales", "done"),
                ("3. Diseñar MVP", "Wireframes + flows", "current"),
                ("4. Validar", "5 usuarios", "pending"),
            ]),
            ("tiles", "schedule", "Distribución de tiempo", "4 fases", [
                ("flag", "#c81e1e", "Discovery", "3 días"),
                ("design_services", "#8363f9", "Diseño", "5 días"),
                ("code", "#2d6a4f", "Desarrollo", "8 días"),
                ("science", "#b45309", "QA", "3 días"),
            ]),
            ("text", "psychology", "Notas del plan", "Estrategia",
             "Si el discovery revela un mercado inmaduro, reconsiderar el Paso 4 y pivotar a vertical más nicho."),
        ],
    },
    {
        "id": "smart-checklist",
        "group": "plan",
        "group_title": "Planes y checklists",
        "name": "Checklist",
        "icon": "checklist",
        "accent": "#8363f9",
        "accent_soft": "rgba(131,99,249,0.12)",
        "kicker": "Tu Checklist",
        "title": "Checklist viaje Tokio",
        "desc": "8 de 12 completados · 4 pendientes",
        "artValue": "8/12",
        "metrics": [
            ("check_box", "#2d6a4f", "Done", "8"),
            ("check_box_outline_blank", "#8363f9", "Pendiente", "4"),
            ("task_alt", "#b45309", "Urgente", "1"),
        ],
        "extended_badge": ("67% completo", "#8363f9"),
        "extended_sections": [
            ("rows", "checklist", "Tareas", "12 items", [
                ("check_box", "#2d6a4f", "Pasaporte vigente", "Vence 2028", "✓", "done"),
                ("check_box", "#2d6a4f", "JR Pass comprado", "7 días ¥29.110", "✓", "done"),
                ("check_box_outline_blank", "#8363f9", "Reservar restaurante", "Jiro 12 mar", "—", "pending"),
                ("check_box_outline_blank", "#c81e1e", "eSIM Japón", "Urgente", "!", "urgent"),
            ]),
            ("tiles", "analytics", "Progreso", "4 métricas", [
                ("task_alt", "#8363f9", "Progreso", "67%"),
                ("schedule", "#b45309", "Días restantes", "12"),
                ("flag", "#c81e1e", "Urgentes", "1"),
                ("check_circle", "#2d6a4f", "Completados", "8"),
            ]),
        ],
    },
    {
        "id": "routine",
        "group": "routine",
        "group_title": "Rutinas",
        "name": "Rutina diaria",
        "icon": "repeat",
        "accent": "#3b82f6",
        "accent_soft": "rgba(59,130,246,0.12)",
        "kicker": "Tu Rutina",
        "title": "Mañana productiva",
        "desc": "5 de 7 hábitos completados · Racha 7 días",
        "artValue": "7🔥",
        "metrics": [
            ("local_fire_department", "#c81e1e", "Racha", "7 días"),
            ("check_circle", "#2d6a4f", "Hoy", "5/7"),
            ("trending_up", "#2d6a4f", "Adherencia", "82%"),
        ],
        "extended_badge": ("Semana 4", "#3b82f6"),
        "extended_sections": [
            ("rows", "repeat", "Hábitos de hoy", "7 items", [
                ("water_drop", "#3b82f6", "Beber 2L agua", "1.4L hasta ahora", "70%", "current"),
                ("directions_run", "#2d6a4f", "Correr 5km", "Completado", "✓", "done"),
                ("menu_book", "#8363f9", "Leer 20 min", "Pendiente", "—", "pending"),
            ]),
            ("tiles", "local_fire_department", "Streaks", "4 datos", [
                ("local_fire_department", "#c81e1e", "Actual", "7 días"),
                ("emoji_events", "#b45309", "Mejor", "21 días"),
                ("check_circle", "#2d6a4f", "Activos", "7"),
                ("trending_up", "#2d6a4f", "Adherencia", "82%"),
            ]),
            ("scroller", "calendar_month", "Vista semanal", "7 días", [
                {"badge": "Lun", "title": "7/7", "detail": "Completo", "metrics": ["100%"]},
                {"badge": "Mar", "title": "6/7", "detail": "Faltó leer", "metrics": ["86%"]},
                {"badge": "Mié", "title": "7/7", "detail": "Completo", "metrics": ["100%"]},
            ]),
        ],
    },
    {
        "id": "exercise-plan",
        "group": "exercise",
        "group_title": "Planes de ejercicio",
        "name": "Plan de ejercicio",
        "icon": "fitness_center",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "Tu Plan Fitness",
        "title": "Full Body 12 semanas",
        "desc": "Sesión 5 de 12 · Hoy: Full Body B",
        "artValue": "4/12",
        "metrics": [
            ("local_fire_department", "#c81e1e", "Kcal", "1.240"),
            ("schedule", "#b45309", "Tiempo", "4h 30min"),
            ("trending_up", "#2d6a4f", "Fuerza", "+12%"),
        ],
        "extended_badge": ("Sesión 5/12", "#2d6a4f"),
        "extended_sections": [
            ("timeline", "fitness_center", "Plan 12 sesiones", "Progreso", [
                ("S1 Full Body A", "Completado", "done"),
                ("S2 Push", "Completado", "done"),
                ("S3 Pull", "Completado", "done"),
                ("S4 Legs A", "Completado", "done"),
                ("S5 Full Body B", "Actual", "current"),
            ]),
            ("tiles", "fitness_center", "Ejercicios de hoy", "4 ejercicios", [
                ("fitness_center", "#2d6a4f", "Sentadilla", "4x8 80kg"),
                ("sports_martial_arts", "#c81e1e", "Press banca", "4x6 60kg"),
                ("directions_run", "#b45309", "Peso muerto", "3x5 100kg"),
                ("self_improvement", "#8363f9", "Plancha", "3x45s"),
            ]),
            ("scroller", "trending_up", "Progreso de fuerza", "4 semanas", [
                {"badge": "+12%", "title": "Sentadilla", "detail": "72kg → 80kg", "metrics": ["1RM 100kg"]},
                {"badge": "+8%", "title": "Press banca", "detail": "55kg → 60kg", "metrics": ["1RM 75kg"]},
            ]),
        ],
    },
    {
        "id": "shopping-list",
        "group": "shopping",
        "group_title": "Compras y listas",
        "name": "Lista de compras",
        "icon": "shopping_cart",
        "accent": "#f59e0b",
        "accent_soft": "rgba(245,158,11,0.12)",
        "kicker": "Tu Lista",
        "title": "Supermercado semanal",
        "desc": "8 ítems · 3 ya en carrito",
        "artValue": "3/8",
        "metrics": [
            ("shopping_cart", "#b45309", "Ítems", "8"),
            ("check_circle", "#2d6a4f", "En carrito", "3"),
            ("payments", "#2d6a4f", "Estimado", "€45"),
        ],
        "extended_badge": ("Mercadona", "#f59e0b"),
        "extended_sections": [
            ("rows", "shopping_cart", "Ítems", "8 productos", [
                ("check_box", "#2d6a4f", "Leche entera", "2L · €2.40", "✓", "done"),
                ("check_box", "#2d6a4f", "Huevos", "12 · €2.10", "✓", "done"),
                ("check_box_outline_blank", "#b45309", "Pan integral", "1 · €1.80", "—", "pending"),
                ("check_box_outline_blank", "#b45309", "Manzanas", "1kg · €2.50", "—", "pending"),
            ]),
            ("tiles", "payments", "Resumen", "4 datos", [
                ("shopping_cart", "#b45309", "Ítems", "8"),
                ("check_circle", "#2d6a4f", "Comprados", "3"),
                ("payments", "#2d6a4f", "Gastado", "€12.40"),
                ("account_balance_wallet", "#8363f9", "Restante", "€32.60"),
            ]),
        ],
    },
    # ============ SPORTS ============
    {
        "id": "live-match",
        "group": "match",
        "group_title": "Fútbol y deportes",
        "name": "Partido en vivo",
        "icon": "sports_soccer",
        "accent": "#ef4444",
        "accent_soft": "rgba(239,68,68,0.12)",
        "kicker": "live En vivo · La Liga · 67'",
        "title": "Barcelona vs Real Madrid",
        "desc": "Segunda mitad · Anchozorza en pie",
        "artValue": "2-1",
        "metrics": [
            ("sports_soccer", "#c81e1e", "Posesión", "58-42"),
            ("crisis_alert", "#c81e1e", "Tiros", "9-6"),
            ("sports_score", "#c81e1e", "Córners", "5-3"),
        ],
        "extended_badge": ("67' Live", "#ef4444"),
        "extended_sections": [
            ("rows", "sports_soccer", "Estadísticas", "4 métricas", [
                ("sports_soccer", "#c81e1e", "Posesión", "BAR 58% - 42% RMA", "58-42", "current"),
                ("crisis_alert", "#c81e1e", "Tiros", "BAR 9 - 6 RMA", "9-6", "done"),
            ]),
            ("timeline", "history", "Goles y jugadas", "5 eventos", [
                ("12' Griezmann", "Asistencia Lemar", "done"),
                ("23' Koke 🟨", "Amarilla", "done"),
                ("34' Vinicius", "Gol Real Madrid", "done"),
                ("51' Morata", "Gol Barcelona", "done"),
                ("63' Camavinga 🟥", "Roja Madrid", "current"),
            ]),
            ("text", "sports_soccer", "Formaciones", "4-3-3 vs 4-4-2",
             "Barcelona 4-3-3 con Griezmann-Morata-Dembélé arriba. Madrid 4-4-2 con Vinicius-Bellingham."),
            ("sources", "link", "Datos en vivo de", "3 fuentes", [
                ("Opta Sports", "optasports.com"),
                ("LaLiga", "laliga.com"),
                ("SofaScore", "sofascore.com"),
            ]),
        ],
    },
    {
        "id": "tennis-match",
        "group": "match",
        "group_title": "Fútbol y deportes",
        "name": "Tenis en vivo",
        "icon": "sports_tennis",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "live En vivo · ATP Masters 1000",
        "title": "Alcaraz vs Sinner",
        "desc": "Set 3 · 4-3 · Saque Alcaraz",
        "artValue": "1-1",
        "metrics": [
            ("sports_tennis", "#2d6a4f", "Sets", "1-1"),
            ("emoji_events", "#b45309", "Aces", "12-8"),
            ("crisis_alert", "#c81e1e", "Dobles faltas", "2-3"),
        ],
        "extended_badge": ("Set 3 · 4-3", "#2d6a4f"),
        "extended_sections": [
            ("tiles", "sports_tennis", "Score", "3 sets", [
                ("sports_tennis", "#2d6a4f", "Set 1", "6-4 Alcaraz"),
                ("sports_tennis", "#c81e1e", "Set 2", "3-6 Sinner"),
                ("sports_tennis", "#2d6a4f", "Set 3", "4-3 Alcaraz"),
                ("schedule", "#8363f9", "Tiempo", "2h 14min"),
            ]),
            ("rows", "analytics", "Estadísticas", "4 datos", [
                ("sports_tennis", "#2d6a4f", "Aces", "ALC 12 - 8 SIN", "12-8", "done"),
                ("crisis_alert", "#c81e1e", "Dobles faltas", "ALC 2 - 3 SIN", "2-3", "urgent"),
                ("check_circle", "#2d6a4f", "Break points", "ALC 3/5 - 2/4 SIN", "3/5", "done"),
            ]),
            ("timeline", "history", "Puntos clave", "5 momentos", [
                ("Set 1 9º game", "Break Alcaraz", "done"),
                ("Set 2 4º game", "Break Sinner", "done"),
                ("Set 3 7º game", "Saque Alcaraz", "current"),
            ]),
        ],
    },
    # ============ FINANCE ============
    {
        "id": "money-summary",
        "group": "money",
        "group_title": "Finanzas y gastos",
        "name": "Resumen financiero",
        "icon": "account_balance_wallet",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "Tus Finanzas",
        "title": "Balance de marzo",
        "desc": "8 movimientos registrados este mes",
        "artValue": "€3.247",
        "metrics": [
            ("trending_up", "#2d6a4f", "Ingresos", "€1.520"),
            ("trending_down", "#c81e1e", "Gastos", "€1.180"),
            ("savings", "#3b82f6", "Ahorro", "€340"),
        ],
        "extended_badge": ("Mar 2024", "#2d6a4f"),
        "extended_sections": [
            ("rows", "payments", "Ingresos vs Gastos", "3 barras", [
                ("trending_up", "#2d6a4f", "Ingresos", "€1.520 nómina", "+€1.520", "done"),
                ("trending_down", "#c81e1e", "Gastos", "€1.180 total", "-€1.180", "urgent"),
                ("savings", "#3b82f6", "Ahorro", "€340 neto", "+€340", "current"),
            ]),
            ("tiles", "category", "Por categoría", "4 datos", [
                ("restaurant", "#b45309", "Comida", "€420 (36%)"),
                ("home", "#8363f9", "Vivienda", "€680 (58%)"),
                ("directions_car", "#3b82f6", "Transporte", "€120"),
                ("sports_esports", "#ec4899", "Ocio", "€85"),
            ]),
            ("rows", "receipt_long", "Transacciones recientes", "4 movimientos", [
                ("shopping_cart", "#c81e1e", "Mercadona", "Hoy 13:24", "-€58.40", "urgent"),
                ("coffee", "#c81e1e", "Cafetería Central", "Hoy 10:15", "-€4.20", "urgent"),
                ("payments", "#2d6a4f", "Nómina", "Ayer", "+€1.520", "done"),
            ]),
        ],
    },
    {
        "id": "market",
        "group": "market",
        "group_title": "Mercados y trading",
        "name": "Mercados",
        "icon": "trending_up",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "Mercados · IBEX 35",
        "title": "IBEX 35 cierra al alza",
        "desc": "8 valores en watchlist · 2 earnings hoy",
        "artValue": "4.187",
        "metrics": [
            ("trending_up", "#2d6a4f", "SAN.MC", "+2.1%"),
            ("trending_down", "#c81e1e", "ITX.MC", "-0.4%"),
            ("show_chart", "#3b82f6", "Volumen", "€2.4B"),
        ],
        "extended_badge": ("14:32 CET", "#2d6a4f"),
        "extended_sections": [
            ("rows", "show_chart", "Watchlist", "4 valores", [
                ("show_chart", "#2d6a4f", "SAN.MC", "Santander · ▁▃▅▆▇", "+2.1%", "done"),
                ("show_chart", "#c81e1e", "ITX.MC", "Inditex · ▇▆▅▄▃", "-0.4%", "urgent"),
                ("show_chart", "#2d6a4f", "BBVA.MC", "BBVA · ▃▄▆▇▆", "+1.8%", "done"),
            ]),
            ("scroller", "trending_up", "Top movers", "5 valores", [
                {"badge": "+5.2%", "title": "BBVA.MC", "detail": "€6.12 · Volumen 12.4M", "metrics": ["52w high"]},
                {"badge": "+3.8%", "title": "SAN.MC", "detail": "€4.82", "metrics": ["Earnings hoy"]},
            ]),
            ("tiles", "pie_chart", "Sectores", "4 datos", [
                ("account_balance", "#2d6a4f", "Bancos", "+1.8%"),
                ("energy_savings_leaf", "#c81e1e", "Energía", "-0.6%"),
                ("construction", "#2d6a4f", "Construcción", "+0.9%"),
                ("shopping_bag", "#2d6a4f", "Consumo", "+0.3%"),
            ]),
        ],
    },
    {
        "id": "crypto-portfolio",
        "group": "crypto",
        "group_title": "Crypto y trading",
        "name": "Crypto portfolio",
        "icon": "currency_bitcoin",
        "accent": "#f59e0b",
        "accent_soft": "rgba(245,158,11,0.12)",
        "kicker": "Tu Portafolio",
        "title": "Balance crypto",
        "desc": "6 activos · BTC domina 38%",
        "artValue": "$12.487",
        "metrics": [
            ("trending_up", "#2d6a4f", "24h", "+2.4%"),
            ("currency_bitcoin", "#b45309", "BTC", "38%"),
            ("currency_ethereum", "#8363f9", "ETH", "24%"),
        ],
        "extended_badge": ("+€287 hoy", "#2d6a4f"),
        "extended_sections": [
            ("rows", "currency_bitcoin", "Holdings", "6 activos", [
                ("currency_bitcoin", "#b45309", "Bitcoin", "0.18 BTC · ▁▃▅▇▆▇▇", "+3.2%", "done"),
                ("currency_ethereum", "#8363f9", "Ethereum", "4.2 ETH · ▃▅▆▇▆▇", "-0.8%", "urgent"),
                ("currency_exchange", "#2d6a4f", "Solana", "24 SOL · ▁▃▅▆▇", "+5.4%", "done"),
            ]),
            ("tiles", "pie_chart", "Distribución", "6 activos", [
                ("currency_bitcoin", "#b45309", "BTC", "38%"),
                ("currency_ethereum", "#8363f9", "ETH", "24%"),
                ("currency_exchange", "#2d6a4f", "SOL", "12%"),
                ("savings", "#3b82f6", "USDC", "18%"),
            ]),
            ("timeline", "history", "Transacciones recientes", "4 movimientos", [
                ("14:32 Compra 0.05 BTC", "$248 entrada", "done"),
                ("09:15 Swap ETH→SOL", "4 ETH → 24 SOL", "done"),
            ]),
            ("text", "psychology", "Insights", "Koru AI",
             "Tu portfolio está sobreexpuesto a BTC (38% vs recomendado 25%). Considera rebalancear hacia ETH o stablecoins."),
        ],
    },
    {
        "id": "trading",
        "group": "crypto",
        "group_title": "Crypto y trading",
        "name": "Trading",
        "icon": "analytics",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "Tu Trading",
        "title": "P&L del día",
        "desc": "4 posiciones abiertas · Apalancamiento 2x",
        "artValue": "+$1.247",
        "metrics": [
            ("trending_up", "#2d6a4f", "Día", "+8.4%"),
            ("show_chart", "#8363f9", "Posiciones", "4"),
            ("speed", "#b45309", "Sharpe", "1.8"),
        ],
        "extended_badge": ("Realizado", "#2d6a4f"),
        "extended_sections": [
            ("scroller", "show_chart", "Curva P&L", "1 día", [
                {"badge": "+8.4%", "title": "Curva P&L hoy", "detail": "Apertura +€120 → Actual +€1.247", "metrics": ["Max DD -€180", "Sharpe 1.8"]},
            ]),
            ("rows", "show_chart", "Posiciones abiertas", "2 trades", [
                ("trending_up", "#2d6a4f", "Long TSLA", "100 acc · Entrada $248", "+$840", "current"),
                ("trending_down", "#c81e1e", "Short NIO", "200 acc · Entrada $9.20", "+$210", "current"),
            ]),
            ("tiles", "warning", "Métricas de riesgo", "4 datos", [
                ("warning", "#c81e1e", "VaR 95%", "-$420"),
                ("balance", "#8363f9", "Beta", "1.32"),
                ("water_drop", "#3b82f6", "Liquidez", "87%"),
                ("speed", "#b45309", "Sharpe", "1.8"),
            ]),
            ("scroller", "article", "Noticias relevantes", "3 noticias", [
                {"badge": "Bloomberg", "title": "TSLA deliveries beat estimates", "detail": "Q1 442k vs 430k expected", "metrics": ["Impact: alto"]},
            ]),
        ],
    },
    # ============ MEDIA & REVIEWS ============
    {
        "id": "recipe",
        "group": "recipe",
        "group_title": "Recetas y cocina",
        "name": "Receta",
        "icon": "restaurant",
        "accent": "#2d6a4f",
        "accent_soft": "rgba(45,106,79,0.12)",
        "kicker": "Tu Receta",
        "title": "Milanesa a la Napolitana",
        "desc": "Argentina · Almuerzo · 4 porciones",
        "artValue": None,
        "art_poster": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&h=300&fit=crop",
        "metrics": [
            ("kitchen", "#2d6a4f", "Ingredientes", "8"),
            ("schedule", "#8363f9", "Prep", "20 min"),
            ("local_fire_department", "#b45309", "Cocción", "15 min"),
        ],
        "extended_badge": ("★ 4.8 · Receta top", "#2d6a4f"),
        "extended_sections": [
            ("text", "lightbulb", "Sinopsis del plato", "Lo esencial",
             "La milanesa napolitana es un clásico argentino que combina carne empanizada y frita con salsa de tomate, jamón y queso derretido. Se sirve con papas fritas o puré."),
            ("tiles", "kitchen", "Ingredientes", "8 ítems", [
                ("restaurant_menu", "#2d6a4f", "Carne", "4 filetes"),
                ("grain", "#b45309", "Pan rallado", "2 tazas"),
                ("restaurant_menu", "#c81e1e", "Jamón", "4 fetas"),
                ("water_drop", "#8363f9", "Queso", "200g"),
            ]),
            ("timeline", "schedule", "Pasos", "5 etapas", [
                ("1. Preparar carne", "Golpear filetes 1cm", "done"),
                ("2. Empanizar", "Huevo, pan rallado, reposar", "current"),
                ("3. Freír", "3 min por lado fuego medio", "pending"),
                ("4. Napoleana", "Salsa, jamón, queso, grill", "pending"),
            ]),
            ("sources", "smart_display", "Video y fuente", "2 orígenes", [
                ("Ver receta en video", "youtube.com"),
                ("Receta tradicional", "cookpad.com"),
            ]),
        ],
    },
    {
        "id": "movie-review",
        "group": "movie",
        "group_title": "Películas y libros",
        "name": "Película",
        "icon": "movie",
        "accent": "#8127cf",
        "accent_soft": "rgba(129,39,207,0.12)",
        "kicker": "Tu Película",
        "title": "Dune: Part Two",
        "desc": "Paul Atreides se une a los Fremen para vengar su familia.",
        "artValue": None,
        "art_poster": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&h=300&fit=crop",
        "metrics": [
            ("star", "#b45309", "Rating", "8.5/10"),
            ("people", "#8127cf", "Votos", "12.4k"),
            ("schedule", "#8363f9", "Duración", "166 min"),
        ],
        "extended_badge": ("4K · 2024", "#8127cf"),
        "extended_sections": [
            ("text", "movie_filter", "Sinopsis", "Lo esencial",
             "Paul Atreides se une a los Fremen del desierto para vengar la muerte de su padre y recuperar el trono. Una epopeya visual sobre destino, poder y ecología."),
            ("scroller", "people", "Reparto", "4 actores", [
                {"badge": "Prota", "title": "Zendaya", "detail": "Chani · Fremen", "metrics": ["9 premios"]},
                {"badge": "Prota", "title": "Timothée Chalamet", "detail": "Paul Atreides", "metrics": ["Oscar nom"]},
            ]),
            ("tiles", "movie_filter", "Equipo técnico", "4 datos", [
                ("movie_filter", "#8127cf", "Dirección", "D. Villeneuve"),
                ("edit", "#8363f9", "Guion", "Eric Roth"),
                ("music_note", "#b45309", "Banda", "Hans Zimmer"),
                ("camera", "#2d6a4f", "Fotografía", "G. Fraser"),
            ]),
            ("chips", "play_circle", "Dónde verla", "4 opciones", [
                "play_circle HBO Max", "play_circle Netflix", "play_circle Apple TV", "play_circle Cines 3D",
            ]),
        ],
    },
    {
        "id": "book-review",
        "group": "movie",
        "group_title": "Películas y libros",
        "name": "Libro",
        "icon": "menu_book",
        "accent": "#b45309",
        "accent_soft": "rgba(180,83,9,0.12)",
        "kicker": "Tu Libro",
        "title": "El infinito en un junco",
        "desc": "Irene Vallejo · 2022 · 412 páginas",
        "artValue": "★4.6",
        "metrics": [
            ("star", "#b45309", "Rating", "4.6/5"),
            ("calendar_today", "#8363f9", "Año", "2022"),
            ("auto_stories", "#8127cf", "Páginas", "412"),
        ],
        "extended_badge": ("Bestseller", "#b45309"),
        "extended_sections": [
            ("text", "menu_book", "Sinopsis", "Lo esencial",
             "Un viaje apasionante por la historia de los libros desde Homero hasta el presente. Vallejo teje anécdotas, filología y emociones en un homenaje al poder transformador de la lectura."),
            ("rows", "person", "Ficha del autor", "3 datos", [
                ("person", "#8363f9", "Irene Vallejo", "Nápoles, 1943 · Seudónimo", "3 premios", "done"),
            ]),
            ("timeline", "menu_book", "Capítulos destacados", "4 capítulos", [
                ("Cap. 1 La visita", "Introducción a Homero", "done"),
                ("Cap. 7 El cuarto azul", "Biblioteca Alejandría", "done"),
                ("Cap. 14 Confesión", "Censura romana", "current"),
                ("Cap. 22 Huida", "Edad Media", "pending"),
            ]),
            ("chips", "shopping_bag", "Dónde comprar", "4 opciones", [
                "shopping_bag Amazon $18", "shopping_bag Casa del Libro €22", "shopping_bag Kindle $9", "shopping_bag Audiolibro $14",
            ]),
        ],
    },
    {
        "id": "restaurant-synthesis",
        "group": "recipe",
        "group_title": "Recetas y cocina",
        "name": "Recomendación restaurante",
        "icon": "restaurant",
        "accent": "#f59e0b",
        "accent_soft": "rgba(245,158,11,0.12)",
        "kicker": "Tu Recomendación",
        "title": "Italiano en Chamberí",
        "desc": "8 locales analizados · Top: Osteria 4.7★",
        "artValue": "4.7★",
        "metrics": [
            ("storefront", "#b45309", "Opciones", "8"),
            ("place", "#3b82f6", "Radio", "1km"),
            ("euro", "#2d6a4f", "Precio", "€25pp"),
        ],
        "extended_badge": ("8 locales", "#f59e0b"),
        "extended_sections": [
            ("scroller", "storefront", "Top coincidencias", "3 locales", [
                {"badge": "TOP", "title": "Osteria Numero 5", "detail": "Napolitano auténtico, horno leña", "metrics": ["4.7★", "€25pp", "400m"]},
                {"badge": "2º", "title": "Trattoria da Marco", "detail": "Casereccio, pasta fresca", "metrics": ["4.5★", "€22pp", "600m"]},
            ]),
            ("rows", "analytics", "Desglose por criterio", "4 barras", [
                ("restaurant", "#2d6a4f", "Comida", "Top 9.2 vs 7.8", "9.2", "done"),
                ("payments", "#b45309", "Precio", "8.5 vs 7.0", "8.5", "current"),
                ("support_agent", "#3b82f6", "Servicio", "9.0 vs 8.4", "9.0", "done"),
            ]),
            ("tiles", "local_pizza", "Highlights del menú", "4 platos", [
                ("local_pizza", "#b45309", "Top dish", "Margherita €14"),
                ("wine_bar", "#8127cf", "Vino", "Chianti Riserva"),
                ("cake", "#ec4899", "Postre", "Tiramisú casero"),
                ("eco", "#2d6a4f", "Veggie", "5 opciones"),
            ]),
        ],
    },
    # ============ INFORMATION & RESEARCH ============
    {
        "id": "news-urgent",
        "group": "news",
        "group_title": "Noticias y eventos",
        "name": "Noticia urgente",
        "icon": "breaking_news",
        "accent": "#ef4444",
        "accent_soft": "rgba(239,68,68,0.12)",
        "kicker": "live URGENTE · Hace 4 min",
        "title": "Terremoto en Turquía",
        "desc": "Magnitud 6.4 · Costa de Izmir · Protocolo tsunami activado",
        "artValue": "6.4",
        "metrics": [
            ("place", "#c81e1e", "Epicentro", "30km Izmir"),
            ("schedule", "#c81e1e", "Hora", "14:32 local"),
            ("warning", "#b45309", "Réplicas", "M4.2"),
        ],
        "extended_badge": ("URGENTE · Live", "#ef4444"),
        "extended_sections": [
            ("text", "breaking_news", "Resumen", "Lo esencial",
             "Un terremoto de magnitud 6.4 ha sacudido la costa de Turquía a las 14:32 hora local. El epicentro se localizó a 30 km de Izmir. Se han registrado réplicas de M4.2 y se ha activado el protocolo de tsunami como precaución."),
            ("timeline", "history", "Cronología de eventos", "5 actualizaciones", [
                ("14:32 Epicentro", "30km de Izmir, 10km profundidad", "done"),
                ("14:38 Réplicas", "M4.2 a 12km", "done"),
                ("14:44 Tsunami", "Protocolo activado", "current"),
                ("14:50 Heridos", "Primeros reportes", "pending"),
            ]),
            ("chips", "fact_check", "Verificación de hechos", "4 checks", [
                "check Epicentro confirmado USGS", "check Magnitud 6.4 oficial", "close Tsunami NO confirmado", "warning Heridos sin verificar",
            ]),
            ("sources", "link", "Fuentes", "4 orígenes", [
                ("USGS", "usgs.gov"),
                ("BBC", "bbc.com"),
                ("Reuters", "reuters.com"),
                ("AFAD", "afad.gov.tr"),
            ]),
        ],
    },
    {
        "id": "important-event",
        "group": "news",
        "group_title": "Noticias y eventos",
        "name": "Evento importante",
        "icon": "event",
        "accent": "#4f46e5",
        "accent_soft": "rgba(79,70,229,0.12)",
        "kicker": "Tu Evento · Hoy",
        "title": "Q1 Review con ACME",
        "desc": "8 asistentes · 45 min · Zoom",
        "artValue": "02:14",
        "metrics": [
            ("schedule", "#4f46e5", "Cuándo", "16:00 hoy"),
            ("videocam", "#3b82f6", "Dónde", "Zoom"),
            ("groups", "#8363f9", "Asistentes", "8"),
        ],
        "extended_badge": ("Countdown 2h 14min", "#4f46e5"),
        "extended_sections": [
            ("tiles", "event", "Detalles del evento", "4 datos", [
                ("schedule", "#4f46e5", "Cuándo", "Hoy 16:00 CET"),
                ("videocam", "#3b82f6", "Dónde", "Zoom · link en agenda"),
                ("groups", "#8363f9", "Asistentes", "8 confirmados"),
                ("description", "#b45309", "Agenda", "4 temas · 45 min"),
            ]),
            ("timeline", "schedule", "Agenda del evento", "5 bloques", [
                ("16:00 Bienvenida", "5 min", "pending"),
                ("16:05 Resultados Q1", "10 min", "pending"),
                ("16:15 Plan Q2", "15 min", "pending"),
                ("16:30 Q&A", "10 min", "pending"),
            ]),
            ("scroller", "groups", "Asistentes", "4 personas", [
                {"badge": "Org", "title": "Ana Ruiz", "detail": "CFO", "metrics": ["Confirmó"]},
                {"badge": "Org", "title": "Carlos Pérez", "detail": "CEO", "metrics": ["Confirmó"]},
                {"badge": "Cli", "title": "Mar ACME", "detail": "Cliente", "metrics": ["Confirmó"]},
            ]),
        ],
    },
    {
        "id": "deepsearch",
        "group": "news",
        "group_title": "Noticias y eventos",
        "name": "Deepsearch",
        "icon": "manage_search",
        "accent": "#8363f9",
        "accent_soft": "rgba(131,99,249,0.12)",
        "kicker": "Tu Investigación",
        "title": "¿Invertir en IA en 2025?",
        "desc": "14 fuentes verificadas · 8 min lectura · 92% confianza",
        "artValue": "92%",
        "metrics": [
            ("link", "#8363f9", "Fuentes", "14"),
            ("schedule", "#b45309", "Lectura", "8 min"),
            ("verified", "#2d6a4f", "Confianza", "92%"),
        ],
        "extended_badge": ("92% confianza", "#8363f9"),
        "extended_sections": [
            ("text", "auto_awesome", "Síntesis IA", "Respuesta directa",
             "La inversión en IA en 2025 presenta 3 oportunidades claras (infraestructura GPU, vertical SaaS, edge AI) y 2 riesgos principales (saturación de GPU, regulación EU AI Act). Se recomienda exposición 15-25% del portfolio a IA con horizonte 3-5 años."),
            ("scroller", "lightbulb", "Hallazgos clave", "5 hallazgos", [
                {"badge": "#1", "title": "Infraestructura GPU domina", "detail": "NVIDIA captura 78% del mercado de chips IA. Demanda sostenida hasta 2027.", "metrics": ["92% confianza", "3 fuentes"]},
                {"badge": "#2", "title": "Vertical SaaS despega", "detail": "IA aplicada a salud, legal y finanzas crece 42% CAGR.", "metrics": ["88% confianza"]},
            ]),
            ("sources", "link", "Fuentes verificadas", "4 orígenes", [
                ("NVIDIA Q4 2024 Earnings", "investor.nvidia.com"),
                ("Stanford AI Index 2024", "aiindex.stanford.edu"),
                ("Gartner IA forecast", "gartner.com"),
                ("McKinsey AI report", "mckinsey.com"),
            ]),
            ("chips", "manage_search", "Consultas relacionadas", "4 queries", [
                "manage_search NVIDIA vs AMD", "manage_search ETFs de IA", "manage_search EU AI Act riesgos", "manage_search Startups IA",
            ]),
        ],
    },
    {
        "id": "image-generation",
        "group": "news",
        "group_title": "Noticias y eventos",
        "name": "Creación de imágenes",
        "icon": "auto_awesome",
        "accent": "#ec4899",
        "accent_soft": "rgba(236,72,153,0.12)",
        "kicker": "Tu Imagen",
        "title": "Jardín japonés al atardecer",
        "desc": "4 variantes generadas · 8s · 1024×1024",
        "artValue": None,
        "art_poster": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=200&h=300&fit=crop",
        "metrics": [
            ("image", "#ec4899", "Variantes", "4"),
            ("schedule", "#b45309", "Tiempo", "8s"),
            ("aspect_ratio", "#8363f9", "Resolución", "1024²"),
        ],
        "extended_badge": ("4 variantes", "#ec4899"),
        "extended_sections": [
            ("scroller", "image", "Galería generada", "4 variantes", [
                {"badge": "v1", "title": "Variante 1", "detail": "Estilo realista", "metrics": ["1024²", "PNG"]},
                {"badge": "v2", "title": "Variante 2", "detail": "Ukiyo-e digital", "metrics": ["1024²", "PNG"]},
                {"badge": "v3", "title": "Variante 3", "detail": "Cinemática", "metrics": ["1024²", "PNG"]},
            ]),
            ("text", "code", "Prompt original", "Prompt engineering",
             "A serene Japanese garden at sunset, cherry blossoms, koi pond reflecting orange sky, ukiyo-e style with subtle digital painting touches, 8k resolution, cinematic lighting."),
            ("chips", "lightbulb", "Tips de prompt engineering", "5 tips", [
                "lightbulb Especifica resolución", "lightbulb Menciona estilo", "lightbulb Añade iluminación", "lightbulb Evita negaciones", "lightbulb Usa referencias",
            ]),
            ("tiles", "memory", "Detalles técnicos", "4 datos", [
                ("memory", "#8363f9", "Modelo", "Koru-Image v2"),
                ("schedule", "#b45309", "Tiempo", "8 segundos"),
                ("aspect_ratio", "#8127cf", "Resolución", "1024×1024"),
                ("palette", "#ec4899", "Estilo", "Ukiyo-e"),
            ]),
        ],
    },
    # ============ TRAVEL & DECISIONS ============
    {
        "id": "travel-planner",
        "group": "travel",
        "group_title": "Viajes y rutas",
        "name": "Planificación de viaje",
        "icon": "flight_takeoff",
        "accent": "#3b82f6",
        "accent_soft": "rgba(59,130,246,0.12)",
        "kicker": "Tu Viaje · Tokio",
        "title": "7 días en Japón",
        "desc": "Tokio + Kioto · 2 viajeros · €2.160 total",
        "artValue": "7d",
        "metrics": [
            ("flight_takeoff", "#3b82f6", "Vuelo", "14 mar"),
            ("hotel", "#8363f9", "Hotel", "5 noches"),
            ("payments", "#2d6a4f", "Total", "€2.160"),
        ],
        "extended_badge": ("14-20 marzo", "#3b82f6"),
        "extended_sections": [
            ("timeline", "schedule", "Itinerario día a día", "7 días", [
                ("Día 1 · Shibuya & Shinjuku", "Llegada 14h, explorar", "current"),
                ("Día 2 · Asakusa & río Sumida", "Templo Senso-ji", "pending"),
                ("Día 3 · Hakone", "Onsen y monte Fuji", "pending"),
                ("Día 4-5 · Kioto", "Tren bala, templos", "pending"),
            ]),
            ("tiles", "flight", "Reservas", "4 datos", [
                ("flight", "#3b82f6", "Vuelo", "IBERIA · 14 mar"),
                ("hotel", "#8363f9", "Hotel", "Park Hyatt 5 noches"),
                ("directions_railway", "#2d6a4f", "JR Pass", "7 días ¥29.110"),
                ("restaurant", "#b45309", "Cenas", "3 reservas"),
            ]),
            ("chips", "luggage", "Checklist de equipaje", "6 items", [
                "luggage Adaptador tipo A", "credit_card Suica card", "checkroom Cortavientos", "phone_android eSIM Japón",
            ]),
            ("tiles", "payments", "Presupuesto", "4 categorías", [
                ("flight", "#3b82f6", "Vuelos", "€780"),
                ("hotel", "#8363f9", "Hotel", "€820"),
                ("restaurant", "#b45309", "Comidas", "€350"),
                ("directions_car", "#2d6a4f", "Transporte", "€210"),
            ]),
        ],
    },
    {
        "id": "route-map",
        "group": "travel",
        "group_title": "Viajes y rutas",
        "name": "Ruta y navegación",
        "icon": "map",
        "accent": "#4f46e5",
        "accent_soft": "rgba(79,70,229,0.12)",
        "kicker": "Tu Ruta · A destino",
        "title": "Ruta a Aeropuerto Barajas",
        "desc": "12.4 km · Tráfico ligero · 24 min ETA",
        "artValue": "24min",
        "metrics": [
            ("straighten", "#4f46e5", "Distancia", "12.4km"),
            ("traffic", "#2d6a4f", "Tráfico", "Ligero"),
            ("local_gas_station", "#b45309", "Consumo", "0.9L"),
        ],
        "extended_badge": ("ETA 24 min", "#4f46e5"),
        "extended_sections": [
            ("timeline", "directions", "Indicaciones paso a paso", "5 pasos", [
                ("1. Salir C/ Mayor norte", "300m", "current"),
                ("2. Girar derecha Gran Vía", "1.2km", "pending"),
                ("3. Continuar Plaza España", "800m", "pending"),
                ("4. Salida 7 M-30", "5.4km", "pending"),
            ]),
            ("tiles", "schedule", "ETA y alternativas", "4 rutas", [
                ("schedule", "#4f46e5", "Actual", "24 min"),
                ("alt_route", "#3b82f6", "M-30", "31 min"),
                ("traffic", "#b45309", "Centro", "38 min"),
                ("eco", "#2d6a4f", "Ecológica", "27 min"),
            ]),
            ("tiles", "traffic", "Tráfico", "4 datos", [
                ("sentiment_satisfied", "#2d6a4f", "Estado", "🟢 Ligero"),
                ("warning", "#b45309", "Incidencias", "1 obra"),
                ("speed", "#4f46e5", "Velocidad", "48 km/h"),
                ("local_gas_station", "#c81e1e", "Consumo", "0.9L"),
            ]),
        ],
    },
    {
        "id": "comparison",
        "group": "comparison",
        "group_title": "Comparativas y decisiones",
        "name": "Comparativa de productos",
        "icon": "compare_arrows",
        "accent": "#8363f9",
        "accent_soft": "rgba(131,99,249,0.12)",
        "kicker": "Tu Comparación",
        "title": "iPhone 16 Pro vs Galaxy S24",
        "desc": "2 opciones analizadas · Top: iPhone",
        "artValue": "2",
        "metrics": [
            ("inventory_2", "#8363f9", "Opciones", "2"),
            ("attach_money", "#2d6a4f", "Precio", "$999-1299"),
            ("emoji_events", "#b45309", "Top pick", "iPhone"),
        ],
        "extended_badge": ("Top: iPhone 16 Pro", "#8363f9"),
        "extended_sections": [
            ("scroller", "inventory_2", "Top pick", "1 recomendado", [
                {"badge": "RECOMENDADO", "title": "iPhone 16 Pro", "detail": "Mejor equilibrio cámara-batería-ecosistema", "metrics": ["Cámara 9.4", "Batería 8.7", "$999"]},
            ]),
            ("rows", "compare_arrows", "Matriz de comparación", "4 barras", [
                ("battery_full", "#2d6a4f", "Batería", "iPhone 8.7 vs Galaxy 9.1", "8.7-9.1", "current"),
                ("photo_camera", "#8363f9", "Cámara", "iPhone 9.4 vs Galaxy 9.2", "9.4-9.2", "done"),
                ("speed", "#b45309", "Velocidad", "iPhone 9.6 vs Galaxy 9.5", "9.6-9.5", "done"),
                ("attach_money", "#c81e1e", "Precio", "iPhone $999 vs Galaxy $1299", "$999-1299", "urgent"),
            ]),
            ("tiles", "check_circle", "Pros iPhone", "4 puntos", [
                ("check_circle", "#2d6a4f", "Pro 1", "Cámara pro"),
                ("check_circle", "#2d6a4f", "Pro 2", "Ecosistema"),
                ("cancel", "#c81e1e", "Con 1", "Precio alto"),
                ("cancel", "#c81e1e", "Con 2", "Sin USB-C rápido"),
            ]),
            ("text", "psychology", "Veredicto", "Koru AI",
             "Si valoras cámara y ecosistema: iPhone. Si quieres potencia bruta y S-Pen: Galaxy. Ambos son excelentes; la decisión depende de tu prioridad."),
        ],
    },
    {
        "id": "decision-support",
        "group": "comparison",
        "group_title": "Comparativas y decisiones",
        "name": "Soporte de decisión",
        "icon": "psychology_alt",
        "accent": "#8127cf",
        "accent_soft": "rgba(129,39,207,0.12)",
        "kicker": "Tu Decisión",
        "title": "¿Cambiar de trabajo en 2025?",
        "desc": "3 opciones · 74% confianza · Recomendado: startup",
        "artValue": "74%",
        "metrics": [
            ("balance", "#8127cf", "Opciones", "3"),
            ("psychology_alt", "#8363f9", "Factores", "6"),
            ("verified", "#2d6a4f", "Confianza", "74%"),
        ],
        "extended_badge": ("Decisión en 2 sem", "#8127cf"),
        "extended_sections": [
            ("rows", "balance", "Opciones con probabilidad", "3 opciones", [
                ("trending_flat", "#8363f9", "Quedarse actual", "Probabilidad 35% · Seguro", "35%", "pending"),
                ("trending_up", "#2d6a4f", "Cambiar a startup", "Probabilidad 55% · Recomendado", "55%", "done"),
                ("trending_down", "#b45309", "Freelance", "Probabilidad 10% · Riesgoso", "10%", "current"),
            ]),
            ("chips", "psychology", "Factores clave", "6 factores", [
                "payments Salario", "balance Work-life", "trending_up Crecimiento", "shield Estabilidad", "rocket_launch Proyecto", "place Flexibilidad",
            ]),
            ("tiles", "compare_arrows", "Matriz de trade-offs", "4 datos", [
                ("trending_up", "#2d6a4f", "Startup crec.", "+85%"),
                ("warning", "#c81e1e", "Startup riesgo", "Alto"),
                ("shield", "#3b82f6", "Actual estab.", "Alta"),
                ("trending_flat", "#b45309", "Actual crec.", "Bajo"),
            ]),
            ("text", "auto_awesome", "Recomendación Koru", "Análisis",
             "Considerando tu perfil (alto apetito de riesgo, prioridad a crecimiento, 32 años), la opción startup tiene 55% de probabilidad de optimizar tu utilidad esperada."),
        ],
    },
    # ============ MEMORY & SYSTEM ============
    {
        "id": "memory",
        "group": "memory",
        "group_title": "Memoria y notas",
        "name": "Memoria",
        "icon": "psychology",
        "accent": "#8127cf",
        "accent_soft": "rgba(129,39,207,0.12)",
        "kicker": "Memoria",
        "title": "Vacaciones en Lisboa 2023",
        "desc": "Hace 14 meses · Recall 87% · 4 relacionados",
        "artValue": "87%",
        "metrics": [
            ("fingerprint", "#8127cf", "Recall", "87%"),
            ("event", "#8363f9", "Fecha", "12 jun 23"),
            ("group", "#ec4899", "Personas", "María"),
        ],
        "extended_badge": ("Hace 14 meses", "#8127cf"),
        "extended_sections": [
            ("text", "psychology", "Recuerdo", "Memoria recuperada",
             "Fui a Lisboa en junio 2023 con María. Visitamos el barrio de Alfama, comimos pastéis de Belém en la Fábrica original. Subimos al castelo de São Jorge al atardecer. María se resfrió el tercer día."),
            ("tiles", "fingerprint", "Confianza del recuerdo", "4 datos", [
                ("fingerprint", "#8127cf", "Confianza", "87%"),
                ("event", "#8363f9", "Fecha", "12 jun 2023"),
                ("place", "#3b82f6", "Ubicación", "Lisboa, PT"),
                ("group", "#ec4899", "Personas", "María"),
            ]),
            ("scroller", "link", "Recuerdos relacionados", "4 memorias", [
                {"badge": "Hace 1 año", "title": "Cumple María Madrid", "detail": "Conexión: misma persona", "metrics": ["72% similar"]},
                {"badge": "Hace 2 años", "title": "Porto 2022", "detail": "Conexión: Portugal", "metrics": ["68% similar"]},
            ]),
            ("timeline", "history", "Historia de la fuente", "4 hitos", [
                ("12 jun 2023 Foto", "iPhone · Alfama", "done"),
                ("15 jun 2023 WhatsApp", "Conversación María", "done"),
                ("8 ago 2023 Diario", "Editado en Notion", "done"),
                ("Hoy Recuperado", "Vía query usuario", "current"),
            ]),
        ],
    },
    {
        "id": "note",
        "group": "memory",
        "group_title": "Memoria y notas",
        "name": "Nota",
        "icon": "sticky_note_2",
        "accent": "#8363f9",
        "accent_soft": "rgba(131,99,249,0.12)",
        "kicker": "Tu Nota",
        "title": "Ideas para el proyecto ACME",
        "desc": "Creada hace 3 días · 4 etiquetas",
        "artValue": None,
        "art_poster": None,
        "metrics": [
            ("label", "#8363f9", "Etiquetas", "4"),
            ("schedule", "#b45309", "Creada", "hace 3d"),
            ("edit", "#2d6a4f", "Editada", "hace 2h"),
        ],
        "extended_badge": ("Editada hace 2h", "#8363f9"),
        "extended_sections": [
            ("text", "sticky_note_2", "Contenido de la nota", "Texto",
             "Ideas para proyecto ACME: 1) Integración con API de weather para sugerencias contextuales. 2) Modo offline con IndexedDB. 3) Onboarding con coachmark. 4) Exportar a Notion. 5) Widget iOS."),
            ("tiles", "label", "Metadatos", "4 datos", [
                ("schedule", "#b45309", "Creada", "11 mar 2024"),
                ("edit", "#2d6a4f", "Editada", "hace 2h"),
                ("folder", "#8363f9", "Carpeta", "Trabajo"),
                ("label", "#8127cf", "Etiquetas", "4"),
            ]),
            ("chips", "label", "Etiquetas", "4 tags", [
                "label #trabajo", "label #acme", "label #ideas", "label #producto",
            ]),
            ("timeline", "history", "Historial de edición", "3 versiones", [
                ("11 mar · Creada", "Nota inicial", "done"),
                ("12 mar · Editada", "Añadidas 2 ideas", "done"),
                ("Hoy · Editada", "Reordenado", "current"),
            ]),
        ],
    },
]

def render_compact(card):
    """Renderiza el estado compacto (chat card)"""
    out = []
    out.append(f'<div class="k-card is-tappable" style="--accent:{card["accent"]};--accent-soft:{card["accent_soft"]};">')
    out.append(f'  <div class="k-card-glow" style="background:radial-gradient(circle,{card["accent"]},transparent 70%);"></div>')
    out.append('  <div class="k-card-top">')
    out.append('    <div class="k-card-copy">')
    kicker_html = card["kicker"]
    if "live" in kicker_html:
        kicker_html = kicker_html.replace("live ", '<span class="live-dot"></span> ')
    out.append(f'      <div class="k-card-kicker" style="color:{card["accent"]};">{kicker_html}</div>')
    out.append(f'      <div class="k-card-title">{card["title"]}</div>')
    out.append(f'      <div class="k-card-desc">{card["desc"]}</div>')
    out.append('    </div>')
    # Art
    if card.get("art_poster"):
        out.append(f'    <img class="k-card-art-poster" src="{card["art_poster"]}" alt="{card["name"]}" />')
    else:
        out.append(f'    <div class="k-card-art" style="background:{card["accent_soft"]};color:{card["accent"]};">')
        out.append(f'      <span class="material-symbols-outlined ms-fill">{card["icon"]}</span>')
        if card.get("artValue"):
            out.append(f'      <div class="k-card-art-value">{card["artValue"]}</div>')
        out.append('    </div>')
    out.append('  </div>')
    # Metrics
    if card.get("metrics"):
        cols = len(card["metrics"])
        out.append(f'  <div class="k-metrics" style="grid-template-columns:repeat({cols},1fr);">')
        for icon, color, label, value in card["metrics"]:
            out.append(f'    <div class="k-metric"><span class="material-symbols-outlined" style="color:{color};">{icon}</span><div class="k-metric-label">{label}</div><div class="k-metric-value">{value}</div></div>')
        out.append('  </div>')
    # Actions OR CTA hint
    if card.get("actions"):
        out.append('  <div class="k-actions">')
        for icon, label, kind in card["actions"]:
            if kind == "primary":
                out.append(f'    <button class="k-action primary" style="background:{card["accent"]};"><span class="material-symbols-outlined">{icon}</span>{label}</button>')
            else:
                out.append(f'    <button class="k-action secondary"><span class="material-symbols-outlined">{icon}</span>{label}</button>')
        out.append('  </div>')
    else:
        out.append(f'  <div class="k-cta-hint" style="color:{card["accent"]};"><span>Ver detalle</span><span class="material-symbols-outlined">arrow_forward</span></div>')
    out.append('</div>')
    return '\n'.join(out)

def render_extended(card):
    """Renderiza el estado extendido (detail screen)"""
    out = []
    accent = card["accent"]
    accent_soft = card["accent_soft"]
    out.append('<div class="k-detail">')
    # Sticky head
    out.append('  <div class="k-detail-sticky-head">')
    out.append('    <button class="k-detail-back"><span class="material-symbols-outlined">arrow_back_ios_new</span></button>')
    out.append(f'    <div class="k-detail-mini-icon" style="background:{accent_soft};color:{accent};"><span class="material-symbols-outlined">{card["icon"]}</span></div>')
    out.append(f'    <div style="flex:1;min-width:0;"><div class="k-detail-mini-title">{card["title"]}</div><div class="k-detail-mini-sub">{card["kicker"].replace("live ","").replace("URGENTE · ","")}</div></div>')
    out.append('    <button class="k-detail-save"><span class="material-symbols-outlined ms-fill">bookmark</span></button>')
    out.append('  </div>')
    # Hero
    out.append(f'  <div class="k-detail-hero" style="height:140px;">')
    if card.get("art_poster"):
        out.append(f'    <img class="k-detail-hero-backdrop" src="{card["art_poster"]}" alt="" />')
    else:
        out.append(f'    <div class="k-detail-hero-backdrop" style="background:linear-gradient(135deg,{accent},{card.get("accent_dark", "#523a9e") if "accent_dark" in card else "#382b8c"});"></div>')
    out.append('    <div class="k-detail-hero-scrim"></div>')
    out.append('    <div class="k-detail-hero-content">')
    badge_text, badge_color = card["extended_badge"]
    out.append(f'      <div class="k-detail-hero-badge" style="background:rgba(255,255,255,0.92);color:{badge_color};"><span class="material-symbols-outlined" style="font-size:11px;">verified</span>{badge_text}</div>')
    out.append(f'      <div class="k-detail-hero-title">{card["title"]}</div>')
    out.append(f'      <div class="k-detail-hero-sub">{card["desc"]}</div>')
    out.append('    </div>')
    out.append('  </div>')
    # Modules
    out.append('  <div class="k-detail-modules">')
    for i, section in enumerate(card["extended_sections"]):
        kind = section[0]
        icon = section[1]
        title = section[2]
        kicker = section[3]
        items = section[4]
        delay = 0.1 + i * 0.06
        out.append(f'    <div class="k-module" style="--module-color:{accent};animation-delay:{delay}s;">')
        out.append('      <div class="k-module-head">')
        out.append(f'        <div class="k-module-icon" style="background:{accent_soft};color:{accent};"><span class="material-symbols-outlined">{icon}</span></div>')
        out.append(f'        <div><div class="k-module-title" style="color:{accent};">{title}</div><div class="k-module-kicker">{kicker}</div></div>')
        # Meta on right
        if isinstance(items, list) and items:
            count = len(items)
            out.append(f'        <span class="k-module-meta">{count}</span>')
        out.append('      </div>')
        # Section body
        if kind == "text":
            out.append(f'      <p class="k-text">{items}</p>')
        elif kind == "tiles":
            out.append('      <div class="k-tiles">')
            for tile in items:
                t_icon, t_color, t_label, t_value = tile
                out.append(f'        <div class="k-tile"><span class="material-symbols-outlined k-tile-icon" style="color:{t_color};">{t_icon}</span><div><div class="k-tile-label">{t_label}</div><div class="k-tile-value">{t_value}</div></div></div>')
            out.append('      </div>')
        elif kind == "rows":
            out.append('      <div class="k-rows">')
            for row in items:
                r_icon, r_color, r_title, r_detail, r_meta, r_tone = row
                out.append(f'        <div class="k-row"><span class="material-symbols-outlined k-row-icon" style="color:{r_color};">{r_icon}</span><div class="k-row-body"><div class="k-row-title">{r_title}</div><div class="k-row-detail">{r_detail}</div></div><span class="k-row-meta">{r_meta}</span></div>')
            out.append('      </div>')
        elif kind == "chips":
            out.append('      <div class="k-chips">')
            for chip in items:
                # chip can be "icon label" format
                parts = chip.split(" ", 1)
                if len(parts) == 2 and len(parts[0]) < 20:
                    c_icon = parts[0]
                    c_label = parts[1]
                    out.append(f'        <div class="k-chip"><span class="material-symbols-outlined">{c_icon}</span>{c_label}</div>')
                else:
                    out.append(f'        <div class="k-chip">{chip}</div>')
            out.append('      </div>')
        elif kind == "scroller":
            out.append('      <div class="k-scroller">')
            for sc in items:
                badge = sc["badge"]
                bcolor = sc.get("badgeColor", accent)
                out.append(f'        <div class="k-scard"><span class="k-scard-badge" style="background:{accent_soft};color:{accent};">{badge}</span><div class="k-scard-title">{sc["title"]}</div><div class="k-scard-detail">{sc["detail"]}</div>')
                if sc.get("metrics"):
                    out.append('          <div class="k-scard-metrics">')
                    for m in sc["metrics"]:
                        out.append(f'            <span class="k-scard-metric">{m}</span>')
                    out.append('          </div>')
                out.append('        </div>')
            out.append('      </div>')
        elif kind == "timeline":
            out.append('      <div class="k-timeline">')
            for step in items:
                s_name, s_meta, s_status = step
                out.append(f'        <div class="k-timeline-step is-{s_status}">')
                out.append(f'          <div class="k-timeline-dot"><span class="material-symbols-outlined">{"check" if s_status == "done" else ("radio_button_checked" if s_status == "current" else "radio_button_unchecked")}</span></div>')
                out.append(f'          <div class="k-timeline-body"><div class="k-timeline-name">{s_name}</div><div class="k-timeline-meta">{s_meta}</div></div>')
                out.append('        </div>')
            out.append('      </div>')
        elif kind == "sources":
            out.append('      <div class="k-sources">')
            for src in items:
                s_title, s_domain = src
                out.append(f'        <div class="k-source"><img class="k-source-favicon" src="https://www.google.com/s2/favicons?domain={s_domain}&sz=64" alt="" /><div class="k-source-body"><div class="k-source-title">{s_title}</div><div class="k-source-domain">{s_domain}</div></div><span class="material-symbols-outlined" style="color:{accent};font-size:16px;">open_in_new</span></div>')
            out.append('      </div>')
        out.append('    </div>')
    out.append('  </div>')
    # Sticky actions
    out.append('  <div class="k-detail-actions">')
    out.append('    <button class="k-detail-action save"><span class="material-symbols-outlined ms-fill" style="font-size:18px;">bookmark_added</span>Guardar</button>')
    out.append('    <button class="k-detail-action pdf"><span class="material-symbols-outlined" style="font-size:18px;">picture_as_pdf</span>PDF</button>')
    out.append('  </div>')
    out.append('</div>')
    return '\n'.join(out)

def render_card_showcase(card):
    """Renderiza el showcase compact + extended para una card"""
    out = []
    out.append(f'<div class="showcase reveal" id="card-{card["id"]}">')
    # Compact
    out.append('  <div class="showcase-compact">')
    out.append('    <span class="showcase-label compact"><span class="material-symbols-outlined">chat</span>Estado compacto · chat</span>')
    out.append(f'    {render_compact(card)}')
    out.append('  </div>')
    # Extended
    out.append('  <div class="showcase-extended">')
    out.append('    <span class="showcase-label extended"><span class="material-symbols-outlined">fullscreen</span>Estado extendido · informe</span>')
    out.append(f'    {render_extended(card)}')
    out.append('  </div>')
    out.append('</div>')
    return '\n'.join(out)

# === GROUPS ORDER ===
GROUPS_ORDER = [
    ("daily", "Vida diaria", "Clima, morning brief, bienestar — las cards que el usuario ve cada día."),
    ("alarm", "Alarmas y recordatorios", "Cards action-only con botones inline primario/secundario."),
    ("wellbeing", "Bienestar", "Salud, sueño, meditation, outfit del día."),
    ("plan", "Planes y checklists", "Roadmaps, checklists, smart lists con progreso."),
    ("routine", "Rutinas", "Habit loops con streaks, adherencia semanal."),
    ("exercise", "Planes de ejercicio", "Gym routines, progresión de fuerza, sesiones."),
    ("shopping", "Compras y listas", "Listas de supermercado, gastos en tiempo real."),
    ("match", "Fútbol y deportes", "Live match, tennis, estadísticas comparativas."),
    ("money", "Finanzas y gastos", "Balance mensual, transacciones, presupuestos."),
    ("market", "Mercados y trading", "Watchlist, top movers, índices."),
    ("crypto", "Crypto y trading", "Portfolio, holdings, P&L, posiciones."),
    ("recipe", "Recetas y cocina", "Recetas con video, restaurantes recomendados."),
    ("movie", "Películas y libros", "Reviews con backdrop, reparto, dónde ver."),
    ("news", "Noticias, eventos e investigación", "Urgent news, eventos importantes, deepsearch, image gen."),
    ("travel", "Viajes y rutas", "Itinerarios, navegación, transporte."),
    ("comparison", "Comparativas y decisiones", "Product comparison, decision support con probabilidades."),
    ("memory", "Memoria y notas", "Recuerdos con confianza, notas editables."),
]

# === GENERATE HTML ===
html_parts = []
html_parts.append('<!-- ============ ICONS + LAYOUTS SECTIONS ============ -->')

# Icons section
html_parts.append('''
    <section class="section" id="icons">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">stars</span>
        05 · Iconografía animada
      </div>
      <h2 class="section-title reveal">
        Material Symbols <span class="accent">con vida propia</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Koru usa Material Symbols Outlined con <code>FILL 0, wght 400, GRAD 0, opsz 24</code>. Tier S mantiene esa
        base pero adopta el patrón de lucide-animated: <strong>draw-on-view</strong> (pathLength 0→1),
        <strong>loop variants</strong> (rotate/pulse/bounce/wiggle), y <strong>state-transition</strong> (bookmark
        empty→filled con morph). Todo vía <code>font-variation-settings</code> FILL axis de Material Symbols.
      </p>

      <div class="reveal" data-delay="2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:13px;margin-top:24px;">
        <div style="background:#fff;border-radius:13px;padding:18px;border:1px solid var(--c-sand);text-align:center;transition:all 0.25s var(--e-spring);cursor:pointer;" onmouseover="this.querySelector('span').style.fontVariationSettings=\"'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24\";this.querySelector('span').style.transform='scale(1.15)';" onmouseout="this.querySelector('span').style.fontVariationSettings=\"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24\";this.querySelector('span').style.transform='scale(1)';">
          <span class="material-symbols-outlined" style="font-size:36px;color:#8363f9;transition:all 0.25s var(--e-spring);display:inline-block;">favorite</span>
          <div style="font-size:11.5px;font-weight:700;color:var(--c-bark);margin-top:7px;">Hover → Fill</div>
          <div style="font-size:10px;color:var(--c-earth);margin-top:2px;">FILL 0→1, scale 1→1.15</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:18px;border:1px solid var(--c-sand);text-align:center;">
          <div style="position:relative;width:36px;height:36px;margin:0 auto;">
            <span class="material-symbols-outlined" style="font-size:36px;color:#c81e1e;">notifications</span>
            <span style="position:absolute;top:-2px;right:-2px;width:11px;height:11px;border-radius:50%;background:#ef4444;border:2px solid #fff;animation:koru-pulse-dot 1.5s ease-in-out infinite;"></span>
          </div>
          <div style="font-size:11.5px;font-weight:700;color:var(--c-bark);margin-top:7px;">Badge pulse</div>
          <div style="font-size:10px;color:var(--c-earth);margin-top:2px;">notification dot · 1.5s</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:18px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined ms-fill" style="font-size:36px;color:#f59e0b;animation:koru-star-pop 2s ease-in-out infinite;">star</span>
          <div style="font-size:11.5px;font-weight:700;color:var(--c-bark);margin-top:7px;">Star pop</div>
          <div style="font-size:10px;color:var(--c-earth);margin-top:2px;">rating icon · 2s</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:18px;border:1px solid var(--c-sand);text-align:center;">
          <div style="width:44px;height:44px;border-radius:13px;background:radial-gradient(circle at 30% 30%,#c9bdf5 0%,#8363f9 50%,#523a9e 100%);display:grid;place-items:center;margin:0 auto;box-shadow:0 4px 12px rgba(131,99,249,0.3);animation:koru-breathe 3s ease-in-out infinite;">
            <span class="material-symbols-outlined ms-fill" style="font-size:22px;color:#fff;">auto_awesome</span>
          </div>
          <div style="font-size:11.5px;font-weight:700;color:var(--c-bark);margin-top:7px;">Avatar breathe</div>
          <div style="font-size:10px;color:var(--c-earth);margin-top:2px;">brand mark · 3s</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:18px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:36px;color:#2d6a4f;animation:koru-icon-rotate 4s linear infinite;">refresh</span>
          <div style="font-size:11.5px;font-weight:700;color:var(--c-bark);margin-top:7px;">Rotate</div>
          <div style="font-size:10px;color:var(--c-earth);margin-top:2px;">refresh · 4s linear</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:18px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:36px;color:#8127cf;animation:koru-icon-bounce 2s ease-in-out infinite;">trending_up</span>
          <div style="font-size:11.5px;font-weight:700;color:var(--c-bark);margin-top:7px;">Bounce</div>
          <div style="font-size:10px;color:var(--c-earth);margin-top:2px;">trending · 2s</div>
        </div>
      </div>

      <h3 class="reveal" data-delay="3" style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:32px;margin-bottom:14px;letter-spacing:-0.02em;">
        Custom stitched icons · <code>/public/stitch/icons/</code>
      </h3>
      <p class="reveal" data-delay="3" style="font-size:13.5px;color:var(--c-earth);margin-bottom:14px;max-width:720px;">
        Los 11 PNGs del usuario ya están colocados. Tier S los usa en los mapeadores de deliverable, weather, recipe,
        sports, etc. — reemplazando el icono genérico cuando existe ilustración propia.
      </p>
      <div class="reveal" data-delay="4" style="background:#fff;border-radius:14px;padding:18px;border:1px solid var(--c-sand);display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:12px;">
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(131,99,249,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#8363f9;font-size:22px;">task_alt</span></div><div style="font-size:9.5px;color:var(--c-earth);">tasks.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(245,158,11,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#b45309;font-size:22px;">payments</span></div><div style="font-size:9.5px;color:var(--c-earth);">finance.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(236,72,153,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#ec4899;font-size:22px;">shopping_bag</span></div><div style="font-size:9.5px;color:var(--c-earth);">shopping.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(45,106,79,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#2d6a4f;font-size:22px;">sports_soccer</span></div><div style="font-size:9.5px;color:var(--c-earth);">sports.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(59,130,246,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#3b82f6;font-size:22px;">travel_explore</span></div><div style="font-size:9.5px;color:var(--c-earth);">search-web.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(129,39,207,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#8127cf;font-size:22px;">analytics</span></div><div style="font-size:9.5px;color:var(--c-earth);">tech-analysis.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(79,70,229,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#4f46e5;font-size:22px;">flight_takeoff</span></div><div style="font-size:9.5px;color:var(--c-earth);">travel.png</div></div>
        <div style="text-align:center;"><div style="width:42px;height:42px;border-radius:11px;background:rgba(131,99,249,0.08);display:grid;place-items:center;margin:0 auto 5px;"><span class="material-symbols-outlined" style="color:#8363f9;font-size:22px;">spa</span></div><div style="font-size:9.5px;color:var(--c-earth);">wellness.png</div></div>
      </div>
    </section>
''')

# Layouts section
html_parts.append('''
    <section class="section" id="layouts">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">view_quilt</span>
        06 · Layouts configurables
      </div>
      <h2 class="section-title reveal">
        5 configuraciones de <span class="accent">hero card</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Una sola card mold no alcanza para 60+ tipos de contenido. Tier S introduce 5 layouts seleccionables por el
        mapper, todos coherentes con la paleta y tipografía de Koru.
      </p>

      <div class="reveal" data-delay="2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-top:24px;">
        <div>
          <div style="font-size:10.5px;font-weight:700;color:var(--kp);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px;">Layout · default</div>
          <div class="k-card" style="--accent:#8363f9;--accent-soft:rgba(131,99,249,0.12);margin-bottom:0;">
            <div class="k-card-top">
              <div class="k-card-copy"><div class="k-card-kicker" style="color:#8363f9;">Tu Plan</div><div class="k-card-title">Rutina mañanera</div></div>
              <div class="k-card-art" style="background:rgba(131,99,249,0.12);color:#8363f9;"><span class="material-symbols-outlined ms-fill" style="font-size:32px;">checklist_rtl</span></div>
            </div>
            <div class="k-cta-hint" style="color:#8363f9;"><span>Ver plan</span><span class="material-symbols-outlined">arrow_forward</span></div>
          </div>
          <p style="font-size:10.5px;color:var(--c-earth);margin-top:7px;">Para la mayoría. Estructura actual sin cambios.</p>
        </div>
        <div>
          <div style="font-size:10.5px;font-weight:700;color:var(--k-emerald);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px;">Layout · compact</div>
          <div class="k-card" style="--accent:#2d6a4f;--accent-soft:rgba(45,106,79,0.12);padding:12px 14px;margin-bottom:0;display:flex;align-items:center;gap:11px;">
            <div style="width:34px;height:34px;border-radius:10px;background:rgba(45,106,79,0.12);color:#2d6a4f;display:grid;place-items:center;flex-shrink:0;"><span class="material-symbols-outlined" style="font-size:17px;">favorite</span></div>
            <div style="flex:1;min-width:0;"><div style="font-size:9.5px;font-weight:600;color:#2d6a4f;letter-spacing:0.08em;text-transform:uppercase;">Bienestar</div><div style="font-size:13px;font-weight:800;color:#382b8c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Hora de meditar 5 min</div></div>
            <span class="material-symbols-outlined" style="color:#2d6a4f;font-size:17px;">chevron_right</span>
          </div>
          <p style="font-size:10.5px;color:var(--c-earth);margin-top:7px;">Para reminders y signals. Single-line.</p>
        </div>
        <div>
          <div style="font-size:10.5px;font-weight:700;color:var(--k-amber-text);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px;">Layout · spotlight</div>
          <div class="k-card" style="--accent:#f59e0b;padding:0;overflow:hidden;margin-bottom:0;">
            <div style="position:relative;height:80px;overflow:hidden;">
              <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=160&fit=crop" alt="" style="width:100%;height:100%;object-fit:cover;" />
              <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(46,38,80,0.85) 100%);"></div>
              <div style="position:absolute;bottom:7px;left:11px;right:11px;"><div style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.08em;">Tu Receta</div><div style="font-family:var(--t-display);font-size:14px;font-weight:800;color:#fff;line-height:1.1;">Pasta al pesto</div></div>
            </div>
          </div>
          <p style="font-size:10.5px;color:var(--c-earth);margin-top:7px;">Para recetas, películas, libros. Imagen + scrim.</p>
        </div>
        <div>
          <div style="font-size:10.5px;font-weight:700;color:var(--k-pink);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px;">Layout · gallery</div>
          <div class="k-card" style="--accent:#ec4899;padding:12px;margin-bottom:0;">
            <div style="font-size:9.5px;font-weight:600;color:#ec4899;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px;">Tu Comparación</div>
            <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:3px;">
              <div style="flex:0 0 70px;height:80px;border-radius:9px;background:linear-gradient(135deg,#ec4899,#be185d);padding:7px;display:flex;flex-direction:column;justify-content:flex-end;"><div style="font-size:10px;font-weight:800;color:#fff;">Opción A</div><div style="font-size:8.5px;color:rgba(255,255,255,0.85);">★ 4.8</div></div>
              <div style="flex:0 0 70px;height:80px;border-radius:9px;background:linear-gradient(135deg,#8363f9,#523a9e);padding:7px;display:flex;flex-direction:column;justify-content:flex-end;"><div style="font-size:10px;font-weight:800;color:#fff;">Opción B</div><div style="font-size:8.5px;color:rgba(255,255,255,0.85);">★ 4.5</div></div>
              <div style="flex:0 0 70px;height:80px;border-radius:9px;background:linear-gradient(135deg,#2d6a4f,#1a4d33);padding:7px;display:flex;flex-direction:column;justify-content:flex-end;"><div style="font-size:10px;font-weight:800;color:#fff;">Opción C</div><div style="font-size:8.5px;color:rgba(255,255,255,0.85);">★ 4.2</div></div>
            </div>
          </div>
          <p style="font-size:10.5px;color:var(--c-earth);margin-top:7px;">Para comparativas. Carousel horizontal.</p>
        </div>
        <div>
          <div style="font-size:10.5px;font-weight:700;color:var(--kp);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px;">Layout · banner</div>
          <div class="k-card" style="--accent:#8363f9;padding:0;overflow:hidden;margin-bottom:0;">
            <div style="position:relative;height:100px;background:linear-gradient(135deg,#8363f9 0%,#523a9e 100%);padding:14px;display:flex;flex-direction:column;justify-content:center;">
              <div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">Calendario · Julio</div>
              <div style="font-family:var(--t-display);font-size:28px;font-weight:800;color:#fff;line-height:1;">15</div>
              <div style="font-size:10.5px;color:rgba(255,255,255,0.85);margin-top:3px;">Cumpleaños de María</div>
            </div>
          </div>
          <p style="font-size:10.5px;color:var(--c-earth);margin-top:7px;">Para birthdays y alerts. Gradiente + número.</p>
        </div>
      </div>
    </section>
''')

# === CARDS CATALOG SECTION ===
html_parts.append('''
    <!-- ============ CARDS CATALOG ============ -->
    <section class="section" id="cards-catalog">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">collections</span>
        07 · Catálogo de cards
      </div>
      <h2 class="section-title reveal">
        26 cards rediseñadas · <span class="accent">compacto + extendido</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Cada card se muestra en sus dos estados: <strong>compacto</strong> (lo que aparece en el chat) y
        <strong>extendido</strong> (lo que abre al tocar). Mockups reales en HTML, no símbolos. Paleta respetada
        al 100%. Microdetalles aplicados en cada una.
      </p>
''')

# Group cards by group
from collections import defaultdict
groups_dict = defaultdict(list)
for card in CARDS:
    groups_dict[card["group"]].append(card)

section_num = 8
for group_id, group_title, group_desc in GROUPS_ORDER:
    if group_id not in groups_dict:
        continue
    cards_in_group = groups_dict[group_id]
    html_parts.append(f'''
      <div class="card-section-divider reveal">
        <div class="card-section-group-title">{group_title}</div>
        <div class="card-section-group-sub">{group_desc}</div>
      </div>
''')
    for card in cards_in_group:
        html_parts.append(render_card_showcase(card))
        # Card spec
        html_parts.append(f'''
        <div class="card-spec reveal">
          <strong>Spec · {card["name"]}</strong> &middot;
          Accent: <code>{card["accent"]}</code> &middot;
          Icon: <code>{card["icon"]}</code> &middot;
          Layout: <code>default</code> &middot;
          {len(card["metrics"])} metrics &middot;
          {len(card["extended_sections"])} secciones en extendido &middot;
          Glow halo activo &middot; Count-up en artValue &middot; CTA shimmer cíclico
        </div>
''')

html_parts.append('    </section>')

# === ROADMAP + CLOSING ===
html_parts.append('''
    <!-- ============ ROADMAP ============ -->
    <section class="section" id="roadmap">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">route</span>
        08 · Roadmap de implementación
      </div>
      <h2 class="section-title reveal">
        4 fases · <span class="accent">12 semanas</span> · sin breaking changes.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Cada fase es entregable y desplegable de forma independiente. Al final de cada fase, la app sigue 100%
        funcional. No hay big-bang refactor — cada paso agrega valor visible.
      </p>

      <div class="reveal" data-delay="2" style="display:grid;grid-template-columns:1fr;gap:13px;margin-top:24px;">
        <div style="background:linear-gradient(135deg,#fff 0%,#faf8ff 100%);border-radius:16px;padding:20px;border:1px solid var(--c-sand);border-left:5px solid var(--kp);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;">
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="width:40px;height:40px;border-radius:11px;background:var(--kp-soft);color:var(--kp);display:grid;place-items:center;font-family:var(--t-display);font-weight:800;font-size:16px;">1</div>
              <div><div style="font-size:10.5px;font-weight:700;color:var(--kp);letter-spacing:0.08em;text-transform:uppercase;">Semanas 1-3 · Fundación</div><strong style="font-size:14.5px;color:var(--c-bark);">Tokens + motion + bug fixes críticos</strong></div>
            </div>
            <span class="pill violet"><span class="material-symbols-outlined">flag</span> 8 issues</span>
          </div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--c-bark);line-height:1.7;">
            <li>Unificar paleta a <code>#8363f9</code> (remap <code>#7c5ff6</code> y <code>#7c5cdb</code>)</li>
            <li>Crear 6 nuevos <code>@keyframes</code>: section-stagger, cta-shine, tap-ripple, icon-pop, glow-breathe, count-up</li>
            <li>Aplicar <code>koru-sheet-up</code> al detail screen (entrada + salida)</li>
            <li>Mover back/save-top a <code>position: sticky</code></li>
            <li>Hacer <code>.koru-dsec-actions</code> sticky con blur backdrop</li>
            <li>Split chips CSS: nuevo kind <code>calendar</code> para birthday</li>
            <li>Remover <code>opacity: 0.7; filter: grayscale(50%)</code> de Collections rows</li>
            <li>Eliminar <code>DeliverableCard.tsx</code> y CSS muerto</li>
          </ul>
        </div>

        <div style="background:linear-gradient(135deg,#fff 0%,#faf8ff 100%);border-radius:16px;padding:20px;border:1px solid var(--c-sand);border-left:5px solid var(--k-pink);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;">
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="width:40px;height:40px;border-radius:11px;background:rgba(236,72,153,0.12);color:var(--k-pink);display:grid;place-items:center;font-family:var(--t-display);font-weight:800;font-size:16px;">2</div>
              <div><div style="font-size:10.5px;font-weight:700;color:var(--k-pink);letter-spacing:0.08em;text-transform:uppercase;">Semanas 4-6 · Hero mold v2</div><strong style="font-size:14.5px;color:var(--c-bark);">5 layouts + microdetalles + glow</strong></div>
            </div>
            <span class="pill pink"><span class="material-symbols-outlined">layers</span> 5 layouts</span>
          </div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--c-bark);line-height:1.7;">
            <li>Extender type <code>KoruPresentation</code> con <code>layout, glow, countUp, shimmer, sharedElementId, badge, heroGallery</code></li>
            <li>Implementar 5 layouts: <code>default, compact, spotlight, gallery, banner</code></li>
            <li>Migrar weather, recipe, live_match, movie_review a layouts avanzados</li>
            <li>Implementar count-up para artValue numérico</li>
            <li>Implementar CTA shimmer cíclico</li>
            <li>Implementar tap ripple + haptic feedback</li>
            <li>Implementar shared-element transition via <code>view-transition-name</code></li>
            <li>Agregar <code>onError</code> fallback en todos los <code>&lt;img&gt;</code></li>
          </ul>
        </div>

        <div style="background:linear-gradient(135deg,#fff 0%,#faf8ff 100%);border-radius:16px;padding:20px;border:1px solid var(--c-sand);border-left:5px solid var(--k-amber-text);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;">
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="width:40px;height:40px;border-radius:11px;background:rgba(245,158,11,0.12);color:var(--k-amber-text);display:grid;place-items:center;font-family:var(--t-display);font-weight:800;font-size:16px;">3</div>
              <div><div style="font-size:10.5px;font-weight:700;color:var(--k-amber-text);letter-spacing:0.08em;text-transform:uppercase;">Semanas 7-9 · Detail v2</div><strong style="font-size:14.5px;color:var(--c-bark);">Imágenes, video, sources enriquecidos</strong></div>
            </div>
            <span class="pill amber"><span class="material-symbols-outlined">image</span> +12 microdetalles</span>
          </div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--c-bark);line-height:1.7;">
            <li>Preservar hero art en detail header (backdrop blur + poster nítido)</li>
            <li>Header sticky colapsable (condensa en scroll)</li>
            <li>Section stagger al entrar (delay = i × 60ms)</li>
            <li>Sources con favicon via Google S2 + thumbnail</li>
            <li>Video embed inline (YouTube iframe + thumbnail preview)</li>
            <li>Empty state para <code>detail.sections === []</code></li>
            <li>Toast de feedback post-Save ("Guardado en Recetas ✓")</li>
            <li>Fix pitch header colores swappeados</li>
            <li>Fix player names a 10px con ellipsis mejorado</li>
            <li>Scroller con snap + peek hint + page dots</li>
            <li>Fix <code>kind: text</code> conversión de <code>\\n\\n</code> a <code>&lt;p&gt;</code></li>
            <li>Blobs como <code>position: fixed</code> al overlay externo</li>
          </ul>
        </div>

        <div style="background:linear-gradient(135deg,#fff 0%,#faf8ff 100%);border-radius:16px;padding:20px;border:1px solid var(--c-sand);border-left:5px solid var(--k-emerald);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;">
            <div style="display:flex;align-items:center;gap:11px;">
              <div style="width:40px;height:40px;border-radius:11px;background:rgba(45,106,79,0.12);color:var(--k-emerald);display:grid;place-items:center;font-family:var(--t-display);font-weight:800;font-size:16px;">4</div>
              <div><div style="font-size:10.5px;font-weight:700;color:var(--k-emerald);letter-spacing:0.08em;text-transform:uppercase;">Semanas 10-12 · Create + Collections unificado</div><strong style="font-size:14.5px;color:var(--c-bark);">Kind coloring + search + FAB</strong></div>
            </div>
            <span class="pill emerald"><span class="material-symbols-outlined">check_circle</span> 14 issues</span>
          </div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--c-bark);line-height:1.7;">
            <li>Unificar paleta de Create con catálogo A (5 templates → 5 acentos del set)</li>
            <li>Aplicar kind coloring en Collections rows (accent del kind del registro)</li>
            <li>Search bar sticky en Collections</li>
            <li>FAB "+" para crear nuevo desde Collections</li>
            <li>Reemplazar truncación a 12 rows con paginación "Ver N más"</li>
            <li>Fix menu <code>more_vert</code> clipping (mover popover a portal)</li>
            <li>Unificar input styles (lilac border + white bg + 15px)</li>
            <li>Unificar H1 typography (Bricolage Grotesque 28px)</li>
            <li>Editor inline capaz de editar url y amount</li>
            <li>Transition spring entre picker y form (fade + slide horizontal)</li>
            <li>Empty state enriquecido con ilustración + CTA</li>
            <li>Focus trap + <code>aria-modal</code> + Escape handling</li>
            <li>Mover <code>autoFocus</code> del botón destructivo al cancel</li>
            <li>Fix <code>kind: "nota"</code> mapping en <code>createRecord</code></li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ============ CLOSING ============ -->
    <section class="section" id="closing">
      <div class="section-tag reveal">
        <span class="material-symbols-outlined">flag</span>
        09 · Cierre
      </div>
      <h2 class="section-title reveal">
        Koru ya es bueno. <span class="accent">Tier S lo hace inolvidable</span>.
      </h2>
      <p class="section-lead reveal" data-delay="1">
        Este informe v2 corrige los 3 fallos de v1: <strong>paleta respetada al 100%</strong> (Brand Bible extraída
        de tokens reales), <strong>cada card con su estado extendido</strong> (26 cards × 2 estados = 52 mockups),
        y <strong>110 microdetalles + 36 animaciones</strong> que dan vida a cada interacción. Todo dentro del
        lenguaje lavanda-violeta cálido-mágico que hace a Koru reconocible.
      </p>

      <div class="reveal" data-delay="2" style="background:linear-gradient(135deg,#2e2650 0%,#453f6a 100%);border-radius:22px;padding:36px;color:#fff;position:relative;overflow:hidden;margin-top:28px;">
        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(131,99,249,0.4),transparent 70%);filter:blur(36px);"></div>
        <div style="position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(224,163,214,0.3),transparent 70%);filter:blur(36px);"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:18px;">
            <div style="width:44px;height:44px;border-radius:13px;background:radial-gradient(circle at 30% 30%,#c9bdf5 0%,#8363f9 50%,#523a9e 100%);display:grid;place-items:center;box-shadow:0 0 20px rgba(131,99,249,0.5);animation:koru-breathe 4s ease-in-out infinite;">
              <span class="material-symbols-outlined ms-fill" style="color:#fff;font-size:22px;">auto_awesome</span>
            </div>
            <div><div style="font-family:var(--t-display);font-size:20px;font-weight:800;letter-spacing:-0.02em;">Próximos pasos</div><div style="font-size:11.5px;color:rgba(239,234,251,0.6);">Lo que recomiendo hacer primero</div></div>
          </div>
          <ol style="margin:0;padding-left:22px;font-size:13px;line-height:1.8;color:rgba(239,234,251,0.9);">
            <li><strong style="color:#c9bdf5;">Semana 1:</strong> Fix los 8 issues críticos (sticky, chips collision, sheet-up animation, grayscale removal).</li>
            <li><strong style="color:#c9bdf5;">Semana 2:</strong> Agregar los 6 keyframes nuevos + extender type KoruPresentation con campos opcionales.</li>
            <li><strong style="color:#c9bdf5;">Semana 3:</strong> Migrar weather a layout spotlight + count-up. Primer rediseño visible en producción.</li>
            <li><strong style="color:#c9bdf5;">Semana 4-6:</strong> Migrar recipe, live_match, movie_review. Implementar hero art preserved en detail.</li>
            <li><strong style="color:#c9bdf5;">Semana 7-9:</strong> Sources con favicons + video embed inline + section stagger.</li>
            <li><strong style="color:#c9bdf5;">Semana 10-12:</strong> Unificar Create + Collections con kind coloring + search + FAB.</li>
          </ol>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:13px;margin-top:28px;" class="reveal" data-delay="3">
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--kp);">schedule</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">12</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Semanas</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--k-pink);">collections</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">26</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Cards rediseñadas</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--k-amber-text);">fullscreen</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">52</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Mockups (compact+ext)</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--k-emerald);">animation</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">36</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Animaciones</div>
        </div>
        <div style="background:#fff;border-radius:13px;padding:16px;border:1px solid var(--c-sand);text-align:center;">
          <span class="material-symbols-outlined" style="font-size:28px;color:var(--kp);">deblur</span>
          <div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);margin-top:5px;">110</div>
          <div style="font-size:10.5px;color:var(--c-earth);letter-spacing:0.06em;text-transform:uppercase;">Microdetalles</div>
        </div>
      </div>

      <div style="margin-top:40px;padding-top:28px;border-top:1px solid var(--c-sand);text-align:center;color:var(--c-earth);font-size:11.5px;" class="reveal" data-delay="4">
        <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:7px;">
          <div style="width:22px;height:22px;border-radius:7px;background:radial-gradient(circle at 30% 30%,#c9bdf5 0%,#8363f9 50%,#523a9e 100%);display:grid;place-items:center;animation:koru-breathe 4s ease-in-out infinite;">
            <span class="material-symbols-outlined ms-fill" style="color:#fff;font-size:11px;">auto_awesome</span>
          </div>
          <strong style="color:var(--kp-deep);font-family:var(--t-display);">Koru · UI Audit v2 · Tier S</strong>
        </div>
        <div>Auditoría orchestrada con 6 agentes paralelos · brand guardian + motion + cards + extensions + microdetalles + research</div>
        <div style="margin-top:3px;">Versión v2 · 2026-07-16 · github.com/Arx88/koru-mvp</div>
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

  // Count-up loop for animation catalog demo
  (function() {
    var loops = document.querySelectorAll('.count-up-loop');
    if (!loops.length) return;
    loops.forEach(function(el) {
      var target = parseInt(el.dataset.target || '23', 10);
      var suffix = el.dataset.suffix || '';
      var current = 0;
      var direction = 1;
      function tick() {
        current += direction * (target / 60);
        if (current >= target) { current = target; direction = -1; }
        if (current <= 0) { current = 0; direction = 1; }
        el.textContent = Math.round(current) + suffix;
      }
      setInterval(tick, 25);
    });
  })();
</script>

</body>
</html>
''')

# Write to file
output = '\n'.join(html_parts)
with open('/home/z/my-project/download/koru-ui-audit-v2-cards.html', 'w', encoding='utf-8') as f:
    f.write(output)

print(f"Generated {len(html_parts)} HTML parts")
print(f"Cards rendered: {len(CARDS)}")
print(f"Groups: {len(GROUPS_ORDER)}")
print(f"Output: /home/z/my-project/download/koru-ui-audit-v2-cards.html")
print(f"Size: {len(output)} chars")
