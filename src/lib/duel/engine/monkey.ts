import type { Opponent } from "../types";
import { createRng } from "./rhythm";

export interface MonkeyTile {
  number: number;
  x: number;
  y: number;
}

export function createMonkeyBoard(seed: number, level: number): MonkeyTile[] {
  const count = Math.min(14, 4 + level);
  const rng = createRng(seed ^ (level * 0x9e3779b1));
  const tiles: MonkeyTile[] = [];
  for (let n = 1; n <= count; n++) {
    let candidate = { number: n, x: 10 + rng() * 72, y: 8 + rng() * 74 };
    for (let tries = 0; tries < 80; tries++) {
      candidate = { number: n, x: 8 + rng() * 76, y: 7 + rng() * 76 };
      if (tiles.every((t) => Math.hypot(t.x - candidate.x, t.y - candidate.y) > 15)) break;
    }
    tiles.push(candidate);
  }
  return tiles;
}

export function simulateMonkeyOpponent(seed: number, opponent: Opponent): number {
  const rng = createRng(seed ^ 0x243f6a88);
  const skill = Math.min(1, Math.max(0, (opponent.rating - 850) / 700));
  let cleared = 0;
  for (let level = 0; level < 20; level++) {
    const failChance = Math.min(0.62, 0.055 + level * 0.032) * (1.35 - skill * 0.55);
    if (rng() < failChance) break;
    cleared++;
  }
  return cleared;
}

export function scoreMonkey(playerLevels: number, opponentLevels: number) {
  return { playerLevels, opponentLevels, won: playerLevels > opponentLevels };
}
