import { useEffect, useRef, useState } from "react";
import { Droplet, Wind, Sun, X, MapPin, Sparkles, Lightbulb, CheckCircle2, Heart, Cloud } from "lucide-react";
import { fetchWeather, type WeatherResult } from "../tools/weather/weatherTool";
import "./michi/michi-morning.css";

export type MorningBrief = {
  greeting: string;
  weather?: string;
  tasks?: string[];
  memoryHighlight?: string;
  suggestion?: string;
};

const WEATHER_ART: Record<string, string> = {
  wb_sunny: "sun", sunny: "sun", clear_day: "sun", partly_cloudy_day: "partly_cloudy",
  partly_cloudy: "partly_cloudy", cloud: "cloud", cloudy: "cloud", foggy: "cloud",
  rainy: "thunderstorm", water_drop: "thunderstorm", thunderstorm: "electric_storm",
  ac_unit: "hail", snowy: "hail", weather_snowy: "hail",
};

function WeatherPanel({ weather }: { weather: WeatherResult }) {
  const today = weather.daily[0];
  const hasForecast = weather.rainPct !== undefined || weather.uv !== undefined;
  return <>
    <div className="mm-weather" aria-label="Tiempo en tu ciudad">
      <div className="mm-weather-main">
        <div className="mm-temperature"><img src={`/assets/michi-icons/${WEATHER_ART[weather.conditionIcon] ?? "cloud"}.webp`} alt="" width="44" height="44" /><strong>{weather.now}{weather.now !== "—" && <small>C</small>}</strong></div>
        <b>{weather.condition}</b>
        {today && <p>Máx. {today.hi} <span>Mín. {today.lo}</span></p>}
      </div>
      <div className="mm-weather-stat"><Droplet aria-hidden="true" className="mm-rain" size={25} /><span>Lluvia</span><strong>{weather.rainPct !== undefined ? `${weather.rainPct}%` : "—"}</strong><small>{weather.rainPct === undefined ? "Sin datos" : "Próx. hora"}</small></div>
      <div className="mm-weather-stat"><Wind aria-hidden="true" className="mm-wind" size={25} /><span>Viento</span><strong>{weather.windKmh !== undefined ? weather.windKmh : "—"}</strong><small>{weather.windKmh === undefined ? "Sin datos" : "km/h"}</small></div>
      <div className="mm-weather-stat"><Sun aria-hidden="true" className="mm-uv" size={25} /><span>UV</span><strong>{weather.uv !== undefined ? weather.uv : "—"}</strong><small>{weather.uv === undefined ? "Sin datos" : "Próx. hora"}</small></div>
    </div>
    <p className="mm-weather-source">Open-Meteo · {weather.freshnessLabel}{hasForecast ? " · Pronóstico por hora" : ""}</p>
  </>;
}

export function MorningBriefCard({ brief, city, onStart, onLater = onStart }: {
  brief: MorningBrief;
  city?: string;
  onStart: () => void;
  onLater?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherState, setWeatherState] = useState<"loading" | "ready" | "unavailable">(city?.trim() ? "loading" : "unavailable");
  const location = city?.trim();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    if (!modal) return;
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      )).filter(control => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener("keydown", keepFocusInside);
    modal.showModal();
    modal.focus();
    return () => {
      modal.removeEventListener("keydown", keepFocusInside);
      modal.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setWeather(null);
    if (!location) { setWeatherState("unavailable"); return; }
    setWeatherState("loading");
    void fetchWeather(location).then(value => {
      if (!cancelled) { setWeather(value); setWeatherState("ready"); }
    }).catch(() => { if (!cancelled) setWeatherState("unavailable"); });
    return () => { cancelled = true; };
  }, [location]);
  const greeting = brief.greeting?.trim() || "Buenos días,";
  const tasks = brief.tasks?.filter(task => task.trim()) ?? [];
  return (
    <dialog ref={dialog} tabIndex={-1} className="mm-dialog" aria-labelledby="mm-greeting" onCancel={event => { event.preventDefault(); onLater(); }} onClick={event => { if (event.target === event.currentTarget) onLater(); }}>
      <div className="mm-scroll">
        <header className="mm-hero">
          <button type="button" className="mm-close" onClick={onLater} aria-label="Cerrar saludo"><X size={23} /></button>
          <div className="mm-greeting-copy">
            <h2 id="mm-greeting">{greeting}</h2>
            {greeting.length < 65 && <p>que tengas un<br />excelente día.</p>}
            {location && <span className="mm-location"><MapPin size={16} fill="currentColor" /><span>{weather?.city || location}</span></span>}
          </div>
        </header>
        <div className="mm-body">
          {weatherState === "ready" && weather ? <WeatherPanel weather={weather} /> : <div className="mm-weather-message" role="status"><Cloud size={23} /><p>{weatherState === "loading" ? "Mirando el tiempo en tu ciudad…" : brief.weather || (location ? "Ahora no pude consultar el tiempo." : "Agregá tu ciudad en Perfil para ver el tiempo.")}</p></div>}
          <div className="mm-suggestion"><Lightbulb size={28} aria-hidden="true" /><p>{brief.suggestion || "Un paso a la vez. Estoy acá para acompañarte en lo que traiga el día."}</p></div>
          {(tasks.length > 0 || brief.memoryHighlight) && <details className="mm-plans"><summary><CheckCircle2 size={17} />{tasks.length ? `${tasks.length} pendiente${tasks.length === 1 ? "" : "s"} para hoy` : "Un recuerdo para acompañarte"}</summary>
            {tasks.length > 0 && <ul>{tasks.map((task, index) => <li key={index}>{task}</li>)}</ul>}
            {brief.memoryHighlight && <p className="mm-memory"><Heart size={16} />{brief.memoryHighlight}</p>}
          </details>}
          <div className="mm-actions"><button type="button" className="mm-start" onClick={onStart}><Sparkles size={20} fill="currentColor" />Empezar el día</button><button type="button" className="mm-later" onClick={onLater}>Más tarde</button></div>
        </div>
        <span className="mm-handle" aria-hidden="true" />
      </div>
    </dialog>
  );
}
