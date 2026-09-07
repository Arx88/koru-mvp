/**
 * lectura-gallery-main — galería de los interiores Lectura Visual
 * INTEGRADOS en la app real. Cada entrada usa el fixture del block real
 * (contrato de domain/types) y renderiza el componente registrado.
 * Sirve de verificación visual determinística y showcase vivo:
 * la lista muestra las cards integradas; al tocar se abre el interior
 * con el mismo wiring que KoruDetailScreen (onClose/onSave/acciones).
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./lectura-gallery.css";
import type { LucideIcon } from "lucide-react";
import {
  CloudSun,
  Newspaper,
  Shirt,
  Radar,
  Trophy,
  Clock,
  CookingPot,
  Clapperboard,
  BookOpen,
  AlarmClock,
  ListChecks,
} from "lucide-react";
import type { UiBlock } from "./domain/types";
import { WeatherInterior } from "./ui/cards/lectura/panels/WeatherInterior";
import { PlanInterior } from "./ui/cards/lectura/panels/PlanInterior";
import { OutfitInterior } from "./ui/cards/lectura/panels/OutfitInterior";
import { LiveMatchInterior } from "./ui/cards/lectura/panels/LiveMatchInterior";
import { NewsInterior } from "./ui/cards/lectura/panels/NewsInterior";
import { RestaurantInterior } from "./ui/cards/lectura/panels/RestaurantInterior";
import { RecipeInterior } from "./ui/cards/lectura/panels/RecipeInterior";
import { MovieInterior } from "./ui/cards/lectura/panels/MovieInterior";
import { BookInterior } from "./ui/cards/lectura/panels/BookInterior";
import { AlarmInterior } from "./ui/cards/lectura/panels/AlarmInterior";
import { CheckInterior } from "./ui/cards/lectura/panels/CheckInterior";
import {
  weatherBlock,
  planBlock,
  outfitBlock,
  liveMatchBlock,
  newsUrgentBlock,
  restaurantBlock,
  recipeBlock,
  movieBlock,
  bookBlock,
  alarmBlock,
  checklistBlock,
} from "./ui/cards/lectura/fixtures";

type Entry = {
  id: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  tint: string;
  color: string;
  block: UiBlock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Cmp: React.ComponentType<any>;
};

const CARDS: Entry[] = [
  { id: "weather", label: "Clima Madrid", sub: "estación meteorológica · arco solar real", icon: CloudSun, tint: "var(--sky-soft)", color: "var(--sky-ink)", block: weatherBlock, Cmp: WeatherInterior },
  { id: "plan", label: "Tu día", sub: "agenda-timeline con AHORA vivo", icon: Clock, tint: "var(--mint-soft)", color: "var(--mint-ink)", block: planBlock, Cmp: PlanInterior },
  { id: "outfit", label: "Qué me pongo", sub: "look board con productos reales", icon: Shirt, tint: "var(--sky-soft)", color: "var(--sky-ink)", block: outfitBlock, Cmp: OutfitInterior },
  { id: "match", label: "Clásico en vivo", sub: "marcador + feed de goles con fotos", icon: Radar, tint: "var(--mint-soft)", color: "var(--mint-ink)", block: liveMatchBlock, Cmp: LiveMatchInterior },
  { id: "news", label: "Noticias", sub: "portada de diario · fuentes verificadas", icon: Newspaper, tint: "var(--sky-soft)", color: "var(--sky-ink)", block: newsUrgentBlock, Cmp: NewsInterior },
  { id: "rest", label: "Parrillas", sub: "podio top-3 + plato real de Places", icon: Trophy, tint: "var(--honey-soft)", color: "var(--honey-ink)", block: restaurantBlock, Cmp: RestaurantInterior },
  { id: "recipe", label: "Receta carbonara", sub: "revista · modo cocina real", icon: CookingPot, tint: "var(--honey-soft)", color: "var(--honey-ink)", block: recipeBlock, Cmp: RecipeInterior },
  { id: "movie", label: "Película de hoy", sub: "cartelera + tráiler real", icon: Clapperboard, tint: "var(--violet-soft)", color: "var(--violet-ink)", block: movieBlock, Cmp: MovieInterior },
  { id: "book", label: "Lectura de noche", sub: "mesita de luz + vista previa", icon: BookOpen, tint: "var(--honey-soft)", color: "var(--honey-ink)", block: bookBlock, Cmp: BookInterior },
  { id: "alarm", label: "Alarma gym 7:00", sub: "reloj vivo + días reales del repeat", icon: AlarmClock, tint: "var(--honey-soft)", color: "var(--honey-ink)", block: alarmBlock, Cmp: AlarmInterior },
  { id: "check", label: "Checklist notebook", sub: "toggles durables del checklist", icon: ListChecks, tint: "var(--violet-soft)", color: "var(--violet-ink)", block: checklistBlock, Cmp: CheckInterior },
];


function Gallery() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const entry = CARDS.find((c) => c.id === openId);

  if (entry) {
    const Cmp = entry.Cmp;
    return (
      <Cmp
        block={entry.block}
        onClose={() => setOpenId(null)}
        onSave={(title: string) => {
          setSaved((s) => [...s, title]);
          setOpenId(null);
        }}
      />
    );
  }

  return (
    <div className="gal">
      <header className="gal-head">
        <img src="/stitch/avatar-wink.png" alt="Koru" width={34} height={34} />
        <div>
          <h1>Lectura Visual <span>· integrada</span></h1>
          <p>
            {CARDS.length} cards del catálogo corriendo con los datos reales del
            dominio — mismas que al tocar una card en el chat.
          </p>
        </div>
      </header>
      <div className="gal-grid">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              className="gal-mini"
              data-card={c.id}
              onClick={() => setOpenId(c.id)}
            >
              <span className="gal-ic" style={{ background: c.tint, color: c.color }}>
                <Icon />
              </span>
              <span className="gal-tx">
                <b>{c.label}</b>
                <small>{c.sub}</small>
              </span>
              <span className="gal-ch">›</span>
            </button>
          );
        })}
      </div>
      {saved.length > 0 && (
        <p className="gal-saved">Guardado en tu jardín 🌱: {saved.join(" · ")}</p>
      )}
      <footer className="gal-foot">
        <a href="/preview.html">← showcase del chat</a> ·{" "}
        <a href="/lectura-visual.html">catálogo de diseño</a>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Gallery />);
