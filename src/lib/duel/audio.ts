// Tiny Web Audio synth for arcade feedback. No asset files needed.

let ctx: AudioContext | null = null;
let muted = false;
let musicTimer: number | null = null;
let musicGeneration = 0;

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

const jadePath = new URL("../../../jade_path_through_the_clouds.mp3", import.meta.url).href;
const secretTrack = new URL("../../../tarantella_d_a_vita.mp3", import.meta.url).href;
const gameTracks = [
  new URL("../../../the_frozen_chase.mp3", import.meta.url).href,
  new URL("../../../the_seventh_gate.mp3", import.meta.url).href,
  new URL("../../../tropical_joypad.mp3", import.meta.url).href,
  new URL("../../../salento_chase.mp3", import.meta.url).href,
  new URL("../../../balalaika_boss_battle.mp3", import.meta.url).href,
];

let music: HTMLAudioElement | null = null;
let desiredMusic: MusicStyle | null = null;
let selectedGameTrack: string | null = null;

function chooseGameTrack() {
  // Easter egg: exactly one chance in 1000 for each newly started game soundtrack.
  if (Math.floor(Math.random() * 1000) === 0) return secretTrack;
  return gameTracks[Math.floor(Math.random() * gameTracks.length)]!;
}

export function stopMusic() {
  if (music) {
    music.pause();
    music.src = "";
    music.load();
    music = null;
  }
}

export function startMusic(style: MusicStyle): () => void {
  desiredMusic = style;
  stopMusic();
  if (typeof window === "undefined" || muted) return () => {};

  // Jade Path owns menus. Matchmaking stays on the chosen game track so the
  // music does not restart between finding an opponent and entering the arena.
  if (style === "menu") selectedGameTrack = null;
  if (style !== "menu" && style !== "matchmaking") selectedGameTrack ??= chooseGameTrack();
  const src = style === "menu" ? jadePath : selectedGameTrack;
  if (!src) return () => {};

  const audio = new Audio(src);
  music = audio;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = style === "menu" ? 0.42 : 0.48;
  void audio.play().catch(() => {
    // Mobile browsers can require a user gesture before playback.
  });

  return () => {
    if (music === audio) stopMusic();
  };
}
