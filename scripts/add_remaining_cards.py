#!/usr/bin/env python3
"""
Agrega las 17 cards faltantes al informe de funcionalidades:
- Media & Info (8 cards): recipe, movie-review, book-review, restaurant-synthesis, news-urgent, important-event, deepsearch, image-generation
- Travel & Decisions (6 cards): travel-planner, route-map, comparison, decision-support, memory, note
- System screens (3 cards): home, create, settings
"""

CARDS = [
    # ============ MEDIA & INFO ============
    {
        "id": "recipe",
        "group": "media",
        "name": "Receta",
        "icon": "restaurant",
        "accent": "#2d6a4f",
        "funcionalidad_actual": "recipe UiBlock y recipe_find tool (TheMealDB, free key '1', 9s timeout, cached 30min) son reales y funcionando. Retorna name, image, category, area, description, instructions, videoUrl, ingredients[], steps[], tips[], servings, prepTime, cookTime, source. Backend mapea primer match a hero recipe block + additional matches a comparison block. Mockup agrega 4 módulos que el data model no lleva: Sinopsis (usa description), Ingredientes (usa ingredients), Pasos como 5-stage timeline con done/current/pending (type tiene steps[] flat, sin progress tracking), Video y fuente con 2 source rows (type solo 1 source + 1 videoUrl).",
        "gaps": [
            ("P0", "Modo cocina step-by-step", "Mockup muestra 4-step timeline con user 'on step 2'. steps[] no tiene status field, sin persistencia, sin cooking timer. Necesita steps: Array<{n, text, status?, timerSec?}>."),
            ("P0", "Múltiples fuentes de video", "Mockup muestra YouTube + Cookpad como rows paralelos. Type tiene single videoUrl. Necesita videos: Array<{provider, url, title, durationSec}> con YouTube embed."),
            ("P1", "Nutrición por porción", "nutrition_calc tool existe pero NO wired a recipe card. Necesita nutrition?: {kcal, protein, carbs, fat, fiber}."),
            ("P1", "Scaling de ingredientes por porción", "servings se muestra pero no editable."),
            ("P1", "Save to recipe collection / shopping list export", "save_personal_item existe pero ingredients[] no se auto-convierten a shopping list."),
            ("P1", "Rating & reviews", "Mockup badge '★ 4.8 · Receta top'. TheMealDB no tiene ratings. Necesita Spoonacular como segunda fuente."),
            ("P2", "Wine pairing module", "wine_pairing tool listado en food capability pero no surfaced en recipe card."),
        ],
        "data_model": "Extender recipe UiBlock: steps: Array<{n, text, status?, timerSec?}>, videos: Array<{provider, url, title, durationSec}>, nutrition?: {kcal, protein, carbs, fat, fiber}, winePairing?: {wine, reason, pairingScore}, rating?: number, ratingCount?: number, cuisineTags?: string[], dietaryTags?: string[].",
        "api_endpoints": "recipe_find ya existe. Agregar Spoonacular API (SPOONACULAR_KEY) para nutrition, ratings, similar-recipe recommendations. YouTube Data API v3 para verified channel + duration metadata en strYoutube URLs.",
        "external_integrations": "TheMealDB (primary, ya wired), Spoonacular (nutrition+ratings+recommendations), YouTube Data API v3 (video metadata).",
        "offline": "Recipe detail (image, ingredients, steps) debe fully persistir a IndexedDB una vez saved. Cooking-mode timeline state debe sync a LifeRecord kind 'meal_inventory' o nuevo 'cooking_session' para resume on reload.",
        "privacy": "Recetas generalmente 'normal'. Diet tags (celiac, diabetic) marcar 'sensitive' — son health data.",
        "ux_flow": "Media playback: reemplazar bare open_in_new YouTube link con embedded iframe (facade pattern: thumbnail + play button → lazy-load iframe on click). Save to collections: Guardar escribe LifeRecord kind 'recommendation' collection 'recipes' con full block snapshot. Agregar al carrito CTA convierte ingredients[] → shopping list. Share: Web Share API con title + image + URL. Allergy warnings: Open Food Facts allergens + user boundary memories ('celiac') → red chips top.",
        "memory_connection": "Taste profile: build preference memory desde saves ('le gusta cocina argentina', 'guardó 3 recetas vegetarianas'). recipe_find debe aceptar __userPreferences arg para sugerir 'algo con lo que tenés en la heladera'. Recommendation engine: cross-reference meal_inventory records (fridge contents) contra recipe ingredients[] para score 'puedes hacer esto con 6/8 ingredientes que tenés'. Proactive: a las 11:30 nudge engine sugiere receta saved para lunch, considerando routine memories ('almuerza 12:30') y boundary memories ('sin gluten').",
    },
    {
        "id": "movie-review",
        "group": "media",
        "name": "Película",
        "icon": "movie",
        "accent": "#8127cf",
        "funcionalidad_actual": "movie_review UiBlock y movie_info tool (TMDB api.themoviedb.org/3, Bearer token, fallback Wikipedia) funcionando. Retorna poster, rating, releaseDate, genres, runtime, director, cast[5], overview. Mockup agrega Equipo técnico tiles (guion, banda, fotografía) — type tiene director y cast[] solo. Dónde verla chips (HBO Max, Netflix, Apple TV, Cines 3D) — type tiene whereToWatch?: string[] pero tool nunca lo popula. Trailer URL — type tiene trailerUrl? pero tool nunca consulta TMDB /videos endpoint.",
        "gaps": [
            ("P0", "Trailer playback", "TMDB /movie/{id}/videos retorna YouTube keys. Wire trailerUrl desde ahí. Inline trailer player en detail (YouTube iframe facade)."),
            ("P0", "Where to watch real", "whereToWatch hardcoded en mockup. Necesita JustWatch API o TMDB /watch/providers (free con TMDB key) retornando {provider, country, deeplink, price?}[]."),
            ("P1", "Full crew", "Director, writer, composer, cinematographer. TMDB /credits retorna crew[] filtered by job. Agregar crew?: Array<{name, job}>."),
            ("P1", "Múltiples ratings", "IMDb, Rotten Tomatoes, Metacritic. Hoy solo TMDB vote_average. Agregar OMDb API (OMDB_API_KEY) para el trío."),
            ("P1", "Reviews aggregation", "review_score UiBlock existe para tile-style scores; necesitamos movie-specific panel pullando TMDB reviews + RT consensus."),
            ("P1", "Save to watchlist", "Guardar genérico hoy. Necesita dedicated collection:'watchlist' con status: to_watch|watching|watched y optional rating después de watching."),
        ],
        "data_model": "Extender movie_review: trailerYoutubeKey?, crew?: Array<{name, job}>, ratings?: Array<{source:'imdb'|'rotten_tomatoes'|'metacritic'|'tmdb', score, outOf}>, streaming?: Array<{provider, country, deeplink, logo, price?}>, awards?: string[], budget?: string, boxOffice?: string.",
        "api_endpoints": "movie_info ya existe. Agregar TMDB /videos (trailers), TMDB /watch/providers (streaming), OMDb API (IMDb/RT/Metacritic scores), IMDb datasets para ID resolution. Optional Trakt API para cross-device watchlist sync.",
        "external_integrations": "TMDB (primary, ya wired), TMDB /videos, TMDB /watch/providers, OMDb API, IMDb datasets, Trakt API (optional).",
        "offline": "Poster image (cached as blob), overview, cast, ratings → persist on save. Streaming availability y trailer muestran 'requires connection' placeholder.",
        "privacy": "Películas generalmente 'normal'. Watchlist revela gustos — 'normal' pero podría ser 'sensitive' si user marca privado.",
        "ux_flow": "Media playback: trailer hero button → expandable YouTube iframe autoplay=1. Default thumbnail es poster backdrop. Save to collections: Watchlist con 3 estados. Después de 'watched', prompt '¿Cómo la calificás? 1-5 🍿' → updates recommendation record + builds taste profile. Share: 'Recomendar esta peli' → genera Koru shareable link con title + poster + Koru's review summary. Content warnings: TMDB release_dates.certification + runtime en user's local format.",
        "memory_connection": "Taste profile: cada watched + rating se vuelve preference memory taggeado con genres, director, decade. 'Le gustan los sci-fi de Villeneuve'. Recommendation engine usa estos para '¿qué peli veo?' suggestions. Proactive: 'Estrenaste Dune 2 en tu watchlist — ¿la viste? La puedo marcar como vista.' Detect new releases matching saved preference memories ('salió la nueva de Nolan').",
    },
    {
        "id": "book-review",
        "group": "media",
        "name": "Libro",
        "icon": "menu_book",
        "accent": "#b45309",
        "funcionalidad_actual": "book_review UiBlock y book_info tool (Open Library openlibrary.org/search.json, caching) funcionando. Retorna title, author, firstPublished, pages, coverUrl, openLibraryUrl. Mockup significativamente más rico: Ficha del autor (birthplace, pseudonym, awards) — type tiene solo author string. Capítulos destacados como 4-step timeline con reading progress — type no tiene chapter concept. Dónde comprar con precios (Amazon $18, Casa del Libro €22, Kindle $9, Audiolibro $14) — type no tiene purchase options.",
        "gaps": [
            ("P0", "Author bio", "Open Library tiene /authors/{olid}.json con bio, birth_date, death_date. Agregar authorBio?: {name, birthYear, birthplace, bio, awards?, photoUrl?}."),
            ("P0", "Chapter highlights", "Open Library /books/{olid} tiene table_of_contents. Agregar chapters?: Array<{n, title, summary?}>. Reading progress is-done/is-current necesita readingProgress?: {currentChapter, percent, lastReadAt} persisted."),
            ("P0", "Purchase options", "Precios reales requieren Google Books API (free, retorna saleInfo con retail price + buy link per country) y Amazon Product Advertising API (paid). Audible/Kindle prices de Google Books saleInfo."),
            ("P1", "Ratings", "Open Library no tiene ratings. Necesita Goodreads (deprecated official API, scrape via goodreads.com/book/show) O Google Books ratings (averageRating, ratingsCount)."),
            ("P1", "ISBN resolution", "Type tiene isbn? pero tool no lo popula. Agregar ISBN lookup para barcode scanning en mobile."),
            ("P1", "Reading list / shelf", "Save con status: to_read|reading|finished. Después de finished, prompt rating → feeds taste profile."),
        ],
        "data_model": "Extender book_review: authorBio?: {name, birthYear, birthplace, bio, awards?, photoUrl?}, chapters?: Array<{n, title, summary?}>, purchase?: Array<{store:'amazon'|'casa_del_libro'|'kindle'|'audible'|'gutenberg', url, price?, format}>, ratings?: Array<{source, score, count}>, isbn?, isbn13?, previewUrl? (Google Books embed), readingProgress?: {currentChapter, percent, lastReadAt}.",
        "api_endpoints": "book_info ya existe. Agregar Google Books API (GOOGLE_BOOKS_KEY) para richer covers, ratings, sale info, preview embeds. Open Library Covers API para high-res covers. Project Gutenberg API para free full-text si public domain. Optional Goodreads scraping (fragile).",
        "external_integrations": "Open Library (primary, ya wired), Google Books API, Open Library Covers API, Project Gutenberg API, Goodreads (optional, scrape).",
        "offline": "Cover, synopsis, chapter list → persist on save. Full text (Gutenberg) → cache as resource_bundle si user opt-in.",
        "privacy": "Libros generalmente 'normal'. Reading list revela intereses — 'normal' pero podría ser 'sensitive' (ej libros de salud mental).",
        "ux_flow": "Media playback: Google Books preview embed (iframe books.google.com/books/preview) para first chapter. Audible sample audio player para audiobooks. Save to collections: Reading list con 3 estados. 'Marcar como leído' → prompt rating → updates taste profile. 'Continuar leyendo' resume at last chapter (via readingProgress). Share: quote highlights — user select text from preview y share via Web Share API con book metadata.",
        "memory_connection": "Taste profile: cada finished + rating se vuelve preference memory con genres, author, era, themes ('le gusta narrativa histórica de Irene Vallejo'). Recommendation engine: cuando user pide 'algún libro para leer', pull from to_read shelf first, luego Open Library /subjects/{genre} filtered por preferred authors + decade. Proactive: 'Salió el nuevo libro de {autor favorito}'. 'Terminaste {libro} hace 2 meses — ¿querés que recomiende algo similar?' Detect new releases polling Open Library /search.json?author={name}&sort=new monthly.",
    },
    {
        "id": "restaurant-synthesis",
        "group": "media",
        "name": "Recomendación restaurante",
        "icon": "restaurant",
        "accent": "#f59e0b",
        "funcionalidad_actual": "restaurant_synthesis UiBlock y restaurant_deep_search tool son la killer feature de Koru. Tool corre 3 parallel DuckDuckGo searches, scrapes pages, usa LLM extraction con validateWithCitations para producir {matches[3], pros, cons, synthesis} donde cada match tiene sourcesMentioning count. Mockup más rico: Desglose por criterio bars (Comida 9.2, Precio 8.5, Servicio 9.0) — type no tiene per-criterion scores. Highlights del menú tiles (Margherita €14, Chianti Riserva, Tiramisú) — type no tiene menu data. Map embed — type no tiene coordinates. Reserve/Call/Navigate CTAs — type tiene labels.reserveAction etc pero no actual URLs.",
        "gaps": [
            ("P0", "Structured place data", "Hoy LLM extrae names de snippets. Necesita real Google Places API (Places Details) para place_id, geometry.location, formatted_address, international_phone_number, opening_hours, price_level, rating, user_ratings_total. Elimina matches alucinados."),
            ("P0", "Per-criterion scoring", "Mockup 9.2/8.5/9.0 bars. Google Places tiene rating (overall) pero no per-criterion. Yelp Fusion tiene per-category ratings. Agregar scores?: {food?, service?, price?, ambiance?, overall} extraído de review text via LLM con citation."),
            ("P1", "Menu highlights", "Mockup Margherita €14. Necesita Google Places Menu (limited availability) O scrape menu pages. Agregar menuHighlights?: Array<{dish, price?, description?}>."),
            ("P1", "Map embed", "Static Google Maps embed con pins para cada match. Necesita location?: {lat, lng} per match."),
            ("P1", "Reservation deep links", "TheFork API (/api/v1/restaurants/{id}/availability) para real-time table availability; OpenTable affiliate links; Google Places reservation_url."),
            ("P1", "Distance from user", "Mockup muestra '400m', '600m'. Necesita user geolocation (browser API + profile memory para home/work coords) y Google Distance Matrix."),
        ],
        "data_model": "Extender restaurant_synthesis matches[] con placeId?, lat?, lng?, address?, phone?, hours?, priceLevel?, rating?, ratingCount?, scores?: {food, service, price, ambiance, overall}, menuHighlights?: Array<{dish, price?, description?}>, reserveUrl?, distanceFromUser?, travelTimeMin?, imageUrl?. Agregar mapEmbed?: string.",
        "api_endpoints": "Google Places API (Place Search + Details + Photos + Menu, GOOGLE_PLACES_KEY), Yelp Fusion (YELP_API_KEY), TheFork API (THEFORK_KEY), Google Maps Static/Embed API, Google Distance Matrix. Keep current DuckDuckGo+LLM como graceful fallback cuando no API keys.",
        "external_integrations": "Google Places API, Yelp Fusion, TheFork API, Google Maps Embed, Google Distance Matrix, DuckDuckGo (fallback).",
        "offline": "Top matches' names, addresses, scores → persist on save. Photos, map, live availability → require connection. Show 'disponibilidad actualizada hace X min' timestamp.",
        "privacy": "Restaurantes 'normal'. User location 'sensitive' — solo lat/lng de home/work persistidos, nunca live GPS.",
        "ux_flow": "Media playback: Google Places photos carousel (replace mockup gradient hero). Panoramic interior shots. Save to collections: 'Mis restaurantes' collection con tried|want_to_try. Después de tried, prompt user's own score → feeds recommendation engine. Share: share match's name + address + map pin via Web Share API. Fact-check: ya presente conceptualmente (sourcesMentioning: N). Promover a visible 'X fuentes coinciden' badge per match. 'Reseña verificada en Google + Yelp' badge.",
        "memory_connection": "Taste profile: cuisine preferences ('le gusta italiano auténtico'), price sensitivity (€25pp avg), neighborhood preferences ('come en Chamberí'). Cada saved tried restaurant con user score feeds esto. Recommendation engine: '¿dónde como?' → use location profile memory + cuisine preferences + budget. Sort matches by scores.food × 0.5 + distance_score × 0.3 + price_match × 0.2. Proactive: Friday 19:00 → '¿Cena italiana en Chamberí como te gustó la semana pasada? Tengo mesa en Osteria a las 21:00.' Detect new openings via Google Places newly_opened filter, weekly poll.",
    },
    {
        "id": "news-urgent",
        "group": "media",
        "name": "Noticia urgente",
        "icon": "breaking_news",
        "accent": "#ef4444",
        "funcionalidad_actual": "Sin dedicated urgent_now UiBlock wiring. Mockup usa generic urgent_now block (eyebrow, icon, headline, description) demasiado sparse para el rich mockup (timeline de 5 updates, fact-check chips con check/x/warning, 4 source rows con favicons). news_urgent y news_topic tools (trending.ts) consultan GDELT (free, no key) para latest 8 articles matching 'urgente OR última hora' + region. Mockup earthquake-specific data (magnitude 6.4, epicenter, replicas) requiere domain-specific sources que el tool no llama.",
        "gaps": [
            ("P0", "Dedicated news_urgent UiBlock", "Con headline, summary, timeline: Array<{time, event, status}>, factChecks: Array<{claim, verdict, source}>, sources, severity: 'breaking'|'urgent'|'important', category: 'earthquake'|'politics'|'conflict'|'market'|'weather', location?: {lat, lng, label}, lastUpdated."),
            ("P0", "Fact-check badges", "Mockup muestra 'Epicentro confirmado USGS ✓ / Magnitud 6.4 oficial ✓ / Tsunami NO confirmado ✗ / Heridos sin verificar ⚠'. Necesita Google Fact Check Tools API + cross-source verification (claim en ≥3 sources independientes = confirmed)."),
            ("P0", "Domain-specific feeds", "Earthquakes → USGS Earthquake Hazards API. Weather alerts → NOAA NWS API. Conflict → ACLED. Markets → ya wired via crypto_price y stock_quote."),
            ("P1", "Live timeline updates", "Mockup 5 events (14:32 epicenter → 14:50 heridos). Necesita polling/SSE subscription que prependa nuevos events. proactive_signal es el nudge primitive correcto."),
            ("P1", "NewsAPI / Reuters RSS", "GDELT solo miss Spanish-local breaking news. Agregar NewsAPI (NEWSAPI_KEY) y RSS parsing de reuters.com, bbc.com, eldiario.es, clarin.com."),
            ("P1", "Map for geographic events", "Earthquake epicenter map pin."),
        ],
        "data_model": "Nuevo news_urgent UiBlock: headline, summary, timeline: Array<{time, event, status}>, factChecks: Array<{claim, verdict:'confirmed'|'denied'|'unverified', source}>, sources: AssistantSource[], severity, category, location?: {lat, lng, label}, lastUpdated: ISO, relatedEvents: Array<{time, label, status}>.",
        "api_endpoints": "GDELT (ya wired), USGS Earthquakes (earthquake.usgs.gov/fdsnws/event/1/query), NOAA NWS API, NewsAPI (NEWSAPI_KEY), Google Fact Check Tools API (FACTCHECK_KEY), RSS parsing (fetchText + rss-parser-equivalent).",
        "external_integrations": "GDELT, USGS Earthquakes, NOAA NWS, NewsAPI, Google Fact Check Tools API, RSS feeds (Reuters, BBC, eldiario, clarin).",
        "offline": "Last-known state persiste. On reconnect, show 'Actualizado hace X min — refrescando' y re-poll. Breaking-news push via worldSignalsEnabled flag (ya en KoruState).",
        "privacy": "News data público. User's followed topics es personal preference — 'normal' pero podría ser 'sensitive' (ej sigue temas salud).",
        "ux_flow": "Media playback: inline video para events con TV coverage (BBC/Reuters YouTube live streams). Photo carousel de event imagery. Save to collections: 'Seguir esta historia' → crea recommendation record que trigger proactive_signal nudges cuando story updates. 'Historias seguidas' collection. Share: share headline + source + Koru's fact-check summary as image card. Fact-check badges: prominent ✓/✗/⚠ chips per claim, cada tappable para reveal source URL. Color-coded: green=verified ≥3 sources, yellow=unverified, red=contradicted.",
        "memory_connection": "Taste profile: topics user follows ('le interesa Medio Oriente', 'sigue terremotos'). Built desde 'seguir esta historia' actions. Recommendation engine: cuando followed story updates, generate proactive_signal severity:'important' link back to saved story. Proactive: morning brief incluye top breaking story de followed topics. 'Epicentro del terremoto de Turquía se actualizó — 12 heridos confirmados'.",
    },
    {
        "id": "important-event",
        "group": "media",
        "name": "Evento importante",
        "icon": "event",
        "accent": "#4f46e5",
        "funcionalidad_actual": "CalendarEvent type minimal: id, title, startsAt, endsAt, location, source:'manual'|'ics', sourceRef, createdAt. calendar_add, calendar_show, calendar_export_ics tools generan local events + ICS export — sin two-way sync. Mockup más rico: Countdown timer (02:14 updating live) — type no tiene countdown logic. Agenda del evento como 5-block timeline — type no tiene agenda field. Asistentes con confirmation status — type no tiene attendees. Zoom deep link — type tiene location como string solo.",
        "gaps": [
            ("P0", "Real countdown timer", "Necesita client-side hook que tickea cada segundo y updates k-detail-hero-badge. No backend, solo useCountdown(startsAt) React hook en unified card renderer."),
            ("P0", "Agenda extraction", "Parse event description para time blocks. Hoy description es plain text. Necesita LLM extraction a agenda: Array<{time, label, durationMin}>. O read from Google Calendar description que often tiene structured agenda."),
            ("P0", "Attendees con RSVP", "attendees: Array<{name, email, status:'confirmed'|'tentative'|'declined'|'org', role}> populated from Google Calendar API o Zoom API."),
            ("P0", "Zoom/Meet deep links", "Detect URLs en location o description y render como tappable 'Unirse a la reunión' button. meetingLink?: {provider:'zoom'|'meet'|'teams', url, meetingId, passcode?}."),
            ("P0", "Two-way calendar sync", "Hoy ICS export solo. Necesita Google Calendar API OAuth (googleapis.com/auth/calendar) para true sync: events created en Koru aparecen en Google, events en Google aparecen en Koru."),
            ("P1", "Conflict detection", "Al crear nuevo event, check contra calendarEvents[] para overlaps. Show warning en clarifying_question block."),
            ("P1", "Pre-event preparation", "Pull related docs (resource_bundle), open files, set phone-to-DND. actionPreparationEnabled flag existe pero no tied to events."),
        ],
        "data_model": "Extender CalendarEvent: attendees?: Array<{name, email, status, role}>, agenda?: Array<{time, label, durationMin}>, meetingLink?: {provider, url, meetingId, passcode?}, conferenceData?, recurrence?, reminders?: Array<{minutesBefore, method}>, sourceUrl? (link a Google Calendar event).",
        "api_endpoints": "Google Calendar API (OAuth, GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET), Microsoft Graph API para Outlook, Zoom API (ZOOM_CLIENT_ID) para meeting creation, Google Meet (creates meet link via Calendar API), Apple Calendar via ICS subscription (ya soportado, one-way).",
        "external_integrations": "Google Calendar API, Microsoft Graph API, Zoom API, Google Meet, Apple Calendar (ICS).",
        "offline": "Todos events desde last sync persisten. New events created offline queue para sync. Countdown timer funciona offline. 'Unirse a la reunión' button requiere online (o abre native app via deep link).",
        "privacy": "Calendar events 'normal' pero meeting URLs y attendee lists 'sensitive'. OAuth tokens en OS keychain.",
        "ux_flow": "Media playback: native Zoom/Meet app deep links en mobile (zoommtg://, https://meet.google.com/). En desktop, browser-launch meeting. Save to collections: Events ya viven en calendarEvents[] (no collections). Agregar 'Pin to home' para próximos 3 events como widgets. Share: 'Invitar a esta reunión' → generate ICS file con agenda + meeting link, share via Web Share API. Timezone verification ('16:00 CET — son las 11:00 en Bs As para Mar ACME') para cross-timezone events.",
        "memory_connection": "Taste profile: meeting patterns ('se reúne con ACME los lunes 16:00'). Attendee relationships (relationship memory: 'Carlos Pérez es CEO de ACME'). Recommendation engine: 'Antes de tu meeting con ACME, preparé el Q1 deck y los KPIs del último trimestre' — surfaces relevant resource_bundle files based on attendee + topic. Proactive: 15-min before meeting → proactive_signal 'En 15 min: Q1 Review con ACME. ¿Querés que abra el deck?' Travel-time-aware ('Salí ahora, hay 20 min de tráfico').",
    },
    {
        "id": "deepsearch",
        "group": "media",
        "name": "Deepsearch",
        "icon": "manage_search",
        "accent": "#8363f9",
        "funcionalidad_actual": "deliverable UiBlock y runDeepResearchFlow son la parte más madura de Koru. Flow: (1) LLM genera 4 sub-queries, (2) parallel runSearch({mode:'world'}) calls collect sources, (3) LLM sintetiza JSON con {title, description, summary, categories, metrics, sections}, (4) renderiza deliverable block con progress emissions 6%, 12%, 55%, 78%, 100%. Sources deduplicated by URL. Mockup agrega Síntesis IA (usa summary), Hallazgos clave como scroller cards con confidence per finding (type sections son generic; sin per-finding confidence), Consultas relacionadas como 4 chips (type no tiene relatedQueries field).",
        "gaps": [
            ("P0", "Per-finding confidence", "Mockup muestra '92% confianza · 3 fuentes' per finding. Type sections[].items no tiene confidence o sourcesCount. Extender items con confidence?: number, sourcesCiting?: number, citations?: string[]."),
            ("P0", "Related queries", "Mockup 4 follow-up chips. Necesita LLM-generated relatedQueries?: string[] después de synthesis. Clicking corre runDeepResearchFlow again."),
            ("P1", "Citation graph", "Cada claim en summary y sections[].paragraphs debería link a source URLs. Inline [1], [2] citations como Wikipedia."),
            ("P1", "Source verification scoring", "Cada source gets credibilityScore (domain authority: stanford.edu=high, random blog=low). Confidence metric = weighted average de citing sources' credibility."),
            ("P1", "Freshness scoring", "Sources older than 2 years get 'desactualizado' warning. System prompt ya dice 'priorizá resultados del último mes' pero no enforced en scoring."),
            ("P1", "Opinion vs fact distinction", "Cada finding taggeado type: 'fact'|'opinion'|'forecast'. Mockup 'se recomienda exposición 15-25%' es opinion, no fact."),
        ],
        "data_model": "Extender deliverable: relatedQueries?: string[], confidence?: number (overall), freshness?: {oldest, newest, median}, per-section citations?: string[] (URLs), per-item confidence?, sourcesCiting?, type?: 'fact'|'opinion'|'forecast'. Agregar sources[] con credibilityScore?, publishedAt?, archivedUrl?.",
        "api_endpoints": "DuckDuckGo HTML scraping (ya wired en searchAndEnrich), Bing Search API (BING_SEARCH_KEY) para higher-quality results, Wikipedia API para verified facts, Google Scholar para academic sources, Wayback Machine para source archival (deleted article no rompe citations). Domain authority JSON manualmente curated (.gov, .edu, established media = high).",
        "external_integrations": "DuckDuckGo (ya wired), Bing Search API, Wikipedia API, Google Scholar, Wayback Machine.",
        "offline": "Saved research = full block snapshot en IndexedDB. Clicking source abre archived Wayback version si original está down.",
        "privacy": "Research topics 'normal' pero podrían ser 'sensitive' (ej investigación médica personal). User puede mark research as sensitive → hidden from chat recall.",
        "ux_flow": "Media playback: embed relevant YouTube videos, infographics from sources, PDF previews para academic sources. Save to collections: 'Mi biblioteca de investigación' con tags. 'Seguir este tema' → re-runs research monthly y notifica changes. Share: share research as PDF (pdfExport.ts — necesita deliverable-aware renderer con citations + sources, actualmente ausente). Fact-check badges: per-finding '✓ 3 fuentes confirman' / '⚠ 1 fuente, baja credibilidad' / '✗ Fuentes contradictorias'. Color-coded confidence bars.",
        "memory_connection": "Taste profile: research interests ('invierte en IA', 'sigue geopolítica China'). Built desde saved research topics. Taggeado con interest memory kind. Recommendation engine: cuando user abre new chat, surface '¿Seguimos investigando X?' si hay recent saved research en related topic. Proactive: monthly 'Tu investigación sobre IA en 2025 tiene 2 nuevas fuentes relevantes' → re-run con delta detection (solo show what changed).",
    },
    {
        "id": "image-generation",
        "group": "media",
        "name": "Creación de imágenes",
        "icon": "auto_awesome",
        "accent": "#ec4899",
        "funcionalidad_actual": "🔴 CERO backend. generation UiBlock existe con {title, prompt, resultType:'text'|'image'|'code'|'document', preview, actionLabel, actionIcon}. Presentation layer lo renderiza. NINGÚN tool en /src/tools/ llama image generation API. grep para image_generation|generate_image|dall-e|stable_diffusion|koru_image retorna zero matches. Mockup muestra 4 variants, 8s generation time, 'Koru-Image v2' model name, prompt engineering tips, technical details — todo hardcoded HTML.",
        "gaps": [
            ("P0", "Actual image generation tool", "Crear src/tools/media/imageGen.ts con image_generate tool. Primary: DALL-E 3 via OpenAI API (OPENAI_API_KEY). Fallback: Stable Diffusion XL via Stability AI (STABILITY_API_KEY). Optional: Koru-Image v2 (branded wrapper)."),
            ("P0", "Multi-variant generation", "Mockup 4 variants. DALL-E 3 genera 1 per call; SDXL puede batches. Correr 4 parallel calls con prompt variations, return images: Array<{id, url, promptVariant, style, seed}>."),
            ("P1", "Prompt engineering suggestions", "Mockup 5 tips. Necesita LLM call (chatFn) que analice user's prompt y sugiera mejoras: 'Especifica resolución', 'Menciona estilo', 'Añade iluminación', 'Evita negaciones', 'Usa referencias'."),
            ("P1", "Style presets", "Realistic, Ukiyo-e, Cinematic, Anime, 3D render, Oil painting. Cada uno adds style suffix al prompt."),
            ("P1", "Aspect ratio control", "Mockup 1024×1024. Agregar aspectRatio: '1:1'|'16:9'|'9:16'|'4:3'."),
            ("P2", "Image editing", "Inpainting, outpainting, variation generation desde selected variant."),
            ("P1", "Save to gallery", "'Mis imágenes' collection con prompt history. Re-use prompt as template."),
            ("P1", "NSFW/safety filtering", "OpenAI DALL-E tiene built-in; SDXL necesita separate safety classifier."),
        ],
        "data_model": "Extender generation UiBlock → split en image_generation block: prompt, enhancedPrompt? (after LLM refinement), style?, aspectRatio?, model?, images: Array<{id, url, thumbnailUrl, seed, promptVariant, generationMs}>, tips?: string[], negativePrompt?, seed?, totalCost?. Keep generation como parent para text/code/document.",
        "api_endpoints": "DALL-E 3 via OpenAI (OPENAI_API_KEY, gpt-image-1 o dall-e-3, $0.04-0.12 per image), Stability AI SDXL (STABILITY_API_KEY, $0.003-0.01 per image) cheaper fallback, Replicate (REPLICATE_API_KEY) para Flux/Koru-Image v2 wrappers. Image storage: Cloudflare R2 o AWS S3 (S3_BUCKET) para persistence (no store base64 en DB).",
        "external_integrations": "OpenAI DALL-E 3, Stability AI SDXL, Replicate, Cloudflare R2/AWS S3 storage.",
        "offline": "Generated images persisten as blobs en IndexedDB. Re-generation requiere conexión. Prompt history funciona offline.",
        "privacy": "Images 'normal' pero prompts pueden revelar intereses sensibles. Prompts con keywords salud/violencia marcar 'sensitive'. NSFW filtering mandatory. AI-generated watermark + 'Imagen generada por IA · Koru-Image v2' attribution per image (EU AI Act transparency).",
        "ux_flow": "Media playback: image gallery con lightbox viewer. Pinch-to-zoom en mobile. Download full-res button. Save to collections: 'Mis imágenes' con tags. 'Usar como fondo', 'Compartir', 'Variación' (regenerates con same prompt + new seed). Share: Web Share API con image file (no just URL) para native share sheet. 'Enviar a Instagram Stories' deep link. AI-generated watermark + attribution.",
        "memory_connection": "Taste profile: aesthetic preferences ('le gusta estilo ukiyo-e', 'prefiere atardeceres', 'usa prompts cinematográficos'). Built desde saved images + style history. Taggeado as interest memory. Recommendation engine: cuando user pide 'generá una imagen' sin context, suggest styles based on past usage. '¿Otra en estilo ukiyo-e como la del jardín japonés?' Proactive: 'Tu imagen del jardín japonés generó 5 likes en [red social] — ¿querés una variación?' Detect cuando saved image could enhance chat reply ('estás hablando de un atardecer, ¿genero una imagen?').",
    },
    # ============ TRAVEL & DECISIONS ============
    {
        "id": "travel-planner",
        "group": "travel",
        "name": "Planificación de viaje",
        "icon": "flight_takeoff",
        "accent": "#3b82f6",
        "funcionalidad_actual": "Mockup muestra trip Tokio ('7 días en Japón · €2.160 total') como compact card con 3 métricas y 4-module extended view: day-by-day itinerary timeline, reservations tiles, packing checklist chips, budget breakdown. Todo HARDCODED HTML — no TravelPlan type, no LLM generation path, no booking deep links, no itinerary persistence. Guardar y PDF action buttons son dead <button> tags sin handler.",
        "gaps": [
            ("P0", "LLM-driven itinerary generation", "Chat intent 'planificá un viaje a Japón en marzo' debe producir structured TravelPlan block, no free text."),
            ("P0", "Live pricing", "Flight/hotel/JR Pass totals deben venir de real APIs, no mockup €780/€820."),
            ("P0", "Booking deep links", "Cada reservation tile debe abrir partner app o web checkout pre-filled (Google Flights, Booking.com, Airbnb, JR Pass official, OpenTable/Tabelog)."),
            ("P1", "Editable itinerary", "Drag-to-reorder days, add/remove activities, attach notes per day."),
            ("P1", "Weather forecast per day", "Per-day weather chip en itinerary timeline."),
            ("P1", "Transport-time awareness", "Walking/train/driving time entre consecutive activities, computed via Google Maps Directions API."),
            ("P1", "Packing checklist real", "k-chips son static; necesita checkbox state + auto-suggestions based on destination climate/culture."),
            ("P1", "Budget tracking live", "Cuando booking confirmed, mark tile 'reservado ✓' y lock price; remaining budget updates."),
            ("P1", "Currency conversion", "¥29.110 necesita €-equivalent at today's FX rate, ambos shown."),
        ],
        "data_model": "Nuevo TravelPlan type: id, destination, travelers, dateRange, days: TravelDay[], reservations: Reservation[], packing: PackingItem[], budget: BudgetLine[], totalCurrency. Extender LifeRecordKind con 'travel_plan'. Agregar travelPlan?: TravelPlan a LifeRecord. Reservation necesita provider, confirmationCode, deepLink, status:pending|confirmed|cancelled, bookedAt.",
        "api_endpoints": "Google Flights (Skyscanner o Kiwi.com Tequila API), Booking.com Affiliate API, Airbnb unofficial via rapidapi, JR Pass official shop (no API — scrape o manual link), Google Maps Places + Directions, OpenWeather One Call 3.0, Wise/ECB FX rates API. Para Spain: Renfe API para domestic trains.",
        "external_integrations": "Skyscanner/Kiwi.com (flights), Booking.com (hotels), Airbnb (rentals), Google Maps (directions), OpenWeather (forecast), Wise/ECB (FX), Renfe (Spain trains).",
        "offline": "Full itinerary readable offline (cached en IndexedDB). Booking deep links funcionan offline (just open URL). Pricing data muestra last-known + staleness timestamp. Weather degrada a climatology averages cuando offline.",
        "privacy": "Travel data es PII-rich (passport implícito, home address para outbound flight). Todos reservations stored encrypted-at-rest (WebCrypto AES-GCM con key derivada de user passphrase). Sensitive fields (confirmationCode, passport) taggeados sensitivity:'sensitive'. NUNCA enviados a third-party LLMs sin redaction.",
        "ux_flow": "Itinerary building: chat-initiated → confirm parameters (dates, budget, travelers) → streaming LLM produce day-by-day → user edits inline → tap 'Reservar' en cualquier tile. Booking deep links: cada reservation tile becomes CTA — tapping abre provider app/web con params pre-filled. Offline access: download trip as PDF (PDF button becomes real via jsPDF + structured TravelPlan). Pinned trips appear en 'Mis Colecciones → Viajes' con globe icon. Trip timeline: vertical timeline con day cards; swipe left/right between days; weather chip per day; 'tiempo entre actividades' badge computed from Maps API. Checklist completion: packing items gain checkbox + auto-suggest; items turn green when checked; trip readiness progress bar top.",
        "memory_connection": "Trip saved as collection entry con kind:'travel_plan', collection:'Viajes'. CollectionsScreen ya tiene /viaje/i → flight icon mapping — funciona out of the box. Memory linkage: después del trip, Koru pregunta '¿Cómo fue el viaje?' — answer feeds MemoryFact kind:'preference' o 'goal' (ej 'prefiere hoteles boutique'). Future travel suggestions leverage estos facts. Outcome tracking: 6 meses después, Koru surfaces 'Tu viaje a Japón — ¿lo recomendarías?' → updates recommendation LifeRecord linked al original trip via sourceEntryId. Currency memory: Koru aprende 'usuario prefiere ver precios en EUR'. Confidence decay: sensitive travel details auto-archive 90 días después return.",
    },
    {
        "id": "route-map",
        "group": "travel",
        "name": "Ruta y navegación",
        "icon": "map",
        "accent": "#4f46e5",
        "funcionalidad_actual": "Mockup muestra 'Ruta a Aeropuerto Barajas · 12.4 km · 24 min ETA' con 3 métricas. Extended view 3 módulos: step-by-step directions timeline (4 hardcoded steps), ETA + 4 alternative routes, traffic module. Todos valores static. Sin map tile, sin real-time traffic refresh, sin turn-by-turn navigation, sin live GPS.",
        "gaps": [
            ("P0", "Real map rendering", "Embed actual <MapView> (Mapbox GL JS o Google Maps JS API) mostrando polyline route, no CSS gradient hero."),
            ("P0", "Live traffic refresh", "Poll traffic API cada 60s mientras card open; show staleness ('hace 30s')."),
            ("P0", "Turn-by-turn navigation", "Handoff a native maps app (Google Maps geo: URI en Android, maps:// en iOS) O in-app navigation mode con voice prompts (Web Speech API)."),
            ("P1", "Dynamic re-routing", "Si traffic worsens mid-route, surface better alternative con 'Ahorra 6 min · cambiar ruta?' CTA."),
            ("P1", "Public transit mode", "Hoy solo car. Agregar transit/walk/bike modes; pull Madrid EMT/Metro schedules."),
            ("P1", "Spain-specific traffic", "DGT incidencias API para roadworks/accidents; Renfe Cercanías para transit legs."),
            ("P1", "Save frequent routes", "'Casa → Trabajo', 'Casa → Aeropuerto' — con notification triggers ('Salí ahora para llegar a las 17:30 al aeropuerto')."),
            ("P1", "Fuel/charging stops", "Para EVs, integrate charging stations (Electromap API); para ICE, gas station prices (Geoportal Ministerio de Industria)."),
        ],
        "data_model": "Nuevo Route type: id, origin, destination, mode:'driving'|'transit'|'walking'|'bicycling', steps: RouteStep[], polyline, distanceMeters, durationSec, trafficLevel, alternatives: Route[], fuelEstimateLiters, co2Grams, departAt, arriveBy. Extender LifeRecordKind con 'route'. Agregar route?: Route a LifeRecord. RouteStep tiene instruction, distanceMeters, maneuver, streetName, polylineStartIndex.",
        "api_endpoints": "Google Maps Directions + Distance Matrix + Roads API (o Mapbox Directions + Traffic Flow), Waze Deep Links (waze://?ll=...&navigate=yes), DGT traffico API (infocar.dgt.es/etraffic/), Madrid EMT API (Bus arrivals), Metro de Madrid API, OpenChargeMap para EV chargers, TomTom ORS para routing fallback.",
        "external_integrations": "Google Maps Directions/Distance Matrix/Roads, Mapbox, Waze, DGT, Madrid EMT, Metro de Madrid, OpenChargeMap, TomTom.",
        "offline": "Last-known route cached; steps readable offline; map tiles cached via Service Worker para route's bounding box only (storage budget 50MB). Cuando offline, card muestra 'Modo offline · datos de hace X min' badge y disable re-routing.",
        "privacy": "Location data highly sensitive. Live GPS nunca persisted — solo origin/destination geocodes stored. Frequent routes saved as kind:'routine' memories con sensitivity:'sensitive'. Weekly location heatmap computed localmente solo, nunca uploaded.",
        "ux_flow": "Turn-by-turn: sticky bottom bar con next maneuver icon + distance ('300 m → girar derecha'). Tapping 'Navegar' abre native maps app con route pre-loaded. Live traffic: ETA chip pulses red/green as traffic changes; 'Mejor ruta' banner cuando alternative saves ≥3min. Alternate routes: side-by-side tiles con time + traffic color; tap to switch. Departure timing: 'Salí en 12 min para llegar a las 17:30' — backcalculate from arrival time + current traffic + buffer. Hands-free: voice prompts via speechSynthesis; mute toggle. Multi-modal: Car → walk → transit combos.",
        "memory_connection": "Frequent routes auto-saved as kind:'routine' memories ('conduce al trabajo 8:15 AM lunes-viernes') con confidence decay — si user cambia job, memory es superseded. Saved routes aparecen en 'Mis Colecciones → Rutas' con map icon. Decision linkage: si user choosing entre dos apartments, route card computa commute to work para cada uno → feeds card-decision-support. Travel linkage: route to airport auto-linked a upcoming TravelPlan reservation flight. Notification: 'Salí en 25 min — vuelo IBERIA a las 18:30'. Memory confidence: routine route memories decay después 30 días de no use → re-prompt '¿Seguís yendo a [destino]?'.",
    },
    {
        "id": "comparison",
        "group": "travel",
        "name": "Comparativa de productos",
        "icon": "compare_arrows",
        "accent": "#8363f9",
        "funcionalidad_actual": "Mockup compara 'iPhone 16 Pro vs Galaxy S24' — compact card 2 opciones, price range, top pick. Extended view 3 módulos: top pick recommendation, comparison matrix (4 rows), Pros/Cons tiles. Todos scores hardcoded. Sin product API, sin price history, sin review aggregation, sin user-configurable factors.",
        "gaps": [
            ("P0", "User-configurable factors", "Let user weight factors ('cámara pesa 40%, batería 30%, precio 30%'); recompute top pick live."),
            ("P0", "Real product data", "Pull specs from product APIs (BestBuy, Amazon PA-API, Idealo)."),
            ("P1", "Price history", "Show 90-day price chart (camelcamelcamel-style); highlight 'now is a good time' o 'wait for Prime Day'."),
            ("P1", "Review aggregation", "Aggregate reviews from Amazon, RTings, The Verge, Reddit threads; surface sentiment per factor."),
            ("P1", "Side-by-side spec matrix", "Full table, no solo 4 rows; collapsible 'show all specs'."),
            ("P1", "Add/remove options", "User puede agregar 3er phone, drop one; recompute."),
            ("P1", "Price alerts", "'avisame cuando baje de $999' → push notification via Service Worker."),
            ("P1", "Outcomes loop", "30 días después purchase, Koru pregunta '¿Estás conforme con el iPhone?' → feeds future recommendation memory."),
        ],
        "data_model": "Nuevo Comparison type: id, subject ('smartphone'|'laptop'|'car'), options: ComparisonOption[], factors: ComparisonFactor[], weights: Record<factorId, number>, winner, createdAt, outcome?: {chosenOptionId, satisfaction1to5, notes}. ComparisonOption tiene name, imageUrl, specValues: Record<factorId, number|string>, price, priceHistory: PricePoint[], reviewSummary. ComparisonFactor tiene id, label, icon, direction. Extender LifeRecordKind con 'comparison'.",
        "api_endpoints": "Amazon Product Advertising API 5 (PA-API) para prices/specs/reviews, BestBuy Products API, Idealo Price Comparison API, Keepa API (price history graphs), RTings structured data (scrape con consent), Reddit API para community sentiment (PRAW), Google Shopping Graph (limited public access), Trustpilot API para service comparisons.",
        "external_integrations": "Amazon PA-API, BestBuy API, Idealo, Keepa, RTings, Reddit API, Google Shopping Graph, Trustpilot.",
        "offline": "Cached comparison fully browsable offline; price history muestra last fetch timestamp; price alerts queued y fired when back online (Service Worker sync event).",
        "privacy": "Comparison subjects a veces revelan sensitive life events (ej comparando CPAP machines, fertility clinics). Default sensitivity:'normal', pero user puede mark comparison as 'sensitive' → hidden from chat recall y excluded from cloud sync.",
        "ux_flow": "Side-by-side matrix: sticky first column con factors, scrollable option columns; tap cell para ver source/review excerpt. Factor weighting: sliders en right rail; live recompute muestra 'Top: iPhone → Top: Galaxy' transition con animation. Price alerts: bell icon en cada option → 'avisame si baja a $X' → registered en Commitment type. Review summary: per-factor sentiment chip ('Cámara: 9.4 (1.2k reviews, 89% positive)'); tap → opens review list. Outcomes tracking: 30/90/180 días post-decision, Koru prompts '¿Cómo te fue con el iPhone?' — answer becomes MemoryFact kind:'preference' que informs future comparisons.",
        "memory_connection": "Comparison saved as kind:'comparison' en collection 'Comparativas' — CollectionsScreen lacks /compar/i icon mapping → add [/compar/i, 'compare_arrows']. Decision support linkage: comparison con 3+ weighted factors y chosen option becomes input a card-decision-support para similar future decisions. Memory confidence: user preferences extracted from comparisons ('usuario prioriza cámara sobre batería') stored as kind:'preference' facts con confidence boosted en cada consistent comparison. Outcome decay: si user reports low satisfaction con past choice → confidence en underlying preference fact drops 0.15. Collection grouping: todas phone comparisons grouped under 'Smartphones' subcollection; todas apartment comparisons under 'Vivienda'.",
    },
    {
        "id": "decision-support",
        "group": "travel",
        "name": "Soporte de decisión",
        "icon": "psychology_alt",
        "accent": "#8127cf",
        "funcionalidad_actual": "Mockup muestra '¿Cambiar de trabajo en 2025? · 3 opciones · 74% confianza · Recomendado: startup'. Extended view 4 módulos: options con probabilidades (Quedarse 35%, Startup 55% Recomendado, Freelance 10%), 6 factor chips, trade-off matrix (4 tiles), Koru's natural-language recommendation. Todas probabilidades hardcoded — no hay actual decision algorithm corriendo. LifeRecordKind INCLUYE 'decision' pero no Decision structured type existe.",
        "gaps": [
            ("P0", "Real decision-matrix algorithm", "Implementar weighted additive model (WADD), equal weight (EW), take-the-best (TTB), probabilistic Monte Carlo. Compute per-option utility score."),
            ("P0", "Probability scoring", "Bayesian update: prior from user's risk profile + likelihood from factor scores → posterior probability per option. Show confidence interval, no point estimate."),
            ("P0", "User-configurable factors & weights", "Drag-to-reorder factor importance; live recompute."),
            ("P1", "Outcome tracking", "6 meses después decisión, prompt '¿Cómo te fue?' → bayesian-update prior para next time."),
            ("P1", "Sensitivity analysis", "'If you weighted Estabilidad 20% more, recommendation would flip to Quedarse.' Show tornado chart."),
            ("P1", "Pre-mortem", "Para cada option, LLM genera '3 ways this could go wrong in 12 months' — surfaces hidden risks."),
            ("P1", "Decision journal", "Chronological history de todas past decisions; pattern detection ('cuando elegís la opción segura, te arrepentís el 60% de las veces')."),
            ("P1", "Time-bounded", "Mockup muestra 'Decisión en 2 sem' — actually enforce deadline con reminder."),
        ],
        "data_model": "Nuevo Decision type: id, question, deadline, options: DecisionOption[], factors: DecisionFactor[], weights: Record<factorId, number>, algorithm:'wadd'|'ttb'|'montecarlo', result: {perOptionScore, perOptionProbability, recommendation, confidenceInterval}, outcome?: {chosenOptionId, decidedAt, satisfaction1to5, followUpAt, notes}, linkedMemoryIds: string[]. DecisionOption tiene id, label, factorScores: Record<factorId, number>, priorProbability, riskProfile. Agregar decision?: Decision a LifeRecord.",
        "api_endpoints": "Sin first-party APIs. Decision algorithms corren client-side. Optional LLM integration para pre-mortem generation (GPT-4/Claude via z-ai-web-dev-sdk). Glassdoor API para salary factor data, INE para macroeconomic factor data (Spain unemployment rate).",
        "external_integrations": "LLM (z-ai-web-dev-sdk) para pre-mortem, Glassdoor API (salary), INE (macro data). Sin APIs first-party para decision logic.",
        "offline": "Full decision model corre offline (no external API needed). Pre-mortem LLM call queued via Service Worker background sync; degrada a deterministic risk templates cuando offline.",
        "privacy": "🔴 Life decisions (job, marriage, moving, health) son most sensitive data en system. TODAS decision records default sensitivity:'sensitive', encrypted at rest, excluded from cloud sync salvo user opt-in explícito per record. LLM pre-mortem calls send solo anonymized option labels (no 'startup name' o 'current employer').",
        "ux_flow": "Factor weighting: vertical sliders en right rail; drag-to-reorder by importance. Live recompute con animated bar chart mostrando options' utility scores. Outcome tracking: notification a 30/90/180 días post-decision: 'Hace 3 meses cambiaste de trabajo — ¿te arrepentís?' → 1-5 star rating + optional note → updates prior. Sensitivity analysis: tornado chart ('Si peso Estabilidad +20%, ganador cambia a Quedarse'). Surfaces how fragile recommendation is. Pre-mortem cards: per option, collapsible '3 riesgos' generated by LLM. User puede mark cada como 'mitigated'/'accepted'. Decision deadline: countdown chip ('Decisión en 2 sem'); reminder 3 días antes via Commitment type. Decision journal: timeline de past decisions; tap para re-open y ver how recommendation compared a what user actually chose.",
        "memory_connection": "LifeRecordKind ya tiene 'decision' — pero no UI yet renders it. Decision saved as kind:'decision' en collection 'Decisiones' (add icon mapping [/decisi/i, 'psychology_alt']). Memory linkage: decision factors reference MemoryFact records (ej factor 'riesgo' pulls from kind:'preference' fact 'alto apetito de riesgo' con confidence). Shown as chips: '🧠 Basado en 4 recuerdos tuyos'. Outcome → memory feedback: post-decision satisfaction updates linked MemoryFact confidence via Bayesian update. Bad outcome → confidence drops. Good outcome → confidence rises. Decision patterns: después 5+ decisions, Koru surfaces meta-patterns: 'Tendés a elegir la opción segura (4/5 veces) pero reportás más satisfacción cuando tomás riesgo (4.2 vs 2.8)' — stored as new MemoryFact kind:'profile'. Decisions tracked over time: cada decision's outcome becomes input a future similar decisions (transfer learning). User who regretted switching to startup 2 años ago gets warning chip en current 'cambiar de trabajo' decision: '⚠️ Decisión similar en 2022 → satisfacción 2/5'.",
    },
    {
        "id": "memory",
        "group": "travel",
        "name": "Memoria",
        "icon": "psychology",
        "accent": "#8127cf",
        "funcionalidad_actual": "Mockup muestra 'Vacaciones en Lisboa 2023 · Hace 14 meses · Recall 87% · 4 relacionados'. Extended view 4 módulos: memory text, confidence tiles (87%, 12 jun 2023, Lisboa PT, María), related memories scroller, source-history timeline. MemoryFact type ya tiene confidence, sensitivity, status, embedding?, embeddingModel? — data model existe, pero 🔴 NINGÚN semantic search, embedding pipeline, recall UI implementado. Card es puramente mockup de what a recalled memory would look like.",
        "gaps": [
            ("P0", "Embedding pipeline", "Generar vector embeddings para cada MemoryFact (embedding? field está vacío en current code). Usar OpenAI text-embedding-3-small (1536d) o local MiniLM via transformers.js."),
            ("P0", "Vector store", "IndexedDB-backed vector store (idb-vector o vectordb library) para cosine similarity search a <50ms en 10k memories."),
            ("P0", "Recall UI", "Cuando user chatea, top-k relevant memories surfaced como compact cards con confidence + similarity score."),
            ("P0", "Confidence scoring & decay", "Confidence starts at extraction time (0.8 si explicit, 0.5 si inferred); decae 0.02/month; refreshed (+0.1) cuando user confirms o re-mentions."),
            ("P1", "Edit history", "Trackear cada edit a memory (updatedAt existe pero no audit trail); show diff."),
            ("P0", "Forget", "User puede delete ('olvidá que fui a Lisboa'); hard delete + tombstone; si sensitivity:'sensitive', también revoke cualquier derived embeddings."),
            ("P1", "Source provenance", "Cada memory link a source (rootQuote, sourceEntryId ya existen); user puede tap para ver original conversation."),
            ("P1", "Conflict resolution", "Cuando new memory contradice old (ej 'María es mi pareja' vs new 'María es mi ex'), prompt user → old memory superseded, new confirmed."),
            ("P1", "Memory types expansion", "Current MemoryKind tiene 9 values. Mockup 'Vacaciones en Lisboa' no fit ninguno → add 'travel', 'event', 'place' kinds."),
        ],
        "data_model": "Extender MemoryFact con embedding: number[] (ya optional), embeddingModel, lastRecalledAt, recallCount, editHistory: MemoryEdit[], relatedMemoryIds: string[] (computed via cosine sim). Agregar 'travel'|'event'|'place' a MemoryKind. MemoryEdit type: at, field, before, after, reason.",
        "api_endpoints": "OpenAI Embeddings API o local @xenova/transformers para all-MiniLM-L6-v2 (384d, runs in-browser via WASM). Para semantic search: hnswlib-node (server) o voy/idb-vector (browser). Sin weather/maps APIs needed — memory es self-contained.",
        "external_integrations": "OpenAI Embeddings API, @xenova/transformers (local), hnswlib-node/voy/idb-vector (vector store).",
        "offline": "Embeddings + vector search corren entirely client-side — full offline recall funciona. Cloud sync de embeddings es optional (user opt-in due a size: ~6KB per memory × 10k = 60MB).",
        "privacy": "🔴 Most privacy-sensitive card. Default sensitivity:'normal' para routine facts, 'sensitive' para health/relationship/financial. Sensitive memories: (1) nunca sentidas a third-party LLMs sin explicit per-record consent, (2) encrypted at rest con passphrase-derived key, (3) excluded from cloud sync por defecto, (4) redacted en chat recall preview (shows '🔒 Recuerdo sensible — tap to view'). 'Forget' es GDPR Article 17 compliant — hard delete + cryptographic erasure of embedding.",
        "ux_flow": "Recall confidence: cada recalled memory muestra confidence chip (87%) + last-recalled timestamp. Tap → see source provenance (chat log, photo, document). Edit history: timeline de edits con diff visualization. User puede revert a cualquier prior version. Forget: long-press → 'Olvidar este recuerdo' → confirmation dialog → hard delete + audit log entry (timestamp solo, no content). Conflict prompts: cuando new fact contradice existing, Koru muestra ambas cards side-by-side: 'Esto contradice un recuerdo anterior. ¿Cuál es correcto?' → old gets superseded, new gets confirmed. Memory graph: optional visualization — memories as nodes, related memories as edges (weighted by cosine similarity). Filter by kind, date, person. Sensitivity toggle: cada memory tiene 🔒 toggle; sensitive memories blur en card preview hasta tapped.",
        "memory_connection": "Memory card IS the memory system — pero actualmente CollectionsScreen solo muestra LifeRecords, no MemoryFacts. Agregar 'Memorias' tab en CollectionsScreen que liste MemoryFact records grouped by kind. Memory confidence decay: implementar decay function confidence *= 0.98^monthsSinceLastRecall; refresh on recall event. Low-confidence (<0.3) memories auto-archived después 24 meses salvo re-confirmed. Notes searchable via semantic search: cuando user crea Note, su text se embeds y stored como MemoryFact kind:'task' (o nuevo 'note' kind) — así notes aparecen en semantic recall alongside extracted memories. Travel linkage: TravelPlan crea memory kind:'travel' on completion; future 'fuimos a Lisboa' queries surface it. Decision linkage: decision outcomes crean memories kind:'preference' que influence future decisions. Forget cascade: olvidar 'María' → user prompted: 'esto afecta 12 recuerdos relacionados. ¿Olvidar todos?' → batch delete.",
    },
    {
        "id": "note",
        "group": "travel",
        "name": "Nota",
        "icon": "sticky_note_2",
        "accent": "#8363f9",
        "funcionalidad_actual": "Mockup muestra 'Ideas para el proyecto ACME · Creada hace 3 días · 4 etiquetas'. Extended view 4 módulos: note content (5 numbered ideas), metadata tiles, tags chips, 3-step edit history timeline. CreateScreen.tsx YA implementa note creation (kind:'nota') con title + notes + collection fields. CollectionsScreen.tsx renderiza notes via recordIcon returning sticky_note_2 y inline editor supports title + collection + notes editing. PERO: notes son plain text solo — sin markdown, sin tags (tags? field en LifeRecord nunca written por CreateScreen), sin folders (solo collection), sin attachments, sin semantic search, sin edit history (solo createdAt existe; updatedAt missing entirely).",
        "gaps": [
            ("P0", "Markdown rendering", "Hoy notes es <textarea> y rendered as plain text. Agregar markdown parsing (marked + DOMPurify) con live preview toggle."),
            ("P0", "Tags", "LifeRecord.tags? existe en types pero CreateScreen nunca writes tags. Agregar tag input con autocomplete from existing tags."),
            ("P0", "Folders / nested collections", "collection es flat string. Agregar hierarchical folders ('Trabajo > ACME > Ideas')."),
            ("P0", "Search", "Sin search UI en CollectionsScreen. Agregar full-text search (Fuse.js) + semantic search (via Memory card's embedding pipeline)."),
            ("P1", "Attachments", "Sin attachment support. Agregar image/file attachments stored as blobs en IndexedDB."),
            ("P0", "Edit history", "Solo createdAt existe. Agregar updatedAt, editHistory: NoteEdit[]."),
            ("P1", "Quick capture", "Sin quick-capture path. Agregar FAB o shortcut 'anotá: ...' que crea note en 1 step."),
            ("P1", "Templates", "CreateScreen tiene 5 templates; agregar 'meeting note', 'decision journal', 'idea with factors' templates."),
            ("P1", "Export", "Sin export. Agregar Markdown/PDF/Notion export per note o per collection."),
            ("P1", "Reminders on notes", "Algunas notes son actionable ('idea: hacer X'); let user convert note line en Commitment."),
        ],
        "data_model": "Extender LifeRecord con updatedAt?: string, editHistory?: NoteEdit[], attachments?: Attachment[], folderPath?: string (slash-delimited). Agregar tags: string[] writes a CreateScreen (field existe en type, nunca populated). NoteEdit type: at, summary (diff summary), fieldChanges. Attachment type: id, name, mimeType, sizeBytes, blobKey (IndexedDB key). Extender LifeRecordKind con 'note' (o accept 'nota' como current CreateScreen usa — type system necesita reconciliation).",
        "api_endpoints": "marked para markdown→HTML, DOMPurify para XSS sanitization, fuse.js para fuzzy text search, @xenova/transformers para embedding (shared con Memory card), Notion API para export (OAuth), Web Share API para cross-app sharing. Optional: Unsplash API para stock images en notes.",
        "external_integrations": "marked, DOMPurify, fuse.js, @xenova/transformers, Notion API, Web Share API, Unsplash (optional).",
        "offline": "Notes son fully offline-first (ya son via IndexedDB). Attachments stored as blobs localmente; cloud sync optional y metered (ej 1GB free tier). Search funciona offline — embeddings cached localmente.",
        "privacy": "Notes often contain sensitive thoughts (journal entries, medical notes, relationship reflections). Per-note sensitivity toggle. Sensitive notes: encrypted at rest, excluded from cloud sync, excluded from chat recall salvo explicitly cited. Markdown sanitization enforced (no <script>, no javascript: URLs).",
        "ux_flow": "Rich text: toggle entre Edit (markdown textarea con syntax highlighting) y Preview (rendered HTML). Toolbar con bold/italic/list/link/code buttons que insert markdown syntax. Attachments: paperclip icon → file picker o drag-drop. Images render inline; PDFs/other show as chips con download. Quick capture: FAB '+' en CollectionsScreen → minimal modal: solo textarea + tag input. Title auto-extracted from first line. Saved as kind:'note' en current folder. Folders: breadcrumb top de CollectionsScreen; tap para navigate; create subfolder via '...' menu. Search: search bar top CollectionsScreen; results ranked by relevance; tag filter chips; date filter; 'only sensitive' hidden por defecto. Convert to commitment: long-press note line → 'Convertir en tarea' → creates Commitment linked back to note via sourceEntryId. Templates: new template 'Reunión' con attendees + agenda + decisions + action items; 'Decisión' template que creates Decision.",
        "memory_connection": "Notes saved as kind:'note' (reconcile con 'nota' en CreateScreen) en collections — CollectionsScreen ya groups by collection field; folders just become hierarchical collections. Notes searchable via semantic search: cada note's notes field embedded via Memory card's pipeline; stored como MemoryFact kind:'task' (o nuevo 'note' kind) con sourceEntryId linking back al LifeRecord. Chat queries como 'ideas para ACME' surface la note como memory card. Memory confidence: note-derived memories start at confidence 0.6 (lower que explicit memories) since notes son draft-like; decay slower (0.01/month) since notes son explicit user content. Decision linkage: note taggeada #decision prompts Koru a offer '¿Querés convertir esto en una decisión estructurada?' → spawns Decision pre-filled con note content. Travel linkage: note con location + dates ('fuimos a Lisboa en junio 2023') triggers Koru a offer '¿Crear recuerdo de viaje?' → spawns MemoryFact kind:'travel'. Edit history → memory feedback: cuando user edita note significantly, derived memory's embedding se re-computa; old embedding kept en editHistory para diff queries.",
    },
    # ============ SYSTEM SCREENS ============
    {
        "id": "home",
        "group": "system",
        "name": "Home · Dashboard",
        "icon": "home",
        "accent": "#8363f9",
        "funcionalidad_actual": "🔴 Home NO existe como screen. TalkOverlay.tsx rutea option==='home' a onNavigate('hoy'), pero 'Hoy' tab hoy es solo el chat overlay — app abre directamente a conversation surface. Sin dashboard, sin aggregated view del user's day. Closest artifact: MorningBriefCard y activity_group UiBlock type, que backend puede emitir durante chat turn pero no puede ser invoked on demand.",
        "gaps": [
            ("P0", "Persistent dashboard screen", "Que mountee fuera del chat overlay — nuevo top-level route alongside hoy|memoria|historial|configuracion (o repurposing 'hoy')."),
            ("P0", "Time-of-day greeting personalization", "'Buenos días'/'Buenas tardes'/'Buenas noches' driven por user's timezone, no server time."),
            ("P0", "Today's items widget", "Aggrega commitments con dueAt today, calendar events starting today, records dated today."),
            ("P0", "Calendar widget", "Pulls from state.calendarEvents (today only) con start time + title + duration. Hoy events solo renderizan inside chat."),
            ("P0", "Priorities widget", "4 niveles (Urgente/Importante/Rutina/Opcional), sourced from commitments ranked by dueAt + priority."),
            ("P0", "Weather widget", "Necesita cached weather fetch keyed a user's location (nuevo field — no en KoruState aún)."),
            ("P1", "Proactive Koru suggestions", "Surface state.nudges (ya modeled en types.ts) como cards con dismiss/act."),
            ("P1", "Quick actions row", "Create, Search memories, Recent entries, Talk to Koru."),
            ("P1", "Reflection / journaling prompt", "Last DailyEntry sentiment + AI-generated end-of-day prompt."),
            ("P2", "Widget customization", "Drag/reorder, hide/show per widget."),
        ],
        "data_model": "Extender KoruState con userProfile: {name, birthday, location, timezone} y homeLayout: WidgetConfig[]. LifeRecord ya tiene happenedAt (good para today filter); Commitment.dueAt presente.",
        "api_endpoints": "GET /api/home/today retorna {greeting, weather, items[], calendar[], priorities[], nudges[], recentEntries[]}. GET /api/weather?lat&lon. POST /api/home/layout para persist widget config.",
        "external_integrations": "OpenWeather o Open-Meteo (sin API key basic tier), reverse geocoding via browser navigator.geolocation + Nominatim.",
        "offline": "Dashboard renderiza last cached snapshot con 'Datos de hace X min' badge; queue refresh on reconnect via onOnlineStatusChange.",
        "privacy": "Weather/location cached sin PII; user location es only sensitive field, stored localmente solo.",
        "ux_flow": "First-run: empty-state illustration + 'Decile a Koru cómo te llamas' CTA que triggers onboarding. Daily evolution: as day progresses, priorities auto-reorder; completed items collapse con Koru leaf animation. Widget customization: long-press widget → edit mode; drag handles; persist on drop. Pull-to-refresh en dashboard para force-refresh weather + nudges.",
        "memory_connection": "Home es el AGGREGATOR: reads memories (profile facts → greeting), commitments (priorities), calendarEvents (today's calendar), records dated today (items), entries (last reflection), nudges (proactive AI), stage (garden metaphor progression). Es only screen que touches every domain slice de KoruState. Debe NUNCA write directly — solo dispatch intents a otras surfaces (Create, Memory, Chat).",
    },
    {
        "id": "create",
        "group": "system",
        "name": "Crear",
        "icon": "create_new_folder",
        "accent": "#8363f9",
        "funcionalidad_actual": "CreateScreen.tsx (402 líneas) implementa portal modal con 5 templates: nota, lista, gasto, enlace, receta. Cada template abre simple form con plain <input> y <textarea>. On save calls createRecord() from KoruProvider, que writes LifeRecord con kind set from loose string union (no strict LifeRecordKind enum). Sin validation más allá de title.trim(), sin rich text, sin attachments, sin voice input, sin AI assistance. Currency hardcoded a ARS|USD|EUR.",
        "gaps": [
            ("P0", "New templates", "Routine (daily/weekly habit → commitment), Exercise Plan (wellbeing domain), Memory (free-form memory fact con kind/confidence/sensitivity), Decision (decision-support payload)."),
            ("P0", "Rich text editor", "Para notes — Markdown con bold/italic/lists/links (hoy plain <textarea>). Considerar TipTap o Lexical."),
            ("P0", "Image attachment", "Al menos 1 image per record (recipe photos, expense receipts). Necesita nuevo LifeRecord.attachments: {url, mime, size}[] field."),
            ("P1", "Voice input", "Reuse createSpeechSession from domain/speech para dictate title/notes."),
            ("P1", "Template customization", "User-defined templates saved a nuevo customTemplates: TemplateDef[] en KoruState."),
            ("P1", "Bulk import", "Paste list / CSV / markdown; auto-detect columns → multiple records at once. Crítico para shopping lists y expense batches."),
            ("P1", "AI-assisted creation", "'Koru sugiere campos' button que calls LLM para fill missing fields (ej auto-categorize expense, suggest recipe ingredients from title)."),
            ("P1", "Smart defaults", "Last-used collection, last-used currency, recurring expense detection ('¿Otro café como ayer?')."),
            ("P0", "Validation & error states", "Required fields, amount parsing, URL format."),
            ("P0", "Tag system", "LifeRecord.tags existe en type pero CreateScreen nunca lo setea."),
        ],
        "data_model": "Agregar LifeRecord.attachments, LifeRecord.richNotes (Markdown HTML), KoruState.customTemplates: CustomTemplate[]. Strict kind mapping from template id a LifeRecordKind (replace loose string con LifeRecord.kind: LifeRecordKind).",
        "api_endpoints": "POST /api/records (ya implicit en createRecord), POST /api/records/bulk, POST /api/records/ai-assist (LLM fills fields), POST /api/uploads para attachments (S3/Supabase Storage con presigned URLs).",
        "external_integrations": "Storage provider para images (S3/Supabase), speech-to-text via Web Speech API (ya en domain/speech), optional Whisper fallback para higher accuracy.",
        "offline": "Full creation funciona offline — attachment blobs queued en IDB, synced on reconnect; records created con sourceBlock? placeholder que back-fills on sync.",
        "privacy": "Attachments scanned para mime-type spoofing; sensitive records (health, finance) flagged con MemorySensitivity='sensitive' y stored encrypted si lock enabled.",
        "ux_flow": "AI-assisted flow: después de typing title, subtle 'Koru sugiere ✨' pill aparece; tapping pre-fills fields con typing animation; user puede accept/reject per-field. Smart defaults: show 'Último usado: {collection}' hint above folder field. Templates: show recent templates as chips top de picker; 'Ver todos' expands. Bulk import: dedicated 'Pegar lista' template; on paste, auto-split by newlines y preview as N records antes confirm. Undo: después save, toast 'Guardado en {collection}' con 'Deshacer' button (5-second window) — pattern ya existe en MemoryToast.",
        "memory_connection": "Create writes to records (primary), y indirectly creates commitments (Routine template), memories (Memory template, con kind/confidence/sensitivity), y actions (Decision template → decision_support action awaiting approval). Debe NO bypass audit trail — cada record keeps sourceEntryId (ya required); manual creations get synthetic sourceEntryId='manual_<timestamp>'. Chat surface puede later reference estos records via memory_recall tool.",
    },
    {
        "id": "settings",
        "group": "system",
        "name": "Ajustes",
        "icon": "settings",
        "accent": "#8363f9",
        "funcionalidad_actual": "Settings hoy fragmented across chat surface (wheel option 'settings' calls onNavigate('configuracion')) y minimal model picker usando solo settings.* keys en i18n.ts. KoruProvider expone: setLanguage, setVoiceEnabled, toggleEphemeralMode, setDurableMemoryEnabled, setHeartbeatEnabled, setActionPreparationEnabled, setWorldSignals, toggleMemorySuggestions, updateUserName, updateVoicePreference, updateRuntimeSettings, updateHeartbeatSettings. Sin integrated settings screen — toggles scattered.",
        "gaps": [
            ("P0", "Profile section", "Name (existe via updateUserName), birthday (new), location (new — feeds Home weather), timezone (new — auto-detected, manual override). Todos persisted en nuevo KoruState.userProfile."),
            ("P0", "Language section", "es/en — ya funciona via setLanguage, pero needs UI surface; hoy toggle lives en model-picker card."),
            ("P0", "Appearance section", "Theme (light/dark/auto — hoy app es light-only), font size (small/medium/large — needs CSS variable scaling), haptics toggle (Web Vibration API)."),
            ("P0", "Notifications section", "Push notifications (Web Push API + service worker), sounds (per-event sound selection), DND schedule (extiende existing HeartbeatSettings.activeStartHour/activeEndHour)."),
            ("P0", "Privacy section", "App lock (WebAuthn / Face ID via navigator.credentials), offline mode (ya ephemeralMode — repurpose), memory retention policy (auto-archive after N days — new field), data export (JSON download de full KoruState), data delete (clears localStorage, IDB, service worker cache)."),
            ("P1", "Integrations section", "OAuth connectors para Google Calendar (writes a calendarEvents), banks (writes a records con kind:expense), exchanges (crypto prices — ya crypto_price tool). Token storage encrypted."),
            ("P0", "Memory management section", "List view de state.memories con edit (uses existing updateMemoryText) y forget (new forgetMemory(id) mutator) per memory. Filter by kind, status, sensitivity."),
            ("P1", "Accessibility section", "Screen reader hints (ya partial via aria-labels), reduced motion (prefers-reduced-motion), high contrast (alternate token set)."),
            ("P1", "AI Model section", "Ya existe — keep, pero visually integrate."),
        ],
        "data_model": "Agregar KoruState.userProfile: UserProfile, KoruState.preferences: {theme, fontScale, haptics, sounds, dnd, reducedMotion, highContrast}, KoruState.integrations: Integration[], KoruState.memoryRetention: {autoArchiveDays, autoDelete}. Extender HeartbeatSettings con dndStartHour, dndEndHour.",
        "api_endpoints": "GET/PUT /api/user/profile, GET/PUT /api/user/preferences, POST /api/integrations/oauth/google, POST /api/integrations/oauth/bank, GET /api/integrations, DELETE /api/integrations/:id, GET /api/user/export (returns full JSON), DELETE /api/user/data.",
        "external_integrations": "Google Calendar API (OAuth 2.0 + refresh token), Plaid/Mercado Pago para banks, CoinGecko/Binance para crypto (ya used). Cada connector runs as service-worker background sync.",
        "offline": "Todos settings editable offline; integration syncs queue en STORE_QUEUE (ya en offlineCache.ts) y replay on reconnect.",
        "privacy": "OAuth tokens encrypted at rest; export signed con HMAC para tamper detection; delete es two-step (confirm + type 'ELIMINAR'); sensitive memories (sensitivity:'sensitive') hidden behind app lock.",
        "ux_flow": "Progressive disclosure: collapsed sections por defecto; tap para expand; recently-used section remembered. Search (audit muestra search icon): type 'idioma' → jumps a Appearance → Language field highlighted. Undo: cada toggle muestra 4-second 'Deshacer' toast. Two-column en desktop / single-column en mobile. Per-section save vs global save: audit muestra single 'Guardar' button bottom — keep pattern pero auto-persist on blur para low-risk fields.",
        "memory_connection": "Settings es el CONTROL PLANE: profile feeds Home (greeting, timezone), Create (smart defaults), y LLM system prompt (voice preference, language); preferences cascade a every screen's theme/font/motion; notifications control HeartbeatSettings (nudges) y NotificationManager (reminders); privacy controls ephemeralMode, durableMemoryEnabled, y memory retention (affecting memories lifecycle); integrations feed calendarEvents y records from external sources; memory management es only place user puede edit/forget individual MemoryFact entries — closing loop en Koru's 'memoria con tu permiso' promise. Cada change en Settings should emit KoruState patch que re-persists via saveState y notifies subscribers via KoruProvider context.",
    },
]

