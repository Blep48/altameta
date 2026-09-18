import type { Opponent } from "../types";
import { createRng } from "./rhythm";

export type Direction = "up" | "down" | "left" | "right";

export interface DirectionArrow {
  index: number;
  direction: Direction;
  spawnMs: number;
}

export const MAX_ARROWS = 250;

export function directionFor(seed: number, index: number): Direction {
  const rng = createRng((seed ^ 0x7f4a7c15) + index * 104729);
  const dirs: Direction[] = ["up", "right", "down", "left"];
  return dirs[Math.floor(rng() * dirs.length)]!;
}

export function spawnIntervalMs(index: number): number {
  return Math.max(310, 900 - Math.floor(index / 6) * 42);
}

export function travelMs(index: number): number {
  return Math.max(1050, 2850 - Math.floor(index / 5) * 105);
}

export function createDirectionChart(seed: number, count = MAX_ARROWS): DirectionArrow[] {
  const arrows: DirectionArrow[] = [];
  let t = 1200;
  for (let i = 0; i < count; i++) {
    arrows.push({ index: i, direction: directionFor(seed, i), spawnMs: t });
    t += spawnIntervalMs(i);
  }
  return arrows;
}

export function simulateDirectionOpponent(seed: number, opponent: Opponent): number {
  const rng = createRng(seed ^ 0x3c6ef372);
  const skill = Math.min(1, Math.max(0, (opponent.rating - 850) / 700));
  for (let i = 0; i < MAX_ARROWS; i++) {
    const pressure = Math.floor(i / 6);
    const missChance = Math.min(0.48, (0.012 + pressure * 0.008) * (1.45 - skill));
    if (rng() < missChance) return i;
  }
  return MAX_ARROWS;
}

export function scoreDirection(playerArrows: number, opponentArrows: number) {
  return { playerArrows, opponentArrows, won: playerArrows > opponentArrows };
}
