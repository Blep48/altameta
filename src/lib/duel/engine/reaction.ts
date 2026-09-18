import type { Opponent, RoundResult } from "../types";

// Pure minigame logic — no React, no DOM.

export const TOTAL_ROUNDS = 5;
export const MIN_DELAY_MS = 1500;
export const MAX_DELAY_MS = 4500;
/** Score recorded for a round lost to a false start. */
export const FALSE_START_PENALTY_MS = 600;

export function randomDelayMs(): number {
  return Math.round(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function opponentReactionMs(opponent: Opponent): number {
  const raw = opponent.meanReactionMs + gaussian() * opponent.varianceMs;
  // Rare bot slip-up keeps matches believable.
  const slip = Math.random() < 0.08 ? 120 : 0;
  return Math.round(Math.min(650, Math.max(130, raw + slip)));
}

export function buildRound(
  round: number,
  playerMs: number,
  falseStart: boolean,
  opponent: Opponent,
): RoundResult {
  return {
    round,
    playerMs: falseStart ? FALSE_START_PENALTY_MS : playerMs,
    falseStart,
    opponentMs: opponentReactionMs(opponent),
  };
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export interface ReactionScore {
  playerAvgMs: number;
  opponentAvgMs: number;
  playerBestMs: number;
  cleanBestMs: number | null;
  falseStarts: number;
  won: boolean;
}

export function scoreRounds(rounds: RoundResult[]): ReactionScore {
  const playerTimes = rounds.map((r) => r.playerMs);
  const clean = rounds.filter((r) => !r.falseStart).map((r) => r.playerMs);
  const playerAvgMs = average(playerTimes);
  const opponentAvgMs = average(rounds.map((r) => r.opponentMs));
  return {
    playerAvgMs,
    opponentAvgMs,
    playerBestMs: playerTimes.length ? Math.min(...playerTimes) : 0,
    cleanBestMs: clean.length ? Math.min(...clean) : null,
    falseStarts: rounds.filter((r) => r.falseStart).length,
    won: playerAvgMs < opponentAvgMs,
  };
}
