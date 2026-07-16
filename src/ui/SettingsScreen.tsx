import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  X,
  Search,
  ChevronDown,
  User,
  Languages,
  Palette,
  Bell,
  Shield,
  Plug,
  Brain,
  Accessibility,
  Check,
  Lock,
  Download,
  Trash2,
  CloudOff,
  Calendar,
  Landmark,
  Bitcoin,
  AlertTriangle,
} from "lucide-react";
import type {
  HeartbeatSettings,
  KoruState,
  MemoryFact,
  MemoryKind,
  Person,
  UserProfile,
  UserPreferences,
} from "../domain/types";
import { getGoogleAuthUrl } from "../tools/calendar/googleCalendar";

// ─────────────────────────────────────────────────────────────────────────────
// SettingsScreen — pantalla integrada de Ajustes (8 secciones colapsables).
// Reemplaza los toggles fragmentados que estaban dispersos por la app.
//
// Diseño: gradiente lila → blanco (#f0dbff → #f8f9ff), max-width 430px,
// header sticky con título "Ajustes" + botón cerrar, buscador de secciones,
// cards `.koru-magical-card` con icono + título + chevron rotatorio.
// ─────────────────────────────────────────────────────────────────────────────

export interface SettingsScreenProps {
  state: KoruState;
  onUpdateProfile: (profile: Partial<UserProfile>) => void;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  onUpdateLanguage: (lang: "es" | "en") => void;
  onUpdateHeartbeat: (settings: Partial<HeartbeatSettings>) => void;
  onToggleEphemeral: () => void;
  onToggleDurableMemory: () => void;
  onToggleWorldSignals: () => void;
  onToggleActionPreparation: () => void;
  onForgetMemory: (memoryId: string) => void;
  onExportData: () => void;
  onDeleteAllData: () => void;
  onClose: () => void;
  // 🔴 TIER S: addPerson — invoca al reducer addPerson del store desde el
  // sub-section "Personas" dentro de Perfil. Crea una Person durable
  // (state.people) con name + relationship + birthday.
  onAddPerson?: (name: string, relationship?: string, birthday?: string) => void;
}

type SectionId =
  | "perfil"
  | "idioma"
  | "apariencia"
  | "notificaciones"
  | "privacidad"
  | "integraciones"
  | "memoria"
  | "accesibilidad";

type SectionMeta = {
  id: SectionId;
  title: string;
  kicker: string;
  icon: typeof User;
  accent: string; // module-color
  tint: string;   // module-bg (icon background)
  keywords: string[];
};

const SECTIONS: SectionMeta[] = [
  { id: "perfil",         title: "Perfil",            kicker: "QUIÉN ERES",        icon: User,          accent: "#8127cf", tint: "#f3e8ff", keywords: ["nombre", "cumpleaños", "ciudad", "zona horaria", "timezone", "name", "birthday", "location"] },
  { id: "idioma",         title: "Idioma",            kicker: "ESPAÑOL / ENGLISH", icon: Languages,     accent: "#2563eb", tint: "#dbeafe", keywords: ["language", "español", "english", "spanish"] },
  { id: "apariencia",     title: "Apariencia",        kicker: "TEMA Y TIPOGRAFÍA", icon: Palette,       accent: "#db2777", tint: "#fce7f3", keywords: ["theme", "font", "tamaño", "haptics", "sonidos", "contraste", "movimiento", "dark", "light"] },
  { id: "notificaciones", title: "Notificaciones",    kicker: "ALERTEX Y DND",     icon: Bell,          accent: "#ea580c", tint: "#ffedd5", keywords: ["push", "dnd", "sonidos", "no molestar", "permiso"] },
  { id: "privacidad",     title: "Privacidad",        kicker: "TUS DATOS",         icon: Shield,        accent: "#16a34a", tint: "#dcfce7", keywords: ["ephemeral", "durable", "retention", "export", "eliminar", "lock", "webauthn", "borrar"] },
  { id: "integraciones",  title: "Integraciones",     kicker: "CONECTAR SERVICIOS",icon: Plug,          accent: "#0891b2", tint: "#cffafe", keywords: ["google", "calendar", "plaid", "tink", "banco", "crypto", "exchange", "sincronizar"] },
  { id: "memoria",        title: "Gestión de memoria",kicker: "LO QUE KORU SABE",  icon: Brain,         accent: "#7c3aed", tint: "#ede9fe", keywords: ["memoria", "memories", "forget", "olvidar", "sensible", "confianza"] },
  { id: "accesibilidad",  title: "Accesibilidad",     kicker: "INCLUSIÓN",         icon: Accessibility, accent: "#0d9488", tint: "#ccfbf1", keywords: ["screen reader", "lector", "movimiento", "contraste", "teclado", "keyboard", "a11y"] },
];

// Zonas horarias comunes para el override manual (lista corta + auto).
const COMMON_TIMEZONES = [
  "auto",
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "Europe/Madrid",
  "Europe/London",
  "US/Eastern",
  "US/Pacific",
  "UTC",
];

