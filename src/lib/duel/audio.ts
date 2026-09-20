let muted = false;
let music: HTMLAudioElement | null = null;
let desiredMusic: MusicStyle | null = null;
let selectedGameTrack: string | null = null;

export type MusicStyle =
  | "menu"
  | "matchmaking"
  | "reaction"
  | "rhythm"
  | "direction"
  | "monkey"
  | "precision"
  | "flappy"
  | "dash"
  | "stack"
  | "knife";

const TRACKS = {
  menu: new URL("../../../jade_path_through_the_clouds.mp3", import.meta.url)
    .href,
  secret: new URL("../../../tarantella_d_a_vita.mp3", import.meta.url).href,
  games: [
    new URL("../../../the_frozen_chase.mp3", import.meta.url).href,
    new URL("../../../the_seventh_gate.mp3", import.meta.url).href,
    new URL("../../../tropical_joypad.mp3", import.meta.url).href,
    new URL("../../../salento_chase.mp3", import.meta.url).href,
    new URL("../../../balalaika_boss_battle.mp3", import.meta.url).href,
  ],
} as const;

let unlockBound = false;
let visibilityBound = false;

function bindVisibilityPause() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      music?.pause();
      return;
    }
    if (!muted && desiredMusic && music) {
      void music.play().catch(() => bindAudioUnlock());
    }
  });
  window.addEventListener("pagehide", () => music?.pause());
  window.addEventListener("pageshow", () => {
    if (!document.hidden && !muted && desiredMusic && music) {
      void music.play().catch(() => bindAudioUnlock());
    }
  });
}

function bindAudioUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    unlockBound = false;
    if (!muted && desiredMusic) startMusic(desiredMusic);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  if (value) {
    music?.pause();
  } else if (desiredMusic) {
    startMusic(desiredMusic);
  }
}

export function resetGameTrack() {
  selectedGameTrack = null;
}

function chooseGameTrack() {
  if (Math.floor(Math.random() * 1000) === 0) return TRACKS.secret;
  return TRACKS.games[Math.floor(Math.random() * TRACKS.games.length)]!;
}

export function stopMusic() {
  desiredMusic = null;
  if (!music) return;
  music.pause();
  music.removeAttribute("src");
  music.load();
  music = null;
}

function playTrack(src: string, volume: number) {
  bindVisibilityPause();
  const audio = new Audio(src);
  music = audio;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = volume;
  void audio.play().catch(() => bindAudioUnlock());
  return audio;
}

export function startMusic(style: MusicStyle): () => void {
  desiredMusic = style;
  if (typeof window === "undefined" || muted) return () => {};

  if (music) {
    const sameMenuTrack = style === "menu" && music.src === TRACKS.menu;
    const sameGameTrack =
      style !== "menu" &&
      selectedGameTrack !== null &&
      music.src === selectedGameTrack;
    if (sameMenuTrack || sameGameTrack) {
      const audio = music;
      if (audio.paused && !document.hidden)
        void audio.play().catch(() => bindAudioUnlock());
      return () => {
        if (music === audio) stopMusic();
      };
    }
  }

  stopMusic();
  desiredMusic = style;

  if (style === "menu") {
    selectedGameTrack = null;
    const audio = playTrack(TRACKS.menu, 0.42);
    return () => {
      if (music === audio) stopMusic();
    };
  }

  // Matchmaking is intentionally silent until a game track has been selected.
  // The game route selects one MP3 once, including the 1/1000 secret chance.
  if (style === "matchmaking" && !selectedGameTrack) return () => {};
  selectedGameTrack ??= chooseGameTrack();
  const audio = playTrack(selectedGameTrack, 0.48);
  return () => {
    if (music === audio) stopMusic();
  };
}

// Short feedback only; music remains the existing MP3 soundtrack.
let effectsContext: AudioContext | null = null;
function tone(frequency: number, duration = 0.065, delay = 0) {
  if (muted || typeof window === "undefined" || document.hidden) return;
  try {
    effectsContext ??= new AudioContext();
    const ctx = effectsContext;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain(),
      t = ctx.currentTime + delay;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.075, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.01);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Audio is optional on unsupported browsers. */
  }
}
export const sfx = {
  countdown: () => tone(440),
  go: () => tone(880, 0.12),
  tap: () => tone(660, 0.035),
  falseStart: () => tone(160, 0.15),
  secured: () => {
    tone(660, 0.1);
    tone(990, 0.14, 0.09);
  },
  win: () => {
    tone(523, 0.12);
    tone(659, 0.12, 0.1);
    tone(784, 0.2, 0.2);
  },
  lose: () => tone(196, 0.18),
  search: () => tone(330, 0.025),
  note: (frequency: number) => tone(frequency, 0.09),
  miss: () => tone(140, 0.12),
};
