import { useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import type { UiBlock } from "../../../domain/types";
import type { Hero, Detail, KoruPresentation } from "./presentation";
import { KoruIcon, iconFromMaterial } from "./KoruIcons";
import { isMichiNews, MichiNewsCards, MichiRecipeCard, MichiMarketCard } from "./MichiNewCards";

/* ============================================================================
   MICHI v7 — CARDS "MINI-MUNDO" (port fiel del diseño de public/estilo-v2.html)
   Reemplaza la estética Stitch de los layouts legados. Cada dominio tiene su
   propio diseño + hero 3D ilustrado (public/michi/heroes/*.jpg).
   ============================================================================ */

type Cta = KoruPresentation["cta"];

export type MichiDesign =
  | "icard" | "mission" | "crypto" | "receta" | "fit" | "focus"
  | "game" | "shop" | "sleep" | "futbol" | "tenis";

export type MichiProps = {
  block: UiBlock;
  hero: Hero;
  cta?: Cta;
  detail?: Detail;
  actions?: KoruPresentation["actions"];
  isTappable: boolean;
  handleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  overlay: ReactNode; // DetailOverlay renderizado por el padre
  foot?: ReactNode; // CardFoot (fuentes + Guardar/Compartir/Abrir) del padre
};

/** Acciones inline (presentation.actions) — chips accionables estilo v7. */
function MichiInlineActions({ actions }: { actions?: KoruPresentation["actions"] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="mc-opts" style={{ marginTop: 8 }}>
      {actions.slice(0, 3).map((a, i) => (
        <button key={i} type="button" className="mc-opt" onClick={(e) => e.stopPropagation()}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

function Mat({ children, style, className = "" }: { children: string; style?: CSSProperties; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {children}
    </span>
  );
}

/** ✦ spark — SVG del diseño v7 (estilo-v2 #k-spark). */
function SparkIcon({ size = 11, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" focusable="false">
      <path d="M12 1.6c.86 5.5 4.9 9.54 10.4 10.4-5.5.86-9.54 4.9-10.4 10.4-.86-5.5-4.9-9.54-10.4-10.4C7.1 11.14 11.14 7.1 12 1.6Z" />
    </svg>
  );
}

/** → arrow — SVG del diseño v7 (estilo-v2 #k-arrow). */
function ArrowIcon({ size = 12, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icono Michi: SVG real (KoruIcon) cuando el material mapea; si no, ligadura.
 *  Los <svg> cuentan como riqueza visual medible y se ven nítidos a DPI alto. */
function MIcon({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties }) {
  const kn = iconFromMaterial(name);
  if (kn !== "default") return <KoruIcon name={kn} size={size} style={style} />;
  return <Mat style={{ fontSize: size, ...style }}>{name}</Mat>;
}

/** ¿El string parece emoji? (los hourly traen conditionIcon emoji o material) */
function isEmoji(s: string | undefined): boolean {
  if (!s) return false;
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s) && !/^[a-z_]+$/i.test(s);
}

/** accent.color → clase de badge mc-ib (paleta v7) */
function ibClass(color?: string): string {
  const c = (color ?? "").toLowerCase();
  if (c.includes("f0a") || c.includes("fdc") || c.includes("ffd75e")) return "gold";
  if (c.includes("2fc8") || c.includes("4bdd") || c.includes("0e9e")) return "green";
  if (c.includes("2e7c") || c.includes("5fb0") || c.includes("007b")) return "blue";
  if (c.includes("f65e") || c.includes("ff9e")) return "pink";
  if (c.includes("ff4d") || c.includes("ff5a") || c.includes("e639")) return "red";
  if (c.includes("5940") || c.includes("1e2a") || c.includes("4457")) return "navy";
  return "vio";
}

/** Mapa block.type → diseño Michi v7. TODO card tiene mini-mundo. */
export function michiDesignFor(block: UiBlock): MichiDesign {
  const t = block.type;
  switch (t) {
    // CLIMA / día — icard con hero de paisaje
    case "weather":
    case "day_info":
    case "morning_brief":
      return "icard";
    // DINERO — glass oscuro full-bleed
    case "crypto_portfolio":
    case "forex":
    case "market":
    case "data_ticker":
      return "crypto";
    // DEPORTES
    case "live_match":
    case "match_stats":
    case "match_timeline":
      return "futbol";
    case "tennis_match":
      return "tenis";
    // COMIDA
    case "recipe":
    case "restaurant_synthesis":
      return "receta";
    // FITNESS / bienestar
    case "exercise_plan":
    case "activity_tracker":
      return "fit";
    case "wellbeing":
    case "health_reminder":
      return "sleep";
    // ENTRETENIMIENTO — horizontal oscuro
    case "movie_review":
    case "book_review":
      return "game";
    // COMPRAS
    case "shopping_list":
      return "shop";
    // ESPECÍFICOS con specs/imagen → icard (tiles)
    case "outfit":
    case "product_analysis":
    case "review_score":
    case "activity_group":
      return "icard";
    // LISTAS / planes / conocimiento → card misión blanca
    case "plan":
    case "smart_checklist":
    case "travel_plan":
    case "travel_planner":
    case "birthday_calendar":
    case "social_interaction":
    case "saved_record":
    case "delivery":
    case "money_summary":
    case "election_results":
    case "election_vote":
    case "decision_support":
    case "clarifying_question":
    case "review_document":
    case "review_quote":
    case "research_sources":
    case "comparison":
    case "route_timeline":
    case "transport_compare":
    case "memory":
    case "resource_bundle":
    case "urgent_now":
    case "generation":
      return "mission";
    // CONOCIMIENTO / informes / investigación — icard con hero de trabajo
    default:
      return "icard";
  }
}

/** Hero CSS var según dominio para el icard genérico. */
function heroVarFor(block: UiBlock): string {
  const t = block.type;
  if (t === "weather" || t === "day_info" || t === "morning_brief") return "var(--mc-hero-clima)";
  if (t === "shopping_list" || t === "outfit") return "var(--mc-hero-compras)";
  if (t === "recipe" || t === "restaurant_synthesis") return "var(--mc-hero-receta)";
  if (t === "exercise_plan" || t === "activity_tracker" || t === "health_reminder") return "var(--mc-hero-fit)";
  if (t === "wellbeing") return "var(--mc-hero-dormir)";
  if (t === "movie_review" || t === "book_review") return "var(--mc-hero-game)";
  if (t === "crypto_portfolio" || t === "forex" || t === "market" || t === "data_ticker") return "var(--mc-hero-cripto)";
  if (t === "live_match" || t === "match_stats" || t === "match_timeline") return "var(--mc-hero-futbol)";
  if (t === "tennis_match") return "var(--mc-hero-tenis)";
  if (t === "product_analysis" || t === "comparison") return "url(/assets/art-02.webp)";
  // informes / research / decisiones / rutas / artículos → Inform del usuario
  return "var(--mc-hero-trabajo)";
}

/** ¿El block trae imagen propia (poster/cover/image) para el hero? */
function blockImage(block: UiBlock): string | undefined {
  const b = block as Record<string, unknown>;
  const cand = (b.image ?? b.poster ?? b.cover ?? b.art) as string | undefined;
  return typeof cand === "string" && cand.length > 4 ? cand : undefined;
}

/* ============================================================================
   ICARD — hero ilustrado + panel blanco solapado + tiles + CTA (el molde base)
   ============================================================================ */

export function MichiIcard(props: MichiProps) {
  const { block, hero, cta, foot, isTappable, handleClick, handleKeyDown, overlay } = props;
  const [radarOpen, setRadarOpen] = useState(false);
  const b = block as Record<string, unknown>;

  const isWeather = block.type === "weather";
  const wb = b as {
    city?: string; now?: string; condition?: string; range?: string;
    hourly?: { hour?: string; temp?: string; conditionIcon?: string; rainPct?: number }[];
    daily?: { dayAbbrev?: string; hi?: string; lo?: string }[];
  };

  // Hero: imagen propia del block si existe, si no el del dominio.
  const ownImg = blockImage(block);
  const heroBg = ownImg ? `url(${ownImg})` : heroVarFor(block);

  // bigval: para clima la temperatura; para el resto artValue/primera métrica.
  const wNow = wb.now;
  const wCond = wb.condition;
  const firstVal = hero.metrics?.find((m) => m.value)?.value;
  const bigval = isWeather ? (wNow ?? hero.artValue ?? firstVal) : (hero.artValue ?? firstVal);
  const bigsub = isWeather && wCond ? wCond : hero.title;
  const bigmin = isWeather && wb.range ? wb.range : hero.desc;
  const valIsLong = (bigval ?? "").length > 6;

  const metrics = (hero.metrics ?? []).slice(0, 3);
  const hourly = (wb.hourly ?? []).slice(0, 7);
  const daily = (wb.daily ?? []).slice(0, 7);
  // desc no usada como bigmin → se muestra como nota del panel (contenido real)
  const note = !bigmin ? hero.desc : undefined;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-icard" aria-label={`Abrir ${hero.title}`} {...tapProps}>
      {/* ---- HERO ilustrado ---- */}
      <div className="mc-ihero" style={{ ["--mc-h" as string]: heroBg } as CSSProperties}>
        <span className="mc-locpill">
          <Mat>place</Mat>
          {hero.kicker}
        </span>
        {hero.live && <span className="mc-chip2">En vivo</span>}
        {(bigval || bigsub) && (
          <div className="mc-hero-data">
            {bigval && <span className={`mc-bigval${valIsLong ? " md" : ""}`}>{bigval}</span>}
            {bigsub && <span className="mc-bigsub">{bigsub}</span>}
            {bigmin && <span className="mc-bigmin">{bigmin}</span>}
          </div>
        )}
      </div>

      {/* ---- PANEL blanco solapado ---- */}
      <div className="mc-ipanel">
        {metrics.length > 0 && (
          <div className="mc-tiles">
            {metrics.map((m, i) => (
              <div key={i} className="mc-tile">
                <span className="e">
                  {isEmoji(m.icon) ? m.icon : <Mat style={{ color: m.color ?? "#6E7594" }}>{m.icon}</Mat>}
                </span>
                <span className="k">{m.label}</span>
                {m.value && <span className="v">{m.value}</span>}
              </div>
            ))}
          </div>
        )}

        {note && <p className="mc-note">{note}</p>}

        {/* radar hora a hora (clima) — expandible */}
        {isWeather && hourly.length > 0 && (
          <>
            <div className={`mc-radar${radarOpen ? " open" : ""}`}>
              <div className="mc-radar-in">
                {hourly.map((h, i) => (
                  <div key={i} className="mc-rr">
                    <b>{h.hour ?? ""}</b>
                    <span className="re">{isEmoji(h.conditionIcon) ? h.conditionIcon : <Mat>{h.conditionIcon ?? "wb_sunny"}</Mat>}</span>
                    <i>{h.temp ?? ""}</i>
                  </div>
                ))}
              </div>
              {daily.length > 0 && (
                <div className="mc-bars2">
                  {daily.map((d, i) => (
                    <div key={i} className={i === 0 ? "hi" : ""}>
                      <i style={{ height: `${28 + Math.min(parseInt(d.hi ?? "20", 10) || 20, 100)}%` }} />
                      <span className="d">{d.dayAbbrev ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="mc-cta"
              type="button"
              onClick={(e) => { e.stopPropagation(); setRadarOpen((o) => !o); }}
            >
              <SparkIcon />
              {radarOpen ? "Cerrar el detalle hora por hora" : (cta?.label ?? "Ver el radar hora por hora")}
              <ArrowIcon />
            </button>
          </>
        )}

        {/* CTA estándar (no clima o sin hourly) */}
        {(!isWeather || hourly.length === 0) && isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
            onKeyDown={handleKeyDown as unknown as React.KeyboardEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver el detalle"}
            <ArrowIcon />
          </button>
        )}

        {foot}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   MISSION — card blanca con filas interactivas + banner (planes / listas)
   Lee TODAS las formas reales de los blocks: items string[], items objetos,
   records, files, sources, steps, summaryItems, options, gifts, spec rows…
   ============================================================================ */

type MissionRow = {
  text?: string;
  sub?: string;
  chip?: string;
  done?: boolean;
  emoji?: string;
  icon?: string;
};

type MissionExtract = {
  rows: MissionRow[];
  options: string[];
  body?: string;
  banner?: string;
  bannerTitle?: string;
  count?: string;
};

function extractMission(block: UiBlock, hero: Hero): MissionExtract {
  const b = block as Record<string, unknown>;
  const rows: MissionRow[] = [];
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  // items: string[] (shopping_list vieja, clarifying options…)
  for (const it of arr(b.items)) {
    if (typeof it === "string") {
      rows.push({ text: it });
    } else if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      rows.push({
        text: (o.title ?? o.label ?? o.text ?? o.name ?? o.question ?? o.headline) as string | undefined,
        sub: (o.detail ?? o.snippet ?? o.value ?? o.sizeLabel ?? o.domain ?? o.remaining) as string | undefined,
        chip: (o.percent ?? o.probability != null ? `${o.probability}%` : undefined) as string | undefined,
        done: typeof o.checked === "boolean" ? o.checked : typeof o.done === "boolean" ? o.done : undefined,
        emoji: (o.emoji ?? o.char) as string | undefined,
        icon: (o.icon ?? o.kind ?? o.domain) as string | undefined,
      });
    }
  }
  // records / files / sources / steps / gifts / assets alternativos
  for (const key of ["records", "files", "sources", "steps", "gifts", "summaryItems", "options", "events", "spec"]) {
    for (const it of arr(b[key])) {
      if (typeof it === "string") {
        if (key === "options") continue; // van como chips interactivos
        rows.push({ text: it });
      } else if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        rows.push({
          text: (o.title ?? o.label ?? o.name ?? o.text) as string | undefined,
          sub: (o.detail ?? o.snippet ?? o.value ?? o.sizeLabel ?? o.content ?? o.dueHint ?? o.person ?? o.vendor) as string | undefined,
          chip: (o.percent ?? (o.probability != null ? `${o.probability}%` : undefined) ?? o.price) as string | undefined,
          done: typeof o.done === "boolean" ? o.done : typeof o.checked === "boolean" ? o.checked : undefined,
          emoji: (o.emoji ?? o.char) as string | undefined,
          icon: (o.icon ?? o.kind ?? o.domain) as string | undefined,
        });
      }
    }
  }

  const options = arr(
    (b as { options?: unknown }).options,
  ).filter((o): o is string => typeof o === "string");

  // travel_plan / travel_planner: days[].activities[] y steps[] → filas con hora
  for (const d of arr((b as { days?: unknown }).days)) {
    const day = d as { day?: number; title?: string; activities?: { time?: string; title?: string; detail?: string }[] };
    for (const a of arr(day.activities).slice(0, 2)) {
      rows.push({
        text: a.title,
        sub: a.detail,
        chip: a.time,
        icon: "schedule",
      });
    }
  }
  for (const s of arr((b as { steps?: unknown }).steps)) {
    const st = s as { time?: string; label?: string; detail?: string; icon?: string };
    rows.push({ text: st.label, sub: st.detail, chip: st.time, icon: st.icon ?? "schedule" });
  }

  // restaurant_synthesis: matches → filas con rating/distancia
  for (const m of arr((b as { matches?: unknown }).matches)) {
    const mt = m as { name?: string; rating?: number; distanceFromUser?: string; menuHighlights?: { dish?: string; price?: string }[] };
    const price = mt.menuHighlights?.[0]?.price;
    rows.push({
      text: mt.name,
      sub: mt.distanceFromUser,
      chip: mt.rating != null ? `★ ${String(mt.rating).replace(".", ",")}` : price,
      icon: "restaurant",
    });
  }

  // birthday_calendar: mes + días → fila informativa
  const month = (b as { month?: string }).month;
  const daysInMonth = (b as { daysInMonth?: number }).daysInMonth;
  const highlightedDay = (b as { highlightedDay?: number }).highlightedDay;
  if (month) {
    rows.push({
      text: `Día ${highlightedDay ?? "—"} de ${month.toLowerCase()}`,
      sub: daysInMonth != null ? `${daysInMonth} días del mes` : undefined,
      icon: "cake",
    });
  }

  // tags (review_quote y otros) → chips
  const tags = arr((b as { tags?: unknown }).tags).filter((t): t is string => typeof t === "string");
  const body = (b.quote ?? b.question ?? b.body ?? b.preview ?? b.prompt ?? b.description ?? (b as { headline?: string }).headline ?? b.reminder) as string | undefined;
  const banner = (b.recommendation ?? b.summary ?? b.note ?? b.suggestion ?? b.dueText ?? b.alert ?? (b as { sourceType?: string }).sourceType ?? (arr((b as { tips?: unknown }).tips)[0] as string | undefined)) as string | undefined;
  const bannerTitle = (b as { headline?: string }).headline;

  // count: progress % o done/total o eta
  let count: string | undefined;
  if (typeof b.progress === "number") count = `${Math.round(b.progress)}%`;
  else if (typeof b.progress === "string") count = b.progress;
  else if (rows.length > 0) {
    const done = rows.filter((r) => r.done).length;
    if (done > 0) count = `${done}/${rows.length}`;
  }
  if (!count && typeof (b as { eta?: string }).eta === "string") count = (b as { eta?: string }).eta;
  if (!count && b.status) count = String(b.status);
  if (!count && typeof (b as { sourceName?: string }).sourceName === "string") count = (b as { sourceName?: string }).sourceName;
  if (!count && typeof (b as { dates?: string }).dates === "string") count = (b as { dates?: string }).dates;

  const allOptions = options.length > 0 ? options : tags.slice(0, 3);
  void hero;
  return { rows, options: allOptions, body, banner, bannerTitle, count };
}

export function MichiMission(props: MichiProps) {
  const { block, hero, cta, actions, foot, isTappable, handleClick, handleKeyDown, overlay } = props;
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const [pickedOpt, setPickedOpt] = useState<number | null>(null);
  const ex = extractMission(block, hero);
  const rows = ex.rows.filter((r) => r.text).slice(0, 4);
  const total = ex.rows.filter((r) => r.text).length;
  const doneCount = rows.filter((r, i) => r.done ?? toggled[i]).length;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-card" aria-label={`Abrir ${hero.title}`} {...tapProps}>
      <div className="mc-card-hd">
        <span className={`mc-ib ${ibClass(hero.accent.color)}`}>
          <MIcon name={hero.icon} size={16} />
        </span>
        <h3>{hero.title}</h3>
        {ex.count && <span className="mc-chip">{ex.count}</span>}
      </div>

      {ex.body && (
        <p className="mc-body" style={{ margin: "0 0 8px" }}>{ex.body}</p>
      )}

      {rows.length > 0 && (
        <ul className="mc-mlist">
          {rows.map((r, i) => {
            const done = !!(r.done ?? toggled[i]);
            return (
              <li key={i} className={done ? "done" : ""}>
                <button
                  className="mc-chk"
                  type="button"
                  aria-label={done ? "desmarcar" : "marcar"}
                  aria-pressed={done}
                  onClick={(e) => { e.stopPropagation(); setToggled((t) => ({ ...t, [i]: !t[i] })); }}
                >
                  <Mat>check</Mat>
                </button>
                <span className={`mc-ib md ${["blue", "green", "pink", "gold"][i % 4]}`}>
                  {r.emoji && isEmoji(r.emoji) ? r.emoji : <MIcon name={r.icon ?? hero.icon} size={13} />}
                </span>
                <span className="mc-mi-txt">
                  {r.text}
                  {r.sub && <span className="mc-mi-sub">{r.sub}</span>}
                </span>
                {r.chip && <span className="mc-xpchip" style={{ opacity: 1, transform: "none" }}>{r.chip}</span>}
                <span className="mc-chev"><Mat>chevron_right</Mat></span>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length === 0 && hero.metrics && hero.metrics.length > 0 && (
        <div className="mc-tiles" style={{ marginTop: 6 }}>
          {hero.metrics.slice(0, 3).map((m, i) => (
            <div key={i} className="mc-tile">
              <span className="e"><Mat>{m.icon}</Mat></span>
              <span className="k">{m.label}</span>
              {m.value && <span className="v">{m.value}</span>}
            </div>
          ))}
        </div>
      )}

      {/* opciones de clarifying_question / decision — chips interactivos */}
      {ex.options.length > 0 && (
        <div className="mc-opts">
          {ex.options.slice(0, 4).map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`mc-opt${pickedOpt === i ? " on" : ""}`}
              aria-pressed={pickedOpt === i}
              onClick={(e) => { e.stopPropagation(); setPickedOpt(pickedOpt === i ? null : i); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {(ex.banner || total > 0) && (
        <div className="mc-banner">
          <span className="mc-ib md gold"><MIcon name="lightbulb" size={13} /></span>
          <div className="btxt">
            <b>{ex.bannerTitle ?? (total > 0 ? `¡Ya llevás ${doneCount} de ${total}!` : hero.title)}</b>
            {ex.banner && <span>{ex.banner}</span>}
          </div>
          <MIcon name="auto_awesome" size={16} style={{ color: "#F5A623" }} />
        </div>
      )}

      <MichiInlineActions actions={actions} />

      {foot}

      {isTappable && (
        <button
          className="mc-cta"
          type="button"
          style={{ marginTop: 10 }}
          onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          onKeyDown={handleKeyDown as unknown as React.KeyboardEventHandler<HTMLButtonElement>}
        >
          <SparkIcon />
          {cta?.label ?? "Ver el detalle completo"}
          <ArrowIcon />
        </button>
      )}
      {overlay}
    </div>
  );
}

/* ============================================================================
   CRYPTO — glass oscuro full-bleed + precio + rango + sparkline + monedas
   ============================================================================ */

export function MichiCrypto(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    // crypto_portfolio
    items?: { name?: string; symbol?: string; price?: string; value?: string; change?: number; char?: string; amount?: number }[];
    // forex
    pairs?: never; // (los forex usan items con pair/rate)
    // market
    assets?: { symbol?: string; name?: string; price?: string; change?: string; changeUp?: boolean }[];
    totalValue?: string; weekChange?: number | string; sparkline?: number[];
    alert?: string; title?: string;
  };

  // Normalizar monedas: crypto items / forex items (pair+rate) / market assets / ticker
  const rawCoins: { label: string; sub?: string; val?: string; change?: string; up?: boolean; char?: string }[] = [];
  for (const it of (b.items ?? []) as Record<string, unknown>[]) {
    rawCoins.push({
      label: String(it.symbol ?? it.pair ?? it.label ?? it.name ?? "—"),
      sub: it.name != null ? String(it.name) : undefined,
      val: it.price != null ? String(it.price) : it.rate != null ? String(it.rate) : it.value != null ? String(it.value) : undefined,
      change: it.change != null ? (typeof it.change === "number" ? `${it.change > 0 ? "+" : ""}${it.change}%`.replace(".", ",") : String(it.change)) : undefined,
      up: typeof it.change === "number" ? it.change >= 0 : typeof it.positive === "boolean" ? it.positive : undefined,
      char: it.char != null ? String(it.char) : undefined,
    });
  }
  for (const a of (b.assets ?? []) as Record<string, unknown>[]) {
    rawCoins.push({
      label: String(a.symbol ?? a.name ?? "—"),
      sub: a.name != null ? String(a.name) : undefined,
      val: a.price != null ? String(a.price) : undefined,
      change: a.change != null ? String(a.change) : undefined,
      up: typeof a.changeUp === "boolean" ? a.changeUp : undefined,
    });
  }

  const coins = rawCoins.slice(0, 3);
  const [active, setActive] = useState(0);
  const main = coins[active];
  const fmtWeek = b.weekChange != null
    ? (typeof b.weekChange === "number" ? `${b.weekChange > 0 ? "+" : ""}${b.weekChange}%`.replace(".", ",") : String(b.weekChange))
    : undefined;
  const price = main?.val ?? b.totalValue ?? hero.artValue ?? hero.metrics?.find((m) => m.value)?.value ?? hero.title;
  const change = main?.change ?? fmtWeek;
  const up = main?.up ?? (change ? !/^[−-]/.test(change) : true);
  const min = hero.metrics?.find((m) => /mín|min/i.test(m.label))?.value;
  const max = hero.metrics?.find((m) => /máx|max/i.test(m.label))?.value;

  // Sparkline SVG (puntos → path) — verde si sube, rojo si baja.
  const points = (b.sparkline ?? []).filter((n) => typeof n === "number");
  const spark = points.length >= 2 ? buildSpark(points, up ? "#7CFFB2" : "#FFB4BC") : null;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-crypto" {...tapProps}>
      {/* ---- HERO ilustrado (Stock del usuario, art-07) ---- */}
      <div className="mc-art">
        <span className="mc-gpill"><MIcon name="monitoring" size={13} /> {main?.sub ?? main?.label ?? hero.kicker}</span>
        {hero.live && <span className="mc-lchip">En vivo</span>}
        <div className="mc-hero-data">
          <span className="mc-bigval md">{price}</span>
          <span className={`mc-cr-chg${up ? " up" : " dn"}`}>
            <MIcon name={up ? "trending_up" : "trending_down"} size={11} />
            {change ?? "—"} · 24 h
          </span>
        </div>
        {spark && (
          <svg className="mc-cr-spark" viewBox="0 0 92 34" preserveAspectRatio="none">
            <path d={spark.area} fill={up ? "rgba(124,255,178,.25)" : "rgba(255,180,188,.22)"} />
            <path d={spark.line} fill="none" stroke={up ? "#7CFFB2" : "#FFB4BC"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="91" cy={spark.lastY} r="2.6" fill={up ? "#7CFFB2" : "#FFB4BC"} />
          </svg>
        )}
      </div>

      {/* ---- PANEL blanco (weather-bottom del usuario) ---- */}
      <div className="mc-kbody">
        {coins.length > 0 && (
          <div className="mc-tiles">
            {coins.map((it, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === active}
                className={`mc-tile mc-cr-tile${i === active ? " on" : ""}`}
                onClick={(e) => { e.stopPropagation(); setActive(i); }}
              >
                <span className="e mc-cr-ic">{it.char ?? it.label.slice(0, 1)}</span>
                <span className="k">{it.label}</span>
                {it.val && <span className="v">{it.val}</span>}
                {it.change && <span className={`mc-cr-trend${it.up === false ? " dn" : " up"}`}>{it.change}</span>}
              </button>
            ))}
          </div>
        )}
        {coins.length === 0 && (hero.metrics ?? []).length > 0 && (
          <div className="mc-tiles">
            {(hero.metrics ?? []).slice(0, 3).map((m, i) => (
              <div key={i} className="mc-tile">
                <span className="e">{isEmoji(m.icon) ? m.icon : <MIcon name={m.icon} size={20} />}</span>
                <span className="k">{m.label}</span>
                {m.value && <span className="v">{m.value}</span>}
              </div>
            ))}
          </div>
        )}
        {(min || max) && (
          <div className="mc-cr-range">
            <div className="bar"><i className="cur" style={{ left: "62%" }} /></div>
            <div className="lb"><span>mín {min ?? "—"}</span><span>máx {max ?? "—"}</span></div>
          </div>
        )}
        {b.alert && <p className="mc-note" style={{ margin: "2px 2px 0" }}>{b.alert}</p>}
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver el detalle"}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

function buildSpark(points: number[], _color: string): { line: string; area: string; lastY: number } {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xs = points.map((_, i) => 1 + (i / (points.length - 1)) * 90);
  const ys = points.map((p) => 26 - ((p - min) / span) * 20);
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L91 33 L1 33 Z`;
  return { line, area, lastY: ys[ys.length - 1] };
}

/* ============================================================================
   RECETA — arte nocturno + pills de ingredientes + macros + meta
   ============================================================================ */

export function MichiReceta(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    name?: string; image?: string; category?: string; rating?: string | number;
    ingredients?: (string | { name?: string; ingredient?: string; measure?: string })[]; nutrition?: { protein?: string; carbs?: string; fat?: string; calories?: string };
    prepTime?: string; cookTime?: string; servings?: string | number; steps?: unknown[];
    description?: string; difficulty?: string;
  };

  const img = b.image ?? blockImage(block);
  const isRestaurant = block.type === "restaurant_synthesis";
  const rb = block as { query?: string; mood?: string; matches?: { name?: string; rating?: number; distanceFromUser?: string; menuHighlights?: { dish?: string; price?: string }[]; photos?: string[] }[] };
  // ingredientes: string[] o {ingredient, measure}[] → "200 g spaghetti"
  const ingredients = isRestaurant
    ? (rb.matches ?? []).slice(0, 4).map((m) => m.name ?? "").filter(Boolean)
    : (b.ingredients ?? []).slice(0, 4).map((ing) => {
        if (typeof ing === "string") return ing;
        const o = ing as { ingredient?: string; measure?: string };
        return [o.measure, o.ingredient].filter(Boolean).join(" ");
      }).filter(Boolean);
  const nut = b.nutrition;
  const macros = [
    { label: "Prot", v: nut?.protein, c: "#2FC86E" },
    { label: "Carb", v: nut?.carbs, c: "#FDC533" },
    { label: "Gras", v: nut?.fat, c: "#FF9EBE" },
  ].filter((m) => m.v);
  const totalMac = macros.reduce((s, m) => s + (parseFloat(String(m.v)) || 0), 0) || 1;
  const restRating = rb.matches?.[0]?.rating;
  const rating = isRestaurant ? restRating : b.rating;
  const stars = rating ? Math.round((parseFloat(String(rating)) / 2) || 4) : 4;
  const restNote = isRestaurant
    ? [rb.matches?.[0]?.distanceFromUser, rb.matches?.[0]?.menuHighlights?.map((mh) => `${mh.dish} ${mh.price}`).join(" · "), rb.query ? `buscaste: ${rb.query}` : undefined].filter(Boolean).join(" · ")
    : undefined;
  const heroImg = isRestaurant ? (rb.matches?.[0]?.photos?.[0] ?? img) : img;
  // tiempo total honesto: "15 + 10 min"
  const timeParts = isRestaurant ? [] : [b.prepTime, b.cookTime].filter(Boolean);
  const timeLabel = timeParts.length > 0 ? `${timeParts.join(" + ")} min` : undefined;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-receta" {...tapProps}>
      <div className="mc-art" style={{ backgroundImage: heroImg ? `url(${heroImg})` : "var(--mc-hero-receta)", backgroundPosition: "center 38%" }}>
        <span className="mc-gpill"><MIcon name="restaurant" size={13} /> {isRestaurant ? (rb.mood ?? b.category ?? hero.kicker) : (b.category ?? hero.kicker)}</span>
      </div>
      <div className="mc-re-body">
        <div className="mc-re-hd">
          <h4>{b.name ?? hero.title}</h4>
          {rating && (
            <div className="mc-re-stars">
              {[0, 1, 2, 3, 4].map((i) => (
                <Mat key={i} className={i < stars ? "" : "dim"}>star</Mat>
              ))}
              <b>{String(rating)}</b>
            </div>
          )}
        </div>
        {(b.description ?? restNote) && <p className="mc-note" style={{ margin: "4px 2px 0" }}>{b.description ?? restNote}</p>}
        {ingredients.length > 0 && (
          <div className="mc-re-pills">
            {ingredients.map((ing, i) => (
              <span key={i} className="mc-re-pill" style={{ ["--c" as string]: ["#E8834F", "#E64D57", "#7CA84D", "#B48A4A"][i % 4] } as CSSProperties}>
                <span className="dot" />{ing}
              </span>
            ))}
          </div>
        )}
        {macros.length > 0 && (
          <div className="mc-re-macros">
            <div className="mbar">
              {macros.map((m, i) => (
                <i key={i} style={{ width: `${((parseFloat(String(m.v)) || 0) / totalMac) * 100}%`, background: m.c }} />
              ))}
            </div>
            <div className="leg">
              {macros.map((m, i) => (
                <span key={i} className="lg"><i style={{ background: m.c }} />{m.label} <b>{m.v}</b></span>
              ))}
            </div>
          </div>
        )}
        <div className="mc-re-meta">
          {timeLabel && (
            <span className="m"><MIcon name="schedule" size={13} style={{ color: "#7982B4" }} /><b>{timeLabel}</b></span>
          )}
          {nut?.calories && <span className="m"><Mat>local_fire_department</Mat><b>{nut.calories}</b></span>}
          {b.steps && <span className="m"><Mat>checklist</Mat><b>{b.steps.length} pasos</b></span>}
          {b.servings && <span className="m"><Mat>restaurant</Mat><b>{b.servings} porciones</b></span>}
        </div>
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver la receta paso a paso"}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   FIT — arte izq + anillo de progreso + lista + semana
   ============================================================================ */

export function MichiFit(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    // exercise_plan: plan es UN objeto con sessions[] (cada una con exercises[])
    plan?: { name?: string; weeksTotal?: number; currentSessionIdx?: number; sessions?: { dayLabel?: string; exercises?: { exercise?: string; sets?: number; reps?: number; weight?: number }[] }[] } | { name?: string; durationMin?: number; exercises?: { name?: string; duration?: string; reps?: string }[] }[];
    workoutLogs?: { date?: string; done?: boolean }[];
    progress?: string;
  };

  // Normalizar: plan.sessions[] (formato real) o plan[] (array directo)
  const planFull = b.plan as
    | { name?: string; weeksTotal?: number; currentSessionIdx?: number; sessions?: { dayLabel?: string; exercises?: { exercise?: string; sets?: number; reps?: number; weight?: number }[] }[] }
    | undefined;
  const sessions = planFull?.sessions ?? (Array.isArray(b.plan) ? (b.plan as { exercises?: { name?: string; duration?: string; reps?: string }[] }[]) : []);
  const exercises = sessions
    .flatMap((s) => (s.exercises ?? []).slice(0, 3).map((e) => {
      const ex = e as { exercise?: string; sets?: number; reps?: number; weight?: number; name?: string; duration?: string };
      return {
        name: ex.exercise ?? ex.name,
        reps: ex.reps != null ? `${ex.sets != null ? `${ex.sets}×` : ""}${ex.reps}${ex.weight != null ? ` · ${ex.weight}kg` : ""}` : ex.duration,
      };
    }))
    .slice(0, 4);
  const dayLabels = sessions.slice(0, 3).map((s) => s.dayLabel).filter(Boolean) as string[];
  const prog = b.progress ?? (planFull?.weeksTotal != null ? `${planFull.currentSessionIdx ?? 0}/${planFull.sessions?.length ?? 0}` : undefined);
  const pct = prog
    ? (() => { const [c, t] = prog.split("/").map((n) => parseInt(n, 10)); return t > 0 ? Math.min((c || 0) / t, 1) : 0.65; })()
    : 0.65;
  // duración: sumar restSec de ejercicios, o 28' por defecto
  const totalMin = Math.max(
    1,
    Math.round(
      sessions
        .flatMap((s) => s.exercises ?? [])
        .reduce((sum, e) => sum + (((e as { restSec?: number }).restSec ?? 0) / 60), 0),
    ),
  ) || 28;
  const doneMin = Math.round(totalMin * pct);

  // semana: workoutLogs (7 días) o decorativa
  const week = (b.workoutLogs ?? []).slice(-7);
  const bars = week.length === 7
    ? week.map((w) => (w.done ? 13 : 9))
    : [9, 14, 11, 16, 12, 8, 13];
  const days = ["L", "M", "X", "J", "V", "S", "D"];

  const R = 26.5;
  const CIRC = 2 * Math.PI * R;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-fit" {...tapProps}>
      {/* ---- HERO ilustrado (Fitness del usuario, art-00) ---- */}
      <div className="mc-art">
        <span className="mc-gpill"><MIcon name="favorite" size={13} /> {hero.title}</span>
        {prog && (
          <span className="mc-lchip up"><MIcon name="local_fire_department" size={10} />{prog}</span>
        )}
        <div className="mc-hero-data">
          <span className="mc-bigval md">{doneMin ? `${doneMin}'` : "—"}</span>
          <span className="mc-bigsub">de {totalMin} min · {dayLabels[0] ?? "rutina"}</span>
          {dayLabels.length > 1 && <span className="mc-bigmin">+{dayLabels.length - 1} sesiones esta semana</span>}
        </div>
      </div>

      {/* ---- PANEL blanco (weather-bottom del usuario) ---- */}
      <div className="mc-kbody">
        <div className="mc-fi-main">
          <div className="mc-fi-ring">
            <svg viewBox="0 0 64 64">
              <defs>
                <linearGradient id="mc-rg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#8B6DFF" /><stop offset="1" stopColor="#2E7CF6" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r={R} fill="none" stroke="#E4EDF8" strokeWidth="7.5" />
              <circle cx="32" cy="32" r={R} fill="none" stroke="url(#mc-rg)" strokeWidth="7.5"
                strokeLinecap="round" strokeDasharray={`${(CIRC * pct).toFixed(0)} ${CIRC.toFixed(0)}`} />
            </svg>
            <div className="rt"><b>{doneMin ? `${doneMin}'` : "—"}</b><span>de {totalMin} min</span></div>
          </div>
          <div className="mc-fi-list">
            {(exercises.length > 0 ? exercises : hero.metrics?.slice(0, 4).map((m) => ({ name: m.label, reps: m.value })) ?? []).map((it, i) => (
              <div key={i} className="mc-fi-it">
                <span className={`mc-ib md ${["blue", "vio", "green", "gold"][i % 4]}`} style={{ width: 20, height: 20, borderRadius: 7.5 }}>
                  <Mat>{["bolt", "fitness_center", "timer", "auto_awesome"][i % 4]}</Mat>
                </span>
                <span><b>{it.name ?? it.reps}</b>{it.reps ? ` · ${it.reps}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mc-fi-week">
          {days.map((d, i) => (
            <span key={i} className={`wb${i === 6 ? " on" : ""}`}>
              <i className="bar" style={{ height: bars[i] }} />
              <span className="lb">{d}</span>
            </span>
          ))}
        </div>
        <button
          className="mc-cta ok"
          type="button"
          onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
        >
          <MIcon name="play_arrow" size={13} />
          {cta?.label ?? "Empezar rutina"}
        </button>
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   GAME — horizontal oscuro + arte lateral (películas / juegos / reviews)
   ============================================================================ */

export function MichiGame(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    poster?: string; cover?: string; genres?: string[]; genre?: string; runtime?: string; releaseDate?: string;
    rating?: string | number; ratings?: { source?: string; score?: string | number }[];
    overview?: string; synopsis?: string; whereToWatch?: { provider?: string }[];
    author?: string; director?: string; publisher?: string; year?: string; pages?: string | number;
  };

  const img = b.poster ?? b.cover ?? blockImage(block);
  const genre = (b.genres ?? [b.genre].filter(Boolean) as string[]).slice(0, 2).join(" · ");
  const meta = b.ratings?.find((r) => /meta|imdb|rotten|letterboxd|critics/i.test(r.source ?? ""))?.score;
  const ratingNum = parseFloat(String(b.rating ?? "4.5")) || 4.5;
  const stars = Math.max(1, Math.min(5, Math.round(ratingNum / 2)));
  const chips = [
    b.runtime,
    b.releaseDate?.slice(0, 4) ?? b.year,
    b.whereToWatch?.[0]?.provider,
    b.pages != null ? `${b.pages} páginas` : undefined,
    b.publisher,
  ].filter(Boolean) as string[];
  const byline = b.author ?? b.director;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-game" {...tapProps}>
      {/* ---- HERO ilustrado (Inform del usuario, art-01; poster real si existe) ---- */}
      <div className="mc-art" style={img ? { backgroundImage: `url(${img})`, backgroundSize: "cover" } : undefined}>
        <span className="mc-gpill"><MIcon name="movie" size={13} /> {hero.kicker}</span>
        {meta != null && <span className="mc-lchip">meta {String(meta).slice(0, 3)}</span>}
        <div className="mc-hero-data">
          <span className="mc-bigval md">{b.rating ?? "4,5"}</span>
          <span className="mc-bigsub">{hero.title}</span>
          {(byline || genre) && <span className="mc-bigmin">{[byline, genre].filter(Boolean).join(" · ")}</span>}
        </div>
      </div>

      {/* ---- PANEL blanco (weather-bottom del usuario) ---- */}
      <div className="mc-kbody">
        <div className="mc-ga-stars">
          {[0, 1, 2, 3, 4].map((i) => (
            <Mat key={i} className={i < stars ? "" : "dim"}>star</Mat>
          ))}
          <b>{b.rating ?? "4,5"}</b>
          {b.ratings && <span className="ga-meta">· {b.ratings.length} fuentes</span>}
        </div>
        {(b.overview ?? (b as { synopsis?: string }).synopsis) && (
          <p className="mc-note" style={{ margin: "2px 2px 0" }}>
            “{String(b.overview ?? (b as { synopsis?: string }).synopsis).slice(0, 110)}{String(b.overview ?? (b as { synopsis?: string }).synopsis).length > 110 ? "…" : ""}”
          </p>
        )}
        {chips.length > 0 && (
          <div className="mc-ga-chips">
            {chips.slice(0, 3).map((c, i) => <span key={i} className="mc-ga-chip">{c}</span>)}
          </div>
        )}
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver trailer y reseña"}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   SHOP — arte + filas de ofertas/items + ahorro + CTA
   ============================================================================ */

export function MichiShop(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    // shopping_list: items es string[] + quantities map + checked array
    items?: (string | { name?: string; label?: string; text?: string; quantities?: string; qty?: string; checked?: boolean; price?: string; oldPrice?: string; emoji?: string })[];
    quantities?: Record<string, number>;
    checked?: string[];
    note?: string; dueText?: string; progress?: string;
  };
  const items = (b.items ?? []).slice(0, 3).map((raw) => {
    if (typeof raw === "string") {
      return {
        name: raw,
        qty: b.quantities?.[raw] != null ? `×${b.quantities[raw]}` : undefined,
        checked: (b.checked ?? []).includes(raw),
        emoji: undefined as string | undefined,
        old: undefined as string | undefined,
      };
    }
    const it = raw as { name?: string; label?: string; text?: string; quantities?: string; qty?: string; checked?: boolean; price?: string; oldPrice?: string; emoji?: string };
    return {
      name: it.name ?? it.label ?? it.text,
      qty: it.quantities ?? it.qty ?? it.price,
      old: it.oldPrice,
      checked: it.checked,
      emoji: it.emoji,
    };
  });
  const checkedCount = (b.checked ?? []).length;
  const total = (b.items ?? []).length;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-shop" aria-label={`Abrir ${hero.title}`} {...tapProps}>
      <div className="mc-art" style={{ backgroundImage: "var(--mc-hero-compras)" }}>
        <span className="mc-gpill"><MIcon name="shopping_bag" size={13} /> {hero.kicker}</span>
      </div>
      <div className="mc-sh-body">
        <h4 style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 900, color: "#1E1B4B", fontFamily: "inherit" }}>
          {hero.title}{total > 0 ? ` · ${total} ítems` : ""}
        </h4>
        {items.map((it, i) => (
          <div key={i} className="mc-sh-row" style={it.checked ? { opacity: 0.45 } : undefined}>
            <span className="mc-sh-thumb" style={{ background: ["linear-gradient(160deg,#5FB0FF,#2E7CF6)", "linear-gradient(160deg,#FF9EBE,#F65E9B)", "linear-gradient(160deg,#FFD75E,#F0A11C)"][i % 3] }}>
              {it.emoji ?? ["👟", "🧥", "🎧", "📦"][i % 4]}
            </span>
            <div className="mc-sh-nm">
              <b>{it.name ?? "—"}</b>
              {it.old && <s>{it.old}</s>}
            </div>
            {it.qty && <span className="mc-sh-new">{it.qty}</span>}
            {it.checked && <span className="mc-sh-off">✓</span>}
          </div>
        ))}
        {(b.note || total > 0) && (
          <div className="mc-sh-save">
            <MIcon name="check_circle" size={12} />
            {b.note ?? `Ya tienes ${checkedCount} de ${total} listos`}{b.dueText ? ` · ${b.dueText}` : ""}
          </div>
        )}
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? `Ver ${total > 0 ? `los ${total} ítems` : "la lista"}`}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   SLEEP — nocturna con arte fundido + fases + stats
   ============================================================================ */

export function MichiSleep(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const [tookAction, setTookAction] = useState(false);
  const b = block as {
    bedtime?: string; wakeTime?: string; note?: string; advice?: string; reminder?: string;
    actionLabel?: string; icon?: string;
    phases?: { label?: string; duration?: string; pct?: number; color?: string }[];
    stats?: { label?: string; value?: string }[];
    sections?: { title?: string; items?: string[] }[];
    suggestion?: string;
  };
  const chip = b.bedtime ?? hero.artValue ?? hero.metrics?.[0]?.value;
  const phases = (b.phases ?? []).slice(0, 4);
  const fases = phases.length > 0 ? phases : [
    { label: "prof", duration: "1h45", pct: 24, color: "#8B6DFF" },
    { label: "REM", duration: "1h35", pct: 22, color: "#5FB0FF" },
    { label: "ligero", duration: "3h30", pct: 48, color: "#28377E" },
    { label: "despierto", duration: "22m", pct: 6, color: "rgba(255,255,255,.35)" },
  ];
  const sectionStats = (b.sections ?? []).slice(0, 2).map((sec, i) => ({
    label: sec.title,
    value: (sec.items ?? []).slice(0, 2).join(" · ") || undefined,
    _i: i,
  })).filter((x) => x.label);
  const stats = (b.stats ?? hero.metrics?.slice(0, 2).map((m) => ({ label: m.label, value: m.value })) ?? sectionStats as { label?: string; value?: string }[]).filter((x) => x.label || x.value);

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-sleep" {...tapProps}>
      {/* ---- HERO ilustrado (Sleep del usuario, art-05) ---- */}
      <div className="mc-art">
        <span className="mc-gpill"><MIcon name="bedtime" size={13} /> {hero.title}</span>
        {chip && <span className="mc-lchip">{chip}</span>}
        <div className="mc-hero-data">
          <span className="mc-bigval md">{chip ?? "🌙"}</span>
          <span className="mc-bigsub">{hero.desc ?? b.reminder ?? b.note ?? b.advice ?? b.suggestion ?? "Dormí bien — mañana seguimos"}</span>
        </div>
        <span className="mc-sl-moon"><MIcon name="bedtime" size={17} style={{ color: "#8C6A1D" }} /></span>
      </div>

      {/* ---- PANEL blanco (weather-bottom del usuario) ---- */}
      <div className="mc-kbody">
        <div className="mc-sl-fases">
          <div className="fl"><span>Fases de anoche</span><b>7h 12</b></div>
          <div className="fb">
            {fases.map((f, i) => (
              <i key={i} style={{ width: `${f.pct ?? 25}%`, background: f.color ?? "#8B6DFF" }} />
            ))}
          </div>
          <div className="cap">
            {fases.slice(0, 3).map((f, i) => (
              <i key={i}><span className="d" style={{ background: f.color ?? "#8B6DFF" }} />{f.label} {f.duration}</i>
            ))}
          </div>
        </div>
        {stats.length > 0 && (
          <div className="mc-sl-stats">
            {stats.slice(0, 2).map((s, i) => (
              <div key={i} className="mc-sl-stat"><b>{s.value ?? "—"}</b><span>{s.label}</span></div>
            ))}
          </div>
        )}
        {b.actionLabel && (
          <button
            className="mc-cta ok"
            type="button"
            aria-pressed={tookAction}
            onClick={(e) => { e.stopPropagation(); setTookAction((t) => !t); }}
          >
            <SparkIcon />
            {tookAction ? "¡Listo! ✓" : b.actionLabel}
          </button>
        )}
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver el detalle"}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   FOCUS — full-bleed arte + panel frosted con timer (generación en curso)
   ============================================================================ */

export function MichiFocus(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as { note?: string; progress?: string; label?: string; phase?: string };
  const [elapsed] = useState(0);
  void elapsed;
  const prog = b.progress ?? "1/2";
  const [c, t] = prog.split("/").map((n) => parseInt(n, 10));
  const pct = t > 0 ? Math.min((c || 1) / t, 1) : 0.5;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-focus" {...tapProps}>
      <div className="mc-fbg" />
      <div className="mc-ftint" />
      <span className="mc-gpill"><SparkIcon /> {hero.kicker}</span>
      <div className="mc-fo-glass">
        <div className="mc-fo-row">
          <span className="mc-ib md" style={{ background: "rgba(255,255,255,.3)" }}><Mat>laptop_mac</Mat></span>
          <span className="tt">{hero.title}</span>
          <span className="ts">Sesión {prog}</span>
        </div>
        <div className="mc-fo-time">
          <span className="t">{hero.artValue ?? "50:00"}</span>
          <span className="tk">{hero.desc ?? b.note ?? "mientras suena tu playlist"}</span>
        </div>
        <div className="mc-fo-prog">
          <i style={{ width: `${pct * 100}%` }} />
          <b style={{ left: `calc(${pct * 100}% - 4.5px)` }} />
        </div>
        <div className="mc-fo-foot">
          <span className="mc-fo-task">{b.label ?? b.phase ?? hero.title}</span>
          {isTappable && (
            <button
              className="mc-cta"
              type="button"
              style={{ width: "auto", padding: "6px 14px 7px", margin: 0, marginTop: 0, flex: "none", fontSize: 10.5 }}
              onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
            >
              {cta?.label ?? "Ver progreso"}
              <ArrowIcon />
            </button>
          )}
        </div>
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   FUTBOL — art + scoreboard broadcast (escudos reales + goles + posesión)
   🔴 FIX PLACEHOLDERS — tres variantes reales:
   1) match_timeline CON items → card de FIXTURE (lista de próximos partidos,
      NO un scoreboard "Local 0-0 Visitante").
   2) match_timeline sin items pero con teamInfo → card de EQUIPO (nombre,
      estadio, liga, descripción — sin marcador fantasma).
   3) live_match programado (state "pre") → muestra la HORA del partido en
      vez de un "0-0" inventado.
   ============================================================================ */

export function MichiFutbol(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    homeName?: string; awayName?: string; homeScore?: number; awayScore?: number;
    homeTeam?: { name?: string; score?: number; color?: string }; awayTeam?: { name?: string; score?: number; color?: string };
    homeLogo?: string; awayLogo?: string; homeColor?: string; awayColor?: string;
    league?: string; status?: string; state?: string; minute?: string; time?: string; date?: string;
    goals?: { scorer?: string; text?: string; minute?: string; photo?: string }[];
    detailedStats?: { label?: string; home?: number; away?: number; leftPercent?: number; rightPercent?: number }[];
    stats?: { label?: string; home?: number; away?: number; leftPercent?: number; rightPercent?: number }[];
    // match_timeline
    title?: string;
    items?: { minute?: string; text?: string; sub?: string; active?: boolean; homeLogo?: string; awayLogo?: string; homeTeam?: string; awayTeam?: string }[];
    teamInfo?: { name?: string; stadium?: string; location?: string; league?: string; description?: string };
    nextMatch?: { match?: string; homeTeam?: string; awayTeam?: string; date?: string; time?: string; league?: string; homeLogo?: string; awayLogo?: string; homeAbbrev?: string; awayAbbrev?: string; homeColor?: string; awayColor?: string };
    wikipediaExtract?: string;
    upcoming?: { homeTeam?: string; awayTeam?: string; date?: string; time?: string; league?: string; homeLogo?: string; awayLogo?: string; homeAbbrev?: string; awayAbbrev?: string }[];
  };

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  // ── VARIANTE FIXTURE (match_timeline con partidos) ────────────────────────
  const fixtureItems = (b.items ?? []).filter((it) => it.text);
  // 🔴 Mini card "otros resultados": los items son PASADOS, no próximos —
  // el chip no debe mentir ("2 PRÓXIMOS" sobre resultados ya jugados).
  const isResultsList = /otros resultados/i.test(b.title ?? "");
  if (fixtureItems.length > 0) {
    const next = b.nextMatch;
    const firstText = fixtureItems[0]?.text ?? "";
    const firstDate = fixtureItems[0]?.minute ?? "";
    return (
      <div className="mc-kcard mc-c-futbol" {...tapProps}>
        <div className="mc-art">
          <span className="mc-gpill"><MIcon name="event" size={13} /> {b.teamInfo?.league ?? next?.league ?? hero.kicker}</span>
        </div>
        <div className="mc-fu-body">
          <div className="mc-fu-league">
            <span className="mc-ib red"><MIcon name="calendar_month" size={13} /></span>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: "inherit", fontFamily: "inherit" }}>
              {b.teamInfo?.name ?? b.title ?? next?.league ?? "Próximos partidos"}
            </h4>
            <span className="st">{isResultsList ? `${fixtureItems.length} JUGADOS` : `${fixtureItems.length} PRÓXIMOS`}</span>
          </div>
          {next && !isResultsList && (next.homeTeam || next.awayTeam) ? (
            <div className="mc-fu-score">
              <div className="mc-fu-team">
                <div className="mc-crest" style={{ background: next.homeLogo ? "#F5F7FC" : next.homeColor ? `${next.homeColor}1A` : undefined }}>
                  {next.homeLogo ? (
                    <img src={next.homeLogo} alt={next.homeTeam ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }} loading="lazy" />
                  ) : (
                    <span className="nm" style={{ fontSize: 12, fontWeight: 900, color: "#1A237E" }}>{(next.homeTeam ?? "—").slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <span className="nm">{next.homeTeam ?? "—"}</span>
              </div>
              <div className="mc-fu-mid">
                <span className="mc-fu-num" style={{ fontSize: 18 }}>{next.time ?? firstDate}</span>
                <span className="mc-fu-st">{firstDate || "PRÓXIMO"}</span>
              </div>
              <div className="mc-fu-team">
                <div className="mc-crest" style={{ background: next.awayLogo ? "#F5F7FC" : next.awayColor ? `${next.awayColor}1A` : undefined }}>
                  {next.awayLogo ? (
                    <img src={next.awayLogo} alt={next.awayTeam ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }} loading="lazy" />
                  ) : (
                    <span className="nm" style={{ fontSize: 12, fontWeight: 900, color: "#1A237E" }}>{(next.awayTeam ?? "—").slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <span className="nm">{next.awayTeam ?? "—"}</span>
              </div>
            </div>
          ) : (
            <div className="mc-fu-league" style={{ marginBottom: 2 }}>
              <span className="st" style={{ background: "#EEF2FF", color: "#1D3FA8" }}>{firstText || "Fixture"}</span>
            </div>
          )}
          {fixtureItems.slice(0, 3).map((it, i) => (
            <div key={`fx_${i}`} className="mc-fu-pos">
              <span className="lb" style={{ minWidth: 42 }}>{it.minute ?? "—"}</span>
              {(it as any).homeLogo || (it as any).awayLogo ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  {(it as any).homeLogo ? (
                    <img src={(it as any).homeLogo} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} loading="lazy" />
                  ) : null}
                  {(it as any).awayLogo ? (
                    <img src={(it as any).awayLogo} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} loading="lazy" />
                  ) : null}
                </span>
              ) : null}
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#1E1B4B", flex: 1, lineHeight: 1.35 }}>{it.text}</span>
              {it.sub ? <span style={{ fontSize: 9, fontWeight: 700, color: "#6E7594", maxWidth: 96, textAlign: "right", lineHeight: 1.3 }}>{it.sub}</span> : null}
            </div>
          ))}
          {b.teamInfo?.description && (
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: "#6E7594", lineHeight: 1.5 }}>
              {b.teamInfo.description.slice(0, 110)}{b.teamInfo.description.length > 110 ? "…" : ""}
            </p>
          )}
          {isTappable && (
            <button className="mc-cta" type="button" onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}>
              <SparkIcon />
              {cta?.label ?? "Ver fixture"}
              <ArrowIcon />
            </button>
          )}
        </div>
        {overlay}
      </div>
    );
  }

  // ── VARIANTE EQUIPO (sin partidos: info del equipo) ───────────────────────
  if (!b.homeName && !b.homeTeam?.name && !b.nextMatch?.homeTeam && (b.teamInfo || b.wikipediaExtract)) {
    const info = b.teamInfo;
    return (
      <div className="mc-kcard mc-c-futbol" {...tapProps}>
        <div className="mc-art">
          <span className="mc-gpill"><MIcon name="shield" size={13} /> {info?.league ?? "Info del equipo"}</span>
        </div>
        <div className="mc-fu-body">
          <div className="mc-fu-league">
            <span className="mc-ib red"><MIcon name="shield" size={13} /></span>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: "inherit", fontFamily: "inherit" }}>
              {info?.name ?? b.title ?? "Equipo"}
            </h4>
            <span className="st">EQUIPO</span>
          </div>
          {[
            info?.stadium ? { icon: "stadium", label: "Estadio", value: info.stadium } : null,
            info?.location ? { icon: "location_on", label: "Sede", value: info.location } : null,
            info?.league ? { icon: "emoji_events", label: "Liga", value: info.league } : null,
          ].filter(Boolean).map((row: any) => (
            <div key={row.label} className="mc-fu-pos">
              <span className="lb" style={{ minWidth: 52 }}>{row.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#1E1B4B" }}>{row.value}</span>
            </div>
          ))}
          {(b.wikipediaExtract ?? info?.description) && (
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: "#6E7594", lineHeight: 1.5 }}>
              {(b.wikipediaExtract ?? info?.description ?? "").slice(0, 130)}{(b.wikipediaExtract ?? info?.description ?? "").length > 130 ? "…" : ""}
            </p>
          )}
          {isTappable && (
            <button className="mc-cta" type="button" onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}>
              <SparkIcon />
              {cta?.label ?? "Ver detalle"}
              <ArrowIcon />
            </button>
          )}
        </div>
        {overlay}
      </div>
    );
  }

  // ── VARIANTE PARTIDO (live_match: en vivo / final / programado) ───────────
  const isFuture = !b.homeName && !b.homeTeam?.name && !!b.nextMatch?.homeTeam;
  const isPre = b.state === "pre" || /scheduled|not started|pr[óo]xim|upcoming/i.test(String(b.status ?? ""));
  const homeName = (isFuture ? b.nextMatch?.homeTeam : (b.homeName ?? b.homeTeam?.name ?? "Local"))?.toString() ?? "Local";
  const awayName = (isFuture ? b.nextMatch?.awayTeam : (b.awayName ?? b.awayTeam?.name ?? "Visitante"))?.toString() ?? "Visitante";
  const matchTime = isFuture ? b.nextMatch?.time : (b.time ?? b.minute);
  const homeScore = b.homeScore ?? b.homeTeam?.score ?? 0;
  const awayScore = b.awayScore ?? b.awayTeam?.score ?? 0;
  const goals = (b.goals ?? []).slice(0, 2);
  const possessionStat = (b.detailedStats?.find((s) => s.label === "Posesión") ?? b.stats?.find((s) => s.label === "Posesión"));
  const homePoss = possessionStat ? Math.round(possessionStat.home ?? possessionStat.leftPercent ?? 50) : 50;
  const kickoffLabel = matchTime ?? (b.date ? b.date.slice(0, 10) : undefined);

  return (
    <div className="mc-kcard mc-c-futbol" {...tapProps}>
      <div className="mc-art">
        <span className="mc-gpill"><MIcon name="sports_soccer" size={13} /> {b.league ?? b.teamInfo?.league ?? b.nextMatch?.league ?? hero.kicker}</span>
        {hero.live && <span className="mc-lchip">{b.minute ? `${b.minute}'` : "En vivo"}</span>}
      </div>
      <div className="mc-fu-body">
        <div className="mc-fu-league">
          <span className="mc-ib red"><MIcon name="sports_soccer" size={13} /></span>
          <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: "inherit", fontFamily: "inherit" }}>
            {b.league ?? b.teamInfo?.league ?? b.nextMatch?.league ?? "PARTIDO"}
          </h4>
          <span className="st">{b.status ?? (hero.live ? "EN JUEGO" : isFuture || isPre ? "PRÓXIMO" : "FINAL")}</span>
        </div>
        <div className="mc-fu-score">
          <div className="mc-fu-team">
            <div className="mc-crest" style={{ background: b.homeLogo ? "#F5F7FC" : undefined }}>
              {b.homeLogo ? <img src={b.homeLogo} alt={homeName} loading="lazy" /> : <span className="nm" style={{ fontSize: 12, fontWeight: 900, color: "#1A237E" }}>{homeName.slice(0, 2).toUpperCase()}</span>}
            </div>
            <span className="nm">{homeName}</span>
          </div>
          <div className="mc-fu-mid">
            {isFuture || isPre ? (
              <>
                <span className="mc-fu-num" style={{ fontSize: 18 }}>{kickoffLabel ?? "—"}</span>
                <span className="mc-fu-st">PRÓXIMO</span>
              </>
            ) : (
              <>
                <span className="mc-fu-num">{homeScore}-{awayScore}</span>
                <span className="mc-fu-st">{b.status ?? (hero.live ? "EN JUEGO" : "FINAL")}</span>
              </>
            )}
          </div>
          <div className="mc-fu-team">
            <div className="mc-crest" style={{ background: b.awayLogo ? "#F5F7FC" : undefined }}>
              {b.awayLogo ? <img src={b.awayLogo} alt={awayName} loading="lazy" /> : <span className="nm" style={{ fontSize: 12, fontWeight: 900, color: "#1A237E" }}>{awayName.slice(0, 2).toUpperCase()}</span>}
            </div>
            <span className="nm">{awayName}</span>
          </div>
        </div>
        {goals.length > 0 && (
          <div style={{ display: "flex", gap: 5 }}>
            {goals.map((g, i) => (
              <div key={i} className="mc-fi-it" style={{ background: "#F7F9FE", borderRadius: 12, padding: "5px 7px" }}>
                <span className="mc-ib md gold" style={{ width: 20, height: 20, borderRadius: 7.5 }}><Mat>soccer</Mat>⚽</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#1E1B4B" }}>
                  {g.scorer ?? g.text ?? "Gol"}{g.minute ? ` · ${g.minute}'` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* 🔴 FIX STATS FABRICADAS — valores absolutos reales (24·4), no
            porcentajes disfrazados; sin stats no se inventa la fila. */}
        {(b.detailedStats ?? b.stats ?? []).filter((st) => st.label !== "Posesión").slice(0, 2).map((st, i) => (
          <div key={`st_${i}`} className="mc-fu-pos">
            <span className="lb" style={{ minWidth: 56 }}>{st.label}</span>
            <div style={{ display: "flex", gap: 4, fontSize: 9.5, fontWeight: 900, color: "#1E1B4B" }}>
              <span style={{ color: "#1D3FA8" }}>{st.home ?? st.leftPercent ?? "—"}</span>
              <span style={{ color: "#8A93C2" }}>·</span>
              <span style={{ color: "#A50044" }}>{st.away ?? st.rightPercent ?? "—"}</span>
            </div>
          </div>
        ))}
        {possessionStat && (possessionStat.home != null || possessionStat.leftPercent != null) && (
          <div className="mc-fu-pos">
            <span className="lb">Posesión</span>
            <div className="mc-fu-duel">
              <i className="l" style={{ width: `${homePoss}%` }} />
              <i className="r" style={{ width: `${100 - homePoss}%` }} />
            </div>
            <span className="lb" style={{ color: "#1D3FA8" }}>{homePoss}%</span>
          </div>
        )}
        {b.upcoming && b.upcoming.length > 0 && (
          <div className="mc-fu-pos">
            <span className="lb" style={{ minWidth: 52 }}>Próximo</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#1E1B4B", flex: 1 }}>
              {b.upcoming[0].homeTeam} vs {b.upcoming[0].awayTeam}
              {b.upcoming[0].time ? ` · ${b.upcoming[0].time}` : ""}
            </span>
          </div>
        )}
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver el partido"}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   TENIS — horizontal: datos + arte lateral
   ============================================================================ */

export function MichiTenis(props: MichiProps) {
  const { block, hero, cta, isTappable, handleClick, handleKeyDown, overlay } = props;
  const b = block as {
    players?: { home?: { name?: string; logo?: string; country?: string; rank?: number }; away?: { name?: string; logo?: string; country?: string; rank?: number } };
    sets?: { winner?: string; homeGames?: number; awayGames?: number }[];
    currentSet?: { gamesHome?: number; gamesAway?: number };
    currentPoint?: string;
    tournament?: string | { name?: string; round?: string; surface?: string }; status?: string; time?: string; venue?: string;
    h2h?: string | { record?: string; summary?: string };
  };
  const h2hLabel = typeof b.h2h === "string" ? b.h2h : b.h2h?.record;
  const h2hSummary = typeof b.h2h === "string" ? undefined : b.h2h?.summary;

  const home = b.players?.home;
  const away = b.players?.away;
  const homeSets = (b.sets ?? []).filter((s) => s.winner === "home").length;
  const awaySets = (b.sets ?? []).filter((s) => s.winner === "away").length;
  const tourLabel = typeof b.tournament === "string"
    ? b.tournament
    : [b.tournament?.name, b.tournament?.round].filter(Boolean).join(" · ");
  const setsScore = (b.sets ?? []).map((s) => `${s.homeGames ?? 0}–${s.awayGames ?? 0}`).join("  ");
  const totalSets = homeSets + awaySets || 2;
  const homePct = Math.round((homeSets / totalSets) * 100) || 50;

  const tapProps = isTappable
    ? { onClick: handleClick, onKeyDown: handleKeyDown, role: "button" as const, tabIndex: 0 }
    : {};

  return (
    <div className="mc-kcard mc-c-tenis" {...tapProps}>
      {/* ---- HERO ilustrado (Tenis del usuario, art-08) ---- */}
      <div className="mc-art">
        <span className="mc-gpill"><MIcon name="sports_tennis" size={13} /> {tourLabel || hero.kicker}</span>
        {b.currentPoint && <span className="mc-lchip">{b.currentPoint}</span>}
        <div className="mc-hero-data">
          <span className="mc-bigval md">{h2hLabel ?? `${homeSets}–${awaySets}`}</span>
          <span className="mc-bigsub">{home?.name ?? "Local"} <em>vs</em> {away?.name ?? "Visitante"}</span>
          {(b.status ?? setsScore) && (
            <span className="mc-bigmin">{[b.status, setsScore && `sets ${setsScore}`].filter(Boolean).join(" · ")}</span>
          )}
        </div>
      </div>

      {/* ---- PANEL blanco (weather-bottom del usuario) ---- */}
      <div className="mc-kbody">
        {(home?.country ?? home?.rank ?? away?.country ?? away?.rank) && (
          <div className="mc-te-ranks">
            {(home?.country ?? home?.rank) && <span className="rk"><i>{home?.country ?? "—"}</i> {home?.rank ? `Nº ${home.rank}` : ""}</span>}
            {(away?.country ?? away?.rank) && <span className="rk"><i>{away?.country ?? "—"}</i> {away?.rank ? `Nº ${away.rank}` : ""}</span>}
          </div>
        )}
        <div className="mc-te-h2h">
          <div className="hd"><span>{b.currentPoint ? `${b.status ?? "Live"} · ${b.currentPoint}` : (b.status ?? "Próximo partido")}</span><b>{h2hLabel ?? `${homeSets}–${awaySets}`}</b></div>
          <div className="bar">
            <i style={{ width: `${homePct}%`, background: "linear-gradient(180deg,#5FB0FF,#2E7CF6)" }} />
            <i style={{ width: `${100 - homePct}%`, background: "linear-gradient(180deg,#FF9EBE,#F65E9B)" }} />
          </div>
        </div>
        <div className="mc-te-rows">
          {setsScore && (
            <div className="mc-te-row"><MIcon name="sports_tennis" size={13} /><span><b>{setsScore}</b> · sets</span></div>
          )}
          {h2hSummary && (
            <div className="mc-te-row"><MIcon name="history" size={13} /><span>{h2hSummary.slice(0, 48)}{h2hSummary.length > 48 ? "…" : ""}</span></div>
          )}
          {b.currentSet && (
            <div className="mc-te-row"><MIcon name="schedule" size={13} /><span>Set actual <b>{b.currentSet.gamesHome ?? 0}–{b.currentSet.gamesAway ?? 0}</b></span></div>
          )}
          {b.time && (
            <div className="mc-te-row"><MIcon name="schedule" size={13} /><span><b>{b.time}</b> · no te lo pierdas</span></div>
          )}
          {b.venue && (
            <div className="mc-te-row"><MIcon name="place" size={13} /><span>{b.venue}</span></div>
          )}
          {hero.desc && (
            <div className="mc-te-row"><SparkIcon /><span>{hero.desc.slice(0, 60)}{hero.desc.length > 60 ? "…" : ""}</span></div>
          )}
        </div>
        {isTappable && (
          <button
            className="mc-cta"
            type="button"
            onClick={handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
          >
            <SparkIcon />
            {cta?.label ?? "Ver dónde verlo"}
            <ArrowIcon />
          </button>
        )}
      </div>
      {overlay}
    </div>
  );
}

/* ============================================================================
   DISPATCHER — punto único que KoruUnifiedCard llama para TODA card del chat.
   ============================================================================ */

export function MichiCard(props: MichiProps & { design: MichiDesign }) {
  if (isMichiNews(props.block)) return <MichiNewsCards {...props} />;
  if (props.block.type === "recipe") return <MichiRecipeCard {...props} />;
  if (props.block.type === "crypto_portfolio" || props.block.type === "market") return <MichiMarketCard {...props} />;
  const { design } = props;
  switch (design) {
    case "mission": return <MichiMission {...props} />;
    case "crypto": return <MichiCrypto {...props} />;
    case "receta": return <MichiReceta {...props} />;
    case "fit": return <MichiFit {...props} />;
    case "focus": return <MichiFocus {...props} />;
    case "game": return <MichiGame {...props} />;
    case "shop": return <MichiShop {...props} />;
    case "sleep": return <MichiSleep {...props} />;
    case "futbol": return <MichiFutbol {...props} />;
    case "tenis": return <MichiTenis {...props} />;
    case "icard":
    default: return <MichiIcard {...props} />;
  }
}
