# MASTER CARD INVENTORY — Koru Presentation Layer

> **Source of truth:** `src/ui/cards/unified/presentation.ts` (2,621 lines, 51 mapper functions).
> **Purpose:** Deep audit of every UiBlock → KoruPresentation mapping. Drives the entire redesign document.
> **Architecture:** Every card collapses to a single mold (`hero` sheet + `detail` screen of magical-cards). No card keeps its own aesthetic — all forced through the Stitch "Creando Plan / Plan Entregado" template.

---

## TABLE OF CONTENTS

1. [System Model Recap](#1-system-model-recap)
2. [The 51 Existing Cards — Deep Audit](#2-the-51-existing-cards--deep-audit)
3. [User-Mentioned Cards — Coverage Map](#3-user-mentioned-cards--coverage-map)
4. [Proposed NEW Cards (10)](#4-proposed-new-cards-10)
5. [Categorized Master Inventory (61 cards across 11 groups)](#5-categorized-master-inventory-61-cards-across-11-groups)
6. [Cross-Cutting Patterns & Code Smells](#6-cross-cutting-patterns--code-smells)
7. [Next Actions for the Redesign](#7-next-actions-for-the-redesign)

---

## 1. System Model Recap

Every card is shaped by a single `KoruPresentation` type:

```ts
KoruPresentation = {
  hero: {
    kicker, title, desc?, icon, accent{color,soft},
    art?, artAspect?("square"|"poster"|"cover"), artValue?, metrics?[3]
  },
  detail?: { title, subtitle?, sections[] },   // 8 section kinds
  cta?: { label, screen?("collections"), collection? },
  actions?: [{ label, icon?, kind?, action }],  // inline hero buttons (no detail screen)
  empty?: { reason, icon? }                      // graceful degradation
}
```

**Detail section kinds** (`DetailSection.kind`):
`text` · `tiles` · `rows` · `chips` · `scroller` · `timeline` · `sources` · `pitch`

**Accent palette** (`A.*`): violet · primary · purple · emerald · amber · blue · sky · rose · pink · indigo · red (11 swatches).

**Action-only cards** (4 cards): `alarm`, `reminder`, `urgent_now`, `health_reminder`. These deliberately omit `detail` and render only inline hero buttons — they're surface-mortal otherwise.

**Empty-state cards** (1 card only): `comparison`. The only mapper that returns an `empty` object. **Gap:** 50 cards silently render broken heroes when data is missing.

---

## 2. The 51 Existing Cards — Deep Audit

### Card 1 — `deliverable` (deep research report)
- **Source fields:** `kicker`, `title`, `description`, `summary`, `sections[{kind: "timeline"|"grid"|"rows", title, kicker, icon, items[{title, subtitle, badge, icon}], bullets[], paragraphs[]}]`, `sources`, `metrics[{label, value}]`, `categories[{icon, label, color}]`
- **Hero recipe:**
  - kicker: `clean(b.kicker) || "Tu Informe"`
  - title: `UPPER(b.title || "Informe")`
  - desc: `b.description`
  - icon: `"auto_awesome"`
  - accent: **violet**
  - art: dynamically chosen from `/stitch/icons/*.png` based on kicker keywords (sports/search/finance/travel/etc.) — **smart art**
  - metrics: real `b.metrics` (first 3) or category chips fallback
- **Detail recipe:** `text "Síntesis"` + per-section `timeline`/`chips`/`rows`/`text` (rotating accent: amber → primary → emerald → pink → purple) + `sources "Fuentes"`
- **CTA:** `"Ver {kicker.toLowerCase()} completo"` (only if sections exist)
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When the user runs a deep research report (`mode="research"`). Koru's flagship card type.

---

### Card 2 — `clarifying_question`
- **Source fields:** `title`, `question`, `options[]`
- **Hero recipe:** kicker `"Una pregunta"`, title `heroTitleFrom(b.title, "Necesito un dato")`, desc `b.question`, icon `"help"`, accent **violet**
- **Detail recipe:** `chips "Opciones"` (one chip per option) — only if `options?.length`
- **CTA:** `"Responder"` (only if options)
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru needs more info before completing a task ("¿Cuántas personas?" etc.)

---

### Card 3 — `weather`
- **Source fields:** `city`, `now`, `condition`, `range`, `humidity`, `wind`, `rain`, `feel`, `uv`, `advice`, `sources`
- **Hero recipe:**
  - kicker: `"Tu Clima · {city}"` or `"Tu Clima"`
  - title: `heroTitleFrom(b.condition, "Pronóstico")`
  - desc: `b.advice`
  - icon: **dynamic** — `rainy`/`ac_unit`/`cloud`/`thunderstorm`/`foggy`/`wb_sunny`/`partly_cloudy_day` based on condition regex
  - accent: **dynamic** — rain=blue, snow=primary, sun=amber, default=primary
  - artValue: `b.now` (the big temperature)
  - metrics: first 3 of [range, humidity, wind, rain]
- **Detail recipe:** `text "Recomendación"` (if advice) + `tiles "Condiciones actuales"` (feel/range/humidity/wind/rain/uv) + `sources`
- **CTA:** `"Ver detalle"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about weather ("¿llueve hoy?"); also embedded in morning brief.

---

### Card 4 — `alarm` ⚡ ACTION-ONLY
- **Source fields:** `title`, `time`, `repeat`, `note`
- **Hero recipe:** kicker `"Alarma"`, title `heroTitleFrom(b.title, "Alarma")`, desc `"Se repite: {repeat} · {note}"`, icon `"alarm"`, accent **rose**, artValue `b.time`
- **Detail recipe:** None
- **CTA:** None
- **Has actions[]?** YES — `[{label:"Apagar", icon:"alarm_off", kind:"primary", action:"dismiss"}, {label:"Postergar 10 min", icon:"snooze", kind:"secondary", action:"snooze"}]`
- **Empty state:** No
- **User context:** When an alarm fires (scheduled by user or routine).

---

### Card 5 — `reminder` ⚡ ACTION-ONLY
- **Source fields:** `title`, `dueText`, `note`
- **Hero recipe:** kicker `"Recordatorio"`, title `heroTitleFrom(b.title, "Recordatorio")`, desc `"{dueText} · {note}"`, icon `"notifications"`, accent **emerald**, artValue `dueText`
- **Detail recipe:** None
- **CTA:** None
- **Has actions[]?** YES — `[{label:"Listo", icon:"check", kind:"primary", action:"complete"}, {label:"Posponer", icon:"snooze", kind:"secondary", action:"snooze"}]`
- **Empty state:** No
- **User context:** When a reminder fires (manual or proactive).

---

### Card 6 — `shopping_list`
- **Source fields:** `title`, `items[]`, `dueText`, `quantities{item:qty}`, `checked[]`
- **Hero recipe:** kicker `"Tu Lista"`, title `heroTitleFrom(b.title, "Compras")`, desc `dueText || "{n} ítems para llevar"`, icon `"shopping_cart"`, accent **amber**, metrics (first 3 items as unchecked chips + "+N más")
- **Detail recipe:** `rows "Ítems"` — each row: checkbox icon, title, qty meta, "Listo" badge if checked
- **CTA:** `"Ver lista"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User creates/shares a shopping list ("comprar: pan, leche, huevos").

---

### Card 7 — `comparison`
- **Source fields:** `title`, `recommendation`, `criteria` (string or string[]), `items[{title, score, price, vendor, evidence, url, details[{label, positive}]}]`, `sources`
- **Hero recipe:** kicker `"Tu Comparación"`, title `heroTitleFrom(b.title, "Opciones")`, desc `recommendation || "{n} opciones analizadas"`, icon `"balance"`, accent **pink**, metrics (options count)
- **Detail recipe:** `scroller "Opciones"` (top item gets "Mejor puntaje" badge) + `rows "Pros y Contras"` (Pro/Contra badges per item) + `sources`
- **CTA:** `"Ver comparación"`
- **Has actions[]?** No
- **Empty state:** ✅ YES — `"No tengo opciones para comparar todavía. Pedime algo específico."`, icon `"search_off"`
- **User context:** User asks to compare ("¿cuál notebook conviene?").

---

### Card 8 — `research_sources`
- **Source fields:** `mode` ("research"|"quick"), `title`, `summary`, `sources`, `followUpQuestion`
- **Hero recipe:** kicker mode-based ("Tu Informe"/"Tu Búsqueda"), title `heroTitleFrom(b.title, ...)`, desc truncated summary (140 chars), icon mode-based (`menu_book`/`travel_explore`), accent **purple**, metrics (sources count)
- **Detail recipe:** `text "Síntesis"` + `sources "Fuentes"`
- **CTA:** `"Ver informe completo"` or `"Ver resultados"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User runs a web search or research mode. **Note:** This is what the user calls "Deepsearches".

---

### Card 9 — `money_summary`
- **Source fields:** `title`, `total`, `currency`, `recommendation`, `summaryItems[{label, value}]`
- **Hero recipe:** kicker `"Tus Finanzas"`, title `heroTitleFrom(b.title, "Resumen")`, desc count or recommendation, icon `"payments"`, accent **emerald**, artValue formatted total (`Intl.NumberFormat("es-AR")`), metrics (movimientos count + categoría if recommendation ≤30 chars)
- **Detail recipe:** `tiles "Detalle"` (summaryItems)
- **CTA:** `"Ver detalle"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about finances/expenses ("¿cuánto gasté este mes?").

---

### Card 10 — `saved_record`
- **Source fields:** `records[{title, notes, value, collection, url}]`
- **Hero recipe:** kicker `"Guardado en {collection}"` or `"Guardado"`, title collection or first.title or `"Registro"`, desc deduped title/notes/value (case-insensitive + accent-insensitive dedup), icon `link` (if URL) or `bookmark`, accent **violet**
- **Detail recipe:** None
- **CTA:** `"Ver colección"` or `"Ver mis guardados"` with `screen: "collections"` + `collection` ref
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks to save something ("guardá este link"). Bridged into the Collections screen.

---

### Card 11 — `activity_group`
- **Source fields:** `title`, `subtitle`, `note`, `energy{label, value}`, `sections[{title, tone, tiles[{label, value}], rows[{title, detail, meta, urgent}]}]`
- **Hero recipe:** kicker subtitle or `"Tu Resumen"`, title, desc note, icon `"dashboard"`, accent **primary**, metrics (energy %)
- **Detail recipe:** Per-section `tiles` or `rows` — accent mapped from tone (green→emerald, blue→blue, amber→amber, purple→purple, red→red, neutral→primary), urgent badge
- **CTA:** `"Ver resumen"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru surfaces a grouped daily activity dashboard (energy + tasks + alerts).

---

### Card 12 — `proactive_signal`
- **Source fields:** `severity` ("urgent"|"important"|other), `timestampLabel`, `title`, `body`, `summaryItems`, `sources`, `followUpQuestion`, `actionLabel`
- **Hero recipe:** kicker `timestampLabel || "Señal"`, title, desc body, icon `priority_high` if urgent else `lightbulb`, accent **amber** if urgent else **purple**, metrics (summaryItems)
- **Detail recipe:** `text "Detalle"` + `sources`
- **CTA:** `actionLabel || "Ver más"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru proactively surfaces a tip or signal (price drop, traffic, etc.).

---

### Card 13 — `resource_bundle`
- **Source fields:** `title`, `summary`, `files[{name, kind, sizeLabel}]`
- **Hero recipe:** kicker `"Tus Archivos"`, title, desc summary or `"{n} archivos listos"`, icon `"folder"`, accent **indigo**, metrics (file count)
- **Detail recipe:** `rows "Descargas"` (file icon, name, kind·size detail)
- **CTA:** `"Ver archivos"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru delivers a bundle of downloadable files.

---

### Card 14 — `web_nav`
- **Source fields:** `status` ("report"|"search"), `title`, `query`, `summary`, `findings[]`, `results[{title, url, snippet, readTime, source, type ("article"|"pdf"|"page"|"description")}]`
- **Hero recipe:** kicker status-based, title `heroTitleFrom(b.title ?? b.query, ...)`, desc summary, icon `menu_book`/`travel_explore`, accent **purple**, metrics (results count)
- **Detail recipe:** `text "Síntesis"` + `rows "Hallazgos clave"` (check_circle icon) + `rows "Fuentes"` (type-based icons: pdf/article/page/description, snippet+readTime detail)
- **CTA:** `"Ver informe completo"` or `"Ver resultados"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User does a web navigation/search with result aggregation.

---

### Card 15 — `data_card`
- **Source fields:** `title`, `items[{label, value, sourceDomain, quote}]`
- **Hero recipe:** kicker `"Tus Datos"`, title, desc count or `first.label: first.value`, icon `"verified"`, accent **emerald**, metrics (first 3 items)
- **Detail recipe:** `rows "Datos verificados"` (with "Con cita" badge for items with quotes) + `rows "Citas literales"` (filter items with quote — shows literal evidence)
- **CTA:** `"Ver todos"` (only if >3 items)
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru returns verified facts/data with citations (e.g., election stats, sports records).

---

### Card 16 — `restaurant_synthesis`
- **Source fields:** `title`, `query`, `mood`, `status` ("partial"|"failed"|ok), `pros`, `cons`, `synthesis`, `note`, `matches[{name, quote, rating, sourcesMentioning, imageUrl}]`, `sources`, `topScore`, `labels{i18n}`
- **Hero recipe:** kicker `"Tu Recomendación" + status label` (partial/failed), title, desc synthesis or note or `"Para: {mood}"`, icon `"restaurant"`, accent **amber**, metrics (matches count)
- **Detail recipe:** `text "Tu búsqueda"` (if mood) → `scroller "Top coincidencias"` (with rating stars, "Top" badge on first) → `rows "Pros y Contras"` → `text synthesis` → `sources`
- **CTA:** `"Ver recomendación"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks for restaurant recommendations ("mejor parrilla en Palermo").

---

### Card 17 — `morning_brief`
- **Source fields:** `greeting`, `items[{label, value, icon, iconColor}]`
- **Hero recipe:** kicker `"Buenos días"`, title `heroTitleFrom(greeting, "Tu Resumen")`, desc first item label:value, icon `"wb_sunny"`, accent **amber**, metrics (first 3 items with their own icon + iconColor)
- **Detail recipe:** `tiles "Tu día"` (all items)
- **CTA:** `"Ver todo"` (only if >3 items)
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Morning daily brief — aggregated summary pushed at wake-up.

---

### Card 18 — `wellbeing`
- **Source fields:** `title`, `sleep{icon, label, value}`, `suggestion{icon, label, value}`, `sections[{icon, label, value, iconColor}]`
- **Hero recipe:** kicker `"Tu Bienestar"`, title, desc `suggestion.label`, icon `"favorite"`, accent **purple**, metrics (sleep + suggestion + sections, first 3)
- **Detail recipe:** `tiles "Detalle"` (all tiles)
- **CTA:** `"Ver detalle"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Wellbeing/health summary (sleep, mood, suggestion).

---

### Card 19 — `live_match` ⚽ FLAGSHIP SPORTS CARD
- **Source fields:** `homeName`, `awayName`, `homeTeam{}`, `awayTeam{}`, `homeScore`, `awayScore`, `league`, `status`, `minute`, `venue`, `venueCity`, `goals[{scorer, minute, team}]`, `yellowCards[]`, `redCards[]`, `substitutions[]`, `detailedStats[{label, home, away, isPercent}]`, `stats[{label, leftPercent, rightPercent}]`, `lineups{homeFormation, awayFormation, starters[]}`, `homeColor`, `awayColor`
- **Hero recipe:**
  - kicker: `"En vivo · {league}"` (if live) or `"{league} · {status}"`
  - title: `UPPER("{home} vs {away}")`
  - desc: `"Minuto {minute}"` (if live) or `"Próximamente"` (scheduled) or `"Final"`
  - icon: `"sports_soccer"`
  - accent: **red** if live, **emerald** otherwise
  - artValue: score `"2 - 1"`
  - metrics: top 3 of detailedStats filtered by ["Posesión", "Tiros", "Tiros al arco", "Córners", "Faltas"]
- **Detail recipe (richest in the system):**
  - `timeline "Resumen del partido"` — **MERGED events** (goals + yellow + red + subs) sorted by minute, with icon/badge per type
  - `rows "Estadísticas clave"` — top 4 priority stats with **comparative bars** (homeValue/awayValue/homeColor/awayColor)
  - `rows "Más estadísticas"` — collapsible rest of stats
  - `pitch "Alineaciones"` — visual pitch with formations + dots
- **CTA:** `"Ver partido completo"` (if rich) or `"Ver estadísticas"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about a football match ("¿cómo va Boca-River?").

---

### Card 20 — `urgent_now` ⚡ ACTION-ONLY
- **Source fields:** `eyebrow`, `headline`, `description`, `icon`
- **Hero recipe:** kicker `eyebrow || "Urgente · Ahora"`, title `heroTitleFrom(b.headline, "Aviso")`, desc description, icon `b.icon || "priority_high"`, accent **red**
- **Detail recipe:** None
- **CTA:** None
- **Has actions[]?** YES — `[{label:"Entendido", icon:"check", kind:"primary", action:"dismiss"}, {label:"Recordarme", icon:"snooze", kind:"secondary", action:"snooze"}]`
- **Empty state:** No
- **User context:** When Koru surfaces an urgent notification (breaking news, critical alert). **Note:** This is what the user calls "Noticias urgentes".

---

### Card 21 — `market`
- **Source fields:** `title`, `assets[{symbol, name, price, change, changeUp}]`
- **Hero recipe:** kicker `"Mercados"`, title `heroTitleFrom(b.title ?? first.symbol, "Mercado")`, desc `first.name · first.change`, icon `"trending_up"`, accent **emerald**, artValue `first.price`, metrics (first 3 assets with trend icon)
- **Detail recipe:** `rows "Activos"` (name, price, change, done/urgent badge based on changeUp)
- **CTA:** `"Ver mercados"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about market/stock info ("¿cómo está el MERVAL?").

---

### Card 22 — `delivery`
- **Source fields:** `title`, `status`, `estimatedDate`, `carrier`, `trackingId`, `steps[{label, done}]`
- **Hero recipe:** kicker `"Tu Envío"`, title, desc `status · estimatedDate`, icon `"local_shipping"`, accent **indigo**
- **Detail recipe:** `timeline "Seguimiento"` (steps with done/pending status)
- **CTA:** `"Ver seguimiento"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User tracks a package delivery.

---

### Card 23 — `health_reminder` ⚡ ACTION-ONLY
- **Source fields:** `title`, `reminder`, `icon`
- **Hero recipe:** kicker `"Salud · Recordatorio"`, title, desc reminder, icon `b.icon || "medication"`, accent **rose**
- **Detail recipe:** None
- **CTA:** None
- **Has actions[]?** YES — `[{label:"Tomé la dosis", icon:"check", kind:"primary", action:"complete"}, {label:"Posponer", icon:"snooze", kind:"secondary", action:"snooze"}]`
- **Empty state:** No
- **User context:** Health reminder fires (medication dose, water, etc.).

---

### Card 24 — `activity_tracker`
- **Source fields:** `title`, `subtitle`, `metrics[{icon, label, value, unit, iconColor}]`
- **Hero recipe:** kicker `"Tu Actividad"`, title, desc subtitle, icon `"monitoring"`, accent **emerald**, metrics (first 3 with units)
- **Detail recipe:** `tiles "Métricas"` (all metrics)
- **CTA:** `"Ver métricas"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces fitness/activity tracker data (steps, heart rate, calories).

---

### Card 25 — `product_analysis`
- **Source fields:** `product{name, description, icon, rating, reviewCount}`, `specs[{label, value}]`, `actionLabel`
- **Hero recipe:** kicker `"Tu Análisis"`, title `product.name`, desc `product.description`, icon `product.icon || "inventory_2"`, accent **primary**, metrics (rating)
- **Detail recipe:** `tiles "Especificaciones"` (specs)
- **CTA:** `actionLabel || "Ver opciones"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks to analyze a single product in depth ("¿qué tal el iPhone 16?").

---

### Card 26 — `travel_planner`
- **Source fields:** `destination`, `dates`, `steps[{icon, label, time, detail}]`, `actionLabel`
- **Hero recipe:** kicker `"Tu Viaje"`, title `heroTitleFrom(b.destination, "Itinerario")`, desc dates, icon `"flight_takeoff"`, accent **sky**, metrics (steps count)
- **Detail recipe:** `timeline "Itinerario"` (step icon, label, time·detail)
- **CTA:** `actionLabel || "Ver itinerario"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User plans a trip ("armame un itinerario para Madrid"). **Note:** This is what the user calls "Planificación de viajes".

---

### Card 27 — `generation`
- **Source fields:** `resultType` ("text"|"image"|"code"|"document"), `title`, `prompt`, `preview`, `actionLabel`
- **Hero recipe:** kicker type-based ("Tu Texto"/"Tu Imagen"/"Tu Código"/"Tu Documento"), title, desc prompt, icon type-based (`code`/`image`/`auto_awesome`), accent **violet**
- **Detail recipe:** `text "Vista previa"` (preview body)
- **CTA:** `actionLabel || "Ver resultado"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Koru generates text/image/code/document. **Note:** This is what the user calls "Creación de imágenes".

---

### Card 28 — `match_timeline`
- **Source fields:** `title`, `items[{minute, text, sub, now}]`
- **Hero recipe:** kicker `"Fixture · En vivo"`, title (dynamic, not hardcoded), desc first item minute+text, icon `"sports_soccer"`, accent **emerald**
- **Detail recipe:** `timeline "Cronología"` (minute+text, status current if `now`)
- **CTA:** `"Ver cronología"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about match events timeline (after final whistle).

---

### Card 29 — `match_stats`
- **Source fields:** `title`, `stats[{label, home, away}]`, `homeColor`, `awayColor`
- **Hero recipe:** kicker `"Estadísticas"`, title, desc first.label: home—away, icon `"monitoring"`, accent **primary**
- **Detail recipe:** `rows "Comparativa"` (with **comparative bar** — isPercent auto-detected by label regex /pos|posesi|precisi|efectiv/i)
- **CTA:** `"Ver estadísticas"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about match statistics specifically.

---

### Card 30 — `election_results`
- **Source fields:** `title`, `status`, `items[{name, percent, detail, done, color}]`
- **Hero recipe:** kicker `"Escrutinio"`, title, desc status or first.name:percent, icon `"how_to_vote"`, accent **amber**
- **Detail recipe:** `rows "Candidatos"` (name, percent meta, "Ganador"/"Pendiente" badge, **bar** for visual share)
- **CTA:** `"Ver escrutinio"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about election results.

---

### Card 31 — `election_vote`
- **Source fields:** `question`, `subtitle`, `options[{label, sub}]`
- **Hero recipe:** kicker `"Tu Voto"`, title `heroTitleFrom(b.question, "Votación")`, desc subtitle, icon `"ballot"`, accent **violet**
- **Detail recipe:** `chips "Opciones"` (label, sub)
- **CTA:** `"Confirmar voto"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User participates in a vote/poll (internal Koru feature or survey).

---

### Card 32 — `decision_support`
- **Source fields:** `title`, `recommendation`, `options[{label, probability}]`, `factors[]`
- **Hero recipe:** kicker `"Tu Decisión"`, title, desc recommendation or top.label+probability, icon `"balance"`, accent **indigo**, metrics (options count + factors count)
- **Detail recipe:** `rows "Opciones"` (probability % as meta, "Principal" badge on top) + `chips "Factores"` (factors)
- **CTA:** `"Ver análisis"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks Koru to help decide between options ("¿me conviene mudarme?").

---

### Card 33 — `memory`
- **Source fields:** `title`, `note`, `items[{title, detail, confidence, domain}]`
- **Hero recipe:** kicker `"Memoria"`, title, desc note or first.detail, icon `"psychology"`, accent **violet**, metrics (items count + first.domain)
- **Detail recipe:** `rows "Recuerdos"` (title, detail, confidence %, domain badge) + `text "Nota"` (if note)
- **CTA:** `"Ver memoria"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru recalls stored memory/context. **Note:** This is what the user calls "Pantallas de memoria".

---

### Card 34 — `data_ticker`
- **Source fields:** `title`, `alert`, `items[{label, value, highlight}]`
- **Hero recipe:** kicker `"Tendencias"`, title `heroTitleFrom(b.title ?? first.label, "Tendencias")`, desc alert or first.label:value, icon `"insights"`, accent **primary**, metrics (first 3 items)
- **Detail recipe:** `rows "Datos"` (highlight badge "Destacado")
- **CTA:** `"Ver datos"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces live data trends (trending topics, stock movements).

---

### Card 35 — `crypto_portfolio`
- **Source fields:** `title`, `items[{name, symbol, price, change, char}]`
- **Hero recipe:** kicker `"Tu Portafolio"`, title, desc first.name · price, icon `"currency_bitcoin"`, accent **amber**, metrics (avg change % + top 2 items with trend icon)
- **Detail recipe:** `rows "Activos"` (coin char icon, name, price, change %, "Sube"/"Baja" badge)
- **CTA:** `"Ver portafolio"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about crypto portfolio ("¿cómo está mi BTC?").

---

### Card 36 — `forex`
- **Source fields:** `title`, `items[{pair, rate, change, positive}]`
- **Hero recipe:** kicker `"Divisas"`, title, desc first.pair · rate, icon `"currency_exchange"`, accent **primary**, metrics (first 3 pairs)
- **Detail recipe:** `rows "Pares"` (pair, rate, change %, done/urgent badge)
- **CTA:** `"Ver divisas"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about forex/exchange rates ("¿a cuánto está el dólar?").

---

### Card 37 — `route_timeline`
- **Source fields:** `eta`, `items[{label, detail}]`
- **Hero recipe:** kicker `eta ? "Ruta · ETA {eta}" : "Tu Ruta"`, title **"RUTA"** (hardcoded uppercase), desc first.label, icon `"route"`, accent **indigo**
- **Detail recipe:** `timeline "Recorrido"` (label, detail)
- **CTA:** `"Iniciar GPS"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User navigates a multi-step route.

---

### Card 38 — `transport_compare`
- **Source fields:** `items[{mode, time, icon, active}]`
- **Hero recipe:** kicker `"Comparativa"`, title **"TRANSPORTE"** (hardcoded uppercase), desc active.mode · time, icon `"commute"`, accent **amber**, metrics (first 3 modes)
- **Detail recipe:** `rows "Opciones"` (icon, mode, time meta, current badge if active)
- **CTA:** `"Ver opciones"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Comparing transport options (car vs bus vs subway).

---

### Card 39 — `route_map`
- **Source fields:** `from`, `to`, `distance`, `remaining`, `progress`
- **Hero recipe:** kicker `"Tu Mapa"`, title `heroTitleFrom(b.to, "Ruta")`, desc `Desde {from} · {distance} · {remaining} restante`, icon `"map"`, accent **indigo**, artValue progress % (with bug fix: 0.45 → "45%"), metrics (distance + progress %)
- **Detail recipe:** `rows "Detalle del viaje"` (origin, destination, distance, remaining, progress with "Casi listo" badge if ≥80%)
- **CTA:** `"Ver detalle"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User navigates with active map view.

---

### Card 40 — `birthday_calendar`
- **Source fields:** `month`, `highlightedDay`, `startDay`, `daysInMonth`
- **Hero recipe:** kicker `"Calendario"`, title month, desc `"Día destacado: {n}"`, icon `"calendar_month"`, accent **pink**, artValue highlightedDay, metrics (month + day)
- **Detail recipe:** `chips "Calendario del mes"` — each chip = one day of the month (simulated calendar grid via flex-wrap)
- **CTA:** `"Ver calendario"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces a birthday calendar month view.

---

### Card 41 — `birthday_alarm`
- **Source fields:** `name`, `date`, `eta`, `countdown`, `unit`
- **Hero recipe:** kicker `eta ? "Alarma · {eta}" : "Cumpleaños"`, title `heroTitleFrom(b.name, "Cumpleaños")`, desc date, icon `"cake"`, accent **amber**, artValue `{countdown} {unit}`
- **Detail recipe:** None
- **CTA:** None
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Birthday alarm fires (countdown to birthday).

---

### Card 42 — `social_interaction`
- **Source fields:** `name`, `date`, `age`, `remaining`, `gifts[{emoji, title, detail}]`
- **Hero recipe:** kicker `"Social · Hoy"`, title `heroTitleFrom(b.name, "Cumpleaños")`, desc `date · age · remaining`, icon `"celebration"`, accent **pink**
- **Detail recipe:** `scroller "Ideas de regalo"` (emoji+title, detail)
- **CTA:** `"Ver ideas"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces social events (someone's birthday + gift suggestions).

---

### Card 43 — `smart_checklist`
- **Source fields:** `title`, `items[{label, checked}]`, `progress`
- **Hero recipe:** kicker `"Tu Checklist"`, title, desc `"{done} de {total} completados"`, icon `"checklist"`, accent **violet**, metrics (progress %)
- **Detail recipe:** `rows "Tareas"` (checkbox icon, label, "Listo" badge if checked)
- **CTA:** `"Ver checklist"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User creates/uses a checklist (tasks, todos).

---

### Card 44 — `outfit`
- **Source fields:** `title`, `specs[{emoji, label, value}]`, `buttonLabel`
- **Hero recipe:** kicker `"Tu Look"`, title, desc `first.label: first.value`, icon `"checkroom"`, accent **amber**, metrics (first 3 specs)
- **Detail recipe:** `tiles "Detalles"` (emoji+label, value)
- **CTA:** `buttonLabel || "Ver look"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Koru suggests an outfit for the day.

---

### Card 45 — `review_score`
- **Source fields:** `title`, `items[{emoji, label, score, color}]`, `buttonLabel`
- **Hero recipe:** kicker `"Tu Reseña"`, title, desc `first.label: first.score`, icon `"reviews"`, accent **violet**, metrics (first 3 items with custom color)
- **Detail recipe:** `tiles "Puntajes"` (emoji+label, score)
- **CTA:** `buttonLabel || "Ver reseña"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces review scores (Rotten Tomatoes, IMDb aggregated).

---

### Card 46 — `review_document`
- **Source fields:** `title`, `body`
- **Hero recipe:** kicker `"Veredicto"`, title, desc `body[:140]`, icon `"description"`, accent **primary**
- **Detail recipe:** `text "Análisis"` (full body)
- **CTA:** `"Leer veredicto"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces a review document/verdict (full text analysis).

---

### Card 47 — `review_quote`
- **Source fields:** `sourceName`, `sourceType`, `quote`, `tags[]`, `buttonLabel`
- **Hero recipe:** kicker `"Veredicto final"`, title `heroTitleFrom(b.sourceName, "Opinión")`, desc quote, icon `"format_quote"`, accent **purple**
- **Detail recipe:** `text "Cita"` + `chips "Etiquetas"` (if tags)
- **CTA:** `buttonLabel || "Ver opinión"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** Surfaces a critic's pull quote (e.g., "Una obra maestra" — Sight & Sound).

---

### Card 48 — `recipe`
- **Source fields:** `name`/`title`, `description`, `image`, `category`, `area`, `ingredients[{ingredient, measure}]`, `steps[{step, text}]`, `instructions`, `tips[]`, `prepTime`, `cookTime`, `servings`, `source{title, url, domain}`, `videoUrl`
- **Hero recipe:**
  - kicker: `"Tu Receta"`
  - title: `heroTitleFrom(b.name ?? b.title, "Receta")`
  - desc: description or `category · area`
  - **art: b.image** (with `artAspect: "poster"` — 2:3 vertical food photo)
  - icon: `"restaurant"`
  - accent: **emerald**
  - metrics: [ingredients count, prepTime, cookTime, servings] (first 3-4)
- **Detail recipe:** `tiles "Ingredientes"` (ingredient, measure) + `timeline "Pasos"` (Paso N + text) or `text "Preparación"` + `chips "Tips"` + `sources "Fuente"` + `sources "Video de la receta"` (if videoUrl)
- **CTA:** `"Ver video y receta completa"` or `"Ver receta completa"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks for a recipe ("¿cómo hago hummus?").

---

### Card 49 — `movie_review`
- **Source fields:** `title`, `overview`, `poster`, `director`, `runtime`, `releaseDate`, `genres[]`, `cast[]`, `rating`, `ratingCount`, `sources`, `whereToWatch[]`, `trailerUrl`
- **Hero recipe:**
  - kicker: `"Tu Película"`
  - title: `heroTitleFrom(b.title, "Película")`
  - desc: `overview[:200]`
  - **art: b.poster** (poster aspect)
  - icon: `"movie"`
  - accent: **primary**
  - metrics: [rating/10, ratingCount, runtime]
- **Detail recipe:** `text "Sinopsis"` + `tiles "Detalles"` (director/runtime/releaseDate/genres) + `chips "Reparto"` (cast) + `sources "Fuentes"` + `chips "Dónde verla"` (whereToWatch)
- **CTA:** `"Ver trailer y ficha completa"` or `"Ver ficha completa"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about a movie ("¿qué tal Dune Parte 2?").

---

### Card 50 — `book_review`
- **Source fields:** `title`, `synopsis`, `cover`, `author`, `year`, `pages`, `publisher`, `genre`, `isbn`, `sources`, `rating`
- **Hero recipe:**
  - kicker: `"Tu Libro"`
  - title: `heroTitleFrom(b.title, "Libro")`
  - desc: `synopsis[:200]`
  - **art: b.cover** (poster aspect)
  - icon: `"menu_book"`
  - accent: **amber**
  - metrics: [rating/10, year, pages]
- **Detail recipe:** `text "Sinopsis"` + `tiles "Detalles"` (author/year/pages/publisher/genre/isbn) + `sources "Fuentes"`
- **CTA:** `"Ver ficha completa"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** User asks about a book ("¿de qué va Cien Años de Soledad?").

---

### Card 51 — `plan` (via `planFallback`)
- **Source fields:** `title`, `note`, `items[{title, time, durationMinutes, priority, mode, icon, done}]`
- **Hero recipe:**
  - kicker: `"Tu Plan"`
  - title: **NOT uppercased** — preserves "Tu Día" (special case, breaks convention)
  - desc: `"{n} pasos para hoy"` or `b.note`
  - icon: `"checklist_rtl"`
  - accent: **violet**
  - art: `/stitch/plan-illustration.png` (always)
  - metrics: first 3 items as time chips (schedule icon) + "+N más"
- **Detail recipe:** `timeline "Pasos"` (item.icon or schedule, title, time·duration·priority·mode, status done/current based on `done`, badge with priority "Alta/Media/Baja" + tone urgent/current/pending)
- **CTA:** `"Ver plan completo"`
- **Has actions[]?** No
- **Empty state:** No
- **User context:** When Koru delivers a structured plan ("armame el día"). **Note:** Plan has its own canonical renderer `PlanHeroCard` — this fallback only triggers in edge cases. **Note:** This is what the user calls "Planes".

---

## 3. User-Mentioned Cards — Coverage Map

The user listed cards they want in the redesigned Koru. Here's how they map to the existing 51:

| User's term | Existing card # | Status |
|---|---|---|
| Crypto portfolio | #35 `crypto_portfolio` | ✅ Exists |
| Trading | — | ❌ **NEW — propose `trading`** |
| Notas (notes) | — | ❌ **NEW — propose `note`** |
| Deepsearches (deep web research) | #8 `research_sources` (+ #1 `deliverable` for reports) | ✅ Exists |
| Fútbol | #19 `live_match` | ✅ Exists (football-specific) |
| Tenis | — | ❌ **NEW — propose `tennis_match`** |
| Eventos importantes | — | ❌ **NEW — propose `important_event`** |
| Noticias urgentes | #20 `urgent_now` | ✅ Exists |
| Alarmas | #4 `alarm` | ✅ Exists |
| Recordatorios | #5 `reminder` | ✅ Exists |
| Planes | #51 `plan` | ✅ Exists |
| Rutinas | — | ❌ **NEW — propose `routine`** |
| Compras (shopping) | #6 `shopping_list` | ✅ Exists |
| Comparativas de productos | #7 `comparison` + #25 `product_analysis` | ✅ Exists (split) |
| Planes de ejercicio | — | ❌ **NEW — propose `exercise_plan`** |
| Pantallas de memoria | #33 `memory` | ✅ Exists |
| Crear (Create screen) | — | ❌ **NEW — propose `create_screen`** |
| Ajustes (Settings) | — | ❌ **NEW — propose `settings_screen`** |
| Home (home screen) | — | ❌ **NEW — propose `home_screen`** |
| Planificación de viajes | #26 `travel_planner` | ✅ Exists |
| Creación de imágenes | #27 `generation` | ✅ Exists |
| Finanzas | #9 `money_summary` + #21 `market` + #35 `crypto_portfolio` + #36 `forex` | ✅ Exists (4-card ecosystem) |
| Compras (purchases — duplicate) | #6 `shopping_list` | ✅ Exists |

**Summary:** 14 of the user's requested surfaces already exist. **9 genuinely new card types** must be added (Trading, Note, Tennis, Important Event, Routine, Exercise Plan, Create Screen, Settings Screen, Home Screen). Plus a 10th — `collections_screen` is referenced via `cta.screen="collections"` in `savedRecord` but never declared as its own card type.

---

## 4. Proposed NEW Cards (10)

### NEW Card 52 — `trading` (Crypto trading / orders)
- **Data:** `title`, `pair` (BTC/USDT), `side` (buy/sell), `orderType` (market/limit/stop), `price`, `quantity`, `total`, `fee`, `status` (pending/filled/cancelled), `orderId`, `timestamp`, `fills[]`, `leverage?`
- **Hero recipe:** kicker `"Tu Orden"`, title `"BTC/USDT · {side.toUpperCase()}"`, desc `"{quantity} @ {price}"`, icon `"currency_bitcoin"` if crypto else `"payments"`, accent **emerald** (buy) or **red** (sell), artValue `total`, metrics [price, quantity, fee]
- **Detail sections:** `rows "Orden"` (side, type, price, qty, fee, status) + `timeline "Fills"` (each fill timestamp + price + qty) + `text "Resumen"` (P&L if filled)
- **Accent:** **emerald** for buy, **red** for sell, **amber** for pending

---

### NEW Card 53 — `note` (Notas)
- **Data:** `title`, `body` (markdown), `tags[]`, `color` (highlight color), `pinned?`, `createdAt`, `updatedAt`, `attachments[]`, `checklist?[{label, checked}]`, `collection?`
- **Hero recipe:** kicker `"Tu Nota"` + pinned indicator, title, desc `body[:120]`, icon `"sticky_note_2"`, accent **amber** (or per-note color from palette), metrics [tags count, word count]
- **Detail sections:** `text "Cuerpo"` (full markdown body) + `chips "Etiquetas"` + `rows "Adjuntos"` (if any) + optional `rows "Checklist"` (if checklist)
- **Accent:** **amber** default; rotates per-note color (violet/emerald/rose/sky/indigo) like Apple Notes

---

### NEW Card 54 — `tennis_match` (Tenis)
- **Data:** `playerA{name, score, sets[], seed, country}`, `playerB{name, score, sets[], seed, country}`, `tournament`, `round`, `court` (clay/grass/hard), `status`, `liveScore`, `pointByPoint[]`, `stats[{label, a, b}]` (aces, double faults, breakpoints, etc.)
- **Hero recipe:** kicker `"{tournament} · {round}"`, title `"UPPER({playerA} vs {playerB})"`, desc `"{score} · {court}"`, icon `"sports_tennis"`, accent **emerald** (live) or **primary**, artValue score, metrics [sets won A, sets won B, current set]
- **Detail sections:** `rows "Sets"` (set-by-set score) + `timeline "Punto a punto"` (last 10-20 points) + `rows "Estadísticas"` (aces, DF, BP, 1st serve %, with comparative bars) + `text "Torneo"` (context)
- **Accent:** **emerald** (live) / **primary** (final) — same pattern as `live_match`

---

### NEW Card 55 — `important_event` (Eventos importantes)
- **Data:** `title`, `date`, `time`, `location`, `category` (personal/work/world/global), `description`, `countdown`, `attendees?[]`, `reminder?`, `source?`, `severity` (info/important/critical)
- **Hero recipe:** kicker `"Evento · {category}"`, title, desc `"{date} · {time} · {location}"`, icon category-based (`event`/`work`/`public`/`breaking_news`), accent severity-based (info=violet, important=amber, critical=red), artValue countdown `"3 días"`, metrics [date, attendees count]
- **Detail sections:** `text "Descripción"` + `rows "Detalles"` (date, time, location, attendees) + `timeline "Agenda"` (if multi-session) + `sources` (if global event)
- **Accent:** **violet** (info) / **amber** (important) / **red** (critical)

---

### NEW Card 56 — `routine` (Rutinas)
- **Data:** `title` ("Mañana", "Tarde", "Noche"), `timeWindow` ("06:00 - 09:00"), `steps[{time, label, icon, done, durationMinutes, category}]`, `streak` (days), `progress`, `nextStep?`
- **Hero recipe:** kicker `"Tu Rutina · {timeWindow}"`, title, desc `"{done}/{total} pasos · racha {streak} días"`, icon `"repeat"`, accent **violet**, artValue progress %, metrics [steps done, streak, next step time]
- **Detail sections:** `timeline "Pasos"` (each step with time, icon, status, category badge) + `rows "Estadísticas"` (streak, completion rate, avg duration) + `chips "Categorías"` (work/health/personal/etc.)
- **Accent:** **violet** (routine =- habit loop = Koru brand color)

---

### NEW Card 57 — `exercise_plan` (Planes de ejercicio)
- **Data:** `title`, `day` (Día 1, Día 2...), `focus` (Peito, Back, Legs, Cardio, Full Body), `duration`, `difficulty` (beginner/intermediate/advanced), `exercises[{name, sets, reps, rest, weight, muscleGroup, videoUrl?}]`, `warmup?[]`, `cooldown?[]`, `caloriesBurned?`, `completed?`
- **Hero recipe:** kicker `"Tu Entrenamiento · {day}"`, title, desc `"{focus} · {duration} · {difficulty}"`, icon `"fitness_center"`, accent **red** (intensity) or **emerald** (recovery), artValue duration, metrics [exercises count, sets total, calories]
- **Detail sections:** `timeline "Calentamiento"` (warmup) + `rows "Ejercicios"` (name, sets x reps, rest, weight, muscle badge) + `timeline "Enfriamiento"` (cooldown) + `tiles "Resumen"` (volume, intensity, calories) + `sources "Videos"` (if videoUrls)
- **Accent:** **red** (high intensity) / **amber** (medium) / **emerald** (recovery)

---

### NEW Card 58 — `create_screen` (Crear)
- **Data:** N/A — this is a **launcher card** not a data card. Fields: `recentCreations[{type, title, timestamp, preview?}]`, `suggestions[]`, `categories[]`
- **Hero recipe:** kicker `"Crear"`, title `"¿QUÉ QUIERES CREAR HOY?"`, desc `"Texto · Imagen · Código · Documento · Plan · Receta"`, icon `"add_circle"`, accent **violet**, metrics [recent count, suggestions count, favorites count]
- **Detail sections:** `chips "Categorías"` (text/image/code/document/plan/recipe/note/checklist) + `scroller "Creaciones recientes"` (cards with type icon, title, timestamp) + `chips "Sugerencias"` (AI-proposed prompts) + `rows "Plantillas"` (saved templates)
- **Accent:** **violet** (creative = Koru brand color)
- **Note:** Already exists as `src/ui/create/CreateScreen.tsx` — needs promotion to a unified card type.

---

### NEW Card 59 — `settings_screen` (Ajustes)
- **Data:** N/A — also a launcher/navigator card. Fields: `groups[{title, items[{icon, label, value, badge?, route}]}]`, `profile{name, avatar, plan}`, `version`
- **Hero recipe:** kicker `"Ajustes"`, title `"CONFIGURACIÓN"`, desc `"{profile.name} · {profile.plan}"`, icon `"settings"`, accent **primary**, metrics [account, notifications, privacy]
- **Detail sections:** `rows "Cuenta"` (profile, plan, billing) + `rows "Preferencias"` (language, theme, units) + `rows "Notificaciones"` (with toggles) + `rows "Privacidad"` (data, memory, history) + `rows "Sistema"` (version, logs, about)
- **Accent:** **primary** (system =- foundational)
- **Note:** Already exists as `src/ui/SettingsScreen.tsx` — needs promotion to unified card type.

---

### NEW Card 60 — `home_screen` (Home)
- **Data:** N/A — Koru's main dashboard. Fields: `greeting`, `weather?`, `nextEvent?`, `topTasks[]`, `proactiveSuggestions[]`, `recentCards[]`, `quickActions[]`
- **Hero recipe:** kicker `"Buenos días"` (or time-based), title `"{greeting}, {userName}"`, desc summary of the day, icon `"home"`, accent **violet**, artValue date, metrics [tasks count, events count, suggestions count]
- **Detail sections:** `tiles "Hoy"` (weather, next event, energy) + `timeline "Próximos"` (today's events) + `rows "Tareas prioritarias"` (top 3) + `scroller "Sugerencias de Koru"` (proactive cards) + `chips "Acciones rápidas"` (Talk, Create, Memory, Settings)
- **Accent:** **violet** (Koru home = brand color)
- **Note:** Already exists as `src/ui/HomeScreen.tsx` + `homeWidgets.ts` — needs promotion to unified card type with the same mold.

---

### NEW Card 61 — `collections_screen` (Colecciones)
- **Data:** `collections[{name, count, lastUpdated, icon, color, preview[]}]`, `recentlySaved[]`, `pinned?[]`
- **Hero recipe:** kicker `"Mis Colecciones"`, title `"LO QUE GUARDASTE"`, desc `"{n} colecciones · {m} registros"`, icon `"bookmark"`, accent **violet**, metrics [collections count, total items, this week]
- **Detail sections:** `scroller "Colecciones"` (each as a card with icon, name, count, last updated) + `rows "Recientes"` (last 5 saved items) + `chips "Filtros"` (by type, by date) + `rows "Pinned"` (favorites)
- **Accent:** **violet** (matches `saved_record` accent — consistent "saved" language)
- **Note:** Already exists as `src/ui/CollectionsScreen.tsx` — needs promotion to unified card type. Currently only reachable as a CTA destination via `saved_record`.

---

## 5. Categorized Master Inventory (61 cards across 11 groups)

### Group 1 — Daily Life (7 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 3 | `weather` | ✅ Existing | amber/blue/primary (dynamic) | Hero+Detail |
| 4 | `alarm` | ✅ Existing | rose | Action-only |
| 5 | `reminder` | ✅ Existing | emerald | Action-only |
| 17 | `morning_brief` | ✅ Existing | amber | Hero+Detail |
| 18 | `wellbeing` | ✅ Existing | purple | Hero+Detail |
| 23 | `health_reminder` | ✅ Existing | rose | Action-only |
| 44 | `outfit` | ✅ Existing | amber | Hero+Detail |

### Group 2 — Productivity (7 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 51 | `plan` | ✅ Existing | violet | Hero+Detail (canonical: PlanHeroCard) |
| 43 | `smart_checklist` | ✅ Existing | violet | Hero+Detail |
| 6 | `shopping_list` | ✅ Existing | amber | Hero+Detail |
| 11 | `activity_group` | ✅ Existing | primary | Hero+Detail |
| 24 | `activity_tracker` | ✅ Existing | emerald | Hero+Detail |
| 56 | `routine` | ❌ NEW | violet | Hero+Detail |
| 57 | `exercise_plan` | ❌ NEW | red/amber/emerald | Hero+Detail |

### Group 3 — Sports (4 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 19 | `live_match` | ✅ Existing | red/emerald | Hero+Detail (richest) |
| 28 | `match_timeline` | ✅ Existing | emerald | Hero+Detail |
| 29 | `match_stats` | ✅ Existing | primary | Hero+Detail |
| 54 | `tennis_match` | ❌ NEW | emerald/primary | Hero+Detail |

### Group 4 — Finance (6 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 9 | `money_summary` | ✅ Existing | emerald | Hero+Detail |
| 21 | `market` | ✅ Existing | emerald | Hero+Detail |
| 35 | `crypto_portfolio` | ✅ Existing | amber | Hero+Detail |
| 36 | `forex` | ✅ Existing | primary | Hero+Detail |
| 52 | `trading` | ❌ NEW | emerald/red | Hero+Detail |
| (34) | `data_ticker` | ✅ Existing | primary | Hero+Detail (cross-listed in Information) |

### Group 5 — Media & Reviews (7 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 48 | `recipe` | ✅ Existing | emerald | Hero+Detail (poster art) |
| 49 | `movie_review` | ✅ Existing | primary | Hero+Detail (poster art) |
| 50 | `book_review` | ✅ Existing | amber | Hero+Detail (poster art) |
| 16 | `restaurant_synthesis` | ✅ Existing | amber | Hero+Detail |
| 45 | `review_score` | ✅ Existing | violet | Hero+Detail |
| 46 | `review_document` | ✅ Existing | primary | Hero+Detail |
| 47 | `review_quote` | ✅ Existing | purple | Hero+Detail |

### Group 6 — Information (7 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 3 | `weather` | ✅ Existing (cross-listed with Daily Life) | dynamic | Hero+Detail |
| 20 | `urgent_now` | ✅ Existing | red | Action-only |
| 55 | `important_event` | ❌ NEW | violet/amber/red | Hero+Detail |
| 12 | `proactive_signal` | ✅ Existing | amber/purple | Hero+Detail |
| 34 | `data_ticker` | ✅ Existing | primary | Hero+Detail |
| 30 | `election_results` | ✅ Existing | amber | Hero+Detail |
| 31 | `election_vote` | ✅ Existing | violet | Hero+Detail |

### Group 7 — Research (5 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 8 | `research_sources` | ✅ Existing | purple | Hero+Detail |
| 14 | `web_nav` | ✅ Existing | purple | Hero+Detail |
| 15 | `data_card` | ✅ Existing | emerald | Hero+Detail |
| 1 | `deliverable` | ✅ Existing | violet | Hero+Detail (flagship) |
| 27 | `generation` | ✅ Existing | violet | Hero+Detail |

> **Note:** User mentioned "Deepsearches" — covered by `research_sources` (#8) + `deliverable` (#1). User mentioned "Creación de imágenes" — covered by `generation` (#27).

### Group 8 — Travel & Navigation (8 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 26 | `travel_planner` | ✅ Existing | sky | Hero+Detail |
| 39 | `route_map` | ✅ Existing | indigo | Hero+Detail |
| 37 | `route_timeline` | ✅ Existing | indigo | Hero+Detail |
| 38 | `transport_compare` | ✅ Existing | amber | Hero+Detail |
| 22 | `delivery` | ✅ Existing | indigo | Hero+Detail |
| 42 | `social_interaction` | ✅ Existing | pink | Hero+Detail |
| 40 | `birthday_calendar` | ✅ Existing | pink | Hero+Detail |
| 41 | `birthday_alarm` | ✅ Existing | amber | Hero (no detail, no actions) |

### Group 9 — Decisions (3 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 7 | `comparison` | ✅ Existing | pink | Hero+Detail (only with `empty` state) |
| 32 | `decision_support` | ✅ Existing | indigo | Hero+Detail |
| 25 | `product_analysis` | ✅ Existing | primary | Hero+Detail |

### Group 10 — Memory & Notes (4 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 33 | `memory` | ✅ Existing | violet | Hero+Detail |
| 10 | `saved_record` | ✅ Existing | violet | Hero-only (CTA → collections) |
| 53 | `note` | ❌ NEW | amber (rotates) | Hero+Detail |
| 2 | `clarifying_question` | ✅ Existing | violet | Hero+Detail |

### Group 11 — System Screens (4 cards)
| # | Card | Status | Accent | Type |
|---|---|---|---|---|
| 60 | `home_screen` | ❌ NEW (file exists: `HomeScreen.tsx`) | violet | Launcher |
| 58 | `create_screen` | ❌ NEW (file exists: `CreateScreen.tsx`) | violet | Launcher |
| 59 | `settings_screen` | ❌ NEW (file exists: `SettingsScreen.tsx`) | primary | Launcher |
| 61 | `collections_screen` | ❌ NEW (file exists: `CollectionsScreen.tsx`) | violet | Launcher |
| 13 | `resource_bundle` | ✅ Existing | indigo | Hero+Detail (system-adjacent) |

---

## 6. Cross-Cutting Patterns & Code Smells

### 6.1 Inconsistencies found

1. **Hardcoded titles** in 2 cards (regression vs. v2 fixes elsewhere):
   - `route_timeline` line 1953: `title: "RUTA"` (should be `heroTitleFrom(b.title ?? first.label, "Ruta")`)
   - `transport_compare` line 1983: `title: "TRANSPORTE"` (should be dynamic)
2. **`plan`** breaks uppercase convention (line 2300-2302) — intentional special case but inconsistent with the other 50 cards.
3. **Empty-state coverage:** Only `comparison` (Card 7) has an `empty` object. The other 50 silently render broken heroes when their data array is empty. **HIGH-priority gap.**
4. **Action-only cards (4):** `alarm`, `reminder`, `urgent_now`, `health_reminder` — all 4 omit `detail`. Good UX, but `birthday_alarm` (Card 41) and `clarifying_question` (Card 2) could arguably be action-only too. Inconsistent boundary.
5. **CTA label verbosity:** Range from 1 word ("Responder") to 5 words ("Ver trailer y ficha completa"). No length cap.
6. **Accent reuse:** Violet dominates (12 cards), followed by amber (10), emerald (9). Pink (5), indigo (5), primary (5) underused. Sky (1 — only `travel_planner`), purple (5), blue (0!), red (only for urgent/live). **Blue is dead weight** in the palette.

### 6.2 Smart patterns to preserve

1. **Dynamic icon + accent in `weather`** (Card 3) — only card that picks icon/accent from data regex. Pattern should propagate to `important_event`, `routine`, etc.
2. **Smart art in `deliverable`** (Card 1) — keyword-based `/stitch/icons/*.png` selection. Pattern should propagate.
3. **Merged timeline in `live_match`** (Card 19) — goals + cards + subs sorted into one timeline, instead of 3 separate sections. Pattern should propagate to `match_timeline`, `routine`, `exercise_plan`.
4. **Comparative bars in `live_match`/`match_stats`/`election_results`** — `DetailRow.bar { homeValue, awayValue, isPercent }` is a strong visual primitive. Should be added to `comparison`, `decision_support`, `forex`.
5. **`heroTitleFrom` helper** — strips "Tu/Mi" prefixes and uppercases. Applied in 49 of 51 cards (missing in `plan` and `route_timeline`).
6. **Deduplication in `saved_record`** (Card 10) — case-insensitive + accent-insensitive `Set` to avoid "Café · cafe" duplicates. Should be a shared helper.
7. **`artAspect: "poster"` for media cards** — only `recipe`, `movie_review`, `book_review` use it. Any card with a poster/cover photo should follow.

### 6.3 Dead/redundant surfaces

1. **`urgent_now` vs `proactive_signal`** — overlapping concepts. `urgent_now` is action-only red; `proactive_signal` is hero+detail amber/purple. Could be unified.
2. **`birthday_alarm` vs `social_interaction` vs `birthday_calendar`** — three cards for the same domain (birthdays). Needs consolidation.
3. **`match_timeline` vs `match_stats`** — both are sub-views of `live_match`. Could be folded into `live_match` detail tabs.
4. **`review_document` vs `review_quote` vs `review_score`** — three review cards. Should compose into one `review` card with section variants.

---

## 7. Next Actions for the Redesign

### Priority 1 — Systematize what exists (before adding new)
1. **Add `empty` states to all 50 remaining cards.** Pattern: every mapper should return `{ hero: {…minimal…}, empty: { reason, icon } }` when its data array is `[]`/null/undefined.
2. **Fix the 2 hardcoded titles** (`route_timeline` "RUTA", `transport_compare` "TRANSPORTE") → use `heroTitleFrom`.
3. **Add comparative bars** (`DetailRow.bar`) to `comparison`, `decision_support`, `forex`, `crypto_portfolio`.
4. **Promote 4 system screens** (`home_screen`, `create_screen`, `settings_screen`, `collections_screen`) from standalone `.tsx` files into unified `KoruPresentation` mappers. This makes them themable and consistent.

### Priority 2 — Add the 9 NEW content cards
5. **`note`** — replaces/augments `memory` for user-authored content. New `note` UiBlock type + `note()` mapper.
6. **`routine`** — pattern: same mold as `plan` but with streak tracking + repeating schedule.
7. **`exercise_plan`** — pattern: enriched `plan` with sets/reps/videoUrl. Reuses `timeline` for warmup/exercises/cooldown.
8. **`tennis_match`** — clone `live_match` mapper; swap `sports_soccer`→`sports_tennis`; replace lineups (no pitch) with point-by-point timeline.
9. **`trading`** — new UiBlock with order/fill semantics. Action-only variant possible ("Cancelar orden" / "Modificar").
10. **`important_event`** — clone `urgent_now` but with countdown + detail screen (location, attendees, agenda).
11. **(`collections_screen` already covered above as Priority 1 #4.)**

### Priority 3 — Consolidation
12. **Merge `birthday_alarm` + `social_interaction` + `birthday_calendar`** into one `birthday` card with optional sections.
13. **Merge `review_score` + `review_document` + `review_quote`** into one `review` card with section variants.
14. **Fold `match_timeline` + `match_stats`** into `live_match` as detail tabs.

### Priority 4 — Palette cleanup
15. **Remove `blue`** from palette (unused) OR assign it (e.g., to finance cards currently using primary).
16. **Document accent semantics:** violet=Koru/system, emerald=positive/live, red=urgent/negative, amber=attention/time, indigo=transport/navigation, sky=travel, purple=research, pink=social/comparison, primary=neutral/data, rose=health.

---

**End of master inventory.** This document is the input to the redesign spec. Total cards after redesign: **61 unified cards** across **11 groups**, with **9 new content types** + **4 promoted system screens** + **3 consolidations** = net +7 cards from current 51.
