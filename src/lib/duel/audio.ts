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

type MusicPattern = { notes: number[]; bass: number[]; beat: number; type: OscillatorType; gain: number };

const patterns: Record<MusicStyle, MusicPattern> = {
  menu: { notes:[261.63,329.63,392,329.63,293.66,349.23,440,349.23], bass:[130.81,130.81,146.83,146.83], beat:300, type:"triangle", gain:.025 },
  matchmaking: { notes:[220,0,277.18,0,329.63,0,415.3,440], bass:[110,110,123.47,138.59], beat:190, type:"square", gain:.022 },
  reaction: { notes:[220,261.63,293.66,329.63,293.66,261.63,246.94,220], bass:[110,110,123.47,110], beat:230, type:"triangle", gain:.03 },
  rhythm: { notes:[329.63,392,493.88,392,349.23,440,523.25,440], bass:[164.81,196,174.61,220], beat:170, type:"square", gain:.022 },
  direction: { notes:[220,233.08,277.18,293.66,277.18,233.08,220,329.63], bass:[110,116.54,138.59,146.83], beat:190, type:"triangle", gain:.027 },
  monkey: { notes:[196,207.65,246.94,261.63,311.13,261.63,246.94,207.65], bass:[98,103.83,123.47,103.83], beat:260, type:"sine", gain:.03 },
  precision: { notes:[110,116.54,110,130.81,123.47,116.54,103.83,110], bass:[55,55,61.74,51.91], beat:300, type:"sawtooth", gain:.018 },
  flappy: { notes:[392,523.25,659.25,523.25,440,587.33,698.46,587.33], bass:[196,220,196,293.66], beat:145, type:"square", gain:.021 },
  dash: { notes:[130.81,196,261.63,196,146.83,220,293.66,220], bass:[65.41,73.42,65.41,73.42], beat:135, type:"square", gain:.024 },
  stack: { notes:[261.63,329.63,392,523.25,392,329.63,293.66,440], bass:[130.81,146.83,164.81,146.83], beat:210, type:"triangle", gain:.025 },
  knife: { notes:[146.83,174.61,220,174.61,155.56,185,233.08,185], bass:[73.42,77.78,73.42,92.5], beat:165, type:"sawtooth", gain:.019 },
};

export function stopMusic() {
  musicGeneration++;
  if (musicTimer != null && typeof window !== "undefined") window.clearTimeout(musicTimer);
  musicTimer = null;
}

/** Starts an original, asset-free two-voice arcade loop. Only one soundtrack can play at once. */
export function startMusic(style: MusicStyle): () => void {
  desiredMusic = style;
  stopMusic();
  if (typeof window === "undefined" || muted) return () => {};
  const generation = musicGeneration;
  const p = patterns[style];
  let i = 0;
  const play = () => {
    if (generation !== musicGeneration || muted) return;
    const note = p.notes[i % p.notes.length]!;
    if (note > 0) tone(note, Math.min(.18,p.beat/1200),p.type,0,p.gain);
    if (i % 2 === 0) {
      const bass=p.bass[Math.floor(i/2)%p.bass.length]!;
      tone(bass,Math.min(.24,p.beat/850),"triangle",0,p.gain*.55);
    }
    i++;
    musicTimer=window.setTimeout(play,p.beat);
  };
  play();
  return () => { if (generation === musicGeneration) stopMusic(); };
}
