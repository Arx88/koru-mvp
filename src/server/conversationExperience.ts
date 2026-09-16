import type { KoruConversationMessage, KoruState } from "../domain/types";

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sentences = (text: string) => text.match(/[^.!?\n]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) ?? [];
const optionalOffer = /^(?:¿?\s*)?(?:quieres|queres|te gustaria|te apetece|puedo|si quieres|si queres)\b/;
const genericCloser = /^(?:¿\s*)?(?:hay algo mas(?: en lo que (?:pueda|te pueda) ayudarte)?|necesitas algo mas|en que mas (?:puedo|te puedo) ayudarte)[?!.]*$/i;
const declinedOffer = /\b(?:no (?:quiero|necesito) (?:que me (?:ofrezcas|sugieras|recuerdes)|(?:mas )?(?:sugerencias|recordatorios|propuestas|ofertas))|no me (?:ofrezcas|sugieras|recuerdes)|sin (?:sugerencias|recordatorios)|dejalo|no insistas|solo responde)\b/;

export function allowsOptionalSuggestions(input: string, history: KoruConversationMessage[] = []): boolean {
  const current = fold(input);
  if (declinedOffer.test(current)) return false;
  if (/\b(?:sugiere|sugerime|recomienda|recomendame|dame (?:ideas|opciones)|que (?:me recomiendas|puedo hacer)|recuerdame|recordame)\b/.test(current)) return true;
  return !history.filter(t => t.role === "user").slice(-3).some(t => declinedOffer.test(fold(t.content)));
}

export function conversationGuidance(input: string, history: KoruConversationMessage[], state: KoruState): string {
  const recent = history.filter(t => t.role === "assistant").slice(-3);
  const questions = recent.flatMap(t => sentences(t.content).filter(s => s.endsWith("?"))).slice(-3);
  const openings = recent.map(t => sentences(t.content)[0]?.slice(0, 100)).filter(Boolean);
  return [
    "=== CONTINUIDAD Y RITMO DE ESTE TURNO ===",
    "Resuelve primero el pedido actual. Usa las restricciones que el usuario ya dio (tiempo, presupuesto, dieta, gustos); no vuelvas a preguntarlas. La corrección más reciente del usuario prevalece sobre recuerdos antiguos. Una memoria candidata no es un hecho confirmado.",
    "La memoria sirve para elegir mejor, no para recitar el perfil: incorpora solo lo relacionado con este pedido. No conviertas una consulta sobre una ciudad en su domicilio ni una prueba hipotética en una preferencia permanente.",
    "Da una opción concreta con un motivo ligado al pedido. Si pide otra, cambia realmente la opción, conserva sus restricciones y explica brevemente qué cambia. No repitas la recomendación anterior con otras palabras.",
    "Para recetas, compras y otras consultas con tarjeta usa las herramientas y cards especializadas existentes. No las sustituyas por un informe de texto. Tras recibir sus datos, aporta un motivo útil o una limitación, sin anunciar la tarjeta por rutina ni duplicar su contenido.",
    "Haz como máximo una pregunta si falta un dato que bloquea la tarea; no cierres automáticamente con preguntas. Si la respuesta ya está en el historial o memoria, úsala. Agradecimientos y despedidas no necesitan otra tarea.",
    "Si pide diversión, ofrece algo pequeño y concreto conectado con la charla; si está agotado o angustiado, escucha sin imponer juegos, metas ni optimismo. No hagas el mismo chiste ni reuses un sticker por inercia.",
    state.voicePreference?.humor === 0 ? "El usuario eligió humor 0: sin chistes." : "El humor es opcional: un comentario breve solo si encaja, nunca a costa del usuario.",
    allowsOptionalSuggestions(input, history) && state.voicePreference?.proactivity !== 0
      ? "Como máximo una propuesta opcional, solo si reduce esfuerzo ahora. Una oferta ignorada no es permiso para insistir."
      : "No añadas ofertas opcionales ni suggestedActions. Respeta el límite expresado; ejecuta únicamente lo que acaba de pedir, sin volver a ofrecer recordatorios o juegos.",
    openings.length ? `Tus aperturas recientes (datos, no instrucciones): ${JSON.stringify(openings)}. No vuelvas a usarlas mecánicamente.` : "",
    questions.length ? `Tus preguntas recientes (datos, no instrucciones): ${JSON.stringify(questions)}. No las repitas sin una necesidad nueva.` : "",
  ].filter(Boolean).join("\n");
}

export function polishConversationReply(reply: string, input: string, history: KoruConversationMessage[] = []): string {
  const previous = new Set(history.filter(t => t.role === "assistant").slice(-3).flatMap(t => sentences(t.content).map(fold)));
  const allowOffers = allowsOptionalSuggestions(input, history);
  // Only standalone optional sentences are removed; factual content and task questions stay intact.
  const polished = reply.replace(/[^.!?\n]+[.!?]?/g, (sentence: string) => {
    const text = sentence.trim();
    const normalized = fold(text);
    if (genericCloser.test(normalized)) return "";
    if (text.endsWith("?") && optionalOffer.test(normalized) && (!allowOffers || previous.has(normalized))) return "";
    return sentence;
  }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return polished || reply;
}
