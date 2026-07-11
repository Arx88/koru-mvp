# Koru — 07. Plan de expansión a 100 tools (todas gratuitas)

> Cómo llevar Koru de las **8 tools actuales** a **100 tools** usando **únicamente APIs gratuitas sin costo adicional** (no requieren tarjeta, ni suscripción, ni consumo de los providers LLM de pago).
>
> **Criterios de inclusión:**
> - Gratuita de verdad (no freemium con techo bajo que se agota en un MVP).
> - Sin costo recurrente. Preferencia: sin API key. Si requiere key, debe ser tier gratuito generoso y gratis para siempre.
> - Alineada con lo que Koru **intenta ser**: asistente personal local-first con memoria, agenda, vida doméstica, finanzas personales, aprendizaje, bienestar y conexión con el mundo.
> - Reutiliza el `toolRegistry` existente (mismo patrón `ToolPolicy`/`requiresApproval`).
>
> **Políticas de uso verificadas** (junio 2026) en notas técnicas. Orden = prioridad de implementación (ROI: valor para el usuario ÷ esfuerzo).

---

## Cómo leer este documento

Cada tool tiene:
- **Prioridad** (P0 = hazlo ya, P1 = pronto, P2 = cuando haya tiempo, P3 = nicho/optional).
- **API** con enlace y nota de límites.
- **Política de riesgo sugerida** (siguiendo `toolRegistry.ts`).
- **Fit con Koru**: por qué encaja con la identidad del asistente.

Las tools se agrupan por dominio funcional. Al final hay una tabla maestra con las 100.

---

# BLOQUE A — Consolidar lo que ya tiene (P0)

Antes de añadir, Koru ya usa varias APIs gratuitas mal aprovechadas. Expandirlas es casi gratis.

