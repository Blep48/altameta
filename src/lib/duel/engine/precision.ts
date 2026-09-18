import type { Opponent } from "../types";
import { createRng } from "./rhythm";

// Pure logic for the PRECISION minigame — no React, no DOM.
// A marker sweeps left/right across a bar; the player must stop it inside a
// randomly placed target. The target has a small PERFECT core (2 points) inside
// a more forgiving GOOD ring (1 point). Every successful stop speeds the marker
// up and shrinks the target. One miss ends the run.

export const PERFECT_POINTS = 2;
export const GOOD_POINTS = 1;
export const MAX_STOPS = 40;

export interface PrecisionTarget {
  /** Centre of the target, 0..1 across the bar. */
  center: number;
  /** Half-width of the forgiving GOOD zone, in bar fractions. */
  goodHalf: number;
  /** Half-width of the inner PERFECT zone, in bar fractions. */
  perfectHalf: number;
}

/** Bar fractions per second. Faster after every successful stop. */
export function speedFor(stops: number): number {
  return Math.min(3.4, 0.6 + stops * 0.11);
}

export function goodHalfFor(stops: number): number {
  return Math.max(0.035, 0.1 - stops * 0.0045);
}

export function createTarget(seed: number, stops: number): PrecisionTarget {
  const rng = createRng((seed ^ 0x51ed270b) + stops * 7919);
  const goodHalf = goodHalfFor(stops);
  const margin = goodHalf + 0.04;
  const center = margin + rng() * (1 - margin * 2);
  return { center, goodHalf, perfectHalf: goodHalf * 0.34 };
}

export type StopVerdict = "perfect" | "good" | "miss";

export function judge(position: number, target: PrecisionTarget): StopVerdict {
  const d = Math.abs(position - target.center);
  if (d <= target.perfectHalf) return "perfect";
  if (d <= target.goodHalf) return "good";
  return "miss";
}

export function pointsFor(verdict: StopVerdict): number {
  if (verdict === "perfect") return PERFECT_POINTS;
  if (verdict === "good") return GOOD_POINTS;
  return 0;
}

/** Bot skill from rating: 0 (shaky) to 1 (machine). */
export function opponentSkill(opponent: Opponent): number {
  return Math.min(1, Math.max(0, (opponent.rating - 850) / 700));
}

export interface PrecisionRun {
  stops: number;
  perfects: number;
  points: number;
}

/** Simulates the opponent's whole run: stops until they miss. */
export function simulateOpponentRun(seed: number, opponent: Opponent): PrecisionRun {
  const rng = createRng(seed ^ 0x2545f491);
  const skill = opponentSkill(opponent);
  let stops = 0;
  let perfects = 0;
  let points = 0;

  for (let i = 0; i < MAX_STOPS; i++) {
    const missChance = Math.min(0.6, (0.05 + i * 0.035) * (1.35 - skill));
    if (rng() < missChance) break;
    stops += 1;
    const perfectChance = 0.18 + skill * 0.42 - i * 0.012;
    if (rng() < perfectChance) {
      perfects += 1;
      points += PERFECT_POINTS;
    } else {
      points += GOOD_POINTS;
    }
  }

  return { stops, perfects, points };
}

export interface PrecisionScore {
  playerPoints: number;
  opponentPoints: number;
  playerStops: number;
  opponentStops: number;
  perfects: number;
  won: boolean;
}

export function scorePrecision(args: {
  player: PrecisionRun;
  opponent: PrecisionRun;
}): PrecisionScore {
  const won =
    args.player.points > args.opponent.points ||
    (args.player.points === args.opponent.points &&
      args.player.perfects > args.opponent.perfects);
  return {
    playerPoints: args.player.points,
    opponentPoints: args.opponent.points,
    playerStops: args.player.stops,
    opponentStops: args.opponent.stops,
    perfects: args.player.perfects,
    won,
  };
}
