/**
 * 🔴 MICHI CONSCIENTE — la card de la propuesta, vista como la ve el usuario.
 *
 * Cubre las tres formas que puede tomar y —lo más importante— que "Más tarde"
 * no sea un botón decorativo: llama al handler que pausa la actividad.
 */
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActivityInviteCard } from "./ActivityInviteCard";
import type { MichiActivityInvite } from "../domain/types";

afterEach(cleanup);

const invite: MichiActivityInvite = {
  id: "invite_ticTac_1",
  activity: "ticTac",
  tone: "playful",
  title: "Tic Tac Mich — revancha",
  body: "La última la gané yo. Vas 0 · Michi 3 · 0 empates.",
  ctaLabel: "¡Dale, revancha!",
};

it("propone jugar y ofrece las dos salidas", () => {
  const onPlay = vi.fn();
  const onLater = vi.fn();
  render(<ActivityInviteCard invite={invite} onPlay={onPlay} onLater={onLater} />);

  expect(screen.getByRole("group", { name: "Michi te propone Tic Tac Mich" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "¡Dale, revancha!" }));
  expect(onPlay).toHaveBeenCalledWith("ticTac");
  fireEvent.click(screen.getByRole("button", { name: "Más tarde" }));
  expect(onLater).toHaveBeenCalledWith("ticTac");
});

it("después de \"más tarde\" no queda ningún botón, solo la constancia", () => {
  const { container } = render(
    <ActivityInviteCard invite={{ ...invite, resolution: "later" }} onPlay={vi.fn()} onLater={vi.fn()} />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(container.textContent).toContain("queda para más tarde");
  expect(container.textContent).toContain("no insisto por unas horas");
});

it("se retira cuando la propuesta fue aceptada", () => {
  const { container } = render(
    <ActivityInviteCard invite={{ ...invite, resolution: "accepted" }} onPlay={vi.fn()} onLater={vi.fn()} />,
  );
  expect(container.querySelector(".koru-invite")).toBeNull();
});

it("el bajón usa el tono suave (no la energía del juego)", () => {
  const { container } = render(
    <ActivityInviteCard
      invite={{ ...invite, activity: "school", tone: "gentle", title: "Algo liviano para la cabeza", ctaLabel: "Dale, algo liviano" }}
      onPlay={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(container.querySelector(".koru-invite.is-gentle")).toBeTruthy();
  expect(container.textContent).toContain("🎓");
});
