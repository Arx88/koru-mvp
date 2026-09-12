import type { Page } from "@playwright/test";
import { openResearch, emitResearch, researchChunk } from "./research.ts";
export const NEWS = { type:"research_sources",mode:"news",title:"Noticias de hoy",summary:"",sources:[
  {title:"La inteligencia artificial sigue transformando el mundo",snippet:"Nuevos avances muestran cómo la IA está impulsando cambios en la educación, la salud y el trabajo.",domain:"TechDaily",url:"https://example.com/ia"},
  {title:"Energías para un futuro más limpio",snippet:"Nuevas soluciones aceleran la transición hacia un futuro sostenible.",domain:"GreenToday",url:"https://example.com/energia"},
  {title:"El espacio, cada vez más cerca",snippet:"Nuevas misiones exploran nuestro universo.",domain:"SpaceNews",url:"https://example.com/espacio"}]};
export const RECIPE = {type:"recipe",name:"Pasta a la Carbonara",description:"Cremosa, simple y deliciosa. Un clásico italiano para cualquier ocasión.",category:"Pasta",area:"Italiana",prepTime:"10 min",cookTime:"15 min",servings:2,difficulty:"easy",ingredients:[{ingredient:"Pasta",measure:"200 g"},{ingredient:"Huevos",measure:"2"}],steps:[{step:1,text:"Cocinar la pasta."},{step:2,text:"Mezclar los ingredientes."}]};
export const CRYPTO = {type:"crypto_portfolio",items:[{name:"Bitcoin",symbol:"BTC",price:"77,312.80 USD",change:-2.4,color:"#ffa000",bg:"#fff4dc",marketCap:"1.52T USD",volume:"28.4B USD",series:[{label:"1D",values:[80000,78800,79300,78000,78500,77700,77312.8]},{label:"1S",values:[76000,78000,79000,78500,80000,79000,77312.8]}]},{name:"Ethereum",symbol:"ETH",price:"2,430 USD",change:1.2,color:"#847cf7",bg:"#e8e4ff"}]};
export const STOCK = {type:"market",assets:[{name:"Apple",symbol:"AAPL",price:"230 USD",change:"+1.2%",changeUp:true,volume:"42M",series:[{label:"1D",values:[225,228,226,227,229,230]}]}]};
export const URGENT = {type:"news_urgent",headline:"Alerta por tormenta que avanza rápidamente",summary:"Las autoridades emitieron advertencias en varias regiones ante el avance de un sistema climático. Se esperan fuertes lluvias y vientos.",severity:"breaking",category:"Mundo",lastUpdated:"Hace 12 minutos",sources:[{title:"Actualización meteorológica",domain:"MichiNews",url:"https://example.com/alerta"}],timeline:[{time:"08:00",event:"Aviso publicado",status:"current"}]};
export const BLOCKS = {news:{...NEWS,sources:NEWS.sources.slice(0,1)},carousel:NEWS,urgent:URGENT,recipe:RECIPE,crypto:CRYPTO,stocks:STOCK};
export async function openNewCard(page:Page,kind:keyof typeof BLOCKS) {
 await openResearch(page);
 await emitResearch(page,{...researchChunk("done",100),reply:"Aquí está lo que me pediste.",uiBlocks:[BLOCKS[kind]],mascotState:"happy"},true);
 await page.locator(".mn-card").first().waitFor();
 await page.locator(".mn-card").first().evaluate(el=>{ const scroller=el.closest("main"); if(scroller)scroller.scrollTop=scroller.scrollHeight; });
}
export async function openPersonalPage(page:Page,kind:"Memoria"|"Historial") {
 await openResearch(page);
 await emitResearch(page,{...researchChunk("done",100),reply:"Listo.",uiBlocks:[],mascotState:"happy",memoryCandidates:[
 {kind:"preference",text:"Le interesa IA en 2027",status:"candidate",confidence:.9,sensitivity:"normal"},
 {kind:"preference",text:"Le encantan las guitarras",status:"confirmed",confidence:.9,sensitivity:"normal"},
 {kind:"preference",text:"Le gustó mucho la serie The Killing",status:"candidate",confidence:.9,sensitivity:"normal"}]},true);
 await page.locator(".mt-memory-toast").getByRole("button",{name:"Cerrar",exact:true}).click();
 await page.getByRole("button",{name:"Abrir menú",exact:true}).click();
 await page.getByRole("menuitem",{name:kind,exact:true}).click();
 await page.getByRole("heading",{name:kind,exact:true}).waitFor();
}
