/**
 * Bloque Calendar — Integración Google Calendar (OAuth + Events).
 *
 * Flujo OAuth 2.0 de Google para acceso read-only al calendario primario:
 *   1) `getGoogleAuthUrl()` → URL que el usuario abre en el navegador.
 *   2) Google redirige a `REDIRECT_URI?code=...`.
 *   3) `exchangeCodeForToken(code)` → intercambia el code por access_token
 *      (y refresh_token si el usuario consiente acceso offline).
 *   4) `fetchCalendarEvents(accessToken, timeMin, timeMax)` → lista eventos
 *      en el rango [timeMin, timeMax] como ISO 8601.
 *   5) `convertToCalendarEvent(googleEvent)` → normaliza al tipo CalendarEvent
 *      que Koru usa internamente.
 *
 * Variables de entorno requeridas:
 *   - GOOGLE_CLIENT_ID     (obligatorio para auth + token)
 *   - GOOGLE_CLIENT_SECRET (obligatorio para token exchange)
 *   - GOOGLE_REDIRECT_URI  (obligatorio en ambos flujos; debe coincidir con
 *     el redirect_uri autorizado en Google Cloud Console)
 */

import type { CalendarEvent, CalendarMeetingLink } from "../../domain/types";
import { fetchJson } from "../shared/fetcher";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Evento normalizado que Koru entiende tras parsear la respuesta de Google. */
export type GoogleCalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  description?: string;
  attendees?: Array<{
    name: string;
    email: string;
    status: "confirmed" | "tentative" | "declined";
  }>;
  /** URL cruda del link de reunión (Zoom / Meet / Teams) extraída de location/description. */
  meetingLink?: string;
  /** conferenceData crudo de Google (entryPoints, conferenceSolution, etc.). */
  conferenceData?: unknown;
};

// ---------------------------------------------------------------------------
// Tipos internos (shape de las respuestas de Google)
// ---------------------------------------------------------------------------

type GoogleCalendarApiEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  attendees?: Array<{
    displayName?: string;
    email?: string;
    responseStatus?: string;
    organizer?: boolean;
    optional?: boolean;
    resource?: boolean;
  }>;
  conferenceData?: unknown;
  hangoutLink?: string;
};

