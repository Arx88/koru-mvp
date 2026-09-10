/**
 * LiveMatchInterior — card "Clásico en vivo" (#p-match), integrada al block
 * real `live_match` (ESPN enriquecido: escudos, goles con foto, posesión).
 *
 * Concepto: scoreboard gigante con escudos reales (fallback iniciales),
 * feed de goles foto-primero (photo del tool), barra de posesión desde
 * homePossession/awayPossession y remates. EN VIVO solo si el partido
 * está en juego (minute/status); si no, muestra el estado real.
 */
import { useState } from "react";
import { BellRing, ChartPie, Check, Goal, List, type LucideIcon } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import { dispatchCardAction } from "../actions";
import type { LecturaInteriorProps } from "../index";
import "./p-match.css";

type MatchBlock = Extract<UiBlock, { type: "live_match" }>;

const isLive = (b: MatchBlock) => {
  const s = (b.status ?? "").toLowerCase();
  const min = parseInt(b.minute ?? "", 10);
  if (/final|terminad|ended/.test(s)) return false;
  if (/en vivo|live|1st|2nd|half|jueg/.test(s)) return true;
  return Number.isFinite(min) && min > 0 && min <= 120;
};

export function LiveMatchInterior({ block, onClose, onSave }: LecturaInteriorProps<MatchBlock>) {
  // Follow real del partido: el toggle queda pegado y el aviso se crea 1 vez.
  const [following, setFollowing] = useState(false);
  const home = block.homeName ?? "Local";
  const away = block.awayName ?? "Visitante";
  const league = block.league ?? "Partido";
  const live = isLive(block);
  const minute = parseInt(block.minute ?? "", 10);
  const minuteOk = Number.isFinite(minute);
  const minutePct = minuteOk ? Math.min(100, (minute / 90) * 100) : 0;
  const goals = block.goals ?? [];
  const homePos = parseInt(block.homePossession ?? "", 10);
  const awayPos = parseInt(block.awayPossession ?? "", 10);
  const hasPos = Number.isFinite(homePos) && Number.isFinite(awayPos);

  const feedRef = ({ current: null } as { current: HTMLDivElement | null });
  const GoalIcon: LucideIcon = Goal;

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`${home} vs ${away}`, `${league}${block.minute ? ` · ${block.minute}` : ""}`) : undefined}
      chip={{ label: "En vivo", background: "linear-gradient(135deg,#4BDD8C,#1f7a5c)" }}
      ariaLabel={`${home} vs ${away}`}
    >
      <div id="p-match" className="lcr-panel">
        <div className="sb rv">
          <div className="sb-top">
            <span className="sb-comp">{league}{block.time ? ` · ${block.time}` : ""}</span>
            {live ? (
              <span className="sb-live"><span className="dot"></span>EN VIVO</span>
            ) : (
              <span className="sb-comp">{block.status ?? "Programado"}</span>
            )}
          </div>
          <div className="sb-score">
            <div className="sb-team">
              {block.homeLogo ? (
                <img src={block.homeLogo} alt={home} />
              ) : (
                <span className="sb-ini">{block.homeInitials ?? home.slice(0, 2).toUpperCase()}</span>
              )}
              <span className="nm">{home}</span>
            </div>
            <div className="sb-nums">
              <span className="g">{block.homeScore ?? 0}</span>
              <span className="sep">–</span>
              <span className="g">{block.awayScore ?? 0}</span>
            </div>
            <div className="sb-team">
              {block.awayLogo ? (
                <img src={block.awayLogo} alt={away} />
              ) : (
                <span className="sb-ini">{block.awayInitials ?? away.slice(0, 2).toUpperCase()}</span>
              )}
              <span className="nm">{away}</span>
            </div>
          </div>
          <div className="sb-min">
            {minuteOk ? <b>{block.minute}</b> : <b>{block.time ?? ""}</b>}
            <span>{block.status ?? (live ? "en juego" : "")}</span>
          </div>
          {live && minuteOk && (
            <div className="sb-bar"><i style={{ width: `${minutePct}%` }}></i></div>
          )}
        </div>

        {goals.length > 0 && (
          <div className="sb-feed rv" ref={feedRef}>
            <h3><Ic i={GoalIcon} className="ic" />Cómo llegaron los goles</h3>
            {goals.map((g, i) => {
              const isAway = (g.team ?? "").toLowerCase().includes(away.toLowerCase().split(" ")[0] ?? "");
              return (
                <div className={`frow${isAway ? " opp" : ""}`} key={i}>
                  <span className="fmin">{g.minute}</span>
                  <div className="fp">
                    {g.photo ? (
                      <img src={g.photo} alt={g.scorer ?? "gol"} />
                    ) : (
                      <span className="fp-ic"><Ic i={GoalIcon} className="ic" /></span>
                    )}
                  </div>
                  <div className="ft">
                    <b>{g.scorer ?? "Gol"}</b>
                    <span>{g.text ?? (isAway ? away : home)}</span>
                  </div>
                  <div className="fic"><Ic i={GoalIcon} className="ic" /></div>
                </div>
              );
            })}
          </div>
        )}

        {hasPos && (
          <div className="sb-pos rv">
            <h3><Ic i={ChartPie} className="ic" />Quién está mandando</h3>
            <div className="pos-track">
              <span className="l" style={{ width: `${homePos}%` }}>{homePos}%</span>
              <span className="r" style={{ width: `${awayPos}%` }}>{awayPos}%</span>
            </div>
            <div className="pos-ends">
              <span>Remates {block.homeShots ?? "–"} – {block.awayShots ?? "–"}</span>
              <span>posesión a favor de {homePos > awayPos ? home : away}</span>
            </div>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            aria-pressed={following}
            onClick={() => {
              const next = !following;
              setFollowing(next);
              if (next) {
                dispatchCardAction("create_commitment", block, {
                  title: `Avisame si hay gol en ${home} vs ${away}`,
                  dueHint: "mientras el partido esté en juego",
                });
              }
            }}
          >
            <Ic i={following ? Check : BellRing} className="ic" />
            {following ? "Siguiendo el partido" : "Avisame si hay gol"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Ic i={List} className="ic" />Ver goles
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
