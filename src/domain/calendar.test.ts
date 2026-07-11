import { describe, expect, it } from "vitest";
import { createManualCalendarEvent, parseIcsEvents, upcomingCalendarEvents } from "./calendar";

describe("Koru calendar", () => {
  it("parses pasted ICS events into local calendar events", () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:meeting-1
SUMMARY:Reunion con Ana
DTSTART:20260617T090000Z
DTEND:20260617T100000Z
LOCATION:Local
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Reunion con Ana",
      location: "Local",
      source: "ics",
      sourceRef: "meeting-1",
    });
  });

  it("creates manual events and filters upcoming ones", () => {
    const event = createManualCalendarEvent({
      title: "Llamar proveedor",
      date: "2026-06-17",
      time: "11:30",
      location: "",
    });

    const upcoming = upcomingCalendarEvents(
      [
        {
          ...event,
          id: "cal_1",
          createdAt: "2026-06-16T08:00:00.000Z",
        },
      ],
      new Date("2026-06-16T10:00:00.000Z"),
      48,
    );

    expect(upcoming[0].title).toBe("Llamar proveedor");
  });
});
