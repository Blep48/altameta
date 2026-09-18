import type { Opponent } from "../types";

// Pure two-lane rhythm minigame logic — no React, no DOM.
// Every match gets its own seed, so the note chart (and therefore the melody)
// is unique per game but perfectly reproducible for both duellists.

export const LANES = 2;
export const MAX_NOTES = 200;

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RhythmNote {
  index: number;
  lane: number;
  /** When the note must be hit, ms from song start. */
  timeMs: number;
  /** Pitch played when the note lands — this is the generated music. */
  freq: number;
  level: number;
  /** How long the note takes to travel down the lane. */
  approachMs: number;
  /** Timing tolerance, ms either side. */
  windowMs: number;
}

/** Difficulty tier: one every 8 notes, harder forever. */
export function levelForIndex(index: number): number {
  return Math.floor(index / 8);
}

export function approachMsFor(level: number): number {
  return Math.max(520, 1650 - level * 95);
}

export function windowMsFor(level: number): number {
  // Generous timing: if the note overlaps the hit line at all, it counts.
  return Math.max(150, 300 - level * 8);
}

function bpmFor(level: number): number {
  return Math.min(200, 92 + level * 11);
}

// Minor pentatonic, two octaves — always sounds musical whatever the seed rolls.
const SCALE = [
  196.0, 233.08, 261.63, 293.66, 349.23, 392.0, 466.16, 523.25, 587.33, 698.46, 784.0,
];

export function createChart(seed: number, count = MAX_NOTES): RhythmNote[] {
  const rng = createRng(seed);
  const notes: RhythmNote[] = [];
  let time = 0;
  let scaleIndex = Math.floor(rng() * SCALE.length);

  for (let i = 0; i < count; i++) {
    const level = levelForIndex(i);
    const beat = 60000 / bpmFor(level);
    // Higher levels sprinkle in off-beat eighths.
    const eighthChance = Math.min(0.5, level * 0.07);
    const step = rng() < eighthChance ? beat / 2 : beat;
    time += step;

    // Melody walks the scale; the seed decides every step, so each match sings
    // a different tune.
    const move = Math.floor(rng() * 5) - 2;
    scaleIndex = Math.min(SCALE.length - 1, Math.max(0, scaleIndex + move));

    notes.push({
      index: i,
      lane: rng() < 0.5 ? 0 : 1,
      timeMs: Math.round(2000 + time),
      freq: SCALE[scaleIndex]!,
      level,
      approachMs: approachMsFor(level),
      windowMs: windowMsFor(level),
    });
  }

  return notes;
}

/** Bot skill from rating: 0 (shaky) to 1 (machine). */
export function opponentSkill(opponent: Opponent): number {
  return Math.min(1, Math.max(0, (opponent.rating - 850) / 700));
}

/**
 * Index of the first note the bot fluffs. Sudden death: the duel ends for them
 * right there. Miss chance climbs with the difficulty level.
 */
export function simulateOpponentSurvival(
  seed: number,
  opponent: Opponent,
  totalNotes = MAX_NOTES,
): number {
  const rng = createRng(seed ^ 0x9e3779b9);
  const skill = opponentSkill(opponent);
  for (let i = 0; i < totalNotes; i++) {
    const level = levelForIndex(i);
    const miss = Math.min(0.55, (0.006 + level * 0.012) * (1.35 - skill));
    if (rng() < miss) return i;
  }
  return totalNotes;
}

export interface RhythmScore {
  playerNotes: number;
  opponentNotes: number;
  avgOffsetMs: number;
  won: boolean;
}

export function scoreRhythm(args: {
  playerNotes: number;
  opponentNotes: number;
  offsets: number[];
}): RhythmScore {
  const avgOffsetMs = args.offsets.length
    ? Math.round(args.offsets.reduce((a, b) => a + b, 0) / args.offsets.length)
    : 0;
  const won =
    args.playerNotes > args.opponentNotes ||
    (args.playerNotes === args.opponentNotes && avgOffsetMs > 0 && avgOffsetMs < 90);
  return { playerNotes: args.playerNotes, opponentNotes: args.opponentNotes, avgOffsetMs, won };
}
