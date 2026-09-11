import { expect, test } from "@playwright/test";
import { MEMORY_TEXT, REPORT, openMemoryToast, openSaveSheet, persistedState } from "./helpers/memory-save";

test("automatic save requires confirmation and keeps the complete report", async ({ page }) => {
  await openSaveSheet(page);
  const dialog = page.getByRole("dialog", { name: "Guardar informe" });
  await expect(dialog.getByRole("radio", { name: /Que Michi se encargue/ })).toBeChecked();
  expect((await persistedState(page)).records).toHaveLength(0);
  for (let i=0;i<6;i++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true); }
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await persistedState(page)).records.length).toBe(1);
  const record=(await persistedState(page)).records[0];
  expect(record.collection).toBe("Michi · IA 2027");
  expect(record.sourceBlock).toMatchObject(REPORT);
  await expect(page.locator(".mt-memory-toast").getByRole("button", { name: "Ver" })).toBeVisible();
  await page.locator(".mt-memory-toast").getByRole("button", { name: "Ver" }).click();
  await expect(page.getByText("Michi · IA 2027", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect.poll(async () => (await persistedState(page)).records[0]?.sourceBlock?.summary).toBe(REPORT.summary);
});

test("named folders, blank validation and cancellation work on a small phone", async ({ page }) => {
  await page.setViewportSize({width:320,height:640});
  await openSaveSheet(page);
  const dialog=page.getByRole("dialog", { name:"Guardar informe" });
  await dialog.getByRole("radio", { name:/Elegir carpeta/ }).check();
  const field=dialog.getByRole("combobox", { name:"Nombre de la carpeta" });
  await field.fill("   ");
  await expect(dialog.getByRole("button", { name:"Guardar",exact:true })).toBeDisabled();
  await field.fill("Mis informes");
  expect((await persistedState(page)).records).toHaveLength(0);
  const bounds=await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(10);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(310);
  await field.press("Enter");
  await expect.poll(async ()=>(await persistedState(page)).records[0]?.collection).toBe("Mis informes");
  await page.evaluate(report=>window.dispatchEvent(new CustomEvent("koru-save-deliverable",{detail:{title:report.title,blockData:report}})),REPORT);
  await expect(dialog.getByRole("radio",{name:/Que Michi se encargue/})).toBeChecked();
  await dialog.getByRole("button",{name:"Cancelar"}).click();
  expect((await persistedState(page)).records).toHaveLength(1);
  await page.evaluate(report=>window.dispatchEvent(new CustomEvent("koru-save-deliverable",{detail:{title:report.title,blockData:report}})),REPORT);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByPlaceholder("Habla con Michi...")).toBeVisible();
});

test("candidate memory waits for the decision and shows saved feedback", async ({ page }) => {
  await openMemoryToast(page,"candidate");
  const toast=page.locator(".mt-memory-toast");
  await expect(toast).toContainText("¿Guardamos este recuerdo?");
  await page.clock.fastForward(8000);
  await expect(toast.getByRole("button",{name:"Guardar",exact:true})).toBeVisible();
  await toast.getByRole("button",{name:"Guardar",exact:true}).click();
  await expect(toast).toContainText("Recuerdo guardado");
  expect((await persistedState(page)).memories.find((m:any)=>m.text===MEMORY_TEXT).status).toBe("confirmed");
  await page.clock.fastForward(2000);
  await expect(toast).not.toBeVisible();
});

test("confirmed memories match the banner and can be closed without editing them", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await openMemoryToast(page);
  const toast=page.locator(".mt-memory-toast");
  await expect(toast).toContainText("Recuerdo guardado");
  await expect(toast.getByRole("button",{name:"Guardar",exact:true})).toHaveCount(0);
  expect(await toast.evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  expect(await toast.locator("img").evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await toast.getByRole("button",{name:"Cerrar"}).click();
  await expect(toast).not.toBeVisible();
  expect((await persistedState(page)).memories.find((m:any)=>m.text===MEMORY_TEXT).status).toBe("confirmed");
});

test("rejected memories are not confirmed by the notification", async ({ page }) => {
  await openMemoryToast(page,"candidate");
  await page.locator(".mt-memory-toast").getByRole("button",{name:"Soltar"}).click();
  await expect(page.locator(".mt-memory-toast")).toContainText("Recuerdo soltado");
  const memory=(await persistedState(page)).memories.find((m:any)=>m.text===MEMORY_TEXT);
  expect(memory?.status).not.toBe("confirmed");
});

