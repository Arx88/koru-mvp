/**
 * LiveMatchInterior — card "Clásico en vivo" (#p-match), integrada al block
 * real `live_match` (ESPN enriquecido: escudos, goles con foto, posesión).
 *
 * Concepto: scoreboard gigante con escudos reales (fallback iniciales),
 * feed de goles foto-primero (photo del tool), barra de posesión desde
 * homePossession/awayPossession y remates. EN VIVO solo si el partido
 * está en juego (minute/status); si no, muestra el estado real.
 *
 * 🔴 FIX PROGRAMADO — si el partido todavía no arrancó (state "pre" /
 * status Scheduled), el scoreboard muestra la HORA y "PRÓXIMO" en vez de un
 * "0-0" inventado, y el interior agrega info del encuentro (estadio/ciudad)
 * + alineaciones confirmadas si las hay + próximos del mismo equipo.
 */
import { useRef, useState } from "react";
import { BellRing, CalendarDays, ChartPie, Check, Goal, Info, List, MapPin, Shield, Users, type LucideIcon } from "lucide-react";
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
  if (b.state === "pre" || b.state === "post" || /final|terminad|ended|cancel|postpon|suspend/.test(s)) return false;
  if (/en vivo|live|1st|2nd|half|jueg/.test(s)) return true;
  return Number.isFinite(min) && min > 0 && min <= 120;
};

const isPre = (b: MatchBlock) => {
  if (b.state === "pre") return true;
  const s = (b.status ?? "").toLowerCase();
  return /scheduled|not started|pr[oó]xim|upcoming|programado/.test(s) && !isLive(b);
};

