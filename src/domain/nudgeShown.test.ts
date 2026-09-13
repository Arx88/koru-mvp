import { describe, expect, it } from "vitest";
import {
  applyHeartbeatNudges,
  createInitialState,
  markNudgeShown,
  normalizeNudges,
} from "./store";
import { isNudgeShown, nudgeDedupeKey, pickNudgeToInject, stripShownMarker } from "./heartbeat";
import type { ProactiveNudge } from "./types";

/**
 * 🔴 REGRESIÓN (bug en vivo 2026-09-13)
 *
 * El usuario veía el mismo recordatorio repetido en el chat. Causas cubiertas
 * por estos tests:
 *
 *  1. La key de dedupe incluía el `title`, y el título CAMBIA para el mismo
 *     commitment ("Que no se pierda" → "Esto es para hoy" → "Esto quedó
 *     pendiente"). Cada variante entraba como nudge nuevo → 3 nudges vivos
 *     para UN commitment.
 *  2. El "ya mostrado" se infería de un `slice(-6)` de texto del chat. Cuando
 *     el texto salía de esa ventana, el mismo mensaje volvía al chat.
 */

function nudge(over: Partial<ProactiveNudge> & Pick<ProactiveNudge, "id">): ProactiveNudge {
  return {
    title: "Esto quedó pendiente",
    body: "Llamar al dentista",
    reason: "Recordatorio",
    priority: "medium",
    createdAt: "2026-09-12T08:08:59.120Z",
    ...over,
  };
}

/** El estado real que quedó envenenado en la instalación del usuario. */
const LEAKED: ProactiveNudge[] = [
  nudge({ id: "nudge_a", source: "commitment", sourceId: "commit_1", createdAt: "2026-09-12T08:08:59.120Z", shownAt: "2026-09-12T08:08:59.120Z" }),
  nudge({ id: "nudge_b", source: "commitment", sourceId: "commit_1", title: "Que no se pierda", createdAt: "2026-09-12T06:26:59.114Z" }),
  nudge({ id: "nudge_c", source: "commitment", sourceId: "commit_1", title: "[proactive_shown] [proactive_shown] Que no se pierda", createdAt: "2026-09-12T06:00:59.119Z" }),
  nudge({ id: "nudge_d", source: "brain", sourceId: "morning-brief-2026-09-13", title: "[proactive_shown] Buenos días", createdAt: "2026-09-13T08:05:38.525Z" }),
];

describe("normalizeNudges — colapso de duplicados persistidos", () => {
  it("3 nudges del MISMO commitment colapsan a 1", () => {
    const out = normalizeNudges(LEAKED);
    const sameCommitment = out.filter((n) => nudgeDedupeKey(n) === "commitment|commit_1");
    expect(sameCommitment).toHaveLength(1);
  });

  it("si alguno del grupo ya se mostró, el sobreviviente queda mostrado", () => {
    // Es lo que evita que un usuario con el estado envenenado vuelva a ver el
    // mensaje: sin esto, el gate inyecta "Que no se pierda" una vez más.
    const out = normalizeNudges(LEAKED);
    const survivor = out.find((n) => nudgeDedupeKey(n) === "commitment|commit_1");
    expect(survivor && isNudgeShown(survivor)).toBe(true);
    expect(pickNudgeToInject(out)).toBeUndefined();
  });

  it("sobrevive el más nuevo (es el contenido más actual)", () => {
    const out = normalizeNudges(LEAKED);
    const survivor = out.find((n) => nudgeDedupeKey(n) === "commitment|commit_1");
    expect(survivor?.id).toBe("nudge_a");
  });

  it("convierte el marcador viejo del título en shownAt y limpia el título", () => {
    const legacy = [nudge({ id: "n1", source: "brain", sourceId: "mb", title: "[proactive_shown] Buenos días" })];
    const [out] = normalizeNudges(legacy);
    expect(out.title).toBe("Buenos días");
    expect(out.shownAt).toBe("2026-09-12T08:08:59.120Z");
    expect(stripShownMarker("[proactive_shown] Buenos días")).toBe("Buenos días");
  });

  it("NO colapsa nudges distintos que no tienen sourceId (no hay identidad estable)", () => {
    const noId: ProactiveNudge[] = [
      nudge({ id: "x1", source: "brain", title: "Clima" }),
      nudge({ id: "x2", source: "brain", title: "Partido" }),
    ];
    expect(normalizeNudges(noId)).toHaveLength(2);
  });

  it("es idempotente: correrlo dos veces no cambia nada", () => {
    const once = normalizeNudges(LEAKED);
    expect(normalizeNudges(once)).toEqual(once);
  });
});

