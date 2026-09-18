import type { MinigameMeta } from "./types";

export const MINIGAMES: MinigameMeta[] = [
  {
    id: "reaction",
    name: "REACTION",
    tagline: "Tap the instant the target goes green. 5 rounds.",
    icon: "⚡",
    available: true,
  },
  {
    id: "rhythm",
    name: "RHYTHM",
    tagline: "Two lanes, one life. Miss a note and it's over.",
    icon: "🎵",
    available: true,
  },
  { id: "direction", name: "DIRECTION", tagline: "Swipe the arrow before it flips.", icon: "🧭", available: false },
  { id: "memory", name: "MEMORY", tagline: "Repeat the sequence, faster each time.", icon: "🧠", available: false },
  {
    id: "precision",
    name: "PRECISION",
    tagline: "Stop the sweeping marker on target. It only gets faster.",
    icon: "🎯",
    available: true,
  },
];
