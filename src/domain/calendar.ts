import type { CalendarEvent } from "./types";

type CalendarEventDraft = Omit<CalendarEvent, "id" | "createdAt">;

function unfoldIcs(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line.trim());
      }
      return lines;
    }, []);
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function valueAfterColon(line?: string): string {
  if (!line) return "";
  const index = line.indexOf(":");
  return index >= 0 ? line.slice(index + 1).trim() : "";
}

function parseIcsDate(value: string): string | null {
  const clean = value.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(clean);
  if (!match) return null;
  const [, year, month, day, hour = "09", minute = "00", second = "00", zulu] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const date = zulu ? new Date(`${iso}Z`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function parseIcsEvents(raw: string): CalendarEventDraft[] {
  const lines = unfoldIcs(raw);
  const events: CalendarEventDraft[] = [];
  let block: string[] = [];
  let inside = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inside = true;
      block = [];
      continue;
    }
    if (line === "END:VEVENT") {
      const summary = unescapeIcsText(valueAfterColon(block.find((item) => item.startsWith("SUMMARY"))));
      const startsAt = parseIcsDate(valueAfterColon(block.find((item) => item.startsWith("DTSTART"))));
      const endsAt = parseIcsDate(valueAfterColon(block.find((item) => item.startsWith("DTEND"))));
      const location = unescapeIcsText(valueAfterColon(block.find((item) => item.startsWith("LOCATION"))));
      const uid = valueAfterColon(block.find((item) => item.startsWith("UID")));
      if (summary && startsAt) {
        events.push({
          title: summary,
          startsAt,
          endsAt: endsAt ?? undefined,
          location: location || undefined,
          source: "ics",
          sourceRef: uid || `${summary}-${startsAt}`,
        });
      }
      inside = false;
      block = [];
      continue;
    }
    if (inside) block.push(line);
  }

  return events;
}

export function createManualCalendarEvent(input: {
  title: string;
  date: string;
  time?: string;
  location?: string;
}): CalendarEventDraft {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) throw new Error("Ese evento necesita nombre.");
  const time = input.time?.trim() || "09:00";
  const startsAt = new Date(`${input.date}T${time}`);
  if (Number.isNaN(startsAt.getTime())) throw new Error("No pude leer la fecha de ese evento.");
  return {
    title: cleanTitle,
    startsAt: startsAt.toISOString(),
    location: input.location?.trim() || undefined,
    source: "manual",
    sourceRef: `${cleanTitle}-${startsAt.toISOString()}`,
  };
}

export function upcomingCalendarEvents(events: CalendarEvent[], now = new Date(), hours = 36): CalendarEvent[] {
  const start = now.getTime();
  const end = start + hours * 60 * 60 * 1000;
  return events
    .filter((event) => {
      const time = new Date(event.startsAt).getTime();
      return time >= start && time <= end;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
