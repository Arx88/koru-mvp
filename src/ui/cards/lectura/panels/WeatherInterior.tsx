/**
 * WeatherInterior — card "Clima" del catálogo Lectura Visual (#p-clima),
 * integrada al block real `weather`.
 *
 * Concepto del catálogo: estación meteorológica — temperatura gigante,
 * arco solar con la posición REAL del sol según la hora, curva de
 * temperatura por hora (SVG generado desde hourly del block), máx/mín
 * y semana con barras normalizadas. Acciones legítimas vía
 * koru-card-action (create_commitment → "Alerta creada ✓" en el provider).
 */
import { useRef } from "react";
import {
  BellRing,
  CalendarDays,
  ChartLine,
  Cloud,
  CloudMoon,
  CloudRain,
  CloudSun,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-clima.css";

type WeatherBlock = Extract<UiBlock, { type: "weather" }>;

/** Mapa condición (texto ES o icono MS del tool) → icono Lucide. */
function wxIcon(kind?: string): LucideIcon {
  const k = (kind ?? "").toLowerCase();
  if (/(rain|lluv)/.test(k)) return CloudRain;
  if (/(storm|tormenta)/.test(k)) return CloudRain;
  if (/(snow|nieve)/.test(k)) return CloudRain;
  if (/(partly.*night|night|noche)/.test(k)) return CloudMoon;
  if (/(partly|parcial|nubos)/.test(k)) return CloudSun;
  if (/(clear|despej|sol)/.test(k)) return Sun;
  if (/(cloud|nubl)/.test(k)) return Cloud;
  if (/(moon|luna)/.test(k)) return Moon;
  return CloudSun;
}

function parseTemp(t?: string): number | null {
  if (!t) return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Curva de temperatura suave (Catmull-Rom → bezier) desde hourly. */
function buildCurve(hourly: NonNullable<WeatherBlock["hourly"]>) {
  const temps = hourly.map((h) => parseTemp(h.temp) ?? 0);
  if (temps.length < 2) return null;
  const min = Math.min(...temps) - 1;
  const max = Math.max(...temps) + 1;
  const span = Math.max(1, max - min);
  const pts = temps.map((t, i) => ({
    x: 6 + (i * 328) / (temps.length - 1),
    y: 96 - ((t - min) / span) * 74,
  }));
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const maxIdx = temps.indexOf(Math.max(...temps));
  const maxTemp = temps[maxIdx];
  const peak = pts[maxIdx];
  return {
    line: d,
    area: `${d} L334 108 L6 108 Z`,
    peak: { x: peak.x, y: peak.y, label: `${Math.round(maxTemp)}° máx` },
    labels: hourly.map((h) => h.hour),
  };
}

/** Posición del sol en el arco según la hora local (7→21 h). */
function sunPosition(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  const f = Math.min(0.97, Math.max(0.02, (h - 7) / 14));
  return { x: 8 + f * 344, y: 66 - 45 * Math.sin(f * Math.PI) };
}

export function WeatherInterior({ block, onClose, onSave }: LecturaInteriorProps<WeatherBlock>) {
  const weekRef = useRef<HTMLDivElement>(null);
  const city = block.city ?? block.title ?? "tu ciudad";
  const now = block.now ?? "—";
  const when = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(block.verifiedAt ? new Date(block.verifiedAt) : new Date());

  const hourly = block.hourly ?? [];
  const daily = block.daily ?? [];
  const curve = buildCurve(hourly);

  // máx/mín: del range, si no del primer daily
  const rangeMatch = (block.range ?? "").match(/(\d+)[°º]?\s*[–—-]\s*(\d+)/);
  const lo = rangeMatch ? Number(rangeMatch[1]) : parseTemp(daily[0]?.lo ?? "") ?? null;
  const hi = rangeMatch ? Number(rangeMatch[2]) : parseTemp(daily[0]?.hi ?? "") ?? null;
  const maxHour = (() => {
    if (hourly.length === 0) return null;
    let best = 0;
    hourly.forEach((h, i) => {
      if ((parseTemp(h.temp) ?? 0) > (parseTemp(hourly[best].temp) ?? 0)) best = i;
    });
    return hourly[best].hour;
  })();

  // título de semana derivado de la tendencia real
  const weekTitle = (() => {
    const his = daily.map((d) => parseTemp(d.hi) ?? NaN).filter(Number.isFinite);
    if (his.length < 3) return "La semana";
    const first = (his[0] + his[1]) / 2;
    const last = (his[his.length - 2] + his[his.length - 1]) / 2;
    if (last < first - 1) return "La semana viene calmando";
    if (last > first + 1) return "La semana viene calentando";
    return "La semana se mantiene pareja";
  })();

  const his = daily.map((d) => parseTemp(d.hi) ?? 0);
  const hiMin = Math.min(...his, Infinity);
  const hiMax = Math.max(...his, -Infinity);
  const weekSpan = Math.max(1, hiMax - hiMin);

  const sun = sunPosition();
  const ConditionIcon = wxIcon(block.condition ?? hourly[0]?.conditionIcon);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`Clima ${city}`, block.condition) : undefined}
      chip={{ label: "Clima", background: "linear-gradient(135deg,#8ab0ff,#5170d8)" }}
      ariaLabel={`Clima ${city}`}
    >
      <div id="p-clima" className="lcr-panel">
        <div className="wx-now rv">
          <div className="wx-top">
            <div>
              <div className="wx-place">Ahora en {city}</div>
              <div className="wx-when">{when}</div>
            </div>
            <div className="wx-wicon">
              <Ic i={ConditionIcon} className="ic ic-bob" />
            </div>
          </div>
          <div className="wx-main">
            <div className="wx-temp">{now}</div>
            <div className="wx-meta">
              <span>{block.condition ?? "Clima"}</span>
              <br />
              {block.feel ? <>Sensación <b>{block.feel}</b><br /></> : null}
              {block.wind ? <>Viento {block.wind}</> : null}
            </div>
          </div>
          <div className="wx-arc rv">
            <div className="arc-cap">
              <span><Ic i={Sunrise} className="ic" />amanecer</span>
              <span>atardecer<Ic i={Sunset} className="ic" /></span>
            </div>
            <svg viewBox="0 0 360 74" style={{ width: "100%", height: "74px", display: "block" }}>
              <path d="M8 66 A 172 172 0 0 1 352 66" fill="none" stroke="#c9d9f5" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
              <path d={`M8 66 A 172 172 0 0 1 ${sun.x.toFixed(1)} ${sun.y.toFixed(1)}`} fill="none" stroke="#f6bd6d" strokeWidth="3.5" strokeLinecap="round" opacity=".9" />
              <circle cx={sun.x.toFixed(1)} cy={sun.y.toFixed(1)} r="11" fill="#fde9c8" stroke="#f59e0b" strokeWidth="3.5" />
              <line x1="4" y1="66" x2="356" y2="66" stroke="#c9d9f5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {curve && (
          <div className="wx-curve rv" style={{ marginTop: "14px" }}>
            <h3><Ic i={ChartLine} className="ic" />Cómo viene la tarde</h3>
            <svg viewBox="0 0 340 110">
              <defs>
                <linearGradient id="p-clima-wxf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8ab0ff" stopOpacity=".34" />
                  <stop offset="1" stopColor="#8ab0ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g stroke="#eef2fb" strokeWidth="1">
                <line x1="0" y1="22" x2="340" y2="22" />
                <line x1="0" y1="55" x2="340" y2="55" />
                <line x1="0" y1="88" x2="340" y2="88" />
              </g>
              <path d={curve.area} fill="url(#p-clima-wxf)" />
              <path d={curve.line} fill="none" stroke="#5170d8" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx={curve.peak.x} cy={curve.peak.y} r="6" fill="#fff" stroke="#f59e0b" strokeWidth="3" />
              <text x={curve.peak.x} y={Math.max(12, curve.peak.y - 12)} textAnchor="middle" fontFamily="Plus Jakarta Sans" fontWeight="800" fontSize="11" fill="#b45309">{curve.peak.label}</text>
            </svg>
            <div className="xh">
              {curve.labels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>
        )}

        {hi != null && lo != null && (
          <div className="wx-hi-lo rv" style={{ marginTop: "14px" }}>
            <div className="hl" style={{ background: "var(--honey-soft)" }}>
              <Ic i={Sun} className="ic ic-spin" style={{ color: "var(--honey-ink)" }} />
              <div>
                <b style={{ color: "var(--honey-ink)" }}>{hi}°</b>
                <span>Máxima{maxHour ? ` · ${maxHour}h` : ""}</span>
              </div>
            </div>
            <div className="hl" style={{ background: "var(--sky-soft)" }}>
              <Ic i={Moon} className="ic" style={{ color: "var(--sky-ink)" }} />
              <div>
                <b style={{ color: "var(--sky-ink)" }}>{lo}°</b>
                <span>Mínima</span>
              </div>
            </div>
          </div>
        )}

        {daily.length > 0 && (
          <div className="rv" style={{ marginTop: "14px" }} ref={weekRef}>
            <h3 style={{ font: "800 15px var(--disp)", marginBottom: "9px" }}>{weekTitle}</h3>
            <div className="wx-days">
              {daily.map((d, i) => {
                const hiVal = parseTemp(d.hi) ?? hiValFallback(hiMin);
                const loVal = parseTemp(d.lo) ?? hiVal;
                const DayIcon = wxIcon(d.conditionIcon);
                const left = Math.round(((hiVal - hiMin) / weekSpan) * 68) + 16;
                return (
                  <div className="wx-day" key={i}>
                    <span className="wd">{d.dayAbbrev}</span>
                    <div className="wi"><Ic i={DayIcon} className="ic" /></div>
                    <div className="wbar"><i style={{ left: `${left}%` }}></i></div>
                    <span className="wtmp">{loVal}°–{hiVal}°</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              dispatchCardAction("create_commitment", block, {
                title: `Avisame si llueve${block.city ? ` en ${block.city}` : ""}`,
                dueHint: "cuando el pronóstico marque lluvia",
              })
            }
          >
            <Ic i={BellRing} className="ic" />Avisame si llueve
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => weekRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Ic i={CalendarDays} className="ic" />Ver semana
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}

function hiValFallback(hiMin: number): number {
  return Number.isFinite(hiMin) ? Math.round(hiMin) : 0;
}
