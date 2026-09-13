import {afterEach,it,expect,vi} from "vitest";
import {render,screen,cleanup,waitFor} from "@testing-library/react";
import {MichiMarketCard} from "./MichiNewCards";
import {toPresentation} from "./presentation";
import type {UiBlock} from "../../../domain/types";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const block:UiBlock={type:"crypto_portfolio",items:[{symbol:"BTC",name:"Bitcoin",price:"65000 USD",change:2,color:"orange",bg:"white"}]};
function mount(b:UiBlock){render(<MichiMarketCard block={b} hero={toPresentation(b).hero} isTappable handleClick={vi.fn()} handleKeyDown={vi.fn()} overlay={null}/>);}
it("recupera y dibuja el historial de una tarjeta antigua sin series",async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({source:"Coinbase",currency:"USD",fetchedAt:"2026-09-13T12:00:00Z",series:[{label:"1D",values:[60000,64000,65000]}]})});vi.stubGlobal("fetch",fetcher);mount(block);
 expect(await screen.findByRole("img",{name:/Evolución de BTC/})).toBeTruthy();expect(fetcher).toHaveBeenCalledWith("/api/michi/crypto-history",expect.objectContaining({body:'{"symbol":"BTC","currency":"USD"}'}));
});
it("una lista de series vacía no tapa el sparkline existente",()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);mount({...block,items:[{...block.items![0],series:[]}],sparkline:[2,4,3]});
 expect(screen.getByRole("img",{name:/Evolución de BTC, 1S/})).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();
});
it("si no hay historial muestra reintentar y no inventa un gráfico",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false}));mount({...block,items:[{...block.items![0],symbol:"ETH"}]});
 await waitFor(()=>expect(screen.getByRole("button",{name:"Reintentar gráfico"})).toBeTruthy());expect(screen.queryByRole("img",{name:/Evolución de ETH/})).toBeNull();
});
