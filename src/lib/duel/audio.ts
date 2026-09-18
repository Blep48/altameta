// Tiny Web Audio synth for arcade feedback. No asset files needed.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
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


export type MusicStyle = "reaction" | "direction" | "monkey" | "precision" | "flappy" | "dash";

/** Starts a tiny original looping synth motif. Returns a stop function. */
export function startMusic(style: MusicStyle): () => void {
  const patterns: Record<MusicStyle, { notes: number[]; beat: number; type: OscillatorType; gain: number }> = {
    reaction: { notes: [220, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94, 220], beat: 230, type: "triangle", gain: 0.035 },
    direction: { notes: [220, 233.08, 277.18, 293.66, 277.18, 233.08, 220, 329.63], beat: 190, type: "triangle", gain: 0.032 },
    monkey: { notes: [196, 207.65, 246.94, 261.63, 311.13, 261.63, 246.94, 207.65], beat: 260, type: "sine", gain: 0.035 },
    precision: { notes: [110, 116.54, 110, 130.81, 123.47, 116.54, 103.83, 110], beat: 300, type: "sawtooth", gain: 0.022 },
    flappy: { notes: [392, 523.25, 659.25, 523.25, 440, 587.33, 698.46, 587.33], beat: 170, type: "square", gain: 0.025 },
    dash: { notes: [130.81, 196, 261.63, 196, 146.83, 220, 293.66, 220], beat: 135, type: "square", gain: 0.028 },
  };
  const p = patterns[style];
  let i = 0;
  const play = () => { tone(p.notes[i % p.notes.length]!, Math.min(0.16, p.beat / 1400), p.type, 0, p.gain); i++; };
  play();
  const timer = window.setInterval(play, p.beat);
  return () => window.clearInterval(timer);
}
