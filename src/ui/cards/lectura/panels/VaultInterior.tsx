/**
 * VaultInterior — card "Todo lo que Koru sabe de vos" (#p-vault), bind real
 * del block `saved_record` (records[] múltiples — la colección/bóveda).
 *
 * Los records[] REALES (LifeRecord) arman la grilla: kind como categoría,
 * título, value/notes como detalle, foto SOLO si el record trae attachment
 * de imagen (sin fotos inventadas). La búsqueda es REAL: filtra la grilla
 * por título/valor/notas/persona. Stats honestos: registros, dominios
 * distintos y el dato de privacidad (todo local).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Vault,
  Search,
  Cake,
  Gift,
  Banknote,
  Pill,
  Lightbulb,
  Wrench,
  Bell,
  Home,
  Utensils,
  Database,
  LockKeyhole,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { UiBlock } from "../../../../domain/types";
import { getAttachmentObjectURL } from "../../../../domain/attachments";
import { Ic } from "../Ic";
import { LecturaShell } from "../LecturaShell";
import type { LecturaInteriorProps } from "../index";
import "./p-vault.css";

type VaultBlock = Extract<UiBlock, { type: "saved_record" }>;
type Record_ = VaultBlock["records"][number];

const KIND_ICONS: Array<{ re: RegExp; Icon: LucideIcon; bg: string; color: string }> = [
  { re: /birthday|person_followup/, Icon: Cake, bg: "var(--rose-soft)", color: "var(--rose-ink)" },
  { re: /gift/, Icon: Gift, bg: "var(--sky-soft)", color: "var(--sky-ink)" },
  { re: /expense|shopping_item/, Icon: Banknote, bg: "var(--mint-soft)", color: "var(--mint-ink)" },
  { re: /medication|medical_info|sleep/, Icon: Pill, bg: "var(--rose-soft)", color: "var(--rose-ink)" },
  { re: /idea|decision/, Icon: Lightbulb, bg: "var(--violet-soft)", color: "var(--violet-ink)" },
  { re: /tool_link|home_task/, Icon: Wrench, bg: "var(--honey-soft)", color: "var(--honey-ink)" },
  { re: /deadline|meeting_note/, Icon: Bell, bg: "var(--sky-soft)", color: "var(--sky-ink)" },
  { re: /meal_inventory/, Icon: Utensils, bg: "var(--honey-soft)", color: "var(--honey-ink)" },
];
const FALLBACK_ICON = { Icon: Home, bg: "var(--paper2)", color: "var(--ink-soft)" };

function iconFor(r: Record_) {
  return KIND_ICONS.find((k) => k.re.test(r.kind)) ?? FALLBACK_ICON;
}

/** Imagen real del attachment (IndexedDB) — resuelve object URL on mount. */
function AttachmentImg({ blobKey, alt }: { blobKey: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    const id = blobKey.replace(/^attachment_/, "");
    void getAttachmentObjectURL(id).then((u) => {
      if (alive && u) {
        objectUrl = u;
        setUrl(u);
      }
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blobKey]);
  return url ? <img src={url} alt={alt} /> : null;
}

export function VaultInterior({ block, onClose, onSave }: LecturaInteriorProps<VaultBlock>) {
  const [query, setQuery] = useState("");
  const records = block.records ?? [];
  const title = block.title || "Tu bóveda";

  const domains = new Set(records.map((r) => r.domain));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      `${r.title} ${r.value ?? ""} ${r.notes ?? ""} ${r.person ?? ""} ${r.collection ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [query, records]);

  return (
    <LecturaShell
      onClose={onClose}
      onBookmark={onSave ? () => onSave(title, `${records.length} recuerdos`) : undefined}
      chip={{ label: "Bóveda", background: "linear-gradient(135deg,#FF9EBE,#FF5A60)" }}
      ariaLabel={title}
    >
      <div id="p-vault" className="lcr-panel">
        <div className="vt-head rv">
          <h1>
            <small>{title}</small>
            Todo lo que Koru
            <br />
            sabe de vos
          </h1>
          <p>
            {records.length
              ? "Cada cosa que me contás queda acá adentro. Privada, buscable y siempre a mano."
              : "Por ahora está vacía: cada cosa que me cuentes va quedando acá."}
          </p>
        </div>

        <div className="vt-safe rv">
          <div className="vt-top">
            <div className="vt-dial">
              <Ic i={Vault} className="ic" />
            </div>
            <div className="t">
              <b>{title}</b>
              <span>
                {records.length} recuerdos · {domains.size} dominios
              </span>
            </div>
            <div className="cnt2">
              <b>{records.length}</b>
              <span>recuerdos</span>
            </div>
          </div>

          <div className="vt-search">
            <Ic i={Search} className="ic" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="buscá por título, persona, nota…"
              aria-label="Buscar en la bóveda"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", font: "600 11.5px var(--sans)", color: "var(--ink)" }}
            />
          </div>

          <div className="vt-grid">
            {filtered.slice(0, 6).map((r, i) => {
              const { Icon, bg, color } = iconFor(r);
              const imgAttachment = r.attachments?.find((a) => a.mimeType.startsWith("image/"));
              const hasPhoto = Boolean(imgAttachment);
              return (
                <div className={`vt-mem${hasPhoto ? "" : " no-ph"}`} key={`rec_${i}_${r.title}`}>
                  <div className="mp">
                    {imgAttachment && <AttachmentImg blobKey={imgAttachment.blobKey} alt={r.title} />}
                    <span className="mk2">{r.kind.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt2">
                    {!hasPhoto && (
                      <div className="mi2" style={{ background: bg, color }}>
                        <Ic i={Icon} className="ic" />
                      </div>
                    )}
                    <b>{r.title}</b>
                    <span>{r.value ?? r.notes ?? r.person ?? r.domain}</span>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && query && (
              <p style={{ gridColumn: "1/-1", font: "600 11px var(--sans)", color: "var(--ink-dim)", padding: "8px 2px" }}>
                Nada con “{query}” por ahora — probá con otra palabra.
              </p>
            )}
          </div>

          <div className="vt-stats">
            <div className="vt-stat vs1">
              <Ic i={Database} className="ic" />
              <b>{records.length}</b>
              <span>guardados</span>
            </div>
            <div className="vt-stat vs2">
              <Ic i={Smartphone} className="ic" />
              <b>{domains.size}</b>
              <span>dominios</span>
            </div>
            <div className="vt-stat vs3">
              <Ic i={LockKeyhole} className="ic" />
              <b>100%</b>
              <span>en tu teléfono</span>
            </div>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const el = document.querySelector("#p-vault .vt-search input");
              if (el instanceof HTMLInputElement) el.focus();
            }}
          >
            <Ic i={Search} className="ic" />
            Buscar en la bóveda
          </button>
          <button type="button" className="btn ghost" onClick={() => onClose()}>
            <Ic i={LockKeyhole} className="ic" />
            Privacidad
          </button>
        </div>
      </div>
    </LecturaShell>
  );
}
