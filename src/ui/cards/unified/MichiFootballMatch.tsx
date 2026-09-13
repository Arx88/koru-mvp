import { ArrowRight, CalendarDays, CircleDot } from "lucide-react";
import type { UiBlock } from "../../../domain/types";
import type { MichiProps } from "./MichiLayouts";
import { localizeMatchStatus } from "./MichiLayouts";

function matchDate(value?:string) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es",{weekday:"short",day:"numeric",month:"short"}).format(date);
}
function goalMinute(value?:string) { return value ? `${value.trim().replace(/['′’]+$/g,"")}′` : ""; }

export function MichiFootballMatch({block,hero,isTappable,handleClick,overlay,foot}:MichiProps & {block:Extract<UiBlock,{type:"live_match"}>}) {
  const home=block.homeName || block.homeTeam?.name || "Local";
  const away=block.awayName || block.awayTeam?.name || "Visitante";
  const pre=block.state === "pre" || /scheduled|not started|próxim|upcoming/i.test(block.status || "");
  const status=localizeMatchStatus(block.status || (block.state === "post" ? "Finalizado" : "Partido"),hero.live || block.state === "in",pre);
  const legacyStats = [
    ...(block.homePossession !== undefined && block.awayPossession !== undefined ? [{label:"Posesión",home:block.homePossession,away:block.awayPossession}] : []),
    ...(block.homeShots !== undefined || block.awayShots !== undefined ? [{label:"Remates",home:block.homeShots,away:block.awayShots}] : []),
  ];
  const stats=block.detailedStats?.length ? block.detailedStats : block.stats?.length ? block.stats : legacyStats;
  const possession=stats.find(s => /posesi[oó]n|possession/i.test(s.label));
  const values=(s:typeof stats[number]) => ({home:s.home ?? ("leftPercent" in s ? s.leftPercent : undefined),away:s.away ?? ("rightPercent" in s ? s.rightPercent : undefined)});
  const pos=possession ? values(possession) : undefined;
  const percent=(value:unknown) => { const n=typeof value === "number" ? value : typeof value === "string" && /^\d+(\.\d+)?%?$/.test(value.trim()) ? Number(value.trim().replace("%","")) : NaN; return Number.isFinite(n) ? Math.max(0,Math.min(100,n)) : undefined; };
  const homePoss=percent(pos?.home);
  const awayPoss=percent(pos?.away);
  const metricStats=stats.filter(s=>s !== possession).slice(0,3);
  const goals=block.goals ?? [];
  const forTeam=(name:string) => goals.filter(g=>g.team?.toLowerCase() === name.toLowerCase());
  const otherGoals=goals.filter(g=>!g.team || ![home.toLowerCase(),away.toLowerCase()].includes(g.team.toLowerCase()));
  const next=block.upcoming?.[0];
  return <>
    <article className="mm-card mm-football" aria-label={`${home} vs ${away}`}>
      <div className="mm-art"><span className="mm-label" title={block.league || "Fútbol"} aria-label={block.league || "Fútbol"}><CircleDot size={18}/></span>{(hero.live || block.state === "in") && <span className="mm-live"><i/>{goalMinute(block.minute) || "En vivo"}</span>}</div>
      <div className="mm-panel">
        <div className="mm-scoreboard">
          <div className="mm-team">{block.homeLogo ? <img src={block.homeLogo} alt="" loading="lazy"/> : <span className="mm-team-initials">{home.slice(0,2).toUpperCase()}</span>}<h3>{home}</h3></div>
          <div className="mm-score"><span>{status}</span><strong>{pre ? block.time || "Por confirmar" : `${block.homeScore ?? block.homeTeam?.score ?? "—"} - ${block.awayScore ?? block.awayTeam?.score ?? "—"}`}</strong></div>
          <div className="mm-team">{block.awayLogo ? <img src={block.awayLogo} alt="" loading="lazy"/> : <span className="mm-team-initials">{away.slice(0,2).toUpperCase()}</span>}<h3>{away}</h3></div>
        </div>
        {(block.league || block.venue) && <div className="mm-match-context">{block.league && <strong>{block.league}</strong>}{block.venue && <span>{[block.venue,block.venueCity].filter(Boolean).join(" · ")}</span>}</div>}
        {pre && block.lineups && <div className="mm-match-formations">{[home,away].map(team=>block.lineups?.[team]?.formation && <div key={team}><span>{team}</span><strong>{block.lineups[team].formation}</strong></div>)}</div>}
        {!!goals.length && <div className="mm-goals">{[home,away].map(team=><div key={team}>{forTeam(team).map((g,i)=><span key={i}>{g.scorer || g.text || "Gol"} {goalMinute(g.minute)}</span>)}</div>)}{otherGoals.map((g,i)=><span className="mm-goal-neutral" key={i}>{g.scorer || g.text || "Gol"} {goalMinute(g.minute)}{g.team ? ` · ${g.team}` : ""}</span>)}</div>}
        {homePoss !== undefined && awayPoss !== undefined && <div className="mm-possession"><span>Posesión</span><div><strong>{homePoss}%</strong><div className="mm-possession-track" role="img" aria-label={`${home}: ${homePoss}%, ${away}: ${awayPoss}%`}><i style={{width:`${homePoss}%`}}/></div><strong>{awayPoss}%</strong></div></div>}
        {!!metricStats.length && <div className="mm-match-stats">{metricStats.map((s,i)=>{const v=values(s);return <div key={i}><strong>{v.home ?? "—"}<small> · {v.away ?? "—"}</small></strong><span>{s.label}</span></div>})}</div>}
        {next && <div className="mm-next-match"><CalendarDays/><div><span>Próximo partido</span><strong>{next.homeTeam || home} vs {next.awayTeam || "Por confirmar"}</strong><p>{[matchDate(next.date),next.time,next.league].filter(Boolean).join(" · ")}</p></div>{next.awayLogo && <img src={next.awayLogo} alt="" loading="lazy"/>}</div>}
        {isTappable && <button className="mm-cta" type="button" onClick={handleClick}>Ver detalle <ArrowRight size={22}/></button>}
        {foot}
      </div>
    </article>
    {overlay}
  </>;
}
