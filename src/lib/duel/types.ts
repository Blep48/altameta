// Shared domain types for DUEL. UI never defines its own shapes.

export interface PlayerProfile {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  coins: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  bestReactionMs: number | null;
}

export interface Opponent {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  /** Average reaction the bot aims for, in ms. */
  meanReactionMs: number;
  /** Spread around the mean, in ms. */
  varianceMs: number;
}

export interface RoundResult {
  round: number;
  /** Player reaction in ms (penalty value when a false start happened). */
  playerMs: number;
  falseStart: boolean;
  opponentMs: number;
}

export interface RhythmSummary {
  /** Seed that generated this match's music. */
  seed: number;
  playerNotes: number;
  opponentNotes: number;
  avgOffsetMs: number;
}

export interface PrecisionSummary {
  /** Seed that placed this match's targets. */
  seed: number;
  playerPoints: number;
  opponentPoints: number;
  playerStops: number;
  opponentStops: number;
  perfects: number;
}

export interface MatchOutcome {
  id: string;
  gameId: string;
  opponentName: string;
  opponentAvatar: string;
  opponentRating: number;
  playerAvgMs: number;
  opponentAvgMs: number;
  playerBestMs: number;
  falseStarts: number;
  won: boolean;
  coinDelta: number;
  /** Demo wager selected for this match, expressed in euros. */
  wagerEur: number;
  ratingDelta: number;
  playedAt: string;
  rounds: RoundResult[];
  /** Present only for rhythm duels. */
  rhythm?: RhythmSummary;
  /** Present only for precision duels. */
  precision?: PrecisionSummary;
}

export interface ActiveMatch {
  id: string;
  gameId: string;
  opponent: Opponent;
  startedAt: number;
  /** Unique per match; drives the rhythm chart and the precision targets. */
  seed: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  wins: number;
  isPlayer?: boolean;
}

export interface MinigameMeta {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  available: boolean;
}
