// ════════════════════════════════════════════════════════════════════════
//  KoruIcons.tsx — SVG animados (sistema Kimi Tier-S)
//  Reemplaza los Material Symbols estáticos del .kc-art y .mi por SVGs
//  con micro-animaciones por dominio (rays, cloudmove, raindrops, ballb,
//  bellswing, heartb, coinspin, windflow, sparkleA, leafsway, etc.).
// ════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactElement, ReactNode } from "react";
import React from "react";

export type KoruIconName =
  | "weather_sunny"
  | "weather_cloudy"
  | "weather_rain"
  | "weather_storm"
  | "weather_snow"
  | "weather_fog"
  | "weather_night"
  | "football"
  | "tennis"
  | "crypto"
  | "money"
  | "alarm"
  | "reminder"
  | "birthday"
  | "memory"
  | "news"
  | "shopping"
  | "compare"
  | "recipe"
  | "delivery"
  | "travel"
  | "exercise"
  | "morning"
  | "search"
  | "save"
  | "default";

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const baseSvg = (size: number, children: ReactNode, viewBox = "0 0 24 24") => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ overflow: "visible" }}
  >
    {children}
  </svg>
);

// ─── Clima ──────────────────────────────────────────────────────────────────

const WeatherSunny = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
      <g className="koru-ic-rays" stroke="currentColor" strokeWidth={2.4}>
        <path d="M12 1.8v2.2" />
        <path d="M12 20v2.2" />
        <path d="M1.8 12h2.2" />
        <path d="M20 12h2.2" />
        <path d="M4.5 4.5l1.6 1.6" />
        <path d="M17.9 17.9l1.6 1.6" />
        <path d="M19.5 4.5l-1.6 1.6" />
        <path d="M6.1 17.9l-1.6 1.6" />
      </g>
    </>,
  );

const WeatherCloudy = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-cloud">
      <path
        d="M6.5 18h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 18z"
        fill="currentColor"
        stroke="none"
        opacity={0.95}
      />
    </g>,
  );

const WeatherRain = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <path
        d="M6.5 14h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 14z"
        fill="currentColor"
        stroke="none"
        opacity={0.95}
      />
      <g className="koru-ic-rain" stroke="currentColor" strokeWidth={2.4}>
        <path d="M8 17v2.5" />
        <path d="M12 17v3" />
        <path d="M16 17v2.5" />
      </g>
    </>,
  );

const WeatherStorm = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <path
        d="M6.5 13h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 13z"
        fill="currentColor"
        stroke="none"
        opacity={0.95}
      />
      <path className="koru-ic-bolt" d="M11 14l-2 5h3l-1.5 4 4-6h-3l1-3z" fill="currentColor" stroke="none" />
    </>,
  );

const WeatherSnow = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <path
        d="M6.5 14h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 14z"
        fill="currentColor"
        stroke="none"
        opacity={0.9}
      />
      <g className="koru-ic-snow" stroke="currentColor" strokeWidth={2}>
        <circle cx="8" cy="18" r="0.6" fill="currentColor" />
        <circle cx="12" cy="20" r="0.6" fill="currentColor" />
        <circle cx="16" cy="18" r="0.6" fill="currentColor" />
        <circle cx="10" cy="21" r="0.5" fill="currentColor" />
        <circle cx="14" cy="21" r="0.5" fill="currentColor" />
      </g>
    </>,
  );

const WeatherFog = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-fog" stroke="currentColor" strokeWidth={2.4}>
      <path d="M3 9h14" />
      <path d="M5 13h16" />
      <path d="M3 17h14" />
      <path d="M7 21h12" />
    </g>,
  );

const WeatherNight = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <path
      className="koru-ic-moon"
      d="M19.5 13.5A7.5 7.5 0 0 1 10.5 4.5a7.5 7.5 0 1 0 9 9z"
      fill="currentColor"
      stroke="none"
    />,
  );

// ─── Deportes ───────────────────────────────────────────────────────────────

const Football = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" opacity={0.18} />
      <g className="koru-ic-ball" stroke="currentColor" strokeWidth={2} fill="none">
        <polygon points="12,7 16,9.5 14.5,14 9.5,14 8,9.5" fill="currentColor" opacity={0.85} />
        <path d="M12 3v4" />
        <path d="M4.5 9l3.5 0.5" />
        <path d="M19.5 9l-3.5 0.5" />
        <path d="M7 18l2-4" />
        <path d="M17 18l-2-4" />
      </g>
    </>,
  );

