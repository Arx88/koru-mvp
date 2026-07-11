import type { AssistantActionPayload, AssistantSource } from "./types";

type WebMode = NonNullable<AssistantActionPayload["webMode"]>;

export type WebNavigationResult = {
  status: NonNullable<AssistantActionPayload["externalStatus"]>;
  verifiedAt?: string;
  sources: AssistantSource[];
  comparisonItems?: NonNullable<AssistantActionPayload["comparisonItems"]>;
  summaryItems?: NonNullable<AssistantActionPayload["summaryItems"]>;
  recommendation: string;
};

function modeForPayload(payload: AssistantActionPayload): WebMode {
  if (payload.webMode) return payload.webMode;
  const text = `${payload.title ?? ""} ${payload.body ?? ""} ${payload.researchCriteria?.join(" ") ?? ""}`.toLowerCase();
  if (/clima|temperatura|lluvia|ropa|ponerme/.test(text)) return "weather";
  if (/trafico|ruta|llegar|desde|hasta/.test(text)) return "traffic";
  if (/mercado|acciones|bitcoin|btc|eth|portfolio|portafolio/.test(text)) return "market";
  if (/noticia|radar|publicacion|actualidad/.test(text)) return "news";
  if (/precio|entrega|vendedor|devoluciones|comparativa|comprar/.test(text)) return "shopping";
  return "research";
}

function uniqueSources(sources: AssistantSource[]): AssistantSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export async function runWebNavigation(payload: AssistantActionPayload): Promise<WebNavigationResult> {
  const queries = payload.searchQueries?.filter((query) => query.trim().length > 0) ?? [];
  const mode = modeForPayload(payload);
  if (!queries.length) {
    return {
      status: "failed",
      sources: [],
      recommendation: "No tengo una consulta concreta para navegar. Necesito tema, producto o pregunta.",
    };
  }

  const response = await fetch("/koru-web/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queries,
      criteria: payload.researchCriteria ?? [],
      mode,
      title: payload.title,
      body: payload.body,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<WebNavigationResult> & { error?: string };
  const sources = uniqueSources(data.sources ?? []);
  const status = data.status ?? (response.ok && sources.length ? "verified" : "failed");

  if (!response.ok && status !== "not_configured") {
    return {
      status: "failed",
      sources,
      recommendation: data.recommendation ?? data.error ?? "No pude consultar la web en este intento.",
    };
  }

  return {
    status,
    verifiedAt: data.verifiedAt,
    sources,
    comparisonItems: data.comparisonItems,
    summaryItems: data.summaryItems ?? (
      mode === "weather" && sources[0]
        ? [
            { label: "Ahora", value: sources[0].snippet?.split("·")[0]?.trim() || sources[0].title, detail: sources[0].title },
            ...(sources[0].snippet?.split("·").slice(1, 3).map((part, index) => ({
              label: index === 0 ? "Hoy" : "Lluvia/viento",
              value: part.trim(),
            })) ?? []),
          ]
        : undefined
    ),
    recommendation:
      data.recommendation ??
      (sources.length
        ? "Abrí fuentes reales y dejé evidencia para revisar antes de decidir."
        : "No hay conector de búsqueda configurado; dejé la consulta lista sin fingir resultados."),
  };
}

export function webResultToPayload(result: WebNavigationResult): Partial<AssistantActionPayload> {
  return {
    externalStatus: result.status,
    verifiedAt: result.verifiedAt,
    sources: result.sources,
    comparisonItems: result.comparisonItems,
    summaryItems: result.summaryItems,
    recommendation: result.recommendation,
    steps:
      result.status === "verified" || result.status === "partial"
        ? ["Abrí conector web", "Filtré fuentes con evidencia", "Dejé resultados trazables"]
        : ["Intenté abrir conector web", "No inventé fuentes", "Dejé el siguiente paso claro"],
  };
}
