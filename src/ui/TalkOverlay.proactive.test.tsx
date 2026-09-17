import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/store";
import { TalkOverlay } from "./TalkOverlay";

const context = vi.hoisted(() => ({ value: {} as any }));
vi.mock("./KoruProvider", () => ({ useKoru: () => context.value, useKoruOptional: () => context.value }));

const response = () => ({ ok: true, json: async () => ({ shouldShow: true, reply: "Lluvia esta tarde.", dedupKey: "weather:rain" }) });
let fetchMock: ReturnType<typeof vi.fn>;
let delivered: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 14, 12));
  const state = createInitialState();
  state.heartbeat = { ...state.heartbeat, enabled: true, activeStartHour: 0, activeEndHour: 0 };
  state.worldSignalsEnabled = true;
  state.voicePreference = { ...state.voicePreference, proactivity: 50 };
  context.value = { state, chatTurns: [], memories: [], history: [], processing: false, userName: "Alex", language: "es", online: true };
  fetchMock = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  delivered = vi.fn();
  window.addEventListener("koru:proactive", delivered);
});
afterEach(() => {
  cleanup();
  window.removeEventListener("koru:proactive", delivered);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function open() {
  const view = render(<TalkOverlay onClose={() => {}} />);
  await act(async () => {});
  return view;
}

describe("reopened saved record", () => {
  it("keeps the original card inside the mobile screen and exposes close", async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
    const close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
    const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close });
    const closeRecord = vi.fn();
    context.value.closeReopenedRecord = closeRecord;
    context.value.reopenedRecord = {
      id: "record-test", title: "Clase de inglés",
      sourceBlock: { type: "saved_record", records: [{ id: "record-test", title: "Clase de inglés", collection: "Clases", kind: "note" }] },
    };
    const view = await open();
    const sheet = screen.getByRole("dialog", { name: "Elemento guardado" });
    expect(sheet.closest(".koru-chat-screen")).not.toBeNull();
    expect(sheet.textContent).toContain("Clase de inglés");
    expect(showModal).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar elemento guardado" }));
    expect(closeRecord).toHaveBeenCalledOnce();
    fireEvent(sheet, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(closeRecord).toHaveBeenCalledTimes(2);
    context.value.reopenedRecord = null;
    view.rerender(<TalkOverlay onClose={() => {}} />);
    expect(screen.queryByRole("dialog", { name: "Elemento guardado" })).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShow);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });
});

describe("TalkOverlay proactive delivery", () => {
  it("dispatches the same server event only once across two openings", async () => {
    const first = await open();
    expect(delivered).toHaveBeenCalledTimes(1);
    first.unmount();
    await open();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delivered).toHaveBeenCalledTimes(1);
  });
  it.each([
    [9, 9, 17, true], [16, 9, 17, true], [17, 9, 17, false],
    [22, 22, 7, true], [0, 22, 7, true], [6, 22, 7, true],
    [7, 22, 7, false], [12, 8, 8, false],
  ])("respects DND hour %s, window %s–%s", async (hour, start, end, blocked) => {
    vi.setSystemTime(new Date(2026, 8, 14, hour));
    context.value.state.preferences = { ...context.value.state.preferences, dndStartHour: start, dndEndHour: end };
    await open();
    expect(fetchMock).toHaveBeenCalledTimes(blocked ? 0 : 1);
    expect(delivered).toHaveBeenCalledTimes(blocked ? 0 : 1);
  });
  it.each(["disabled", "quiet", "radar", "inactive"])("does not request an unsolicited event when %s", async (setting) => {
    if (setting === "disabled") context.value.state.heartbeat.enabled = false;
    if (setting === "quiet") context.value.state.voicePreference.proactivity = 0;
    if (setting === "radar") context.value.state.worldSignalsEnabled = false;
    if (setting === "inactive") context.value.state.heartbeat.activeStartHour = 14;
    await open();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["typing", "processing", "conversation", "unmounted", "silenced"])("drops a delayed event after %s", async (reason) => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise(r => { resolve = r; }));
    const view = await open();
    if (reason === "typing") fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hola" } });
    if (reason === "processing") context.value = { ...context.value, processing: true };
    if (reason === "conversation") context.value = { ...context.value, chatTurns: [{ id: "user-1", role: "user", text: "Hola", createdAt: new Date().toISOString() }] };
    if (reason === "silenced") context.value.state.voicePreference.proactivity = 0;
    if (reason === "unmounted") view.unmount();
    else view.rerender(<TalkOverlay onClose={() => {}} />);
    await act(async () => { resolve(response()); });
    expect(delivered).not.toHaveBeenCalled();
  });
});