GROUPS = [
    ("media", "Media & Info", "Recetas, películas, libros, restaurantes, noticias, eventos, deepsearch, image gen"),
    ("travel", "Travel & Decisions", "Viajes, rutas, comparativas, decisiones, memoria, notas"),
    ("system", "System screens", "Home, Crear, Ajustes — las pantallas estructurales"),
]

def render_card_spec(card):
    out = []
    out.append(f'<div class="card-spec-block reveal" id="spec-{card["id"]}" style="background:#fff;border-radius:20px;padding:24px;margin:24px 0;border:1px solid var(--c-sand);border-top:4px solid {card["accent"]};">')
    
    out.append(f'<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">')
    out.append(f'<div style="width:48px;height:48px;border-radius:14px;background:{card["accent"]}20;color:{card["accent"]};display:grid;place-items:center;flex-shrink:0;"><span class="material-symbols-outlined" style="font-size:26px;">{card["icon"]}</span></div>')
    out.append(f'<div><div style="font-family:var(--t-display);font-size:22px;font-weight:800;color:var(--kp-deep);letter-spacing:-0.02em;">{card["name"]}</div><div style="font-size:11px;color:var(--c-earth);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">Spec funcional · mockup → feature real</div></div>')
    out.append(f'</div>')
    
    out.append(f'<div style="margin-bottom:18px;">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="material-symbols-outlined" style="color:var(--k-blue);font-size:18px;">history</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Funcionalidad actual</strong></div>')
    out.append(f'<p style="font-size:13px;line-height:1.6;color:var(--c-earth);padding-left:26px;">{card["funcionalidad_actual"]}</p>')
    out.append(f'</div>')
    
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
    
    out.append(f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">')
    
    out.append(f'<div style="background:rgba(131,99,249,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--kp);font-size:16px;">database</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Data model</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);">{card["data_model"]}</p>')
    out.append(f'</div>')
    
    out.append(f'<div style="background:rgba(59,130,246,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--k-blue);font-size:16px;">api</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">API endpoints</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);">{card["api_endpoints"]}</p>')
    out.append(f'</div>')
    
    out.append(f'<div style="background:rgba(45,106,79,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--k-emerald);font-size:16px;">hub</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">External integrations</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);">{card["external_integrations"]}</p>')
    out.append(f'</div>')
    
    out.append(f'<div style="background:rgba(245,158,11,0.04);border-radius:12px;padding:14px;border:1px solid var(--c-sand);">')
    out.append(f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span class="material-symbols-outlined" style="color:var(--k-amber-text);font-size:16px;">cloud_off</span><strong style="font-size:11px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Offline &amp; privacy</strong></div>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);"><strong style="color:var(--c-bark);">Offline:</strong> {card["offline"]}</p>')
    out.append(f'<p style="font-size:11.5px;line-height:1.55;color:var(--c-earth);margin-top:6px;"><strong style="color:var(--c-bark);">Privacy:</strong> {card["privacy"]}</p>')
    out.append(f'</div>')
    out.append(f'</div>')
    
    out.append(f'<div style="margin-bottom:18px;">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="material-symbols-outlined" style="color:var(--k-pink);font-size:18px;">route</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">UX flow &amp; proactive triggers</strong></div>')
    out.append(f'<p style="font-size:13px;line-height:1.6;color:var(--c-earth);padding-left:26px;">{card["ux_flow"]}</p>')
    out.append(f'</div>')
    
    out.append(f'<div style="background:linear-gradient(135deg,rgba(131,99,249,0.06),rgba(224,163,214,0.06));border-radius:12px;padding:14px;border:1px solid rgba(131,99,249,0.15);">')
    out.append(f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="material-symbols-outlined" style="color:var(--kp);font-size:18px;">psychology</span><strong style="font-size:13px;color:var(--kp-deep);text-transform:uppercase;letter-spacing:0.06em;">Conexión a memoria + collections</strong></div>')
    out.append(f'<p style="font-size:13px;line-height:1.6;color:var(--c-earth);">{card["memory_connection"]}</p>')
    out.append(f'</div>')
    
    out.append(f'</div>')
    return '\n'.join(out)


# Read existing file
with open('/home/z/my-project/download/koru-ui-audit-funcionalidades.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Generate new cards HTML
new_cards_html = []
for group_id, group_title, group_desc in GROUPS:
    group_cards = [c for c in CARDS if c["group"] == group_id]
    if not group_cards:
        continue
    new_cards_html.append(f'''
      <div class="card-section-divider reveal">
        <div class="card-section-group-title">{group_title}</div>
        <div class="card-section-group-sub">{group_desc}</div>
      </div>
''')
    for card in group_cards:
        new_cards_html.append(render_card_spec(card))

new_cards = '\n'.join(new_cards_html)

# Insert before closing section
marker = '    </section>\n\n    <!-- ============ CLOSING ============ -->'
html = html.replace(marker, new_cards + '\n' + marker)

# Update cover stat from 16 to 33
html = html.replace('>16<', '>33<')

# Update closing stats
html = html.replace('16 cards', '33 cards')

with open('/home/z/my-project/download/koru-ui-audit-funcionalidades.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Updated: /home/z/my-project/download/koru-ui-audit-funcionalidades.html")
print(f"Size: {len(html)} chars ({len(html)//1024} KB)")
print(f"Lines: {html.count(chr(10))}")
print(f"Total cards now: {html.count('card-spec-block')}")
