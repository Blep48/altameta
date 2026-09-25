import type { ActiveMatch, Opponent } from "./types";
import { botRatingWindow, peakLeagueIndex } from "./leagues";

/**
 * Matchmaking service contract. The local implementation fakes an opponent;
 * a networked implementation can replace it without UI changes.
 */
export interface MatchmakingService {
  find(args: {
    gameId: string;
    playerRating: number;
    peakLeagueIndex?: number;
    signal?: AbortSignal;
  }): Promise<ActiveMatch>;
}

const NAMES = [
  "Aci Tom",
  "Ottone Erminio",
  "Kakato Miso",
  "Ranza Mino",
  "Cidio Gino",
  "Là Aldo",
  "Rato Timo",
  "Renne Mino",
  "Rato Mino",
  "Rdato Rita",
  "Cente Lino",
  "Ricamente Teo",
  "Lione Checco",
  "Pocchia Checca",
  "Ucarlo Devis",
  "Tali Geni",
  "Rea Nadia",
];

const AVATARS = [
  "🦊",
  "🐺",
  "🦈",
  "🐉",
  "🦅",
  "🐍",
  "🦂",
  "🤖",
  "💀",
  "🔥",
  "👾",
  "⚡",
];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function createBotOpponent(
  playerRating: number,
  storedPeakLeague?: number,
): Opponent {
  const peak = peakLeagueIndex(playerRating, storedPeakLeague);
  const [minRating, maxRating] = botRatingWindow(playerRating, peak);
  const rating = Math.round(randomBetween(minRating, maxRating));
  // Stronger opponents react faster.
  const skill = Math.min(1, Math.max(0, (rating - 900) / 700));
  const meanReactionMs = Math.round(320 - skill * 110 + randomBetween(-15, 15));
  return {
    id: `bot_${Math.random().toString(36).slice(2, 9)}`,
    username: pick(NAMES),
    avatar: pick(AVATARS),
    rating,
    meanReactionMs,
    varianceMs: Math.round(randomBetween(25, 55)),
  };
}

export const localMatchmaking: MatchmakingService = {
  find({ gameId, playerRating, peakLeagueIndex: peak, signal }) {
    const wait = randomBetween(2000, 4000);
    return new Promise<ActiveMatch>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve({
          id: `m_${Date.now().toString(36)}`,
          gameId,
          mode: "duel",
          entryCharged: false,
          wagerEur: 0,
          opponent: createBotOpponent(playerRating, peak),
          startedAt: Date.now(),
          seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
        });
      }, wait);
      signal?.addEventListener("abort", abort, { once: true });
    });
  },
};
