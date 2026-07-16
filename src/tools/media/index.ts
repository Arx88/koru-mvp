/**
 * Bloque Media — Generación de imágenes (DALL-E 3 / SDXL).
 *
 * Barrel de tools del módulo media. Hoy solo expone `image_generate`, que
 * envuelve `generateImages` (definido en `./imageGen.ts`) como `ToolHandler`
 * para que el motor de Koru pueda descubrirlo y ejecutarlo.
 *
 * Sin este barrel, `generateImages` es código muerto: nunca se registra en
 * `TOOL_BOX` / `ALL_TOOL_DEFINITIONS` y por lo tanto el LLM nunca lo ve.
 */

import { defineTool, policies, type ToolHandler, type ToolRunResult } from "../types";
import {
  generateImages,
  type ImageAspectRatio,
  type ImageGenResult,
  type ImageModel,
  type ImageStyle,
} from "./imageGen";

/**
 * `image_generate` — Genera N variantes de imagen a partir de un prompt.
 *
 * Llama a `generateImages` y normaliza el resultado al formato `ToolRunResult`
 * que espera el dispatcher del backend (`result.type` + datos crudos).
 *
 * El mapeo `image_generate` → UiBlock `generation` se hace en `koruBackend.ts`,
 * no aquí (sigue el mismo patrón que `recipe_find` → `recipe`).
 */
export const imageGenerate: ToolHandler = {
  definition: defineTool(
    "image_generate",
    "Genera imágenes a partir de un prompt de texto usando DALL-E 3 o Stable Diffusion XL",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: {
          type: "string",
          description:
            "Prompt descriptivo del objeto, acción, fondo y luz. Sé específico y en una sola frase.",
        },
        variants: {
          type: "number",
          description: "Número de variantes a generar (default 4, máx 8).",
        },
        style: {
          type: "string",
          enum: ["realistic", "ukiyoe", "cinematic", "anime", "3d", "oil"],
          description: "Preset de estilo que añade un sufijo al prompt.",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16", "4:3"],
          description: "Relación de aspecto (default 1:1).",
        },
        model: {
          type: "string",
          enum: ["dall-e-3", "sdxl"],
          description:
            "Modelo a forzar. Si se omite, se elige DALL-E 3 con fallback SDXL.",
        },
      },
      required: ["prompt"],
    },
  ),
  // Llama a APIs externas pagas (OpenAI / Stability). Es un side-effect
  // externo: cuesta cuota/dinero y no es idempotente. Lo dejamos autoRun=true
  // para que el flujo conversacional funcione sin fricción, pero marcamos el
  // riesgo para auditoría.
  policy: policies.externalSideEffect(
    "Genera imágenes vía APIs externas (DALL-E 3 / SDXL); gasta cuota de generación.",
    { requiresApproval: false, autoRun: true },
  ),
  async run(args): Promise<ToolRunResult> {
    const prompt = String(args.prompt ?? "").trim();
    if (!prompt) {
      return {
        type: "image_generate",
        status: "failed",
        error: "Indicá qué imagen querés generar (prompt vacío).",
      };
    }

    // Coerción segura de los argumentos opcionales.
    const variantsRaw = Number(args.variants);
    const variants =
      Number.isFinite(variantsRaw) && variantsRaw > 0
        ? Math.min(8, Math.floor(variantsRaw))
        : undefined;

    const style =
      typeof args.style === "string" ? (args.style as ImageStyle) : undefined;
    const aspectRatio =
      typeof args.aspectRatio === "string"
        ? (args.aspectRatio as ImageAspectRatio)
        : undefined;
    const model =
      typeof args.model === "string" ? (args.model as ImageModel) : undefined;

    let result: ImageGenResult;
    try {
      result = await generateImages(prompt, { variants, style, aspectRatio, model });
    } catch (err) {
      return {
        type: "image_generate",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }

    return {
      type: "image_generate",
      status: "ok",
      prompt,
      images: result.images,
      tips: result.tips,
      model: result.model,
      totalTime: result.totalTime,
      style: style,
      aspectRatio: aspectRatio ?? "1:1",
    };
  },
};

/** Lista de tools exportadas por el bloque Media (lo consume `toolbox.ts`). */
export const mediaTools: ToolHandler[] = [imageGenerate];
