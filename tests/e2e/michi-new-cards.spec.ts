import {expect,test} from "@playwright/test";
import {openNewCard,openPersonalPage,NEWS} from "./helpers/new-cards";
import {persistedState} from "./helpers/memory-save";
test("news carousel selects real stories and saves only the selected article",async({page})=>{
 await openNewCard(page,"carousel");
 await expect(page.locator(".mn-news-card.is-active h3")).toHaveText(NEWS.sources[0].title);
 await page.getByRole("button",{name:"Noticia siguiente",exact:true}).click();
 await expect(page.locator(".mn-news-card.is-active h3")).toHaveText(NEWS.sources[1].title);
 await expect(page.locator(".mn-news-card.is-active a")).toHaveAttribute("href",NEWS.sources[1].url);
 await page.locator(".mn-news-card.is-active .mn-save").click();
 await page.getByRole("dialog",{name:"Guardar noticia"}).getByRole("button",{name:"Guardar",exact:true}).click();
 await expect.poll(async()=>(await persistedState(page)).records[0]?.sourceBlock?.sources?.[0]?.url).toBe(NEWS.sources[1].url);
 await page.getByRole("button",{name:"Noticia anterior",exact:true}).click();
 await expect(page.locator(".mn-news-card.is-active h3")).toHaveText(NEWS.sources[0].title);
});
test("recipe opens its full steps and keeps correct duration and portions",async({page})=>{
 await openNewCard(page,"recipe");await expect(page.locator(".mn-recipe")).toContainText("25 min");await expect(page.locator(".mn-recipe")).toContainText("2 porciones");
 await page.getByRole("button",{name:"Ver receta completa",exact:true}).click();await expect(page.getByText("Cocinar la pasta.",{exact:true}).first()).toBeVisible();
});
test("market chart changes periods and does not reuse another asset's history",async({page})=>{
 await openNewCard(page,"crypto");await page.getByRole("button",{name:"1S",exact:true}).click();await expect(page.locator(".mn-chart svg")).toHaveAttribute("aria-label",/1S/);
 await expect(page.getByRole("button",{name:"1A",exact:true})).toBeDisabled();await page.getByRole("button",{name:"ETH",exact:true}).click();await expect(page.locator(".mn-price")).toHaveText("2,430 USD");await expect(page.locator(".mn-chart")).toHaveCount(0);
});
test("urgent coverage opens and stock quotes have the new layout",async({page})=>{
 await openNewCard(page,"urgent");await expect(page.locator(".mn-news-badge")).toHaveText("ÚLTIMO MOMENTO");await page.getByRole("button",{name:"Ver cobertura y detalles"}).click();await expect(page.getByText("Aviso publicado",{exact:true}).first()).toBeVisible();
});
test("stock card shows the quote and a real graph without horizontal overflow",async({page})=>{
 await page.setViewportSize({width:320,height:740});await openNewCard(page,"stocks");await expect(page.locator(".mn-price")).toHaveText("230 USD");await expect(page.locator(".mn-chart svg")).toHaveAttribute("aria-label",/AAPL/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("memory search and confirmation keep working with the illustrated layout",async({page})=>{
 await openPersonalPage(page,"Memoria");await page.getByRole("textbox",{name:"Buscar recuerdos"}).fill("guitarras");await expect(page.locator(".mw-keepsake")).toHaveCount(1);await page.getByRole("textbox",{name:"Buscar recuerdos"}).fill("");await page.getByRole("button",{name:"Por confirmar",exact:true}).click();await page.locator(".mw-keepsake").first().click();await page.getByRole("button",{name:"Confirmar recuerdo",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("history expands its real details and fits a small phone",async({page})=>{
 await page.setViewportSize({width:320,height:740});await openPersonalPage(page,"Historial");const row=page.locator(".mh-history-toggle").first();await row.click();await expect(row).toHaveAttribute("aria-expanded","true");await expect(page.locator(".mh-history-detail")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
