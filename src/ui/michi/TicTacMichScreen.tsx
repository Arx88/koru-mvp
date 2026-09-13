import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Crown, HelpCircle, Pause, Settings, X, Volume2, VolumeX, ArrowRight, RotateCcw, PawPrint, Sparkles } from "lucide-react";
import { chooseMichiMove, legalMoves, play, restoreGame, top, type Move, type Player } from "../../domain/ticTacMich";
import { MichiCat, useMichiUserAvatar } from "./v8Shared";
import { useKoru } from "../KoruProvider";
import { gameSound, unlockGameSound } from "./ticTacSound";
import "./tic-tac-mich.css";

const KEY="michi.tic-tac-mich.v1";
type Session={first:Player;moves:Move[];wins:{you:number;michi:number;draw:number};sound:boolean;difficulty:"calm"|"clever"};
function loadSession():Session {
 const initial:Session={first:"you",moves:[],wins:{you:0,michi:0,draw:0},sound:true,difficulty:"clever"};
 try{const raw=JSON.parse(localStorage.getItem(KEY)||"null");if(!raw)return initial;const first=raw.first==="michi"?"michi":"you";const game=restoreGame(raw.moves,first);return {...initial,first,moves:game.ply===raw.moves?.length?raw.moves:[],wins:Object.fromEntries(["you","michi","draw"].map(k=>[k,Number.isSafeInteger(raw.wins?.[k])&&raw.wins[k]>=0?raw.wins[k]:0])) as Session["wins"],sound:raw.sound!==false,difficulty:raw.difficulty==="calm"?"calm":"clever"};}catch{return initial;}
}
function Token({owner,size,ghost=false}:{owner:Player;size:number;ghost?:boolean}) {
 return <span className={`ttm-token ${owner} ${ghost?"is-ghost":""}`} style={{"--piece-scale":.43+size*.105} as CSSProperties} aria-hidden="true"><img src={`/assets/tic-tac-mich/${owner==="you"?"blue":"pink"}.png`} alt="" draggable={false}/><b>{size}</b></span>;
}
export function TicTacMichScreen({onBack}:{onBack:()=>void}) {
 const [session,setSession]=useState(loadSession);
 const game=useMemo(()=>restoreGame(session.moves,session.first),[session.moves,session.first]);
 const [selected,setSelected]=useState<number|null>(null);
 const [modal,setModal]=useState<"pause"|"help"|"settings"|null>(null);
 const [notice,setNotice]=useState("");
 const [visible,setVisible]=useState(()=>document.visibilityState!=="hidden");
 const [storageFailed,setStorageFailed]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const lastPly=useRef(game.ply);
 const {userAvatar}=useMichiUserAvatar();
 const {recordTicTacMatch}=useKoru();
 // 🔴 MICHI CONSCIENTE (2026-09-13): el resultado viaja al estado de Koru.
 // Antes vivía SOLO en localStorage y el prompt nunca lo veía, así que Michi
 // no podía comentar ni una partida. Se registra en la TRANSICIÓN a partida
 // terminada (una vez por partida) y el ref arranca con el ganador actual:
 // reabrir una partida ya terminada no vuelve a contarla.
 const recordedWinner=useRef(game.winner);
 useEffect(()=>{
   const previous=recordedWinner.current;
   recordedWinner.current=game.winner;
   if(previous===null&&game.winner)recordTicTacMatch(game.winner,session.difficulty);
 },[game.winner,session.difficulty,recordTicTacMatch]);
 const available=legalMoves(game);
 const thinking=game.turn==="michi"&&!game.winner;
 const dialogOpen=!!modal||!!game.winner;
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(session));setStorageFailed(false);}catch{setStorageFailed(true);}},[session]);
 useEffect(()=>{const d=dialog.current;if(!d)return;if(dialogOpen&&!d.open)d.showModal();if(!dialogOpen&&d.open)d.close();},[dialogOpen]);
 useEffect(()=>{const onVisibility=()=>{const active=document.visibilityState!=="hidden";setVisible(active);if(!active)setModal("pause");};document.addEventListener("visibilitychange",onVisibility);return()=>document.removeEventListener("visibilitychange",onVisibility);},[]);
 function commit(move:Move,expectedTurn:Player) {
   setSession(previous=>{const before=restoreGame(previous.moves,previous.first);if(before.turn!==expectedTurn)return previous;const after=play(before,move);if(after===before)return previous;return {...previous,moves:[...previous.moves,move],wins:after.winner?{...previous.wins,[after.winner]:previous.wins[after.winner]+1}:previous.wins};});
   setSelected(null);setNotice("");
 }
 useEffect(()=>{
   if(!thinking||modal||!visible)return;
   const timer=window.setTimeout(()=>{const move=chooseMichiMove(game,session.difficulty);if(move)commit(move,"michi");},850);
   return()=>window.clearTimeout(timer);
 },[game,thinking,modal,visible,session.difficulty]);
 useEffect(()=>{
   if(game.ply>lastPly.current&&session.sound){const stack=game.last?game.board[game.last.cell]:[];gameSound(game.winner==="you"?"win":game.winner==="michi"?"lose":stack.length>1?"cover":"place");}
   lastPly.current=game.ply;
 },[game,session.sound]);
 function again() {setSession(s=>({...s,first:s.first==="you"?"michi":"you",moves:[]}));setSelected(null);setNotice("");setModal(null);}
 function select(size:number) {if(session.sound){unlockGameSound();gameSound("select");}setSelected(n=>n===size?null:size);setNotice("");}
 function place(cell:number) {
   if(thinking||game.winner||modal)return;
   if(selected===null){setNotice("Primero elegí una de tus fichas de abajo.");return;}
   if(!available.some(m=>m.cell===cell&&m.size===selected)){setNotice(`Para cubrir esta ficha necesitás un número mayor que ${top(game.board[cell])?.size}.`);return;}
   if(session.sound)unlockGameSound();commit({cell,size:selected},"you");
 }
 const status=notice || (game.winner ? game.winner==="you"?"¡Tres huellitas en línea!":game.winner==="michi"?"¡Michi hizo tres en línea!":"Nos quedamos sin jugadas." : thinking?"Michi está pensando…":selected===null?"Elegí una ficha y después una casilla":`Ficha ${selected}: tocá una casilla iluminada`);
 return <main className={`ttm-shell ${thinking?"is-thinking":""} ${dialogOpen?"is-paused":""}`}>
   <div className="ttm-scene" aria-hidden="true"/>
   <div className="ttm-game">
     <header className="ttm-header">
       <button className="ttm-round" onClick={()=>setModal("pause")} aria-label="Pausar partida"><Pause fill="currentColor"/></button>
       <div className="ttm-title"><Crown fill="#ffc83d"/><h1>Tic Tac Mich</h1><p>Vos vs Michi</p></div>
       <div className="ttm-tools"><button className="ttm-round" onClick={()=>setModal("help")} aria-label="Cómo jugar"><HelpCircle/></button><button className="ttm-round" onClick={()=>setModal("settings")} aria-label="Ajustes del juego"><Settings/></button></div>
     </header>
     <div className="ttm-players" aria-label="Jugadores y fichas disponibles">
       <div className={`ttm-player you ${game.turn==="you"&&!game.winner?"is-active":""}`}><img className="ttm-avatar" src={userAvatar} alt="Tu avatar"/><div><strong>Vos</strong><span className="ttm-pips" aria-label={`${game.reserves.you.length} fichas disponibles`}>{[1,2,3,4,5].map(n=><i key={n} className={game.reserves.you.includes(n)?"available":""}/>)}</span></div></div>
       <span className="ttm-vs">VS</span>
       <div className={`ttm-player michi ${thinking?"is-active":""}`}><MichiCat size={44}/><div><strong>Michi</strong><span className="ttm-pips" aria-label={`${game.reserves.michi.length} fichas de Michi disponibles`}>{[1,2,3,4,5].map(n=><i key={n} className={game.reserves.michi.includes(n)?"available":""}/>)}</span></div></div>
     </div>
     <div className="ttm-character-space" aria-hidden="true"><span className="ttm-thought"><i/><i/><i/></span><Sparkles className="ttm-twinkle"/></div>
     <div className="ttm-board-wrap"><div className="ttm-board" role="group" aria-label="Tablero, tres filas y tres columnas">
       {game.board.map((stack,cell)=>{const piece=top(stack),valid=selected!==null&&available.some(m=>m.cell===cell&&m.size===selected)&&!thinking;return <button key={cell} type="button" className={`ttm-cell ${valid?"is-legal":""} ${game.line.includes(cell)?"is-winning":""} ${game.last?.cell===cell?"is-last":""}`} disabled={thinking||!!game.winner} onClick={()=>place(cell)} aria-label={`Fila ${Math.floor(cell/3)+1}, columna ${cell%3+1}: ${piece?`${piece.owner==="you"?"tu ficha":"ficha de Michi"} ${piece.size}`:"vacía"}${valid?", disponible":""}`}>
         <PawPrint className="ttm-engraving" fill="currentColor"/>
         {stack.length>1&&<span className="ttm-covered"><Token owner={stack[stack.length-2].owner} size={stack[stack.length-2].size}/></span>}
         {piece&&<span key={`${piece.owner}-${piece.size}`} className="ttm-piece-drop"><Token {...piece}/></span>}
         {!piece&&valid&&<Token owner="you" size={selected!} ghost/>}
         {game.line.includes(cell)&&<Sparkles className="ttm-win-star"/>}
       </button>})}
     </div></div>
     <section className="ttm-reserve" aria-label="Tus fichas">
       <h2>Tus piezas <span>({game.reserves.you.length})</span></h2>
       <div className="ttm-tray">{[1,2,3,4,5].map(size=>{const used=!game.reserves.you.includes(size),blocked=!available.some(m=>m.size===size);return <button type="button" key={size} className={`${selected===size?"is-selected":""} ${used?"is-used":""}`} disabled={used||thinking||!!game.winner||blocked} aria-pressed={selected===size} aria-label={`Ficha ${size}${used?", ya jugada":blocked&&!thinking?", sin casilla disponible":""}`} onClick={()=>select(size)}><Token owner="you" size={size}/>{used&&<span className="ttm-used-label">Jugada</span>}</button>})}</div>
       <p className="ttm-status" role="status" aria-live="polite">{status}</p>
       {game.passed&&!game.winner&&<p className="ttm-pass">{game.passed==="michi"?"Michi no tiene jugadas: seguís vos.":"No te quedan jugadas: sigue Michi."}</p>}
     </section>
     <footer className="ttm-footer"><span>Vos {session.wins.you} <b>·</b> Michi {session.wins.michi}</span><span>{session.wins.draw} empates</span>{storageFailed&&<span>No se pudo guardar esta partida en el dispositivo.</span>}</footer>
   </div>
   <dialog ref={dialog} className="ttm-dialog" aria-labelledby="ttm-dialog-title" onCancel={event=>{if(game.winner)event.preventDefault();else setModal(null);}}>
     <div className="ttm-dialog-card">
       {!game.winner&&<button className="ttm-dialog-close" aria-label="Cerrar" onClick={()=>setModal(null)}><X/></button>}
       <MichiCat size={85}/>
       <h2 id="ttm-dialog-title">{game.winner?game.winner==="you"?"¡Ganaste, crack!":game.winner==="michi"?"Esta fue para Michi":"¡Qué duelo!":modal==="help"?"Las reglas de las huellitas":modal==="settings"?"A tu manera":"Una pausa entre huellitas"}</h2>
       {game.winner?<><p>{game.winner==="draw"?"Nadie puede colocar otra ficha. ¿Probamos otra estrategia?":game.winner==="you"?"Tres fichas tuyas en línea. ¡Bien jugado!":"Michi alineó tres fichas. Guardar las grandes puede cambiar la próxima partida."}</p><div className="ttm-final-score"><span>Vos <b>{session.wins.you}</b></span><span>Michi <b>{session.wins.michi}</b></span></div><button className="ttm-primary" onClick={again}><RotateCcw/>Otra partida</button><button className="ttm-secondary" onClick={onBack}>Volver al chat</button></>:modal==="help"?<><ol><li>Cada uno tiene <strong>cinco fichas, del 1 al 5</strong>. Elegí cualquiera de las tuyas y tocá una casilla.</li><li>Una ficha mayor puede <strong>cubrir una menor</strong>, tuya o de Michi. Las iguales no se pueden cubrir.</li><li>Gana quien alinea <strong>tres fichas visibles</strong> en horizontal, vertical o diagonal.</li><li>Cada ficha se coloca una vez. Si no hay jugadas, pasa el turno; si nadie puede jugar, es empate.</li></ol><button className="ttm-primary" onClick={()=>setModal(null)}>¡A jugar! <ArrowRight/></button></>:modal==="settings"?<><button className="ttm-setting" role="switch" aria-checked={session.sound} onClick={()=>{if(!session.sound)unlockGameSound();setSession(s=>({...s,sound:!s.sound}));}}>{session.sound?<Volume2/>:<VolumeX/>}<span>Sonidos</span><b>{session.sound?"Sí":"No"}</b></button><fieldset><legend>Cómo juega Michi</legend><button aria-pressed={session.difficulty==="calm"} onClick={()=>setSession(s=>({...s,difficulty:"calm"}))}>Tranqui</button><button aria-pressed={session.difficulty==="clever"} onClick={()=>setSession(s=>({...s,difficulty:"clever"}))}>Astuto</button></fieldset><p>Sin reloj: tomate tu tiempo para pensar.</p><button className="ttm-primary" onClick={()=>setModal(null)}>Seguir jugando</button></>:<><p>Tu tablero queda guardado. Michi te espera acá.</p><button className="ttm-primary" onClick={()=>setModal(null)}>Seguir jugando <ArrowRight/></button><button className="ttm-secondary" onClick={onBack}>Volver al chat</button></>}
     </div>
   </dialog>
 </main>;
}
