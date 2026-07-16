// Image generation tool using OpenAI DALL-E 3 (primary) or Stability AI SDXL (fallback)
// This is a server-side tool that calls external APIs.

// ============================================================================
// Tipos públicos
// ============================================================================

export type ImageStyle = "realistic" | "ukiyoe" | "cinematic" | "anime" | "3d" | "oil";
export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3";
export type ImageModel = "dall-e-3" | "sdxl";

export type ImageGenOptions = {
  /** Número de variantes a generar (default 4). */
  variants?: number;
  /** Preset de estilo que añade un sufijo al prompt. */
  style?: ImageStyle;
  /** Relación de aspecto. */
  aspectRatio?: ImageAspectRatio;
  /** Modelo a forzar; si se omite, se elige DALL-E 3 con fallback SDXL. */
  model?: ImageModel;
};

export type GeneratedImage = {
  id: string;
  url: string;
  promptVariant: string;
  seed: number;
  generationMs: number;
};

export type ImageGenResult = {
  images: GeneratedImage[];
  tips: string[];
  model: string;
  totalTime: number;
};

// ============================================================================
// Presets de estilo (sufijos añadidos al prompt)
// ============================================================================

const STYLE_SUFFIX: Record<ImageStyle, string> = {
  realistic: ", photorealistic, high detail, 8k",
  ukiyoe: ", ukiyo-e style, japanese woodblock print",
  cinematic: ", cinematic lighting, shallow depth of field, film still",
  anime: ", anime style, cel shaded",
  "3d": ", 3d render, octane, blender",
  oil: ", oil painting, textured brushstrokes",
};

// ============================================================================
// Tips estáticos (5, en español) — siempre se devuelven para que el usuario
// aprenda prompt engineering mientras usa la herramienta.
// ============================================================================

const PROMPT_TIPS: string[] = [
  "Sé específico: describe sujeto, acción, fondo y luz en una sola frase.",
  "Indica estilo artístico (fotografía, óleo, anime) antes que detalles técnicos.",
  "Añade perspectiva y encuadre (plano general, primer plano, ángulo cenital).",
  "Menciona paleta de colores o atmósfera (cálido, neón, pastel, brumoso).",
  "Evita negaciones; describe lo que SÍ quieres, no lo que NO quieres ver.",
];

// ============================================================================
// Helpers de tamaño / aspect ratio por modelo
// ============================================================================

/** DALL-E 3 solo acepta 1024x1024, 1792x1024 o 1024x1792. Mapeamos 4:3 al cuadrado. */
function dallESize(aspect: ImageAspectRatio): "1024x1024" | "1792x1024" | "1024x1792" {
  switch (aspect) {
    case "16:9":
      return "1792x1024";
    case "9:16":
      return "1024x1792";
    case "1:1":
    case "4:3":
    default:
      return "1024x1024";
  }
}

/** SDXL 1024 v1.0 acepta estos tamaños fijos. */
function sdxlSize(aspect: ImageAspectRatio): string {
  switch (aspect) {
    case "16:9":
      return "1024x576";
    case "9:16":
      return "576x1024";
    case "4:3":
      return "1024x768";
    case "1:1":
    default:
      return "1024x1024";
  }
}

// ============================================================================
// Fetch con timeout (30s por imagen — la generación puede ser lenta)
// ============================================================================

const PER_IMAGE_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = PER_IMAGE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Generadores por proveedor
// ============================================================================

type OpenAIImageResponse = {
  created?: number;
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
};

type StabilityImageResponse = {
  artifacts?: Array<{ base64?: string; finishReason?: string; seed?: number }>;
};

function randomSeed(): number {
  // Semilla reproducible de 32 bits (Stability usa 0..4294967295).
  return Math.floor(Math.random() * 4_294_967_295);
}

