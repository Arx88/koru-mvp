let context:AudioContext|null=null;
export function unlockGameSound(){try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{/* Audio is optional. */}}
export function gameSound(kind:"select"|"place"|"cover"|"win"|"lose") {
 if(!context || context.state!=="running")return;
 const notes={select:[660],place:[340,510],cover:[260,420,740],win:[523,659,784,1047],lose:[440,349,294]}[kind];
 const ctx=context;
 notes.forEach((frequency,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();const at=ctx.currentTime+i*.085;osc.type="sine";osc.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.055,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+.2);osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.22);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
}
