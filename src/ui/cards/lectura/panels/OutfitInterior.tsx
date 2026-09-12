/**
 * OutfitInterior — card "Qué me pongo" del catálogo (#p-outfit), integrada
 * al block real `outfit` (specs label/value + buttonLabel).
 *
 * Concepto: look board editorial — hero fotográfico del look completo con
 * productos reales del paquete /stitch/outfits + tiles con swatches.
 * Bind real: título, chips de condición (Temp/Viento/UV desde specs),
 * notas de aire/sol derivadas de specs presentes, buttonLabel.
 * Las fotos son el arte editorial del look (el block outfit no lleva
 * imágenes por diseño; el look sugerido es el contenido visual).
 */
import {
  BadgeCheck,
  Briefcase,
  Check,
  Shirt,
  Shuffle,
  Sun,
  Thermometer,
  Watch,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-outfit.css";

type OutfitBlock = Extract<UiBlock, { type: "outfit" }>;
type Spec = NonNullable<OutfitBlock["specs"]>[number];

function specValue(specs: Spec[] | undefined, re: RegExp): string | null {
  const found = (specs ?? []).find((s) => re.test(s.label.toLowerCase()));
  return found?.value ?? null;
}

/** Notas honestas: solo las que el block realmente trae (viento/sol/uv). */
function adviceNotes(specs: Spec[] | undefined): Array<{ icon: LucideIcon; tint: string; label: string; text: string }> {
  const notes: Array<{ icon: LucideIcon; tint: string; label: string; text: string }> = [];
  const wind = specValue(specs, /viento|aire|brisa/);
  if (wind) {
    notes.push({
      icon: Wind,
      tint: "var(--sky-soft)",
      label: "Aire:",
      text: `con ${wind} la capa va y viene — atala a la cintura cuando cierre la tarde.`,
    });
  }
  const uv = specValue(specs, /uv|sol/);
  if (uv) {
    notes.push({
      icon: Sun,
      tint: "var(--honey-soft)",
      label: "Sol:",
      text: `índice ${uv} — el lino claro marca transpiración, lleva repuesto si vas a caminar.`,
    });
  }
  return notes;
}

export function OutfitInterior({ block, onClose, onSave }: LecturaInteriorProps<OutfitBlock>) {
  const specs = block.specs ?? [];
  const temp = specValue(specs, /temp|máx|max|ahora|grado/);
  const night = specValue(specs, /mín|min|noche/);
  const notes = adviceNotes(specs);
  const altsRef = ({ current: null } as { current: HTMLDivElement | null });

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(block.title ?? "Look del día", temp ? `${temp} de día` : undefined) : undefined}
      chip={{ label: "Qué me pongo", background: "linear-gradient(135deg,#8ab0ff,#1A237E)" }}
      ariaLabel={block.title ?? "Look del día"}
    >
      <div id="p-outfit" className="lcr-panel">
        <div className="lk-head rv">
          <h1>
            <small>Look para hoy{temp ? ` · ${temp}` : ""}</small>
            {block.title ?? "Lo que yo te pondría"}
          </h1>
          <p>
            Viendo el clima que viene{temp && night ? ` (${temp} de día, ${night} a la noche)` : ""}:
            fresco de día, fresquito a la noche.
          </p>
        </div>
        <div className="lk-board rv">
          <div className="lk-cond">
            <span className="cc">
              <Ic i={Thermometer} className="ic" />
              {temp && night ? `${temp} ahora · ${night} a la noche` : temp ? `${temp} ahora` : "look de entresemana"}
            </span>
            <b>TONO TIERRA</b>
          </div>
          <div className="lk-hero">
            <img src="/stitch/outfits/outfit-man-2.jpg" alt="Look completo del día" />
            <span className="fit"><Ic i={Shirt} className="ic" />el look completo</span>
            <div className="brand">
              <span className="b1"><Ic i={BadgeCheck} className="ic" />look armado por Michi</span>
              <span className="b2">3 piezas · 1 detalle</span>
            </div>
          </div>
          <div className="lk-grid">
            <div className="lk-tile ph">
              <div className="im">
                <img src="/stitch/outfits/prod-jacket.jpg" alt="Campera denim" />
                <span className="sw" style={{ background: "#5b7a9d" }}></span>
              </div>
              <div className="tx"><div className="k">Capa</div><div className="n">Campera denim</div><div className="c">para las 20 h, no antes</div></div>
            </div>
            <div className="lk-tile ph">
              <div className="im">
                <img src="/stitch/outfits/prod-jeans-2.jpg" alt="Pantalón azul oscuro" />
                <span className="sw" style={{ background: "#31425c" }}></span>
              </div>
              <div className="tx"><div className="k">Abajo</div><div className="n">Pantalón azul oscuro</div><div className="c">el recto, no el skinny</div></div>
            </div>
            <div className="lk-tile"><span className="sw" style={{ background: "#f5efe6" }}></span><div className="tic"><Ic i={Shirt} className="ic" /></div><div className="k">Arriba</div><div className="n">Camisa lino crema</div><div className="c">la que va planchada mejor</div></div>
            <div className="lk-tile"><span className="sw" style={{ background: "#e8e2d6" }}></span><div className="tic"><Ic i={Watch} className="ic" /></div><div className="k">Detalle</div><div className="n">Reloj correa clara</div><div className="c">compite con el denim — bien</div></div>
            <div className="lk-tile shoe ph">
              <div className="im">
                <img src="/stitch/outfits/prod-sneakers.jpg" alt="Zapatillas off-white" />
                <span className="sw" style={{ background: "#efece4" }}></span>
              </div>
              <div className="tx"><div className="k">Pies</div><div className="n">Zapatillas off-white</div><div className="c">con este calor ni lo dudes — no medias cortas por favor</div></div>
            </div>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="lk-notes rv">
            {notes.map((n, i) => (
              <div className="lnote" key={i}>
                <div className="lic" style={{ background: n.tint }}><Ic i={n.icon} className="ic" /></div>
                <p><b>{n.label}</b> {n.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="lk-alts rv" ref={altsRef}>
          <h3>Si quieres otra línea</h3>
          <div className="lk-alt">
            <div className="aic"><Ic i={Shirt} className="ic" /></div>
            <div><b>Versión relaxed</b><br /><span>remera oversize blanca + jeans claros</span></div>
            <span className="go">ver →</span>
          </div>
          <div className="lk-alt">
            <div className="aic"><Ic i={Briefcase} className="ic" /></div>
            <div><b>Versión estructurada</b><br /><span>chaleco beige + pantalón de sastre</span></div>
            <span className="go">ver →</span>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => (onSave ? onSave(block.title ?? "Look del día", temp ?? undefined) : onClose())}
          >
            <Ic i={Check} className="ic" />{block.buttonLabel ?? "Guardar este look"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => altsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Ic i={Shuffle} className="ic" />Otra combinación
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
