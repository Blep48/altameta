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
  for (let level = 0; level < 10; level++) {
    // Humans clearing 4-5 boards are already doing well. Keep bots in that world
    // instead of occasionally producing absurd 12-15 level runs.
    const failChance = Math.min(0.78, 0.16 + level * 0.075) * (1.18 - skill * 0.28);
    if (rng() < failChance) break;
    cleared++;
  }
  return cleared;
}

export function scoreMonkey(playerLevels: number, opponentLevels: number) {
  return { playerLevels, opponentLevels, won: playerLevels > opponentLevels };
}
