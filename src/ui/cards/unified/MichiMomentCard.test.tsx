import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MichiMomentCard } from "./MichiMomentCard";
import { toPresentation } from "./presentation";
import type { UiBlock } from "../../../domain/types";
afterEach(cleanup);
it.each<UiBlock>([
  {type:"alarm",time:"07:00",title:"Despertar",repeat:"Una vez"},
  {type:"reminder",title:"Comprar leche",dueText:"Mañana a las 18:00"},
  {type:"birthday_alarm",name:"Sofía",date:"12 de mayo"},
  {type:"saved_record",records:[{id:"r1",title:"Artículo guardado",collection:"Ideas",notes:"Mi nota",domain:"personal",kind:"note",value:"Contenido",createdAt:"2026-09-12",updatedAt:"2026-09-12"}]},
])("abre el contenido real del bloque $type", block => {
  const handleClick=vi.fn(); const presentation=toPresentation(block);
  render(<MichiMomentCard block={block} hero={presentation.hero} isTappable handleClick={handleClick} handleKeyDown={vi.fn()} overlay={null} />);
  fireEvent.click(screen.getByRole("button"));
  expect(handleClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Aviso activado")).toBeNull();
});
