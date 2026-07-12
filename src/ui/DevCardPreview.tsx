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

// Deliverable block — el resultado de deep research (informe completo).
// Este bloque abre el KoruDetailScreen con magical-cards al hacer click en CTA.
const deliverableBlock: UiBlock = {
  type: "deliverable",
  status: "ready",
  kicker: "Tu Informe",
  topic: "Age of Empires 2",
  progress: 100,
  title: "AGE OF EMPIRES II: 25 AÑOS",
  description: "El clásico RTS que no envejece: 25 años, millones de jugadores y expansiones que llegan hasta Sudamérica.",
  summary: "Lanzado en 1999 por Ensemble Studios, AoE II es el RTS histórico más longevo. La Definitive Edition (2019) lo revivió con 4K, nuevas civs y soporte moderno. Hoy tiene más jugadores que en su estreno, torneos con premios récord y expansiones nuevas 25 años después.",
  categories: [
    { label: "Estrategia RTS", icon: "videogame_asset" },
    { label: "Edad Media", icon: "history_edu" },
    { label: "Comunidad viva", icon: "public" },
  ],
  metrics: [
    { label: "Lanzamiento", value: "1999" },
    { label: "Definitive Ed.", value: "2019" },
    { label: "Jugadores", value: "50.000+" },
  ],
  sections: [
    {
      kind: "text",
      title: "Síntesis",
      kicker: "Lo esencial en 20 segundos",
      icon: "auto_awesome",
      paragraphs: [
        "Lanzado en 1999 por Ensemble Studios y Microsoft, Age of Empires II es el RTS más longevo en actividad. La Definitive Edition (2019) lo revivió: hoy tiene más jugadores que en su estreno, torneos con premios récord y expansiones nuevas 25 años después.",
      ],
    },
    {
      kind: "timeline",
      title: "Historia",
      kicker: "De 1999 a hoy",
      icon: "castle",
      items: [
        { badge: "'99", title: "The Age of Kings", subtitle: "Ensemble Studios · 2M copias en 3 meses" },
        { badge: "'00", title: "The Conquerors", subtitle: "La expansión que definió el multijugador clásico" },
        { badge: "'13", title: "HD Edition", subtitle: "Relanzamiento en Steam con soporte moderno" },
        { badge: "'19", title: "Definitive Edition", subtitle: "4K, nuevas civs y el renacer competitivo" },
        { badge: "'24", title: "Victors and Vanquished", subtitle: "Sigue recibiendo expansiones 25 años después" },
      ],
    },
    {
      kind: "grid",
      title: "Civilizaciones",
      kicker: "45 en total · 4 estilos",
      icon: "groups",
      items: [
        { title: "Arquería", subtitle: "Britanos, Etíopes, Mayas" },
        { title: "Caballería", subtitle: "Francos, Lituanos, Persas" },
        { title: "Infantería", subtitle: "Godos, Aztecas, Japoneses" },
        { title: "Navales / eco", subtitle: "Vikingos, Italianos, Portugueses" },
      ],
    },
    {
      kind: "rows",
      title: "Cómo se juega hoy",
      kicker: "El meta competitivo 2026",
      icon: "strategy",
      items: [
        { title: "Scout Rush", subtitle: "Presión temprana en Feudal", badge: "AGRESIVO" },
        { title: "Fast Castle → Boom", subtitle: "Economía primero, ejército después", badge: "ECONÓMICO" },
        { title: "Escena pro", subtitle: "Red Bull Wololo, premios +US$100k", badge: "ESPORTS" },
      ],
    },
  ],
  sources: [
    { title: "Wikipedia — Age of Empires II", domain: "wikipedia.org", url: "https://en.wikipedia.org/wiki/Age_of_Empires_II" },
    { title: "aoe2.net — estadísticas competitivas", domain: "aoe2.net", url: "https://aoe2.net" },
    { title: "Steam — Definitive Edition", domain: "store.steampowered.com", url: "https://store.steampowered.com" },
    { title: "aoestats.io — win rates", domain: "aoestats.io", url: "https://aoestats.io" },
  ],
} as UiBlock;

export function DevCardPreview() {
  const cards: Array<{ id: string; label: string; block: UiBlock }> = [
    { id: "preview-deliverable", label: "Informe entregado (deliverable) — click CTA abre detail", block: deliverableBlock },
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
