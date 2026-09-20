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
  // Shuffle fixed cells, not arbitrary points: tile rectangles cannot overlap.
  const cells = Array.from({ length: 16 }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const tiles: MonkeyTile[] = cells.slice(0, count).map((cell, i) => ({
    number: i + 1,
    x: 12.5 + (cell % 4) * 25,
    y: 13 + Math.floor(cell / 4) * 22,
  }));
  return tiles;
}

export function simulateMonkeyOpponent(
  seed: number,
  opponent: Opponent,
): number {
  const rng = createRng(seed ^ 0x243f6a88);
  const skill = Math.min(1, Math.max(0, (opponent.rating - 850) / 700));
  let cleared = 0;
  for (let level = 0; level < 10; level++) {
    // Humans clearing 4-5 boards are already doing well. Keep bots in that world
    // instead of occasionally producing absurd 12-15 level runs.
    const failChance =
      Math.min(0.78, 0.16 + level * 0.075) * (1.18 - skill * 0.28);
    if (rng() < failChance) break;
    cleared++;
  }
  return cleared;
}

export function scoreMonkey(playerLevels: number, opponentLevels: number) {
  return { playerLevels, opponentLevels, won: playerLevels > opponentLevels };
}
