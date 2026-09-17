/**
 * Actividades de Michi — cuándo puede proponer jugar o estudiar.
 *
 * 🔴 MICHI CONSCIENTE (2026-09-13)
 *
 * Contexto: Michi School y Tic Tac Mich existían como pantallas aisladas. Este
 * módulo es el que las conecta con Michi: decide si su mensaje habilita una
 * propuesta y arma el texto de esa propuesta.
 *
 * Reglas (del prototipo aprobado, ver prototipo-michi-propone.html):
 *
 *  1. La propuesta nace de LO QUE DICE EL USUARIO, nunca del reloj. Nada de
 *     "hace tres días que no juegas".
 *  2. Dos señales distintas, dos tonos distintos:
 *     - aburrimiento → tono juguetón, prefiere Tic Tac (revancha), School de
 *       alternativa;
 *     - bajón/tristeza → tono suave, SOLO School ("algo liviano"), porque
 *       proponer una revancha competitiva a alguien que está mal es lo peor
 *       que puede hacer.
 *  3. Malestar real ("estoy harto del trabajo", "no puedo más", "aburrido de
 *     mi vida") NO habilita NADA: primero se escucha. El juego no es un
 *     remedio. Igual de importante: "estoy aburrido DEL trabajo" es una queja,
 *     no un vacío — el disparador viejo de heartbeatProactive.ts murió por
 *     leer mal una señal así (ver el post-mortem en ese archivo).
 *  4. Puertas deterministas, en código y no en el prompt: cooldown global de
 *     4 h entre propuestas y pausa por actividad cuando el usuario dice
 *     "más tarde". El prompt y la UI leen LAS MISMAS funciones, así que no
 *     pueden discrepar.
 *
 * El modelo decide las palabras del reply; este módulo decide si hay permiso.
 */

import { foldAccents } from "./commitments";
import { declinesOptionalSuggestions } from "./optionalSuggestions";
import {
  currentSchoolQuestion,
  normalizeSchoolProgress,
  questionsForGrade,
  SCHOOL_QUESTIONS_PER_GRADE,
} from "./michiSchool";
import { normalizeTicTacProgress } from "./ticTacMich";
import type { KoruState, MichiActivityInvite, MichiActivityKind } from "./types";

/** Cooldown global entre propuestas, responda el usuario o no. */
export const ACTIVITY_OFFER_COOLDOWN_MS = 4 * 60 * 60 * 1000;
/** Cuánto dura el "más tarde" de una actividad. */
export const ACTIVITY_PAUSE_MS = 4 * 60 * 60 * 1000;

export const MICHI_ACTIVITIES: MichiActivityKind[] = ["school", "ticTac"];

export type ActivitySignal = "bored" | "low" | "distress" | "none";

/**
 * Malestar real: problema que se resuelve hablando, no jugando.
 * "no me rinde", "estoy harto", "ansiedad"… nunca llevan propuesta.
 */
const DISTRESS =
  /\b(estoy hart[oa]s?|estoy quemad[oa]s?|no me rinde|no me rinden|no puedo mas|no doy mas|estoy agotad[oa]s?|estoy desbordad[oa]s?|estoy saturad[oa]s?|ansiedad|angustia|no me da la cabeza|me esta costando|estoy mal|me siento mal|estoy cansad[oa] de todo)\b/;

/**
 * Aburrimiento DIRIGIDO a algo o alguien ("aburrido del trabajo", "me aburre
 * mi jefe"): es una queja con causa, no un vacío que se llene con un juego.
 */
const BOREDOM_ABOUT =
  /\b(aburrid[oa]s?|me aburr\w+|me aburre)\s+(de|del|con|por|de la|de las|de los)\b/;

/** Frases de problema disfrazadas de "no sé qué hacer". */
const PROBLEM_PHRASE = /\b(no se que hacer (con|de)|que hago con|no se para donde ir)\b/;

