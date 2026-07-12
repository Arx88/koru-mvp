import type { UiBlock } from "../domain/types";
import { KoruUnifiedCard } from "./cards/unified/KoruUnifiedCard";

// Harness temporal SOLO para verificación visual manual (Playwright) del
// sistema de cards unificado contra flujo-informe-aoe2.html. No se importa
// desde App; se monta vía ?preview=cards en main.tsx.

const informeBlock: UiBlock = {
  type: "research_sources",
  title: "Age of Empires II",
  summary:
    "Lanzado en 1999 por Ensemble Studios, AoE II es un RTS histórico ambientado en la Edad Media. La Definitive Edition (2019) lo revitalizó con nuevas civilizaciones y soporte moderno, manteniendo una comunidad competitiva muy activa.",
  mode: "research",
  sources: [
    { title: "Wikipedia — Age of Empires II", domain: "wikipedia.org", url: "https://en.wikipedia.org/wiki/Age_of_Empires_II" },
    { title: "aoe2.net — estadísticas competitivas", domain: "aoe2.net", url: "https://aoe2.net" },
    { title: "Steam — Definitive Edition", domain: "store.steampowered.com", url: "https://store.steampowered.com" },
  ],
};

const weatherBlock: UiBlock = {
  type: "weather",
  city: "Buenos Aires",
  now: "23°",
  condition: "Parcial nublado",
  advice: "Mañana fresca, tarde agradable. Sin lluvia a la vista.",
  humidity: "48%",
  wind: "14 km/h",
  range: "15° / 24°",
  uv: "Moderado",
  rain: "10%",
} as UiBlock;

const gastoBlock: UiBlock = {
  type: "money_summary",
  title: "Gasto anotado",
  total: 2000,
  currency: "ARS",
  recommendation: "cafe",
} as UiBlock;

const listaBlock: UiBlock = {
  type: "shopping_list",
  title: "Lista de compras",
  items: ["Leche", "Huevos", "Pan", "Tomates", "Queso"],
} as UiBlock;

const matchBlock: UiBlock = {
  type: "live_match",
  homeName: "Spain",
  awayName: "Belgium",
  homeScore: 2,
  awayScore: 1,
  homeInitials: "SPA",
  awayInitials: "BEL",
  globalAgg: "Full Time · 10/07",
  status: "Full Time",
  homeTeam: { name: "Spain", abbrev: "SPA", score: 2 },
  awayTeam: { name: "Belgium", abbrev: "BEL", score: 1 },
  stats: [
    { label: "Posesion", leftPercent: 58, rightPercent: 42 },
    { label: "Tiros", leftPercent: 12, rightPercent: 7 },
  ],
} as UiBlock;

const savedBlock: UiBlock = {
  type: "saved_record",
  title: "Guardado",
  records: [
    { domain: "money", kind: "expense", title: "Café", value: "2000 ARS", amount: 2000, currency: "ARS", notes: "cafe", tags: [] },
  ],
} as UiBlock;

const searchBlock: UiBlock = {
  type: "data_card",
  title: "Noticias importantes",
  items: [
    { label: "España", value: "2-1 a Bélgica", detail: "Cuartos del Mundial", quote: "España ganó 2-1", sourceDomain: "as.com", sourceUrl: "https://as.com" },
    { label: "Mundial", value: "Cuartos completos", detail: "8 equipos en carrera", quote: "Ya están los 8", sourceDomain: "marca.com", sourceUrl: "https://marca.com" },
  ],
} as UiBlock;

const planBlock: UiBlock = {
  type: "plan",
  title: "Tu día",
  items: [
    { time: "Ahora", title: "Café y revisar mails", priority: "Alta" },
    { time: "+25m", title: "Trabajar en el informe", priority: "Media" },
    { time: "+50m", title: "Almorzar", priority: "Baja" },
  ],
} as UiBlock;

export function DevCardPreview() {
  const cards: Array<{ id: string; label: string; block: UiBlock }> = [
    { id: "preview-informe", label: "Informe (research_sources)", block: informeBlock },
    { id: "preview-weather", label: "Clima (weather)", block: weatherBlock },
    { id: "preview-gasto", label: "Gasto (money_summary)", block: gastoBlock },
    { id: "preview-lista", label: "Lista (shopping_list)", block: listaBlock },
    { id: "preview-match", label: "Partido (live_match)", block: matchBlock },
    { id: "preview-saved", label: "Guardado (saved_record)", block: savedBlock },
    { id: "preview-search", label: "Búsqueda (data_card)", block: searchBlock },
    { id: "preview-plan", label: "Plan (plan)", block: planBlock },
  ];
  return (
    <div style={{ minHeight: "100dvh", background: "#2b2450", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
      {cards.map(({ id, label, block }) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <p style={{ color: "#a99cd6", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</p>
          <div id={id} style={{ width: 400 }}>
            <KoruUnifiedCard block={block} />
          </div>
        </div>
      ))}
    </div>
  );
}
