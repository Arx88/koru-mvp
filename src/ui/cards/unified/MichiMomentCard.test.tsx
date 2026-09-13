import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MichiMomentCard } from "./MichiMomentCard";
import { toPresentation } from "./presentation";
import type { UiBlock } from "../../../domain/types";
afterEach(cleanup);
it("conserva valor, nota y los demás elementos guardados",()=>{
 const block:UiBlock={type:"saved_record",records:[{title:"Reserva",domain:"personal",kind:"idea",value:"Mesa para dos",notes:"Junto a la ventana",person:"Sofía"},{title:"Paseo",domain:"personal",kind:"idea",value:"Después de cenar"}]};
 render(<MichiMomentCard block={block} hero={toPresentation(block).hero} isTappable handleClick={vi.fn()} handleKeyDown={vi.fn()} overlay={null}/>);
 for(const value of ["Mesa para dos","Junto a la ventana","Sofía","Paseo","Después de cenar"]) expect(screen.getByText(value)).toBeTruthy();
 expect(screen.getByRole("button",{name:"Ver elementos"})).toBeTruthy();
});
it.each<UiBlock>([
  {type:"alarm",time:"07:00",title:"Despertar",repeat:"Una vez"},
  {type:"reminder",title:"Comprar leche",dueText:"Mañana a las 18:00"},
  {type:"birthday_alarm",name:"Sofía",date:"12 de mayo"},
  {type:"saved_record",records:[{title:"Artículo guardado",collection:"Ideas",notes:"Mi nota",domain:"personal",kind:"idea",value:"Contenido"}]},
])("abre el contenido real del bloque $type", block => {
  const handleClick=vi.fn(); const presentation=toPresentation(block);
  render(<MichiMomentCard block={block} hero={presentation.hero} isTappable handleClick={handleClick} handleKeyDown={vi.fn()} overlay={null} />);
  fireEvent.click(screen.getByRole("button"));
  expect(handleClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Aviso activado")).toBeNull();
});

it("conserva la vista previa del contenido guardado y tolera una imagen rota",()=>{
 const block:UiBlock={type:"saved_record",records:[{title:"Mi receta",domain:"personal",kind:"idea",url:"https://example.com/receta",sourceBlock:{type:"recipe",name:"Mi receta",image:"https://example.com/receta.jpg"}}]};
 const {container}=render(<MichiMomentCard block={block} hero={toPresentation(block).hero} isTappable handleClick={vi.fn()} handleKeyDown={vi.fn()} overlay={null}/>);
 const preview=container.querySelector(".mm-preview-image img");
 expect(preview?.getAttribute("src")).toBe("https://example.com/receta.jpg");
 expect(screen.getByText("example.com")).toBeTruthy();
 fireEvent.error(preview!);
 expect(container.querySelector(".mm-preview-image")).toBeNull();
 expect(screen.getByRole("button",{name:"Ver elemento"})).toBeTruthy();
});
