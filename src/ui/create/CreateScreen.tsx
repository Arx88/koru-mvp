import { useState } from "react";
import { createPortal } from "react-dom";
import { useKoru } from "../KoruProvider";

// 🔴 CreateScreen — entrada para que el usuario cree contenido estructurado
// SIN tener que pedirselo a Koru via chat. MVP: Nota, Lista, Gasto (per CEO).
// Las plantillas se guardan como LifeRecords via createRecord() (directo, sin LLM).

function Mat({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

type Template = "nota" | "lista" | "gasto" | "enlace";

type TemplateDef = {
  id: Template;
  label: string;
  icon: string;
  desc: string;
  collection: string;
  accent: string;
};

const TEMPLATES: TemplateDef[] = [
  { id: "nota", label: "Nota", icon: "sticky_note_2", desc: "Anotá una idea o pensamiento", collection: "Notas", accent: "#8363f9" },
  { id: "lista", label: "Lista", icon: "checklist", desc: "Lista de tareas o compras", collection: "Listas", accent: "#2d6a4f" },
  { id: "gasto", label: "Gasto", icon: "payments", desc: "Registrá un gasto", collection: "Gastos", accent: "#f59e0b" },
  { id: "enlace", label: "Enlace", icon: "link", desc: "Guardá un link para después", collection: "Enlaces", accent: "#06b6d4" },
];

export function CreateScreen({ onClose }: { onClose: () => void }) {
  const { createRecord } = useKoru();
  const [selected, setSelected] = useState<Template | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [url, setUrl] = useState("");
  const [listItems, setListItems] = useState<string[]>([""]);
  const [collection, setCollection] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle(""); setNotes(""); setAmount(""); setUrl(""); setListItems([""]); setCollection("");
  }

  async function handleSave() {
    if (!selected) return;
    const tpl = TEMPLATES.find(t => t.id === selected)!;
    const finalCollection = collection.trim() || tpl.collection;

    if (selected === "lista") {
      const items = listItems.filter(i => i.trim());
      const listText = items.map(i => `• ${i}`).join("\n");
      setSaving(true);
      await createRecord({
        title: title.trim() || "Lista sin título",
        collection: finalCollection,
        notes: listText,
        kind: "lista",
      });
      setSaving(false);
      reset();
      setSelected(null);
      return;
    }

    if (selected === "gasto") {
      const amt = parseFloat(amount) || 0;
      setSaving(true);
      await createRecord({
        title: title.trim() || "Gasto",
        collection: finalCollection,
        notes: `${currency} ${amt}`,
        kind: "gasto",
      });
      setSaving(false);
      reset();
      setSelected(null);
      return;
    }

    if (selected === "enlace") {
      setSaving(true);
      await createRecord({
        title: title.trim() || url.trim() || "Enlace",
        collection: finalCollection,
        url: url.trim(),
        notes: notes.trim() || undefined,
        kind: "enlace",
      });
      setSaving(false);
      reset();
      setSelected(null);
      return;
    }

    // nota (default)
    setSaving(true);
    await createRecord({
      title: title.trim() || "Nota sin título",
      collection: finalCollection,
      notes: notes.trim() || undefined,
      kind: "nota",
    });
    setSaving(false);
    reset();
    setSelected(null);
  }

  return createPortal(
    <div className="koru-create-overlay" role="dialog" aria-label="Crear">
      <div className="koru-create-screen">
        <div className="koru-create-header">
          <button type="button" aria-label="Volver" className="koru-create-back" onClick={() => selected ? setSelected(null) : onClose()}>
            <Mat>arrow_back_ios_new</Mat>
          </button>
          <h1 className="koru-create-title">
            {selected ? TEMPLATES.find(t => t.id === selected)!.label : "¿Qué querés crear?"}
          </h1>
          <button type="button" aria-label="Cerrar" className="koru-create-close" onClick={onClose}>
            <Mat>close</Mat>
          </button>
        </div>

        {!selected ? (
          <div className="koru-create-templates">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="koru-create-template"
                onClick={() => { setSelected(tpl.id); setCollection(tpl.collection); }}
              >
                <div className="koru-create-template-icon" style={{ background: `${tpl.accent}20`, color: tpl.accent }}>
                  <Mat>{tpl.icon}</Mat>
                </div>
                <div className="koru-create-template-body">
                  <span className="koru-create-template-label">{tpl.label}</span>
                  <span className="koru-create-template-desc">{tpl.desc}</span>
                </div>
                <Mat className="koru-create-template-arrow">arrow_forward</Mat>
              </button>
            ))}
          </div>
        ) : (
          <div className="koru-create-form">
            <label className="koru-create-field">
              <span className="koru-create-field-label">
                {selected === "gasto" ? "Concepto" : selected === "lista" ? "Título de la lista" : selected === "enlace" ? "Título" : "Título"}
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selected === "gasto" ? "Ej: Café con amigos" : selected === "lista" ? "Ej: Super de la semana" : "Ej: Idea para el proyecto"}
                autoFocus
              />
            </label>

            {selected === "gasto" && (
              <label className="koru-create-field koru-create-field-row">
                <div>
                  <span className="koru-create-field-label">Monto</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <span className="koru-create-field-label">Moneda</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </label>
            )}

            {selected === "enlace" && (
              <label className="koru-create-field">
                <span className="koru-create-field-label">URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
            )}

            {selected === "lista" && (
              <div className="koru-create-field">
                <span className="koru-create-field-label">Items</span>
                <div className="koru-create-list-items">
                  {listItems.map((item, i) => (
                    <div key={i} className="koru-create-list-item">
                      <span className="koru-create-list-bullet">•</span>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...listItems];
                          next[i] = e.target.value;
                          setListItems(next);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && i === listItems.length - 1 && item.trim()) {
                            setListItems([...listItems, ""]);
                          }
                        }}
                        placeholder={`Item ${i + 1}`}
                      />
                      {listItems.length > 1 && (
                        <button
                          type="button"
                          aria-label="Quitar"
                          className="koru-create-list-remove"
                          onClick={() => setListItems(listItems.filter((_, idx) => idx !== i))}
                        >
                          <Mat>remove_circle</Mat>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="koru-create-list-add"
                    onClick={() => setListItems([...listItems, ""])}
                  >
                    <Mat>add</Mat> Agregar item
                  </button>
                </div>
              </div>
            )}

            {(selected === "nota" || selected === "enlace") && (
              <label className="koru-create-field">
                <span className="koru-create-field-label">Notas (opcional)</span>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={selected === "nota" ? "Escribí lo que quieras recordar..." : "Agregá contexto sobre este enlace..."}
                />
              </label>
            )}

            <label className="koru-create-field">
              <span className="koru-create-field-label">Carpeta</span>
              <input
                type="text"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder={TEMPLATES.find(t => t.id === selected)?.collection}
              />
            </label>

            <div className="koru-create-actions">
              <button
                type="button"
                className="koru-create-action-cancel"
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="koru-create-action-save"
                onClick={handleSave}
                disabled={saving || (!title.trim() && selected !== "gasto")}
                style={{ background: TEMPLATES.find(t => t.id === selected)?.accent }}
              >
                {saving ? (
                  <><Mat>hourglass_top</Mat> Guardando…</>
                ) : (
                  <><Mat>check</Mat> Guardar</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
