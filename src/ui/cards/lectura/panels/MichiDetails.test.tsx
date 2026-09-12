import {fireEvent,render,screen} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
import {LiveMatchInterior} from "./LiveMatchInterior";
import {TennisInterior} from "./TennisInterior";
import {MichiNewsInterior} from "./MichiNewsInterior";
import {MstatsInterior} from "./MstatsInterior";

describe("Michi detail data integrity",()=>{
 it("finished football with stale minute never offers live goal alerts",()=>{
  render(<LiveMatchInterior block={{type:"live_match",state:"post",minute:"90",homeName:"A",awayName:"B",homeScore:2,awayScore:1}} onClose={vi.fn()}/>);
  expect(screen.queryByText(/en vivo/i)).toBeNull();expect(screen.queryByRole("button",{name:/avisame si hay gol/i})).toBeNull();
 });
 it("scheduled football displays kickoff, not a fabricated score",()=>{
  render(<LiveMatchInterior block={{type:"live_match",state:"pre",time:"21:30",homeName:"A",awayName:"B"}} onClose={vi.fn()}/>);
  expect(document.querySelector(".sb-nums")?.textContent).toBe("21:30");expect(screen.queryByText("0",{exact:true})).toBeNull();
 });
 it("tennis final ignores stale current game and absent stats",()=>{
  render(<TennisInterior block={{type:"tennis_match",status:"finished",players:{home:{name:"Carlos"},away:{name:"Jannik"}},currentSet:{gamesHome:5,gamesAway:3},stats:{aces:{h:8,a:3}}}} onClose={vi.fn()}/>);
  expect(screen.getByText("FINAL")).toBeInTheDocument();expect(screen.queryByText("EN VIVO")).toBeNull();expect(screen.queryByText("Dobles faltas")).toBeNull();expect(screen.getByText("Aces")).toBeInTheDocument();
 });
 it("news preserves source URLs, rejects unsafe links and only dispatches follow once",()=>{
  const listener=vi.fn();window.addEventListener("koru-card-action",listener);
  render(<MichiNewsInterior block={{type:"research_sources",mode:"news",title:"Mi noticia",summary:"Resumen",sources:[{title:"Original",url:"https://example.com/original"},{title:"Sin enlace seguro",url:"javascript:alert(1)"}]}} onClose={vi.fn()}/>);
  expect(screen.getByRole("link",{name:/Original/})).toHaveAttribute("href","https://example.com/original");expect(screen.getAllByRole("link")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"Seguir esta historia"}));const requested=screen.getByRole("button",{name:"Seguimiento solicitado"});expect(requested).toBeDisabled();fireEvent.click(requested);expect(listener).toHaveBeenCalledTimes(1);window.removeEventListener("koru-card-action",listener);
 });
 it("zero home stats still allocate the comparison bar to the away team",()=>{
  render(<MstatsInterior block={{type:"match_stats",homeName:"A",awayName:"B",stats:[{label:"Remates",home:"0",away:"5",width:"0%"}]}} onClose={vi.fn()}/>);
  expect(document.querySelector<HTMLElement>(".md-duel-track i:last-child")?.style.width).toBe("100%");
 });
});
