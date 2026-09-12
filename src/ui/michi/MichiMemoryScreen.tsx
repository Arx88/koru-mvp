import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  Search,
  Sparkles,
  Trash2,
  X,
  PawPrint, Heart, Clock3, Laptop, Music2, Tv, BookHeart, Briefcase, Users, Target, Activity,
} from "lucide-react";
import { useKoru, type Memory, type MemoryStatus } from "../KoruProvider";
import { WorldObject } from "./WorldObject";

const STATUS: Record<MemoryStatus, string> = {
  reciente: "Por confirmar",
  confirmada: "Guardado",
  dudosa: "Por confirmar",
  importante: "Muy tuyo",
  sensible: "Delicado",
  archived: "Archivado",
  superseded: "Actualizado",
  rejected: "Descartado",
};
const CATEGORIES = {
  rutina: "Tus rituales",
  trabajo: "Tus proyectos",
  relacion: "Tu gente",
  preferencia: "Tus gustos",
  objetivo: "Tus sueños",
  salud: "Tu bienestar",
};
const isPending = (memory: Memory) =>
  (memory.domainStatus ??
    (memory.status === "confirmada" ? "confirmed" : "candidate")) ===
  "candidate";

export function MemoryScreen({ onTalk }: { onTalk?: () => void }) {
  const { memories, confirmMemory, pruneMemory, editMemory, toggleMemoryUse } =
    useKoru();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const selected = memories.find((memory) => memory.id === selectedId);
  const pending = memories.filter(isPending).length;
  const filtered = memories.filter(
    (memory) =>
      (filter !== "pending" || isPending(memory)) &&
      (filter !== "saved" || !isPending(memory)) &&
      `${memory.text} ${CATEGORIES[memory.category]}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
  );
  return (
    <div className="mx-page-content mw-memory">
      <header className="mw-memory-heading">
        <div><span className="mw-eyebrow">MICHI SE ACUERDA</span><h1>Memoria</h1><p>Tus gustos, tu gente y lo que te importa. Cada recuerdo ayuda a Michi a conocerte mejor.</p></div>
        <img className="mh-header-art" src="/assets/michi-cards/memory.webp" alt="" width="400" height="400" />
      </header>
      <div className="mw-memory-tickets" aria-label="Resumen de recuerdos">
        <div>
          <BookHeart className="mh-ticket-icon" />
          <strong>{memories.length}</strong>
          <span>recuerdos</span>
        </div>
        <div>
          <Clock3 className="mh-ticket-icon" />
          <strong>{pending}</strong>
          <span>por confirmar</span>
        </div>
        <div>
          <Heart className="mh-ticket-icon" fill="#ff4e91" />
          <strong>{memories.length - pending}</strong>
          <span>vos decidís</span>
        </div>
      </div>
      <section className="mw-pocket-content" aria-label="Tus recuerdos">
        <div className="mw-section-title">
          <PawPrint size={27} fill="#4f7cff" /><div><h2>Recuerdos contigo</h2><p>Todo lo que vamos aprendiendo juntos.</p></div>
        </div>
        {memories.length > 0 && (
          <>
            <label className="mw-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscá un recuerdo…"
                aria-label="Buscar recuerdos"
              />
            </label>
            <div className="mw-filters" aria-label="Filtrar recuerdos">
              {[
                ["all", "Todos"],
                ["pending", "Por confirmar"],
                ["saved", "Guardados"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {filtered.length ? (
          <ul className="mw-memory-list">
            {filtered.map((memory) => (
              <li key={memory.id}>
                <button
                  className="mw-keepsake"
                  onClick={() => setSelectedId(memory.id)}
                  type="button"
                >
                  <MemoryIcon memory={memory} />
                  <span className="mh-memory-copy">
                  <span className="mw-keepsake-top">
                    <span>{CATEGORIES[memory.category]}</span>
                    <span
                      className={isPending(memory) ? "mw-pending" : "mw-kept"}
                    >
                      {isPending(memory) ? (
                        <Sparkles size={12} />
                      ) : (
                        <Check size={12} />
                      )}
                      {STATUS[memory.status]}
                    </span>
                  </span>
                  <p>{memory.text}</p>
                  <span className="mw-keepsake-foot">
                    {memory.savedOn}
                    <ChevronRight size={17} />
                  </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mw-pocket-empty">
            <h3>
              {memories.length
                ? "No aparece por acá"
                : "Nuestro primer recuerdo\nnos está esperando"}
            </h3>
            <p>
              {memories.length
                ? "Probá con otras palabras o cambiá el filtro."
                : "Tu café favorito, alguien que querés, un sueño pendiente… Contáselo a Michi y elegí qué conservar."}
            </p>
            {!memories.length && onTalk && (
              <button className="mw-primary" type="button" onClick={onTalk}>
                <MessageCircle size={18} /> Contarle algo a Michi
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        )}
        <p className="mw-memory-promise">
          <LockKeyhole size={14} /> Podés editar u olvidar cualquier recuerdo.
        </p>
        <p role="status" className="mw-status">
          {notice}
        </p>
      </section>
      <p className="mh-memory-footer"><PawPrint size={20} fill="currentColor" />Conocerte hace todo más especial <Heart size={14} fill="currentColor" /></p>
      {selected && (
        <MemoryDetail
          key={selected.id}
          memory={selected}
          onClose={() => setSelectedId(null)}
          onConfirm={() => {
            confirmMemory(selected.id);
            setSelectedId(null);
            setNotice("Listo. Michi guardó este recuerdo.");
          }}
          onForget={() => {
            pruneMemory(selected.id);
            setSelectedId(null);
            setNotice("Michi dejó de usar este recuerdo.");
          }}
          onEdit={(text) => editMemory(selected.id, text)}
          onToggleUse={() => toggleMemoryUse(selected.id)}
        />
      )}
    </div>
  );
}

function MemoryIcon({ memory }: { memory: Memory }) {
  const text = memory.text.toLocaleLowerCase();
  const Icon = /guitarr|música|musica|canción/.test(text) ? Music2 : /serie|película|pelicula|televis/.test(text) ? Tv : /\bia\b|informe|tecnolog|computador/.test(text) ? Laptop : ({ trabajo: Briefcase, relacion: Users, objetivo: Target, salud: Activity, rutina: Clock3, preferencia: Heart })[memory.category];
  return <span className="mh-memory-icon" aria-hidden="true"><Icon size={30} /></span>;
}

function MemoryDetail({
  memory,
  onClose,
  onConfirm,
  onForget,
  onEdit,
  onToggleUse,
}: {
  memory: Memory;
  onClose: () => void;
  onConfirm: () => void;
  onForget: () => void;
  onEdit: (value: string) => void;
  onToggleUse: () => void;
}) {
  const [draft, setDraft] = useState(memory.text);
  const [forget, setForget] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="mw-memory-dialog"
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="memory-detail-title"
    >
      <div className="mw-dialog-inner">
        <button
          className="mw-icon-button mw-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar recuerdo"
        >
          <X size={20} />
        </button>
        <WorldObject kind="memory" />
        <span className="mw-eyebrow">{CATEGORIES[memory.category]}</span>
        <h2 id="memory-detail-title">Lo que Michi recuerda</h2>
        <p className="mw-dialog-intro">
          Así lo recuerda Michi. Podés cambiarlo.
        </p>
        <label className="mw-field">
          Tu recuerdo
          <textarea
            aria-label="Editar memoria"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        {draft.trim() !== memory.text && (
          <button
            className="mw-primary"
            type="button"
            disabled={!draft.trim()}
            onClick={() => onEdit(draft.trim())}
          >
            <Check size={18} /> Guardar cambio
          </button>
        )}
        <div className="mw-source">
          <span>De dónde viene</span>
          <p>{memory.origin}</p>
          <small>{memory.savedOn}</small>
        </div>
        <label className="mw-use-memory">
          <span>
            <strong>Ayudarme con este recuerdo</strong>
            <small>Michi podrá usarlo en sus sugerencias.</small>
          </span>
          <input
            type="checkbox"
            checked={memory.useForSuggestions}
            onChange={onToggleUse}
            aria-label="Usar memoria para sugerencias"
          />
        </label>
        {isPending(memory) && (
          <button className="mw-primary" type="button" onClick={onConfirm}>
            <Check size={18} /> Confirmar recuerdo
          </button>
        )}
        {forget ? (
          <div className="mw-forget-confirm">
            <p>¿Querés que Michi olvide este recuerdo?</p>
            <button type="button" onClick={onForget}>
              Sí, olvidar
            </button>
            <button type="button" onClick={() => setForget(false)}>
              Conservar
            </button>
          </div>
        ) : (
          <button
            className="mw-text-button"
            type="button"
            onClick={() => setForget(true)}
          >
            <Trash2 size={16} /> Olvidar este recuerdo
          </button>
        )}
      </div>
    </dialog>
  );
}
