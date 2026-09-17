const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const declinedOffer = /\b(?:no (?:quiero|necesito) (?:que me (?:ofrezcas|sugieras|recuerdes)|(?:mas )?(?:sugerencias|recordatorios|propuestas|ofertas|consejos|preguntas|juegos|actividades))|no me (?:ofrezcas|sugieras|recuerdes|aconsejes|preguntes)|sin (?:sugerencias|recordatorios|consejos|preguntas|juegos|actividades)|dejalo|no insistas|solo responde|solo (?:quiero |necesito )?compania|solo (?:escuchame|acompaname))\b/;

export function declinesOptionalSuggestions(text: string): boolean {
  return declinedOffer.test(fold(text));
}