/** Bajón / tristeza: se acompaña. Habilita una propuesta suave (School). */
const LOW =
  /\b(estoy triste|ando triste|me siento triste|estoy bajon|ando bajon|estoy deprimid[oa]s?|me siento sol[oa]|estoy sol[oa]|me siento vaci[oa]|estoy desanimad[oa]s?|tuve un dia de mierda|un dia horrible|que dia de mierda|estoy bajonead[oa]s?)\b/;

/** Vacío de verdad: aburrimiento sin causa, ganas de algo. */
const BORED =
  /\b(me aburro|estoy aburrid[oa]s?|que aburrido|no tengo nada que hacer|no se que hacer|me sobra el tiempo|estoy al pedo)\b/;

/**
 * Lee la señal del mensaje del usuario. Deliberadamente angosto: prefiere no
 * proponer antes que proponer de más (el costo de una propuesta de más es
 * mucho mayor que el de una de menos).
 */
export function detectActivitySignal(text: string): ActivitySignal {
  const folded = foldAccents(String(text ?? ""));
  if (!folded.trim()) return "none";
  if (DISTRESS.test(folded) || BOREDOM_ABOUT.test(folded) || PROBLEM_PHRASE.test(folded)) {
    return "distress";
  }
  if (LOW.test(folded)) return "low";
  if (BORED.test(folded)) return "bored";
  return "none";
}

export type ActivityOfferGate = {
  /** Actividades que Michi puede proponer ahora mismo. */
  allowed: MichiActivityKind[];
  /** Si no hay ninguna, por qué: cooldown global o pausa pedida por el usuario. */
  blockedBy: "cooldown" | "paused" | null;
};

