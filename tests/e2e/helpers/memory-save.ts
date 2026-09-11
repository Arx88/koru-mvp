import type { Page } from "@playwright/test";
import { emitResearch, openResearch, researchChunk } from "./research.ts";

export const MEMORY_TEXT = "Te gustó mucho la serie The Killing (Forbrydelsen / versión US).";
export const REPORT = { type: "deliverable", status: "ready", kicker: "Tu Informe", title: "IA 2027: transformación global", topic: "IA 2027", subtitle: "Una mirada al futuro de la inteligencia artificial", summary: "Resumen de prueba para comprobar el guardado.", progress: 100, categories: [], metrics: [], sources: [], sections: [{ title: "Lo principal", paragraphs: ["El contenido completo del informe se conserva al guardarlo."] }] };

export async function openSaveSheet(page: Page) {
  await openResearch(page);
  await emitResearch(page, { ...researchChunk("done", 100), reply: "Tu informe sobre IA en 2027 está terminado.", uiBlocks: [REPORT], mascotState: "happy" }, true);
  await page.getByRole("button", { name: "Leer el informe completo" }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
  await page.getByRole("dialog", { name: "Guardar informe" }).waitFor();
}

export async function openMemoryToast(page: Page, status: "candidate" | "confirmed" = "confirmed") {
  await openResearch(page);
  await emitResearch(page, { ...researchChunk("done", 100), reply: "Lo voy a recordar.", uiBlocks: [], mascotState: "happy", memoryCandidates: [{ kind: "preference", text: MEMORY_TEXT, status, confidence: 0.95, sensitivity: "normal" }] }, true);
  await page.locator(".mt-memory-toast").waitFor();
}

export async function persistedState(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/domain/persistence.ts";
    const { readLegacyState } = await import(/* @vite-ignore */ path);
    return readLegacyState();
  });
}
