import { STARTING_BALANCE } from "./economy";
import type { PlayerProfile } from "./types";

export const RATING_DELTA = 15;
export const STARTING_RATING = 1200;

export const AVATARS = [
  "🦊",
  "🐺",
  "🦈",
  "🐉",
  "🦅",
  "🐍",
  "🦂",
  "🐲",
  "👾",
  "🤖",
  "💀",
  "🔥",
] as const;

export function createDefaultProfile(): PlayerProfile {
  return {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    username: "PLAYER_01",
    avatar: "👾",
    rating: STARTING_RATING,
    coins: STARTING_BALANCE,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    bestReactionMs: null,
  };
}

export function ratingDeltaFor(won: boolean): number {
  return won ? RATING_DELTA : -RATING_DELTA;
}

export function winRate(profile: PlayerProfile): number {
  if (profile.gamesPlayed === 0) return 0;
  return Math.round((profile.wins / profile.gamesPlayed) * 100);
}

export function applyMatchToProfile(
  profile: PlayerProfile,
  args: { won: boolean; ratingDelta: number; settlement: number; bestRoundMs: number | null },
): PlayerProfile {
  const best =
    args.bestRoundMs == null
      ? profile.bestReactionMs
      : profile.bestReactionMs == null
        ? args.bestRoundMs
        : Math.min(profile.bestReactionMs, args.bestRoundMs);

  return {
    ...profile,
    coins: profile.coins + args.settlement,
    rating: Math.max(100, profile.rating + args.ratingDelta),
    gamesPlayed: profile.gamesPlayed + 1,
    wins: profile.wins + (args.won ? 1 : 0),
    losses: profile.losses + (args.won ? 0 : 1),
    bestReactionMs: best,
  };
}
