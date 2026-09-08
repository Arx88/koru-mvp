/**
 * BriefInterior — card "Morning brief" (#p-brief), bind real del block
 * `morning_brief`.
 *
 * Header desde greeting; items reales del block (icon + iconColor + label
 * + value + variant highlight → urgent). El hero de amanecer solo arma
 * chips con los items de clima REALES del block (sin inventar "despejado"):
 * si no hay items de clima, el hero muestra el saludo. "Escucharlo" usa
 * el TTS REAL de la app (koruVoice.speak, es-ES) y se convierte en "Parar"
 * mientras habla. "Brief leído" cierra (y marca el compromiso si matchea).
 */
import { useEffect, useState, type CSSProperties } from "react";
import {
  Sun, Wind, Droplets, CloudRain, Snowflake, Cloud, Zap, TrendingUp,
  Newspaper, Plane, BellRing, Trophy, Cake, Wallet, CheckCheck, Volume2,
  Square, Thermometer, Umbrella, CircleHelp, type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { isSpeaking, isVoiceEnabled, setVoiceEnabled, speak, stopSpeaking } from "../../../../domain/koruVoice";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-brief.css";

type BriefBlock = Extract<UiBlock, { type: "morning_brief" }>;
type BriefItem = BriefBlock["items"][number];

/** Material icon name (string del block) → Lucide. */
const ICON_MAP: Array<[RegExp, LucideIcon]> = [
  [/sunny|clear|light_mode|wb_sunny|morning|twilight/, Sun],
  [/rain|drizzle|water_drop|umbrella|storm/, CloudRain],
  [/snow|ac_unit|ice/, Snowflake],
  [/cloud|fog|mist|haze/, Cloud],
  [/thunder|lightning|bolt|flash/, Zap],
  [/wind|air/, Wind],
  [/drop|humidity|dew|droplet/, Droplets],
  [/thermostat|device_thermostat|temp/, Thermometer],
  [/trending|bitcoin|crypto|market|chart|currency|percent/, TrendingUp],
  [/news|newspaper|article|breaking|feed/, Newspaper],
  [/flight|travel|luggage|trip|vacation|plane/, Plane],
  [/bell|notification|alarm|reminder|task/, BellRing],
  [/soccer|football|sports|match|trophy|score/, Trophy],
  [/cake|birthday|celebration|party|gift/, Cake],
  [/wallet|money|payments|savings|account|finance|budget/, Wallet],
  [/help|question|info|unknown/, CircleHelp],
];

function lucideFor(icon?: string): LucideIcon {
  const n = (icon ?? "").toLowerCase().replace(/[-_]/g, "");
  for (const [re, cmp] of ICON_MAP) if (re.test(n)) return cmp;
  return CircleHelp;
}

const WEATHER_RE = /(sunny|clear|cloud|rain|drizzle|snow|storm|thunder|fog|mist|haze|wind|air|water_drop|droplet|humidity|thermostat|device_thermostat|light_mode|wb_sunny|ac_unit)/i;

function chipTint(iconColor?: string): CSSProperties {
  if (!iconColor) return { background: "var(--sky-soft)", color: "var(--sky-ink)" };
  return { background: `${iconColor}22`, color: iconColor };
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function BriefInterior({ block, onClose, onSave }: LecturaInteriorProps<BriefBlock>) {
  const items: BriefItem[] = block.items ?? [];
  const [speaking, setSpeaking] = useState(false);
  const [tick, setTick] = useState(0);

  // Reflejar el estado del sintetizador mientras habla.
  useEffect(() => {
    const id = setInterval(() => {
      const s = isSpeaking();
      setSpeaking((prev) => (prev !== s ? s : prev));
    }, 400);
    return () => clearInterval(id);
  }, []);

  const weatherItems = items.filter((it) => WEATHER_RE.test((it.icon ?? "").replace(/[-_]/g, "")));
  const now = new Date();
  const dateLabel = `${DAYS[now.getDay()]} ${now.getDate()} · ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

  const ttsText = [
    block.greeting,
    ...items.map((it) => `${it.label}: ${it.value}`),
  ]
    .filter(Boolean)
    .join(". ");

  const onListen = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!isVoiceEnabled()) setVoiceEnabled(true);
    speak(ttsText, { lang: "es-ES" });
    setTick((t) => t + 1);
    setSpeaking(true);
  };

  const headline = weatherItems[0] ? weatherItems[0].label : block.greeting || "Tu brief";
  const headlineValue = weatherItems[0]?.value;

  return (
    <LecturaShell
      onClose={() => {
        stopSpeaking();
        onClose();
      }}
      onBookmark={onSave ? () => onSave(block.greeting || "Morning brief", `${items.length} items`) : undefined}
      chip={{ label: "Brief", background: "linear-gradient(135deg,#93c5fd,#3b82f6)" }}
      ariaLabel={block.greeting || "Morning brief"}
    >
      <div id="p-brief" className="lcr-panel">
        <div className="bf-head rv">
          <h1>
            <small>Mientras dormías</small>
            {block.greeting || "Así arranca tu día"}
          </h1>
          <p>
            {items.length
              ? `${items.length} ${items.length === 1 ? "item" : "items"} de tu día${
                  weatherItems.length ? " · el clima de arriba es el real del brief" : ""
                }.`
              : "Todavía no hay nada para contarte."}
          </p>
        </div>

        <div className="bf-photo rv">
          <img src="/stitch/outfits/brief-sunrise.jpg" alt="Amanecer sobre la ciudad" />
          <div className="in">
            <span className="k">{dateLabel}</span>
            <h3>{headline}</h3>
            <div className="w">
              {weatherItems.slice(0, 3).map((it, i) => (
                <span key={`w_${i}_${it.label}`}>
                  <Ic i={lucideFor(it.icon)} className="ic" />
                  {it.value}
                </span>
              ))}
              {weatherItems.length === 0 && block.greeting && (
                <span>
                  <Ic i={Sun} className="ic" />
                  {block.greeting}
                </span>
              )}
              {headlineValue && weatherItems.length > 0 && (
                <span>
                  <Ic i={Sun} className="ic" />
                  {headlineValue}
                </span>
              )}
            </div>
          </div>
          <span className="ava">
            <img src="/stitch/avatar-wink.png" alt="Koru" />
            <span>tu brief de siempre</span>
          </span>
        </div>

        <div className="bf-list rv">
          {items.map((it, i) => (
            <div key={`it_${i}_${it.label}`} className={`bf-item${it.variant === "highlight" ? " urgent" : ""}`}>
              <div className="ic" style={chipTint(it.iconColor)}>
                <Ic i={lucideFor(it.icon)} className="ic" />
              </div>
              <div className="tx">
                <b>{it.label}</b>
              </div>
              <div className="v">
                <b>{it.value}</b>
                {/* FIX ETIQUETA: antes decía "hoy" fijo — mentía para items que
                    no son de hoy (ej. "Tu viaje a Madrid · 18 d"). Solo el valor. */}
              </div>
            </div>
          ))}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("complete", block);
              onClose();
            }}
          >
            <Ic i={CheckCheck} className="ic" />
            Brief leído
          </button>
          <button type="button" className="btn ghost" onClick={onListen} data-tick={tick}>
            <Ic i={speaking ? Square : Volume2} className="ic" />
            {speaking ? "Parar lectura" : "Escucharlo"}
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
