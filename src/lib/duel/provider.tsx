import {
  accountStorage,
  accountKeys,
  accountUsername,
  accountScope,
} from "../account/store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEYS, storage } from "./storage";
import {
  createDefaultProfile,
  applyMatchToProfile,
  ratingDeltaFor,
} from "./player";
import {
  DEFAULT_WAGER_EUR,
  balanceDelta,
  canAfford,
  eurosToUnits,
  settlementAmount,
} from "./economy";
import { localMatchmaking } from "./matchmaking";
import { scoreRounds } from "./engine/reaction";
import { scoreRhythm } from "./engine/rhythm";
import { scorePrecision, type PrecisionRun } from "./engine/precision";
import { scoreDirection } from "./engine/direction";
import { scoreMonkey } from "./engine/monkey";
import { setMuted as setAudioMuted } from "./audio";
import type {
  ActiveMatch,
  MatchMode,
  MatchOutcome,
  PlayerProfile,
  RoundResult,
} from "./types";
import { clearFriendSessions, type FriendChallenge } from "./friend-challenges";
import { ladderPrizeUnits, readLadder } from "./ladder";
import {
  chargeEntry,
  newAccount,
  recordOutcome,
  refundEntry,
  releaseFriend,
  reserveFriend,
  validWager,
  type Account,
} from "./ledger";
import { MINIGAMES } from "./games";
import { clearPendingScores } from "./pending-score";

const ACCOUNT_KEY = "account:v1";
type FriendArgs = {
  gameId: string;
  seed: number;
  code: string;
  token: string;
  role: "creator" | "guest";
  opponentName: string;
  opponentAvatar: string;
  wagerEur: number;
};
type ScoreData = Pick<
  MatchOutcome,
  | "playerAvgMs"
  | "opponentAvgMs"
  | "playerBestMs"
  | "falseStarts"
  | "won"
  | "rounds"
> &
  Partial<
    Pick<
      MatchOutcome,
      "rhythm" | "precision" | "direction" | "monkey" | "survival"
    >
  >;

function loadAccount() {
  const saved = storage.read<Account>(ACCOUNT_KEY);
  if (
    saved?.version === 1 &&
    Number.isFinite(saved.profile?.coins) &&
    Array.isArray(saved.history)
  )
    return refundEntry(saved);
  const account = newAccount(
    storage.read<PlayerProfile>(STORAGE_KEYS.profile) ?? createDefaultProfile(),
  );
  account.history = storage.read<MatchOutcome[]>(STORAGE_KEYS.history) ?? [];
  account.ladder = readLadder();
  for (const key of accountKeys()) {
    if (key.startsWith("altameta:friendSettled:"))
      account.settled.push(key.slice("altameta:friendSettled:".length));
    if (key.startsWith("altameta:friendReserved:"))
      account.reserved[key.slice("altameta:friendReserved:".length)] = -1;
  }
  return account;
}

