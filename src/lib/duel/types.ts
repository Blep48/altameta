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
  highscores?: Record<string, number>;
  /** Highest league ever reached. It never decreases when rating falls. */
  peakLeagueIndex?: number;
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

export interface DirectionSummary {
  seed: number;
  playerArrows: number;
  opponentArrows: number;
}

export interface MonkeySummary {
  seed: number;
  playerLevels: number;
  opponentLevels: number;
}

export interface SurvivalSummary {
  seed: number;
  playerScore: number;
  opponentScore: number;
}

export type MatchMode = "duel" | "ladder" | "friend";

export interface MatchOutcome {
  id: string;
  gameId: string;
  mode?: MatchMode;
  opponentName: string;
  opponentAvatar: string;
  opponentRating: number;
  playerAvgMs: number;
  opponentAvgMs: number;
  playerBestMs: number;
  falseStarts: number;
  won: boolean;
  tied?: boolean;
  friendChallengeCode?: string;
  /** Present for matches played as part of an Infinite Ladder run. */
  ladderStreak?: number;
  ladderPrizeUnits?: number;
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
  /** Present only for direction duels. */
  direction?: DirectionSummary;
  /** Present only for Monkey Test duels. */
  monkey?: MonkeySummary;
  /** Present for seeded endless survival games. */
  survival?: SurvivalSummary;
}

export interface ActiveMatch {
  id: string;
  gameId: string;
  mode: MatchMode;
  /** Whether this match itself deducted the selected entry stake. */
  entryCharged: boolean;
  wagerEur: number;
  opponent: Opponent;
  startedAt: number;
  /** Unique per match; drives the rhythm chart and the precision targets. */
  seed: number;
  friend?: { code: string; token: string; role: "creator" | "guest" };
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