const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  profile: "Perfil",
  routine: "Rutina",
  preference: "Preferencia",
  goal: "Objetivo",
  relationship: "Relación",
  boundary: "Límite",
  retail: "Compras",
  wellbeing: "Bienestar",
  task: "Tarea",
};

const MEMORY_KIND_FILTERS: Array<{ value: "all" | MemoryKind; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "profile", label: "Perfil" },
  { value: "routine", label: "Rutina" },
  { value: "preference", label: "Preferencia" },
  { value: "goal", label: "Objetivo" },
  { value: "relationship", label: "Relación" },
  { value: "boundary", label: "Límite" },
  { value: "retail", label: "Compras" },
  { value: "wellbeing", label: "Bienestar" },
  { value: "task", label: "Tarea" },
];

const RETENTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "30",   label: "30 días" },
  { value: "60",   label: "60 días" },
  { value: "90",   label: "90 días" },
  { value: "180",  label: "180 días" },
  { value: "never",label: "Nunca (conservar todo)" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function formatLastSync(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

// ─── Primitivas UI ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="koru-toggle"
      style={{
        position: "relative",
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "none",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#8127cf" : "#cbd5e1",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 160ms ease",
        flex: "0 0 auto",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 160ms ease",
        }}
      />
    </button>
  );
}

function Row({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
        justifyContent: stacked ? "flex-start" : "space-between",
        gap: stacked ? 8 : 12,
        padding: "10px 0",
        borderBottom: "1px solid rgba(129, 39, 207, 0.08)",
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0b1c30" }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flex: stacked ? "1 1 auto" : "0 0 auto", minWidth: 0 }}>{children}</div>
    </div>
  );
}

function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel}
      style={{
        width: "100%",
        maxWidth: 220,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #e2d4f5",
        background: "rgba(255,255,255,0.8)",
        fontSize: 14,
        color: "#0b1c30",
        outline: "none",
      }}
    />
  );
}

/**
 * 🔴 TIER S: ProfileField — wrapper sobre TextInput que commitea el valor al
 * reducer (vía onCommit) SOLO en blur, no en cada keystroke. Así evitamos
 * re-renderizar todo el state tree + persistir en localStorage por cada tecla.
 * Mantiene estado local para que el input siga siendo responsivo.
 */
function ProfileField({
  label,
  value,
  onCommit,
  placeholder,
  type,
  ariaLabel,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  type?: string;
  ariaLabel?: string;
}) {
  const [local, setLocal] = useState(value);
  // Sync local state when the external value changes (ej. after onCommit
  // propagates back via props, or when another screen edits the profile).
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <Field label={label}>
      <TextInput
        value={local}
        type={type}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        onChange={setLocal}
        // 🔴 TIER S: commit on blur — llama a onCommit que eventualmente
        // invoca al reducer updateUserProfile.
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
      />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(129, 39, 207, 0.08)" }}>
      <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#0b1c30", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function RadioGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean; badge?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 999,
              border: active ? "1px solid #8127cf" : "1px solid #e2d4f5",
              background: active ? "#f3e8ff" : "rgba(255,255,255,0.7)",
              color: active ? "#8127cf" : "#0b1c30",
              fontSize: 13,
              fontWeight: 600,
              cursor: opt.disabled ? "not-allowed" : "pointer",
              opacity: opt.disabled ? 0.55 : 1,
            }}
          >
            {active && <Check size={14} />}
            <span>{opt.label}</span>
            {opt.badge && (
              <span
                style={{
                  marginLeft: 4,
                  padding: "1px 6px",
                  borderRadius: 6,
                  background: "#fde68a",
                  color: "#92400e",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div style={{ position: "relative", maxWidth: 220, width: "100%" }}>
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          width: "100%",
          padding: "8px 30px 8px 12px",
          borderRadius: 10,
          border: "1px solid #e2d4f5",
          background: "rgba(255,255,255,0.85)",
          fontSize: 14,
          color: "#0b1c30",
          outline: "none",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: "#8127cf",
        }}
      />
    </div>
  );
}