function useDuelState() {
  const [ready, setReady] = useState(false),
    readyRef = useRef(false);
  const [account, setAccount] = useState(() =>
      newAccount(createDefaultProfile()),
    ),
    accountRef = useRef(account);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null),
    activeRef = useRef<ActiveMatch | null>(null);
  const [lastOutcome, setLastOutcome] = useState<MatchOutcome | null>(null);
  const [muted, setMutedState] = useState(false);
  const [wagerEur, setWager] = useState(DEFAULT_WAGER_EUR),
    wagerRef = useRef(wagerEur);
  const abortRef = useRef<AbortController | null>(null);
  const commit = useCallback((next: Account) => {
    const username = accountUsername();
    if (username)
      next = {
        ...next,
        profile: { ...next.profile, username, id: accountScope() },
      };
    accountRef.current = next;
    storage.write(ACCOUNT_KEY, next);
    setAccount(next);
  }, []);
  const setMatch = useCallback((match: ActiveMatch | null) => {
    activeRef.current = match;
    setActiveMatch(match);
  }, []);
  const leaveGame = useCallback(() => {
    const match = activeRef.current;
    if (!match) return;
    const a = accountRef.current;
    commit({
      ...a,
      entry: null,
      ladder:
        match.mode === "ladder" && a.ladder?.active
          ? { ...a.ladder, active: false, lost: true }
          : a.ladder,
    });
    setMatch(null);
  }, [commit, setMatch]);
  useEffect(() => {
    commit(loadAccount());
    const m = storage.read<boolean>(STORAGE_KEYS.muted) ?? false;
    setMutedState(m);
    setAudioMuted(m);
    readyRef.current = true;
    setReady(true);
    return () => {
      abortRef.current?.abort();
    };
  }, [commit]);
  const setWagerEur = useCallback((amount: number) => {
    if (validWager(amount)) {
      wagerRef.current = amount;
      setWager(amount);
    }
  }, []);
  const updateProfile = useCallback(
    (patch: Partial<Pick<PlayerProfile, "username" | "avatar" | "coins">>) => {
      const a = accountRef.current;
      if (
        patch.coins != null &&
        (!Number.isSafeInteger(patch.coins) || patch.coins < 0)
      )
        return;
      commit({ ...a, profile: { ...a.profile, ...patch } });
    },
    [commit],
  );
  const toggleMuted = () => {
    const next = !muted;
    setAudioMuted(next);
    storage.write(STORAGE_KEYS.muted, next);
    setMutedState(next);
  };

  const cancelMatch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    commit(refundEntry(accountRef.current));
    setMatch(null);
  }, [commit, setMatch]);
  const findMatchCore = useCallback(
    async (gameId: string, charge: boolean, mode: MatchMode) => {
      if (!readyRef.current) throw new Error("Profile is loading");
      if (!MINIGAMES.some((g) => g.id === gameId && g.available))
        throw new Error("Unknown game");
      if (abortRef.current || activeRef.current)
        throw new Error("A match is already in progress");
      const a = accountRef.current;
      const amount =
        mode === "ladder" && !charge ? a.ladder!.wagerEur : wagerRef.current;
      const id = crypto.randomUUID();
      let next = charge ? chargeEntry(a, id, amount, mode) : a;
      if (mode === "ladder" && charge) {
        if (a.ladder?.active)
          throw new Error("Cash out or resume your current Ladder first");
        next = {
          ...next,
          ladder: { gameId, wagerEur: amount, streak: 0, active: true },
        };
      }
      commit(next);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const match = await localMatchmaking.find({
          gameId,
          playerRating: next.profile.rating,
          ...(next.profile.peakLeagueIndex != null
            ? { peakLeagueIndex: next.profile.peakLeagueIndex }
            : {}),
          signal: controller.signal,
        });
        if (controller.signal.aborted || abortRef.current !== controller)
          throw new DOMException("aborted", "AbortError");
        const typed = {
          ...match,
          id,
          mode,
          entryCharged: charge,
          wagerEur: amount,
        };
        setMatch(typed);
        return typed;
      } catch (error) {
        commit(refundEntry(accountRef.current, id));
        throw error;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [commit, setMatch],
  );
  const findMatch = useCallback(
    (gameId: string) => findMatchCore(gameId, true, "duel"),
    [findMatchCore],
  );
  const startLadder = useCallback(
    (gameId: string) => findMatchCore(gameId, true, "ladder"),
    [findMatchCore],
  );
  const continueLadder = useCallback(() => {
    const run = accountRef.current.ladder;
    if (!run?.active) return Promise.reject(new Error("No active ladder"));
    return findMatchCore(run.gameId, false, "ladder");
  }, [findMatchCore]);
  const cashOutLadder = useCallback(() => {
    const a = accountRef.current,
      run = a.ladder;
    if (!run?.active || run.streak < 1 || activeRef.current || abortRef.current)
      return;
    commit({
      ...a,
      ladder: null,
      profile: { ...a.profile, coins: a.profile.coins + ladderPrizeUnits(run) },
    });
  }, [commit]);
  const startFriendMatch = useCallback(
    (args: FriendArgs) => {
      if (!readyRef.current) throw new Error("Profile is loading");
      const match: ActiveMatch = {
        id: "friend-" + args.code + "-" + args.role,
        gameId: args.gameId,
        mode: "friend",
        entryCharged: false,
        wagerEur: args.wagerEur,
        seed: args.seed,
        startedAt: Date.now(),
        friend: { code: args.code, token: args.token, role: args.role },
        opponent: {
          id: "friend",
          username: args.opponentName,
          avatar: args.opponentAvatar,
          rating: accountRef.current.profile.rating,
          meanReactionMs: 300,
          varianceMs: 40,
        },
      };
      setMatch(match);
      return match;
    },
    [setMatch],
  );
  const reserveFriendWager = useCallback(
    (code: string, amount: number) => {
      if (!readyRef.current) return false;
      try {
        commit(reserveFriend(accountRef.current, code, amount));
        return true;
      } catch {
        return false;
      }
    },
    [commit],
  );
  const releaseFriendWager = useCallback(
    (code: string) => commit(releaseFriend(accountRef.current, code)),
    [commit],
  );
  const settleFriendChallenge = useCallback(
    (ch: FriendChallenge, role: "creator" | "guest") => {
      if (
        !readyRef.current ||
        ch.creator_score == null ||
        ch.guest_score == null
      )
        return;
      const a = accountRef.current;
      if (a.settled.includes(ch.code)) return;
      if (ch.payment_mode === "demo" && a.reserved[ch.code] == null) return;
      const mine = role === "creator" ? ch.creator_score : ch.guest_score,
        theirs = role === "creator" ? ch.guest_score : ch.creator_score;
      const tied = mine === theirs,
        won =
          !tied && (ch.score_mode === "low" ? mine < theirs : mine > theirs);
      const payout =
        ch.payment_mode === "in_person"
          ? 0
          : tied
            ? eurosToUnits(ch.wager_eur)
            : settlementAmount(won, ch.wager_eur);
      const delta =
        ch.payment_mode === "in_person" || tied
          ? 0
          : balanceDelta(won, ch.wager_eur);
      const outcome: MatchOutcome = {
        id: "friend-" + ch.code + "-" + role,
        gameId: ch.game_id,
        mode: "friend",
        opponentName:
          role === "creator" ? ch.guest_name || "FRIEND" : ch.creator_name,
        opponentAvatar:
          role === "creator" ? ch.guest_avatar || "🎮" : ch.creator_avatar,
        opponentRating: a.profile.rating,
        playerAvgMs: mine,
        opponentAvgMs: theirs,
        playerBestMs: mine,
        falseStarts: 0,
        won,
        tied,
        friendChallengeCode: ch.code,
        coinDelta: delta,
        wagerEur: ch.wager_eur,
        ratingDelta: 0,
        playedAt: new Date().toISOString(),
        rounds: [],
      };
      const reserved = { ...a.reserved };
      delete reserved[ch.code];
      const profile = {
        ...a.profile,
        coins: a.profile.coins + payout,
        gamesPlayed: a.profile.gamesPlayed + 1,
        wins: a.profile.wins + (won ? 1 : 0),
        losses: a.profile.losses + (!won && !tied ? 1 : 0),
      };
      commit({
        ...recordOutcome(a, outcome, profile),
        entry: a.entry,
        reserved,
        settled: [...a.settled, ch.code],
      });
      setLastOutcome(outcome);
      if (activeRef.current?.friend?.code === ch.code) setMatch(null);
    },
    [commit, setMatch],
  );

  const finish = useCallback(
    (data: ScoreData, highscore: number, bestRoundMs: number | null = null) => {
      const match = activeRef.current;
      if (!match || match.mode === "friend") return null;
      activeRef.current = null;
      const a = accountRef.current,
        amount = match.wagerEur;
      let outcome: MatchOutcome = {
        ...data,
        id: match.id,
        gameId: match.gameId,
        mode: match.mode,
        opponentName: match.opponent.username,
        opponentAvatar: match.opponent.avatar,
        opponentRating: match.opponent.rating,
        wagerEur: amount,
        coinDelta: balanceDelta(data.won, amount),
        ratingDelta: ratingDeltaFor(data.won),
        playedAt: new Date().toISOString(),
      };
      let ladder = a.ladder;
      if (
        match.mode === "ladder" &&
        ladder?.active &&
        ladder.gameId === match.gameId
      ) {
        ladder = data.won
          ? { ...ladder, streak: ladder.streak + 1 }
          : { ...ladder, active: false, lost: true };
        outcome = {
          ...outcome,
          coinDelta: data.won ? 0 : -eurosToUnits(amount),
          ladderStreak: ladder.streak,
          ladderPrizeUnits: data.won ? ladderPrizeUnits(ladder) : 0,
        };
      }
      const profile = applyMatchToProfile(a.profile, {
        won: data.won,
        ratingDelta: outcome.ratingDelta,
        settlement:
          match.mode === "ladder" ? 0 : settlementAmount(data.won, amount),
        bestRoundMs,
      });
      const old = profile.highscores?.[match.gameId];
      if (
        old == null ||
        (match.gameId === "reaction" ? highscore < old : highscore > old)
      )
        profile.highscores = {
          ...profile.highscores,
          [match.gameId]: highscore,
        };
      commit({ ...recordOutcome(a, outcome, profile), ladder });
      setLastOutcome(outcome);
      setMatch(null);
      return outcome;
    },
    [commit, setMatch],
  );
  const finishMatch = useCallback(
    (rounds: RoundResult[]) => {
      const s = scoreRounds(rounds);
      return finish({ ...s, rounds }, s.playerAvgMs, s.cleanBestMs);
    },
    [finish],
  );
  const finishRhythmMatch = useCallback(
    (args: {
      playerNotes: number;
      opponentNotes: number;
      offsets: number[];
    }) => {
      const s = scoreRhythm(args);
      return finish(
        {
          playerAvgMs: s.playerNotes,
          opponentAvgMs: s.opponentNotes,
          playerBestMs: s.avgOffsetMs,
          falseStarts: 0,
          won: s.won,
          rounds: [],
          rhythm: { seed: activeRef.current?.seed ?? 0, ...s },
        },
        s.playerNotes,
      );
    },
    [finish],
  );
  const finishPrecisionMatch = useCallback(
    (args: { player: PrecisionRun; opponent: PrecisionRun }) => {
      const s = scorePrecision(args);
      return finish(
        {
          playerAvgMs: s.playerPoints,
          opponentAvgMs: s.opponentPoints,
          playerBestMs: s.playerPoints,
          falseStarts: 0,
          won: s.won,
          rounds: [],
          precision: { seed: activeRef.current?.seed ?? 0, ...s },
        },
        s.playerPoints,
      );
    },
    [finish],
  );
  const finishDirectionMatch = useCallback(
    (args: { playerArrows: number; opponentArrows: number }) => {
      const s = scoreDirection(args.playerArrows, args.opponentArrows);
      return finish(
        {
          playerAvgMs: s.playerArrows,
          opponentAvgMs: s.opponentArrows,
          playerBestMs: s.playerArrows,
          falseStarts: 0,
          won: s.won,
          rounds: [],
          direction: { seed: activeRef.current?.seed ?? 0, ...s },
        },
        s.playerArrows,
      );
    },
    [finish],
  );
  const finishMonkeyMatch = useCallback(
    (args: { playerLevels: number; opponentLevels: number }) => {
      const s = scoreMonkey(args.playerLevels, args.opponentLevels);
      return finish(
        {
          playerAvgMs: s.playerLevels,
          opponentAvgMs: s.opponentLevels,
          playerBestMs: s.playerLevels,
          falseStarts: 0,
          won: s.won,
          rounds: [],
          monkey: { seed: activeRef.current?.seed ?? 0, ...s },
        },
        s.playerLevels,
      );
    },
    [finish],
  );
  const finishSurvivalMatch = useCallback(
    (args: { playerScore: number; opponentScore: number }) =>
      finish(
        {
          playerAvgMs: args.playerScore,
          opponentAvgMs: args.opponentScore,
          playerBestMs: args.playerScore,
          falseStarts: 0,
          won: args.playerScore > args.opponentScore,
          rounds: [],
          survival: { seed: activeRef.current?.seed ?? 0, ...args },
        },
        args.playerScore,
      ),
    [finish],
  );
  const resetProgress = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMatch(null);
    setLastOutcome(null);
    clearFriendSessions();
    clearPendingScores();
    accountStorage.removeItem("altameta:ladder");
    for (const key of accountKeys())
      if (
        key.startsWith("altameta:friendReserved:") ||
        key.startsWith("altameta:friendSettled:")
      )
        accountStorage.removeItem(key);
    commit(newAccount(createDefaultProfile()));
    setWagerEur(DEFAULT_WAGER_EUR);
  }, [commit, setMatch, setWagerEur]);
  return {
    ready,
    profile: account.profile,
    history: account.history,
    ladder: account.ladder,
    activeMatch,
    lastOutcome,
    muted,
    toggleMuted,
    updateProfile,
    findMatch,
    startFriendMatch,
    reserveFriendWager,
    releaseFriendWager,
    settleFriendChallenge,
    cancelMatch,
    leaveGame,
    finishMatch,
    finishRhythmMatch,
    finishPrecisionMatch,
    finishDirectionMatch,
    finishMonkeyMatch,
    finishSurvivalMatch,
    resetProgress,
    wagerEur: activeMatch?.wagerEur ?? wagerEur,
    setWagerEur,
    canPlay: ready && canAfford(account.profile.coins, wagerEur),
    startLadder,
    continueLadder,
    cashOutLadder,
  };
}
const DuelContext = createContext<ReturnType<typeof useDuelState> | null>(null);
export function DuelProvider({ children }: { children: ReactNode }) {
  const value = useDuelState();
  return <DuelContext.Provider value={value}>{children}</DuelContext.Provider>;
}
export function useDuel() {
  const ctx = useContext(DuelContext);
  if (!ctx) throw new Error("useDuel must be used inside DuelProvider");
  return ctx;
}
