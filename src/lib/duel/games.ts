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
  { id: "direction", name: "DIRECTION", tagline: "Swipe the falling arrows in order. One mistake and you’re out.", icon: "🧭", available: true },
  { id: "memory", name: "MONKEY TEST", tagline: "Memorize the numbered squares, then tap them in order.", icon: "🐒", available: true },
  { id: "flappy", name: "FLAPPY", tagline: "Tap to fly through a fresh seeded obstacle course.", icon: "🐤", available: true },
  { id: "stack", name: "STACK", tagline: "Drop moving blocks and build the tallest tower.", icon: "🧱", available: true },
  { id: "knife", name: "KNIFE IT", tagline: "Throw knives into the spinning target without hitting another blade.", icon: "🔪", available: true },
  {
    id: "precision",
    name: "PRECISION",
    tagline: "Stop the sweeping marker on target. It only gets faster.",
    icon: "🎯",
    available: true,
  },
];