function PillButton({
  children,
  onClick,
  variant = "default",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: "rgba(255,255,255,0.85)", color: "#0b1c30", border: "1px solid #e2d4f5" },
    primary: { background: "#8127cf", color: "#ffffff", border: "1px solid #8127cf" },
    danger:  { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" },
    ghost:   { background: "transparent", color: "#8127cf", border: "1px dashed #c4b5fd" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function SectionCard({
  meta,
  expanded,
  onToggle,
  children,
}: {
  meta: SectionMeta;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon = meta.icon;
  return (
    <section
      className="koru-magical-card"
      style={{ "--module-color": meta.accent, "--module-bg": meta.tint } as React.CSSProperties}
      aria-expanded={expanded}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${expanded ? "Contraer" : "Expandir"} sección ${meta.title}`}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            className="koru-module-icon"
            style={{ width: 40, height: 40, borderRadius: 12, background: meta.tint, color: meta.accent }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="koru-module-title" style={{ fontSize: 17, color: meta.accent }}>
              {meta.title}
            </h3>
            <p className="koru-module-kicker" style={{ fontSize: 10, letterSpacing: 0.5 }}>
              {meta.kicker}
            </p>
          </div>
        </div>
        <ChevronDown
          size={20}
          style={{
            color: meta.accent,
            transition: "transform 200ms ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>
      {expanded && <div style={{ marginTop: 14 }}>{children}</div>}
    </section>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export function SettingsScreen(props: SettingsScreenProps) {
  const { state } = props;
  const profile = state.userProfile ?? {};
  const prefs = state.preferences ?? {
    theme: "light",
    fontScale: "medium",
    haptics: true,
    sounds: true,
    reducedMotion: false,
    highContrast: false,
  };

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<SectionId>>(() => new Set<SectionId>(["perfil"]));
  const [autoTz] = useState(() => detectTimezone());

  // Memoria: filtros + búsqueda
  const [memKindFilter, setMemKindFilter] = useState<"all" | MemoryKind>("all");
  const [memSearch, setMemSearch] = useState("");

  // 🔴 TIER S: Personas sub-form (under Perfil). Captura name + relationship
  // + birthday y llama a props.onAddPerson → addPerson reducer del store.
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRelationship, setNewPersonRelationship] = useState("");
  const [newPersonBirthday, setNewPersonBirthday] = useState("");

  // Notificaciones: estado de permiso push
  const [pushGranted, setPushGranted] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });

  // Delete-all confirmation flow (require typing ELIMINAR)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Retention (local — el reducer no existe aún; se persiste en localStorage)
  const [retention, setRetention] = useState<string>(
    () => localStorage.getItem("koru.memoryRetentionDays") ?? "90",
  );

  // Integraciones (placeholder visual, persistido en localStorage)
  const [integrations, setIntegrations] = useState<Record<string, { connected: boolean; lastSync?: string }>>(() => {
    try {
      const raw = localStorage.getItem("koru.integrations");
      if (raw) return JSON.parse(raw) as Record<string, { connected: boolean; lastSync?: string }>;
    } catch {
      /* noop */
    }
    return { calendar: { connected: false }, banks: { connected: false }, crypto: { connected: false } };
  });

  // 🔴 Google Calendar OAuth — flag "pending" persistido en
  // `koru.integrations.googleCalendar` mientras el usuario completa el flujo
  // de OAuth en la pestaña abierta por getGoogleAuthUrl(). El callback real
  // (redirect URI + exchangeCodeForToken) todavía no está implementado, así
  // que el estado queda en "pending" hasta que el backend lo confirme.
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<"idle" | "pending" | "connected">(() => {
    try {
      const raw = localStorage.getItem("koru.integrations");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const flag = parsed.googleCalendar;
        if (flag === "pending" || flag === "connected") return flag;
      }
    } catch {
      /* noop */
    }
    return "idle";
  });

  useEffect(() => {
    try {
      // Persistir el flag `googleCalendar` junto al resto de integraciones.
      // El shape del resto (`{connected, lastSync}`) se mantiene intacto.
      const raw = localStorage.getItem("koru.integrations");
      const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
      parsed.googleCalendar = googleCalendarStatus;
      localStorage.setItem("koru.integrations", JSON.stringify(parsed));
    } catch {
      /* noop */
    }
  }, [googleCalendarStatus]);

  useEffect(() => {
    try {
      // 🔴 Merge: preservar el flag `googleCalendar` (string) que se persiste
      // por separado arriba. Si hacemos `JSON.stringify(integrations)` a secas,
      // pisamos el campo `googleCalendar` y lo perdemos.
      const raw = localStorage.getItem("koru.integrations");
      const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
      // Sobreponer el estado "vivo" de integrations (calendar/banks/crypto).
      Object.assign(parsed, integrations);
      // Mantener el flag googleCalendar tal cual estaba en React state.
      if (googleCalendarStatus !== "idle") {
        parsed.googleCalendar = googleCalendarStatus;
      } else {
        delete parsed.googleCalendar;
      }
      localStorage.setItem("koru.integrations", JSON.stringify(parsed));
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrations]);

  useEffect(() => {
    try {
      localStorage.setItem("koru.memoryRetentionDays", retention);
    } catch {
      /* noop */
    }
  }, [retention]);

  function toggleSection(id: SectionId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function requestPushPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setPushGranted(p));
  }

  function connectIntegration(key: "calendar" | "banks" | "crypto") {
    setIntegrations((prev) => ({
      ...prev,
      [key]: { connected: true, lastSync: new Date().toISOString() },
    }));
  }

  function disconnectIntegration(key: "calendar" | "banks" | "crypto") {
    setIntegrations((prev) => ({ ...prev, [key]: { connected: false } }));
  }

  // 🔴 Google Calendar OAuth — abre la URL de autorización en una pestaña nueva
  // y marca el flag `pending` en localStorage. El callback de OAuth
  // (server-side: /api/integrations/google-calendar/callback) intercambia el
  // code por tokens, persiste en koru-integrations.json, y devuelve HTML que
  // escribe `googleCalendar: "connected"` en localStorage (mismo origen → el
  // popup comparte localStorage con la app) y luego cierra la pestaña.
  //
  // Mientras el usuario completa el consent en Google, polleamos localStorage
  // cada 2s durante 60s. En cuanto vemos `googleCalendar === "connected"`,
  // actualizamos el estado a "connected" → el IntegrationRow muestra
  // "Conectado ✓". Como fallback, también consultamos
  // GET /api/integrations/google-calendar/status (source-of-truth server-side)
  // por si el popup falló al escribir localStorage.
  async function connectGoogleCalendar() {
    if (googleCalendarStatus === "pending" || googleCalendarStatus === "connected") return;
    setGoogleCalendarStatus("pending");
    try {
      const url = getGoogleAuthUrl();
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      // Poll localStorage + status endpoint cada 2s por 60s (30 intentos).
      pollGoogleCalendarStatus(30, 2_000);
    } catch (err) {
      // Si falta GOOGLE_CLIENT_ID u otra env, revertimos a "idle" para que el
      // usuario pueda reintentar y mostramos el error por consola.
      // eslint-disable-next-line no-console
      console.error("[SettingsScreen] Google Calendar auth URL falló:", err);
      setGoogleCalendarStatus("idle");
    }
  }

  // 🔴 Polling del flag `googleCalendar` en localStorage + fallback al
  // endpoint /status. El popup (tras OAuth callback exitoso) escribe el flag
  // `googleCalendar: "connected"` en localStorage y se cierra. Si por alguna
  // razón el popup no puede escribir (origen distinto, storage deshabilitado),
  // el endpoint /status nos dice la verdad server-side.
  function pollGoogleCalendarStatus(maxAttempts: number, intervalMs: number) {
    if (typeof window === "undefined") return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts++;
      // 1) Chequeo local — barato, sin red.
      try {
        const raw = localStorage.getItem("koru.integrations");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed.googleCalendar === "connected") {
            setGoogleCalendarStatus("connected");
            window.clearInterval(timer);
            return;
          }
          // Si el usuario canceló en Google, el popup manda ?error=… → el
          // callback escribe error HTML y NO toca el flag (queda "pending").
          // No hay nada que hacer acá; seguimos polleando hasta timeout.
        }
      } catch {
        /* noop */
      }

      // 2) Fallback: consultar el endpoint server-side.
      try {
        const res = await fetch("/api/integrations/google-calendar/status");
        if (res.ok) {
          const data = (await res.json()) as { connected?: boolean };
          if (data.connected) {
            setGoogleCalendarStatus("connected");
            // Reflejarlo también en localStorage por si el popup no llegó.
            try {
              const r = localStorage.getItem("koru.integrations");
              const p: Record<string, unknown> = r ? JSON.parse(r) : {};
              p.googleCalendar = "connected";
              localStorage.setItem("koru.integrations", JSON.stringify(p));
            } catch {
              /* noop */
            }
            window.clearInterval(timer);
            return;
          }
        }
      } catch {
        /* noop — el server puede estar down, seguimos polleando localStorage */
      }

      // 3) Timeout → revertir a "idle" para que el usuario pueda reintentar.
      if (attempts >= maxAttempts) {
        window.clearInterval(timer);
        setGoogleCalendarStatus("idle");
      }
    }, intervalMs);
  }

  function disconnectGoogleCalendar() {
    setGoogleCalendarStatus("idle");
    setIntegrations((prev) => ({ ...prev, calendar: { connected: false } }));
  }

  // Filtrado de secciones por búsqueda
  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => {
      const haystack = [s.title, s.kicker, ...s.keywords].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  // Filtrado de memorias (sección 7)
  const filteredMemories = useMemo<MemoryFact[]>(() => {
    const q = memSearch.trim().toLowerCase();
    return (state.memories ?? []).filter((m) => {
      if (memKindFilter !== "all" && m.kind !== memKindFilter) return false;
      if (q && !m.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.memories, memKindFilter, memSearch]);

  const systemReducedMotion = prefersReducedMotion();
  const reducedMotionEffective = prefs.reducedMotion || systemReducedMotion;

  function handleDeleteAll() {
    if (deleteConfirmText.trim().toUpperCase() !== "ELIMINAR") return;
    props.onDeleteAllData();
    setDeleteOpen(false);
    setDeleteConfirmText("");
  }

  // 🔴 TIER S: handler para agregar una Person al store. Limpia el form
  // después de invocar al reducer (vía props.onAddPerson). El name es
  // obligatorio; relationship y birthday son opcionales.
  function handleAddPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    const relationship = newPersonRelationship.trim() || undefined;
    const birthday = newPersonBirthday.trim() || undefined;
    props.onAddPerson?.(name, relationship, birthday);
    setNewPersonName("");
    setNewPersonRelationship("");
    setNewPersonBirthday("");
  }

  return (
    <div className="koru-roadmap" role="dialog" aria-label="Ajustes">
      <div className="koru-roadmap-screen">
        <div className="koru-roadmap-blob-1" />
        <div className="koru-roadmap-blob-2" />

        {/* Sticky header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 20px 12px",
            background: "linear-gradient(180deg, rgba(240,219,255,0.95) 0%, rgba(240,219,255,0.85) 70%, rgba(240,219,255,0) 100%)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#8127cf", letterSpacing: "-0.02em" }}>
              Ajustes
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Personalizá tu Koru</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Cerrar ajustes"
            style={{
              display: "flex",
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.6)",
              color: "#8127cf",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Search bar */}
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en ajustes…"
              aria-label="Buscar en ajustes"
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.7)",
                background: "rgba(255,255,255,0.7)",
                fontSize: 14,
                color: "#0b1c30",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Sections */}
        <div className="koru-roadmap-modules" style={{ paddingTop: 4 }}>
          {visibleSections.length === 0 && (
            <div
              className="koru-magical-card"
              style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}
            >
              Sin resultados para “{query}”.
            </div>
          )}

          {visibleSections.map((meta) => {
            const isExpanded = expanded.has(meta.id);
            return (
              <SectionCard
                key={meta.id}
                meta={meta}
                expanded={isExpanded}
                onToggle={() => toggleSection(meta.id)}
              >
                {meta.id === "perfil" && (
                  <>
                    {/* 🔴 TIER S: Perfil fields commit on blur via ProfileField,
                        que eventualmente invoca al reducer updateUserProfile
                        (wired en App.tsx: onUpdateProfile={(p) => updateUserProfile(p)}). */}
                    <ProfileField
                      label="Nombre"
                      value={profile.name ?? ""}
                      placeholder="¿Cómo te llamás?"
                      ariaLabel="Nombre"
                      onCommit={(v) => props.onUpdateProfile({ name: v })}
                    />
                    <ProfileField
                      label="Cumpleaños"
                      value={profile.birthday ?? ""}
                      type="date"
                      ariaLabel="Cumpleaños"
                      onCommit={(v) => props.onUpdateProfile({ birthday: v })}
                    />
                    <ProfileField
                      label="Ciudad / Ubicación"
                      value={profile.location ?? profile.homeCity ?? ""}
                      placeholder="Ej. Buenos Aires"
                      ariaLabel="Ciudad"
                      onCommit={(v) =>
                        props.onUpdateProfile({ location: v, homeCity: v })
                      }
                    />
                    <Field label={`Zona horaria (detectada: ${autoTz})`}>
                      <SelectInput
                        value={profile.timezone && profile.timezone !== "auto" ? profile.timezone : "auto"}
                        ariaLabel="Zona horaria"
                        onChange={(v) =>
                          props.onUpdateProfile({ timezone: v === "auto" ? autoTz : v })
                        }
                        options={COMMON_TIMEZONES.map((tz) => ({
                          value: tz,
                          label: tz === "auto" ? `Automática (${autoTz})` : tz,
                        }))}
                      />
                    </Field>

                    {/* 🔴 TIER S: Personas — sub-section under Perfil.
                        Form simple: name + relationship + birthday.
                        On save → props.onAddPerson → addPerson reducer.
                        Lista las personas ya guardadas en state.people. */}
                    <div
                      style={{
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(243, 232, 255, 0.45)",
                        border: "1px solid rgba(129, 39, 207, 0.12)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 18, color: "#8127cf" }}
                          aria-hidden
                        >
                          group
                        </span>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#8127cf" }}>
                          Personas
                        </h4>
                      </div>

                      <Field label="Nombre">
                        <TextInput
                          value={newPersonName}
                          onChange={setNewPersonName}
                          placeholder="Ej. María González"
                          ariaLabel="Nombre de la persona"
                        />
                      </Field>
                      <Field label="Relación (opcional)">
                        <TextInput
                          value={newPersonRelationship}
                          onChange={setNewPersonRelationship}
                          placeholder="Ej. Madre / Amiga / Colega"
                          ariaLabel="Relación"
                        />
                      </Field>
                      <Field label="Cumpleaños (opcional)">
                        <TextInput
                          value={newPersonBirthday}
                          onChange={setNewPersonBirthday}
                          type="date"
                          ariaLabel="Cumpleaños de la persona"
                        />
                      </Field>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <PillButton
                          variant="primary"
                          onClick={handleAddPerson}
                          disabled={!newPersonName.trim() || !props.onAddPerson}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden>person_add</span>
                          Agregar persona
                        </PillButton>
                      </div>

                      {(state.people ?? []).length > 0 && (
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          {(state.people as Person[]).map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                padding: "8px 10px",
                                borderRadius: 10,
                                background: "rgba(255,255,255,0.7)",
                                border: "1px solid rgba(129, 39, 207, 0.08)",
                                fontSize: 13,
                                color: "#0b1c30",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>
                                  {[p.relationship, p.birthday].filter(Boolean).join(" · ") || "Sin detalles"}
                                </div>
                              </div>
                              {p.birthday && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    padding: "2px 6px",
                                    borderRadius: 6,
                                    background: "#fde68a",
                                    color: "#92400e",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                  title={`Cumpleaños: ${p.birthday}`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 11 }} aria-hidden>cake</span>
                                  {p.birthday.slice(5)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {meta.id === "idioma" && (
                  <Row label="Idioma de la interfaz y respuestas" hint="Koru te responderá en el idioma elegido.">
                    <RadioGroup
                      value={state.language ?? "es"}
                      onChange={(lang) => props.onUpdateLanguage(lang)}
                      options={[
                        { value: "es", label: "Español" },
                        { value: "en", label: "English" },
                      ]}
                    />
                  </Row>
                )}

                {meta.id === "apariencia" && (
                  <>
                    <Field label="Tema">
                      <RadioGroup
                        value={prefs.theme}
                        onChange={(v) => props.onUpdatePreferences({ theme: v })}
                        options={[
                          { value: "light", label: "Claro" },
                          { value: "dark", label: "Oscuro", disabled: true, badge: "próximamente" },
                          { value: "auto", label: "Automático" },
                        ]}
                      />
                    </Field>
                    <Field label="Tamaño de fuente">
                      <RadioGroup
                        value={prefs.fontScale}
                        onChange={(v) => props.onUpdatePreferences({ fontScale: v })}
                        options={[
                          { value: "small", label: "Pequeña" },
                          { value: "medium", label: "Mediana" },
                          { value: "large", label: "Grande" },
                        ]}
                      />
                    </Field>
                    <Row label="Hápticos" hint="Vibración al tocar">
                      <Toggle
                        checked={prefs.haptics}
                        onChange={(v) => props.onUpdatePreferences({ haptics: v })}
                        aria-label="Hápticos"
                      />
                    </Row>
                    <Row label="Sonidos" hint="Efectos de sonido de la interfaz">
                      <Toggle
                        checked={prefs.sounds}
                        onChange={(v) => props.onUpdatePreferences({ sounds: v })}
                        aria-label="Sonidos"
                      />
                    </Row>
                    <Row
                      label="Movimiento reducido"
                      hint={
                        systemReducedMotion
                          ? "Tu sistema tiene activado prefers-reduced-motion."
                          : "Reduce animaciones y transiciones."
                      }
                    >
                      <Toggle
                        checked={reducedMotionEffective}
                        onChange={(v) => props.onUpdatePreferences({ reducedMotion: v })}
                        aria-label="Movimiento reducido"
                      />
                    </Row>
                    <Row label="Alto contraste" hint="Aumenta el contraste de textos y controles">
                      <Toggle
                        checked={prefs.highContrast}
                        onChange={(v) => props.onUpdatePreferences({ highContrast: v })}
                        aria-label="Alto contraste"
                      />
                    </Row>
                  </>
                )}

                {meta.id === "notificaciones" && (
                  <>
                    <Row
                      label="Notificaciones push"
                      hint={
                        pushGranted === "unsupported"
                          ? "No soportadas en este dispositivo."
                          : pushGranted === "granted"
                          ? "Permiso concedido."
                          : pushGranted === "denied"
                          ? "Permiso bloqueado. Cambialo desde el navegador."
                          : "Requiere permiso del navegador."
                      }
                    >
                      {pushGranted === "default" ? (
                        <PillButton variant="primary" onClick={requestPushPermission}>
                          Permitir
                        </PillButton>
                      ) : pushGranted === "granted" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#16a34a", fontSize: 13, fontWeight: 600 }}>
                          <Check size={14} /> Activas
                        </span>
                      ) : pushGranted === "denied" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                          <AlertTriangle size={14} /> Bloqueado
                        </span>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: 13 }}>N/A</span>
                      )}
                    </Row>
                    <Row label="Sonidos por evento" hint="Personaliza qué eventos suenan">
                      <SelectInput
                        value="default"
                        ariaLabel="Sonido por evento"
                        onChange={() => {
                          /* placeholder — los sonidos se integran después */
                        }}
                        options={[
                          { value: "default", label: "Por defecto" },
                          { value: "gentle", label: "Suave" },
                          { value: "chime", label: "Campana" },
                          { value: "none", label: "Sin sonido" },
                        ]}
                      />
                    </Row>
                    <Field label="Horario No Molestar">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12, color: "#64748b" }}>Desde</label>
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={prefs.dndStartHour ?? 22}
                          onChange={(e) =>
                            props.onUpdatePreferences({
                              dndStartHour: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                            })
                          }
                          aria-label="DND desde hora"
                          style={{
                            width: 64,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #e2d4f5",
                            background: "rgba(255,255,255,0.8)",
                            fontSize: 14,
                            textAlign: "center",
                          }}
                        />
                        <label style={{ fontSize: 12, color: "#64748b" }}>Hasta</label>
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={prefs.dndEndHour ?? 7}
                          onChange={(e) =>
                            props.onUpdatePreferences({
                              dndEndHour: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                            })
                          }
                          aria-label="DND hasta hora"
                          style={{
                            width: 64,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #e2d4f5",
                            background: "rgba(255,255,255,0.8)",
                            fontSize: 14,
                            textAlign: "center",
                          }}
                        />
                        <span style={{ fontSize: 12, color: "#64748b" }}>hs</span>
                      </div>
                    </Field>
                  </>
                )}

                {meta.id === "privacidad" && (
                  <>
                    <Row label="Bloqueo de la app" hint="WebAuthn / biometría">
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#fde68a",
                          color: "#92400e",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <Lock size={12} /> próximoamente
                      </span>
                    </Row>
                    <Row
                      label="Modo offline (ephemeral)"
                      hint="No guarda nada en el servidor. La memoria se pierde al cerrar."
                    >
                      <Toggle
                        checked={state.ephemeralMode}
                        onChange={() => props.onToggleEphemeral()}
                        aria-label="Modo offline ephemeral"
                      />
                    </Row>
                    <Row
                      label="Memoria durable"
                      hint="Koru recordará entre sesiones."
                    >
                      <Toggle
                        checked={state.durableMemoryEnabled}
                        onChange={() => props.onToggleDurableMemory()}
                        aria-label="Memoria durable"
                      />
                    </Row>
                    <Row label="Retención de memoria" hint="Auto-archivar recuerdos antiguos">
                      <SelectInput
                        value={retention}
                        ariaLabel="Retención de memoria"
                        onChange={setRetention}
                        options={RETENTION_OPTIONS}
                      />
                    </Row>
                    <Row label="Exportar mis datos" hint="Descarga un JSON con todo tu estado" stacked>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <PillButton onClick={props.onExportData}>
                          <Download size={14} /> Exportar
                        </PillButton>
                      </div>
                    </Row>
                    <Row label="Eliminar todos los datos" hint="Borra perfil, memorias y registros. No se puede deshacer." stacked>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <PillButton variant="danger" onClick={() => setDeleteOpen(true)}>
                          <Trash2 size={14} /> Borrar todo
                        </PillButton>
                      </div>
                    </Row>
                  </>
                )}

                {meta.id === "integraciones" && (
                  <>
                    <IntegrationRow
                      icon={<Calendar size={16} />}
                      title="Google Calendar"
                      connected={googleCalendarStatus === "connected" || integrations.calendar?.connected === true}
                      lastSync={integrations.calendar?.lastSync}
                      connecting={googleCalendarStatus === "pending"}
                      onConnect={connectGoogleCalendar}
                      onDisconnect={disconnectGoogleCalendar}
                    />
                    <IntegrationRow
                      icon={<Landmark size={16} />}
                      title="Bancos (Plaid / Tink)"
                      connected={integrations.banks?.connected ?? false}
                      lastSync={integrations.banks?.lastSync}
                      onConnect={() => connectIntegration("banks")}
                      onDisconnect={() => disconnectIntegration("banks")}
                    />
                    <IntegrationRow
                      icon={<Bitcoin size={16} />}
                      title="Exchanges de crypto"
                      connected={integrations.crypto?.connected ?? false}
                      lastSync={integrations.crypto?.lastSync}
                      onConnect={() => connectIntegration("crypto")}
                      onDisconnect={() => disconnectIntegration("crypto")}
                    />
                    <p style={{ margin: "10px 0 0", fontSize: 11, color: "#94a3b8" }}>
                      Las conexiones son placeholders visuales por ahora. La sincronización real
                      arriveá con OAuth en una próxima iteración.
                    </p>
                  </>
                )}

                {meta.id === "memoria" && (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <div style={{ position: "relative", flex: "1 1 160px", minWidth: 160 }}>
                        <Search
                          size={14}
                          style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#94a3b8",
                            pointerEvents: "none",
                          }}
                        />
                        <input
                          type="text"
                          value={memSearch}
                          onChange={(e) => setMemSearch(e.target.value)}
                          placeholder="Buscar memoria…"
                          aria-label="Buscar memoria"
                          style={{
                            width: "100%",
                            padding: "8px 10px 8px 30px",
                            borderRadius: 10,
                            border: "1px solid #e2d4f5",
                            background: "rgba(255,255,255,0.8)",
                            fontSize: 13,
                            outline: "none",
                          }}
                        />
                      </div>
                      <SelectInput
                        value={memKindFilter}
                        ariaLabel="Filtrar por tipo"
                        onChange={setMemKindFilter}
                        options={MEMORY_KIND_FILTERS}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                      {filteredMemories.length === 0 && (
                        <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                          {state.memories.length === 0 ? "Koru todavía no registró memorias." : "Sin memorias para este filtro."}
                        </div>
                      )}
                      {filteredMemories.map((m) => (
                        <MemoryRow
                          key={m.id}
                          memory={m}
                          onForget={() => props.onForgetMemory(m.id)}
                        />
                      ))}
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 11, color: "#94a3b8" }}>
                      {filteredMemories.length} de {state.memories.length} memorias
                    </p>
                  </>
                )}

                {meta.id === "accesibilidad" && (
                  <>
                    <Row label="Hints para lector de pantalla" hint="Descripciones adicionales en ARIA">
                      <Toggle
                        checked={prefs.highContrast}
                        onChange={(v) => props.onUpdatePreferences({ highContrast: v })}
                        aria-label="Hints para lector de pantalla"
                      />
                    </Row>
                    <Row
                      label="Movimiento reducido"
                      hint={systemReducedMotion ? "Activado por tu sistema." : "Sincronizado con Apariencia."}
                    >
                      <Toggle
                        checked={reducedMotionEffective}
                        onChange={(v) => props.onUpdatePreferences({ reducedMotion: v })}
                        aria-label="Movimiento reducido"
                      />
                    </Row>
                    <Row
                      label="Alto contraste"
                      hint="Sincronizado con Apariencia."
                    >
                      <Toggle
                        checked={prefs.highContrast}
                        onChange={(v) => props.onUpdatePreferences({ highContrast: v })}
                        aria-label="Alto contraste"
                      />
                    </Row>
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(13,148,136,0.15)",
                        fontSize: 12,
                        color: "#0f766e",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Navegación por teclado:</strong> Tab / Shift+Tab para moverte entre
                      controles · Enter o Espacio para activar · Esc para cerrar dialogs.
                    </div>
                  </>
                )}
              </SectionCard>
            );
          })}

          {/* Footer hint */}
          <div style={{ padding: "8px 4px 16px", textAlign: "center", color: "#94a3b8", fontSize: 11 }}>
            Koru · Ajustes integrados v1
          </div>
        </div>

        {/* Delete-all confirmation — requiere tipear ELIMINAR */}
        {deleteOpen && (
          <div
            role="dialog"
            aria-label="Confirmar eliminación"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 250,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              background: "rgba(11, 28, 48, 0.55)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 360,
                padding: 20,
                borderRadius: 20,
                background: "#ffffff",
                boxShadow: "0 24px 60px rgba(129, 39, 207, 0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#b91c1c" }}>
                <AlertTriangle size={18} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Acción destructiva</h3>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                Esto borrará tu perfil, todas tus memorias, compromisos y registros. No se puede
                deshacer. Para confirmar, escribí <strong>ELIMINAR</strong>:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                aria-label="Escribí ELIMINAR para confirmar"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  fontSize: 14,
                  color: "#0b1c30",
                  outline: "none",
                  letterSpacing: "0.05em",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                <PillButton
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancelar
                </PillButton>
                <PillButton
                  variant="danger"
                  disabled={deleteConfirmText.trim().toUpperCase() !== "ELIMINAR"}
                  onClick={handleDeleteAll}
                >
                  <Trash2 size={14} /> Eliminar todo
                </PillButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-rows específicas ──────────────────────────────────────────────────────

function IntegrationRow({
  icon,
  title,
  connected,
  lastSync,
  connecting,
  onConnect,
  onDisconnect,
}: {
  icon: ReactNode;
  title: string;
  connected: boolean;
  lastSync?: string;
  connecting?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "12px 0",
        borderBottom: "1px solid rgba(129, 39, 207, 0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            width: 34,
            height: 34,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: connected ? "#dcfce7" : "#f1f5f9",
            color: connected ? "#16a34a" : "#475569",
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0b1c30" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {connected
              ? lastSync
                ? `Última sync: ${formatLastSync(lastSync)}`
                : "Conectado ✓"
              : connecting
                ? "Conectando…"
                : "No conectado"}
          </div>
        </div>
      </div>
      {connected ? (
        <PillButton onClick={onDisconnect} variant="ghost">
          <Check size={14} /> Desconectar
        </PillButton>
      ) : connecting ? (
        <PillButton onClick={onConnect} variant="primary" disabled>
          Conectando…
        </PillButton>
      ) : (
        <PillButton onClick={onConnect} variant="primary">
          Conectar
        </PillButton>
      )}
    </div>
  );
}

function MemoryRow({
  memory,
  onForget,
}: {
  memory: MemoryFact;
  onForget: () => void;
}) {
  const isSensitive = memory.sensitivity === "sensitive";
  const confidencePct = Math.round((memory.confidence ?? 0) * 100);
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 12,
        background: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(129, 39, 207, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#0b1c30", lineHeight: 1.4 }}>
            {truncate(memory.text, 110)}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 6,
                background: "#ede9fe",
                color: "#7c3aed",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {MEMORY_KIND_LABEL[memory.kind]}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 6,
                background: confidencePct >= 80 ? "#dcfce7" : confidencePct >= 50 ? "#fef9c3" : "#fee2e2",
                color: confidencePct >= 80 ? "#15803d" : confidencePct >= 50 ? "#a16207" : "#b91c1c",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {confidencePct}%
            </span>
            {isSensitive && (
              <span
                title="Sensible"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: "#fce7f3",
                  color: "#be185d",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                <Lock size={10} /> Sensible
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onForget}
          aria-label={`Olvidar memoria: ${truncate(memory.text, 40)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <CloudOff size={12} /> Olvidar
        </button>
      </div>
    </div>
  );
}

// 🔴 Default export para React.lazy en App.tsx.
// El named export `SettingsScreen` se mantiene por compatibilidad con tests.
export default SettingsScreen;

