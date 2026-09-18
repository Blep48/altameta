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
