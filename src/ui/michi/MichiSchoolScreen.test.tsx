import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createInitialState, completeMichiSchoolQuestion } from "../../domain/store";
import { questionsForGrade } from "../../domain/michiSchool";
import { MichiSchoolScreen } from "./MichiSchoolScreen";

vi.mock("./v8Shared", () => ({ MichiCat: () => <span /> }));
vi.mock("../KoruProvider", () => ({ useKoru: () => {
  const [state, setState] = useState(createInitialState);
  return { state, energy: state.trustedEnergy, completeMichiSchoolQuestion: (id: string) => setState(prev => completeMichiSchoolQuestion(prev, id)) };
} }));
afterEach(cleanup);

it("no suma XP por un error y permite aprender hasta completar un grado", () => {
  render(<MichiSchoolScreen onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "A Tierra" }));
  expect(screen.getByText("Casi, probá otra vez")).toBeTruthy();
  expect(screen.getByLabelText("0 puntos de experiencia")).toBeTruthy();
  for (const question of questionsForGrade(1)) {
    fireEvent.click(screen.getByRole("button", { name: `${"ABCD"[question.answer]} ${question.options[question.answer]}` }));
    expect(screen.getByText("¡Correcto!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: question === questionsForGrade(1).at(-1) ? "Terminar grado" : "Siguiente" }));
  }
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByLabelText("100 puntos de experiencia")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Empezar Grado 2" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", {level:1}).textContent).toBe(questionsForGrade(2)[0].question);
});
