import {beforeAll,beforeEach,afterEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,cleanup,act} from "@testing-library/react";
import {TicTacMichScreen} from "./TicTacMichScreen";
vi.mock("./v8Shared",()=>({MichiCat:()=> <span>Michi avatar</span>,useMichiUserAvatar:()=>({userAvatar:"/avatar.png"})}));
vi.mock("./ticTacSound",()=>({gameSound:vi.fn(),unlockGameSound:vi.fn()}));
// 🔴 MICHI CONSCIENTE — el resultado de la partida viaja al estado de Koru.
const koru={recordTicTacMatch:vi.fn()};
vi.mock("../KoruProvider",()=>({useKoru:()=>({recordTicTacMatch:koru.recordTicTacMatch})}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};});
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();koru.recordTicTacMatch.mockClear();});
afterEach(()=>{cleanup();vi.useRealTimers();});
const saved=()=>JSON.parse(localStorage.getItem("michi.tic-tac-mich.v1")!);
it("elige, coloca, bloquea un doble toque y espera el turno de Michi",async()=>{
 render(<TicTacMichScreen onBack={vi.fn()}/>);
 fireEvent.click(screen.getByRole("button",{name:"Ficha 1",exact:true}));
 const cell=screen.getByRole("button",{name:/Fila 1, columna 1/});fireEvent.click(cell);fireEvent.click(cell);
 expect(saved().moves).toHaveLength(1);
 await act(async()=>vi.advanceTimersByTime(1000));
 expect(saved().moves).toHaveLength(2);expect(screen.getByRole("button",{name:/Ficha 1, ya jugada/})).toBeDisabled();
});
it("pausa el turno pendiente y conserva el tablero al salir y volver",async()=>{
 const back=vi.fn();const rendered=render(<TicTacMichScreen onBack={back}/>);
 fireEvent.click(screen.getByRole("button",{name:"Ficha 2",exact:true}));fireEvent.click(screen.getByRole("button",{name:/Fila 2, columna 2/}));
 fireEvent.click(screen.getByRole("button",{name:"Pausar partida"}));
 await act(async()=>vi.advanceTimersByTime(2000));expect(saved().moves).toHaveLength(1);
 fireEvent.click(screen.getByRole("button",{name:"Volver al chat"}));expect(back).toHaveBeenCalledOnce();rendered.unmount();
 render(<TicTacMichScreen onBack={back}/>);expect(saved().moves).toHaveLength(1);
 await act(async()=>vi.advanceTimersByTime(1000));expect(saved().moves).toHaveLength(2);
});
it("permite silenciar los sonidos y persiste la preferencia",()=>{
 render(<TicTacMichScreen onBack={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"Ajustes del juego"}));fireEvent.click(screen.getByRole("switch"));expect(saved().sound).toBe(false);
});
// 🔴 MICHI CONSCIENTE — puente al estado: sin esto el resultado moría en localStorage
// y el prompt nunca lo veía (Michi no podía comentar ni una partida).
it("registra el resultado en el estado de Koru cuando termina una partida",async()=>{
 // Partida legal (cada tamaño se usa una sola vez por jugador) donde le toca a
 // Michi y tiene las dos primeras casillas de la fila 0-1-2: gana y se registra.
 localStorage.setItem("michi.tic-tac-mich.v1",JSON.stringify({first:"you",sound:false,difficulty:"clever",wins:{you:0,michi:0,draw:0},moves:[{cell:4,size:1},{cell:0,size:5},{cell:8,size:2},{cell:1,size:4},{cell:7,size:3}]}));
 render(<TicTacMichScreen onBack={vi.fn()}/>);
 await act(async()=>vi.advanceTimersByTime(1200));
 expect(saved().moves).toHaveLength(6);
 expect(koru.recordTicTacMatch).toHaveBeenCalledTimes(1);
 expect(koru.recordTicTacMatch).toHaveBeenCalledWith("michi","clever");
});
// Reabrir una partida YA terminada no es una partida nueva: no se vuelve a contar.
it("no vuelve a registrar una partida ya terminada al reabrir la pantalla",async()=>{
 localStorage.setItem("michi.tic-tac-mich.v1",JSON.stringify({first:"you",sound:false,difficulty:"clever",wins:{you:1,michi:0,draw:0},moves:[{cell:0,size:5},{cell:4,size:4},{cell:3,size:3},{cell:8,size:2},{cell:6,size:1}]}));
 render(<TicTacMichScreen onBack={vi.fn()}/>);
 await act(async()=>vi.advanceTimersByTime(2000));
 expect(saved().moves).toHaveLength(5);
 expect(koru.recordTicTacMatch).not.toHaveBeenCalled();
});
