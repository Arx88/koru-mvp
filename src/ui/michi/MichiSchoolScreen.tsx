import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Earth,
  Lightbulb,
  PawPrint,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { useKoru } from "../KoruProvider";
import { progressForEnergy } from "./avatarCatalog";
import { MichiCat } from "./v8Shared";
import {
  currentSchoolQuestion,
  MICHI_SCHOOL_QUESTIONS,
  normalizeSchoolProgress,
  questionsForGrade,
  SCHOOL_MAX_GRADE,
  SCHOOL_QUESTIONS_PER_GRADE,
  SCHOOL_XP_PER_ANSWER,
} from "../../domain/michiSchool";

const OPTION_LABELS = ["A", "B", "C", "D"];

export function MichiSchoolScreen({ onBack }: { onBack: () => void }) {
  const { state, energy, completeMichiSchoolQuestion } = useKoru();
  const school = normalizeSchoolProgress(state.michiSchool);
  const liveQuestion = currentSchoolQuestion(school);
  const [questionId, setQuestionId] = useState(liveQuestion.id);
  const [selected, setSelected] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [showFact, setShowFact] = useState(false);
  const [showGradeResult, setShowGradeResult] = useState(false);

  const question = useMemo(
    () => MICHI_SCHOOL_QUESTIONS.find((item) => item.id === questionId) ?? liveQuestion,
    [questionId, liveQuestion],
  );
  const questionNumber = Math.max(1, questionsForGrade(question.grade).findIndex((item) => item.id === question.id) + 1);
  const progress = progressForEnergy(energy);
  const allGradesComplete = school.graduatedGrades.includes(SCHOOL_MAX_GRADE);

  useEffect(() => {
    if (!solved && selected === null) setQuestionId(liveQuestion.id);
  }, [liveQuestion.id, selected, solved]);

  function chooseAnswer(index: number) {
    if (solved) return;
    setSelected(index);
    setShowFact(false);
    if (index === question.answer) {
      setSolved(true);
      completeMichiSchoolQuestion(question.id);
    }
  }

  function nextQuestion() {
    if (!solved) return;
    if (questionNumber === SCHOOL_QUESTIONS_PER_GRADE) {
      setShowGradeResult(true);
      return;
    }
    setQuestionId(liveQuestion.id);
    setSelected(null);
    setSolved(false);
    setShowFact(false);
  }

  function continueAfterGrade() {
    setShowGradeResult(false);
    setQuestionId(liveQuestion.id);
    setSelected(null);
    setSolved(false);
    setShowFact(false);
  }

  const selectedWrong = selected !== null && selected !== question.answer;

  return (
    <main className="ms-school" aria-label="Michi School">
      <div className="ms-school-bg" aria-hidden="true" />
      <div className="ms-school-shade" aria-hidden="true" />

      <header className="ms-school-topbar">
        <button className="ms-round-control" type="button" onClick={onBack} aria-label="Salir de Michi School">
          <ArrowLeft />
        </button>
        <div className="ms-school-logo" aria-label="Michi School">
          <PawPrint className="ms-logo-paw" fill="currentColor" />
          <span>Michi</span>
          <strong>School</strong>
        </div>
        <div className="ms-xp-pill" aria-label={`${energy} puntos de experiencia`}>
          <Star fill="currentColor" />
          <span>{energy} XP</span>
        </div>
      </header>

      <section className="ms-lesson-progress" aria-label={`Progreso del grado ${question.grade}`}>
        <div className="ms-grade-line">
          <span>Grado {question.grade}</span>
          <strong>{solved ? questionNumber : questionNumber - 1}/{SCHOOL_QUESTIONS_PER_GRADE}</strong>
        </div>
        <div className="ms-segments" aria-hidden="true">
          {Array.from({ length: SCHOOL_QUESTIONS_PER_GRADE }, (_, index) => (
            <span key={index} className={index < (solved ? questionNumber : questionNumber - 1) ? "is-complete" : index === questionNumber - 1 ? "is-current" : ""} />
          ))}
        </div>
        <p>Pregunta {questionNumber} de {SCHOOL_QUESTIONS_PER_GRADE}</p>
      </section>

      <div className="ms-hero-spacer" aria-hidden="true" />

      <section className="ms-question-card" aria-labelledby="ms-question-title">
        <div className="ms-category-chip"><Earth /> {question.category}</div>
        <h1 id="ms-question-title">{question.question}</h1>

        <div className="ms-options" role="group" aria-label="Opciones de respuesta">
          {question.options.map((option, index) => {
            const correct = index === question.answer;
            const isSelected = selected === index;
            const status = solved && correct ? "is-correct" : isSelected && selectedWrong ? "is-wrong" : "";
            return (
              <button
                type="button"
                className={`ms-option ${status}`}
                key={option}
                onClick={() => chooseAnswer(index)}
                disabled={solved}
                aria-pressed={isSelected}
                aria-label={`${OPTION_LABELS[index]} ${option}`}
              >
                <span className="ms-option-letter">{OPTION_LABELS[index]}</span>
                <span>{option}</span>
                {solved && correct && <Check className="ms-option-status" aria-hidden="true" />}
                {isSelected && selectedWrong && <X className="ms-option-status" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className={`ms-feedback ${solved ? "is-correct" : selectedWrong ? "is-wrong" : "is-idle"}`} aria-live="polite">
          <span className="ms-feedback-icon">
            {solved ? <Check /> : selectedWrong ? <RotateCcw /> : <BookOpenCheck />}
          </span>
          <div>
            <strong>{solved ? "¡Correcto!" : selectedWrong ? "Casi, probá otra vez" : "Elegí una respuesta"}</strong>
            <p>{solved ? question.explanation : selectedWrong ? "Michi te da otra oportunidad. Mirá las opciones con calma." : "Cada acierto suma experiencia y te acerca al próximo grado."}</p>
          </div>
          {solved && (
            <div className="ms-xp-pop" aria-label={`Ganaste ${SCHOOL_XP_PER_ANSWER} XP`}>
              +{SCHOOL_XP_PER_ANSWER} XP
              <MichiCat size={50} />
            </div>
          )}
        </div>

        {showFact && (
          <div className="ms-fact" role="status">
            <Lightbulb fill="currentColor" />
            <p><strong>Dato curioso</strong>{question.fact}</p>
          </div>
        )}
      </section>

      <nav className="ms-school-actions" aria-label="Acciones de la lección">
        <button type="button" className="ms-fact-button" onClick={() => setShowFact((value) => !value)} aria-expanded={showFact}>
          <Lightbulb fill="currentColor" /> Dato curioso
        </button>
        <button type="button" className="ms-next-button" onClick={nextQuestion} disabled={!solved}>
          {questionNumber === SCHOOL_QUESTIONS_PER_GRADE ? "Terminar grado" : "Siguiente"} <ArrowRight />
        </button>
      </nav>

      {(showGradeResult || (allGradesComplete && !solved)) && (
        <div className="ms-result-backdrop" role="dialog" aria-modal="true" aria-labelledby="ms-result-title">
          <section className="ms-result-card">
            <div className="ms-result-glow" aria-hidden="true" />
            <span className="ms-trophy"><Trophy fill="currentColor" /></span>
            <MichiCat className="ms-result-cat" sparkle size={112} />
            <span className="ms-result-kicker"><Sparkles /> Lección completada</span>
            <h2 id="ms-result-title">{allGradesComplete ? "¡Sos parte del Club Michi Sabio!" : `¡Pasaste a Grado ${school.currentGrade}!`}</h2>
            <p>{allGradesComplete ? "Completaste todos los grados disponibles. Tu curiosidad hizo crecer a Michi y también tu nivel." : "Resolviste las diez preguntas. Hay una nueva clase esperándote y todo tu progreso quedó guardado."}</p>
            <div className="ms-result-stats">
              <span><strong>{school.totalCorrect}</strong>Aciertos</span>
              <span><strong>{energy} XP</strong>Experiencia</span>
              <span><strong>{progress.level}</strong>Nivel Michi</span>
            </div>
            <button type="button" onClick={allGradesComplete ? onBack : continueAfterGrade}>
              {allGradesComplete ? "Volver con Michi" : `Empezar Grado ${school.currentGrade}`} <ArrowRight />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