const Tennis = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="currentColor" strokeWidth={2} opacity={0.9} />
      <path className="koru-ic-tennis" d="M4 12c3-3 5-3 8 0s5 3 8 0" fill="none" stroke="#fff" strokeWidth={1.8} />
      <path d="M4 12c3 3 5 3 8 0s5-3 8 0" fill="none" stroke="#fff" strokeWidth={1.8} opacity={0.5} />
    </>,
  );

// ─── Dinero / Cripto ─────────────────────────────────────────────────────────

const Crypto = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-coin" stroke="currentColor" strokeWidth={2.4} fill="none">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity={0.18} />
      <path d="M9.5 8h3a2.5 2.5 0 0 1 0 5h-3zm0 5h3.5a2.5 2.5 0 0 1 0 5h-3.5zm1.5-7v2m0 12v-2" />
    </g>,
  );

const Money = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2} fill="none">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="currentColor" opacity={0.18} />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
      <path d="M5.5 9v6M18.5 9v6" opacity={0.7} />
    </g>,
  );

// ─── Tiempo / Recordatorios ─────────────────────────────────────────────────

const Alarm = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-bell" stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 6 1.5 6H4.5S6 13 6 9z" fill="currentColor" opacity={0.2} />
      <path d="M10 19a2 2 0 0 0 4 0" />
      <path d="M5 4L3 6M19 4l2 2" />
    </g>,
  );

const Reminder = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-tick" stroke="currentColor" strokeWidth={2.2} fill="none">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity={0.18} />
      <path d="M8 12l2.5 2.5L16 9" />
    </g>,
  );

const Birthday = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-heart" stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M12 19s-7-4.5-7-9.5a3.5 3.5 0 0 1 7-1 3.5 3.5 0 0 1 7 1c0 5-7 9.5-7 9.5z" fill="currentColor" opacity={0.2} />
    </g>,
  );

// ─── Memoria ─────────────────────────────────────────────────────────────────

const Memory = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-leaf" stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M5 19c0-9 6-15 15-15 0 9-6 15-15 15z" fill="currentColor" opacity={0.2} />
      <path d="M5 19l9-9" />
    </g>,
  );

// ─── Noticias / Información ──────────────────────────────────────────────────

const News = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-flame" stroke="currentColor" strokeWidth={2.2} fill="none">
      <path
        d="M12 3c0 3-3 4-3 8a3 3 0 0 0 6 0c0-2-1-3-1-3s2 2 2 5a4 4 0 0 1-8 0c0-5 4-7 4-10z"
        fill="currentColor"
        opacity={0.25}
      />
    </g>,
  );

// ─── Acciones ───────────────────────────────────────────────────────────────

const Shopping = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M5 7h14l-1.5 12a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5 7z" fill="currentColor" opacity={0.18} />
      <path d="M8.5 7V5a3.5 3.5 0 0 1 7 0v2" />
    </g>,
  );

const Compare = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M12 3v18" />
      <rect x="3" y="6" width="6" height="12" rx="1.5" fill="currentColor" opacity={0.18} />
      <rect x="15" y="6" width="6" height="12" rx="1.5" fill="currentColor" opacity={0.32} />
    </g>,
  );

const Recipe = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M5 11h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8z" fill="currentColor" opacity={0.18} />
      <path d="M9 11V7a3 3 0 0 1 6 0v4" />
      <path d="M5 11h14" />
    </g>,
  );

const Delivery = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-plane" stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M3 13l16-7-7 16-2-7-7-2z" fill="currentColor" opacity={0.18} />
    </g>,
  );

const Travel = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g className="koru-ic-wind" stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M3 8h9a2.5 2.5 0 1 0-2.4-3.2" />
      <path d="M3 12h13a2.5 2.5 0 1 1-2.4 3.2" />
      <path d="M3 16h7" />
    </g>,
  );

const Exercise = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M6 4v16M18 4v16" />
      <rect x="3" y="7" width="3" height="10" rx="1" fill="currentColor" opacity={0.25} />
      <rect x="18" y="7" width="3" height="10" rx="1" fill="currentColor" opacity={0.25} />
      <path d="M6 12h12" />
    </g>,
  );

const Morning = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <>
      <circle cx="12" cy="14" r="4.2" fill="currentColor" stroke="none" />
      <g className="koru-ic-rays" stroke="currentColor" strokeWidth={2.4}>
        <path d="M12 5v2.5" />
        <path d="M4 12H1.8" />
        <path d="M22.2 12H20" />
        <path d="M5.5 7.5L4 6" />
        <path d="M18.5 7.5L20 6" />
      </g>
      <path d="M3 19h18" opacity={0.6} />
    </>,
  );

