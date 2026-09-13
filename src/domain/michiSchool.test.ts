import { describe, expect, it } from "vitest";
import {
  advanceSchoolProgress,
  createSchoolProgress,
  MICHI_SCHOOL_QUESTIONS,
  questionsForGrade,
  SCHOOL_MAX_GRADE,
  SCHOOL_QUESTIONS_PER_GRADE,
  SCHOOL_XP_PER_ANSWER,
} from "./michiSchool";
import { completeMichiSchoolQuestion, createInitialState } from "./store";

describe("Michi School", () => {
  it("tiene diez preguntas válidas en cada grado", () => {
    for (let grade = 1; grade <= SCHOOL_MAX_GRADE; grade += 1) {
      const questions = questionsForGrade(grade);
      expect(questions).toHaveLength(SCHOOL_QUESTIONS_PER_GRADE);
      expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
      for (const question of questions) {
        expect(question.options).toHaveLength(4);
        expect(question.options[question.answer]).toBeTruthy();
        expect(question.explanation.length).toBeGreaterThan(20);
        expect(question.fact.length).toBeGreaterThan(20);
      }
    }
    expect(new Set(MICHI_SCHOOL_QUESTIONS.map((question) => question.id)).size).toBe(MICHI_SCHOOL_QUESTIONS.length);
  });

  it("avanza de grado al resolver la décima pregunta", () => {
    let progress = createSchoolProgress();
    for (const question of questionsForGrade(1)) {
      progress = advanceSchoolProgress(progress, question.id);
    }
    expect(progress.currentGrade).toBe(2);
    expect(progress.questionIndex).toBe(0);
    expect(progress.correctInGrade).toBe(0);
    expect(progress.graduatedGrades).toEqual([1]);
    expect(progress.totalCorrect).toBe(10);
  });

  it("otorga XP global una sola vez por pregunta", () => {
    const state = createInitialState();
    const questionId = questionsForGrade(1)[0].id;
    const awarded = completeMichiSchoolQuestion(state, questionId);
    const repeated = completeMichiSchoolQuestion(awarded, questionId);

    expect(awarded.trustedEnergy).toBe(SCHOOL_XP_PER_ANSWER);
    expect(awarded.totalEnergy).toBe(SCHOOL_XP_PER_ANSWER);
    expect(awarded.energyEvents[0]).toMatchObject({ source: "michi_school", points: SCHOOL_XP_PER_ANSWER });
    expect(repeated).toBe(awarded);
    expect(repeated.trustedEnergy).toBe(SCHOOL_XP_PER_ANSWER);
  });

  it("rechaza preguntas futuras y desconocidas sin entregar XP", () => {
    const state = createInitialState();
    expect(completeMichiSchoolQuestion(state, questionsForGrade(2)[0].id)).toBe(state);
    expect(completeMichiSchoolQuestion(state, "unknown")).toBe(state);
  });

  it("completa los tres grados sin crear un cuarto ni repetir recompensas", () => {
    let state = createInitialState();
    for (const question of MICHI_SCHOOL_QUESTIONS) {
      state = completeMichiSchoolQuestion(state, question.id);
    }
    expect(state.michiSchool).toMatchObject({ currentGrade: 3, totalCorrect: 30, graduatedGrades: [1, 2, 3] });
    expect(state.totalEnergy).toBe(30 * SCHOOL_XP_PER_ANSWER);
    expect(completeMichiSchoolQuestion(state, MICHI_SCHOOL_QUESTIONS[29].id)).toBe(state);
  });
});