### A1. `weather_full` — Clima extendido (P0)
- **API:** [Open-Meteo](https://open-meteo.com/) — **sin key**, 10.000 calls/día, 600/min, no comercial CC BY 4.0.
- **Estado actual:** `getWeather` ya lo usa pero solo trae "ahora + min/max + lluvia".
- **Expandir a:** pronóstico horario 7 días, índice UV, calidad del aire (`air-quality-api`), polen, amanecer/atardecer, sensación térmica.
- **Riesgo:** `readonly`. **Fit:** vestimenta/actividades al aire libre — núcleo de Koru.

### A2. `air_quality` — Calidad del aire (P0)
- **API:** [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) — sin key, mismos límites.
- **Riesgo:** `readonly`. **Fit:** recomendaciones de salud (asma, ejercicio al aire libre). Conecta con dominio `wellbeing`.

### A3. `geocode` y `reverse_geocode` — Geolocalización (P0)
- **API:** [Nominatim/OSM](https://nominatim.org/) — sin key, **máx 1 req/seg**, User-Agent obligatorio.
- **Estado actual:** `geocodeCity` ya lo usa pero solo 1 resultado.
- **Expandir a:** reverse geocoding (coordenadas → dirección), búsqueda de POIs.
- **Riesgo:** `readonly`. **Fit:** "estoy en X" → guardar como profile memory.

### A4. `route` — Rutas sin API key de tránsito (P0)
- **API:** [OSRM public server](https://project-osrm.org/) — gratis pero **rate-limit no documentado, usar con cache**.
- **Estado actual:** `queryOsrmRoute` hardcoded solo Madrid-aeropuerto.
- **Expandir a:** rutas A→B genéricas con duración/distancia.
- **Riesgo:** `readonly`. **Fit:** "¿cuánto tardo en llegar a X?".

### A5. `places_nearby` — Lugares cercanos (P0)
- **API:** [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) (OSM) — sin key, 2 instancias públicas, rate-limit por IP.
- **Qué da:** farmacias, supermercados, estaciones, cajeros, parques cerca de un punto.
- **Riesgo:** `readonly`. **Fit:** vida doméstica y urgencias.

---

# BLOQUE B — Dinero y finanzas personales (P0–P1)

Koru ya tiene `money_summary`. Estas lo vuelven útil de verdad.

### B1. `currency_convert` — Conversión de divisas (P0)
- **API:** [Frankfurter](https://www.frankfurter.app/) — sin key, open source, datos del BCE.
- **Riesgo:** `readonly`. **Fit:** "¿cuánto son 50 USD en pesos?".

### B2. `exchange_history` — Histórico de divisas (P1)
- **API:** Frankfurter (soporta fechas desde 1999).
- **Fit:** "¿cómo estaba el dólar hace un año?".

### B3. `crypto_price` — Precio de cripto (P1)
- **API:** [CoinGecko Demo](https://www.coingecko.com/api/documentation) — **key gratuita** (no tarjeta), ~30 calls/min.
- **Riesgo:** `readonly`. **Fit:** seguimiento de portfolio.

### B4. `stock_index` — Índices bursátiles (P2)
- **API:** [Yahoo Finance unofficial](https://query1.finance.yahoo.com/) — sin key, no oficial, frágil. Alternativa: [Stooq](https://stooq.com/) CSV sin key.
- **Fit:** "¿cómo cerró el S&P?".

### B5. `inflation_data` — Inflación oficial (P3)
- **API:** [FRED](https://fred.stlouisfed.org/docs/api/fred/) — **key gratuita**, generoso.
- **Fit:** contexto macro para decisiones de gasto.

### B6. `tax_calendar` — Vencimientos fiscales (P3)
- **Sin API pública universal.** Auto-generado local desde reglas por país. Cache en `LifeRecord`.

---

# BLOQUE C — Vida doméstica y cocina (P0–P1)

### C1. `recipe_search` — Recetas (P0)
- **API:** [TheMealDB](https://www.themealdb.com/api.php) — **key gratuita** "1" pública, sin límite práctico.
- **Riesgo:** `readonly`. **Fit:** "¿qué cocino con lo que tengo en heladera?".

### C2. `recipe_by_ingredients` — Recetas por ingredientes (P0)
- **API:** [TheMealDB + Spoonacular demo](https://spoonacular.com/food-api) — Spoonacular 150 req/día free tier.
- **Fit:** reduce desperdicio de comida → conecta con `meal_inventory` records.

### C3. `food_info` — Info nutricional por código de barras (P1)
- **API:** [Open Food Facts](https://world.openfoodfacts.org/data) — sin key, 2.9M productos, open data.
- **Riesgo:** `readonly`. **Fit:** escanear producto antes de comprar → decisión.

### C4. `nutrition_lookup` — Macros de alimento crudo (P1)
- **API:** [Open Food Facts](https://wiki.openfoodfacts.org/) o [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide.html) — **key USDA gratuita**.
- **Fit:** seguimiento de dieta → `wellbeing`.

### C5. `grocery_price_compare` — Comparar precios (P2)
- **Sin API universal gratis.** Scraping ético de supermercados locales con cache + `structureExtractor` (que Koru ya tiene) → anti-alucinación ya resuelta.

### C6. `unit_convert` — Conversión de unidades (P1)
- **Local puro**, sin API. Para cocina/bricolaje. 50 líneas de código.

---

# BLOQUE D — Aprendizaje y conocimiento (P0–P1)

### D1. `wikipedia_summary` — Resumen enciclopédico (P0)
- **API:** [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) — sin key, User-Agent obligatorio.
- **Riesgo:** `readonly`. **Fit:** "¿quién era X?" sin inventar.

### D2. `wikipedia_search` — Búsqueda (P0)
- **API:** [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page) — sin key.
- **Fit:** punto de partida para investigación.

### D3. `wiktionary_define` — Definir palabra (P1)
- **API:** [Wiktionary API](https://www.wiktionary.org/w/api.php) — sin key.
- **Fit:** corrección/idiotismos.

### D4. `dictionary_define` — Definición + sinónimos (P1)
- **API:** [Free Dictionary API](https://dictionaryapi.dev/) — sin key.
- **Fit:** escritura (emails, documentación).

### D5. `arxiv_search` — Papers científicos (P1)
- **API:** [arXiv API](https://info.arxiv.org/help/api/index.html) — sin key.
- **Fit:** investigación profunda → `deep_research` actual.

### D6. `crossref_search` — DOI/metadata académica (P1)
- **API:** [Crossref](https://api.crossref.org/) — sin key, **policy: User-Agent + mailto**, límites razonables.
- **Fit:** citar fuentes.

### D7. `openlibrary_book` — Info de libro (P1)
- **API:** [Open Library](https://openlibrary.org/developers/api) — sin key.
- **Fit:** "¿de qué trata X?" → lista de lectura.

### D8. `gutenberg_book` — Libro de dominio público (P2)
- **API:** [Gutendex](https://gutendex.com/) — sin key, 70K libros.
- **Fit:** lectura gratuita.

### D9. `quote_of_the_day` — Cita del día (P3)
- **API:** [Quotes on Design](https://quotesondesign.com/api/) o [ZenQuotes](https://zenquotes.io/) — sin key.
- **Fit:** tono inspiracional.

### D10. `number_fact` / `date_fact` — Datos curiosos (P3)
- **API:** [Numbers API](http://numbersapi.com/) — sin key.
- **Fit:** chispa conversacional.

---

# BLOQUE E — Noticias y señales del mundo (P0–P1)

Koru ya usa GDELT y DuckDuckGo. Expandir.

### E1. `gdelt_news` — Noticias globales estructuradas (P0)
- **API:** [GDELT DOC 2.0](https://api.gdeltproject.org/api/v2/doc/doc) — sin key, **rate-limit generoso**.
- **Estado actual:** ya se usa, expandir a tono/cobertura geográfica.

### E2. `gdelt_trends` — Tendencias temáticas (P1)
- **API:** GDELT GKG (Global Knowledge Graph).
- **Fit:** "¿de qué se habla sobre X en el mundo?" → `world_signal`.

### E3. `rss_feed` — Lector de RSS (P0)
- **Sin API externa**: parser local de XML (cualquier fuente RSS: BBC, El País, blogs).
- **Riesgo:** `readonly`. **Fit:** radar proactivo personalizable.

### E4. `hacker_news_top` — HN top stories (P2)
- **API:** [HN Firebase API](https://github.com/HackerNews/API) — sin key.
- **Fit:** señal tech.

### E5. `reddit_subreddit` — Posts de un subreddit (P2)
- **API:** [Reddit JSON](https://www.reddit.com/dev/api/) — sin key (OAuth para más), User-Agent obligatorio.
- **Fit:** señal de comunidad.

### E6. `github_trending` — Tendencias GitHub (P3)
- **Sin API oficial.** Scraping ligero de `github.com/trending` con Playwright (que Koru ya tiene).

### E7. `product_hunt` — Lanzamientos (P3)
- **API:** GraphQL, requiere OAuth free. O scraping.

---

# BLOQUE F — Tiempo y agenda (P0–P1)

### F1. `holidays` — Feriados nacionales (P0)
- **API:** [Nager.Date](https://date.nager.at/) — sin key, 100+ países.
- **Riesgo:** `readonly`. **Fit:** agenda y planificación.

### F2. `time_zone_convert` — Conversión de zona horaria (P0)
- **Local puro** (Intl API del navegador). Sin backend.
- **Fit:** reuniones internacionales.

### F3. `sun_moon` — Fases lunares / sol (P1)
- **API:** [Sunrise-Sunset](https://sunrise-sunset.org/api) — sin key.
- **Fit:** fotografía, agricultura, bienestar.

### F4. `countdown_calc` — Cuenta regresiva (P1)
- **Local puro.** "Faltan 12 días para X" → nudge automático.

### F5. `cron_parse` — Parser de "cada lunes a las 9" (P1)
- **Local puro**, complementa `recurrenceFromText` actual.

---

# BLOQUE G — Salud y bienestar (P1–P2)

### G1. `whoop_advice` / `sleep_tips` — Consejos de sueño (P2)
- **Local puro** (reglas desde `sleep` records). Sin API.

### G2. `hydration_reminder` — Recordatorio de hidratación (P1)
- **Local puro** → heartbeat nudge. Conecta con `routineReminderNudge`.

### G3. `medication_schedule` — Esquema de medicación (P1)
- **Local puro** → `medication` records ya existen. Generar alarmas.

### G4. `bmi_calc` — Índice de masa corporal (P2)
- **Local puro.**

### G5. `whoop_advice` — Actividad física por clima (P2)
- Combina `weather_full` + reglas. "Hoy conviene entrenar indoor por PM2.5 alto".

---

# BLOQUE H — Productividad y archivos (P1–P2)

### H1. `qr_generate` — Generar QR (P0)
- **API:** [GoQR](https://goqr.me/api/) — sin key.
- **Riesgo:** `readonly`. **Fit:** "pasame tu WiFi en QR", links a compartir.

### H2. `markdown_to_pdf` — Exportar documentos (P1)
- **Cliente puro** con lib ligera (p.ej. `md-to-pdf` o `print`).
- **Fit:** `resource_bundle` ya existe → documentos reales.

### H3. `csv_parse` — Leer CSV pegado (P1)
- **Local puro.** Gastos, datos personales.

### H4. `ics_export` — Exportar calendario (P0)
- **Local puro**, inverso de `parseIcsEvents` que ya existe. Genera `.ics` para Google Calendar.
- **Fit:** portabilidad → no lock-in.

### H5. `json_export` / `json_import` — Backup completo (P0)
- Ya existe `exportState`/`importState`. Exponer como tool explícita para el usuario.

### H6. `ocr_image` — Texto desde imagen (P2)
- **API:** [Ollama con Llama 3.2 Vision local](https://ollama.com/blog/llama3.2-vision) — **100% local, sin costo**.
- **Fit:** "léeme este ticket de compra" → `expense` record.

### H7. `transcribe_audio` — STT avanzado (P2)
- **API:** [Whisper local en Ollama](https://ollama.com/library/whisper-cpp) o [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — local, sin costo.
- **Fit:** mejora el STT actual (Web Speech) para archivos de audio.

### H8. `tts_speak` — Voz sintética (P2)
- **API:** [Ollama Kokoro TTS](https://ollama.com/library/kokoro-tts) o [Piper](https://github.com/rhasspy/piper) — local.
- **Fit:** respuesta hablada de Koru (complementa el STT actual).

---

# BLOQUE I — Memoria y conocimiento personal (P0–P1)

### I1. `embed_memory` — Vectorizar memorias (P0)
- **API:** [Ollama `nomic-embed-text`](http://localhost:11434) — local, ya se usa para Semantic Router.
- **Expandir a:** embeber TODAS las memorias confirmadas (hoy solo router examples).
- **Fit:** búsqueda semántica real sobre `memories` → `selectActiveMemories` deja de ser heurístico.

### I2. `semantic_search_memory` — Buscar en memoria (P0)
- Sobre I1. "¿qué te dije sobre mi mama?" → top-K por coseno.

### I3. `semantic_search_records` — Buscar en records (P0)
- Igual sobre `LifeRecord[]`. Reemplaza `semanticRecordMatches` (que es léxico).

### I4. `dedupe_records` — Deduplicar records (P1)
- Local, por embedding similarity > 0.92.

### I5. `memory_consolidate` — Consolidar memorias redundantes (P1)
- Local. "Vivo en Madrid" + "Estoy en Madrid" → una sola.

### I6. `entity_extract` — Extraer personas/lugares (P1)
- **Local** con un modelo NER en Ollama (ej. `gliner` o prompt al LLM).

---

# BLOQUE J — Utilidades y meta (P1–P2)

### J1. `web_scrape` — Extraer texto de URL (P0)
- **Local puro** (`fetchPageContent` ya existe en `koruBackend.ts`).
- **Fit:** "leeme este artículo".

### J2. `youtube_transcript` — Transcripción de video (P1)
- **Sin API oficial gratuita.** Scraping de `youtubetranscript.com` o `kome.ai` (frágil).
- **Alternativa local:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) + whisper → 100% local.

### J3. `link_preview` — Metadatos de URL (P1)
- **Local puro**, OG meta tags. `structureExtractor` ya lo hace parcialmente.

### J4. `shorten_url` — Acortar URL (P3)
- **API:** [is.gd](https://is.gd/) — sin key. O [cleanuri](https://cleanuri.com/).

### J5. `hash_text` / `hash_file` — Checksum (P3)
- **Local puro** (Web Crypto API).

### J6. `password_generate` — Generar contraseña (P2)
- **Local puro** (crypto.getRandomValues).

### J7. `uuid_generate` — UUID (P3)
- **Local puro** (`crypto.randomUUID`).

### J8. `base64_encode` / `decode` (P3)
- **Local puro.**

---

# BLOQUE K — Conexión con el sistema local (P1–P2, vía Ollama/Node)

Koru corre en Node — puede hablar con el sistema local sin costo.

### K1. `clipboard_read` / `clipboard_write` (P2)
- **Vía Node** (Electron/Tauri si se empaqueta) o `navigator.clipboard` en web.
- **Fit:** "guarda lo que tengo en el portapapeles".

### K2. `file_read` / `file_write` (P2)
- **Vía Node** en el dev-server. Sandbox estricto.
- **Riesgo:** `destructive` → `requiresApproval: true`.

### K3. `shell_run` — Ejecutar comando (P3)
- **Vía Node.** Altamente peligroso. Solo con `requiresApproval` + whitelist de comandos seguros.
- **Riesgo:** `destructive`.

### K4. `notify_desktop` — Notificación nativa (P1)
- **Web Notifications API** del navegador. Sin costo.
- **Fit:** nudges proactivos visibles fuera de la app.

### K5. `open_url` — Abrir URL en navegador (P1)
- `window.open` o `shell.openExternal` si se empaqueta.

---

# BLOQUE L — Compras y productos (P1–P2)

### L1. `barcode_lookup` — Info por código de barras (P1)
- **API:** [Open Food Facts](https://world.openfoodfacts.org/data) (comida) + [Open Beauty Facts](https://world.openbeautyfacts.org/) (cosmética) + [Open Pet Food Facts](https://world.openpetfoodfacts.org/).
- **Sin key.**

### L2. `book_isbn` — Libro por ISBN (P1)
- **API:** [Open Library](https://openlibrary.org/isbn) — sin key.

### L3. `product_reviews` — Reviews (P2)
- **Sin API universal gratuita.** Scraping + `structureExtractor`.

### L4. `price_history` — Histórico de precios (P3)
- **Sin API universal.** Trackeo local en `LifeRecord`.

---

# BLOQUE M — Gobierno y datos abiertos (P2–P3)

### M1. `country_info` — Datos de país (P1)
- **API:** [REST Countries](https://restcountries.com/) — sin key.

### M2. `city_population` / `geo_data` (P2)
- **API:** [DBpedia](https://wiki.dbpedia.org/) o Wikidata SPARQL — sin key.

### M3. `public_transport` — Transporte público (P3)
- Muy local-dependiente. Algunas ciudades tienen APIs abiertas (ej. Madrid EMT, Buenos Aires CABA). Por ciudad.

---

# BLOQUE N — Mundo físico y ambiente (P2–P3)

### N1. `earthquake_recent` — Sismos recientes (P3)
- **API:** [USGS Earthquake](https://earthquake.usgs.gov/fdsnws/event/1/) — sin key.

### N2. `aurora_forecast` — Aurora boreal (P3)
- **API:** [NOAA SWPC](https://www.swpc.noaa.gov/) — sin key.

### N3. `tide_data` — Mareas (P3)
- **API:** [NOAA Tides](https://tidesandcurrents.noaa.gov/api/) — sin key (EE.UU.).

### N4. `aircraft_tracker` — Aviones en vivo (P3)
- **API:** [OpenSky Network](https://opensky-network.org/apidoc) — sin key (rate-limit).

---

# BLOQUE O — Comunicación (P2–P3, casi todas locales)

### O1. `email_draft` — Borrador de email (P0)
- **Local puro.** Ya existe `draft_message` actionKind. Exponer como tool.
- **Fit:** reduce fricción para responder.

### O2. `sms_draft` — Borrador SMS/WhatsApp (P1)
- **Local puro** (link `sms:` / `https://wa.me/?text=`).

### O3. `calendar_add_local` — Evento local (P0)
- Ya existe `createManualCalendarEvent`. Exponer como tool.

### O4. `share_text` — Compartir (P1)
- Web Share API del navegador.

---

# BLOQUE P — IA local vía Ollama (P0, sin costo)

Ya tienes Ollama corriendo para embeddings. Esto lo multiplica sin gastar un centavo.

### P1. `llm_local_summarize` — Resumir texto largo (P0)
- **Local**, modelo `qwen3.6:27b` o `koru-qwen-32k`.
- **Fit:** resumir articles/reuniones antes de guardar.

### P2. `llm_local_translate` — Traducir (P1)
- **Local.** Cualquier modelo de instrucción.

### P3. `llm_local_classify` — Clasificar sentimiento/dominio (P1)
- **Local.** Reemplaza `classifyMemoryKind` heurístico.

### P4. `llm_local_extract_entities` — NER (P1)
- **Local.** Reemplaza extractores léxicos.

### P5. `llm_local_rewrite_voice` — Reescribir con tono Koru (P2)
- **Local.** Aplica `voicePreference` antes de mostrar al usuario.

### P6. `llm_local_extract_action_items` — Tareas de reunión/notas (P1)
- **Local.** De una transcripción → lista de `commitments`.

### P7. `image_caption` — Descripción de imagen (P2)
- **Local**, Llama 3.2 Vision o LLaVA en Ollama.

### P8. `audio_transcribe_local` — STT (P2)
- **Local**, whisper.cpp en Ollama.

---

# BLOQUE Q — Comprobación y seguridad de la app misma (P0)

### Q1. `self_health_check` — Diagnóstico de Koru (P0)
- **Local puro.** Verifica providers disponibles, Ollama, IndexedDB, latencia.
- **Fit:** "¿Koru, estás bien?" → autodiagnóstico honesto.

### Q2. `state_stats` — Estadísticas de uso (P1)
- **Local.** Cuántas memorias, records, días activos, energía.

### Q3. `boundary_audit` — Auditar boundaries cumplidos (P1)
- **Local.** Respeta `learningPreferences` y `forbiddenPhrases`.

### Q4. `migrate_state` — Migración de versiones (P2)
- **Local.** Detecta schema viejo y actualiza.

---

# BLOQUE R — Proactividad avanzada (P1–P2)

### R1. `weather_nudge_smart` — Nudge climático (P1)
- Combina `weather_full` + `calendar` + `routineReminderNudge` existente.

### R2. `expense_alert` — Alerta de gasto inusual (P1)
- **Local**, sobre `expense` records. Anomalía vs promedio.

### R3. `renewal_reminder` — Suscripciones por vencer (P1)
- **Local**, records tipo `deadline` con `person_followup`.

### R4. `news_radar` — Radar temático (P2)
- Combina `rss_feed` + `semantic_search` sobre intereses guardados.

### R5. `moonlight_activity_suggest` — Sugerencia de actividad nocturna (P3)
- Local, curiosidad.

---

# BLOQUE S — Idiomas (P1)

### S1. `language_detect` — Detectar idioma (P1)
- **Local**, lib `franc` o `cld3`.

### S2. `translate_local` — Traducir (P1)
- Véase P2.

### S3. `pronounce_word` — Pronunciación IPA (P2)
- **Local** o Free Dictionary API.

### S4. `spell_check` — Corrector (P2)
- **Local** o LanguageTool [API gratuita](https://languagetool.org/http-api/) sin key para uso ligero.

---

# BLOQUE T — Datos personales enriquecidos (P1–P2)

### T1. `attach_note_to_memory` — Adjuntar nota (P1)
- Local. Enriquece `MemoryFact`.

### T2. `link_records_to_commitment` — Vincular (P1)
- Local. Record de gasto → commitment de pago.

### T3. `tag_records` — Etiquetar en lote (P2)
- Local.

### T4. `timeline_build` — Línea de tiempo (P2)
- Local, sobre entries + records.

### T5. `habit_streak` — Racha de hábito (P2)
- Local, sobre `routine` memories.

---

# BLOQUE U — Humor y tono (P3, identidad)

### U1. `joke_of_the_day` — Chiste (P3)
- **API:** [JokeAPI](https://jokeapi.dev/) — sin key.
- **Fit:** humor calibrado en `voicePreference.humor`.

### U2. `fun_fact` — Dato curioso (P3)
- Véase D10.

### U3. `word_of_the_day` — Palabra del día (P3)
- **Local** o Free Dictionary.

---

# Resumen maestro (100 tools)

| # | Tool | API | Costo | Prio | Riesgo |
|---|------|-----|-------|------|--------|
| 1 | `weather_full` | Open-Meteo | $0 | P0 | readonly |
| 2 | `air_quality` | Open-Meteo AQ | $0 | P0 | readonly |
| 3 | `geocode` | Nominatim | $0 | P0 | readonly |
| 4 | `reverse_geocode` | Nominatim | $0 | P0 | readonly |
| 5 | `route` | OSRM | $0 | P0 | readonly |
| 6 | `places_nearby` | Overpass | $0 | P0 | readonly |
| 7 | `currency_convert` | Frankfurter | $0 | P0 | readonly |
| 8 | `exchange_history` | Frankfurter | $0 | P1 | readonly |
| 9 | `crypto_price` | CoinGecko demo | $0 | P1 | readonly |
| 10 | `stock_index` | Stooq/Yahoo | $0 | P2 | readonly |
| 11 | `inflation_data` | FRED | $0 | P3 | readonly |
| 12 | `tax_calendar` | Local | $0 | P3 | readonly |
| 13 | `recipe_search` | TheMealDB | $0 | P0 | readonly |
| 14 | `recipe_by_ingredients` | Spoonacular demo | $0 | P0 | readonly |
| 15 | `food_info` | Open Food Facts | $0 | P1 | readonly |
| 16 | `nutrition_lookup` | USDA FDC | $0 | P1 | readonly |
| 17 | `grocery_price_compare` | Scraping+extractor | $0 | P2 | readonly |
| 18 | `unit_convert` | Local | $0 | P1 | readonly |
| 19 | `wikipedia_summary` | Wikipedia REST | $0 | P0 | readonly |
| 20 | `wikipedia_search` | MediaWiki | $0 | P0 | readonly |
| 21 | `wiktionary_define` | Wiktionary | $0 | P1 | readonly |
| 22 | `dictionary_define` | Free Dictionary | $0 | P1 | readonly |
| 23 | `arxiv_search` | arXiv | $0 | P1 | readonly |
| 24 | `crossref_search` | Crossref | $0 | P1 | readonly |
| 25 | `openlibrary_book` | Open Library | $0 | P1 | readonly |
| 26 | `gutenberg_book` | Gutendex | $0 | P2 | readonly |
| 27 | `quote_of_the_day` | ZenQuotes | $0 | P3 | readonly |
| 28 | `number_fact` | Numbers API | $0 | P3 | readonly |
| 29 | `date_fact` | Numbers API | $0 | P3 | readonly |
| 30 | `gdelt_news` | GDELT | $0 | P0 | readonly |
| 31 | `gdelt_trends` | GDELT GKG | $0 | P1 | readonly |
| 32 | `rss_feed` | Local parser | $0 | P0 | readonly |
| 33 | `hacker_news_top` | HN Firebase | $0 | P2 | readonly |
| 34 | `reddit_subreddit` | Reddit JSON | $0 | P2 | readonly |
| 35 | `github_trending` | Scraping | $0 | P3 | readonly |
| 36 | `product_hunt` | OAuth free | $0 | P3 | readonly |
| 37 | `holidays` | Nager.Date | $0 | P0 | readonly |
| 38 | `time_zone_convert` | Local (Intl) | $0 | P0 | readonly |
| 39 | `sun_moon` | Sunrise-Sunset | $0 | P1 | readonly |
| 40 | `countdown_calc` | Local | $0 | P1 | readonly |
| 41 | `cron_parse` | Local | $0 | P1 | readonly |
| 42 | `sleep_tips` | Local | $0 | P2 | readonly |
| 43 | `hydration_reminder` | Local | $0 | P1 | readonly |
| 44 | `medication_schedule` | Local | $0 | P1 | readonly |
| 45 | `bmi_calc` | Local | $0 | P2 | readonly |
| 46 | `activity_by_air` | Compuesto | $0 | P2 | readonly |
| 47 | `qr_generate` | GoQR | $0 | P0 | readonly |
| 48 | `markdown_to_pdf` | Local | $0 | P1 | readonly |
| 49 | `csv_parse` | Local | $0 | P1 | readonly |
| 50 | `ics_export` | Local | $0 | P0 | readonly |
| 51 | `json_export` | Local | $0 | P0 | readonly |
| 52 | `json_import` | Local | $0 | P0 | readonly |
| 53 | `ocr_image` | Ollama LLaVA | $0 | P2 | readonly |
| 54 | `transcribe_audio` | Ollama whisper | $0 | P2 | readonly |
| 55 | `tts_speak` | Ollama Kokoro | $0 | P2 | readonly |
| 56 | `embed_memory` | Ollama nomic | $0 | P0 | local_write |
| 57 | `semantic_search_memory` | Compuesto | $0 | P0 | readonly |
| 58 | `semantic_search_records` | Compuesto | $0 | P0 | readonly |
| 59 | `dedupe_records` | Compuesto | $0 | P1 | local_write |
| 60 | `memory_consolidate` | Compuesto | $0 | P1 | local_write |
| 61 | `entity_extract` | Ollama NER | $0 | P1 | readonly |
| 62 | `web_scrape` | Local fetch | $0 | P0 | readonly |
| 63 | `youtube_transcript` | yt-dlp+whisper | $0 | P1 | readonly |
| 64 | `link_preview` | Local OG | $0 | P1 | readonly |
| 65 | `shorten_url` | is.gd | $0 | P3 | readonly |
| 66 | `hash_text` | Local crypto | $0 | P3 | readonly |
| 67 | `hash_file` | Local crypto | $0 | P3 | readonly |
| 68 | `password_generate` | Local crypto | $0 | P2 | readonly |
| 69 | `uuid_generate` | Local crypto | $0 | P3 | readonly |
| 70 | `base64_encode` | Local | $0 | P3 | readonly |
| 71 | `clipboard_read` | Web API | $0 | P2 | readonly |
| 72 | `clipboard_write` | Web API | $0 | P2 | local_write |
| 73 | `file_read` | Node sandbox | $0 | P2 | readonly |
| 74 | `file_write` | Node sandbox | $0 | P2 | destructive |
| 75 | `shell_run` | Node whitelist | $0 | P3 | destructive |
| 76 | `notify_desktop` | Web Notif | $0 | P1 | local_write |
| 77 | `open_url` | Local | $0 | P1 | readonly |
| 78 | `barcode_lookup` | OFF network | $0 | P1 | readonly |
| 79 | `book_isbn` | Open Library | $0 | P1 | readonly |
| 80 | `product_reviews` | Scraping | $0 | P2 | readonly |
| 81 | `price_history` | Local track | $0 | P3 | readonly |
| 82 | `country_info` | REST Countries | $0 | P1 | readonly |
| 83 | `city_geo_data` | Wikidata | $0 | P2 | readonly |
| 84 | `public_transport` | Variable | $0 | P3 | readonly |
| 85 | `earthquake_recent` | USGS | $0 | P3 | readonly |
| 86 | `aurora_forecast` | NOAA | $0 | P3 | readonly |
| 87 | `tide_data` | NOAA | $0 | P3 | readonly |
| 88 | `aircraft_tracker` | OpenSky | $0 | P3 | readonly |
| 60→89 | `email_draft` | Local | $0 | P0 | readonly |
| 90 | `sms_draft` | Local link | $0 | P1 | readonly |
| 91 | `calendar_add_local` | Local | $0 | P0 | local_write |
| 92 | `share_text` | Web Share | $0 | P1 | readonly |
| 93 | `llm_local_summarize` | Ollama | $0 | P0 | readonly |
| 94 | `llm_local_translate` | Ollama | $0 | P1 | readonly |
| 95 | `llm_local_classify` | Ollama | $0 | P1 | readonly |
| 96 | `llm_local_extract_action_items` | Ollama | $0 | P1 | readonly |
| 97 | `self_health_check` | Local | $0 | P0 | readonly |
| 98 | `state_stats` | Local | $0 | P1 | readonly |
| 99 | `expense_alert` | Local | $0 | P1 | readonly |
| 100 | `news_radar` | Compuesto | $0 | P2 | readonly |

---

# Prioridades por fase

## 🟢 Fase 1 — "Valor inmediato, casi gratis" (P0, ~25 tools)
**Clima + geolocalización extendidos, divisas, recetas, Wikipedia, GDELT, RSS, feriados, zonas horarias, QR, ICS/JSON export, memoria semántica (embeddings), self-health, summarización local.** Todo sin key o con key gratuita, todo alineado con lo que Koru ya hace. Reutiliza infraestructura existente (Ollama, Open-Meteo, GDELT).

## 🟡 Fase 2 — "Profundidad" (P1, ~35 tools)
**Calidad del aire, cripto, nutrición, diccionarios, arXiv, Crossref, Open Library, lugares cercanos, transcripción, TTS local, deduplicación, OCR, YouTube, IT locales, autocuidado.**

## 🔴 Fase 3 — "Nicho / curiosidad" (P2–P3, ~40 tools)
**Resto: humor, datos curiosos, nichos físicos (aurora, mareas, aviones), shell, etc.**

---

# Principios de diseño a respetar (sacados de la auditoría)

1. **Cada tool nueva entra en `TOOL_REGISTRY`** con `ToolPolicy` explícito (risk, requiresApproval, autoRun). Las `destructive` (`file_write`, `shell_run`) exigen aprobación.
2. **Toda tool que toque la web pasa por `structureExtractor`** para validar datos contra cita literal → mantiene el anti-alucinación que ya es el fuerte de Koru.
3. **Cache obligatorio** para APIs con rate-limit (Nominatim 1/s, OSRM, GDELT). Implementar un `toolCache` simple (TTL en memoria + IndexedDB).
4. **User-Agent propio** (`KoruLocal/1.0`) en todas las llamadas externas, especialmente OSM/Nominatim (política).
5. **Preferir local** sobre externo siempre que sea posible: `Ollama` para NER/summarize/translate/OCR/TTS, Web APIs nativas para clipboard/notify/share.
6. **Las tools se describen al LLM en español** (como las actuales) con variantes léxicas en la descripción para ayudar al router.
7. **No inventar datos:** si una API falla o no está configurada, devolver `status: "failed"` y dejar que el system prompt existente impida alucinación.
8. **Las tools de escritura** (`local_write`/`destructive`) aparecen como `suggestedActions` con `requiresApproval: true` → el usuario siempre confirma.

---

# Verificación de límites (junio 2026)

| API | Límite verificado | Notas |
|-----|-------------------|-------|
| [Open-Meteo](https://open-meteo.com/) | 10.000/día, 5.000/h, 600/min | No key, CC BY 4.0, no comercial |
| [Nominatim](https://nominatim.org/) | **1 req/segundo** | User-Agent obligatorio, no bulk |
| OSRM public | No documentado | Cache pesado |
| [GDELT](https://api.gdeltproject.org/) | "Generoso" | Sin key |
| [Frankfurter](https://www.frankfurter.app/) | Sin límite duro | Open source, datos BCE |
| [Open Food Facts](https://world.openfoodfacts.org/data) | "Fair use" | 2.9M productos |
| [TheMealDB](https://www.themealdb.com/api.php) | Key pública "1" | Sin límite práctico |
| [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) | User-Agent obligatorio | Sin key |
| [Reddit JSON](https://www.reddit.com/dev/api/) | User-Agent, ~60/min | OAuth para más |
| [USGS](https://earthquake.usgs.gov/) | Sin key | Ilimitado |
| Ollama local | Tu hardware | $0, sin red |

---

*Documento generado el 2026-06-23 como complemento a la auditoría de Koru.*
