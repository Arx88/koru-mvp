export type SpeechSupport = {
  supported: boolean;
  label: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function getSpeechSupport(): SpeechSupport {
  return getSpeechRecognitionConstructor()
    ? { supported: true, label: "Transcripcion de voz disponible en este navegador." }
    : { supported: false, label: "Este navegador no ofrece transcripcion de voz local." };
}

export function createSpeechSession(options: {
  onFinalText: (text: string) => void;
  onInterimText: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
  continuous?: boolean;
}): SpeechRecognitionLike | null {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = "es-ES";
  recognition.interimResults = true;
  recognition.continuous = options.continuous ?? false;
  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }
    if (finalText.trim()) options.onFinalText(finalText.trim());
    options.onInterimText(interimText.trim());
  };
  recognition.onerror = (event) => {
    options.onError(event.error ? `No pude transcribir: ${event.error}` : "No pude transcribir esa voz.");
  };
  recognition.onend = options.onEnd;
  return recognition;
}
