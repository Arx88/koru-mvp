/**
 * 🐱 v7.6 — Infinite scroll + cola de turnos + anti-cards-colgadas.
 * Responde a la queja del usuario: "quitá lo de la respuesta única y dejá
 * infinite scroll como tiene el demo" + "las cards no salen".
 *
 * 1. readChatTurns: un turno "working" persistido (app cerrada a mitad de
 *    stream) NO puede renderizar su esqueleto "Buscando…" para siempre —
 *    se normaliza a done sin items.
 * 2. Persistencia: el historial COMPLETO (hasta 120 turns) se guarda y se
 *    devuelve entero — el feed lo muestra con scroll (no más slice).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readChatTurns, saveChatTurns, CHAT_STORAGE_KEY } from "./adapters";
import type { KoruChatTurn } from "./KoruProvider";

const turn = (over: Partial<KoruChatTurn>): KoruChatTurn => ({
  id: `t_${Math.random().toString(36).slice(2, 8)}`,
  role: "koru",
  text: "hola",
  createdAt: new Date().toISOString(),
  status: "done",
  ...over,
} as KoruChatTurn);

describe("readChatTurns (v7.6 infinite scroll)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normaliza turns 'working' persistidos a done (sin esqueleto colgado)", () => {
    const working = turn({
      role: "koru",
      status: "working",
      text: "",
      items: [{ id: "i1", kind: "action", tag: "web_nav", text: "", status: "working" } as never],
    });
    saveChatTurns([turn({ role: "user", text: "buscame esto" }), working]);
    const restored = readChatTurns();
    const last = restored[restored.length - 1];
    expect(last.status).toBe("done");
    expect(last.items).toEqual([]);
  });

  it("devuelve el historial COMPLETO persistido (hasta 120) — base del infinite scroll", () => {
    const many: KoruChatTurn[] = [];
    for (let i = 0; i < 140; i++) {
      many.push(turn({ id: `t${i}`, role: i % 2 ? "user" : "koru", text: `mensaje ${i}` }));
    }
    saveChatTurns(many);
    const restored = readChatTurns();
    expect(restored).toHaveLength(120);
    expect(restored[0].id).toBe("t20"); // los últimos 120, en orden
    expect(restored[119].id).toBe("t139");
  });

  it("sin storage → saludo inicial (behavior intacto)", () => {
    const restored = readChatTurns();
    expect(restored).toHaveLength(1);
    expect(restored[0].role).toBe("koru");
  });

  it("turns done se devuelven intactos (items preservados)", () => {
    const done = turn({
      role: "koru",
      status: "done",
      items: [{ id: "i1", kind: "action", tag: "day_info", text: "HOY", status: "executed" } as never],
    });
    saveChatTurns([done]);
    const restored = readChatTurns();
    expect(restored[0].status).toBe("done");
    expect((restored[0].items ?? []).length).toBe(1);
  });

  it("CHAT_STORAGE_KEY persiste bajo la clave de conversación", () => {
    expect(CHAT_STORAGE_KEY).toContain("conversation");
    saveChatTurns([turn({ role: "user", text: "hola" })], true);
    expect(localStorage.getItem(CHAT_STORAGE_KEY)).toBeTruthy();
  });
});