export function LiveMatchInterior({ block, onClose, onSave }: LecturaInteriorProps<MatchBlock>) {
  // Follow real del partido: el toggle queda pegado y el aviso se crea 1 vez.
  const [following, setFollowing] = useState(false);
  const home = block.homeName ?? "Local";
  const away = block.awayName ?? "Visitante";
  const league = block.league ?? "Partido";
  const live = isLive(block);
  const pre = isPre(block);
  const minute = parseInt(block.minute ?? "", 10);
  const minuteOk = Number.isFinite(minute);
  const minutePct = minuteOk ? Math.min(100, (minute / 90) * 100) : 0;
  const goals = block.goals ?? [];
  const homePos = parseInt(block.homePossession ?? "", 10);
  const awayPos = parseInt(block.awayPossession ?? "", 10);
  const hasPos = Number.isFinite(homePos) && Number.isFinite(awayPos);
  const upcoming = block.upcoming ?? [];
  // 🔴 FIX INTERIOR VACÍO — contexto del equipo + Wikipedia (match_live ahora
  // trae fetchTeamContext) para la sección "Sobre el equipo".
  const teamInfo = (block as any).teamInfo as { name?: string; stadium?: string; location?: string; league?: string; description?: string } | undefined;
  const wiki = (block as any).wikipediaExtract as string | undefined;
  const aboutText = teamInfo?.description ?? wiki;
  const kickoff = block.time ?? block.minute ?? "";

  const feedRef = useRef<HTMLDivElement>(null);
  const GoalIcon: LucideIcon = Goal;

  return (
    <LecturaShell variant="football"
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`${home} vs ${away}`, `${league}${block.minute ? ` · ${block.minute}` : ""}`) : undefined}
      chip={pre
        ? { label: "Próximo", background: "linear-gradient(135deg,#FFB020,#e08900)" }
        : { label: live ? "En vivo" : block.status || "Partido", background: "linear-gradient(135deg,#4BDD8C,#1f7a5c)" }}
      ariaLabel={`${home} vs ${away}`}
    >
      <div id="p-match" className="lcr-panel">
        <div className="sb rv">
          <div className="sb-top">
            <span className="sb-comp">{league}{block.time && !pre ? ` · ${block.time}` : ""}</span>
            {live ? (
              <span className="sb-live"><span className="dot"></span>EN VIVO</span>
            ) : pre ? (
              <span className="sb-comp" style={{ fontWeight: 900 }}>PRÓXIMO</span>
            ) : (
              <span className="sb-comp">{block.status ?? "Final"}</span>
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
            {pre ? (
              <div className="sb-nums">
                <span className="g" style={{ fontSize: 30 }}>{kickoff || "—"}</span>
              </div>
            ) : (
              <div className="sb-nums">
                <span className="g">{block.homeScore ?? "–"}</span>
                <span className="sep">–</span>
                <span className="g">{block.awayScore ?? "–"}</span>
              </div>
            )}
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
            {pre ? (
              <>
                <b>VS</b>
                <span>arranca {kickoff || "por confirmar"}</span>
              </>
            ) : (
              <>
                {minuteOk ? <b>{block.minute}</b> : <b>{block.time ?? ""}</b>}
                <span>{block.status ?? (live ? "en juego" : "")}</span>
              </>
            )}
          </div>
          {live && minuteOk && (
            <div className="sb-bar"><i style={{ width: `${minutePct}%` }}></i></div>
          )}
        </div>

        {pre && (
          <div className="sb-feed rv" style={{ gap: 10 }}>
            <h3><Ic i={CalendarDays} className="ic" />Info del partido</h3>
            {[
              block.venue ? { icon: MapPin, label: "Estadio", value: block.venue } : null,
              block.venueCity ? { icon: MapPin, label: "Ciudad", value: block.venueCity } : null,
              league !== "Partido" ? { icon: CalendarDays, label: "Competencia", value: league } : null,
              kickoff ? { icon: CalendarDays, label: "Arranca", value: kickoff } : null,
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="frow" style={{ padding: "2px 0" }}>
                <span className="fmin" style={{ minWidth: 26 }}><Ic i={row.icon} className="ic" /></span>
                <div className="ft">
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#8A93C2", textTransform: "uppercase", letterSpacing: ".06em" }}>{row.label}</span>
                  <b style={{ display: "block", fontSize: 13 }}>{row.value}</b>
                </div>
              </div>
            ))}
          </div>
        )}

        {pre && block.lineups && (
          <div className="sb-feed rv">
            <h3><Ic i={Users} className="ic" />Alineaciones confirmadas</h3>
            {Object.entries(block.lineups).map(([team, side]) => (
              <div className="frow" key={team} style={{ padding: "4px 0" }}>
                <span className="fmin" style={{ minWidth: 34 }}>{side.formation ?? ""}</span>
                <div className="ft">
                  <b>{team}</b>
                  <span>{(side.starters ?? []).slice(0, 11).map(p => p.name).join(" · ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {pre && upcoming.length > 0 && (
          <div className="sb-feed rv">
            <h3><Ic i={CalendarDays} className="ic" />Próximos partidos</h3>
            {upcoming.slice(0, 4).map((um: any, i) => (
              <div className="frow" key={`up_${i}`} style={{ padding: "4px 0" }}>
                <span className="fmin" style={{ minWidth: 40, fontSize: 10 }}>{um.time ?? ""}</span>
                {(um.homeLogo || um.awayLogo) && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0, width: 44, justifyContent: "center" }}>
                    {um.homeLogo && <img src={um.homeLogo} alt="" style={{ width: 17, height: 17, objectFit: "contain" }} loading="lazy" />}
                    {um.awayLogo && <img src={um.awayLogo} alt="" style={{ width: 17, height: 17, objectFit: "contain" }} loading="lazy" />}
                  </span>
                )}
                <div className="ft">
                  <b style={{ fontSize: 12 }}>{um.homeTeam} vs {um.awayTeam}</b>
                  <span>{um.league ?? ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}

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
              <span>{homePos === awayPos ? "posesión equilibrada" : `posesión a favor de ${homePos > awayPos ? home : away}`}</span>
            </div>
          </div>
        )}

        {/* 🔴 FIX INTERIOR VACÍO — sección "Sobre el equipo": estadio/sede/liga
            + resumen de Wikipedia (match_live trae fetchTeamContext). */}
        {(teamInfo || aboutText) && (
          <div className="sb-feed rv">
            <h3><Ic i={Shield} className="ic" />Sobre {teamInfo?.name ?? home}</h3>
            {[
              teamInfo?.stadium ? { icon: MapPin, label: "Estadio", value: teamInfo.stadium } : null,
              teamInfo?.location ? { icon: MapPin, label: "Sede", value: teamInfo.location } : null,
              teamInfo?.league ? { icon: Info, label: "Liga", value: teamInfo.league } : null,
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="frow" style={{ padding: "2px 0" }}>
                <span className="fmin" style={{ minWidth: 26 }}><Ic i={row.icon} className="ic" /></span>
                <div className="ft">
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#8A93C2", textTransform: "uppercase", letterSpacing: ".06em" }}>{row.label}</span>
                  <b style={{ display: "block", fontSize: 13 }}>{row.value}</b>
                </div>
              </div>
            ))}
            {aboutText && (
              <p style={{ margin: "8px 0 0", fontSize: 11.5, fontWeight: 600, color: "#6E7594", lineHeight: 1.55 }}>
                {aboutText.slice(0, 320)}{aboutText.length > 320 ? "…" : ""}
              </p>
            )}
          </div>
        )}

        <div className="actions">
          {(pre || live) && <button
            type="button"
            className="btn primary"
            aria-pressed={following}
            disabled={following}
            onClick={() => {
              const next = !following;
              setFollowing(next);
              if (next) {
                dispatchCardAction("create_commitment", block, {
                  title: pre
                    ? `Recordatorio: ${home} vs ${away}${kickoff ? ` (${kickoff})` : ""}`
                    : `Avisame si hay gol en ${home} vs ${away}`,
                  dueHint: pre
                    ? `${kickoff || "cuando arranque el partido"}`
                    : "mientras el partido esté en juego",
                });
              }
            }}
          >
            <Ic i={following ? Check : BellRing} className="ic" />
            {following ? (pre ? "Te aviso antes del pitazo" : "Siguiendo el partido") : (pre ? "Avisame cuando arranque" : "Avisame si hay gol")}
          </button>}
          {!pre && !live && <button type="button" className="btn primary" onClick={onClose}>Volver al chat</button>}
          {goals.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Ic i={List} className="ic" />Ver goles
            </button>
          )}
        </div>
      </div>
    </LecturaShell>
  );
}
