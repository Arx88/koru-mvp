/**
 * Bloque Apps/Juegos — Recomendaciones y ofertas.
 * APIs: CheapShark (ofertas juegos, sin key), scraping Play Store/App Store/Steam.
 */

import { defineTool, policies, type ToolHandler } from "../types";
import { fetchJson } from "../shared/fetcher";
import { cached, ttls } from "../shared/cache";
import { searchAndEnrich, usableSources } from "../shared/scrapers";

// ─── app_recommend ──────────────────────────────────────────────────────────
export const appRecommend: ToolHandler = {
  definition: defineTool(
    "app_recommend",
    "Recomienda apps móviles o de PC según la necesidad del usuario, con rating y por qué. Úsala cuando el usuario diga 'app para tomar notas en Android', 'mejor lector de RSS en iOS', 'app de meditación gratuita', 'editor de video gratis en PC'. Lee reseñas de varias fuentes.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Necesidad o categoría (ej: 'tomar notas', 'meditar')." },
        platform: { type: "string", enum: ["android", "ios", "pc", "any"], default: "any" },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee reseñas de apps."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const platform = String(args.platform ?? "any");
    if (!query) return { type: "app_recommend", status: "failed", error: "Indicá la necesidad." };
    const sources = usableSources(await searchAndEnrich(`mejor app ${query} ${platform === "any" ? "" : platform} recomendación reseña rating gratis`, 5));
    return {
      type: "app_recommend",
      status: "ok",
      query,
      platform,
      sources,
      note: sources.length ? "Apps sugeridas con fuentes cruzadas. Revisa ratings actuales en la tienda." : "No encontré recomendaciones útiles.",
    };
  },
};

// ─── game_recommend ─────────────────────────────────────────────────────────
export const gameRecommend: ToolHandler = {
  definition: defineTool(
    "game_recommend",
    "Recomienda juegos según gusto/plataforma con rating y reseñas. Úsala cuando el usuario diga 'juegos parecidos a Stardew Valley', 'indies buenos en Steam', 'juego de Switch para jugar con amigos', 'RPG para PC'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Género, referencia o preferencia." },
        platform: { type: "string", enum: ["pc", "playstation", "xbox", "switch", "mobile", "any"], default: "any" },
      },
      required: ["query"],
    },
  ),
  policy: policies.readonly("Lee reseñas de juegos."),
  async run(args) {
    const query = String(args.query ?? "").trim();
    const platform = String(args.platform ?? "any");
    if (!query) return { type: "game_recommend", status: "failed", error: "Indicá la preferencia." };
    const sources = usableSources(await searchAndEnrich(`juegos recomendados ${query} ${platform === "any" ? "" : platform} reseñas rating`, 5));
    return {
      type: "game_recommend",
      status: "ok",
      query,
      platform,
      sources,
      note: sources.length ? "Sugerencias con fuentes cruzadas." : "No encontré recomendaciones.",
    };
  },
};

// ─── game_deals ─────────────────────────────────────────────────────────────
type CheapSharkDeal = {
  title: string;
  salePrice?: string;
  normalPrice?: string;
  savings?: string;
  dealRating?: string;
  dealID?: string;
  gameID?: string;
  steamAppID?: string;
  storeID?: string;
  thumb?: string;
};

export const gameDeals: ToolHandler = {
  definition: defineTool(
    "game_deals",
    "Ofertas y descuentos actuales en juegos de Steam, GOG, Epic y otras tiendas. Úsala cuando el usuario diga 'ofertas de Steam hoy', 'algo barato y bueno en GOG', 'descuentos en juegos', 'promos Epic'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Título opcional específico a buscar." },
        minRating: { type: "number", description: "Rating mínimo (0-10). Default 7." },
        maxPrice: { type: "number", description: "Precio máximo en USD. Default sin límite." },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee ofertas de CheapShark."),
  async run(args) {
    const title = String(args.title ?? "").trim();
    const minRating = Number(args.minRating ?? 7);
    const maxPrice = args.maxPrice != null ? Number(args.maxPrice) : undefined;

    const cacheKey = `deals:${title.toLowerCase()}:${minRating}:${maxPrice ?? "any"}`;
    const deals = await cached<CheapSharkDeal[]>(cacheKey, ttls.trending, async () => {
      const params = new URLSearchParams();
      params.set("sortBy", "Deal Rating");
      params.set("pageSize", "15");
      if (title) params.set("title", title);
      if (minRating) params.set("AAA", "1");
      const r = await fetchJson<CheapSharkDeal[]>(
        `https://www.cheapshark.com/api/1.0/deals?${params.toString()}`,
        { timeoutMs: 10_000 },
      );
      if (!r.ok) throw new Error(r.error);
      return r.data ?? [];
    });

    const filtered = deals
      .filter((d) => Number(d.dealRating ?? 0) >= minRating)
      .filter((d) => maxPrice === undefined || Number(d.salePrice ?? 999) <= maxPrice)
      .slice(0, 10)
      .map((d) => ({
        title: d.title,
        salePrice: d.salePrice ? `${d.salePrice} USD` : undefined,
        normalPrice: d.normalPrice ? `${d.normalPrice} USD` : undefined,
        savingsPct: d.savings ? `${Number(d.savings).toFixed(0)}%` : undefined,
        dealRating: d.dealRating,
        dealUrl: d.dealID ? `https://www.cheapshark.com/redirect?dealID=${d.dealID}` : undefined,
        thumb: d.thumb,
      }));

    return {
      type: "game_deals",
      status: "ok",
      title: title || "destacadas",
      deals: filtered,
      source: "CheapShark",
      sourceUrl: "https://www.cheapshark.com/",
    };
  },
};

// ─── app_deals ──────────────────────────────────────────────────────────────
export const appDeals: ToolHandler = {
  definition: defineTool(
    "app_deals",
    "Apps de pago gratis por tiempo limitado u ofertas en apps. Úsala cuando el usuario diga 'apps gratis hoy', 'promociones en Play Store', 'ofertas en apps de iOS'.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        platform: { type: "string", enum: ["android", "ios", "any"], default: "any" },
      },
      required: [],
    },
  ),
  policy: policies.readonly("Lee promos de apps."),
  async run(args) {
    const platform = String(args.platform ?? "any");
    const sources = usableSources(await searchAndEnrich(`apps gratis oferta ${platform} hoy temporalmente gratis promoción`, 5));
    return {
      type: "app_deals",
      status: "ok",
      platform,
      sources,
      note: "Ofertas pueden caducar rápido. Revisa la tienda antes de instalar.",
    };
  },
};
