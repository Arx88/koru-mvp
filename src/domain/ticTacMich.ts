import type { TicTacMichProgress } from "./types";

export type Player = "you" | "michi";
export type Piece = { owner: Player; size: number };
export type Move = { cell: number; size: number };
export type Game = { board: Piece[][]; reserves: Record<Player, number[]>; turn: Player; winner: Player | "draw" | null; line: number[]; ply: number; last: Move | null; passed: Player | null };
export const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const other = (p: Player): Player => p === "you" ? "michi" : "you";
export const top = (stack: Piece[]) => stack[stack.length - 1];
export function newGame(first: Player = "you"): Game {
 return { board: Array.from({length:9},()=>[]), reserves:{you:[1,2,3,4,5],michi:[1,2,3,4,5]},turn:first,winner:null,line:[],ply:0,last:null,passed:null };
}
export function legalMoves(game: Game, player = game.turn): Move[] {
 if(game.winner) return [];
 return game.reserves[player].flatMap(size=>game.board.flatMap((stack,cell)=>!top(stack) || top(stack).size < size ? [{cell,size}] : []));
}
export function play(game: Game, move: Move): Game {
 if(!legalMoves(game).some(m=>m.cell===move.cell && m.size===move.size)) return game;
 const owner=game.turn;
 const board=game.board.map((stack,i)=>i===move.cell ? [...stack,{owner,size:move.size}] : stack);
 const line=LINES.find(cells=>cells.every(i=>top(board[i])?.owner===owner)) || [];
 const next:Game={board,reserves:{...game.reserves,[owner]:game.reserves[owner].filter(n=>n!==move.size)},turn:other(owner),winner:line.length ? owner : null,line,ply:game.ply+1,last:move,passed:null};
 if(!next.winner && !legalMoves(next).length) {
   next.turn=owner; next.passed=other(owner);
   if(!legalMoves(next).length) next.winner="draw";
 }
 return next;
}
function evaluate(game:Game):number {
 if(game.winner) return game.winner==="draw" ? 0 : game.winner==="michi" ? 10000-game.ply : -10000+game.ply;
 let score=0;
 for(const line of LINES){
   const pieces=line.map(i=>top(game.board[i]));
   const m=pieces.filter(p=>p?.owner==="michi").length,y=pieces.filter(p=>p?.owner==="you").length;
   if(!y) score += [0,6,55][m] || 0;
   if(!m) score -= [0,6,65][y] || 0;
 }
 game.board.forEach((s,i)=>{const p=top(s);if(p)score+=(p.owner==="michi"?1:-1)*(p.size+(i===4?5:0));});
 return score + game.reserves.michi.reduce((s,n)=>s+n,0)-game.reserves.you.reduce((s,n)=>s+n,0);
}
/** Bounded alpha-beta search: legal moves only; wins and blocks precede positional play. */
export function chooseMichiMove(game:Game, difficulty:"calm"|"clever"="clever"):Move|null {
 if(game.turn!=="michi" || game.winner) return null;
 function search(g:Game,depth:number,alpha:number,beta:number):number {
   if(!depth || g.winner) return evaluate(g);
   const maximizing=g.turn==="michi";
   const children=legalMoves(g).map(move=>({move,next:play(g,move)})).sort((a,b)=>maximizing?evaluate(b.next)-evaluate(a.next):evaluate(a.next)-evaluate(b.next));
   let best=maximizing?-Infinity:Infinity;
   for(const {next} of children.slice(0,12)) {
     const value=search(next,depth-1,alpha,beta);
     best=maximizing?Math.max(best,value):Math.min(best,value);
     if(maximizing) alpha=Math.max(alpha,best); else beta=Math.min(beta,best);
     if(beta<=alpha)break;
   }
   return Number.isFinite(best)?best:0;
 }
 const depth=difficulty==="calm"?1:game.reserves.you.length+game.reserves.michi.length<=4?4:3;
 let best:Move|null=null,value=-Infinity;
 for(const move of legalMoves(game)) {
   const candidate=search(play(game,move),depth,-Infinity,Infinity);
   if(candidate>value || (candidate===value && move.size<(best?.size??6))) {best=move;value=candidate;}
 }
 return best;
}
/** Rebuild saved games through legal moves rather than trusting arbitrary persisted state. */
export function restoreGame(moves: unknown,first:Player):Game {
 let game=newGame(first);
 if(!Array.isArray(moves)||moves.length>10) return game;
 for(const move of moves){if(!move || typeof move.cell!=="number" || typeof move.size!=="number")return newGame(first);const next=play(game,move);if(next===game)return newGame(first);game=next;}
 return game;
}

// ─── Progreso persistente ────────────────────────────────────────────────
// 🔴 MICHI CONSCIENTE (2026-09-13): la pantalla sigue guardando la partida en
// localStorage (para poder reanudarla), pero el RESULTADO también vive en el
// estado de Koru — sin eso Michi no puede comentar ninguna partida porque el
// prompt nunca ve el localStorage. Mismo patrón que michiSchool.ts.

export function createTicTacProgress(): TicTacMichProgress {
  return { wins: { you: 0, michi: 0, draw: 0 }, difficulty: "clever" };
}

function safeWins(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function normalizeTicTacProgress(value?: Partial<TicTacMichProgress> | null): TicTacMichProgress {
  const result = value?.lastResult;
  return {
    wins: {
      you: safeWins(value?.wins?.you),
      michi: safeWins(value?.wins?.michi),
      draw: safeWins(value?.wins?.draw),
    },
    lastResult: result === "you" || result === "michi" || result === "draw" ? result : undefined,
    lastPlayedAt: typeof value?.lastPlayedAt === "string" ? value.lastPlayedAt : undefined,
    difficulty: value?.difficulty === "calm" ? "calm" : "clever",
  };
}

/** Suma una partida terminada. Idempotente por `playedAt`: si el mismo
 *  instante entra dos veces (StrictMode, doble render), no cuenta doble. */
export function recordTicTacResult(
  progress: TicTacMichProgress | undefined,
  result: NonNullable<TicTacMichProgress["lastResult"]>,
  difficulty: TicTacMichProgress["difficulty"],
  playedAt: string,
): TicTacMichProgress {
  const current = normalizeTicTacProgress(progress);
  if (!playedAt || current.lastPlayedAt === playedAt) return current;
  return {
    wins: { ...current.wins, [result]: current.wins[result] + 1 },
    lastResult: result,
    lastPlayedAt: playedAt,
    difficulty: difficulty === "calm" ? "calm" : "clever",
  };
}
