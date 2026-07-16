import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { UiBlock } from "../../../domain/types";
import type { Detail, DetailSection, Accent, DetailRow, DetailSourceRef } from "./presentation";

// Pantalla de detalle unificada — misma estética Stitch que PlanRoadmapScreen
// (koru-roadmap + magical-cards + blobs), pero genérica: renderiza cualquier
// conjunto de secciones normalizadas. Cada UiBlock que abre su CTA cae acá,
// así informe, clima, mercados, etc. comparten un único lenguaje visual.

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

// 🔴 v2: ComparisonBar — barra comparativa para stats de fútbol (o cualquier
// matchup home/away). Dibuja dos segmentos coloreados con team colors,
// mostrando visualmente quién domina esa stat.
function ComparisonBar({ bar }: { bar: NonNullable<DetailRow["bar"]> }) {
  const { homeValue, awayValue, isPercent, homeColor, awayColor } = bar;
  const total = (homeValue ?? 0) + (awayValue ?? 0);
  const homePct = total > 0 ? Math.max(2, Math.min(98, (homeValue / total) * 100)) : 50;
  const awayPct = 100 - homePct;
  const hc = homeColor || "#2d6a4f";
  const ac = awayColor || "#8363f9";
  return (
    <div className="koru-comparison-bar" role="presentation">
      <span className="koru-comparison-value home" style={{ color: hc }}>
        {isPercent ? `${Math.round(homeValue)}%` : homeValue}
      </span>
      <div className="koru-comparison-track">
        <div
          className="koru-comparison-fill home"
          style={{ width: `${homePct}%`, background: hc }}
        />
        <div
          className="koru-comparison-fill away"
          style={{ width: `${awayPct}%`, background: ac }}
        />
      </div>
      <span className="koru-comparison-value away" style={{ color: ac }}>
        {isPercent ? `${Math.round(awayValue)}%` : awayValue}
      </span>
    </div>
  );
}

/** Aplica el accent de la sección a las CSS custom props del módulo. */
function moduleStyle(accent: Accent): CSSProperties {
  return { "--module-color": accent.color, "--module-bg": accent.soft } as CSSProperties;
}

// 🔴 v2: Extrae el video ID de una URL de YouTube (youtu.be / watch?v= / embed / shorts).
// Devuelve null si no es una URL válida de YouTube.
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

