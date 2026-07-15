/**
 * Koru Voice — Text-to-Speech para que Koru pueda hablar sus respuestas.
 * Usa Web Speech API (SpeechSynthesis) — funciona en Chrome, Edge, Safari, Samsung.
 * Mobile-first: ideal para modo cocina, driving, o cuando no se puede mirar la pantalla.
 */

let enabled = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isVoiceEnabled(): boolean {
  return enabled;
}

export function setVoiceEnabled(v: boolean): void {
  enabled = v;
  if (!v) {
    stopSpeaking();
  }
}

export function isSpeaking(): boolean {
  return typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
}

export function stopSpeaking(): void {
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void {
  if (!enabled) return;
  if (typeof speechSynthesis === "undefined") return;

  // Limpiar texto: remover markdown, emojis, caracteres especiales
  const clean = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[#>_~|]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length < 2) return;

  // Cancelar cualquier reproducción anterior
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = options?.lang ?? "es-ES";
  utterance.rate = options?.rate ?? 1.05;
  utterance.pitch = options?.pitch ?? 1.0;

  // Buscar una voz en español si está disponible
  const voices = speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => v.lang.startsWith("es"));
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

// Precargar voces (algunos browsers las cargan async)
if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.onvoiceschanged = () => {
    speechSynthesis.getVoices();
  };
}
