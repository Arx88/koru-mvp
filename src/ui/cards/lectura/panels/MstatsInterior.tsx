/**
 * MstatsInterior — card "El clásico, en números" (#p-mstats), bind real del
 * block `match_stats` (title/stats/homeName/awayName/homeColor/awayColor).
 *
 * Los stats[] REALES arman el tablero: la primera métrica tipo posesión
 * (label /pos|posesi/i) va al track duelo; el resto como barras gemelas
 * con width del block. Escudos por lookup de nombre (assets reales de
 * /stitch/sports, con fallback a iniciales — sin inventar escudos).
 * Veredicto DERIVADO de los números (quién domina en posesión/remates).
 */
import { useState } from "react";
import { TrendingUp, Radar, Users } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-mstats.css";

type MstatsBlock = Extract<UiBlock, { type: "match_stats" }>;

/** Crestas locales por nombre de equipo — presentation assets reales. */
const CRESTS: Record<string, string> = {
  "real madrid": "/stitch/sports/real-madrid.png",
  barcelona: "/stitch/sports/barcelona.png",
  "atlético de madrid": "/stitch/sports/atletico-madrid.png",
  "atletico de madrid": "/stitch/sports/atletico-madrid.png",
  "atleti": "/stitch/sports/atletico-madrid.png",
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
  "river plate": "/stitch/sports/river-plate.png",
  newcastle: "/stitch/sports/newcastle.png",
};

function crestFor(name?: string): string | null {
  if (!name) return null;
  return CRESTS[name.toLowerCase().trim()] ?? null;
}

function initialsOf(name?: string): string {
  if (!name) return "?";
  const words = name.split(/\s+/).filter((w) => /^[A-ZÁÉÍÓÚÑ0-9]/.test(w));
  return (words[0]?.[0] ?? name[0] ?? "?").concat(words[1]?.[0] ?? "").toUpperCase();
}

function num(value: string): number {
  return parseFloat(String(value).replace(",", ".")) || 0;
}

export function MstatsInterior({ block, onClose, onSave }: LecturaInteriorProps<MstatsBlock>) {
  const stats = block.stats ?? [];
  const home = block.homeName || "Local";
  const away = block.awayName || "Visitante";
  const homeCrest = crestFor(block.homeName);
  const awayCrest = crestFor(block.awayName);
  const title = block.title || "Quién mandó de verdad";
  // Vista por equipo: filtra el tablero a los números de un solo lado
  // (estado real de la card, no simulado).
  const [view, setView] = useState<"duel" | "home" | "away">("duel");
  const teamView = view === "home" ? home : view === "away" ? away : null;
  const wonBy = (side: "home" | "away") =>
    stats.filter((s) => num(s[side]) > num(s[side === "home" ? "away" : "home"])).length;

  const possessionStat = stats.find((s) => /pos|posesi/i.test(s.label));
  const otherStats = stats.filter((s) => s !== possessionStat).slice(0, 4);

  const homePos = possessionStat ? num(possessionStat.home) : null;
  const awayPos = possessionStat ? num(possessionStat.away) : null;
  const dominator =
    homePos != null && awayPos != null
      ? homePos > awayPos
        ? home
        : awayPos > homePos
          ? away
          : null
      : null;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, `${home} vs ${away}`) : undefined}
      chip={{ label: "Stats", background: "linear-gradient(135deg,#34d399,#2FC86E)" }}
      ariaLabel={title}
    >
      <div id="p-mstats" className="lcr-panel">
        <div className="ev-head rv">
          <h1>
            <small>{block.title ? block.title : "El partido, en números"}</small>
            {home} <span style={{ color: "var(--ink-faint)" }}>vs</span> {away}
          </h1>
          <p>Métricas reales del partido — sin narrativa, lo que pasó fue esto.</p>
        </div>

        {stats.length > 1 && (
          <div className="du-tabs rv" role="tablist" aria-label="Vista de estadísticas">
            {([
              ["duel", `Duelo`],
              ["home", initialsOf(block.homeName) || home],
              ["away", initialsOf(block.awayName) || away],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                title={key === "home" ? home : key === "away" ? away : "Comparativo de ambos"}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {teamView ? (
          <div className="du-teamlist rv">
            <div className="tl-head">
              <h3>
                {teamView}
                <span>
                  gana en {wonBy(view === "home" ? "home" : "away")} de {stats.length} métricas
                </span>
              </h3>
            </div>
            {stats.map((s) => (
              <div className="tl-row" key={`tv_${s.label}`}>
                <span className="l">{s.label}</span>
                <b className="v">
                  {view === "home" ? s.home : s.away}
                  {/pos|posesi/i.test(s.label) ? "%" : ""}
                </b>
              </div>
            ))}
          </div>
        ) : (
        <div className="du-hero rv">
          <div className="du-teams">
            <div className="du-tm">
              {homeCrest ? (
                <img src={homeCrest} alt={home} />
              ) : (
                <span className="du-tm crestito">{initialsOf(block.homeName)}</span>
              )}
              <span className="nm">{home}</span>
            </div>
            <span className="du-mid">·</span>
            <div className="du-tm rt">
              <span className="nm">{away}</span>
              {awayCrest ? (
                <img src={awayCrest} alt={away} />
              ) : (
                <span className="du-tm crestito">{initialsOf(block.awayName)}</span>
              )}
            </div>
          </div>

          {possessionStat && homePos != null && awayPos != null && (
            <div className="du-pos">
              <div className="lbl">{possessionStat.label}</div>
              <div className="track">
                <span className="l" style={{ width: `${homePos}%`, background: block.homeColor }}>
                  {possessionStat.home}
                </span>
                <span className="r" style={{ width: `${awayPos}%`, background: block.awayColor }}>
                  {possessionStat.away}
                </span>
              </div>
            </div>
          )}

          <div className="du-bars">
            {otherStats.map((s) => {
              const homeVal = num(s.home);
              const awayVal = num(s.away);
              const homeW = num(s.width.replace("%", ""));
              // barra espejo del rival: mismo ancho relativo escalado por valor
              const awayW = homeVal > 0 ? (awayVal / homeVal) * homeW : 0;
              return (
                <div className="db" key={`stat_${s.label}`}>
                  <div className="lbl">{s.label}</div>
                  <div className="row">
                    <div className="lbar" style={{ width: `${Math.min(homeW, 100)}%` }}>
                      <i style={{ width: "10%" }} />
                    </div>
                    <div className="num">
                      {s.home}
                      <small>{initialsOf(block.homeName) || "H"}</small>
                    </div>
                    <div className="rbar" style={{ width: `${Math.min(awayW, 100)}%` }}>
                      <i style={{ width: "10%" }} />
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: "4px" }}>
                    <div className="lbar" style={{ width: "0" }} />
                    <div className="num">
                      {s.away}
                      <small>{initialsOf(block.awayName) || "A"}</small>
                    </div>
                    <div className="rbar" style={{ width: "0" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        <div className="du-verdict rv">
          <Ic i={TrendingUp} className="ic" />
          <p>
            {dominator
              ? `${dominator} manda en los números`
              : "Partido parejo en los números"}
            {possessionStat
              ? ` — ${possessionStat.label} ${possessionStat.home}/${possessionStat.away}`
              : ""}
            . Lo que pase de acá es narrativa: esto es lo que pasó.
          </p>
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
            <Ic i={Radar} className="ic" />
            Volver al partido
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={Users} className="ic" />
            Cerrar
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
