import type { UiBlock } from "../domain/types";
import { KoruUnifiedCard } from "./cards/unified/KoruUnifiedCard";

// Harness temporal SOLO para verificación visual manual (Playwright) del
// sistema de cards unificado contra flujo-informe-aoe2.html. No se importa
// desde App; se monta vía ?preview=cards en main.tsx. Borrar junto con ese
// hook una vez verificado.

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
};

export function DevCardPreview() {
  return (
    <div style={{ minHeight: "100dvh", background: "#2b2450", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
      <div id="preview-informe" style={{ width: 400 }}>
        <KoruUnifiedCard block={informeBlock} />
      </div>
      <div id="preview-weather" style={{ width: 400 }}>
        <KoruUnifiedCard block={weatherBlock} />
      </div>
    </div>
  );
}
