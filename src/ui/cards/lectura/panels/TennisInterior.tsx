/**
 * TennisInterior — card "Partido de tenis" (#p-tennis), bind real del block
 * `tennis_match` (players + sets + currentSet + currentPoint + stats +
 * lastPoints + h2h + sources).
 *
 * Tanteador estilo scoreboard: fotos/ranks reales de los jugadores, tabla
 * de sets con games y tiebreak, set en curso con saque (punto pulsante),
 * punto actual grande, duelos de stats con barras espejo, últimos puntos
 * y head-to-head. Todo del block — sin sets no se inventan games.
 */
import { Trophy, Activity, Swords, History, ExternalLink, ArrowLeft } from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-tennis.css";

type TennisBlock = Extract<UiBlock, { type: "tennis_match" }>;

type SetEntry = NonNullable<TennisBlock["sets"]>[number];

const SET_LABELS = ["1er", "2º", "3º", "4º", "5º"];

function initials(name?: string): string {
  const parts = String(name ?? "").trim().split(/\s+/);
  if (!parts[0]) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function setsWon(sets: SetEntry[], side: "home" | "away"): number {
  return sets.filter((s) => s?.winner === side).length;
}

/** Barra espejo: p(h) vs p(a) — ancho proporcional real. */
function duelBar(h: number, a: number): { hPct: number; aPct: number } {
  const total = h + a;
  if (total <= 0) return { hPct: 50, aPct: 50 };
  return { hPct: Math.round((h / total) * 100), aPct: 100 - Math.round((h / total) * 100) };
}

const STATUS_LABEL: Record<string, string> = {
  live: "EN VIVO",
  scheduled: "PRÓXIMO",
  finished: "FINAL",
};

export function TennisInterior({ block, onClose, onSave }: LecturaInteriorProps<TennisBlock>) {
  const players = block.players;
  const home = players?.home;
  const away = players?.away;
  const sets = (block.sets ?? []).filter(Boolean);
  const currentSet = block.currentSet;
  const isLive = block.status === "live" || Boolean(currentSet);
  const tournament = block.tournament;
  const lastPoints = (block.lastPoints ?? []).slice(-5);
  const h2h = block.h2h;
  const sources = (block.sources ?? []).filter(Boolean);
  const firstSource = sources.find((s) => /^https?:\/\//i.test(String(s?.url ?? "")));

  const homeSets = setsWon(sets, "home");
  const awaySets = setsWon(sets, "away");

  const statDuels: Array<{ label: string; h: number; a: number; pct?: boolean }> = [
    { label: "Aces", h: block.stats?.aces?.h ?? 0, a: block.stats?.aces?.a ?? 0 },
    { label: "Dobles faltas", h: block.stats?.doubleFaults?.h ?? 0, a: block.stats?.doubleFaults?.a ?? 0 },
    { label: "1er servicio", h: block.stats?.firstServePct?.h ?? 0, a: block.stats?.firstServePct?.a ?? 0, pct: true },
    { label: "Breaks ganados", h: block.stats?.breakPointsWon?.h ?? 0, a: block.stats?.breakPointsWon?.a ?? 0 },
  ];

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(`${home?.name ?? "Local"} vs ${away?.name ?? "Visitante"}`, tournament ? `${tournament.name} · ${tournament.round}` : undefined) : undefined}
      chip={{ label: "Tenis", background: "linear-gradient(135deg,#8ab0ff,#1A237E)" }}
      ariaLabel={`Tenis: ${home?.name ?? ""} vs ${away?.name ?? ""}`}
    >
      <div id="p-tennis" className="lcr-panel">
        <div className="tn-head rv">
          <h1>
            <small>{tournament ? `${tournament.name} · ${tournament.round}` : "Tenis"}</small>
            {home?.name ?? "Local"} – {away?.name ?? "Visitante"}
          </h1>
          {tournament && (
            <p>
              {tournament.surface}
              {tournament.category ? ` · ${tournament.category}` : ""}
              {isLive && currentSet ? ` · Set en curso ${sets.length + 1}` : ""}
            </p>
          )}
        </div>

        {/* SCOREBOARD: jugadores + sets ganados + estado */}
        <div className="tn-board rv">
          <div className="tn-row player">
            <div className="tn-p">
              {home?.logo ? (
                <img src={home.logo} alt={home.name ?? "Jugador"} loading="lazy" />
              ) : (
                <span className="tn-ava">{initials(home?.name)}</span>
              )}
              <div className="tn-name">
                <b>{home?.name ?? "Local"}</b>
                <span>
                  {home?.rank ? `Nº ${home.rank}` : ""}
                  {home?.country ? `${home.rank ? " · " : ""}${home.country}` : ""}
                </span>
              </div>
            </div>
            <div className="tn-sets">
              <b>{homeSets}</b>
            </div>
          </div>

          <div className="tn-row player">
            <div className="tn-p">
              {away?.logo ? (
                <img src={away.logo} alt={away.name ?? "Jugador"} loading="lazy" />
              ) : (
                <span className="tn-ava">{initials(away?.name)}</span>
              )}
              <div className="tn-name">
                <b>{away?.name ?? "Visitante"}</b>
                <span>
                  {away?.rank ? `Nº ${away.rank}` : ""}
                  {away?.country ? `${away.rank ? " · " : ""}${away.country}` : ""}
                </span>
              </div>
            </div>
            <div className="tn-sets">
              <b>{awaySets}</b>
            </div>
          </div>

          <div className="tn-status">
            <span className={`tn-badge${isLive ? " live" : ""}`}>
              {isLive && <i className="live-dot" aria-hidden="true" />}
              {STATUS_LABEL[block.status ?? (isLive ? "live" : "scheduled")] ?? "PARTIDO"}
            </span>
            {isLive && block.currentPoint && (
              <span className="tn-point">
                <Ic i={Activity} className="ic" />
                Punto: <b>{block.currentPoint}</b>
                {block.breakPoint && <em className="tn-bp">¡Break point!</em>}
              </span>
            )}
          </div>
        </div>

        {/* TABLA DE SETS: games por set + tiebreak */}
        {sets.length > 0 && (
          <div className="tn-sets-table rv">
            <div className="tn-grid">
              <div className="tn-grid-name" />
              {sets.map((s, i) => (
                <div key={`seth_${i}`} className="tn-grid-set">
                  {SET_LABELS[i] ?? `Set ${i + 1}`}
                </div>
              ))}
              {currentSet && <div className="tn-grid-set now">ahora</div>}
            </div>
            <div className="tn-grid">
              <div className="tn-grid-name srv">
                {currentSet?.server === "home" && <i className="srv-dot" title="Al saque" />}
                {home?.name?.split(/\s+/).pop() ?? "Local"}
              </div>
              {sets.map((s, i) => (
                <div key={`seth_v_${i}`} className={`tn-grid-val${s.winner === "home" ? " win" : ""}`}>
                  {s.homeGames}
                  {s.tiebreak && <small>{s.tiebreak.homePts}</small>}
                </div>
              ))}
              {currentSet && <div className="tn-grid-val now">{currentSet.gamesHome}</div>}
            </div>
            <div className="tn-grid">
              <div className="tn-grid-name srv">
                {currentSet?.server === "away" && <i className="srv-dot" title="Al saque" />}
                {away?.name?.split(/\s+/).pop() ?? "Visitante"}
              </div>
              {sets.map((s, i) => (
                <div key={`seta_v_${i}`} className={`tn-grid-val${s.winner === "away" ? " win" : ""}`}>
                  {s.awayGames}
                  {s.tiebreak && <small>{s.tiebreak.awayPts}</small>}
                </div>
              ))}
              {currentSet && <div className="tn-grid-val now">{currentSet.gamesAway}</div>}
            </div>
          </div>
        )}

        {/* ÚLTIMOS PUNTOS del juego actual */}
        {lastPoints.length > 0 && (
          <div className="tn-points rv">
            <div className="tn-sub">
              <Ic i={Swords} className="ic" />
              El juego, punto por punto
            </div>
            <div className="tn-pts-row">
              {lastPoints.map((p, i) => (
                <span
                  key={`pt_${i}`}
                  className={`tn-pt${p.outcome === "won" ? " w" : p.outcome === "lost" ? " l" : ""}`}
                >
                  {p.point}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* STATS en duelo espejo */}
        {statDuels.some((d) => d.h > 0 || d.a > 0) && (
          <div className="tn-stats rv">
            <div className="tn-sub">
              <Ic i={Trophy} className="ic" />
              Los duelos del partido
            </div>
            {statDuels.map((d) => {
              const bar = duelBar(d.h, d.a);
              return (
                <div key={`st_${d.label}`} className="tn-stat">
                  <div className="tn-stat-vals">
                    <b className={d.h >= d.a ? "lead" : ""}>
                      {d.h}
                      {d.pct ? "%" : ""}
                    </b>
                    <span>{d.label}</span>
                    <b className={d.a >= d.h ? "lead" : ""}>
                      {d.a}
                      {d.pct ? "%" : ""}
                    </b>
                  </div>
                  <div className="tn-stat-bars">
                    <i className="h" style={{ width: `${bar.hPct}%` }} />
                    <i className="a" style={{ width: `${bar.aPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* HEAD TO HEAD */}
        {h2h?.record && (
          <div className="tn-h2h rv">
            <div className="tn-sub">
              <Ic i={History} className="ic" />
              Historial entre ellos
            </div>
            <div className="tn-h2h-body">
              <b>{h2h.record}</b>
              <span>{h2h.summary ?? "historial directo"}</span>
              {h2h.surfaceRecord && <em>{h2h.surfaceRecord}</em>}
            </div>
          </div>
        )}

        <div className="actions">
          {firstSource ? (
            <a className="btn primary" href={String(firstSource.url)} target="_blank" rel="noopener noreferrer">
              <Ic i={ExternalLink} className="ic" />
              Ver en la fuente
            </a>
          ) : (
            <button type="button" className="btn primary" onClick={() => onClose()}>
              <Ic i={Trophy} className="ic" />
              {block.status === "finished" ? "Ya lo vi" : "A seguirlo"}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={ArrowLeft} className="ic" />
            Volver al chat
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
