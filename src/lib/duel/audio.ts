// Tiny Web Audio synth for arcade feedback. No asset files needed.

let ctx: AudioContext | null = null;
let muted = false;
let musicTimer: number | null = null;
let musicGeneration = 0;
let desiredMusic: MusicStyle | null = null;

export function setMuted(value: boolean) {
  muted = value;
  if (value) stopMusic();
  else if (desiredMusic) startMusic(desiredMusic);
}

export function isMuted() {
  return muted;
}

function context(): AudioContext | null {
  if (typeof window === "undefined" || muted) return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", delay = 0, gain = 0.12) {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  const start = ac.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  vol.gain.setValueAtTime(0.0001, start);
  vol.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(vol).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export const sfx = {
  countdown: () => tone(440, 0.12, "square"),
  go: () => tone(880, 0.18, "square"),
  tap: () => tone(660, 0.08, "triangle"),
  falseStart: () => {
    tone(150, 0.25, "sawtooth", 0, 0.16);
    tone(110, 0.3, "sawtooth", 0.08, 0.14);
  },
  secured: () => {
    tone(659, 0.10, "triangle", 0, 0.10);
    tone(784, 0.12, "triangle", 0.08, 0.11);
    tone(1046.5, 0.22, "sine", 0.17, 0.13);
    tone(1318.5, 0.30, "sine", 0.27, 0.09);
  },
  win: () => {
    tone(523, 0.14, "triangle", 0);
    tone(659, 0.14, "triangle", 0.12);
    tone(784, 0.28, "triangle", 0.24);
  },
  lose: () => {
    tone(330, 0.18, "sine", 0);
    tone(220, 0.35, "sine", 0.16);
  },
  search: () => tone(520, 0.06, "sine", 0, 0.06),
  /** Melody note for the rhythm minigame. */
  note: (freq: number) => {
    tone(freq, 0.16, "square", 0, 0.09);
    tone(freq / 2, 0.22, "triangle", 0, 0.05);
  },
  miss: () => tone(90, 0.35, "sawtooth", 0, 0.15),
};


export type MusicStyle = "menu" | "matchmaking" | "reaction" | "rhythm" | "direction" | "monkey" | "precision" | "flappy" | "dash" | "stack" | "knife";

type MusicPattern = { notes:number[]; bass:number[]; beat:number; type:OscillatorType; gain:number; arp:number[]; kickEvery:number };

const seq=(...bars:number[][])=>bars.flat();
const patterns:Record<MusicStyle,MusicPattern>={
 menu:{notes:seq(
  [261.63,329.63,392,493.88,440,392,329.63,293.66],[261.63,329.63,440,523.25,493.88,440,392,329.63],
  [293.66,349.23,440,587.33,523.25,440,392,349.23],[329.63,392,493.88,659.25,587.33,523.25,440,392],
  [261.63,392,329.63,493.88,440,329.63,293.66,392],[349.23,440,523.25,698.46,659.25,523.25,440,392],
  [293.66,440,349.23,523.25,493.88,392,329.63,293.66],[261.63,329.63,392,523.25,493.88,392,329.63,261.63]
 ),bass:[130.81,130.81,146.83,146.83,174.61,174.61,164.81,164.81,130.81,196,146.83,220,174.61,196,146.83,130.81],beat:245,type:"triangle",gain:.024,arp:[1,1.25,1.5,2],kickEvery:4},
 matchmaking:{notes:seq([220,0,277.18,0,329.63,0,415.3,440],[246.94,0,311.13,0,369.99,0,466.16,493.88],[261.63,329.63,392,493.88,523.25,493.88,440,392],[293.66,369.99,440,554.37,587.33,554.37,493.88,440]),bass:[110,123.47,130.81,146.83,110,138.59,130.81,164.81],beat:180,type:"square",gain:.02,arp:[1,1.5,2,1.5],kickEvery:4},
 reaction:{notes:seq([220,261.63,293.66,329.63,293.66,261.63,246.94,220],[220,293.66,349.23,293.66,261.63,329.63,392,329.63],[246.94,293.66,369.99,440,369.99,329.63,293.66,246.94],[220,261.63,329.63,392,440,392,329.63,261.63]),bass:[110,110,123.47,110,123.47,146.83,110,130.81],beat:215,type:"triangle",gain:.027,arp:[1,1.5,2,1.5],kickEvery:4},
 rhythm:{notes:seq([329.63,392,493.88,392,349.23,440,523.25,440],[392,493.88,587.33,493.88,440,523.25,659.25,523.25],[349.23,440,523.25,659.25,587.33,523.25,440,392],[329.63,493.88,392,587.33,440,659.25,523.25,783.99]),bass:[164.81,196,174.61,220,196,246.94,174.61,261.63],beat:155,type:"square",gain:.02,arp:[1,1.25,1.5,2],kickEvery:4},
 direction:{notes:seq([220,233.08,277.18,293.66,277.18,233.08,220,329.63],[246.94,277.18,329.63,369.99,329.63,277.18,246.94,392],[220,293.66,349.23,440,349.23,293.66,261.63,329.63],[233.08,311.13,369.99,466.16,415.3,369.99,311.13,277.18]),bass:[110,116.54,138.59,146.83,123.47,138.59,110,155.56],beat:175,type:"triangle",gain:.025,arp:[1,1.5,2,1.5],kickEvery:4},
 monkey:{notes:seq([196,207.65,246.94,261.63,311.13,261.63,246.94,207.65],[220,246.94,293.66,329.63,369.99,329.63,293.66,246.94],[196,261.63,311.13,392,369.99,311.13,261.63,246.94],[207.65,277.18,329.63,415.3,369.99,329.63,277.18,207.65]),bass:[98,103.83,123.47,103.83,110,123.47,98,138.59],beat:235,type:"sine",gain:.028,arp:[1,1.25,1.5,1.25],kickEvery:8},
 precision:{notes:seq([110,116.54,110,130.81,123.47,116.54,103.83,110],[110,138.59,123.47,146.83,130.81,123.47,116.54,103.83],[98,123.47,146.83,123.47,110,130.81,155.56,130.81],[103.83,130.81,164.81,146.83,123.47,116.54,110,98]),bass:[55,55,61.74,51.91,49,61.74,55,65.41],beat:270,type:"sawtooth",gain:.016,arp:[1,1.5,2,1.5],kickEvery:4},
 flappy:{notes:seq([392,523.25,659.25,523.25,440,587.33,698.46,587.33],[440,554.37,659.25,880,783.99,659.25,587.33,523.25],[392,493.88,587.33,783.99,698.46,587.33,523.25,493.88],[440,587.33,698.46,932.33,880,698.46,659.25,587.33]),bass:[196,220,196,293.66,220,246.94,196,261.63],beat:135,type:"square",gain:.019,arp:[1,1.25,1.5,2],kickEvery:4},
 dash:{notes:seq([130.81,196,261.63,196,146.83,220,293.66,220],[164.81,246.94,329.63,246.94,146.83,220,349.23,261.63],[130.81,196,293.66,392,293.66,261.63,220,196],[146.83,220,329.63,440,392,329.63,293.66,220]),bass:[65.41,73.42,65.41,73.42,82.41,73.42,65.41,98],beat:125,type:"square",gain:.022,arp:[1,1.5,2,1.5],kickEvery:4},
 stack:{notes:seq([261.63,329.63,392,523.25,392,329.63,293.66,440],[293.66,369.99,440,587.33,440,369.99,329.63,493.88],[329.63,392,493.88,659.25,587.33,493.88,440,392],[261.63,392,523.25,698.46,659.25,523.25,440,329.63]),bass:[130.81,146.83,164.81,146.83,164.81,196,130.81,174.61],beat:190,type:"triangle",gain:.023,arp:[1,1.25,1.5,2],kickEvery:4},
 knife:{notes:seq([146.83,174.61,220,174.61,155.56,185,233.08,185],[164.81,196,246.94,196,146.83,185,261.63,220],[138.59,174.61,233.08,277.18,233.08,207.65,174.61,155.56],[146.83,220,174.61,293.66,261.63,220,185,164.81]),bass:[73.42,77.78,73.42,92.5,69.3,82.41,73.42,110],beat:150,type:"sawtooth",gain:.017,arp:[1,1.5,2,1.25],kickEvery:4}
};

function percussion(ac:AudioContext,delay=0,gain=.012){
 const start=ac.currentTime+delay;
 const osc=ac.createOscillator(),vol=ac.createGain();
 osc.type="sine";osc.frequency.setValueAtTime(95,start);osc.frequency.exponentialRampToValueAtTime(48,start+.07);
 vol.gain.setValueAtTime(gain,start);vol.gain.exponentialRampToValueAtTime(.0001,start+.09);
 osc.connect(vol).connect(ac.destination);osc.start(start);osc.stop(start+.1);
}
export function stopMusic(){musicGeneration++;if(musicTimer!=null&&typeof window!=="undefined")window.clearTimeout(musicTimer);musicTimer=null;}

export function startMusic(style:MusicStyle):()=>void{
 desiredMusic=style;stopMusic();
 if(typeof window==="undefined"||muted)return()=>{};
 const generation=musicGeneration,p=patterns[style];let i=0;
 const play=()=>{
  if(generation!==musicGeneration||muted)return;
  const ac=context();if(!ac)return;
  const note=p.notes[i%p.notes.length]!;
  if(note>0){
   tone(note,Math.min(.16,p.beat/1150),p.type,0,p.gain);
   if(i%4===2)tone(note*2,.055,"square",.04,p.gain*.22);
  }
  if(i%2===0){
   const bass=p.bass[Math.floor(i/2)%p.bass.length]!;
   tone(bass,Math.min(.25,p.beat/780),"triangle",0,p.gain*.5);
  }
  if(i%p.kickEvery===0)percussion(ac,0,p.gain*.55);
  if(i%8===4){
   const root=p.bass[Math.floor(i/2)%p.bass.length]!;
   p.arp.forEach((ratio,n)=>tone(root*2*ratio,.055,"square",n*(p.beat/1000)/4,p.gain*.13));
  }
  i++;musicTimer=window.setTimeout(play,p.beat);
 };
 play();return()=>{if(generation===musicGeneration)stopMusic();};
}