type GoogleCalendarApiResponse = {
  items?: GoogleCalendarApiEvent[];
  error?: { code?: number; message?: string };
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

// ---------------------------------------------------------------------------
// Helpers de entorno
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Google Calendar requiere ${name}`);
  }
  return value.trim();
}

function getRedirectUri(): string {
  return requireEnv("GOOGLE_REDIRECT_URI");
}

// ---------------------------------------------------------------------------
// Helpers de parseo
// ---------------------------------------------------------------------------

/** Regex que detecta URLs de Zoom, Google Meet o Microsoft Teams. */
const MEETING_LINK_REGEX =
  /https?:\/\/[^\s"'<>]+?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)[^\s"'<>]*/i;

/**
 * Extrae el primer link de reunión (Zoom / Meet / Teams) encontrado en
 * `location` o `description`. Devuelve undefined si no encuentra ninguno.
 */
function parseMeetingLink(location?: string, description?: string): string | undefined {
  const haystack = [location ?? "", description ?? ""].join("\n");
  const match = MEETING_LINK_REGEX.exec(haystack);
  return match ? match[0] : undefined;
}

/** Mapea el responseStatus de Google al estado RSVP que Koru maneja. */
function mapAttendeeStatus(
  status?: string,
): "confirmed" | "tentative" | "declined" {
  switch (status) {
    case "accepted":
      return "confirmed";
    case "tentative":
      return "tentative";
    case "declined":
      return "declined";
    case "needsAction":
    default:
      // Sin respuesta aún → lo marcamos como tentative para no ocultar al asistente.
      return "tentative";
  }
}

/**
 * Convierte una URL cruda de reunión en el objeto CalendarMeetingLink
 * que usa Koru, detectando provider y extrayendo meetingId/passcode cuando
 * sea posible.
 */
function parseMeetingLinkMeta(url: string): CalendarMeetingLink {
  const lower = url.toLowerCase();

  if (lower.includes("meet.google.com")) {
    // Formato típico: https://meet.google.com/abc-defg-hij
    const match = /meet\.google\.com\/([\w-]+)/i.exec(url);
    return {
      provider: "meet",
      url,
      meetingId: match?.[1],
    };
  }

  if (lower.includes("zoom.us")) {
    // Formato típico: https://zoom.us/j/1234567890?pwd=abcd
    // También: https://us02web.zoom.us/j/1234567890?pwd=abcd
    const idMatch = /zoom\.us\/(?:j|my|w)\/([\w.-]+)/i.exec(url);
    const pwdMatch = /[?&]pwd=([^&]+)/i.exec(url);
    return {
      provider: "zoom",
      url,
      meetingId: idMatch?.[1],
      passcode: pwdMatch ? decodeURIComponent(pwdMatch[1]) : undefined,
    };
  }

  // teams.microsoft.com — la URL suele codificar meetingId en el path.
  // Lo dejamos como opaco para evitar falsos positivos.
  return { provider: "teams", url };
}

// ---------------------------------------------------------------------------
// 1) getGoogleAuthUrl
// ---------------------------------------------------------------------------

/**
 * Construye la URL de OAuth para que el usuario autorice acceso read-only
 * a Google Calendar.
 *
 * URL: https://accounts.google.com/o/oauth2/v2/auth
 *      ?scope=https://www.googleapis.com/auth/calendar.readonly
 *      &response_type=code
 *      &redirect_uri={GOOGLE_REDIRECT_URI}
 *      &client_id={GOOGLE_CLIENT_ID}
 *
 * Lanza Error("Google Calendar requiere GOOGLE_CLIENT_ID") si no hay key.
 */
export function getGoogleAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !clientId.trim()) {
    throw new Error("Google Calendar requiere GOOGLE_CLIENT_ID");
  }
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    scope: GOOGLE_CALENDAR_SCOPE,
    response_type: "code",
    redirect_uri: redirectUri,
    client_id: clientId.trim(),
    // access_type=offline + prompt=consent garantizan refresh_token en la
    // primera autorización (necesario para renovar access_token sin
    // re-pedir permiso al usuario).
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// 2) exchangeCodeForToken
// ---------------------------------------------------------------------------

/**
 * Intercambia el `code` recibido en el redirect de OAuth por un
 * access_token (y refresh_token si aplica).
 *
 * POST https://oauth2.googleapis.com/token
 *   grant_type=authorization_code
 *   code={code}
 *   client_id={GOOGLE_CLIENT_ID}
 *   client_secret={GOOGLE_CLIENT_SECRET}
 *   redirect_uri={GOOGLE_REDIRECT_URI}
 */
export async function exchangeCodeForToken(
  code: string,
): Promise<{ access_token: string; refresh_token?: string }> {
  if (!code || !code.trim()) {
    throw new Error("Google Calendar requiere código de autorización.");
  }
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getRedirectUri();

  const body = new URLSearchParams({
    code: code.trim(),
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  // retries:0 — el code es single-use, no queremos reintentar si la red
  // falla a mitad de camino (un segundo intento devolvería "invalid_grant").
  const result = await fetchJson<GoogleTokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    timeoutMs: 15_000,
    retries: 0,
  });

  if (!result.ok || !result.data?.access_token) {
    const data = result.data;
    const errMsg =
      data?.error_description ||
      data?.error ||
      result.error ||
      "No se pudo obtener el access_token de Google.";
    throw new Error(errMsg);
  }

  return {
    access_token: result.data.access_token,
    refresh_token: result.data.refresh_token,
  };
}

// ---------------------------------------------------------------------------
// 3) fetchCalendarEvents
// ---------------------------------------------------------------------------

/**
 * Trae los eventos del calendario primario del usuario en el rango
 * [timeMin, timeMax] (ISO 8601 con offset/Z).
 *
 * GET https://www.googleapis.com/calendar/v3/calendars/primary/events
 *     ?timeMin={ISO}&timeMax={ISO}&singleEvents=true&orderBy=startTime
 *
 * Normaliza la respuesta al tipo GoogleCalendarEvent, parseando attendees
 * con su estado RSVP y el meetingLink desde location/description.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error("Google Calendar requiere access_token.");
  }
  if (!timeMin || !timeMax) {
    throw new Error("Google Calendar requiere timeMin y timeMax (ISO 8601).");
  }

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });
  const url = `${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`;

  const result = await fetchJson<GoogleCalendarApiResponse>(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
    timeoutMs: 15_000,
  });

  if (!result.ok) {
    const apiErr = result.data?.error?.message;
    throw new Error(apiErr || result.error || "No se pudieron obtener los eventos de Google Calendar.");
  }

  const items = result.data?.items ?? [];
  const events: GoogleCalendarEvent[] = [];

  for (const item of items) {
    // Eventos cancelados no aportan info útil para Koru.
    if (item.status === "cancelled") continue;

    const startsAt =
      item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00` : "");
    const endsAt =
      item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00` : "");
    if (!startsAt) continue;

    const attendees = item.attendees
      ?.filter((a) => !a.resource && a.email)
      .map((a) => ({
        name: (a.displayName ?? "").trim() || (a.email ?? ""),
        email: a.email ?? "",
        status: mapAttendeeStatus(a.responseStatus),
      }));

    const meetingLink =
      item.hangoutLink?.trim() ||
      parseMeetingLink(item.location, item.description);

    events.push({
      id: item.id,
      title: (item.summary ?? "(Sin título)").trim(),
      startsAt,
      endsAt: endsAt || startsAt,
      location: item.location?.trim() || undefined,
      description: item.description?.trim() || undefined,
      attendees: attendees && attendees.length > 0 ? attendees : undefined,
      meetingLink: meetingLink || undefined,
      conferenceData: item.conferenceData,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// 4) convertToCalendarEvent
// ---------------------------------------------------------------------------

/**
 * Convierte un GoogleCalendarEvent al tipo CalendarEvent que usa Koru.
 *
 * Mapeo de campos:
 *   id           → id
 *   title        → summary
 *   startsAt     → start.dateTime
 *   endsAt       → end.dateTime
 *   location     → location
 *   source       → "google"
 *   sourceRef    → id (UID del evento en Google)
 *   createdAt    → ahora (ISO)
 *
 * Campos extra:
 *   attendees    → attendees (con estado RSVP)
 *   meetingLink  → objeto { provider, url, meetingId?, passcode? }
 *   agenda       → no se populamos por defecto (lo podría inferir otra capa)
 */
export function convertToCalendarEvent(googleEvent: GoogleCalendarEvent): CalendarEvent {
  return {
    id: googleEvent.id,
    title: googleEvent.title,
    startsAt: googleEvent.startsAt,
    endsAt: googleEvent.endsAt,
    location: googleEvent.location,
    source: "google",
    sourceRef: googleEvent.id,
    createdAt: new Date().toISOString(),
    attendees: googleEvent.attendees,
    meetingLink: googleEvent.meetingLink
      ? parseMeetingLinkMeta(googleEvent.meetingLink)
      : undefined,
  };
}