function makeId(prefix: string, variant: number): string {
  return `${prefix}-${Date.now().toString(36)}-${variant.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function generateWithDallE(
  promptVariant: string,
  aspect: ImageAspectRatio,
  apiKey: string,
): Promise<{ url: string; seed: number; generationMs: number }> {
  const startedAt = Date.now();
  const seed = randomSeed();
  const body = {
    model: "dall-e-3",
    prompt: promptVariant,
    n: 1,
    size: dallESize(aspect),
    quality: "standard",
    response_format: "url",
  };

  const res = await fetchWithTimeout("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DALL-E 3 HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as OpenAIImageResponse;
  const url = data.data?.[0]?.url;
  if (!url) {
    throw new Error("DALL-E 3 no devolvió ninguna URL de imagen");
  }
  return { url, seed, generationMs: Date.now() - startedAt };
}

async function generateWithSDXL(
  promptVariant: string,
  aspect: ImageAspectRatio,
  apiKey: string,
): Promise<{ url: string; seed: number; generationMs: number }> {
  const startedAt = Date.now();
  const seed = randomSeed();
  const size = sdxlSize(aspect);

  const form = new FormData();
  form.append("text_prompt", promptVariant);
  form.append("seed", String(seed));
  form.append("cfg_scale", "7");
  form.append("steps", "30");
  form.append("samples", "1");
  form.append("width", size.split("x")[0]!);
  form.append("height", size.split("x")[1]!);

  const res = await fetchWithTimeout(
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: form,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SDXL HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as StabilityImageResponse;
  const b64 = data.artifacts?.[0]?.base64;
  if (!b64) {
    throw new Error("SDXL no devolvió ninguna imagen");
  }
  // Stability devuelve base64 puro; lo envolvemos como data URL.
  const url = `data:image/png;base64,${b64}`;
  return { url, seed: data.artifacts?.[0]?.seed ?? seed, generationMs: Date.now() - startedAt };
}

// ============================================================================
// API pública
// ============================================================================

/**
 * Genera N variantes de imagen a partir de un prompt.
 *
 * Estrategia:
 * - Si `options.model === "dall-e-3"` o no se especifica y existe `OPENAI_API_KEY`,
 *   usa DALL-E 3.
 * - Si `options.model === "sdxl"` o DALL-E 3 falla y existe `STABILITY_API_KEY`,
 *   usa Stability AI SDXL como fallback.
 * - Si no hay ninguna API key configurada, lanza error explícito.
 *
 * Cada variante añade ", variation N" al prompt base + sufijo de estilo.
 */
export async function generateImages(
  prompt: string,
  options?: ImageGenOptions,
): Promise<ImageGenResult> {
  const variants = Math.max(1, options?.variants ?? 4);
  const style = options?.style;
  const aspect: ImageAspectRatio = options?.aspectRatio ?? "1:1";

  const openaiKey = process.env.OPENAI_API_KEY;
  const stabilityKey = process.env.STABILITY_API_KEY;

  if (!openaiKey && !stabilityKey) {
    throw new Error("Image generation requires OPENAI_API_KEY or STABILITY_API_KEY");
  }

  const styleSuffix = style ? STYLE_SUFFIX[style] : "";

  // Selección de modelo principal
  let useModel: ImageModel;
  if (options?.model) {
    useModel = options.model;
  } else if (openaiKey) {
    useModel = "dall-e-3";
  } else {
    useModel = "sdxl";
  }

  // Validación de credenciales para el modelo forzado
  if (useModel === "dall-e-3" && !openaiKey) {
    throw new Error("Image generation requires OPENAI_API_KEY or STABILITY_API_KEY");
  }
  if (useModel === "sdxl" && !stabilityKey) {
    // Si se pidió sdxl pero no hay key, intentamos fallback a DALL-E si existe.
    if (openaiKey) {
      useModel = "dall-e-3";
    } else {
      throw new Error("Image generation requires OPENAI_API_KEY or STABILITY_API_KEY");
    }
  }

  const totalStartedAt = Date.now();
  const images: GeneratedImage[] = [];
  // Modelo que realmente produjo la primera imagen (puede diferir de useModel
  // si hubo fallback). Lo reportamos en `result.model`.
  let usedModel: ImageModel = useModel;

  for (let i = 1; i <= variants; i++) {
    const promptVariant = `${prompt}${styleSuffix}, variation ${i}`;
    let attempt: ImageModel = useModel;
    let lastErr: unknown;

    // Hasta 2 intentos: primero con `attempt`, luego fallback al otro proveedor
    // si está disponible y no fue de autenticación obvia.
    for (let tryNum = 0; tryNum < 2; tryNum++) {
      try {
        let result: { url: string; seed: number; generationMs: number };
        if (attempt === "dall-e-3") {
          if (!openaiKey) throw new Error("OPENAI_API_KEY no configurada");
          result = await generateWithDallE(promptVariant, aspect, openaiKey);
        } else {
          if (!stabilityKey) throw new Error("STABILITY_API_KEY no configurada");
          result = await generateWithSDXL(promptVariant, aspect, stabilityKey);
        }
        images.push({
          id: makeId(attempt, i),
          url: result.url,
          promptVariant,
          seed: result.seed,
          generationMs: result.generationMs,
        });
        if (i === 1) usedModel = attempt;
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        // Fallback al otro proveedor solo si está disponible y no fue
        // selección explícita del usuario.
        if (options?.model) break; // no fallback si se forzó modelo
        if (attempt === "dall-e-3" && stabilityKey) {
          attempt = "sdxl";
        } else if (attempt === "sdxl" && openaiKey) {
          attempt = "dall-e-3";
        } else {
          break;
        }
      }
    }

    if (lastErr) {
      // Re-lanzamos el último error para que el llamador lo maneje.
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
  }

  return {
    images,
    tips: PROMPT_TIPS,
    model: usedModel,
    totalTime: Date.now() - totalStartedAt,
  };
}

// ============================================================================
// Re-exports útiles (tests / UI)
// ============================================================================

export const IMAGE_GEN_TIPS = PROMPT_TIPS;
export const IMAGE_STYLE_PRESETS = STYLE_SUFFIX;
