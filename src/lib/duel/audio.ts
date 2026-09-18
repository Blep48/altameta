let muted = false;
let music: HTMLAudioElement | null = null;
let desiredMusic: MusicStyle | null = null;
let selectedGameTrack: string | null = null;

export type MusicStyle = "menu" | "matchmaking" | "reaction" | "rhythm" | "direction" | "monkey" | "precision" | "flappy" | "dash" | "stack" | "knife";

const TRACKS = {
  menu: new URL("../../../jade_path_through_the_clouds.mp3", import.meta.url).href,
  secret: new URL("../../../tarantella_d_a_vita.mp3", import.meta.url).href,
  games: [
    new URL("../../../the_frozen_chase.mp3", import.meta.url).href,
    new URL("../../../the_seventh_gate.mp3", import.meta.url).href,
    new URL("../../../tropical_joypad.mp3", import.meta.url).href,
    new URL("../../../salento_chase.mp3", import.meta.url).href,
    new URL("../../../balalaika_boss_battle.mp3", import.meta.url).href,
  ],
} as const;

let unlockBound = false;\nlet visibilityBound = false;\n\nfunction bindVisibilityPause() {\n  if (visibilityBound || typeof document === "undefined") return;\n  visibilityBound = true;\n  document.addEventListener("visibilitychange", () => {\n    if (document.hidden) {\n      music?.pause();\n      return;\n    }\n    if (!muted && desiredMusic && music) {\n      void music.play().catch(() => bindAudioUnlock());\n    }\n  });\n  window.addEventListener("pagehide", () => music?.pause());\n  window.addEventListener("pageshow", () => {\n    if (!document.hidden && !muted && desiredMusic && music) {\n      void music.play().catch(() => bindAudioUnlock());\n    }\n  });\n}

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

export function isMuted() { return muted; }

export function setMuted(value: boolean) {
  muted = value;
  if (value) {
    stopMusic();
  } else if (desiredMusic) {
    startMusic(desiredMusic);
  }
}

function chooseGameTrack() {
  if (Math.floor(Math.random() * 1000) === 0) return TRACKS.secret;
  return TRACKS.games[Math.floor(Math.random() * TRACKS.games.length)]!;
}

export function stopMusic() {
  if (!music) return;
  music.pause();
  music.removeAttribute("src");
  music.load();
  music = null;
}

function playTrack(src: string, volume: number) {
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
  stopMusic();
  if (typeof window === "undefined" || muted) return () => {};
  bindAudioUnlock();

  if (style === "menu") {
    selectedGameTrack = null;
    const audio = playTrack(TRACKS.menu, 0.42);
    return () => { if (music === audio) stopMusic(); };
  }

  // Matchmaking is intentionally silent until a game track has been selected.
  // The game route selects one MP3 once, including the 1/1000 secret chance.
  if (style === "matchmaking" && !selectedGameTrack) return () => {};
  selectedGameTrack ??= chooseGameTrack();
  const audio = playTrack(selectedGameTrack, 0.48);
  return () => { if (music === audio) stopMusic(); };
}

// Keep the existing game calls intact, but remove every synthesized tone.
// Sound effects can be replaced with recorded assets later without bringing
// the old procedural music back.
export const sfx = {
  countdown: () => {},
  go: () => {},
  tap: () => {},
  falseStart: () => {},
  secured: () => {},
  win: () => {},
  lose: () => {},
  search: () => {},
  note: (_freq: number) => {},
  miss: () => {},
};
