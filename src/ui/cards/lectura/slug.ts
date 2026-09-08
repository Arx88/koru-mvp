/**
 * Slugs e ids sintéticos de checklists — UNA sola fuente de verdad.
 *
 * El contrato: la card `smart_checklist` (CheckInterior) despacha
 * `toggle_checklist` con ids derivados del título/labels; el
 * auto-create de KoruProvider y el Crear→Lista de CreateScreen deben
 * derivar EXACTAMENTE los mismos ids para que la card reabierta
 * golpee el MISMO checklist durable (sin duplicados ni toggles muertos).
 */

/** Slug determinista (lowercase, sin acentos, [^a-z0-9] → "_", máx 48). */
export function checklistSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "untitled"
  );
}

/** Id del checklist durable asociado a un título de lista. */
export function checklistIdFor(title: string): string {
  return `checklist_${checklistSlug(title)}`;
}

/** Id del item i-ésimo (por label) dentro del checklist. */
export function checklistItemIdFor(label: string, i: number): string {
  return `citem_${checklistSlug(label)}_${i}`;
}
