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
} from "./koruBackend";

export function blocksFromToolResults(results: ToolExecution[], userInput?: string): UiBlock[] {
  const blocks: UiBlock[] = [];
  // Task 15: si el usuario pidió comparar productos, generar comparison card
  // en vez de deliverable genérico
  const isComparisonQuery = userInput && (/compara/i.test(userInput) || /\b(?:vs|versus)\b/i.test(userInput));
  for (const execution of results) {
    const result = execution.result;
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
        verifiedAt: r.verifiedAt,
        freshnessLabel: r.freshnessLabel,
        sourceStatus: "verified" as const,
        sources: [],
      });
      continue;
    }
    if (result.type === "restaurant_deep_search") {
      const search = result as unknown as { query: string; matches?: Array<{ name: string; sourcesMentioning: number; quote?: string; menuHighlights?: Array<{ dish: string; price?: string }> }>; topScore?: string; pros?: string[]; cons?: string[]; synthesis?: string; sources?: AssistantSource[]; status?: string };
      blocks.push({
        type: "restaurant_synthesis" as const,
        title: search.query || "Restaurantes encontrados",
        status: search.status === "ok" ? "ok" as const : search.status === "failed" ? "failed" as const : "partial" as const,
        matches: search.matches || [],
        topScore: search.topScore,
        pros: search.pros,
        cons: search.cons,
        synthesis: search.synthesis,
        sources: search.sources || [],
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
      const r = result as any;
      const matches = r.matches || [];
      const teamName = r.team || r.query || "Equipo";
      blocks.push({
        type: "match_timeline" as const,
        title: teamName,
        items: matches.slice(0, 5).map((m: any) => {
          // Determinar el rival (el equipo que NO es el consultado)
          const homeLower = (m.homeTeam ?? "").toLowerCase();
          const teamLower = teamName.toLowerCase();
          const isHome = homeLower.includes(teamLower) || teamLower.includes(homeLower);
          const opponent = isHome ? m.awayTeam : m.homeTeam;
          const homeTeam = m.homeTeam ?? teamName;
          const awayTeam = m.awayTeam ?? opponent ?? "Rival";
          // Formatear fecha legible
          let minute = "—";
          if (m.date) {
            const d = new Date(m.date);
            if (!isNaN(d.getTime())) {
              minute = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
            }
          }
          return {
            minute,
            text: `${homeTeam} vs ${awayTeam}`,
            sub: `${m.league ?? ""}${m.time ? " · " + m.time : ""}`,
            active: true,
          };
        }),
        // 🔴 KORU 3.0 — pasar teamInfo/nextMatch/wikiExtract si están disponibles
        teamInfo: r.teamInfo,
        nextMatch: r.nextMatch,
        wikipediaExtract: r.wikipediaExtract,
      });
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
        continue; // NO generar block — sin card, sin alucinación
      }
      // El tool match_live devuelve { matches: [{homeTeam:"Spain", awayTeam:"Belgium", homeScore:2, awayScore:1, status:"Full Time", date:..., live:false}] }
      // (strings, no objetos). Soportamos también la forma legacy (r.homeTeam como objeto).
      const matches = Array.isArray(r.matches) ? r.matches : [];
      if (matches.length === 0 && (r.homeName || r.homeTeam)) {
        // Forma legacy: un solo partido en la raíz
        matches.push({
          homeTeam: typeof r.homeTeam === "string" ? r.homeTeam : r.homeTeam?.name,
          awayTeam: typeof r.awayTeam === "string" ? r.awayTeam : r.awayTeam?.name,
          homeScore: r.homeScore ?? r.homeTeam?.score,
          awayScore: r.awayScore ?? r.awayTeam?.score,
          status: r.status,
          date: r.date,
          live: r.live,
        });
      }
      // Si hay UN partido, mostramos la card hero live_match con los datos reales.
      if (matches.length >= 1) {
        const m = matches[0];
        const homeName = String(m.homeTeam ?? "Local");
        const awayName = String(m.awayTeam ?? "Visitante");
        const homeScore = Number(m.homeScore ?? 0);
        const awayScore = Number(m.awayScore ?? 0);
        const status = String(m.status ?? (m.live ? "En vivo" : "Final"));
        const homeInitials = m.homeAbbrev ?? initialsFromName(homeName);
        const awayInitials = m.awayAbbrev ?? initialsFromName(awayName);
        const dateStr = m.date ? formatMatchDate(m.date) : "";
        // 🔴 FIX TYPO: "Posesion" → "Posesión" (con s y acento)
        const homePossessionNum = Number.parseFloat(m.homePossession ?? m.detailedStats?.find(s => s.label === "Posesión")?.home?.toString() ?? "50") || 50;
        const awayPossessionNum = Number.parseFloat(m.awayPossession ?? m.detailedStats?.find(s => s.label === "Posesión")?.away?.toString() ?? "50") || 50;
        // 🔴 FIX BUG: "Tiros" era "0% - 0%" (porcentaje). Ahora es número absoluto.
        const homeShotsNum = Number(m.homeShots ?? m.detailedStats?.find(s => s.label === "Tiros")?.home ?? 0);
        const awayShotsNum = Number(m.awayShots ?? m.detailedStats?.find(s => s.label === "Tiros")?.away ?? 0);
        // Para que la barrita funcione, calculamos porcentaje relativo
        const totalShots = homeShotsNum + awayShotsNum;
        const homeShotsPct = totalShots > 0 ? Math.round((homeShotsNum / totalShots) * 100) : 50;
        const awayShotsPct = totalShots > 0 ? 100 - homeShotsPct : 50;
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
          homeTeam: { name: homeName, abbrev: homeInitials, color: m.homeColor, score: homeScore },
          awayTeam: { name: awayName, abbrev: awayInitials, color: m.awayColor, score: awayScore },
          // 🔴 FIX TYPO: "Posesion" → "Posesión"
          stats: [
            { label: "Posesión", leftPercent: homePossessionNum, rightPercent: awayPossessionNum, leftColor: m.homeColor, rightColor: m.awayColor },
            { label: "Tiros", leftPercent: homeShotsPct, rightPercent: awayShotsPct, leftColor: m.homeColor, rightColor: m.awayColor },
          ],
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
        });
        // Si hay múltiples partidos, agregamos un match_timeline con el resto.
        if (matches.length > 1) {
          blocks.push({
            type: "match_timeline" as const,
            items: matches.slice(1, 5).map((mm: any) => ({
              minute: mm.date ? new Date(mm.date).getDate() + "'" : "—",
              text: `${mm.homeTeam ?? "?"} ${mm.homeScore ?? "?"} - ${mm.awayScore ?? "?"} ${mm.awayTeam ?? "?"}`,
              sub: mm.status ?? (mm.live ? "En vivo" : "Final"),
              active: !!mm.live,
            })),
          });
        }
      }
      // 🔴 KORU 3.0 — Si no hay matches pero hay teamInfo/nextMatch/wikiExtract,
      // generar un match_timeline con esa info para que el detail screen la muestre.
      if (matches.length === 0 && (r.teamInfo || r.nextMatch || r.wikipediaExtract)) {
        blocks.push({
          type: "match_timeline" as const,
          title: r.teamInfo?.name || r.query || "Equipo",
          items: [],
          teamInfo: r.teamInfo,
          nextMatch: r.nextMatch,
          wikipediaExtract: r.wikipediaExtract,
        });
        continue;
      }
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

      // Task 15: si el usuario pidió comparar, generar comparison card con los sources
      if (isComparisonQuery && sources.length > 0) {
        const comparisonItems = sources.map((s: any) => ({
          title: s.title || s.domain,
          vendor: s.domain,
          url: s.url,
          evidence: (s.snippet ?? "").slice(0, 200),
          pros: [] as string[],
          cons: [] as string[],
        }));
        let recommendation = `Encontré ${sources.length} fuentes comparando productos. `;
        if (sources.length >= 2) {
          recommendation += `Te recomiendo revisar ${sources[0].domain} y ${sources[1].domain} para detalles específicos.`;
        }
        blocks.push({
          type: "comparison" as const,
          title: "Comparativa",
          items: comparisonItems,
          recommendation,
          sources,
        } as any);
        continue;
      }

      if (search.mode === "shopping" && search.comparisonItems?.length) {
        // Task 14: Comparison EXCEPCIONAL — generar análisis real, no solo links
        const items = search.comparisonItems;
        const sources = (search.sources ?? []).filter((s) => s.url?.startsWith("http")).slice(0, 6);

        // Extraer precios de los items si están disponibles
        const itemsWithAnalysis = items.map((item: any) => {
          const title = String(item.title ?? item.name ?? "");
          const vendor = String(item.vendor ?? item.source ?? "");
          const url = String(item.url ?? "");
          const evidence = String(item.evidence ?? item.snippet ?? "");
          // Intentar extraer precio del título o evidence
          const priceMatch = (title + " " + evidence).match(/\$[\d,.]+|USD\s*[\d,.]+|[\d,.]+\s*(?:dólares|pesos|USD)/i);
          const price = priceMatch ? priceMatch[0] : undefined;
          // Extraer specs del evidence (ej: "8GB RAM", "256GB storage")
          const specs = evidence.match(/\d+\s*(?:GB|TB|MP|mAh|GHz|GB\s*RAM|inch|pulgadas)/gi) || [];
          return {
            title: title.length > 60 ? title.slice(0, 57) + "..." : title,
            vendor,
            url,
            price,
            specs: specs.slice(0, 5),
            evidence: evidence.slice(0, 200),
            pros: [] as string[],
            cons: [] as string[],
          };
        });

        // Generar recommendation basada en datos reales
        let recommendation = "";
        const itemsWithPrices = itemsWithAnalysis.filter((i: any) => i.price);
        if (itemsWithPrices.length >= 2) {
          // Encontrar el más barato
          const cheapest = itemsWithPrices.reduce((min: any, i: any) => {
            const minVal = parseFloat(String(min.price).replace(/[^0-9.]/g, "")) || Infinity;
            const iVal = parseFloat(String(i.price).replace(/[^0-9.]/g, "")) || Infinity;
            return iVal < minVal ? i : min;
          });
          recommendation = `Basado en ${itemsWithPrices.length} opciones con precio visible, ${cheapest.vendor || cheapest.title} ofrece el mejor precio (${cheapest.price}). `;
        } else if (sources.length > 0) {
          recommendation = `Encontré ${sources.length} fuentes con información. `;
        }
        if (itemsWithAnalysis.length > 0) {
          const topItem = itemsWithAnalysis[0];
          recommendation += `Te recomiendo revisar "${topItem.title}" en ${topItem.vendor || "la fuente principal"}, que parece ser la opción más completa según las fuentes consultadas.`;
        }

        blocks.push({
          type: "comparison" as const,
          title: search.title || "Comparativa",
          items: itemsWithAnalysis,
          recommendation: recommendation || "Compará las opciones arriba. La primera parece ser la más relevante según las fuentes.",
          sources,
        } as any);
        continue;
      }

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
  return blocks;
}
