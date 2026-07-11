# Koru — 08. Catálogo de tools para el día a día (120 tools)

> **Enfoque:** lo que una persona usa **cada semana**, no lo técnicamente curioso. Deportes, comidas, viajes, dinero, documentos, trending, memoria y productividad.
>
> Integración de las tools de los docs 07 (técnicas) + las cotidianas solicitadas por el usuario. Cada tool tiene: **descripción, ejemplos de uso reales, API/origen, costo y política de riesgo**.
>
> Todas gratuitas (sin tarjeta, sin suscripción). Las que requieren key usan tier free permanente. Reutilizan el `toolRegistry` existente y el anti-alucinación de `structureExtractor`.

---

## 📋 Cómo leer cada tool

```
### N. `tool_name` — Título corto
**Qué hace:** descripción en una línea.
**Ejemplos de uso:** frases reales del usuario.
**API/Origen:** enlace + nota de límites.
**Costo:** $0 siempre.
**Riesgo:** readonly | local_write | destructive (sigue `ToolPolicy`).
**Fit Koru:** por qué encaja con la identidad del asistente.
```

**Riesgo** sigue el sistema existente en `toolRegistry.ts`:
- `readonly` + `autoRun:true` → se ejecuta solo, solo lee.
- `local_write` + `requiresApproval:true` → modifica datos del usuario, pide confirmación.
- `destructive` → alto riesgo (borra/sobrescribe), siempre con aprobación.

---

# 🟢 BLOQUE 1 — DEPORTES (lo más pedido)