const Search = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <circle cx="11" cy="11" r="6.5" fill="currentColor" opacity={0.18} />
      <path d="M15.5 15.5L20 20" />
    </g>,
  );

const Save = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <path d="M6 4h12v16l-6-3.5L6 20V4z" fill="currentColor" opacity={0.18} />
    </g>,
  );

const Default = ({ size = 40 }: IconProps) =>
  baseSvg(
    size,
    <g stroke="currentColor" strokeWidth={2.2} fill="none">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity={0.18} />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </g>,
  );

const ICON_MAP: Record<KoruIconName, (p: IconProps) => ReactElement> = {
  weather_sunny: WeatherSunny,
  weather_cloudy: WeatherCloudy,
  weather_rain: WeatherRain,
  weather_storm: WeatherStorm,
  weather_snow: WeatherSnow,
  weather_fog: WeatherFog,
  weather_night: WeatherNight,
  football: Football,
  tennis: Tennis,
  crypto: Crypto,
  money: Money,
  alarm: Alarm,
  reminder: Reminder,
  birthday: Birthday,
  memory: Memory,
  news: News,
  shopping: Shopping,
  compare: Compare,
  recipe: Recipe,
  delivery: Delivery,
  travel: Travel,
  exercise: Exercise,
  morning: Morning,
  search: Search,
  save: Save,
  default: Default,
};

/** Map de iconos Material Symbols (los que usa presentation.ts) a KoruIconName. */
export function iconFromMaterial(matName: string | undefined): KoruIconName {
  if (!matName) return "default";
  const m = matName.toLowerCase().replace(/[-_]/g, "");
  if (m.includes("sunny") || m === "wb_sunny" || m.includes("clear")) return "weather_sunny";
  if (m.includes("cloud") && !m.includes("rain")) return "weather_cloudy";
  if (m.includes("rain") || m.includes("drizzle")) return "weather_rain";
  if (m.includes("thunder") || m.includes("storm") || m.includes("lightning")) return "weather_storm";
  if (m.includes("snow")) return "weather_snow";
  if (m.includes("fog") || m.includes("mist") || m.includes("haze")) return "weather_fog";
  if (m === "night" || m.includes("bedtime") || m.includes("moon")) return "weather_night";
  if (m === "soccer" || m.includes("football") || m === "sports_soccer") return "football";
  if (m === "tennis" || m === "sports_tennis") return "tennis";
  if (m.includes("bitcoin") || m.includes("crypto") || m.includes("currency_bitcoin") || m.includes("trending_up")) return "crypto";
  if (m === "payments" || m === "account_balance_wallet" || m === "attach_money" || m === "savings") return "money";
  if (m === "alarm" || m === "alarm_on" || m === "alarm_add") return "alarm";
  if (m === "notifications" || m === "bell" || m === "task_alt" || m === "check_circle") return "reminder";
  if (m.includes("cake") || m.includes("favorite") || m.includes("celebration")) return "birthday";
  if (m === "memory" || m === "psychology" || m === "eco" || m === "spa" || m === "forest") return "memory";
  if (m === "whatshot" || m.includes("breaking") || m === "warning" || m === "priority_high") return "news";
  if (m === "shopping_cart" || m === "shopping_bag" || m.includes("cart")) return "shopping";
  if (m === "compare" || m === "compare_arrows" || m === "balance") return "compare";
  if (m === "restaurant" || m === "menu_book" || m === "soup_kitchen" || m === "local_dining") return "recipe";
  if (m === "delivery_dining" || m === "two_wheeler" || m === "directions_bike") return "delivery";
  if (m === "travel_explore" || m === "luggage" || m === "flight" || m === "directions_car" || m === "route" || m === "map" || m === "near_me" || m === "location_on") return "travel";
  if (m === "fitness_center" || m === "directions_run" || m === "sports_gymnastics" || m === "exercise") return "exercise";
  if (m === "wb_twilight" || m === "light_mode" || m === "morning") return "morning";
  if (m === "search" || m === "manage_search" || m === "explore" || m === "travel_explore") return "search";
  if (m === "bookmark" || m === "save" || m === "saved" || m === "bookmark_border") return "save";
  return "default";
}

export function KoruIcon({ name, size = 40, className, style }: { name: KoruIconName; size?: number; className?: string; style?: CSSProperties }) {
  const Cmp = ICON_MAP[name] ?? Default;
  return <Cmp size={size} className={className} style={style} />;
}
