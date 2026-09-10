/**
 * MichiWeatherCard — La card de clima con el diseño EXACTO del usuario
 * (porte 1:1 de su WeatherCard.jsx + .weather-card CSS).
 *
 * 🐱 Hero con arte art-18 + pill de ubicación violeta + temperatura gigante
 * 48px + condición + rango, panel blanco orgánico con 3 métricas (Lluvia /
 * Viento / UV) y CTA violeta "Ver el radar hora por hora".
 *
 * A diferencia de su demo (datos de ejemplo), acá los datos son REALES del
 * bloque weather del agente (city / now / condition / range / rain / wind /
 * uv / hourly). El CTA abre el radar hora por hora (MichiHourlyDialog).
 */

import { MapPin, Sun, Wind, Timer, Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { UiBlock } from "../../../domain/types";
import { art } from "../../michi/v8Shared";
import { MichiHourlyDialog } from "../../michi/MichiDialogs";

type WeatherBlock = Extract<UiBlock, { type: "weather" }>;

export function MichiWeatherCard({ block }: { block: WeatherBlock }) {
  const [radarOpen, setRadarOpen] = useState(false);
  const city = block.city ?? "Tu ciudad";
  const now = block.now ?? "";
  const condition = block.condition ?? "";
  const range = block.range ?? "";
  const rain = block.rain ?? "—";
  const wind = block.wind ?? "—";
  const uv = block.uv ?? "—";

  return (
    <div className="mx-weather">
      <div className="mx-w-art" style={{ backgroundImage: `url(${art(18)})` }}>
        <span className="mx-w-loc">
          <MapPin size={17} fill="white" /> {city}
        </span>
        <div className="mx-w-temp">
          <span className="mx-w-sun" aria-hidden="true">☀️</span>
          <strong>{now}</strong>
        </div>
        <strong className="mx-w-cond">{condition}</strong>
        {range && <span className="mx-w-range">{range}</span>}
      </div>
      <div className="mx-w-bottom">
        <div className="mx-w-metrics">
          <div className="mx-metric">
            <Sun className="mx-sun-icon" />
            <span>Lluvia</span>
            <strong>{rain}</strong>
          </div>
          <div className="mx-metric">
            <Wind className="mx-wind-icon" />
            <span>Viento</span>
            <strong>{wind}</strong>
          </div>
          <div className="mx-metric">
            <Timer className="mx-uv-icon" />
            <span>UV</span>
            <strong>{uv}</strong>
          </div>
        </div>
        <button type="button" className="mx-radar-btn" onClick={() => setRadarOpen(true)}>
          <Sparkles size={17} fill="white" />
          <span>Ver el radar hora por hora</span>
          <ArrowRight size={18} />
        </button>
      </div>
      {radarOpen && (
        <MichiHourlyDialog
          city={city}
          now={now}
          condition={condition}
          hourly={block.hourly}
          onClose={() => setRadarOpen(false)}
        />
      )}
    </div>
  );
}