describe("markNudgeShown — marcado durable e idempotente", () => {
  it("setea shownAt y NO toca el título", () => {
    const state = { ...createInitialState(), nudges: [nudge({ id: "n1", source: "commitment", sourceId: "c1" })] };
    const next = markNudgeShown(state, "n1", new Date("2026-09-13T08:06:38.000Z"));
    const marked = next.nudges[0];
    expect(marked.shownAt).toBe("2026-09-13T08:06:38.000Z");
    expect(marked.title).toBe("Esto quedó pendiente");
    expect(marked.title).not.toContain("[proactive_shown]");
  });

  it("bajo StrictMode (updater invocado dos veces) no duplica el marcador", () => {
    // El marcado viejo hacía `title = "[proactive_shown] " + title`. Con
    // StrictMode el updater corre dos veces → "[proactive_shown]
    // [proactive_shown] …", que es literalmente lo que quedó persistido.
    const state = { ...createInitialState(), nudges: [nudge({ id: "n1", source: "commitment", sourceId: "c1" })] };
    const once = markNudgeShown(state, "n1", new Date("2026-09-13T08:06:38.000Z"));
    const twice = markNudgeShown(once, "n1", new Date("2026-09-13T08:06:39.000Z"));
    expect(twice.nudges[0].shownAt).toBe("2026-09-13T08:06:38.000Z");
    expect(twice.nudges[0].title).toBe("Esto quedó pendiente");
  });
});

describe("pickNudgeToInject — el gate de inyección", () => {
  it("un nudge ya mostrado NO se vuelve a inyectar, sin importar cuántas veces se pregunte", () => {
    const shown = nudge({ id: "n1", source: "commitment", sourceId: "c1", shownAt: "2026-09-13T08:06:38.000Z" });
    for (let i = 0; i < 10; i += 1) {
      expect(pickNudgeToInject([shown])).toBeUndefined();
    }
  });

  it("un nudge legacy con el prefijo viejo tampoco se inyecta", () => {
    const legacy = nudge({ id: "n1", source: "commitment", sourceId: "c1", title: "[proactive_shown] Esto quedó pendiente" });
    expect(pickNudgeToInject([legacy])).toBeUndefined();
  });

  it("inyecta el primero pendiente y salta los mostrados y los descartados", () => {
    const out = [
      nudge({ id: "n1", source: "commitment", sourceId: "c1", shownAt: "2026-09-13T08:06:38.000Z" }),
      nudge({ id: "n2", source: "commitment", sourceId: "c2", dismissed: true }),
      nudge({ id: "n3", source: "commitment", sourceId: "c3", title: "Que no se pierda" }),
    ];
    expect(pickNudgeToInject(out)?.id).toBe("n3");
  });
});

describe("applyHeartbeatNudges — dedupe por source|sourceId", () => {
  it("no re-agrega un nudge del mismo commitment aunque el título haya cambiado", () => {
    // Este es el bug original: el título cambió ("Que no se pierda" →
    // "Esto quedó pendiente") y con la key vieja entraba como nudge nuevo.
    const base = { ...createInitialState(), nudges: [nudge({ id: "n1", source: "commitment", sourceId: "commit_1", title: "Que no se pierda" })] };
    const next = applyHeartbeatNudges(
      base,
      [{ title: "Esto quedó pendiente", body: "Llamar al dentista", reason: "Recordatorio", priority: "high", source: "commitment", sourceId: "commit_1" }],
      new Date("2026-09-13T10:00:00.000Z"),
    );
    expect(next.nudges).toHaveLength(1);
    expect(next.nudges[0].id).toBe("n1");
    expect(next.heartbeat.dailyNudgeCount).toBe(0);
  });

  it("un nudge sin source se reconoce a sí mismo (mismo default en los dos lados)", () => {
    // Antes: el lado "existente" defaulteaba a `brain` y el lado "draft" a
    // `heartbeat`, así que los nudges sin source nunca se reconocían.
    const base = { ...createInitialState(), nudges: [nudge({ id: "n1", title: "Sin source" })] };
    const next = applyHeartbeatNudges(
      base,
      [{ title: "Sin source", body: "b", reason: "r", priority: "low" }],
      new Date("2026-09-13T10:00:00.000Z"),
    );
    expect(next.nudges).toHaveLength(1);
  });
});
