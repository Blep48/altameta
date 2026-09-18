import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEYS, storage } from "./storage";
import { createDefaultProfile, applyMatchToProfile, ratingDeltaFor } from "./player";
import { DEFAULT_WAGER_EUR, balanceDelta, canAfford, eurosToUnits, settlementAmount } from "./economy";
import { localMatchmaking } from "./matchmaking";
import { scoreRounds } from "./engine/reaction";
import { scoreRhythm } from "./engine/rhythm";
import { scorePrecision, type PrecisionRun } from "./engine/precision";
import { setMuted as setAudioMuted } from "./audio";
import type { ActiveMatch, MatchOutcome, PlayerProfile, RoundResult } from "./types";

interface DuelContextValue {
  ready: boolean;
  profile: PlayerProfile;
  history: MatchOutcome[];
  activeMatch: ActiveMatch | null;
  lastOutcome: MatchOutcome | null;
  muted: boolean;
  toggleMuted: () => void;
  updateProfile: (patch: Partial<Pick<PlayerProfile, "username" | "avatar">>) => void;
  /** Takes the selected demo wager and finds an opponent. */
  findMatch: (gameId: string) => Promise<ActiveMatch>;
  cancelMatch: () => void;
  finishMatch: (rounds: RoundResult[]) => MatchOutcome | null;
  finishRhythmMatch: (args: {
    playerNotes: number;
    opponentNotes: number;
    offsets: number[];
  }) => MatchOutcome | null;
  finishPrecisionMatch: (args: {
    player: PrecisionRun;
    opponent: PrecisionRun;
  }) => MatchOutcome | null;
  resetProgress: () => void;
  wagerEur: number;
  setWagerEur: (value: number) => void;
  canPlay: boolean;
}

const DuelContext = createContext<DuelContextValue | null>(null);

