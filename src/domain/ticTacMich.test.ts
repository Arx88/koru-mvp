import {describe,it,expect} from "vitest";
import {newGame,play,top,legalMoves,chooseMichiMove,restoreGame,type Game} from "./ticTacMich";
describe("Tic Tac Mich",()=>{
 it("permite cubrir solo con un número mayor y conserva la pila",()=>{
   let g=play(newGame(),{cell:0,size:2});
   expect(play(g,{cell:0,size:2})).toBe(g);expect(play(g,{cell:0,size:1})).toBe(g);
   g=play(g,{cell:0,size:4});expect(g.board[0]).toHaveLength(2);expect(top(g.board[0])).toEqual({owner:"michi",size:4});
   expect(g.reserves.you).not.toContain(2);expect(g.reserves.michi).not.toContain(4);
 });
 it("no permite reutilizar fichas ni jugar fuera del tablero",()=>{
   let g=play(newGame(),{cell:0,size:2});g=play(g,{cell:4,size:1});expect(play(g,{cell:2,size:2})).toBe(g);expect(play(g,{cell:9,size:5})).toBe(g);
 });
 it("gana al alinear tres visibles y no acepta más movimientos",()=>{
   const moves=[{cell:0,size:1},{cell:3,size:1},{cell:1,size:2},{cell:4,size:2},{cell:2,size:3}];
   const g=restoreGame(moves,"you");expect(g.winner).toBe("you");expect(g.line).toEqual([0,1,2]);expect(legalMoves(g)).toEqual([]);
 });
 it("Michi toma la victoria inmediata y puede comerse una ficha para lograrla",()=>{
   const g=restoreGame([{cell:0,size:1},{cell:3,size:1},{cell:8,size:2},{cell:4,size:2},{cell:5,size:3}],"you");
   const move=chooseMichiMove(g)!;expect(move.cell).toBe(5);expect(move.size).toBeGreaterThan(3);expect(play(g,move).winner).toBe("michi");
 });
 it("Michi evita dejar una victoria inmediata al usuario",()=>{
   const g=restoreGame([{cell:0,size:4},{cell:4,size:1},{cell:1,size:5}],"you");
   const after=play(g,chooseMichiMove(g)!);expect(legalMoves(after).some(m=>play(after,m).winner==="you")).toBe(false);
 });
 it("no inventa movimientos y termina las partidas en diez colocaciones como máximo",()=>{
   for(let seed=0;seed<8;seed++){let g:Game=newGame();while(!g.winner){const moves=legalMoves(g);expect(moves.length).toBeGreaterThan(0);const move=g.turn==="michi"?chooseMichiMove(g,"calm")!:moves[(seed+g.ply*7)%moves.length];g=play(g,move);expect(g.ply).toBeLessThanOrEqual(10);}expect(g.winner).toBeTruthy();}
 });
 it("descarta una partida guardada manipulada",()=>{expect(restoreGame([{cell:99,size:5}],"you").ply).toBe(0);});
});
