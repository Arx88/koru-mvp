/**
 * MtlInterior — card "Juega tu equipo" (#p-mtl), bind real del block
 * `match_timeline` (title/items/teamInfo/nextMatch).
 *
 * Próximo partido: equipos reales de nextMatch con escudo por lookup de
 * nombre (assets locales, fallback sin escudo), fecha/hora reales, meta
 * desde teamInfo (estadio/sede/liga — solo campos presentes). El extracto
 * REAL (teamInfo.description / wikipediaExtract) va a la nota. items[] =
 * cronología viva cuando hay partido en juego (minuto/texto/sub).
 * Acción: recordarme → create_commitment REAL con la fecha del partido.
 */
import { Calendar, ChartScatter, BellRing, CalendarDays } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-mtl.css";

type MtlBlock = Extract<UiBlock, { type: "match_timeline" }>;

const CRESTS: Record<string, string> = {
  "real madrid": "/stitch/sports/real-madrid.png",
  barcelona: "/stitch/sports/barcelona.png",
  "atlético de madrid": "/stitch/sports/atletico-madrid.png",
  "atletico de madrid": "/stitch/sports/atletico-madrid.png",
  sevilla: "/stitch/sports/sevilla.png",
  betis: "/stitch/sports/betis.png",
  villarreal: "/stitch/sports/villarreal.png",
  "real sociedad": "/stitch/sports/real-sociedad.png",
  valencia: "/stitch/sports/valencia.png",
  arsenal: "/stitch/sports/arsenal.png",
  liverpool: "/stitch/sports/liverpool.png",
  "manchester city": "/stitch/sports/manchester-city.png",
  tottenham: "/stitch/sports/tottenham.png",
  psg: "/stitch/sports/psg.png",
  juventus: "/stitch/sports/juventus.png",
  milan: "/stitch/sports/milan.png",
  inter: "/stitch/sports/inter.png",
  "boca juniors": "/stitch/sports/boca-juniors.png",
  "boca": "/stitch/sports/boca-juniors.png",
  "river plate": "/stitch/sports/river-plate.png",
  newcastle: "/stitch/sports/newcastle.png",
};

function crestFor(name?: string): string | null {
  if (!name) return null;
  return CRESTS[name.toLowerCase().trim()] ?? null;
}

/** "sábado 21:30" | "en 3 días" → chip corto sin inventar. */
function countdownFrom(date?: string, time?: string): string | null {
  if (!date) return null;
  const explicit = date.match(/\ben\s+(\d+)\s*(d[ií]a)s?\b/i);
  if (explicit) return `en ${explicit[1]} ${explicit[2]}`;
  const iso = date.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) {
    const target = new Date(`${iso[0]}T${time || "12:00"}`);
    const days = Math.round((target.getTime() - Date.now()) / 86_400_000);
    if (days > 0) return `en ${days} ${days === 1 ? "día" : "días"}`;
    if (days === 0) return "hoy";
  }
  return date;
}

export function MtlInterior({ block, onClose, onSave }: LecturaInteriorProps<MtlBlock>) {
  const next = block.nextMatch;
  const info = block.teamInfo;
  const items = block.items ?? [];
  const home = next?.homeTeam;
  const away = next?.awayTeam;
  const homeCrest = crestFor(home);
  const awayCrest = crestFor(away);
  const league = next?.league ?? info?.league;
  const countdown = countdownFrom(next?.date, next?.time);
  const title = block.title || (next ? `${home} vs ${away}` : info?.name || "Próximo partido");
  const extract = info?.description ?? block.wikipediaExtract;

  const meta: Array<{ label: string; value: string }> = [];
  if (info?.stadium) meta.push({ label: "Estadio", value: info.stadium });
  if (info?.location) meta.push({ label: "Sede", value: info.location });
  if (league && next?.league) meta.push({ label: "Competencia", value: next.league });
  else if (league) meta.push({ label: "Liga", value: league });

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, next?.date) : undefined}
      chip={{ label: "Fixture", background: "linear-gradient(135deg,#34d399,#059669)" }}
      ariaLabel={title}
    >
      <div id="p-mtl" className="lcr-panel">
        <div className="ev-head rv">
          <h1>
            <small>{info?.name ? `Tu equipo · ${info.name}` : "Tu equipo · próximo partido"}</small>
            {title}
          </h1>
          <p>
            {next
              ? "Te lo agendo con recordatorio antes del pitazo inicial. Así llega el día sin apuro."
              : "Cuando haya fecha confirmada, te lo agendo con recordatorio."}
          </p>
        </div>

        <div className="fx2-hero rv">
          <div className="fx2-when">
            <span className="lg">
              <Ic i={Calendar} className="ic" />
              {league || "fixture"}
            </span>
            {countdown && <span className="cnt">{countdown}</span>}
          </div>

          {next && (home || away) && (
            <div className="fx2-teams">
              <div className="fx2-tm">
                {homeCrest ? (
                  <img src={homeCrest} alt={home ?? "local"} />
                ) : (
                  <span className="nm crestbig">{home ?? "—"}</span>
                )}
              </div>
              <div className="fx2-vs">
                <span className="v">VS</span>
                {next.time && <span className="t">{next.time}</span>}
              </div>
              <div className="fx2-tm">
                {awayCrest ? (
                  <img src={awayCrest} alt={away ?? "visitante"} />
                ) : (
                  <span className="nm crestbig">{away ?? "—"}</span>
                )}
              </div>
            </div>
          )}

          {meta.length > 0 && (
            <div className="fx2-meta">
              {meta.map((m) => (
                <div className="m" key={`meta_${m.label}`}>
                  <span>{m.label}</span>
                  <b>{m.value}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        {extract && (
          <div className="fx2-note rv">
            <Ic i={ChartScatter} className="ic" />
            <p>
              {extract.slice(0, 220)}
              {extract.length > 220 ? "…" : ""} <b>Te aviso antes del partido.</b>
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="fx2-note rv">
            <Ic i={CalendarDays} className="ic" />
            <p>
              {items
                .slice(-4)
                .map((it) => `${it.minute ? `${it.minute}′ ` : ""}${it.text}`)
                .join(" · ")}
            </p>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatchCardAction("create_commitment", block, {
                title: `Recordatorio: ${title}`,
                dueHint: `${next?.date ?? "próximo partido"}${next?.time ? ` · ${next.time}` : ""}`,
              });
              onClose();
            }}
          >
            <Ic i={BellRing} className="ic" />
            Recordarme antes
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={CalendarDays} className="ic" />
            Ver todo el mes
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