export function DuelProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(() => createDefaultProfile());
  const [history, setHistory] = useState<MatchOutcome[]>([]);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [lastOutcome, setLastOutcome] = useState<MatchOutcome | null>(null);
  const [muted, setMutedState] = useState(false);
  const [wagerEur, setWagerEur] = useState(DEFAULT_WAGER_EUR);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = storage.read<PlayerProfile>(STORAGE_KEYS.profile);
    if (stored) setProfile(stored);
    else storage.write(STORAGE_KEYS.profile, createDefaultProfile());
    setHistory(storage.read<MatchOutcome[]>(STORAGE_KEYS.history) ?? []);
    const m = storage.read<boolean>(STORAGE_KEYS.muted) ?? false;
    setMutedState(m);
    setAudioMuted(m);
    setReady(true);
  }, []);

  const persistProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
    storage.write(STORAGE_KEYS.profile, next);
  }, []);

  const updateProfile: DuelContextValue["updateProfile"] = useCallback(
    (patch) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        storage.write(STORAGE_KEYS.profile, next);
        return next;
      });
    },
    [],
  );

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setAudioMuted(next);
      storage.write(STORAGE_KEYS.muted, next);
      return next;
    });
  }, []);

  const findMatch = useCallback(
    async (gameId: string) => {
      if (!canAfford(profile.coins, wagerEur)) throw new Error("Not enough demo balance");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const withFee = { ...profile, coins: profile.coins - eurosToUnits(wagerEur) };
      persistProfile(withFee);
      const match = await localMatchmaking.find({
        gameId,
        playerRating: profile.rating,
        signal: controller.signal,
      });
      setActiveMatch(match);
      return match;
    },
    [persistProfile, profile, wagerEur],
  );

  const cancelMatch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveMatch((current) => {
      // Refund the entry fee if the match never resolved.
      setProfile((prev) => {
        const refunded = { ...prev, coins: prev.coins + eurosToUnits(wagerEur) };
        storage.write(STORAGE_KEYS.profile, refunded);
        return refunded;
      });
      void current;
      return null;
    });
  }, [wagerEur]);

  const finishMatch = useCallback(
    (rounds: RoundResult[]) => {
      if (!activeMatch) return null;
      const score = scoreRounds(rounds);
      const outcome: MatchOutcome = {
        id: activeMatch.id,
        gameId: activeMatch.gameId,
        opponentName: activeMatch.opponent.username,
        opponentAvatar: activeMatch.opponent.avatar,
        opponentRating: activeMatch.opponent.rating,
        playerAvgMs: score.playerAvgMs,
        opponentAvgMs: score.opponentAvgMs,
        playerBestMs: score.playerBestMs,
        falseStarts: score.falseStarts,
        won: score.won,
        coinDelta: balanceDelta(score.won, wagerEur),
        wagerEur,
        ratingDelta: ratingDeltaFor(score.won),
        playedAt: new Date().toISOString(),
        rounds,
      };

      setProfile((prev) => {
        const next = applyMatchToProfile(prev, {
          won: outcome.won,
          ratingDelta: outcome.ratingDelta,
          settlement: settlementAmount(outcome.won, wagerEur),
          bestRoundMs: score.cleanBestMs,
        });
        storage.write(STORAGE_KEYS.profile, next);
        return next;
      });

      setHistory((prev) => {
        const next = [outcome, ...prev].slice(0, 50);
        storage.write(STORAGE_KEYS.history, next);
        return next;
      });

      setLastOutcome(outcome);
      setActiveMatch(null);
      return outcome;
    },
    [activeMatch, wagerEur],
  );

  const finishRhythmMatch: DuelContextValue["finishRhythmMatch"] = useCallback(
    ({ playerNotes, opponentNotes, offsets }) => {
      if (!activeMatch) return null;
      const score = scoreRhythm({ playerNotes, opponentNotes, offsets });
      const outcome: MatchOutcome = {
        id: activeMatch.id,
        gameId: activeMatch.gameId,
        opponentName: activeMatch.opponent.username,
        opponentAvatar: activeMatch.opponent.avatar,
        opponentRating: activeMatch.opponent.rating,
        playerAvgMs: score.avgOffsetMs,
        opponentAvgMs: 0,
        playerBestMs: score.avgOffsetMs,
        falseStarts: 0,
        won: score.won,
        coinDelta: balanceDelta(score.won, wagerEur),
        wagerEur,
        ratingDelta: ratingDeltaFor(score.won),
        playedAt: new Date().toISOString(),
        rounds: [],
        rhythm: {
          seed: activeMatch.seed,
          playerNotes: score.playerNotes,
          opponentNotes: score.opponentNotes,
          avgOffsetMs: score.avgOffsetMs,
        },
      };

      setProfile((prev) => {
        const next = applyMatchToProfile(prev, {
          won: outcome.won,
          ratingDelta: outcome.ratingDelta,
          settlement: settlementAmount(outcome.won, wagerEur),
          bestRoundMs: null,
        });
        storage.write(STORAGE_KEYS.profile, next);
        return next;
      });

      setHistory((prev) => {
        const next = [outcome, ...prev].slice(0, 50);
        storage.write(STORAGE_KEYS.history, next);
        return next;
      });

      setLastOutcome(outcome);
      setActiveMatch(null);
      return outcome;
    },
    [activeMatch, wagerEur],
  );

  const finishPrecisionMatch: DuelContextValue["finishPrecisionMatch"] = useCallback(
    ({ player, opponent }) => {
      if (!activeMatch) return null;
      const score = scorePrecision({ player, opponent });
      const outcome: MatchOutcome = {
        id: activeMatch.id,
        gameId: activeMatch.gameId,
        opponentName: activeMatch.opponent.username,
        opponentAvatar: activeMatch.opponent.avatar,
        opponentRating: activeMatch.opponent.rating,
        playerAvgMs: score.playerPoints,
        opponentAvgMs: score.opponentPoints,
        playerBestMs: score.playerPoints,
        falseStarts: 0,
        won: score.won,
        coinDelta: balanceDelta(score.won, wagerEur),
        wagerEur,
        ratingDelta: ratingDeltaFor(score.won),
        playedAt: new Date().toISOString(),
        rounds: [],
        precision: {
          seed: activeMatch.seed,
          playerPoints: score.playerPoints,
          opponentPoints: score.opponentPoints,
          playerStops: score.playerStops,
          opponentStops: score.opponentStops,
          perfects: score.perfects,
        },
      };

      setProfile((prev) => {
        const next = applyMatchToProfile(prev, {
          won: outcome.won,
          ratingDelta: outcome.ratingDelta,
          settlement: settlementAmount(outcome.won, wagerEur),
          bestRoundMs: null,
        });
        storage.write(STORAGE_KEYS.profile, next);
        return next;
      });

      setHistory((prev) => {
        const next = [outcome, ...prev].slice(0, 50);
        storage.write(STORAGE_KEYS.history, next);
        return next;
      });

      setLastOutcome(outcome);
      setActiveMatch(null);
      return outcome;
    },
    [activeMatch, wagerEur],
  );

  const resetProgress = useCallback(() => {
    const fresh = createDefaultProfile();
    persistProfile(fresh);
    setHistory([]);
    storage.write(STORAGE_KEYS.history, []);
    setLastOutcome(null);
    setActiveMatch(null);
  }, [persistProfile]);

  const value = useMemo<DuelContextValue>(
    () => ({
      ready,
      profile,
      history,
      activeMatch,
      lastOutcome,
      muted,
      toggleMuted,
      updateProfile,
      findMatch,
      cancelMatch,
      finishMatch,
      finishRhythmMatch,
      finishPrecisionMatch,
      resetProgress,
      wagerEur,
      setWagerEur,
      canPlay: canAfford(profile.coins, wagerEur),
    }),
    [
      ready,
      profile,
      history,
      activeMatch,
      lastOutcome,
      muted,
      toggleMuted,
      updateProfile,
      findMatch,
      cancelMatch,
      finishMatch,
      finishRhythmMatch,
      finishPrecisionMatch,
      resetProgress,
      wagerEur,
    ],
  );

  return <DuelContext.Provider value={value}>{children}</DuelContext.Provider>;
}

export function useDuel() {
  const ctx = useContext(DuelContext);
  if (!ctx) throw new Error("useDuel must be used inside DuelProvider");
  return ctx;
}