function parseIso(value?: string): number {
  if (!value) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Puerta de las propuestas. Determinista y pura: la usan el prompt del server
 * (para saber qué puede ofrecer) y la UI (para dibujar la card). Si esta
 * función dice que no, no hay propuesta ni en el texto ni en la pantalla.
 */
export function activityOfferGate(state: KoruState, now: Date = new Date()): ActivityOfferGate {
  const nowMs = now.getTime();
  const lastOffered = parseIso(state.michiInvites?.lastOfferedAt);
  if (Number.isFinite(lastOffered) && nowMs - lastOffered < ACTIVITY_OFFER_COOLDOWN_MS) {
    return { allowed: [], blockedBy: "cooldown" };
  }

  const pausedUntil = state.michiInvites?.pausedUntil ?? {};
  const allowed = MICHI_ACTIVITIES.filter((activity) => {
    const until = parseIso(pausedUntil[activity]);
    return !(Number.isFinite(until) && until > nowMs);
  });
  return { allowed, blockedBy: allowed.length ? null : "paused" };
}

/** Resumen legible del progreso de School (lo usan el prompt y los tests). */
export function schoolSnapshot(state: KoruState): string {
  const progress = normalizeSchoolProgress(state.michiSchool);
  const questions = questionsForGrade(progress.currentGrade);
  const total = questions.length || SCHOOL_QUESTIONS_PER_GRADE;
  const question = currentSchoolQuestion(progress);
  const number = Math.max(1, questions.findIndex((item) => item.id === question.id) + 1);
  return `grado ${progress.currentGrade}, pregunta ${number} de ${total} (${question.category}), ${progress.correctInGrade} correctas en el grado`;
}

/** Resumen legible del Tic Tac (idem). */
export function ticTacSnapshot(state: KoruState): string {
  const progress = normalizeTicTacProgress(state.ticTacMich);
  const { you, michi, draw } = progress.wins;
  const played = you + michi + draw;
  if (!played) return "todavía no jugaron ninguna partida";
  const last =
    progress.lastResult === "you"
      ? "la última la ganó el usuario"
      : progress.lastResult === "michi"
        ? "la última la ganó Michi"
        : progress.lastResult === "draw"
          ? "la última quedó en empate"
          : "sin resultado registrado";
  return `${played} partida(s): usuario ${you}, Michi ${michi}, ${draw} empates; ${last}`;
}

/**
 * Línea para el system prompt: qué puede ofrecer Michi ahora y qué no.
 * Cuando no hay nada disponible, el modelo tiene prohibido PROMETER jugar o
 * estudiar (era el otro error posible: ofrecer algo que la puerta ya cerró).
 */
export function activityOfferSummary(state: KoruState, now: Date = new Date()): string {
  const gate = activityOfferGate(state, now);
  if (!gate.allowed.length) {
    return gate.blockedBy === "cooldown"
      ? "ninguna (ya le propusiste algo hace menos de 4 horas)"
      : "ninguna (pidió \"más tarde\" y esa actividad sigue en pausa)";
  }
  return gate.allowed
    .map((activity) =>
      activity === "school"
        ? `Michi School (${schoolSnapshot(state)})`
        : `Tic Tac Mich (${ticTacSnapshot(state)})`,
    )
    .join("; ");
}

function schoolInviteCopy(state: KoruState, tone: MichiActivityInvite["tone"]) {
  const progress = normalizeSchoolProgress(state.michiSchool);
  const questions = questionsForGrade(progress.currentGrade);
  const total = questions.length || SCHOOL_QUESTIONS_PER_GRADE;
  const question = currentSchoolQuestion(progress);
  const number = Math.max(1, questions.findIndex((item) => item.id === question.id) + 1);
  const done = progress.correctInGrade;

  if (tone === "gentle") {
    return {
      title: "Algo liviano para la cabeza",
      body: `Grado ${progress.currentGrade} · pregunta ${number} de ${total}. Sin apuro y sin coronas.`,
      ctaLabel: "Dale, algo liviano",
    };
  }
  return {
    title: `Michi School · Grado ${progress.currentGrade}`,
    body: `Pregunta ${number} de ${total} — ${question.category}. Llevas ${done} correcta${done === 1 ? "" : "s"} en este grado.`,
    ctaLabel: "Estudiar un rato",
  };
}

function ticTacInviteCopy(state: KoruState) {
  const progress = normalizeTicTacProgress(state.ticTacMich);
  const { you, michi, draw } = progress.wins;
  const last =
    progress.lastResult === "you"
      ? "La última la ganaste tú."
      : progress.lastResult === "michi"
        ? "La última la gané yo."
        : progress.lastResult === "draw"
          ? "La última quedó en empate."
          : "Todavía no jugamos ninguna.";
  const tally =
    you + michi + draw > 0 ? ` Vas ${you} · Michi ${michi} · ${draw} empate${draw === 1 ? "" : "s"}.` : "";
  return {
    title: "Tic Tac Mich — revancha",
    body: `${last}${tally}`.trim(),
    ctaLabel: progress.lastResult === "michi" ? "¡Dale, revancha!" : "Jugar al Tic Tac",
  };
}

/**
 * Arma la invitación concreta (o null si no corresponde). Es el único punto de
 * decisión: si devuelve null, la UI no dibuja nada y el prompt no ofrece nada.
 */
export function buildActivityInvite(input: {
  text: string;
  state: KoruState;
  now?: Date;
}): MichiActivityInvite | null {
  if (declinesOptionalSuggestions(input.text) || input.state.voicePreference?.proactivity === 0) return null;
  const now = input.now ?? new Date();
  const signal = detectActivitySignal(input.text);
  if (signal !== "bored" && signal !== "low") return null;

  const gate = activityOfferGate(input.state, now);
  if (!gate.allowed.length) return null;

  // Bajón → solo School (acompañar). Aburrimiento → Tic Tac primero, School después.
  const preference: MichiActivityKind[] =
    signal === "low" ? ["school"] : ["ticTac", "school"];
  const activity = preference.find((kind) => gate.allowed.includes(kind));
  if (!activity) return null;

  const tone: MichiActivityInvite["tone"] = signal === "low" ? "gentle" : "playful";
  const copy = activity === "school" ? schoolInviteCopy(input.state, tone) : ticTacInviteCopy(input.state);
  return {
    id: `invite_${activity}_${now.getTime()}`,
    activity,
    tone,
    ...copy,
  };
}