### 1. `match_live` — Resultado en vivo de un partido
**Qué hace:** trae el marcador actual, minuto y eventos de un partido en curso.
**Ejemplos:** "¿Cómo va Boca-River?", "¿Va ganando el Madrid?", "A qué hora juega Argentina".
**API/Origen:** [TheSportsDB](https://www.thesportsdb.com/free_sports_api) (key pública `3`) + [ESPN unofficial](https://espnapi.com/) (sin key).
**Costo:** $0. **Riesgo:** readonly. **Fit:** núcleo del "¿cómo va el partido?" sin abrir el celu.

### 2. `league_standings` — Tabla de posiciones
**Qué hace:** tabla completa de una liga/campeonato con PJ, PTS, GF, GC, diferencia.
**Ejemplos:** "Mostrame la tabla de la Liga", "¿En qué puesto está Barcelona?", "Tabla del NBA Este".
**API/Origen:** TheSportsDB + ESPN. **Costo:** $0. **Riesgo:** readonly.
**Fit:** visualización en card `activity_group` (Koru ya lo soporta).

### 3. `match_schedule` — Fixture / próximos partidos
**Qué hace:** lista los próximos partidos de un equipo o liga (fecha, rival, hora local).
**Ejemplos:** "¿Cuándo juega Messi下一个?", "Próximos 5 del Betis", "Fixture Wimbledon".
**API/Origen:** TheSportsDB. **Costo:** $0. **Riesgo:** readonly.

### 4. `team_follow` — Seguir un equipo (radar)
**Qué hace:** guarda un equipo como `memory` y genera nudges automáticos cuando juega / termina.
**Ejemplos:** "Seguí a Boca y avisame cuando termine", "Ségal a Nadal".
**API/Origen:** Memory + heartbeat. **Costo:** $0. **Riesgo:** local_write.
**Fit:** arregla el bug actual de `sportsResultNudge` (que está muerto por prioridad "low").

### 5. `player_stats` — Estadísticas de jugador
**Qué hace:** datos de un deportista (goles, títulos, edad, equipo actual).
**Ejemplos:** "¿Cuántos goles tiene Mbappé este año?", "Edad de LeBron".
**API/Origen:** TheSportsDB + Wikipedia. **Costo:** $0. **Riesgo:** readonly.

### 6. `tournament_bracket` — Llave de torneo
**Qué hace:** bracket de eliminación directa (Champions, Wimbledon, World Cup).
**Ejemplos:** "Llave de la Champions", "Cuadro de Roland Garros".
**API/Origen:** ESPN. **Costo:** $0. **Riesgo:** readonly.

### 7. `sports_news` — Noticias deportivas
**Qué hace:** titulares de deportes filtrados por deporte/equipo.
**Ejemplos:** "Noticias del Barça", "Qué pasó en la F1".
**API/Origen:** RSS (Marca, ESPN) + GDELT. **Costo:** $0. **Riesgo:** readonly.

### 8. `golf_leaderboard` — Tabla de golf en vivo
**Qué hace:** leaderboard de un torneo de golf con score par/under.
**Ejemplos:** "¿Cómo va el Masters?", "Posición de Tiger hoy".
**API/Origen:** ESPN golf. **Costo:** $0. **Riesgo:** readonly.

### 9. `tennis_atp_wta` — Ranking ATP/WTA
**Qué hace:** ranking actual + resultados de la semana.
**Ejemplos:** "Top 10 ATP", "¿Quién ganó Alcaraz-Sinner?".
**API/Origen:** ESPN tennis. **Costo:** $0. **Riesgo:** readonly.

### 10. `f1_results` — Resultados F1
**Qué hace:** clasificación y resultado de carrera/qualy.
**Ejemplos:** "Resultado de Mónaco", "Pole de Verstappen".
**API/Origen:** Ergast API (sin key, histórico + 2025). **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 2 — COMIDA Y RESTAURANTES (prioridad alta del usuario)

### 11. `restaurant_deep_search` — Buscar restaurante leyendo varias fuentes ⭐
**Qué hace:** busca un lugar para comer, **cruza reseñas de Google + Yelp + TripAdvisor + periódicos gastronómicos**, encuentra coincidencias entre fuentes y sintetiza un veredicto honesto ("todos coinciden en que la pasta es lo mejor, 3 fuentes mencionan servicio lento").
**Ejemplos:** "Buscá una buena parrilla en Palermo", "¿Dónde como sushi bien en Madrid centro?", "Restaurante italiano romantico para cena en pareja", "Mejor paella de Valencia según varias fuentes".
**API/Origen:** Scraping multi-fuente (DuckDuckGo, Bing) + `structureExtractor` (valida cada dato con cita literal — anti-alucinación que Koru ya tiene) + Overpass (ubicación).
**Costo:** $0 (usa el scraper Playwright ya existente + Open-Meteo para contexto). **Riesgo:** readonly.
**Fit:** **ESTO ES LO QUE DISTINGUE A KORU**. No es "buscar en Google" — es leer 5 reseñas y decirte dónde coinciden. Es la killer feature.

### 12. `recipe_find` — Buscar recetas
**Qué hace:** busca recetas por nombre, tipo de cocina o ingredientes.
**Ejemplos:** "Receta de carbonara", "Algo con pollo y limón", "Postre sin horno".
**API/Origen:** [TheMealDB](https://www.themealdb.com/api.php) (key pública `1`). **Costo:** $0. **Riesgo:** readonly.

### 13. `recipe_by_ingredients` — Recetas con lo que tengo
**Qué hace:** dado lo que hay en la heladera, propone recetas.
**Ejemplos:** "Tengo huevos, pan y queso, ¿qué hago?", "Con zanahoria y arroz".
**API/Origen:** TheMealDB + [Spoonacular demo](https://spoonacular.com/food-api) (150 req/día). **Costo:** $0. **Riesgo:** readonly.
**Fit:** conecta con `meal_inventory` records — ya sabe qué hay en casa.

### 14. `recipe_save` — Guardar receta
**Qué hace:** guarda una receta como `LifeRecord` para consultar después.
**Ejemplos:** "Guardá esa carbonara", "Esta de tortilla dejala".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 15. `recipe_show` — Mostrar receta guardada
**Qué hace:** recupera receta guardada con pasos + ingredientes.
**Ejemplos:** "Mostrame la receta del flan que guardé".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 16. `food_info` — Info nutricional por código de barras
**Qué hace:** escanea un producto y trae ingredientes, alérgenos, Nutri-Score.
**Ejemplos:** "¿Qué tiene este yogurt del código 7622210449284?".
**API/Origen:** [Open Food Facts](https://world.openfoodfacts.org/data). **Costo:** $0. **Riesgo:** readonly.

### 17. `wine_pairing` — Maridaje de vino
**Qué hace:** sugiere vino para una comida.
**Ejemplos:** "¿Qué vino va con cordero?", "Tinto para pasta".
**API/Origen:** Local (reglas) + TheMealDB. **Costo:** $0. **Riesgo:** readonly.

### 18. `nutrition_calc` — Calcular macros de una comida
**Qué hace:** suma calorías/proteínas de una receta o comida.
**Ejemplos:** "¿Cuántas calorías tiene esa carbonara?".
**API/Origen:** USDA FoodData Central (key free) + Open Food Facts. **Costo:** $0. **Riesgo:** readonly.

### 19. `restaurant_review_aggregate` — Resumen de reseñas de un lugar específico
**Qué hace:** dado un restaurante concreto, lee 10+ reseñas y resume "pros y contras reales".
**Ejemplos:** "¿Qué dicen de Don Julio?", "Resumí las reseñas de El Cellercan".
**API/Origen:** Scraping + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.

### 20. `menu_extract` — Menú de un restaurante
**Qué hace:** extrae el menú de la web del restaurante.
**Ejemplos:** "Mostrame el menú de X", "Tienen opciones veganas?".
**API/Origen:** Scraping + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 3 — VIAJES Y TRANSPORTE

### 21. `flight_search` — Buscar pasajes de avión
**Qué hace:** busca vuelos con precio, escalas, aerolínea, duración.
**Ejemplos:** "Vuelo Madrid-Buenos Aires en noviembre", "El más barato a Tokyo en marzo".
**API/Origen:** [Amadeus for Developers](https://developers.amadeus.com/) (key free, 2000 req/mes) + [Kiwi Tequila](https://phptravels.com/blog/comprehensive-guide-to-flights-api-integration) (afiliado Travelpayouts, sin costo). **Costo:** $0. **Riesgo:** readonly.

### 22. `flight_track` — Seguir vuelo en vivo
**Qué hace:** estado de un vuelo (en hora, demorado, cancelado, posición).
**Ejemplos:** "¿Llegó el IB6862?", "Estado del vuelo de mi mamá".
**API/Origen:** [OpenSky Network](https://opensky-network.org/apidoc) (sin key) + Aviationstack (free). **Costo:** $0. **Riesgo:** readonly.

### 23. `hotel_search` — Hospedajes
**Qué hace:** busca hoteles/hostels/airbnb con precio, rating, ubicación, amenities.
**Ejemplos:** "Hotel en Roma centro por 3 noches", "Hostel barato en Lisboa".
**API/Origen:** Amadeus Hotels + scraping + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.

### 24. `route_plan` — Ruta multimodal
**Qué hace:** ruta A→B en auto, transporte público, pie, bici, con duración.
**Ejemplos:** "Cómo llego a Ezeiza", "Ruta en bici al centro".
**API/Origen:** OSRM (auto) + [OpenTripPlanner](http://www.opentripplanner.org/) (multimodal). **Costo:** $0. **Riesgo:** readonly.

### 25. `transport_nearby` — Transporte cercano
**Qué hace:** estaciones de tren/subte/bici/bus cerca.
**Ejemplos:** "¿Dónde hay una estación de Ecobici?", "Subte más cercano".
**API/Origen:** Overpass OSM. **Costo:** $0. **Riesgo:** readonly.

### 26. `currency_atm` — Cajero / casa de cambio cercana
**Qué hace:** localiza cajeros/casas de cambio + tasa del día.
**Ejemplos:** "¿Dónde cambio dólares?", "Cajero sin comisión cerca".
**API/Origen:** Overpass + Frankfurter. **Costo:** $0. **Riesgo:** readonly.

### 27. `visa_check` — Requisitos de visa
**Qué hace:** requisitos de entrada y visa para un destino según pasaporte.
**Ejemplos:** "¿Necesito visa para Japón con pasaporte argentino?".
**API/Origen:** Scraping + Wikipedia + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.

### 28. `travel_itinerary` — Armar itinerario
**Qué hace:** propone plan día a día para un viaje (combinando sights + food + tiempo).
**Ejemplos:** "Armate un itinerario de 3 días en Roma".
**API/Origen:** Local + Wikipedia + Wikivoyage. **Costo:** $0. **Riesgo:** local_write (guarda como proyecto).

### 29. `weather_travel` — Clima en destino por fecha
**Qué hace:** pronóstico para un viaje futuro (histórico promedio + tendencias).
**Ejemplos:** "¿Qué clima va a hacer en Berlín en diciembre?".
**API/Origen:** Open-Meteo histórico + pronóstico. **Costo:** $0. **Riesgo:** readonly.

### 30. `language_travel_phrase` — Frases útiles del idioma
**Qué hace:** frases clave para viajar (hola, gracias, ¿dónde está...?) + pronunciación.
**Ejemplos:** "Frases útiles en japonés para viajar".
**API/Origen:** Local + traductor Ollama. **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 4 — DINERO Y MERCADOS

### 31. `currency_convert` — Conversión de divisas
**Qué hace:** convierte entre monedas con tasa en vivo del BCE.
**Ejemplos:** "¿Cuánto son 100 dólares en pesos?", "50 euros a yen".
**API/Origen:** [Frankfurter](https://www.frankfurter.app/). **Costo:** $0. **Riesgo:** readonly.

### 32. `exchange_history` — Histórico de divisas
**Qué hace:** evolución de una divisa en el tiempo (desde 1999).
**Ejemplos:** "¿Cómo estaba el dólar hace un año?", "Evolución del euro vs peso".
**API/Origen:** Frankfurter. **Costo:** $0. **Riesgo:** readonly.

### 33. `crypto_price` — Precio de cripto
**Qué hace:** precio en vivo de BTC, ETH, altcoins, market cap, variación 24h.
**Ejemplos:** "¿A cuánto está BTC?", "Precio de SOL", "Ethereum vs ayer".
**API/Origen:** [CoinGecko Demo](https://www.coingecko.com/) (key gratuita). **Costo:** $0, 30/min. **Riesgo:** readonly.

### 34. `crypto_portfolio` — Portfolio de cripto
**Qué hace:** guarda tus holdings y calcula valor actual + P&L.
**Ejemplos:** "Tengo 0.5 BTC y 10 ETH, ¿cuánto es?".
**API/Origen:** CoinGecko + `LifeRecord`. **Costo:** $0. **Riesgo:** local_write.

### 35. `stock_quote` — Cotización de acción
**Qué hace:** precio de una acción/índice en vivo.
**Ejemplos:** "¿Cómo está Apple?", "Cierre del S&P 500".
**API/Origen:** [Stooq](https://stooq.com/) (CSV sin key). **Costo:** $0. **Riesgo:** readonly.

### 36. `expense_track` — Anotar gasto
**Qué hace:** registra un gasto (monto, categoría, fecha, nota).
**Ejemplos:** "Gasté 25 euros en cena", "Anota 50 de gasolina".
**API/Origen:** Local (`expense` record). **Costo:** $0. **Riesgo:** local_write.

### 37. `expense_summary` — Resumen de gastos
**Qué hace:** totales por día/semana/mes, por categoría.
**Ejemplos:** "¿Cuánto gasté esta semana?", "Gastos del mes en comida".
**API/Origen:** Local (`money_summary` ya existe, expandir). **Costo:** $0. **Riesgo:** readonly.

### 38. `expense_alert` — Alerta de gasto inusual
**Qué hace:** detecta gastos atípicos vs tu promedio.
**Ejemplos:** (nudge proactivo) "Gastaste 3x más en transporte que tu promedio".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 39. `budget_set` — Definir presupuesto
**Qué hace:** establece límite mensual por categoría y avisa al acercarse.
**Ejemplos:** "Poneme 400 de comida este mes".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 40. `price_compare_product` — Comparar precio de producto
**Qué hace:** busca un producto en varias tiendas, ordena por precio total (con envío).
**Ejemplos:** "¿Dónde compro más barato el AirPods Pro?", "Mejor precio iPhone 15".
**API/Origen:** Scraping multi-tienda + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.
**Fit:** ya existe `shopping_compare`, ahora con anti-alucinación real.

### 41. `price_history` — Histórico de precio de producto
**Qué hace:** evolución de precio en el tiempo + mejor momento para comprar.
**Ejemplos:** "¿Conviene comprar esta notebook ahora o bajará?".
**API/Origen:** Local track + scraping. **Costo:** $0. **Riesgo:** readonly.

### 42. `product_review` — Reseñas de producto
**Qué hace:** lee reseñas de varios sitios y sintetiza pros/contras reales.
**Ejemplos:** "¿Qué opinan de la DJI Mini 4?", "Reseñas de la GoPro 12".
**API/Origen:** Scraping + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.

### 43. `subscription_reminder` — Recordatorio de suscripción
**Qué hace:** avisa antes del cobro de Netflix/Spotify/etc.
**Ejemplos:** "Avisame antes de que cobren Spotify".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 44. `tax_estimate` — Estimación de impuestos
**Qué hace:** cálculo aproximado de IVA/IRPF/sales tax.
**Ejemplos:** "¿Cuánto IVA tiene este producto?", "Estimá mi IRPF".
**API/Origen:** Local (reglas por país). **Costo:** $0. **Riesgo:** readonly.

### 45. `inflation_data` — Inflación oficial
**Qué hace:** dato de inflación oficial por país.
**Ejemplos:** "¿Cómo está la inflación en Argentina?".
**API/Origen:** [FRED](https://fred.stlouisfed.org/) (key free). **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 5 — NOTICIAS Y TRENDING

### 46. `news_urgent` — Noticias urgentes
**Qué hace:** titulares de última hora de agencias fiables.
**Ejemplos:** "¿Qué pasó hoy importante?", "Noticias urgentes del mundo".
**API/Origen:** [GDELT](https://api.gdeltproject.org/) + RSS (Reuters, AP, BBC). **Costo:** $0. **Riesgo:** readonly.

### 47. `news_topic` — Noticias por tema
**Qué hace:** noticias filtradas por tema (política, tech, ciencia).
**Ejemplos:** "Noticias de IA", "Qué pasa en Medio Oriente", "Tech de hoy".
**API/Origen:** GDELT + NewsAPI free + GNews free. **Costo:** $0. **Riesgo:** readonly.

### 48. `trending_twitter` — Trending en X/Twitter
**Qué hace:** topics más comentados ahora con volumen.
**Ejemplos:** "¿De qué se habla en X?", "Trending global ahora", "Trending en Argentina".
**API/Origen:** [Apify X Trends](https://apify.com/fastcrawler/x-twitter-trends-scraper-2025) (free tier) o snscrape local. **Costo:** $0 (free tier limitado). **Riesgo:** readonly.
**Nota:** X mató el tier free oficial; el scraper es la opción real.

### 49. `trending_reddit` — Trending en Reddit
**Qué hace:** posts más votados de un subreddit o front page.
**Ejemplos:** "Top de r/worldnews", "Qué está furor en r/movies".
**API/Origen:** [Reddit JSON](https://www.reddit.com/dev/api/) (sin OAuth). **Costo:** $0. **Riesgo:** readonly.

### 50. `trending_youtube` — Trending YouTube
**Qué hace:** videos en tendencia por país.
**Ejemplos:** "Trending YouTube Argentina", "Qué es furor en YouTube España".
**API/Origen:** Scraping (`youtube.com/feed/trending`). **Costo:** $0. **Riesgo:** readonly.

### 51. `trending_github` — Trending GitHub
**Qué hace:** repos más populares del día/semana.
**Ejemplos:** "Trending GitHub de la semana", "Repos que rompen hoy".
**API/Origen:** Scraping `github.com/trending`. **Costo:** $0. **Riesgo:** readonly.

### 52. `rss_subscribe` — Suscribirse a un feed
**Qué hace:** guarda un RSS como fuente para tu radar personal.
**Ejemplos:** "Seguí el feed de The Verge", "Sumá El Chiringuito".
**API/Origen:** Local + parser RSS. **Costo:** $0. **Riesgo:** local_write.

### 53. `rss_digest` — Resumen de tus feeds
**Qué hace:** lee tus suscripciones y resume lo importante del día.
**Ejemplos:** "Resumí mis feeds", "Qué de interesante hoy en mis fuentes".
**API/Origen:** Local + Ollama (summarize). **Costo:** $0. **Riesgo:** readonly.

### 54. `news_radar_topic` — Radar de tema
**Qué hace:** monitorea un tema en fuentes múltiples y avisa cuando hay novedad.
**Ejemplos:** "Avisame cuando salga algo sobre el nuevo Zelda", "Radar de IA generativa".
**API/Origen:** RSS + GDELT + semantic search. **Costo:** $0. **Riesgo:** local_write (configura nudge).

### 55. `world_signal` — Señal del mundo
**Qué hace:** síntesis de qué se habla en el mundo sobre un tema (cross-fuente).
**Ejemplos:** "¿De qué se habla en el mundo sobre Argentina?", "El mundo habla de X?".
**API/Origen:** GDELT GKG. **Costo:** $0. **Riesgo:** readonly.
**Fit:** ya existe `world_signal` actionKind — ahora con datos reales.

---

# 🟢 BLOQUE 6 — PERSONAJES Y FAMOSOS

### 56. `person_info` — Info de personaje famoso
**Qué hace:** biografía, edad, profesión, obras, premios de una figura pública.
**Ejemplos:** "¿Quién es Taylor Swift?", "Decime de Messi", "Info de Nolan".
**API/Origen:** [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) + Wikidata. **Costo:** $0. **Riesgo:** readonly.

### 57. `person_follow` — Seguir a un personaje
**Qué hace:** guarda la persona y genera nudes cuando hay noticias suyas.
**Ejemplos:** "Seguí a Tarantino", "Avisame cuando saque algo elonmusk".
**API/Origen:** Local + news_topic. **Costo:** $0. **Riesgo:** local_write.

### 58. `person_filmography` — Filmografía / discografía / obras
**Qué hace:** lista de películas/álbumes/libros de un artista.
**Ejemplos:** "Películas de Scorsese", "Discografía de Radiohead".
**API/Origen:** [Wikidata](https://www.wikidata.org/) + Wikipedia. **Costo:** $0. **Riesgo:** readonly.

### 59. `movie_info` — Info de película/serie
**Qué hace:** sinopsis, reparto, año, rating, dónde ver.
**Ejemplos:** "¿De qué va Oppenheimer?", "Rating de The Bear", "Dónde ver Severance".
**API/Origen:** [OMDb](https://www.omdbapi.com/) (key free) + TMDB free. **Costo:** $0. **Riesgo:** readonly.

### 60. `book_info` — Info de libro
**Qué hace:** sinopsis, autor, año, género, dónde comprar.
**Ejemplos:** "¿De qué trata 1984?", "Info del último Murakami".
**API/Origen:** [Open Library](https://openlibrary.org/). **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 7 — APPS Y JUEGOS (lo que pediste)

### 61. `app_recommend` — Recomendar app móvil/PC
**Qué hace:** sugiere apps por necesidad/plataforma con rating y por qué.
**Ejemplos:** "App para tomar notas en Android", "Mejor lector de RSS en iOS", "App de meditación gratuita".
**API/Origen:** Scraping Play Store / App Store + `structureExtractor`. **Costo:** $0. **Riesgo:** readonly.

### 62. `game_recommend` — Recomendar juegos
**Qué hace:** sugiere juegos por género/plataforma con rating y reseñas.
**Ejemplos:** "Juegos parecidos a Stardew Valley", "Indies buenos en Steam", "Juego de Switch para jugar con amigos".
**API/Origen:** [Steam](https://steamcommunity.com/dev) (free) + [IGDB](https://api-docs.igdb.com/) (Twitch key free). **Costo:** $0. **Riesgo:** readonly.

### 63. `game_deals` — Ofertas de juegos
**Qué hace:** descuentos actuales en Steam/GOG/Epic.
**Ejemplos:** "Ofertas de Steam hoy", "Algo barato y bueno en GOG".
**API/Origen:** [Cheap Shark API](https://apidocs.cheapshark.com/) (sin key). **Costo:** $0. **Riesgo:** readonly.

### 64. `app_deals` — Ofertas de apps
**Qué hace:** apps de pago gratis por tiempo limitado.
**Ejemplos:** "Apps gratis hoy".
**API/Origen:** Scraping. **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 8 — DOCUMENTOS Y PRODUCTIVIDAD

### 65. `doc_create_md` — Crear documento Markdown
**Qué hace:** genera un .md con estructura (encabezados, listas, código).
**Ejemplos:** "Hacé un doc con la minuta de la reunión", "Escribí un README para mi proyecto".
**API/Origen:** Local + Ollama. **Costo:** $0. **Riesgo:** local_write.

### 66. `doc_create_pdf` — Crear PDF
**Qué hace:** exporta un documento a PDF con formato.
**Ejemplos:** "Pasá eso a PDF", "Hacé un informe en PDF del viaje".
**API/Origen:** Local (lib PDF). **Costo:** $0. **Riesgo:** local_write.

### 67. `doc_create_word` — Crear Word (.docx)
**Qué hace:** genera .docx editable en Word.
**Ejemplos:** "Hacé un CV en Word", "Documento con estos apuntes".
**API/Origen:** Local (docx lib). **Costo:** $0. **Riesgo:** local_write.

### 68. `doc_create_excel` — Crear Excel (.xlsx)
**Qué hace:** genera planilla con datos/tablas/fórmulas.
**Ejemplos:** "Excel con mis gastos del mes", "Planilla de notas del curso".
**API/Origen:** Local (xlsx lib). **Costo:** $0. **Riesgo:** local_write.

### 69. `note_write` — Escribir nota
**Qué hace:** crea una nota de texto (rápida).
**Ejemplos:** "Anota: comprar pan", "Nota: idea de regalo para Lu".
**API/Origen:** Local (`idea`/`recommendation` record). **Costo:** $0. **Riesgo:** local_write.

### 70. `note_show` — Ver notas
**Qué hace:** lista tus notas guardadas.
**Ejemplos:** "Mostrame mis notas", "¿Qué anoté ayer?".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 71. `note_search` — Buscar en notas
**Qué hace:** búsqueda semántica en tus notas/records.
**Ejemplos:** "¿Qué anoté sobre vacaciones?".
**API/Origen:** Local + Ollama embeddings. **Costo:** $0. **Riesgo:** readonly.

### 72. `project_create` — Crear proyecto
**Qué hace:** agrupa notas/records/tareas bajo un proyecto con nombre.
**Ejemplos:** "Creá el proyecto Viaje a Japón", "Proyecto Renovar cocina".
**API/Origen:** Local (collection en `LifeRecord`). **Costo:** $0. **Riesgo:** local_write.

### 73. `project_add` — Añadir a proyecto
**Qué hace:** agrega nota/recurso/tarea a un proyecto existente.
**Ejemplos:** "Sumá esto al proyecto Viaje a Japón".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 74. `project_show` — Ver proyecto
**Qué hace:** muestra todo lo guardado de un proyecto.
**Ejemplos:** "Mostrame el proyecto Viaje a Japón".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 75. `task_create` — Crear tarea
**Qué hace:** añade una tarea/commitment con fecha y prioridad.
**Ejemplos:** "Tarea: llamar al dentista mañana", "Para el viernes: enviar CV".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 76. `task_list` — Ver tareas pendientes
**Qué hace:** lista tareas abiertas ordenadas por prioridad/fecha.
**Ejemplos:** "¿Qué tengo pendiente?", "Tareas de esta semana".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 77. `task_done` — Marcar tarea hecha
**Qué hace:** cierra una tarea.
**Ejemplos:** "Listo la de dentista", "Completé el informe".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 78. `calendar_add` — Agregar cita al calendario
**Qué hace:** crea un evento local (fecha, hora, ubicación).
**Ejemplos:** "Cita con el médico el 15 a las 10", "Cumpleaños de Marta el 22".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 79. `calendar_show` — Ver agenda
**Qué hace:** eventos próximos en orden cronológico.
**Ejemplos:** "¿Qué tengo esta semana?", "Agenda de hoy".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 80. `calendar_export_ics` — Exportar a ICS
**Qué hace:** genera .ics para sincronizar con Google/Apple Calendar.
**Ejemplos:** "Exportá mi agenda a ICS".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 81. `countdown` — Cuenta regresiva
**Qué hace:** muestra cuánto falta para una fecha/evento.
**Ejemplos:** "¿Cuánto falta para mi cumpleaños?", "Falta para Navidad".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 82. `reminder_set` — Recordatorio
**Qué hace:** programa un nudge para una fecha/hora.
**Ejemplos:** "Recordame llamar a mamá a las 18", "Avisame el 20 del pago".
**API/Origen:** Local + heartbeat. **Costo:** $0. **Riesgo:** local_write.

### 83. `alarm_set` — Alarma
**Qué hace:** alarma a una hora concreta con repetición opcional.
**Ejemplos:** "Despertador 7am", "Alarma para recoger a los chicos a las 16".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 84. `sunrise_sunset` — Amanecer y atardecer
**Qué hace:** hora de salida/puesta del sol para una ubicación y fecha.
**Ejemplos:** "¿A qué hora sale el sol mañana?", "Atardecer hoy en Madrid".
**API/Origen:** [Sunrise-Sunset API](https://sunrise-sunset.org/api) (sin key). **Costo:** $0. **Riesgo:** readonly.

### 85. `moon_phase` — Fase lunar
**Qué hace:** fase lunar actual + próxima luna llena/nueva.
**Ejemplos:** "¿Qué luna hay hoy?", "Cuándo es la próxima luna llena".
**API/Origen:** Local (cálculo astronómico). **Costo:** $0. **Riesgo:** readonly.

### 86. `holidays` — Feriados
**Qué hace:** feriados nacionales de un país.
**Ejemplos:** "¿Cuándo es el próximo feriado?", "Feriados de España 2025".
**API/Origen:** [Nager.Date](https://date.nager.at/) (sin key). **Costo:** $0. **Riesgo:** readonly.

### 87. `time_zone` — Conversión de zona horaria
**Qué hace:** hora actual en otra ciudad + conversión.
**Ejemplos:** "¿Qué hora es en Tokyo?", "Si llamo a las 10am Madrid, qué hora es allá?".
**API/Origen:** Intl del navegador. **Costo:** $0. **Riesgo:** readonly.

### 88. `ocr_text` — Texto desde imagen
**Qué hace:** extrae texto de una imagen (ticket, cartel, documento).
**Ejemplos:** "Lee este ticket de compra", "¿Qué dice este cartel?".
**API/Origen:** Ollama LLaVA / Llama 3.2 Vision (local). **Costo:** $0. **Riesgo:** readonly.

### 89. `data_analyze` — Análisis de datos
**Qué hace:** pega datos (CSV/tabla) y Koru los analiza (media, tendencias, top, correlaciones).
**Ejemplos:** "Analizá estos gastos", "Tendencia de mis ventas".
**API/Origen:** Local + Ollama. **Costo:** $0. **Riesgo:** readonly.

### 90. `data_chart` — Generar gráfico
**Qué hace:** genera gráfico (líneas, barras, torta) a partir de datos.
**Ejemplos:** "Gráfico de mis gastos por mes", "Barras de mis hábitos de sueño".
**API/Origen:** Local (lib chart ligera). **Costo:** $0. **Riesgo:** local_write.

### 91. `translate` — Traductor
**Qué hace:** traduce texto entre idiomas.
**Ejemplos:** "Traducí 'buen día' al japonés", "Cómo se dice gracias en árabe".
**API/Origen:** Ollama (local). **Costo:** $0. **Riesgo:** readonly.

### 92. `lyrics_find` — Letra de canción
**Qué hace:** busca la letra de una canción.
**Ejemplos:** "Letra de Bohemian Rhapsody", "Cómo sigue esa de Cerati".
**API/Origen:** [lyrics.ovh](https://lyricsovh.docs.apiary.io/) (sin key). **Costo:** $0. **Riesgo:** readonly.

### 93. `deep_research` — Investigación profunda
**Qué hace:** abre múltiples fuentes, contrasta, valida con citas, sintetiza con referencias.
**Ejemplos:** "Investigá si conviene alquilar o comprar", "Investigá tratamientos para el insomnio".
**API/Origen:** Web scraping multi-fuente + `structureExtractor` + Ollama. **Costo:** $0. **Riesgo:** readonly.
**Fit:** ya existe `deep_research` actionKind — ahora con anti-alucinación real.

### 94. `summarize_url` — Resumir URL
**Qué hace:** lee un artículo/página y lo resume en 5 bullets.
**Ejemplos:** "Resumí este artículo", "De qué va este link".
**API/Origen:** `fetchPageContent` (ya existe) + Ollama. **Costo:** $0. **Riesgo:** readonly.

### 95. `summarize_text` — Resumir texto pegado
**Qué hace:** resume cualquier texto pegado.
**Ejemplos:** "Resumí estos apuntes", "Síntesis de este email".
**API/Origen:** Ollama (local). **Costo:** $0. **Riesgo:** readonly.

### 96. `extract_action_items` — Tareas de un texto
**Qué hace:** de notas/reuniones/email extrae la lista de tareas.
**Ejemplos:** "¿Qué tareas surgen de esta minuta?".
**API/Origen:** Ollama. **Costo:** $0. **Riesgo:** local_write (crea commitments).

### 97. `email_draft` — Borrador de email
**Qué hace:** redacta un email listo para revisar.
**Ejemplos:** "Escribile a mi jefe pidiendo vacaciones", "Respuesta cortés a la queja".
**API/Origen:** Ollama. **Costo:** $0. **Riesgo:** readonly.

### 98. `message_draft` — Borrador de mensaje
**Qué hace:** redacta SMS/WhatsApp corto.
**Ejemplos:** "Mensaje para mi novia que llego tarde", "Confirmación al cliente".
**API/Origen:** Ollama. **Costo:** $0. **Riesgo:** readonly.

### 99. `copy_to_clipboard` — Copiar al portapapeles
**Qué hace:** copia texto al clipboard para usar en otra app.
**Ejemplos:** "Copiá eso", "Al portapapeles".
**API/Origen:** Web API. **Costo:** $0. **Riesgo:** local_write.

### 100. `qr_generate` — Generar QR
**Qué hace:** crea QR para texto/URL/WiFi.
**Ejemplos:** "QR para mi WiFi", "Código QR para este link".
**API/Origen:** [GoQR](https://goqr.me/api/). **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 9 — MEMORIA Y CONOCIMIENTO PERSONAL

### 101. `memory_save` — Guardar memoria
**Qué hace:** guarda algo que Koru debe recordar del usuario.
**Ejemplos:** "Soy alérgico a la penicilina", "Mi mamá se llama Marta".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 102. `memory_search` — Buscar en memoria
**Qué hace:** búsqueda semántica en lo que Koru sabe de ti.
**Ejemplos:** "¿Qué te dije sobre mi familia?", "Recordás algo de mi dieta?".
**API/Origen:** Ollama embeddings + coseno. **Costo:** $0. **Riesgo:** readonly.
**Fit:** reemplaza el matching léxico frágil — el salto más grande.

### 103. `memory_forget` — Olvidar
**Qué hace:** elimina una memoria.
**Ejemplos:** "Olvidá lo de la alergia, ya no".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 104. `memory_edit` — Editar memoria
**Qué hace:** corrige una memoria guardada.
**Ejemplos:** "Mi dirección nueva es...", "Cambia mi número".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** local_write.

### 105. `memory_garden_show` — Ver el jardín
**Qué hace:** muestra todas las memorias (el "jardín" de Koru).
**Ejemplos:** "Mostrame mi jardín", "Qué sabés de mí".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 106. `wikipedia_lookup` — Wikipedia
**Qué hace:** resumen enciclopédico de cualquier tema.
**Ejemplos:** "¿Qué es el efecto placebo?", "Quién era Borges".
**API/Origen:** [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/). **Costo:** $0. **Riesgo:** readonly.

### 107. `dictionary_define` — Diccionario
**Qué hace:** define una palabra + sinónimos.
**Ejemplos:** "¿Qué significa 'perenne'?", "Sinónimos de 'efímero'".
**API/Origen:** [Free Dictionary API](https://dictionaryapi.dev/). **Costo:** $0. **Riesgo:** readonly.

### 108. `dictionary_translate_slang` — Modismos
**Qué hace:** explica modismos/jerga por país.
**Ejemplos:** "¿Qué significa 'chévere'?", "Cómo se dice 'genial' en México".
**API/Origen:** Wiktionary + Ollama. **Costo:** $0. **Riesgo:** readonly.

### 109. `unit_convert` — Conversión de unidades
**Qué hace:** metros a pies, kg a libras, litros, temperatura.
**Ejemplos:** "200 gramos en onzas", "30°C a Fahrenheit".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 110. `math_calc` — Calculadora
**Qué hace:** cálculo con explicación paso a paso.
**Ejemplos:** "15% de 230", "Cuánto es 234 × 18".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 10 — SALUD Y BIENESTAR

### 111. `medication_reminder` — Esquema de medicación
**Qué hace:** organiza horarios de pastillas y avisa.
**Ejemplos:** "Recordame el ibuprofeno cada 8 horas por 5 días".
**API/Origen:** Local + heartbeat. **Costo:** $0. **Riesgo:** local_write.

### 112. `sleep_track` — Registrar sueño
**Qué hace:** anota horas de dormir/despertar y calcula promedio.
**Ejemplos:** "Dormí 6 horas anoche", "Cómo viene mi sueño esta semana".
**API/Origen:** Local (`sleep` record). **Costo:** $0. **Riesgo:** local_write.

### 113. `hydration_remind` — Recordatorio de hidratación
**Qué hace:** nudge periódico para tomar agua según tu rutina.
**Ejemplos:** "Avisame cada 2 horas que tome agua".
**API/Origen:** Local + heartbeat. **Costo:** $0. **Riesgo:** local_write.

### 114. `mood_track` — Registro de ánimo
**Qué hace:** registra cómo te sentís para ver tendencias.
**Ejemplos:** "Hoy me siento bien", "Vengo cansado esta semana".
**API/Origen:** Local (`sentiment`). **Costo:** $0. **Riesgo:** local_write.

### 115. `habit_streak` — Racha de hábito
**Qué hace:** cuenta días seguidos de un hábito y te alienta.
**Ejemplos:** "Cuántos días seguidos gimnasio", "Racha de meditación".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.

### 116. `air_quality_advice` — Consejo por calidad de aire
**Qué hace:** combina datos de PM2.5 con tu rutina (ej: entrenar indoor si malo).
**Ejemp:** (nudge) "PM2.5 alto hoy, mejor entrenar indoor".
**API/Origen:** Open-Meteo AQ + Local. **Costo:** $0. **Riesgo:** readonly.

---

# 🟢 BLOQUE 11 — UTILIDADES

### 117. `url_shorten` — Acortar URL
**Qué hace:** acorta un link largo.
**Ejemplos:** "Acortá este link de Google Maps".
**API/Origen:** [is.gd](https://is.gd/). **Costo:** $0. **Riesgo:** readonly.

### 118. `password_gen` — Generar contraseña
**Qué hace:** contraseña fuerte aleatoria.
**Ejemplos:** "Generá una contraseña de 16 caracteres".
**API/Origen:** Local crypto. **Costo:** $0. **Riesgo:** readonly.

### 119. `quote_of_day` — Cita del día
**Qué hace:** frase inspiradora del día.
**Ejemplos:** "Una cita para hoy".
**API/Origen:** [ZenQuotes](https://zenquotes.io/). **Costo:** $0. **Riesgo:** readonly.

### 120. `self_health_check` — Diagnóstico de Koru
**Qué hace:** verifica providers, Ollama, IndexedDB, latencia. Honestidad total.
**Ejemplos:** "¿Koru, estás bien?", "Estado de tus servicios".
**API/Origen:** Local. **Costo:** $0. **Riesgo:** readonly.
**Fit:** coherente con la identidad honesta de Koru.

---

# 📊 RESUMEN POR BLOQUE

| Bloque | Tools | Estado |
|--------|-------|--------|
| 1. Deportes | 10 | nuevo |
| 2. Comida/Restaurantes | 10 | nuevo |
| 3. Viajes/Transporte | 10 | nuevo |
| 4. Dinero/Mercados | 15 | mixto (algunos ya existen) |
| 5. Noticias/Trending | 10 | nuevo |
| 6. Personajes/Famosos | 5 | nuevo |
| 7. Apps/Juegos | 4 | nuevo |
| 8. Documentos/Productividad | 36 | mixto |
| 9. Memoria/Conocimiento | 10 | mixto |
| 10. Salud/Bienestar | 6 | mixto |
| 11. Utilidades | 4 | nuevo |
| **TOTAL** | **120** | |

---

# 🎯 PRIORIDADES DE IMPLEMENTACIÓN

## 🟢 FASE 1 — "Lo que la gente usa cada semana" (TOP 30)
**1-10 Deportes** (ESPN, TheSportsDB, Ergast) + **11-20 Comida** (deep search multi-fuente con `structureExtractor` — la killer feature) + **31-35 Dinero** (Frankfurter, CoinGecko, Stooq) + **46-50 Trending** (Apify, Reddit, YouTube, GitHub) + **101-102 Memoria semántica**.

Implementación: reutiliza el patrón de `shopping_compare` + `structureExtractor`. El deep search de restaurantes y productos es donde Koru se diferencia de cualquier asistente.

## 🟡 FASE 2 — "Planificación y documentos" (~40 tools)
**21-30 Viajes** (Amadeus free, OpenSky, OSRM multimodal) + **65-90 Documentos** (md/pdf/word/excel, OCR, análisis datos, traductor) + **21-30 + 56-60 Personajes** (Wikipedia + Wikidata).

## 🔴 FASE 3 — "Nicho y utilidades" (~50 tools)
Resto: salud, bienestar, modismos, citas, nichos físicos (aurora, mareas), flight tracking de lujo.

---

# 🔑 NOTAS DE IMPLEMENTACIÓN

1. **Anti-alucinación SIEMPRE**: toda tool que lea la web pasa por `structureExtractor` → cada dato con cita literal verificable. Es el ADN de Koru.
2. **`ToolPolicy` por tool**: las `destructive` (`file_write`, `shell_run`) exigen aprobación explícita del usuario.
3. **Cache obligatorio**: Nominatim (1/s), OSRM, GDELT, todas las APIs con rate-limit. TTL en memoria + IndexedDB.
4. **User-Agent propio** `KoruLocal/1.0` en todas las llamadas.
5. **Preferir local**: Ollama para NER/summarize/translate/OCR/TTS. Web APIs nativas para clipboard/notify/share.
6. **Descripciones al LLM en español** con variantes léxicas (como las actuales) para que el router nativo + el semantic router las detecten.
7. **No inventar**: si una API falla, devolver `status: "failed"` y dejar que el system prompt impida la alucinación.
8. **Las tools de comida/deportes/viajes son las que más retención generan**: un usuario que prueba "¿dónde como bien en Roma?" y Koru le cruza 5 fuentes, no vuelve a ChatGPT.

---

*Documento generado 2026-06-23. Integra la lista del usuario con las tools técnicas de los documentos 07. Enfoque: utilidad cotidiana real, no curiosidad técnica.*