function SectionHead({ section }: { section: DetailSection }) {
  return (
    <div className="koru-module-head">
      <div className="koru-module-id">
        <div className="koru-module-icon">
          <Mat>{section.icon}</Mat>
        </div>
        <div>
          <h3 className="koru-module-title">{section.title}</h3>
          {section.subtitle && <p className="koru-module-kicker">{section.subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// 🔴 v2: SourceRow — un source puede tener favicon (imageUrl) o ser un video
// embebido de YouTube (thumbnail + play button + duration badge).
function SourceRow({ source }: { source: DetailSourceRef }) {
  const ytId = source.url ? youtubeId(source.url) : null;

  const titleEl = (
    <span className="koru-dsec-source-title">
      {source.title}
      {source.domain && <span className="koru-dsec-source-domain"> — {source.domain}</span>}
    </span>
  );

  // Video embed: thumbnail 16:9 + play button (koru-breathe) + duration badge
  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    const inner = (
      <>
        <div
          className="koru-source-video-thumb"
          style={{ backgroundImage: `url(${thumb})` }}
        >
          <span className="koru-source-video-play animate-breathe">
            <Mat>play_arrow</Mat>
          </span>
          {source.duration && (
            <span className="koru-source-video-duration">{source.duration}</span>
          )}
        </div>
        {titleEl}
      </>
    );
    return source.url ? (
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="koru-dsec-source koru-dsec-source-video"
      >
        {inner}
      </a>
    ) : (
      <div className="koru-dsec-source koru-dsec-source-video">{inner}</div>
    );
  }

  // Favicon: si hay imageUrl, mostrar imagen 28x28 en vez del ícono genérico
  const inner = (
    <>
      {source.imageUrl ? (
        <img
          src={source.imageUrl}
          alt=""
          className="koru-source-favicon"
          loading="lazy"
        />
      ) : (
        <Mat className="koru-dsec-source-icon">language</Mat>
      )}
      {titleEl}
    </>
  );

  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" className="koru-dsec-source">
      {inner}
    </a>
  ) : (
    <div className="koru-dsec-source">{inner}</div>
  );
}

function SectionBody({ section, block }: { section: DetailSection; block?: UiBlock }) {
  switch (section.kind) {
    case "text":
      return <p className="koru-dsec-text">{section.body}</p>;

    case "tiles":
      return (
        <div className="koru-dsec-tiles">
          {section.tiles.map((t, i) => (
            <div key={i} className="koru-dsec-tile">
              {t.icon && <Mat className="koru-dsec-tile-icon" >{t.icon}</Mat>}
              <span className="koru-dsec-tile-label">{t.label}</span>
              <span className="koru-dsec-tile-value">{t.value}</span>
            </div>
          ))}
        </div>
      );

    case "rows":
      return (
        <div className="koru-dsec-rows">
          {section.rows.map((r, i) => {
            // 🔴 TIER S: si la row trae `toggle`, la envolvemos en un botón
            // que dispatcha `koru-card-action` con action "toggle_shopping" o
            // "toggle_checklist" + los ids sintéticos. KoruProvider los pasa al
            // reducer correspondiente (toggleShoppingItem / toggleChecklistItem).
            const toggle = r.toggle;
            const rowInner = (
              <>
                {r.icon && <Mat className="koru-dsec-row-icon">{r.icon}</Mat>}
                <div className="koru-dsec-row-body">
                  <p className="koru-dsec-row-title">{r.title}</p>
                  {r.detail && <p className="koru-dsec-row-detail">{r.detail}</p>}
                  {/* 🔴 v2: barra comparativa para stats de fútbol (posesión, tiros, etc.) */}
                  {r.bar && <ComparisonBar bar={r.bar} />}
                </div>
                {r.meta && <span className="koru-dsec-row-meta">{r.meta}</span>}
                {r.badge && <span className={`koru-step-chip is-${r.badgeTone ?? "pending"}`}>{r.badge}</span>}
              </>
            );
            if (toggle) {
              return (
                <button
                  key={i}
                  type="button"
                  className="koru-dsec-row koru-dsec-row-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    const action =
                      toggle.kind === "shopping_item" ? "toggle_shopping" : "toggle_checklist";
                    window.dispatchEvent(
                      new CustomEvent("koru-card-action", {
                        detail: {
                          action,
                          listId: toggle.listId,
                          checklistId: toggle.checklistId,
                          itemId: toggle.itemId,
                          // 🔴 TIER S: include blockData so KoruProvider can
                          // auto-create the durable entity if it doesn't exist.
                          blockData: block,
                        },
                      }),
                    );
                    if ("vibrate" in navigator) navigator.vibrate(12);
                  }}
                >
                  {rowInner}
                </button>
              );
            }
            return (
              <div key={i} className={"koru-dsec-row" + (r.bar ? " koru-dsec-row-with-bar" : "")}>
                {rowInner}
              </div>
            );
          })}
        </div>
      );

    case "chips":
      return (
        <div className="koru-dsec-chips">
          {section.chips.map((c, i) => (
            <div key={i} className="koru-dsec-chip">
              <span className="koru-dsec-chip-label">{c.label}</span>
              {c.sub && <span className="koru-dsec-chip-sub">{c.sub}</span>}
            </div>
          ))}
        </div>
      );

    case "calendar":
      // 🔴 v2: kind dedicado para el calendario de cumpleaños. Usa clases
      // propias (.koru-dsec-calendar / -day) para no colisionar con los chips
      // genéricos que ahora vuelven a verse como píldoras.
      return (
        <div className="koru-dsec-calendar">
          {section.days.map((d, i) => (
            <div
              key={i}
              className="koru-dsec-calendar-day"
              style={d.color ? { color: d.color } : undefined}
            >
              <span className="koru-dsec-chip-label">{d.label}</span>
              {d.sub && <span className="koru-dsec-chip-sub">{d.sub}</span>}
            </div>
          ))}
        </div>
      );

    case "scroller":
      return (
        <div className="koru-dsec-scroller">
          {section.cards.map((c, i) => (
            <div key={i} className="koru-dsec-scard">
              {/* 🔴 v3: badge image (Google Places photo) — thumbnail 16:9 sobre el título. */}
              {c.image && (
                <div className="koru-dsec-scard-image">
                  <img src={c.image} alt={c.title} loading="lazy" />
                </div>
              )}
              {c.badge && (
                <span className="koru-dsec-scard-badge" style={c.badgeColor ? { color: c.badgeColor, background: `${c.badgeColor}1a` } : undefined}>
                  {c.badge}
                </span>
              )}
              <h4 className="koru-dsec-scard-title">{c.title}</h4>
              {c.detail && <p className="koru-dsec-scard-detail">{c.detail}</p>}
              {c.metrics && c.metrics.length > 0 && (
                <div className="koru-dsec-scard-metrics">
                  {c.metrics.map((m, j) => (
                    <span key={j} className="koru-dsec-scard-metric">{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case "timeline":
      return (
        <div className="koru-timeline">
          <div className="koru-timeline-line" />
          <div className="koru-timeline-steps">
            {section.steps.map((s, i) => {
              const status = s.status ?? "pending";
              // 🔴 TIER S: si el paso trae `toggle.kind === "plan_step"`, lo
              // envolvemos en un botón que dispatcha `koru-card-action` con
              // action "toggle_step" + planId + stepId. KoruProvider los pasa
              // al reducer togglePlanStep.
              const toggle = s.toggle;
              const stepInner = (
                <>
                  <div className="koru-timeline-dot">
                    <Mat>{status === "done" ? "check" : s.icon ?? "radio_button_unchecked"}</Mat>
                  </div>
                  <div className="koru-timeline-body">
                    <h4 className="koru-timeline-name">{s.title}</h4>
                    {s.detail && <p className="koru-timeline-meta">{s.detail}</p>}
                    {/* 🔴 v2: badge de prioridad (Alta/Media/Baja) en pasos del plan */}
                    {s.badge && <span className={`koru-step-chip is-${s.badgeTone ?? "pending"}`}>{s.badge}</span>}
                  </div>
                </>
              );
              if (toggle && toggle.kind === "plan_step") {
                return (
                  <button
                    key={i}
                    type="button"
                    className={`koru-timeline-step is-${status} koru-timeline-step-toggle`}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(
                        new CustomEvent("koru-card-action", {
                          detail: {
                            action: "toggle_step",
                            planId: toggle.planId,
                            stepId: toggle.stepId,
                            // 🔴 TIER S: include blockData so KoruProvider can
                            // auto-create the durable Plan if it doesn't exist.
                            blockData: block,
                          },
                        }),
                      );
                      if ("vibrate" in navigator) navigator.vibrate(12);
                    }}
                  >
                    {stepInner}
                  </button>
                );
              }
              return (
                <div key={i} className={`koru-timeline-step is-${status}`}>
                  {stepInner}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "sources":
      return (
        <div className="koru-dsec-sources">
          {section.sources.map((s, i) => (
            <SourceRow key={i} source={s} />
          ))}
        </div>
      );

    case "pitch":
      return <FormationPitch pitch={section.pitch} />;

    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

function FormationPitch({ pitch }: { pitch: NonNullable<Extract<DetailSection, { kind: "pitch" }>["pitch"]> }) {
  const { homeFormation, awayFormation, homePlayers, awayPlayers, homeColor, awayColor, homeName, awayName } = pitch;
  const hc = homeColor || "#2d6a4f";
  const ac = awayColor || "#8363f9";

  // Parse formation string "4-3-3" → [4, 3, 3]
  function parseFormation(f: string): number[] {
    return f.split("-").map(n => parseInt(n, 10) || 0).filter(n => n > 0);
  }

  // Posicionar jugadores en una mitad de cancha (50% vertical)
  // home juega "hacia arriba" (de abajo hacia arriba), away "hacia abajo"
  // Cada línea del formation se posiciona a un Y% creciente desde el arquero.
  function positionPlayers(players: Array<{ number?: string; name: string; position?: string }>, formation: string, isHome: boolean): Array<{ x: number; y: number; player: typeof players[0] }> {
    if (players.length === 0) return [];
    const lines = parseFormation(formation);
    const result: Array<{ x: number; y: number; player: typeof players[0] }> = [];
    let playerIdx = 0;

    // GK siempre primero, en la línea de gol
    if (players[0]) {
      result.push({ x: 50, y: isHome ? 95 : 5, player: players[0] });
      playerIdx = 1;
    }

    // Cada línea del formation: distribuir N jugadores en una fila horizontal
    // Y va creciendo desde la defensa (cerca del arquero) hasta el ataque (cerca del mediocampo)
    const linesCount = lines.length;
    lines.forEach((count, lineIdx) => {
      // Y para home: de 80% (defensa) a 55% (ataque, mediocampo)
      // Y para away: de 20% (defensa) a 45% (ataque, mediocampo)
      const yBase = isHome ? 80 : 20;
      const yEnd = isHome ? 55 : 45;
      const yRange = Math.abs(yBase - yEnd);
      const yStep = linesCount > 1 ? yRange / (linesCount - 1) : 0;
      const y = isHome ? yBase - lineIdx * yStep : yBase + lineIdx * yStep;

      // Distribuir los N jugadores horizontalmente
      for (let i = 0; i < count && playerIdx < players.length; i++) {
        const x = ((i + 1) / (count + 1)) * 100;
        result.push({ x, y, player: players[playerIdx] });
        playerIdx++;
      }
    });

    return result;
  }

  const homePositions = positionPlayers(homePlayers, homeFormation, true);
  const awayPositions = positionPlayers(awayPlayers, awayFormation, false);

  return (
    <div className="koru-pitch-container">
      <div className="koru-pitch-header">
        <span style={{ color: hc }}>{awayName} · {awayFormation}</span>
        <span style={{ color: ac, fontSize: 11, opacity: 0.7 }}>vs</span>
        <span style={{ color: hc }}>{homeName} · {homeFormation}</span>
      </div>
      <div className="koru-pitch">
        {/* Líneas de cancha */}
        <div className="koru-pitch-line halfway" />
        <div className="koru-pitch-circle" />
        <div className="koru-pitch-box top" />
        <div className="koru-pitch-box bottom" />

        {/* Players away (arriba) */}
        {awayPositions.map((pos, i) => (
          <div
            key={`away-${i}`}
            className="koru-pitch-player away"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: ac,
            }}
            title={`${pos.player.name}${pos.player.number ? ` #${pos.player.number}` : ""}`}
          >
            <span className="koru-pitch-player-num">{pos.player.number ?? ""}</span>
            <span className="koru-pitch-player-name">{pos.player.name.split(" ").slice(-1)[0]}</span>
          </div>
        ))}

        {/* Players home (abajo) */}
        {homePositions.map((pos, i) => (
          <div
            key={`home-${i}`}
            className="koru-pitch-player home"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              background: hc,
            }}
            title={`${pos.player.name}${pos.player.number ? ` #${pos.player.number}` : ""}`}
          >
            <span className="koru-pitch-player-num">{pos.player.number ?? ""}</span>
            <span className="koru-pitch-player-name">{pos.player.name.split(" ").slice(-1)[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KoruDetailScreen({
  detail,
  headerIcon,
  onClose,
  onSave,
  onExportPdf,
  block,
}: {
  detail: Detail;
  headerIcon: string;
  onClose: () => void;
  onSave?: (title: string, subtitle?: string) => void;
  onExportPdf?: () => void;
  // 🔴 TIER S: el UiBlock original se pasa para que los toggles de rows/steps
  // puedan incluir `blockData` en el CustomEvent. Así el handler en
  // KoruProvider puede auto-crear la entidad durable (Plan/ShoppingList/
  // Checklist) si no existe, haciendo que el toggle sea efectivo aún para
  // bloques transitorios del LLM.
  block?: UiBlock;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sections = detail.sections ?? [];
  const isEmpty = sections.length === 0;

  return createPortal(
    <div className="koru-roadmap" role="dialog" aria-label={detail.title}>
      <div className="koru-roadmap-screen">
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        {/* 🔴 v2: Sticky header — back (izq) / mini icon + condensed title (centro) / save (der) */}
        <header className="koru-detail-sticky-head">
          <button
            type="button"
            aria-label="Volver"
            className="koru-detail-sticky-back"
            onClick={onClose}
          >
            <Mat>arrow_back_ios_new</Mat>
          </button>
          <div className="koru-detail-mini-icon">
            <Mat>{headerIcon}</Mat>
          </div>
          <h2 className="koru-detail-mini-title">{detail.title}</h2>
          <button
            type="button"
            aria-label="Guardar"
            className="koru-detail-sticky-save"
            onClick={() => onSave?.(detail.title, detail.subtitle)}
          >
            <Mat>bookmark_border</Mat>
          </button>
        </header>

        <div className="koru-roadmap-header">
          <div className="koru-detail-hero-icon">
            <Mat>{headerIcon}</Mat>
          </div>
          <h1 className="koru-roadmap-title">{detail.title}</h1>
          {detail.subtitle && <p className="koru-roadmap-subtitle">{detail.subtitle}</p>}
        </div>

        <div className="koru-roadmap-modules">
          {isEmpty ? (
            <div className="koru-unified-empty koru-detail-empty">
              <Mat>inbox</Mat>
              <span>No hay secciones para mostrar en este detalle.</span>
            </div>
          ) : (
            sections.map((section, i) => (
              <div
                key={i}
                className="koru-magical-card"
                style={{ ...moduleStyle(section.accent), "--stagger-i": i } as CSSProperties}
              >
                <SectionHead section={section} />
                <SectionBody section={section} block={block} />
              </div>
            ))
          )}
        </div>

        {/* 🔴 v2: Sticky footer — Save + PDF pinned al fondo con blur backdrop */}
        <div className="koru-detail-actions-sticky">
          <button
            type="button"
            className="koru-dsec-action-btn koru-dsec-action-save"
            onClick={() => onSave?.(detail.title, detail.subtitle)}
          >
            <span className="material-symbols-outlined">bookmark_added</span>
            <span>Guardar</span>
          </button>
          {onExportPdf && (
            <button
              type="button"
              className="koru-dsec-action-btn koru-dsec-action-pdf"
              onClick={onExportPdf}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              <span>PDF</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
