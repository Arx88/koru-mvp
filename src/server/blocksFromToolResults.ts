/**
 * Blocks from Tool Results — extraído de koruBackend.ts (Task 11-PARTITION).
 *
 * Mapea los resultados de las tool executions a UiBlock concretos que el
 * frontend puede renderizar. Cada `if (result.type === "...")` produce un
 * UiBlock tipado; el último fallback descarta resultados sin tipo reconocido.
 *
 * Sin cambios de comportamiento respecto al original.
 */
import type {
  AssistantSource,
  UiBlock,
} from "../domain/types";
import { formatKickoffUserTz } from "../tools/sports/football";
import {
  cleanText,
  formatCompactNumber,
  formatMatchDate,
  formatRouteDistance,
  formatRouteDuration,
  initialsFromName,
  type SearchData,
  type ToolExecution,
  type WeatherData,
  type PlanData,
  type PersonalCaptureData,
  type PersonalQueryData,
  type LocalActionData,
  type DayInfoData,
} from "./koruBackend";

export function blocksFromToolResults(results: ToolExecution[], userInput?: string, tzOffsetMin?: number): UiBlock[] {
  const blocks: UiBlock[] = [];
  // 🔴 FIX DOBLE CARD — resultados de deportes (match_live + match_schedule)
  // se resuelven AL FINAL del loop, juntos, para poder mergear y evitar la
  // doble card (resultado + fixture) cuando el LLM llama las dos tools para
  // la misma pregunta ("el partido de X").
  const sports: { live: any | null; schedule: any | null } = { live: null, schedule: null };
  // 🔴 Task 15-FIX1: ELIMINADO `isComparisonQuery` regex.
  // Antes: si el input matcheaba `/compara/i` o `/\bvs\b/i`, el mapper
  // interceptaba resultados de `web_search` y generaba una comparison card
  // shallow (sin structureExtractor, con `pros: []`, `cons: []`).
  // Ahora: la tool `comparison_deep` es la ÚNICA fuente de comparison cards.
  // Si el LLM la llamó, la card ya viene enriquecida desde el tool (con
  // specs, score, details). Si el LLM NO la llamó, el mapper no debe
  // fabricar una card a partir de `web_search` results — eso generaba
  // cards sin citas respaldadas.
  for (const execution of results) {
    const result = execution.result;
    if (result.type === "day_info") {
      const day = result as DayInfoData;
      if (day.status !== "ok") continue;
      blocks.push({
        type: "day_info" as const,
        weekday: day.weekday,
        dateLabel: day.dateLabel,
        weekNumber: day.weekNumber,
        year: day.year,
        dayProgress: day.dayProgress,
        yearProgress: day.yearProgress,
        daysToWeekend: day.daysToWeekend,
        isWeekend: day.isWeekend,
        target: day.target,
      });
      continue;
    }
    if (result.type === "weather") {
      const weather = result as WeatherData;
      if (weather.status === "need_city" || !cleanText(weather.city)) continue;
      blocks.push({
        type: "weather" as const,
        title: "Clima",
        city: weather.city,
        now: weather.now,
        condition: (weather as any).condition,
        range: weather.range,
        rain: weather.rain,
        wind: weather.wind,
        humidity: (weather as any).humidity,
        feel: (weather as any).feel,
        uv: (weather as any).uv,
        advice: weather.advice,
        hourly: (weather as any).hourly,
        daily: (weather as any).daily,
        // FIX SUNSET: horas reales de salida/puesta del sol (wttr.in astronomy /
        // open-meteo daily) para el arco solar del interior de clima.
        sunrise: (weather as any).sunrise,
        sunset: (weather as any).sunset,
        sourceStatus: weather.sources.length ? "verified" as const : "failed" as const,
        sources: weather.sources,
      });
      continue;
    }
    if (result.type === "weather_forecast") {
      // Tool nueva (weather_forecast) que envuelve a `fetchWeather` (Open-Meteo).
      // Devuelve: { now, condition, conditionIcon, hourly, daily, verifiedAt, freshnessLabel, city }.
      const r = result as any;
      // Sin datos útiles no emitimos card: el composer se hace cargo en texto.
      if (r.status === "failed" || r.status === "no_data") continue;
      const city = cleanText(r.city);
      if (!cleanText(r.now) && !cleanText(r.condition)) continue;
      blocks.push({
        type: "weather" as const,
        title: "Clima",
        city,
        now: r.now,
        condition: r.condition,
        hourly: Array.isArray(r.hourly) ? r.hourly : undefined,
        daily: Array.isArray(r.daily) ? r.daily : undefined,
        sunrise: typeof r.sunrise === "string" ? r.sunrise : undefined,
        sunset: typeof r.sunset === "string" ? r.sunset : undefined,
        verifiedAt: r.verifiedAt,
        freshnessLabel: r.freshnessLabel,
        sourceStatus: "verified" as const,
        sources: [],
      });
      continue;
    }
    if (result.type === "restaurant_deep_search") {
      // Task 15-FIX2: widen the cast to expose ALL premium fields produced by the tool
      // at runtime. TS doesn't strip fields at runtime, but a narrow cast hides them
      // from downstream code and creates silent type debt. Explicitly declaring them
      // here makes the contract between tool and UiBlock visible and type-safe.
      const search = result as unknown as {
        query: string;
        matches?: Array<{
          name: string;
          sourcesMentioning: number;
          quote?: string;
          imageUrl?: string;
          rating?: number;
          // Google Places enrichment
          placeId?: string;
          lat?: number;
          lng?: number;
          address?: string;
          phone?: string;
          ratingCount?: number;
          priceLevel?: number;
          photos?: string[];
          reserveUrl?: string;
          distanceFromUser?: string;
          menuHighlights?: Array<{ dish: string; price?: string }>;
          // 🔴 Premium fields (Task 15-FIX2)
          cuisine?: string;
          typicalDishes?: string[];
          averagePrice?: string;
          reviewSummary?: string;
        }>;
        topScore?: string;
        pros?: string[];
        cons?: string[];
        synthesis?: string;
        sources?: AssistantSource[];
        status?: string;
        note?: string;
        mood?: string;
      };
      // Pass-through: el array matches ya viene completo desde el tool (con todos los
      // campos premium). Aquí lo dejamos pasar sin acotar — el renderer decidirá cuáles
      // mostrar. NO tocar presentation.ts.
      blocks.push({
        type: "restaurant_synthesis" as const,
        title: search.query || "Restaurantes encontrados",
        status: search.status === "ok" ? "ok" as const : search.status === "failed" ? "failed" as const : "partial" as const,
        matches: (search.matches ?? []) as any,
        topScore: search.topScore,
        pros: search.pros,
        cons: search.cons,
        synthesis: search.synthesis,
        sources: search.sources || [],
        note: search.note,
      });
      continue;
    }
    if (result.type === "crypto_price") {
      const r = result as any;
      // Task 14-FIX: si la tool fallo, NO mostrar "? USD". Empty state honesto.
      if (r.status === "failed" || r.price === undefined || r.price === null) {
        blocks.push({
          type: "crypto_portfolio" as const,
          title: "Cripto",
          items: [],
          message: r.error || "No pude obtener el precio. Las APIs estan saturadas.",
          sources: r.source ? [{ title: r.source, url: r.sourceUrl || "", domain: r.source }] : [],
        } as any);
        continue;
      }
      blocks.push({
        type: "crypto_portfolio" as const,
        items: [{
          symbol: r.symbol || "BTC",
          name: r.coin || "Bitcoin",
          price: `${r.price} ${r.currency || "USD"}`,
          change: r.change24hPct ?? 0,
          color: "#f59e0b",
          bg: "#fffbeb",
          char: r.symbol?.[0] || "₿",
        }],
        sources: r.source ? [{ title: r.source, url: r.sourceUrl || "", domain: r.source }] : [],
      });
      continue;
    }
    if (result.type === "stock_quote") {
      const r = result as any;
      blocks.push({
        type: "market" as const,
        title: `${r.symbol}`,
        assets: [{
          symbol: String(r.symbol ?? "STOCK"),
          name: String(r.name ?? r.symbol ?? "Accion"),
          price: r.close != null ? String(r.close) : "?",
          change: r.change24hPct != null ? `${r.change24hPct >= 0 ? "up" : "down"} ${Math.abs(r.change24hPct)}%` : "-",
          changeUp: Number(r.change24hPct ?? 0) >= 0,
        }],
      });
      continue;
    }
    if (result.type === "currency_convert") {
      const r = result as any;
      blocks.push({
        type: "forex" as const,
        items: [{
          pair: `${r.from}/${r.to}`,
          rate: String(r.rate),
          change: 0,
          flag: "US",
          positive: true,
        }],
      });
      continue;
    }
    if (result.type === "match_schedule") {
      // 🔴 FIX DOBLE CARD — guardamos el resultado y lo resolvemos DESPUÉS del
      // loop junto con match_live (merge en buildSportsBlocks). Si ya se
      // guardó otro match_schedule (raro), el último gana.
      sports.schedule = result as any;
      continue;
    }
    if (result.type === "match_live") {
      const r = result as any;
      // 🔴 FIX CRÍTICO Anti-alucinación: si match_live devuelve status "no_data",
      // NO generar block (evita card vacía o con datos inventados).
      // El reply se forzará a ser honesto en normalizeFinalPayload.
      if (r.status === "no_data" || r.status === "failed") {
        // Marcar este tool execution para que normalizeFinalPayload sepa que no hay datos
        // y fuerce un reply honesto en vez de dejar al LLM inventar.
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText = r.note || r.error || `No encontré partidos recientes para "${r.query ?? ''}". La temporada puede estar en receso.`;
        sports.live = null; // sin resultado jugado
        continue; // NO generar block — sin card, sin alucinación
      }
      sports.live = r;
      continue;
    }
    if (result.type === "route_traffic") {
      const r = result as any;
      if (r.items && r.items.length > 0) {
        blocks.push({
          type: "route_timeline" as const,
          eta: r.eta,
          items: r.items,
        });
      }
      if (r.alternatives && r.alternatives.length > 0) {
        blocks.push({
          type: "transport_compare" as const,
          items: r.alternatives,
        });
      }
      if (r.from && r.to) {
        blocks.push({
          type: "route_map" as const,
          from: r.from,
          to: r.to,
          progress: r.progress ?? 75,
          distance: r.distance,
          remaining: r.remaining,
        });
      }
      continue;
    }
    if (result.type === "search") {
      const search = result as SearchData;
      // 🔴 FIX UX SISTÉMICO: en vez de generar web_nav/research_sources (solo links),
      // generar un DELIVERABLE con contenido estructurado como muestra el demo.
      // El deliverable tiene: summary (síntesis), metrics, sections (datos + fuentes).
      // El detail screen muestra módulos ricos, no solo una lista de enlaces.
      const sources = (search.sources ?? []).filter((s) => s.url?.startsWith("http")).slice(0, 6);

      // 🔴 Task 15-FIX1: ELIMINADO el branch `isComparisonQuery && sources.length > 0`.
      // Antes este branch generaba una comparison card shallow con `pros: []`,
      // `cons: []` y recommendation genérica ("Te recomiendo revisar X y Y").
      // Eso violaba el anti-patrón premium del plan-15 §8 ("campos vacíos" y
      // "recommendation genérica"). Ahora: si el usuario pidió comparar,
      // `comparison_deep` debe ser llamada por el LLM (instrucciones en systemPrompt.ts).
      // Si por alguna razón el LLM llamó `web_search` en vez de `comparison_deep`,
      // el mapper NO debe fabricar items comparativos sin extractor — cae al
      // deliverable estándar con sources y datos extraídos por extractor simple.

      // 🔴 ITER1-FIX 3: ELIMINADO el branch legacy `search.mode === "shopping"`
      // que fabricaba items con pros: [] / cons: [] vacíos y recommendation
      // generada con regex (precios y specs extraídos del title/evidence con
      // patrones como /\$[\d,.]+|USD\s*[\d,.]+|.../ y /\d+\s*(?:GB|TB|MP|...)/).
      // Violaba las reglas R1 (no regex) y el axioma A2 (no items sin cita).
      // El happy path es: comparison_deep tool → comparison card con datos reales
      // del extractor premium. Si llegó `search.mode === "shopping"` acá, fue
      // porque el LLM no llamó comparison_deep — el deliverable estándar de abajo
      // muestra los sources sin inventar items comparativos.

      // Construir sections del deliverable
      const sections: any[] = [];

      // 1. Síntesis: usar summary si hay, sino concatenar snippets
      // 🔴 FIX: NO usar snippets crudos como síntesis. Generar una frase legible.
      // Ignorar search.summary si parece snippets pegados (contiene fragmentos de sitios)
      const rawSummary = cleanText(search.summary);
      const looksLikeSnippets = rawSummary.length > 100 && 
        (rawSummary.includes('. ') && rawSummary.split('. ').length > 4 && 
         !/[¡!]/.test(rawSummary.slice(0, 20))); // no empieza con signo de exclamación = probablemente snippets
      const synthesisText = (!looksLikeSnippets && rawSummary)
        || `Encontré ${sources.length} fuentes sobre "${cleanText(search.title) || "este tema"}". ${sources.slice(0, 2).map(s => s.title).filter(Boolean).join(" y ")}.`
        || "";

      if (synthesisText) {
        sections.push({
          icon: "auto_awesome",
          title: "Síntesis",
          kicker: "LO ESENCIAL",
          kind: "text",
          paragraphs: [synthesisText.slice(0, 800)],
        });
      }

      // 2. Datos estructurados: usar extractedData si hay
      if (search.extractedData && search.extractedData.items.length > 0) {
        sections.push({
          icon: "fact_check",
          title: "Datos verificados",
          kicker: "ENCONTRADOS",
          kind: "rows",
          items: search.extractedData.items.map((item) => ({
            title: item.label,
            subtitle: item.value,
            badge: item.sourceDomain,
          })),
        });
      }

      // 3. Fuentes: los links reales (al final, como en el demo)
      if (sources.length > 0) {
        sections.push({
          icon: "fact_check",
          title: "Fuentes",
          kicker: "DE DÓNDE SALIÓ",
          kind: "rows",
          items: sources.map(s => ({
            title: s.title,
            subtitle: s.snippet?.slice(0, 120) || s.domain,
            badge: s.domain,
          })),
        });
      }

      // Crear el deliverable
      const query = cleanText(search.title) || "Resultado";
      const metrics: any[] = [];
      metrics.push({ value: String(sources.length), label: "Fuentes" });
      if (search.extractedData?.items.length) {
        metrics.push({ value: String(search.extractedData.items.length), label: "Datos" });
      }
      metrics.push({ value: String(sections.length), label: "Secciones" });

      blocks.push({
        type: "deliverable" as const,
        status: "ready" as const,
        kicker: "Tu Búsqueda",
        topic: query,
        title: query.toUpperCase().slice(0, 40),
        description: synthesisText.slice(0, 160) || `Resultados sobre ${query}`,
        summary: synthesisText.slice(0, 500),
        categories: [
          { icon: "travel_explore", label: "Búsqueda" },
          { icon: "fact_check", label: "Fuentes" },
          { icon: "insights", label: "Datos" },
        ],
        metrics,
        sections,
        sources: sources,
      });
      continue;
    }
    if (result.type === "plan") {
      const plan = result as PlanData;
      blocks.push({
        type: "plan" as const,
        title: plan.title,
        items: plan.items,
        note: plan.context.length ? `Use contexto: ${plan.context.slice(0, 2).join(" / ")}` : undefined,
      });
      continue;
    }
    if (result.type === "personal_capture") {
      const capture = result as PersonalCaptureData;
      blocks.push(capture.block);
      continue;
    }
    if (result.type === "personal_query") {
      const query = result as PersonalQueryData;
      blocks.push(query.block);
      continue;
    }
    if (result.type === "local_action") {
      const action = result as LocalActionData;
      blocks.push(action.block);
      continue;
    }
    if (result.type === "crypto_price") {
      const crypto = result as Record<string, unknown>;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      const price = typeof crypto.price === "number" ? crypto.price : undefined;
      const currency = String(crypto.currency ?? "USD");
      if (price !== undefined) {
        items.push({ label: "Precio", value: new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price) });
      }
      if (typeof crypto.marketCap === "number") {
        items.push({ label: "Market Cap", value: formatCompactNumber(crypto.marketCap, currency) });
      }
      if (typeof crypto.change24hPct === "number") {
        const sign = crypto.change24hPct >= 0 ? "+" : "";
        items.push({ label: "24h", value: `${sign}${crypto.change24hPct}%`, detail: crypto.change24hPct >= 0 ? "▲" : "▼" });
      }
      if (typeof crypto.change7dPct === "number") {
        const sign = crypto.change7dPct >= 0 ? "+" : "";
        items.push({ label: "7d", value: `${sign}${crypto.change7dPct}%`, detail: crypto.change7dPct >= 0 ? "▲" : "▼" });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: `${String(crypto.coin ?? crypto.symbol ?? "Crypto")} · ${currency}`,
          items,
        });
      }
      continue;
    }
    if (result.type === "stock_quote") {
      const stock = result as Record<string, unknown>;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      if (typeof stock.close === "number") {
        items.push({ label: "Cierre", value: String(stock.close), detail: String(stock.symbol ?? "") });
      }
      if (typeof stock.open === "number") {
        items.push({ label: "Apertura", value: String(stock.open) });
      }
      if (typeof stock.high === "number") {
        items.push({ label: "Máx", value: String(stock.high) });
      }
      if (typeof stock.low === "number") {
        items.push({ label: "Mín", value: String(stock.low) });
      }
      if (typeof stock.volume === "number") {
        items.push({ label: "Volumen", value: formatCompactNumber(stock.volume, "USD") });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: `${String(stock.symbol ?? "Acción")} · ${String(stock.date ?? "")}`,
          items,
        });
      }
      continue;
    }
    if (result.type === "exchange_history") {
      const fx = result as Record<string, unknown>;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      if (typeof fx.lastRate === "number") {
        items.push({ label: "Último", value: String(fx.lastRate), detail: `${String(fx.from ?? "")}→${String(fx.to ?? "")}` });
      }
      if (typeof fx.firstRate === "number") {
        items.push({ label: "Inicio", value: String(fx.firstRate) });
      }
      if (typeof fx.minRate === "number") {
        items.push({ label: "Mín", value: String(fx.minRate) });
      }
      if (typeof fx.maxRate === "number") {
        items.push({ label: "Máx", value: String(fx.maxRate) });
      }
      if (typeof fx.changePct === "number") {
        const sign = fx.changePct >= 0 ? "+" : "";
        items.push({ label: "Cambio", value: `${sign}${fx.changePct}%`, detail: fx.changePct >= 0 ? "▲" : "▼" });
      }
      if (typeof fx.samples === "number") {
        items.push({ label: "Días", value: String(fx.samples) });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: `${String(fx.from ?? "")}/${String(fx.to ?? "")} · ${String(fx.startDate ?? "")} a ${String(fx.endDate ?? "")}`,
          items,
        });
      }
      continue;
    }
    if (result.type === "election_data" || result.type === "election_results") {
      const r = result as any;
      blocks.push({
        type: "election_results" as const,
        title: r.title,
        status: r.status,
        items: r.items || [],
      });
      continue;
    }
    if (result.type === "election_vote") {
      const r = result as any;
      blocks.push({
        type: "election_vote" as const,
        question: r.question,
        subtitle: r.subtitle,
        options: r.options || [],
      });
      continue;
    }
    if (result.type === "data_ticker") {
      const r = result as any;
      blocks.push({
        type: "data_ticker" as const,
        items: r.items || [],
        alert: r.alert,
      });
      continue;
    }
    if (result.type === "product_analysis") {
      const r = result as any;
      blocks.push({
        type: "product_analysis" as const,
        product: {
          name: r.title ?? r.product?.name,
          icon: r.icon ?? r.product?.icon,
          description: r.subtitle ?? r.product?.description,
        },
        specs: r.specs || [],
      });
      continue;
    }
    if (result.type === "smart_checklist") {
      const r = result as any;
      blocks.push({
        type: "smart_checklist" as const,
        title: r.title,
        progress: r.progress,
        items: r.items || [],
      });
      continue;
    }
    if (result.type === "outfit") {
      const r = result as any;
      blocks.push({
        type: "outfit" as const,
        specs: r.specs || [],
        buttonLabel: r.buttonLabel,
      });
      continue;
    }
    if (result.type === "review_score") {
      const r = result as any;
      blocks.push({
        type: "review_score" as const,
        items: r.items || [],
        buttonLabel: r.buttonLabel,
      });
      continue;
    }
    if (result.type === "review_document") {
      const r = result as any;
      blocks.push({
        type: "review_document" as const,
        title: r.title,
        body: r.body,
      });
      continue;
    }
    if (result.type === "review_quote") {
      const r = result as any;
      blocks.push({
        type: "review_quote" as const,
        sourceName: r.sourceName,
        sourceType: r.sourceType,
        quote: r.quote,
        tags: r.tags || [],
        buttonLabel: r.buttonLabel,
      });
      continue;
    }
    if (result.type === "birthday_calendar") {
      const r = result as any;
      blocks.push({
        type: "birthday_calendar" as const,
        month: r.month,
        highlightedDay: r.highlightedDay,
        startDay: r.startDay,
        daysInMonth: r.daysInMonth,
      });
      continue;
    }
    if (result.type === "birthday_alarm") {
      const r = result as any;
      blocks.push({
        type: "birthday_alarm" as const,
        name: r.name,
        date: r.date,
        countdown: r.countdown,
        unit: r.unit,
        eta: r.eta,
      });
      continue;
    }
    if (result.type === "social_interaction") {
      const r = result as any;
      blocks.push({
        type: "social_interaction" as const,
        name: r.name,
        event: r.event,
        date: r.date,
        remaining: r.remaining,
        gifts: Array.isArray(r.gifts)
          ? r.gifts.map((gift: any) => typeof gift === "string" ? { emoji: "gift", title: gift, detail: r.event ?? "" } : gift)
          : [],
      });
      continue;
    }
    if (result.type === "transport_compare") {
      const r = result as any;
      blocks.push({
        type: "transport_compare" as const,
        items: r.items || [],
      });
      continue;
    }
    if (result.type === "route_map") {
      const r = result as any;
      blocks.push({
        type: "route_map" as const,
        progress: r.progress,
        from: r.from,
        to: r.to,
        distance: r.distance,
        remaining: r.remaining,
      });
      continue;
    }

    // 🔴 FIX P1 — Casos nuevos para tools que ya existían pero se descartaban

    // movie_info: usar el nuevo tipo movie_review con todos los campos ricos
    if (result.type === "movie_info") {
      const r = result as any;
      // 🔴 FIX: si movie_info devuelve status "failed" (no encontró la película),
      // NO generar block (evita card vacía "TU PELÍCULA / PELÍCULA").
      // NO forzar honestReply aquí — el fallback a web_search se maneja en
      // runKoruBackendTurn. Si el fallback no se ejecuta, el LLM debe poder
      // decir "no la encontré" naturalmente.
      if (r.status === "failed" || r.status === "no_data") {
        // Marcar para que el LLM sepa que movie_info falló, pero NO forzar reply
        // — el fallback a web_search puede haber traído resultados.
        (result as any).__movieInfoFailed = true;
        continue; // NO generar block — sin card vacía
      }
      const title = r.title ?? "Película";
      const poster = r.poster ?? r.thumbnail;
      const rating = typeof r.rating === "number" ? r.rating : undefined;
      const overview = r.text ?? r.summary ?? r.synopsis ?? r.overview ?? "";
      blocks.push({
        type: "movie_review" as const,
        title,
        poster,
        rating,
        releaseDate: r.releaseDate,
        runtime: r.runtime,
        director: r.director,
        cast: Array.isArray(r.cast) ? r.cast : undefined,
        genres: Array.isArray(r.genres) ? r.genres : undefined,
        overview: overview.slice(0, 800),
        // 🔴 v4: presupuesto y taquilla formateados desde TMDB (ej. "$150M" / "$1.2B").
        budget: typeof r.budget === "string" ? r.budget : undefined,
        boxOffice: typeof r.boxOffice === "string" ? r.boxOffice : undefined,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
      });
      continue;
    }

    // recipe_find: usar el nuevo tipo recipe con ingredientes estructurados + video
    if (result.type === "recipe_find") {
      const r = result as any;
      const recipes = Array.isArray(r.recipes) ? r.recipes : [];
      if (recipes.length === 0) continue;
      const first = recipes[0];
      // Parsear instrucciones en pasos numerados.
      // Task 12-FIX: TheMealDB devuelve instrucciones como string con \r\n entre pasos,
      // SIN marcadores "STEP N". El parser anterior filtraba solo líneas con "STEP N",
      // dejando steps vacíos. Ahora: dividir por líneas no vacías, numerarlas, y
      // limpiar marcadores si existen.
      const instructions = String(first.instructions ?? "");
      const rawSteps = instructions
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      const steps = rawSteps.map((text: string, i: number) => ({
        step: i + 1,
        text: text.replace(/^(STEP\s*\d+|PASO\s*\d+|\d+[).])\s*/i, "").trim()
      })).filter(s => s.text.length > 0);
      blocks.push({
        type: "recipe" as const,
        name: first.name ?? "Receta",
        title: first.name ?? "Receta",
        image: first.thumbnail,
        category: first.category,
        area: first.area,
        description: instructions.slice(0, 200),
        instructions: instructions.slice(0, 1500),
        videoUrl: first.videoUrl,
        ingredients: Array.isArray(first.ingredients) ? first.ingredients : undefined,
        steps: steps.length > 0 ? steps : undefined,
        source: { title: "TheMealDB", url: "https://www.themealdb.com/", domain: "themealdb.com" },
        // 🔴 FREE: nutrición promedio del ingrediente principal (Open Food Facts).
        nutrition: first.nutrition,
      });
      // Si hay más recetas, agregar segunda card con lista
      if (recipes.length > 1) {
        blocks.push({
          type: "comparison" as const,
          title: "Otras recetas",
          items: recipes.slice(1, 5).map((rec: any) => ({
            title: rec.name ?? "Receta",
            subtitle: [rec.category, rec.area].filter(Boolean).join(" · "),
            image: rec.thumbnail,
          })),
        });
      }
      continue;
    }

    // book_info: usar el nuevo tipo book_review con cover + todos los metadatos
    if (result.type === "book_info") {
      const r = result as any;
      const title = r.title ?? "Libro";
      const cover = r.coverUrl ?? r.cover ?? r.thumbnail;
      const synopsis = r.text ?? r.summary ?? r.synopsis ?? r.description ?? "";
      blocks.push({
        type: "book_review" as const,
        title,
        cover,
        author: r.author,
        year: r.year ?? r.firstPublished,
        pages: r.pages ?? r.number_of_pages_median,
        publisher: r.publisher,
        genre: r.genre,
        rating: typeof r.rating === "number" ? r.rating : undefined,
        synopsis: synopsis.slice(0, 800),
        isbn: r.isbn,
        // 🔴 v4: preview embebido de Archive.org (Open Library OLID → iframe).
        previewUrl: typeof r.previewUrl === "string" ? r.previewUrl : undefined,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
      });
      continue;
    }

    // 🔴 FIX GAP-1: image_generate → UiBlock `generation` con images, tips,
    // model y totalTime. Si la tool falló o no devolvió imágenes, no emitimos
    // card vacía (sigue el mismo patrón defensivo que movie_info/recipe_find).
    if (result.type === "image_generate") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data") continue;
      const images = Array.isArray(r.images) ? r.images : [];
      if (images.length === 0) continue;
      blocks.push({
        type: "generation" as const,
        title: "Imágenes generadas",
        prompt: r.prompt,
        resultType: "image" as const,
        images,
        tips: Array.isArray(r.tips) ? r.tips : undefined,
        style: r.style,
        aspectRatio: r.aspectRatio,
        model: r.model,
        totalTime: r.totalTime,
      });
      continue;
    }

    // wikipedia_lookup: usar data_card con texto + source
    if (result.type === "wikipedia_lookup" || result.type === "person_info") {
      const r = result as any;
      const title = r.title ?? r.query ?? "Información";
      const text = r.text ?? r.extract ?? r.summary ?? "";
      if (!text) continue;
      const sources = Array.isArray(r.sources) ? r.sources : [];
      blocks.push({
        type: "research_sources" as const,
        title,
        summary: text.slice(0, 1200),
        sources: sources.map((s: any) => ({
          title: s.title ?? title,
          url: s.url ?? "",
          domain: s.domain ?? "wikipedia.org",
          snippet: s.snippet ?? "",
        })),
      });
      continue;
    }

    // food_info: nutrition info con imagen
    if (result.type === "food_info") {
      const r = result as any;
      const specs: Array<{ label: string; value: string }> = [];
      if (r.nutriscore) specs.push({ label: "Nutri-Score", value: String(r.nutriscore).toUpperCase() });
      if (r.calories) specs.push({ label: "Calorías", value: `${r.calories} kcal/100g` });
      if (r.fat) specs.push({ label: "Grasas", value: `${r.fat} g/100g` });
      if (r.carbs) specs.push({ label: "Carbohidratos", value: `${r.carbs} g/100g` });
      if (r.proteins) specs.push({ label: "Proteínas", value: `${r.proteins} g/100g` });
      if (r.ingredients && Array.isArray(r.ingredients)) {
        specs.push({ label: "Ingredientes", value: r.ingredients.slice(0, 5).join(", ") });
      }
      blocks.push({
        type: "product_analysis" as const,
        product: {
          name: r.productName ?? r.title ?? "Producto",
          image: r.imageUrl ?? r.thumbnail,
          description: r.summary ?? "",
        },
        specs,
      });
      continue;
    }

    // 🔴 FIX: reminder_set devuelve block directo {type: "reminder", title, dueText, note}
    if (result.type === "reminder_set") {
      const r = result as any;
      if (r.block) {
        blocks.push(r.block as UiBlock);
      } else {
        blocks.push({
          type: "saved_record" as const,
          title: "Recordatorio guardado",
          records: [{
            kind: "deadline" as const,
            domain: "capture" as const,
            title: r.title ?? "Recordatorio",
            value: r.title ?? "Recordatorio",
            dueHint: r.dueText ?? "",
            notes: r.note ?? "",
          }],
        } as UiBlock);
      }
      continue;
    }

    // 🔴 FIX: alarm_set devuelve block directo {type: "alarm", title, time, repeat, note}
    if (result.type === "alarm_set") {
      const r = result as any;
      if (r.block) {
        blocks.push(r.block as UiBlock);
      } else {
        blocks.push({
          type: "saved_record" as const,
          title: "Alarma guardada",
          records: [{
            kind: "deadline" as const,
            domain: "capture" as const,
            title: r.title ?? "Alarma",
            value: r.title ?? "Alarma",
            dueHint: r.time ?? "",
            notes: [r.repeat, r.note].filter(Boolean).join(" · "),
          }],
        } as UiBlock);
      }
      continue;
    }

    // 🔴 FIX: countdown — generar un data_card atractivo con días/horas/dirección
    if (result.type === "countdown") {
      const r = result as any;
      const items: Array<{ label: string; value: string; detail?: string }> = [];
      const days = Number(r.days ?? 0);
      const hours = Number(r.hours ?? 0);
      items.push({ label: "Días", value: String(days), detail: r.direction === "faltan" ? "faltan" : "pasaron" });
      items.push({ label: "Horas", value: String(hours) });
      if (r.targetDate) {
        const d = new Date(r.targetDate);
        if (!Number.isNaN(d.getTime())) {
          items.push({ label: "Fecha", value: d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) });
        }
      }
      blocks.push({
        type: "data_card" as const,
        title: r.label ? `Cuenta regresiva · ${r.label}` : "Cuenta regresiva",
        items,
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: game_info — usar movie_review con rating + metacritic + géneros
    if (result.type === "game_info") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data") {
        (result as any).__gameInfoFailed = true;
        continue;
      }
      blocks.push({
        type: "movie_review" as const,
        title: r.title ?? "Juego",
        poster: r.backgroundImage ?? r.image,
        rating: typeof r.rating === "number" ? r.rating : undefined,
        releaseDate: r.released,
        runtime: r.playtime ? `${r.playtime}h+` : undefined,
        director: r.developer,
        cast: Array.isArray(r.publishers) ? r.publishers : undefined,
        genres: Array.isArray(r.genres) ? r.genres : undefined,
        overview: (r.description ?? r.summary ?? "").slice(0, 800),
        sources: Array.isArray(r.sources) ? r.sources : (r.website ? [{ title: r.title, url: r.website, domain: "rawg.io" }] : undefined),
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: dictionary_define — data_card con definición
    if (result.type === "dictionary_define") {
      const r = result as any;
      const items: Array<{ label: string; value: string }> = [];
      if (r.word) items.push({ label: "Palabra", value: r.word });
      if (r.phonetic) items.push({ label: "Fonética", value: r.phonetic });
      if (Array.isArray(r.definitions) && r.definitions.length) {
        for (const d of r.definitions.slice(0, 3)) {
          items.push({ label: d.partOfSpeech ?? "Def", value: d.definition ?? "" });
        }
      } else if (r.definition) {
        items.push({ label: "Definición", value: r.definition });
      }
      if (items.length) {
        blocks.push({
          type: "data_card" as const,
          title: r.word ?? "Definición",
          items,
        } as UiBlock);
      }
      continue;
    }

    // 🔴 FIX: math_calc — data_card con resultado
    if (result.type === "math_calc") {
      const r = result as any;
      blocks.push({
        type: "data_card" as const,
        title: "Cálculo",
        items: [
          { label: "Expresión", value: r.expression ?? "" },
          { label: "Resultado", value: String(r.result ?? "?") },
        ],
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: unit_convert — data_card
    if (result.type === "unit_convert") {
      const r = result as any;
      blocks.push({
        type: "data_card" as const,
        title: "Conversión",
        items: [
          { label: "De", value: `${r.value ?? ""} ${r.from ?? ""}` },
          { label: "A", value: `${r.result ?? "?"} ${r.to ?? ""}` },
        ],
      } as UiBlock);
      continue;
    }

    // 🔴 FIX: news_topic — research_sources con noticias
    if (result.type === "news_topic" || result.type === "trending_topic") {
      const r = result as any;
      const items = Array.isArray(r.articles) ? r.articles : Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) continue;
      blocks.push({
        type: "research_sources" as const,
        title: r.topic ?? r.query ?? "Noticias",
        summary: (r.summary ?? "").slice(0, 800),
        sources: items.slice(0, 6).map((a: any) => ({
          title: a.title ?? a.headline ?? "",
          url: a.url ?? "",
          domain: a.source ?? a.domain ?? "",
          snippet: (a.summary ?? a.snippet ?? "").slice(0, 200),
        })),
      } as UiBlock);
      continue;
    }

    // 🔴 FIX GAP-2: tennis_live → UiBlock `tennis_match`.
    // El tool `tennis_live` (src/tools/sports/tennis.ts) devuelve un
    // `TennisMatchResult` con players, tournament, sets, currentSet,
    // currentPoint, stats, elapsedMs, status y sources. El UiBlock `tennis_match`
    // es 1:1 con ese shape, así que solo normalizamos y copiamos campos.
    if (result.type === "tennis_live") {
      const r = result as any;
      // Anti-alucinación: si el tool devolvió no_data/failed, no emitimos card.
      if (r.status === "no_data" || r.status === "failed") {
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText =
          r.note || r.error || `No encontré un partido de tenis para "${r.player ?? ''}".`;
        continue;
      }
      // Solo generar card si hay al menos un jugador.
      const players = r.players && typeof r.players === "object" ? r.players : undefined;
      if (!players?.home?.name && !players?.away?.name) continue;
      blocks.push({
        type: "tennis_match" as const,
        players,
        tournament: r.tournament,
        sets: Array.isArray(r.sets) ? r.sets : undefined,
        currentSet: r.currentSet,
        currentPoint: r.currentPoint,
        stats: r.stats,
        elapsedMs: r.elapsedMs,
        status: r.status,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
      } as UiBlock);
      continue;
    }

    // 🔴 FIX GAP-2: news_urgent_search → UiBlock `news_urgent`.
    // El tool `news_urgent_search` (src/tools/news/newsUrgent.ts →
    // newsUrgentSearch ToolHandler) devuelve un `UrgentNewsResult` con headline,
    // summary, severity, category, timeline, factChecks, sources, location y
    // lastUpdated. El UiBlock `news_urgent` es 1:1 con ese shape.
    if (result.type === "news_urgent_search") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data") {
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText =
          r.note || r.error || `No encontré noticias urgentes para "${r.query ?? ''}".`;
        continue;
      }
      // Solo emitir card si hay headline o summary (evita cards vacías).
      const headline = cleanText(r.headline);
      const summary = cleanText(r.summary);
      if (!headline && !summary) continue;
      // Normalizar sources al tipo AssistantSource ({title,url,domain}).
      const sources = Array.isArray(r.sources)
        ? r.sources
            .map((s: any) => ({
              title: cleanText(s.title, "Sin título"),
              url: cleanText(s.url),
              domain: cleanText(s.domain),
              snippet: s.snippet,
            }))
            .filter((s: any) => s.url)
            .slice(0, 8)
        : [];
      blocks.push({
        type: "news_urgent" as const,
        headline: headline || "Última hora",
        summary: summary.slice(0, 800),
        severity: ["breaking", "urgent", "important"].includes(cleanText(r.severity))
          ? (cleanText(r.severity) as "breaking" | "urgent" | "important")
          : undefined,
        category: cleanText(r.category) || undefined,
        timeline: Array.isArray(r.timeline)
          ? r.timeline
              .map((t: any) => ({
                time: cleanText(t.time),
                event: cleanText(t.event),
                status: ["done", "current", "pending"].includes(cleanText(t.status))
                  ? (cleanText(t.status) as "done" | "current" | "pending")
                  : "done",
              }))
              .filter((t: any) => t.event)
              .slice(0, 5)
          : undefined,
        factChecks: Array.isArray(r.factChecks)
          ? r.factChecks
              .map((f: any) => ({
                claim: cleanText(f.claim),
                verdict: cleanText(f.verdict),
                source: cleanText(f.source),
              }))
              .filter((f: any) => f.claim)
              .slice(0, 8)
          : undefined,
        sources,
        location: r.location && typeof r.location === "object"
          ? {
              lat: Number(r.location.lat ?? 0),
              lng: Number(r.location.lng ?? 0),
              label: cleanText(r.location.label, "Ubicación"),
            }
          : undefined,
        lastUpdated: cleanText(r.lastUpdated),
      } as UiBlock);
      continue;
    }

    // 🔴 FIX GAP-2: route_plan_search → UiBlock `route_map` (enriquecido).
    // El tool `route_planner` (src/tools/travel/travelPlanner.ts → routePlanner
    // ToolHandler) envuelve `fetchRoute` (Google Maps Directions API) y devuelve
    // un `RouteResult` con steps, alternatives, trafficLevel y fuelEstimate.
    // Mapeamos al UiBlock `route_map` extendido (campos steps, alternatives,
    // trafficLevel, fuelEstimate definidos en types.ts).
    if (result.type === "route_plan_search") {
      const r = result as any;
      if (r.status === "failed" || r.status === "no_data" || r.status === "not_configured") {
        (result as any).__forceHonestReply = true;
        (result as any).__honestReplyText =
          r.note || r.error || `No pude calcular la ruta de "${r.origin ?? ''}" a "${r.destination ?? ''}".`;
        continue;
      }
      const steps = Array.isArray(r.steps)
        ? r.steps
            .map((s: any) => ({
              instruction: cleanText(s.instruction),
              distanceMeters: Number(s.distanceMeters ?? 0),
              maneuver: cleanText(s.maneuver, "straight"),
            }))
            .filter((s: any) => s.instruction)
            .slice(0, 12)
        : [];
      const alternatives = Array.isArray(r.alternatives)
        ? r.alternatives
            .map((alt: any) => ({
              mode: cleanText(r.mode, "driving"),
              time: formatRouteDuration(alt.durationSec),
              traffic: cleanText(alt.trafficLevel, "light"),
            }))
            .slice(0, 3)
        : [];
      blocks.push({
        type: "route_map" as const,
        from: cleanText(r.origin),
        to: cleanText(r.destination),
        distance: formatRouteDistance(r.distanceMeters),
        remaining: formatRouteDuration(r.durationSec),
        steps: steps.length ? steps : undefined,
        alternatives: alternatives.length ? alternatives : undefined,
        trafficLevel: cleanText(r.trafficLevel, "light"),
        fuelEstimate:
          typeof r.fuelEstimateLiters === "number" && r.fuelEstimateLiters > 0
            ? `${r.fuelEstimateLiters} L`
            : undefined,
      } as UiBlock);
      continue;
    }
  }
  // 🔴 FIX DOBLE CARD — resolver deportes con merge (una sola historia por
  // equipo: resultado con próximos adentro, o fixture enriquecido).
  buildSportsBlocks(sports, blocks, tzOffsetMin, userInput);
  return blocks;
}

/* ============================================================================
 * 🔴 FIX DEPORTES (doble card + placeholders + stats fabricadas)
 *
 * Reglas de merge entre match_live y match_schedule:
 * 1. match_live encontró partido JUGADO/EN VIVO → card resultado (live_match).
 *    Los próximos del match_schedule se pegan como `upcoming` (sección
 *    "Próximos partidos" del interior). NO se emite fixture aparte.
 * 2. match_live encontró partido PROGRAMADO (fallback de futuro) o es el
 *    fallback de info de equipo → card de FIXTURE única (match_timeline) con
 *    items + nextMatch + teamInfo + wiki.
 * 3. Sin datos de ningún lado → CERO cards (antes: card vacía
 *    "PARTIDO Local 0-0 Visitante FINAL").
 * 4. `stats` del live_match SOLO con datos reales (antes: Posesión/Tiros
 *    50%-50% fabricados para cualquier partido).
 * ==========================================================================*/

/** ¿El partido todavía no arrancó? (ESPN: state "pre" / status "Scheduled") */
function isScheduledMatch(m: any): boolean {
  if (!m) return false;
  if (m.state === "pre") return true;
  return /scheduled|not started|pre|pr[óo]xim|upcoming|por jugar/i.test(String(m.status ?? ""));
}

/** "2026-09-12T00:30Z" → "02:30" con tz Madrid (antes: hora del server/UTC) */
function kickoffTimeFrom(date?: string, tzOffsetMin?: number): string | undefined {
  if (!date) return undefined;
  // 🔴 FIX TZ — delega en el helper de football.ts: hora local del usuario
  // (antes: hora del server = UTC en producción → "00:30" para 21:30 AR).
  return formatKickoffUserTz(date, tzOffsetMin);
}

/** "2026-09-12T00:30Z" → "sáb 12/09" */
function shortDateFrom(date?: string, tzOffsetMin?: number): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  // 🔴 FIX TZ — día de semana + fecha en la tz del usuario (getTimezoneOffset:
  // Madrid UTC+2 → -120). Sin tz: comportamiento legacy (hora del server).
  const hasTz = typeof tzOffsetMin === "number" && Number.isFinite(tzOffsetMin);
  const target = hasTz ? new Date(d.getTime() - tzOffsetMin * 60_000) : d;
  const fmt = new Intl.DateTimeFormat("es-AR", {
    ...(hasTz ? { timeZone: "UTC" as const } : {}),
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(target);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")}/${get("month")}`;
}

function buildSportsBlocks(sports: { live: any | null; schedule: any | null }, blocks: UiBlock[], tzOffsetMin?: number, userInput?: string): void {
  const live = sports.live;
  const schedule = sports.schedule;
  if (!live && !schedule) return;

  // ── Normalizar los matches de match_live (incluye forma legacy) ──────────
  const liveMatches: any[] = Array.isArray(live?.matches) ? [...live.matches] : [];
  if (liveMatches.length === 0 && (live?.homeName || live?.homeTeam)) {
    liveMatches.push({
      homeTeam: typeof live.homeTeam === "string" ? live.homeTeam : live.homeTeam?.name,
      awayTeam: typeof live.awayTeam === "string" ? live.awayTeam : live.awayTeam?.name,
      homeScore: live.homeScore ?? live.homeTeam?.score,
      awayScore: live.awayScore ?? live.awayTeam?.score,
      status: live.status,
      date: live.date,
      live: live.live,
    });
  }
  // Fallback de info de equipo: match_live devolvió teamInfo + nextMatch sin
  // partidos jugados ("No hay partidos recientes") → va como fixture/info.
  const liveIsInfoFallback = !!(live?.teamInfo && /no hay partidos recientes/i.test(String(live?.note ?? "")));

  const schedMatches: any[] = Array.isArray(schedule?.matches) ? schedule.matches : [];

  // 🔴 FIX INTENCIÓN — "cuando juega X" con AMBOS tools: el usuario pregunta
  // por el PRÓXIMO partido → card de fixture (aunque match_live haya
  // encontrado el último resultado, que va como contexto, no como card).
  const fixtureIntent = /\b(cu[aá]ndo\s+juega|cu[aá]ndo\s+juegan|qu[eé]\s+hora|a\s+qu[eé]\s+hora|pr[oó]xim[oa]?\s+partidos?|fixture|pr[oó]ximo\s+partido|cu[aá]ndo\s+es\s+el\s+partido|agenda|calendario)\b/i.test(userInput ?? "");
  if (fixtureIntent && schedMatches.length > 0) {
    const mergedFi: any = { ...schedule };
    if (!mergedFi.teamInfo && live?.teamInfo) mergedFi.teamInfo = live.teamInfo;
    if (!mergedFi.wikipediaExtract && live?.wikipediaExtract) mergedFi.wikipediaExtract = live.wikipediaExtract;
    pushFixtureCard(mergedFi, blocks, tzOffsetMin);
    return;
  }

  // ── ¿Los dos resultados hablan del mismo equipo? ─────────────────────────
  const teamsOf = (m: any) => [String(m?.homeTeam ?? ""), String(m?.awayTeam ?? "")].map(t => t.toLowerCase());
  const sameTeamUniverse =
    liveMatches.length > 0 && schedMatches.length > 0 &&
    liveMatches.some(m1 => schedMatches.some(m2 =>
      teamsOf(m1).some(t1 => t1 && teamsOf(m2).some(t2 => t2 && (t1.includes(t2) || t2.includes(t1))))
    ));

  // ── CASO 1: partido jugado/en vivo → card resultado ─────────────────────
  const firstLive = liveMatches[0];
  if (liveMatches.length > 0 && !liveIsInfoFallback && !isScheduledMatch(firstLive)) {
    const m = firstLive;
    const homeName = String(m.homeTeam ?? "Local");
    const awayName = String(m.awayTeam ?? "Visitante");
    const homeScore = Number(m.homeScore ?? 0);
    const awayScore = Number(m.awayScore ?? 0);
    const status = String(m.status ?? (m.live ? "En vivo" : "Final"));
    const homeInitials = m.homeAbbrev ?? initialsFromName(homeName);
    const awayInitials = m.awayAbbrev ?? initialsFromName(awayName);
    const dateStr = m.date ? formatMatchDate(m.date) : "";

    // 🔴 FIX STATS FABRICADAS — solo stats reales del /summary. Antes se
    // inventaban "Posesión 50%-50%" y "Tiros 50%-50%" para cualquier partido.
    const realStats: Array<{ label: string; leftPercent: number; rightPercent: number; leftColor?: string; rightColor?: string; home?: number; away?: number }> = [];
    const possession = m.detailedStats?.find((s: any) => s.label === "Posesión");
    if (possession) {
      realStats.push({
        label: "Posesión",
        leftPercent: Math.round(Number(possession.home ?? 50)),
        rightPercent: Math.round(Number(possession.away ?? 50)),
        leftColor: m.homeColor, rightColor: m.awayColor,
        home: Number(possession.home ?? 50), away: Number(possession.away ?? 50),
      });
    } else if (m.homePossession != null && m.awayPossession != null) {
      realStats.push({
        label: "Posesión",
        leftPercent: Math.round(Number(m.homePossession)), rightPercent: Math.round(Number(m.awayPossession)),
        leftColor: m.homeColor, rightColor: m.awayColor,
        home: Number(m.homePossession), away: Number(m.awayPossession),
      });
    }
    const shots = m.detailedStats?.find((s: any) => s.label === "Tiros");
    const homeShotsNum = Number(shots?.home ?? m.homeShots ?? NaN);
    const awayShotsNum = Number(shots?.away ?? m.awayShots ?? NaN);
    if (Number.isFinite(homeShotsNum) && Number.isFinite(awayShotsNum)) {
      const total = homeShotsNum + awayShotsNum;
      realStats.push({
        label: "Tiros",
        leftPercent: total > 0 ? Math.round((homeShotsNum / total) * 100) : 50,
        rightPercent: total > 0 ? 100 - Math.round((homeShotsNum / total) * 100) : 50,
        leftColor: m.homeColor, rightColor: m.awayColor,
        home: homeShotsNum, away: awayShotsNum,
      });
    }

    // 🔴 FIX DOBLE CARD — próximos del schedule como `upcoming` del resultado
    // (sección "Próximos partidos" del interior), sin card de fixture aparte.
    // 🔴 FIX VENTANA: si match_live ya trae sus propios upcoming (rango de
    // fechas ESPN), se usan como base y el schedule solo los completa.
    const liveUpcoming = Array.isArray(live?.upcoming) ? live.upcoming : [];
    const upcomingSource = sameTeamUniverse
      ? schedMatches.slice(0, 4).map((um: any) => ({
          homeTeam: um.homeTeam,
          awayTeam: um.awayTeam,
          date: um.date,
          time: um.time ?? kickoffTimeFrom(um.date, tzOffsetMin),
          league: um.league,
          homeLogo: um.homeLogo,
          awayLogo: um.awayLogo,
          homeAbbrev: um.homeAbbrev,
          awayAbbrev: um.awayAbbrev,
        })).filter((um: any) => um.homeTeam || um.awayTeam)
      : liveUpcoming.map((um: any) => ({
          homeTeam: um.homeTeam,
          awayTeam: um.awayTeam,
          date: um.date,
          time: um.time ?? kickoffTimeFrom(um.date, tzOffsetMin),
          league: um.league,
          homeLogo: um.homeLogo,
          awayLogo: um.awayLogo,
          homeAbbrev: um.homeAbbrev,
          awayAbbrev: um.awayAbbrev,
        })).filter((um: any) => um.homeTeam || um.awayTeam);
    const upcoming = upcomingSource.length > 0 ? upcomingSource.slice(0, 4) : undefined;

    blocks.push({
      type: "live_match" as const,
      homeName,
      awayName,
      homeScore,
      awayScore,
      homeInitials,
      awayInitials,
      minute: m.minute ?? m.time,
      globalAgg: status + (dateStr ? ` · ${dateStr}` : ""),
      homePossession: m.homePossession,
      awayPossession: m.awayPossession,
      homeShots: m.homeShots,
      awayShots: m.awayShots,
      time: m.minute ?? m.time,
      status,
      state: m.state ?? (isScheduledMatch(m) ? "pre" : m.live ? "in" : "post"),
      homeTeam: { name: homeName, abbrev: homeInitials, color: m.homeColor, score: homeScore },
      awayTeam: { name: awayName, abbrev: awayInitials, color: m.awayColor, score: awayScore },
      stats: realStats.length > 0 ? realStats : undefined,
      // 🔴 v2: datos ricos del /summary
      homeColor: m.homeColor,
      awayColor: m.awayColor,
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      homeAbbrev: m.homeAbbrev,
      awayAbbrev: m.awayAbbrev,
      league: m.league,
      venue: m.venue,
      venueCity: m.venueCity,
      attendance: m.attendance,
      goals: m.goals,
      yellowCards: m.yellowCards,
      redCards: m.redCards,
      substitutions: m.substitutions,
      lineups: m.lineups,
      detailedStats: m.detailedStats,
      upcoming,
      // 🔴 FIX INTERIOR VACÍO — contexto del equipo + Wikipedia para la
      // sección "Sobre el equipo" (match_live ahora trae fetchTeamContext).
      teamInfo: live?.teamInfo,
      wikipediaExtract: live?.wikipediaExtract,
    } as UiBlock);

    // Otros resultados del mismo query (rondas de varios días) → mini timeline
    if (liveMatches.length > 1) {
      blocks.push({
        type: "match_timeline" as const,
        title: `${homeName} · otros resultados`,
        items: liveMatches.slice(1, 5).map((mm: any) => ({
          minute: mm.date ? shortDateFrom(mm.date, tzOffsetMin) : "—",
          text: `${mm.homeTeam ?? "?"} ${mm.homeScore ?? "?"}-${mm.awayScore ?? "?"} ${mm.awayTeam ?? "?"}`,
          sub: mm.status ?? (mm.live ? "En vivo" : "Final"),
          active: !!mm.live,
          homeLogo: mm.homeLogo,
          awayLogo: mm.awayLogo,
          homeTeam: mm.homeTeam,
          awayTeam: mm.awayTeam,
        })),
      } as UiBlock);
    }
    // El schedule era de OTRO equipo (raro pero posible) → fixture aparte
    if (schedMatches.length > 0 && !sameTeamUniverse) {
      pushFixtureCard(schedule, blocks, tzOffsetMin);
    }
    return;
  }

  // ── CASO 2: sin partido jugado → UNA card de fixture/info enriquecida ────
  // Fuentes posibles de items: match_schedule (normal) o el partido programado
  // que match_live encontró en su fallback de futuro.
  const scheduledFromLive = liveMatches.find(m => isScheduledMatch(m));
  const infoFromLive = live?.teamInfo || live?.nextMatch || live?.wikipediaExtract;

  if (schedMatches.length > 0) {
    // Fixture del schedule + contexto (teamInfo/wiki) del schedule o del
    // fallback de match_live (el que tenga data gana).
    const merged: any = { ...schedule };
    if (!merged.teamInfo && live?.teamInfo) merged.teamInfo = live.teamInfo;
    if (!merged.wikipediaExtract && live?.wikipediaExtract) merged.wikipediaExtract = live.wikipediaExtract;
    pushFixtureCard(merged, blocks, tzOffsetMin);
    return;
  }

  if (scheduledFromLive) {
    // match_live encontró el próximo partido → fixture card con ese match
    pushFixtureCard(
      {
        team: live?.teamInfo?.name ?? live?.query ?? `${scheduledFromLive.homeTeam ?? ""} ${scheduledFromLive.awayTeam ?? ""}`.trim(),
        matches: [scheduledFromLive],
        teamInfo: live?.teamInfo,
        wikipediaExtract: live?.wikipediaExtract,
        nextMatch: {
          homeTeam: scheduledFromLive.homeTeam,
          awayTeam: scheduledFromLive.awayTeam,
          date: scheduledFromLive.date,
          time: scheduledFromLive.time ?? kickoffTimeFrom(scheduledFromLive.date, tzOffsetMin),
          league: scheduledFromLive.league,
          homeLogo: scheduledFromLive.homeLogo,
          awayLogo: scheduledFromLive.awayLogo,
          homeAbbrev: scheduledFromLive.homeAbbrev,
          awayAbbrev: scheduledFromLive.awayAbbrev,
          homeColor: scheduledFromLive.homeColor,
          awayColor: scheduledFromLive.awayColor,
        },
      },
      blocks,
      tzOffsetMin,
    );
    return;
  }

  if (infoFromLive) {
    // Fallback puro de info de equipo (sin fixture): card de equipo
    blocks.push({
      type: "match_timeline" as const,
      title: live.teamInfo?.name || live.query || "Equipo",
      items: [],
      teamInfo: live.teamInfo,
      nextMatch: live.nextMatch,
      wikipediaExtract: live.wikipediaExtract,
    } as UiBlock);
    return;
  }

  // ── CASO 3: sin ningún dato → cero cards ─────────────────────────────────
}

/** Card de fixture enriquecida: items + nextMatch (para el interior Mtl) +
 *  teamInfo + wiki. Título = nombre real del equipo, no el query crudo. */
function pushFixtureCard(schedule: any, blocks: UiBlock[], tzOffsetMin?: number): void {
  const matches: any[] = Array.isArray(schedule?.matches) ? schedule.matches : [];
  const teamInfo = schedule?.teamInfo;
  const wiki = schedule?.wikipediaExtract;
  const teamName = String(teamInfo?.name ?? schedule?.team ?? schedule?.query ?? "").trim();

  // 🔴 FIX: sin items, sin nextMatch, sin teamInfo y sin wiki → NO emitir card
  // (antes: card vacía "PARTIDO Local 0-0 Visitante FINAL").
  if (matches.length === 0 && !schedule?.nextMatch && !teamInfo && !wiki) return;

  const first = matches[0];
  const nextMatch =
    schedule?.nextMatch ??
    (first
      ? {
          homeTeam: first.homeTeam,
          awayTeam: first.awayTeam,
          date: first.date,
          time: first.time ?? kickoffTimeFrom(first.date, tzOffsetMin),
          league: first.league,
          // 🔴 FIX ESCUDOS — logos/abreviaturas/colores reales de ESPN
          homeLogo: first.homeLogo,
          awayLogo: first.awayLogo,
          homeAbbrev: first.homeAbbrev,
          awayAbbrev: first.awayAbbrev,
          homeColor: first.homeColor,
          awayColor: first.awayColor,
        }
      : undefined);

  blocks.push({
    type: "match_timeline" as const,
    title: teamName || (nextMatch ? `${nextMatch.homeTeam ?? ""} vs ${nextMatch.awayTeam ?? ""}` : "Próximo partido"),
    items: matches.slice(0, 5).map((m: any) => ({
      minute: shortDateFrom(m.date, tzOffsetMin),
      text: `${m.homeTeam ?? "?"} vs ${m.awayTeam ?? "?"}`,
      sub: `${m.league ?? ""}${m.time ?? kickoffTimeFrom(m.date, tzOffsetMin) ? ` · ${m.time ?? kickoffTimeFrom(m.date, tzOffsetMin)}` : ""}`,
      active: true,
      // 🔴 FIX ESCUDOS — logos por partido para la lista de próximos
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
    })),
    teamInfo,
    nextMatch,
    wikipediaExtract: wiki,
  } as UiBlock);
}

