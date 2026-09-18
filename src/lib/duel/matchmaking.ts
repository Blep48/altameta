import type { ActiveMatch, Opponent } from "./types";

/**
 * Matchmaking service contract. The local implementation fakes an opponent;
 * a networked implementation can replace it without UI changes.
 */
export interface MatchmakingService {
  find(args: { gameId: string; playerRating: number; signal?: AbortSignal }): Promise<ActiveMatch>;
}

const NAMES = [
  "NOVA_STRIKE",
  "kenji.exe",
  "VOLT",
  "ghostpixel",
  "RAZOR_9",
  "milo_sniper",
  "ZEN0",
  "BlueFangs",
  "quickdraw_77",
  "AXIOM",
  "neonwolf",
  "TRIGGER",
  "Sora_TT",
  "PULSEBOY",
  "hexgrid",
];

const AVATARS = ["🦊", "🐺", "🦈", "🐉", "🦅", "🐍", "🦂", "🤖", "💀", "🔥", "👾", "⚡"];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function createBotOpponent(playerRating: number): Opponent {
  const rating = Math.max(
    800,
    Math.round(playerRating + randomBetween(-120, 120)),
  );
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
  find({ gameId, playerRating, signal }) {
    const wait = randomBetween(2000, 4000);
    return new Promise<ActiveMatch>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({
          id: `m_${Date.now().toString(36)}`,
          gameId,
          opponent: createBotOpponent(playerRating),
          startedAt: Date.now(),
          seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
        });
      }, wait);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  },
};
