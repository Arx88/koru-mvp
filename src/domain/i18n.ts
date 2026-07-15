/**
 * Koru i18n — lightweight translation layer.
 *
 * Supports `es` (default) and `en`. The translation map is intentionally small:
 * only UI chrome strings (button labels, screen titles, fixed hints) are translated.
 * Conversational replies from the LLM are handled via a language hint injected
 * into the system prompt (see `buildLanguageInstruction`).
 */

export type KoruLanguage = "es" | "en";

export const SUPPORTED_LANGUAGES: KoruLanguage[] = ["es", "en"];

export const DEFAULT_LANGUAGE: KoruLanguage = "es";

const STRINGS = {
  es: {
    "common.hablar_koru": "Hablar con Koru",
    "common.escribir": "o escribir",
    "common.volver": "Volver",
    "common.guardar": "Guardar",
    "common.confirmar": "Confirmar y continuar",
    "common.entrar": "Entrar a mi dia",
    "common.ajustes": "Ajustes",
    "common.cargando": "Cargando...",

    "onboarding.title": "Soy Koru",
    "onboarding.subtitle": "Un asistente que escucha, ordena y recuerda con tu permiso. Cuentame de ti y yo ordeno el resto.",
    "onboarding.review_title": "Cuentame de ti",
    "onboarding.review_subtitle": "Dime solo lo que quieras que use para ayudarte mejor. Si algo no aplica, dejalo vacio.",
    "onboarding.name_label": "Como te llamo?",
    "onboarding.name_placeholder": "Tu nombre",
    "onboarding.grown_title": "Ya tengo una primera base real",
    "onboarding.grown_subtitle": "No invente un perfil: use solo lo que elegiste compartir. Puedes editarlo cuando quieras.",
    "onboarding.name_required": "Pon tu nombre para continuar",

    "nav.hoy": "Hoy",
    "nav.memoria": "Memoria",
    "nav.permisos": "Permisos",
    "nav.historial": "Historial",
    "nav.configuracion": "Configuracion",

    "settings.title": "Modelo de IA",
    "settings.subtitle": "Seleccioná el modelo que Koru usará para procesar tus mensajes. Los modelos más grandes son más inteligentes pero tardan más.",
    "settings.auto": "Automático (predeterminado)",
    "settings.tip_title": "Consejo",
    "settings.language_title": "Idioma",
    "settings.language_es": "Español",
    "settings.language_en": "Inglés",

    "memory.title": "Mi jardín",
    "memory.search_placeholder": "Buscar memorias...",

    "chat.placeholder": "Habla con Koru...",
    "chat.mod_efimero": "Modo efimero activo - esta charla no guardara memoria nueva",
    "chat.adjuntar": "Adjuntar archivo",
    "chat.quick_actions.wb_sunny": "¿Qué tal el día?",
    "chat.quick_actions.sports_soccer": "¿Cómo salió España?",
    "chat.quick_actions.restaurant": "Receta de pasta",
    "chat.quick_actions.savings": "Precio del bitcoin",
    "chat.quick_actions.calendar_today": "Planifica mi día",

    "permissions.title": "Permisos",
    "permissions.subtitle": "Koru no se alimenta de secretos",
  },
  en: {
    "common.hablar_koru": "Talk to Koru",
    "common.escribir": "or write",
    "common.volver": "Back",
    "common.guardar": "Save",
    "common.confirmar": "Confirm and continue",
    "common.entrar": "Enter my day",
    "common.ajustes": "Settings",
    "common.cargando": "Loading...",

    "onboarding.title": "I'm Koru",
    "onboarding.subtitle": "An assistant that listens, organizes and remembers with your permission. Tell me about yourself and I'll handle the rest.",
    "onboarding.review_title": "Tell me about you",
    "onboarding.review_subtitle": "Tell me only what you want me to use to help you better. If something doesn't apply, leave it blank.",
    "onboarding.name_label": "What should I call you?",
    "onboarding.name_placeholder": "Your name",
    "onboarding.grown_title": "I now have a real first baseline",
    "onboarding.grown_subtitle": "I didn't invent a profile: I used only what you chose to share. You can edit it anytime.",
    "onboarding.name_required": "Please enter your name to continue",

    "nav.hoy": "Today",
    "nav.memoria": "Memory",
    "nav.permisos": "Permissions",
    "nav.historial": "History",
    "nav.configuracion": "Settings",

    "settings.title": "AI Model",
    "settings.subtitle": "Select the model Koru will use to process your messages. Larger models are smarter but take longer.",
    "settings.auto": "Automatic (default)",
    "settings.tip_title": "Tip",
    "settings.language_title": "Language",
    "settings.language_es": "Spanish",
    "settings.language_en": "English",

    "memory.title": "My garden",
    "memory.search_placeholder": "Search memories...",

    "chat.placeholder": "Talk to Koru...",
    "chat.mod_efimero": "Ephemeral mode active — this chat won't store new memories",
    "chat.adjuntar": "Attach file",
    "chat.quick_actions.wb_sunny": "How's the day?",
    "chat.quick_actions.sports_soccer": "How did Spain do?",
    "chat.quick_actions.restaurant": "Pasta recipe",
    "chat.quick_actions.savings": "Bitcoin price",
    "chat.quick_actions.calendar_today": "Plan my day",

    "permissions.title": "Permissions",
    "permissions.subtitle": "Koru doesn't feed on secrets",
  },
} as const;

export type TranslationKey = keyof typeof STRINGS.es;

/**
 * Resolve a translation key in the given language. Falls back to Spanish if
 * the key is missing in the requested language, then to the literal key.
 */
export function t(key: TranslationKey, lang: KoruLanguage = DEFAULT_LANGUAGE): string {
  const langMap = STRINGS[lang] ?? STRINGS[DEFAULT_LANGUAGE];
  return (langMap as Record<string, string>)[key] ?? (STRINGS[DEFAULT_LANGUAGE] as Record<string, string>)[key] ?? String(key);
}

/**
 * Build the language instruction fragment for the LLM system prompt.
 * The LLM is instructed to reply in the user's preferred language.
 */
export function buildLanguageInstruction(lang: KoruLanguage): string {
  if (lang === "en") {
    return `LANGUAGE: Reply to the user in English. The user prefers English. Use natural, warm, friendly English (American). You may still understand Spanish input — just reply in English.`;
  }
  // Spanish (default) — keep current behavior
  return `LANGUAGE: Respondé al usuario en español (rioplatense, voseo natural).`;
}

/**
 * Detect language from a text message. Returns null if it can't decide.
 * Very simple heuristic — good enough for chat (we only switch on explicit
 * user request via Settings, but this lets us auto-detect the first message).
 */
export function detectLanguage(text: string): KoruLanguage | null {
  const lower = text.toLowerCase();
  // English signals
  const englishHits = (lower.match(/\b(the|hello|hi|please|thanks|today|weather|recipe|how are you|good morning|good night|what|where|when|why|who)\b/g) || []).length;
  // Spanish signals
  const spanishHits = (lower.match(/\b(el|la|los|las|hola|buenos dias|buenas tardes|por favor|gracias|hoy|clima|tiempo|receta|como estas|que|donde|cuando|por que|quien)\b/g) || []).length;
  if (englishHits > spanishHits && englishHits >= 2) return "en";
  if (spanishHits > englishHits && spanishHits >= 2) return "es";
  return null;
}

export function isSupportedLanguage(value: unknown): value is KoruLanguage {
  return value === "es" || value === "en";
}
