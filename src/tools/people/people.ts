/**
 * Bloque People — Personajes famosos, películas, libros, videojuegos.
 * APIs: Wikipedia REST (sin key), Open Library (sin key), RAWG (key gratuita).
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { limiters } from "../shared/rateLimiter";

// Wikipedia API requiere User-Agent válido (sino devuelve 403).
const WIKI_HEADERS = { "User-Agent": "KoruBot/1.0 (personal assistant; contact: dev@koru.app)" };

// 🔴 v4: Formatea un monto en dólares (TMDB trae budget/revenue en USD enteros).
//  - budget: siempre en millones (150_000_000 → "$150M")
//  - revenue (boxOffice): si supera 1B usa "B", si no "M"
// Devuelve undefined para 0 o valores no finitos (TMDB a veces trae 0 cuando
// el dato no está publicado — lo tratamos como "sin info" para no mostrar "$0M").
function formatBudget(amount: unknown): string | undefined {
  const n = typeof amount === "number" && Number.isFinite(amount) ? amount : undefined;
  if (n == null || n <= 0) return undefined;
  const millions = n / 1_000_000;
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  return `$${Math.round(millions)}M`;
}

function formatBoxOffice(amount: unknown): string | undefined {
  const n = typeof amount === "number" && Number.isFinite(amount) ? amount : undefined;
  if (n == null || n <= 0) return undefined;
  const billions = n / 1_000_000_000;
  if (billions >= 1) return `$${billions.toFixed(1)}B`;
  const millions = n / 1_000_000;
  return `$${Math.round(millions)}M`;
}

// ─── person_info ────────────────────────────────────────────────────────────
type WikiSummary = {
  type?: string;
  title?: string;
  displaytitle?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

export const personInfo: ToolHandler = {
  definition: defineTool(
    "person_info",
    "Biografía, edad, profesión, obras y premios de una figura pública. Úsala cuando el usuario diga 'quién es Taylor Swift?', 'decime de Messi', 'info de Nolan', 'cuántos años tiene Spielberg'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre de la persona." },
        lang: { type: "string", description: "Idioma (ej: 'es', 'en'). Default 'es'." },
      },
      required: ["name"],
    },
  ),
  policy: policies.readonly("Lee biografía de Wikipedia."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const lang = String(args.lang ?? "es").trim();
    if (!name) return { type: "person_info", status: "failed", error: "Indicá el nombre." };

    const cacheKey = `person:${lang}:${name.toLowerCase()}`;
    const summary = await cached<WikiSummary>(cacheKey, ttls.reference, async () => {
      await limiters.wikipedia.acquire();
      const r = await fetchJson<WikiSummary>(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
        { timeoutMs: 9_000, headers: { Accept: "application/json" } },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data!;
    });

    if (summary.type === "not_found" || !summary.extract) {
      return { type: "person_info", status: "ok", name, note: `No encontré "${name}" en Wikipedia (${lang}). Probá en inglés o con otro nombre.` };
    }

    return {
      type: "person_info",
      status: "ok",
      name: summary.title ?? name,
      description: summary.description,
      extract: summary.extract,
      thumbnail: summary.thumbnail?.source,
      wikiUrl: summary.content_urls?.desktop?.page,
      source: "Wikipedia",
    };
  },
};

// ─── person_follow ──────────────────────────────────────────────────────────
export const personFollow: ToolHandler = {
  definition: defineTool(
    "person_follow",
    "Guarda una persona como favorita para que Koru te avise cuando haya noticias suyas. Úsala cuando el usuario diga 'seguí a Tarantino', 'avisame cuando saque algo Elon Musk', 'vigilar a X'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre de la persona." },
      },
      required: ["name"],
    },
  ),
  policy: policies.localWrite("Guarda persona favorita como memory."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    if (!name) return { type: "person_follow", status: "failed", error: "Indicá el nombre." };
    return {
      type: "person_follow",
      status: "ok",
      name,
      memoryCandidates: [{
        kind: "interest" as const,
        text: `Sigue a ${name}`,
        confidence: 0.95,
        sensitivity: "normal" as const,
        status: "candidate" as const,
        rootQuote: name,
        useForSuggestions: true,
      }],
    };
  },
};

// ─── person_filmography ─────────────────────────────────────────────────────
export const personFilmography: ToolHandler = {
  definition: defineTool(
    "person_filmography",
    "Lista de películas/álbumes/libros/obras de un artista. Úsala cuando el usuario diga 'películas de Scorsese', 'discografía de Radiohead', 'libros de Murakami'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Nombre del artista." },
        kind: { type: "string", enum: ["film", "music", "books", "any"], default: "any" },
      },
      required: ["name"],
    },
  ),
  policy: policies.readonly("Busca obras en Wikipedia."),
  async run(args) {
    const name = String(args.name ?? "").trim();
    const kind = String(args.kind ?? "any");
    if (!name) return { type: "person_filmography", status: "failed", error: "Indicá el nombre." };
    const kindQuery = kind === "film" ? "filmografía películas" : kind === "music" ? "discografía álbumes" : kind === "books" ? "libros obra" : "filmografía discografía libros";
    // Fase 3.1: usar Wikipedia API directamente en lugar de delegar a web_search.
    try {
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} ${kindQuery}`)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
      const data = await res.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
      const results = data.query?.search ?? [];
      if (results.length === 0) {
        return { type: "person_filmography", status: "ok", name, kind, note: `No encontré información sobre ${name} en Wikipedia.` };
      }
      // Fetch summary del primer resultado
      const firstTitle = results[0].title;
      const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
      const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
      return {
        type: "person_filmography",
        status: "ok",
        name,
        kind,
        text: summary.extract ?? `Encontré información sobre ${firstTitle}.`,
        sources: [{ title: firstTitle, url: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`, domain: "wikipedia.org", snippet: results[0].snippet?.replace(/<[^>]+>/g, "") }],
      };
    } catch (err) {
      console.warn("[Koru] person_filmography Wikipedia fetch failed:", err instanceof Error ? err.message : err);
      return { type: "person_filmography", status: "failed", error: `No pude buscar información sobre ${name}.` };
    }
  },
};

// ─── movie_info ─────────────────────────────────────────────────────────────
export const movieInfo: ToolHandler = {
  definition: defineTool(
    "movie_info",
    "Información de películas y series: sinopsis, reparto, año, rating, géneros y dónde verla. Usala cuando el usuario pregunte por una película específica, pida recomendaciones ('recomendame una peli'), o quiera saber de qué trata una película. Si el usuario no nombra una película específica, elegí una buena y buscala.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Título de la película o serie." },
        year: { type: "string", description: "Año opcional para desambiguar." },
      },
      required: ["title"],
    },
  ),
  policy: policies.readonly("Busca info de película en Wikipedia + TMDB."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const year = String(args.year ?? "").trim();
    if (!title) return { type: "movie_info", status: "failed", error: "Indicá el título." };

    // 🔴 FIX P2: enriquecer con TMDB (poster, rating, géneros, estreno, runtime, sinopsis original)
    // TMDB soporta 2 métodos de auth:
    //  - Bearer token (v4, preferido): Authorization: Bearer XXX header
    //  - API key (v3, fallback): ?api_key=XXX query param
    const TMDB_BEARER = process.env.TMDB_BEARER_TOKEN || "";
    const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
    const tmdbHeaders: Record<string, string> = TMDB_BEARER
      ? { "Authorization": `Bearer ${TMDB_BEARER}`, "Content-Type": "application/json" }
      : {};
    const tmdbAuthParam = TMDB_BEARER ? "" : (TMDB_API_KEY ? `&api_key=${TMDB_API_KEY}` : "");
    const tmdbEnabled = Boolean(TMDB_BEARER || TMDB_API_KEY);

    let tmdbData: {
      poster?: string;
      rating?: number;
      releaseDate?: string;
      genres?: string[];
      runtime?: string;
      overview?: string;
      cast?: string[];
      director?: string;
      imdbId?: string;
      trailerUrl?: string;
      whereToWatch?: string[];
      streaming?: Array<{ provider: string; logo?: string; deeplink?: string }>;
      crew?: Array<{ name: string; job: string }>;
      ratings?: Array<{ source: string; score: number; outOf: number }>;
      // 🔴 v4: presupuesto y taquilla (presupuesto vs recaudación) formateados.
      budget?: string;
      boxOffice?: string;
    } = {};

    if (tmdbEnabled) {
      try {
        // Search movie by title
        const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}&language=es-ES${tmdbAuthParam}`;
        const searchRes = await fetch(searchUrl, {
          headers: tmdbHeaders,
          signal: AbortSignal.timeout(9000),
        });
        const searchData = await searchRes.json() as { results?: Array<{ id: number; poster_path?: string; vote_average?: number; release_date?: string; genre_ids?: number[]; overview?: string }> };
        const first = searchData.results?.[0];
        if (first) {
          tmdbData.poster = first.poster_path ? `https://image.tmdb.org/t/p/w500${first.poster_path}` : undefined;
          tmdbData.rating = typeof first.vote_average === "number" ? Math.round(first.vote_average * 10) / 10 : undefined;
          tmdbData.releaseDate = first.release_date;
          tmdbData.overview = first.overview;
          // Get details (runtime, genres, director, cast, imdb_id)
          const detailsUrl = `https://api.themoviedb.org/3/movie/${first.id}?language=es-ES${tmdbAuthParam}&append_to_response=credits`;
          const detailsRes = await fetch(detailsUrl, {
            headers: tmdbHeaders,
            signal: AbortSignal.timeout(9000),
          });
          const details = await detailsRes.json() as {
            runtime?: number;
            genres?: Array<{ id: number; name: string }>;
            imdb_id?: string;
            budget?: number;
            revenue?: number;
            credits?: { crew?: Array<{ job: string; name: string }>; cast?: Array<{ name: string }> };
          };
          if (details.runtime) tmdbData.runtime = `${details.runtime} min`;
          if (details.genres) tmdbData.genres = details.genres.map(g => g.name);
          if (details.imdb_id) tmdbData.imdbId = details.imdb_id;
          // 🔴 v4: presupuesto y taquilla (TMDB los publica en USD enteros).
          // Formateamos a "$150M" / "$1.2B"; si la API trae 0 lo omitimos.
          const budgetStr = formatBudget(details.budget);
          if (budgetStr) tmdbData.budget = budgetStr;
          const boxStr = formatBoxOffice(details.revenue);
          if (boxStr) tmdbData.boxOffice = boxStr;

          // Crew extraction: Director (existing) + Writer, Composer, Cinematographer (new)
          const crewList: Array<{ name: string; job: string }> = [];
          if (details.credits?.crew) {
            const findCrew = (job: string) => details.credits!.crew!.find(c => c.job === job);
            const dir = findCrew("Director");
            if (dir) tmdbData.director = dir.name;
            const writer = findCrew("Writer");
            if (writer) crewList.push({ name: writer.name, job: "Writer" });
            const composer = findCrew("Original Music Composer") ?? findCrew("Music");
            if (composer) crewList.push({ name: composer.name, job: "Composer" });
            const cinematographer = findCrew("Director of Photography");
            if (cinematographer) crewList.push({ name: cinematographer.name, job: "Cinematographer" });
            if (crewList.length > 0) tmdbData.crew = crewList;
          }
          if (details.credits?.cast) {
            tmdbData.cast = details.credits.cast.slice(0, 5).map(c => c.name);
          }

          // 🎬 Trailer URL: first YouTube trailer from /videos endpoint
          try {
            const videosUrl = `https://api.themoviedb.org/3/movie/${first.id}/videos?language=es-ES${tmdbAuthParam}`;
            const videosRes = await fetch(videosUrl, {
              headers: tmdbHeaders,
              signal: AbortSignal.timeout(9000),
            });
            const videos = await videosRes.json() as { results?: Array<{ type?: string; site?: string; key?: string }> };
            const trailer = videos.results?.find(v => v.type === "Trailer" && v.site === "YouTube" && v.key);
            if (trailer?.key) tmdbData.trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
          } catch (err) {
            console.warn("[Koru] movie_info TMDB videos fetch failed:", err instanceof Error ? err.message : err);
          }

          // 📺 Where to watch: extract ES (Spain) flatrate streaming providers
          try {
            const providersUrl = `https://api.themoviedb.org/3/movie/${first.id}/watch/providers?language=es-ES${tmdbAuthParam}`;
            const providersRes = await fetch(providersUrl, {
              headers: tmdbHeaders,
              signal: AbortSignal.timeout(9000),
            });
            const providers = await providersRes.json() as {
              results?: Record<string, { link?: string; flatrate?: Array<{ provider_name?: string; logo_path?: string }> }>;
            };
            const esEntry = providers.results?.["ES"];
            if (esEntry?.flatrate && esEntry.flatrate.length > 0) {
              const streaming = esEntry.flatrate
                .map(p => ({
                  provider: p.provider_name ?? "",
                  logo: p.logo_path ? `https://image.tmdb.org/t/p/w200${p.logo_path}` : undefined,
                  deeplink: esEntry.link,
                }))
                .filter(s => s.provider);
              if (streaming.length > 0) {
                tmdbData.streaming = streaming;
                tmdbData.whereToWatch = streaming.map(s => s.provider);
              }
            }
          } catch (err) {
            console.warn("[Koru] movie_info TMDB providers fetch failed:", err instanceof Error ? err.message : err);
          }

          // ⭐ Multiple ratings (IMDb, RT, Metacritic) from OMDB if OMDB_API_KEY is set
          const OMDB_API_KEY = process.env.OMDB_API_KEY;
          if (OMDB_API_KEY && tmdbData.imdbId) {
            try {
              const omdbUrl = `https://www.omdbapi.com/?i=${tmdbData.imdbId}&apikey=${OMDB_API_KEY}`;
              const omdbRes = await fetch(omdbUrl, { signal: AbortSignal.timeout(9000) });
              const omdb = await omdbRes.json() as {
                Response?: string;
                imdbRating?: string;
                Metascore?: string;
                Ratings?: Array<{ Source?: string; Value?: string }>;
              };
              if (omdb.Response === "True") {
                const ratings: Array<{ source: string; score: number; outOf: number }> = [];
                // IMDb (e.g. "7.5/10")
                const imdbVal = omdb.Ratings?.find(r => r.Source === "Internet Movie Database")?.Value ?? omdb.imdbRating;
                if (imdbVal) {
                  const m = imdbVal.match(/^([\d.]+)\/(\d+)$/);
                  if (m) ratings.push({ source: "IMDb", score: parseFloat(m[1]), outOf: parseInt(m[2], 10) });
                }
                // Rotten Tomatoes (e.g. "85%")
                const rtVal = omdb.Ratings?.find(r => r.Source === "Rotten Tomatoes")?.Value;
                if (rtVal) {
                  const m = rtVal.match(/^(\d+)%$/);
                  if (m) ratings.push({ source: "Rotten Tomatoes", score: parseInt(m[1], 10), outOf: 100 });
                }
                // Metacritic (e.g. "65/100")
                const metaVal = omdb.Ratings?.find(r => r.Source === "Metacritic")?.Value ?? omdb.Metascore;
                if (metaVal) {
                  const m = metaVal.match(/^(\d+)\/(\d+)$/);
                  if (m) ratings.push({ source: "Metacritic", score: parseInt(m[1], 10), outOf: parseInt(m[2], 10) });
                }
                if (ratings.length > 0) tmdbData.ratings = ratings;
              }
            } catch (err) {
              // Si no hay OMDB key o falla, saltamos silenciosamente
              console.warn("[Koru] movie_info OMDB fetch failed (skipping silently):", err instanceof Error ? err.message : err);
            }
          }
        }
      } catch (err) {
        console.warn("[Koru] movie_info TMDB fetch failed (continuing with Wikipedia only):", err instanceof Error ? err.message : err);
      }
    }

    // Wikipedia para contexto adicional en español
    try {
      const searchQuery = year ? `${title} ${year} película` : `${title} película`;
      const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&origin=*&srlimit=3`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
      const data = await res.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
      const results = data.query?.search ?? [];
      const wikiExtract = results.length > 0
        ? await (async () => {
            try {
              const firstTitle = results[0].title;
              const summaryRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
              const summary = await summaryRes.json() as { extract?: string; content_urls?: { desktop?: { page: string } } };
              return {
                text: summary.extract,
                sourceUrl: summary.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(firstTitle)}`,
                snippet: results[0].snippet?.replace(/<[^>]+>/g, ""),
                sourceTitle: firstTitle,
              };
            } catch { return null; }
          })()
        : null;

      // 🔴 FIX CRÍTICO: Si NO tenemos TMDB y Wikipedia no encontró la película específica,
      // devolver status "failed" para que el backend haga fallback a web_search.
      // Antes devolvía status "ok" con datos vacíos → card inaccesible sin info.
      const hasTmdbData = Boolean(tmdbData.poster || tmdbData.overview || tmdbData.rating);
      const wikiFoundMovie = wikiExtract && wikiExtract.text &&
        // Verificar que el extracto de Wikipedia realmente trata sobre una película
        // (no sobre el sentimiento "obsesión" u otros significados)
        /\b(pel[ií]cula|film|movie|director|estren|cinematogr|actriz|actor|drama|thriller|comedia|terror|acci[oó]n)\b/i.test(wikiExtract.text);

      if (!hasTmdbData && !wikiFoundMovie) {
        return {
          type: "movie_info",
          status: "failed",
          error: `No pude encontrar la película "${title}" en mis fuentes. Probá con web_search.`,
          query: title,
        };
      }

      // Componer texto final: preferir overview de TMDB (más preciso), fallback a Wikipedia extract
      const text = tmdbData.overview || wikiExtract?.text || `Encontré información sobre ${title}.`;
      return {
        type: "movie_info",
        status: "ok",
        title,
        text,
        poster: tmdbData.poster,
        rating: tmdbData.rating,
        releaseDate: tmdbData.releaseDate,
        genres: tmdbData.genres,
        runtime: tmdbData.runtime,
        director: tmdbData.director,
        cast: tmdbData.cast,
        trailerUrl: tmdbData.trailerUrl,
        whereToWatch: tmdbData.whereToWatch,
        streaming: tmdbData.streaming,
        crew: tmdbData.crew,
        ratings: tmdbData.ratings,
        // 🔴 v4: presupuesto y taquilla formateados ("$150M" / "$1.2B").
        budget: tmdbData.budget,
        boxOffice: tmdbData.boxOffice,
        sources: wikiExtract?.sourceUrl
          ? [{ title: wikiExtract.sourceTitle ?? title, url: wikiExtract.sourceUrl, domain: "wikipedia.org", snippet: wikiExtract.snippet ?? "" }]
          : [],
      };
    } catch (err) {
      console.warn("[Koru] movie_info Wikipedia fetch failed:", err instanceof Error ? err.message : err);
      // Si TMDB funcionó, devolver igual con lo que tengamos
      if (tmdbData.poster || tmdbData.overview) {
        return {
          type: "movie_info",
          status: "ok",
          title,
          text: tmdbData.overview ?? `Encontré información sobre ${title}.`,
          poster: tmdbData.poster,
          rating: tmdbData.rating,
          releaseDate: tmdbData.releaseDate,
          genres: tmdbData.genres,
          runtime: tmdbData.runtime,
          director: tmdbData.director,
          cast: tmdbData.cast,
          trailerUrl: tmdbData.trailerUrl,
          whereToWatch: tmdbData.whereToWatch,
          streaming: tmdbData.streaming,
          crew: tmdbData.crew,
          ratings: tmdbData.ratings,
          budget: tmdbData.budget,
          boxOffice: tmdbData.boxOffice,
          sources: [],
        };
      }
      return { type: "movie_info", status: "failed", error: `No pude buscar información sobre ${title}.` };
    }
  },
};


// ─── book_info ──────────────────────────────────────────────────────────────
type OlBook = {
  title?: string;
  authors?: Array<{ name?: string }>;
  first_publish_date?: string;
  number_of_pages_median?: number;
  cover?: { medium?: string };
  key?: string;
};

export const bookInfo: ToolHandler = {
  definition: defineTool(
    "book_info",
    "Sinopsis, autor, año, género y dónde comprar de un libro. Úsala cuando el usuario diga 'de qué trata 1984?', 'info del último Murakami', 'autor de El Nombre de la Rosa'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Título del libro." },
        author: { type: "string", description: "Autor opcional." },
      },
      required: ["title"],
    },
  ),
  policy: policies.readonly("Lee info de Open Library."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const author = String(args.author ?? "").trim();
    if (!title) return { type: "book_info", status: "failed", error: "Indicá el título." };

    const cacheKey = `book:${title.toLowerCase()}:${author.toLowerCase()}`;
    const book = await cached<OlBook | null>(cacheKey, ttls.reference, async () => {
      const params = new URLSearchParams({ title });
      if (author) params.set("author", author);
      const r = await fetchJson<{ docs?: OlBook[] }>(
        `https://openlibrary.org/search.json?${params.toString()}&limit=1`,
        { timeoutMs: 9_000 },
      );
      if (!r.ok || !r.data!.docs?.length) return null;
      return r.data!.docs[0];
    });

    if (!book) {
      return { type: "book_info", status: "ok", title, note: `No encontré "${title}" en Open Library.` };
    }

    // 🔴 v4: construir URL de preview embebido de Archive.org.
    // Open Library devuelve `key` con la forma "/works/OL12345W"; el OLID es
    // la porción final ("OL12345W") y el embed de Archive.org lo sirve
    // directamente como https://archive.org/embed/{olid}.
    const olid = typeof book.key === "string"
      ? book.key.split("/").filter(Boolean).pop() ?? ""
      : "";
    const previewUrl = olid ? `https://archive.org/embed/${olid}` : undefined;

    return {
      type: "book_info",
      status: "ok",
      title: book.title ?? title,
      author: book.authors?.[0]?.name,
      firstPublished: book.first_publish_date,
      pages: book.number_of_pages_median,
      coverUrl: book.cover?.medium,
      openLibraryUrl: book.key ? `https://openlibrary.org${book.key}` : undefined,
      // 🔴 v4: preview embebido de Archive.org (iframe 16:9 en el detail screen).
      previewUrl,
      source: "Open Library",
    };
  },
};

// ─── game_info ──────────────────────────────────────────────────────────────
// RAWG API (https://rawg.io/api) — clave pública gratuita, 20k req/mes.
// Sin clave funciona pero con rate-limit estricto.
const RAWG_KEY = process.env.RAWG_API_KEY || "1";
const RAWG_BASE = "https://api.rawg.io/api";

type RawgGame = {
  id?: number;
  name?: string;
  released?: string;
  background_image?: string;
  description_raw?: string;
  description?: string;
  metacritic?: number;
  rating?: number;
  rating_top?: number;
  ratings_count?: number;
  playtime?: number;
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ platform?: { name?: string } }>;
  developers?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  esrb_rating?: { name?: string };
  website?: string;
  stores?: Array<{ store?: { name?: string; url?: string } }>;
};

export const gameInfo: ToolHandler = {
  definition: defineTool(
    "game_info",
    "Información y reseña de un videojuego: rating, metacritic, géneros, plataformas, desarrollador, fecha de lanzamiento, sinopsis. Úsala cuando el usuario diga 'reseña del juego X', 'información de Y', 'cómo es Z', 'análisis de W'. Devuelve datos estructurados desde RAWG con sinopsis de Wikipedia.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Título del videojuego." },
      },
      required: ["title"],
    },
  ),
  policy: policies.readonly("Lee info de RAWG y Wikipedia."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    if (!title) return { type: "game_info", status: "failed", error: "Indicá el título del juego." };

    // 1. Buscar en RAWG
    let game: RawgGame | null = null;
    try {
      const searchRes = await fetchJson<{ results?: RawgGame[] }>(
        `${RAWG_BASE}/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=1`,
        { timeoutMs: 9_000 },
      );
      if (searchRes.ok && searchRes.data!.results?.length) {
        const id = searchRes.data!.results[0].id;
        if (id) {
          const detailRes = await fetchJson<RawgGame>(
            `${RAWG_BASE}/games/${id}?key=${RAWG_KEY}`,
            { timeoutMs: 9_000 },
          );
          if (detailRes.ok) game = detailRes.data!;
        }
      }
    } catch (err) {
      console.warn("[Koru] game_info RAWG fetch failed:", err instanceof Error ? err.message : err);
    }

    if (!game) {
      // 2. Fallback: Wikipedia search + summary (más robusto que adivinar el título exacto)
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${title} video game`)}&format=json&origin=*&srlimit=1`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
          const wikiTitle = searchData.query?.search?.[0]?.title;
          if (wikiTitle) {
            const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
            if (summaryRes.ok) {
              const summary = await summaryRes.json() as WikiSummary;
              if (summary.extract) {
                return {
                  type: "game_info",
                  status: "ok",
                  title: summary.title ?? title,
                  description: summary.extract.slice(0, 1500),
                  backgroundImage: summary.thumbnail?.source,
                  sources: [{ title: summary.title ?? title, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`, domain: "wikipedia.org", snippet: summary.extract.slice(0, 200) }],
                  source: "Wikipedia",
                };
              }
            }
          }
        }
      } catch { /* ignore */ }

      return { type: "game_info", status: "failed", error: `No encontré el juego "${title}".` };
    }

    // 3. Enriquecer con sinopsis de Wikipedia si la de RAWG es muy corta
    let description = game.description_raw ?? game.description ?? "";
    let wikiUrl: string | undefined;
    description = description.replace(/<[^>]+>/g, "");
    if (description.length < 200) {
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${title} video game`)}&format=json&origin=*&srlimit=1`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { query?: { search?: Array<{ title: string }> } };
          const wikiTitle = searchData.query?.search?.[0]?.title;
          if (wikiTitle) {
            const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, { signal: AbortSignal.timeout(9000), headers: WIKI_HEADERS });
            if (summaryRes.ok) {
              const summary = await summaryRes.json() as WikiSummary;
              if (summary.extract && summary.extract.length > description.length) {
                description = summary.extract;
                wikiUrl = summary.content_urls?.desktop?.page;
              }
            }
          }
        }
      } catch { /* ignore */ }
    }

    return {
      type: "game_info",
      status: "ok",
      title: game.name ?? title,
      released: game.released,
      backgroundImage: game.background_image,
      description: description.slice(0, 1500),
      rating: typeof game.rating === "number" ? game.rating : undefined,
      metacritic: game.metacritic,
      playtime: game.playtime,
      genres: Array.isArray(game.genres) ? game.genres.map(g => g.name).filter(Boolean) : undefined,
      platforms: Array.isArray(game.platforms) ? game.platforms.map(p => p.platform?.name).filter(Boolean) : undefined,
      developer: Array.isArray(game.developers) ? game.developers.map(d => d.name).filter(Boolean).join(", ") : undefined,
      publisher: Array.isArray(game.publishers) ? game.publishers.map(p => p.name).filter(Boolean).join(", ") : undefined,
      publishers: Array.isArray(game.publishers) ? game.publishers.map(p => p.name).filter(Boolean) : undefined,
      website: game.website,
      esrb: game.esrb_rating?.name,
      sources: [
        { title: game.name ?? title, url: `https://rawg.io/games/${game.id ?? ""}`, domain: "rawg.io", snippet: description.slice(0, 200) },
        ...(wikiUrl ? [{ title: `${title} (Wikipedia)`, url: wikiUrl, domain: "wikipedia.org", snippet: description.slice(0, 200) }] : []),
      ],
      source: "RAWG + Wikipedia",
    };
  },
};
