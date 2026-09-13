import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {MichiFootballMatch} from "./MichiFootballMatch";
import {toPresentation} from "./presentation";
import type {UiBlock} from "../../../domain/types";
afterEach(cleanup);
function mount(block:Extract<UiBlock,{type:"live_match"}>) {
 const handleClick=vi.fn();
 render(<MichiFootballMatch block={block} hero={toPresentation(block).hero} isTappable handleClick={handleClick} handleKeyDown={vi.fn()} overlay={null}/>);
 return handleClick;
}
it("muestra ambos equipos y estadísticas reales y abre el detalle",()=>{
 const click=mount({type:"live_match",homeName:"Boca",awayName:"River",homeScore:2,awayScore:1,state:"post",detailedStats:[{label:"Posesión",home:54,away:46,isPercent:true},{label:"Remates",home:12,away:7,isPercent:false}]});
 expect(screen.getByText("2 - 1")).toBeTruthy();expect(screen.getByText("54%")).toBeTruthy();expect(screen.getByText("46%")).toBeTruthy();expect(screen.getByText("Remates")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Ver detalle"}));expect(click).toHaveBeenCalledTimes(1);
});
it("un partido programado muestra su horario y no un cero a cero ficticio",()=>{
 mount({type:"live_match",homeName:"Boca",awayName:"River",state:"pre",time:"18:30"});
 expect(screen.getByText("18:30")).toBeTruthy();expect(screen.queryByText("0 - 0")).toBeNull();expect(screen.queryByText("Posesión")).toBeNull();
});
it("no inventa el marcador ni la posesión si el proveedor no los envió",()=>{
 mount({type:"live_match",homeName:"Boca",awayName:"River",state:"post"});
 expect(screen.getByText("— - —")).toBeTruthy();expect(screen.queryByText("50%")).toBeNull();
});
it("conserva las estadísticas del formato anterior y los datos de la sede",()=>{
 mount({type:"live_match",homeName:"Boca",awayName:"River",state:"in",minute:"78'",league:"Liga Profesional",venue:"La Bombonera",venueCity:"Buenos Aires",homePossession:"54%",awayPossession:"46%",homeShots:"12",awayShots:"7"});
 expect(screen.getByText("54%")).toBeTruthy();expect(screen.getByText("46%")).toBeTruthy();expect(screen.getByText("Remates")).toBeTruthy();
 expect(screen.getByText("Liga Profesional")).toBeTruthy();expect(screen.getByText("La Bombonera · Buenos Aires")).toBeTruthy();expect(screen.getByText("78′")).toBeTruthy();
});
