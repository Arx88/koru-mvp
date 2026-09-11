import { useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Heart,
  MapPin,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import type { Person, UserProfile } from "../../domain/types";
import { useMichiUserAvatar } from "./v8Shared";
import { MichiUserAvatarDialog } from "./MichiDialogs";
import { WorldObject } from "./WorldObject";
import { useMichiProgress } from "./useMichiProgress";

function birthdayLabel(value?: string) {
  if (!value) return "Tu día especial";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es", { day: "numeric", month: "long" });
}
const detectedTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const timezoneOptions = [
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Mexico_City",
  "America/Bogota",
  "America/Santiago",
  "America/Lima",
  "Europe/Madrid",
  "Europe/London",
  "US/Eastern",
  "US/Pacific",
  "UTC",
];
const profileDraft = (profile: UserProfile) => ({
  name: profile.name ?? "",
  birthday: profile.birthday ?? "",
  city: profile.location ?? profile.homeCity ?? "",
  timezone:
    profile.timezone && profile.timezone !== "auto"
      ? profile.timezone
      : detectedTimezone(),
});

export function MichiProfile({
  profile,
  onUpdate,
  people,
  onAddPerson,
  memoryCount,
}: {
  profile: UserProfile;
  onUpdate: (patch: Partial<UserProfile>) => void;
  people: Person[];
  onAddPerson?: (
    name: string,
    relationship?: string,
    birthday?: string,
  ) => void;
  memoryCount: number;
}) {
  const { userAvatar, chooseUserAvatar } = useMichiUserAvatar();
  const { level } = useMichiProgress();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(() => profileDraft(profile));
  const [person, setPerson] = useState({
    name: "",
    relationship: "",
    birthday: "",
  });
  const edit = () => {
    setDraft(profileDraft(profile));
    setSaved(false);
    setEditing(true);
  };
  return (
    <section className="mw-passport" aria-label="Tu perfil de Michi">
      <div className="mw-passport-body">
        <div className="mw-passport-identity">
          <button
            className="mw-portrait"
            type="button"
            onClick={() => setAvatarOpen(true)}
            aria-label="Cambiar mi avatar"
          >
            <img src={userAvatar} alt="Tu avatar" width={96} height={96} />
            <span>
              <Camera size={14} />
            </span>
          </button>

        </div>
        <div className="mw-profile-name">
          <div>
            <span className="mw-eyebrow">ASÍ TE CONOCE MICHI</span>
            <h2>{profile.name?.trim() || "¡Hola!"}</h2>
          </div>
          <button
            className="mw-icon-button"
            type="button"
            onClick={edit}
            aria-label="Editar mi perfil"
          >
            <Pencil size={18} />
          </button>
        </div>
        <p className="mw-profile-line">
          <MapPin size={14} />
          {profile.location || profile.homeCity || "Agregá tu ciudad"}
        </p>
        <div className="mw-passport-stats">
          <span>
            <b>{level}</b>nivel con Michi
          </span>
          <span>
            <b>{memoryCount}</b>recuerdos contigo
          </span>
          <span>
            <b>{people.length}</b>personas cercanas
          </span>
        </div>
        {editing ? (
          <form
            className="mw-profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              onUpdate({
                name: draft.name.trim(),
                birthday: draft.birthday,
                location: draft.city.trim(),
                homeCity: draft.city.trim(),
                timezone: draft.timezone,
              });
              setEditing(false);
              setSaved(true);
            }}
          >
            <div className="mw-section-title">
              <h3>Hagámoslo más tuyo</h3>
              <button
                type="button"
                className="mw-icon-button"
                onClick={() => setEditing(false)}
                aria-label="Cancelar edición"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mw-field">
              ¿Cómo te llamás?
              <input
                autoFocus
                name="name"
                aria-label="Nombre"
                value={draft.name}
                placeholder="Tu nombre"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <div className="mw-profile-fields">
              <label className="mw-field">
                Tu cumpleaños
                <input
                  type="date"
                  aria-label="Cumpleaños"
                  value={draft.birthday}
                  onChange={(e) =>
                    setDraft({ ...draft, birthday: e.target.value })
                  }
                />
              </label>
              <label className="mw-field">
                Tu ciudad
                <input
                  aria-label="Ciudad"
                  value={draft.city}
                  placeholder="¿Dónde empieza tu día?"
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </label>
            </div>
            <label className="mw-field">
              Tu zona horaria
              <select
                aria-label="Zona horaria"
                value={draft.timezone}
                onChange={(e) =>
                  setDraft({ ...draft, timezone: e.target.value })
                }
              >
                {Array.from(
                  new Set([
                    draft.timezone,
                    detectedTimezone(),
                    ...timezoneOptions,
                  ]),
                ).map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
            <button className="mw-primary" type="submit">
              <Check size={18} /> Guardar perfil
            </button>
          </form>
        ) : (
          <>
            <button className="mw-profile-detail" type="button" onClick={edit}>
              <span className="mw-detail-badge">✦</span>
              <span>
                <small>Un día para celebrar</small>
                <strong>{birthdayLabel(profile.birthday)}</strong>
              </span>
              <ChevronRight size={18} />
            </button>
            <button
              className="mw-profile-detail"
              type="button"
              onClick={() => setAvatarOpen(true)}
            >
              <WorldObject kind="profile" />
              <span>
                <small>Tu avatar de conversación</small>
                <strong>Elegí entre 15 avatares</strong>
              </span>
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {saved && (
          <p className="mw-status" role="status">
            <Check size={15} /> Tu perfil está actualizado.
          </p>
        )}
        <div className="mw-your-people">
          <div className="mw-section-title">
            <h3>
              <Heart size={16} /> Tu gente
            </h3>
            <button
              className="mw-icon-button"
              type="button"
              aria-label="Agregar persona"
              onClick={() => setPersonOpen((v) => !v)}
            >
              <Plus size={18} />
            </button>
          </div>
          <p>Las personas que querés tener presentes.</p>
          {people.length ? (
            <ul>
              {people.map((p) => (
                <li key={p.id}>
                  <span className="mw-person-initial">
                    {p.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.relationship || "Alguien especial"}</small>
                  </span>
                  {p.birthday && <small>{birthdayLabel(p.birthday)}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mw-people-empty">
              Tu gente también tiene un lugar acá.
            </p>
          )}
          {personOpen && (
            <form
              className="mw-profile-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!person.name.trim() || !onAddPerson) return;
                onAddPerson(
                  person.name.trim(),
                  person.relationship.trim() || undefined,
                  person.birthday || undefined,
                );
                setPerson({ name: "", relationship: "", birthday: "" });
                setPersonOpen(false);
              }}
            >
              <label className="mw-field">
                Nombre
                <input
                  required
                  aria-label="Nombre de la persona"
                  value={person.name}
                  onChange={(e) =>
                    setPerson({ ...person, name: e.target.value })
                  }
                />
              </label>
              <label className="mw-field">
                Qué lugar ocupa en tu vida
                <input
                  aria-label="Relación"
                  placeholder="Amiga, hermano, pareja…"
                  value={person.relationship}
                  onChange={(e) =>
                    setPerson({ ...person, relationship: e.target.value })
                  }
                />
              </label>
              <label className="mw-field">
                Cumpleaños (opcional)
                <input
                  type="date"
                  aria-label="Cumpleaños de la persona"
                  value={person.birthday}
                  onChange={(e) =>
                    setPerson({ ...person, birthday: e.target.value })
                  }
                />
              </label>
              <button
                className="mw-primary"
                type="submit"
                disabled={!person.name.trim() || !onAddPerson}
              >
                <Heart size={17} /> Guardar persona
              </button>
            </form>
          )}
        </div>
      </div>
      {avatarOpen && (
        <MichiUserAvatarDialog
          userAvatar={userAvatar}
          onChoose={chooseUserAvatar}
          onClose={() => setAvatarOpen(false)}
        />
      )}
    </section>
  );
}
