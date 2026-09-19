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
import { scoreDirection } from "./engine/direction";
import { scoreMonkey } from "./engine/monkey";
import { setMuted as setAudioMuted } from "./audio";
import type { ActiveMatch, MatchOutcome, PlayerProfile, RoundResult } from "./types";
import type { FriendChallenge } from "./friend-challenges";
import { ladderPrizeUnits, readLadder, writeLadder, type LadderRun } from "./ladder";

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
  startFriendMatch: (args:{gameId:string;seed:number;code:string;token:string;role:"creator"|"guest";opponentName:string;opponentAvatar:string}) => ActiveMatch;
  reserveFriendWager: (code:string,wagerEur:number) => boolean;
  settleFriendChallenge: (challenge:FriendChallenge,role:"creator"|"guest") => void;
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
  finishDirectionMatch: (args: { playerArrows: number; opponentArrows: number }) => MatchOutcome | null;
  finishMonkeyMatch: (args: { playerLevels: number; opponentLevels: number }) => MatchOutcome | null;
  finishSurvivalMatch: (args: { playerScore: number; opponentScore: number }) => MatchOutcome | null;
  resetProgress: () => void;
  wagerEur: number;
  setWagerEur: (value: number) => void;
  canPlay: boolean;
  ladder: LadderRun | null;
  startLadder: (gameId:string) => Promise<ActiveMatch>;
  continueLadder: () => Promise<ActiveMatch>;
  cashOutLadder: () => void;
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
  const [ladder,setLadder] = useState<LadderRun|null>(null);

  useEffect(() => {
    const stored = storage.read<PlayerProfile>(STORAGE_KEYS.profile);
    if (stored) setProfile(stored);
    else storage.write(STORAGE_KEYS.profile, createDefaultProfile());
    setHistory(storage.read<MatchOutcome[]>(STORAGE_KEYS.history) ?? []);
    const m = storage.read<boolean>(STORAGE_KEYS.muted) ?? false;
    setMutedState(m);
    setAudioMuted(m);
    const savedLadder = readLadder();
    setLadder(savedLadder);
    ladderRef.current = savedLadder;
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

  const saveHighscore = useCallback((gameId: string, score: number, lowerIsBetter = false) => {
    setProfile(prev => {
      const highscores = { ...(prev.highscores ?? {}) };
      const old = highscores[gameId];
      if (old == null || (lowerIsBetter ? score < old : score > old)) highscores[gameId] = score;
      const next = { ...prev, highscores }; storage.write(STORAGE_KEYS.profile, next); return next;
    });
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setAudioMuted(next);
      storage.write(STORAGE_KEYS.muted, next);
      return next;
    });
  }, []);

  const ladderRef=useRef<LadderRun|null>(null);
  useEffect(()=>{ladderRef.current=ladder},[ladder]);
  const settlementForMode=useCallback((won:boolean,amount:number)=>ladderRef.current?.active?0:settlementAmount(won,amount),[]);
  const tagLadderOutcome=useCallback((outcome:MatchOutcome)=>{const run=ladderRef.current;if(!run?.active||run.gameId!==outcome.gameId)return outcome;const streak=run.streak+(outcome.won?1:0);const next:LadderRun=outcome.won?{...run,streak}:{...run,active:false,lost:true};writeLadder(next);setLadder(next);ladderRef.current=next;return {...outcome,ladderStreak:streak,ladderPrizeUnits:outcome.won?ladderPrizeUnits(next):0}},[]);

  const findMatchCore = useCallback(
    async (gameId: string, chargeEntry: boolean) => {
      if (chargeEntry && !canAfford(profile.coins, wagerEur)) throw new Error("Not enough demo balance");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (chargeEntry) {
        const withFee = { ...profile, coins: profile.coins - eurosToUnits(wagerEur) };
        persistProfile(withFee);
      }
      const match = await localMatchmaking.find({
        gameId,
        playerRating: profile.rating,
        peakLeagueIndex: profile.peakLeagueIndex,
        signal: controller.signal,
      });
      setActiveMatch(match);
      return match;
    },
    [persistProfile, profile, wagerEur],
  );

  const findMatch = useCallback((gameId: string) => findMatchCore(gameId, true), [findMatchCore]);

  const startFriendMatch: DuelContextValue["startFriendMatch"] = useCallback((args) => {
    const match: ActiveMatch = { id: `friend-${args.code}`, gameId: args.gameId, seed: args.seed, startedAt: Date.now(), friend:{code:args.code,token:args.token,role:args.role}, opponent:{id:"friend",username:args.opponentName,avatar:args.opponentAvatar,rating:profile.rating,meanReactionMs:300,varianceMs:40} };
    setActiveMatch(match); return match;
  }, [profile.rating]);

  const reserveFriendWager = useCallback((code:string, amount:number) => {
    const key=`altameta:friendReserved:${code}`;
    if(typeof window==="undefined") return false;
    if(localStorage.getItem(key)) return true;
    const stake=eurosToUnits(amount);
    if(profile.coins<stake) return false;
    setProfile(prev=>{const next={...prev,coins:prev.coins-stake};storage.write(STORAGE_KEYS.profile,next);return next;});
    localStorage.setItem(key,"1");
    return true;
  },[profile.coins]);

  const settleFriendChallenge = useCallback((ch:FriendChallenge,role:"creator"|"guest") => {
    if(ch.creator_score==null||ch.guest_score==null||typeof window==="undefined") return;
    const settledKey=`altameta:friendSettled:${ch.code}`;
    if(localStorage.getItem(settledKey)) return;
    const mine=role==="creator"?ch.creator_score:ch.guest_score;
    const theirs=role==="creator"?ch.guest_score:ch.creator_score;
    const tie=mine===theirs;
    const won=!tie&&(ch.score_mode==="low"?mine<theirs:mine>theirs);
    const stake=eurosToUnits(ch.wager_eur);
    const payout=tie?stake:(won?settlementAmount(true,ch.wager_eur):0);
    const delta=tie?0:balanceDelta(won,ch.wager_eur);
    const opponentName=role==="creator"?(ch.guest_name||"FRIEND"):ch.creator_name;
    const opponentAvatar=role==="creator"?(ch.guest_avatar||"🎮"):ch.creator_avatar;
    const outcome:MatchOutcome={id:`friend-${ch.code}-${role}`,gameId:ch.game_id,opponentName,opponentAvatar,opponentRating:profile.rating,playerAvgMs:mine,opponentAvgMs:theirs,playerBestMs:mine,falseStarts:0,won,tied:tie,friendChallengeCode:ch.code,coinDelta:delta,wagerEur:ch.wager_eur,ratingDelta:0,playedAt:new Date().toISOString(),rounds:[]};
    setProfile(prev=>{const next={...prev,coins:prev.coins+payout,gamesPlayed:prev.gamesPlayed+1,wins:prev.wins+(won?1:0),losses:prev.losses+(!won&&!tie?1:0)};storage.write(STORAGE_KEYS.profile,next);return next;});
    setHistory(prev=>{const next=[outcome,...prev.filter(x=>x.id!==outcome.id)].slice(0,50);storage.write(STORAGE_KEYS.history,next);return next;});
    setLastOutcome(outcome);
    localStorage.setItem(settledKey,"1");
  },[profile.rating]);

  const startLadder=useCallback(async(gameId:string)=>{const run:LadderRun={gameId,wagerEur,streak:0,active:true};writeLadder(run);setLadder(run);ladderRef.current=run;return findMatchCore(gameId,true)},[wagerEur,findMatchCore]);
  const continueLadder=useCallback(async()=>{const run=ladderRef.current;if(!run?.active)throw new Error("No active ladder");return findMatchCore(run.gameId,false)},[findMatchCore]);
  const cashOutLadder=useCallback(()=>{const run=ladderRef.current;if(!run?.active||run.streak<1)return;const prize=ladderPrizeUnits(run);setProfile(prev=>{const next={...prev,coins:prev.coins+prize};storage.write(STORAGE_KEYS.profile,next);return next});writeLadder(null);setLadder(null);ladderRef.current=null},[]);


  const cancelMatch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveMatch((current) => {
      // Refund only when an entry was actually charged. Ladder continuation rounds do not charge here.
      const run = ladderRef.current;
      const shouldRefund = !run?.active || run.streak === 0;
      if (shouldRefund) setProfile((prev) => {
        const refunded = { ...prev, coins: prev.coins + eurosToUnits(wagerEur) };
        storage.write(STORAGE_KEYS.profile, refunded);
        return refunded;
      });
      if (run?.active && run.streak === 0) { writeLadder(null); setLadder(null); ladderRef.current=null; }
      void current;
      return null;
    });
  }, [wagerEur]);

  const finishMatch = useCallback(
    (rounds: RoundResult[]) => {
      if (!activeMatch) return null;
      const score = scoreRounds(rounds);
      saveHighscore("reaction", score.playerAvgMs, true);
      let outcome: MatchOutcome = {
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

      outcome=tagLadderOutcome(outcome);
      setProfile((prev) => {
        const next = applyMatchToProfile(prev, {
          won: outcome.won,
          ratingDelta: outcome.ratingDelta,
          settlement: settlementForMode(outcome.won, wagerEur),
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
    [activeMatch, wagerEur, saveHighscore],
  );

  const finishRhythmMatch: DuelContextValue["finishRhythmMatch"] = useCallback(
    ({ playerNotes, opponentNotes, offsets }) => {
      if (!activeMatch) return null;
      const score = scoreRhythm({ playerNotes, opponentNotes, offsets });
      saveHighscore("rhythm", score.playerNotes);
      let outcome: MatchOutcome = {
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

      outcome=tagLadderOutcome(outcome);
      setProfile((prev) => {
        const next = applyMatchToProfile(prev, {
          won: outcome.won,
          ratingDelta: outcome.ratingDelta,
          settlement: settlementForMode(outcome.won, wagerEur),
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
      saveHighscore("precision", score.playerPoints);
      let outcome: MatchOutcome = {
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

      outcome=tagLadderOutcome(outcome);
      setProfile((prev) => {
        const next = applyMatchToProfile(prev, {
          won: outcome.won,
          ratingDelta: outcome.ratingDelta,
          settlement: settlementForMode(outcome.won, wagerEur),
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

  const finishDirectionMatch: DuelContextValue["finishDirectionMatch"] = useCallback(
    ({ playerArrows, opponentArrows }) => {
      if (!activeMatch) return null;
      const score = scoreDirection(playerArrows, opponentArrows);
      saveHighscore("direction", score.playerArrows);
      let outcome: MatchOutcome = {
        id: activeMatch.id,
        gameId: activeMatch.gameId,
        opponentName: activeMatch.opponent.username,
        opponentAvatar: activeMatch.opponent.avatar,
        opponentRating: activeMatch.opponent.rating,
        playerAvgMs: score.playerArrows,
        opponentAvgMs: score.opponentArrows,
        playerBestMs: score.playerArrows,
        falseStarts: 0,
        won: score.won,
        coinDelta: balanceDelta(score.won, wagerEur),
        wagerEur,
        ratingDelta: ratingDeltaFor(score.won),
        playedAt: new Date().toISOString(),
        rounds: [],
        direction: { seed: activeMatch.seed, playerArrows: score.playerArrows, opponentArrows: score.opponentArrows },
      };
      outcome=tagLadderOutcome(outcome);
      setProfile((prev) => {
        const next = applyMatchToProfile(prev, { won: outcome.won, ratingDelta: outcome.ratingDelta, settlement: settlementForMode(outcome.won, wagerEur), bestRoundMs: null });
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

  const finishMonkeyMatch: DuelContextValue["finishMonkeyMatch"] = useCallback(
    ({ playerLevels, opponentLevels }) => {
      if (!activeMatch) return null;
      const score = scoreMonkey(playerLevels, opponentLevels);
      saveHighscore("memory", score.playerLevels);
      let outcome: MatchOutcome = {
        id: activeMatch.id, gameId: activeMatch.gameId,
        opponentName: activeMatch.opponent.username, opponentAvatar: activeMatch.opponent.avatar,
        opponentRating: activeMatch.opponent.rating, playerAvgMs: score.playerLevels,
        opponentAvgMs: score.opponentLevels, playerBestMs: score.playerLevels, falseStarts: 0,
        won: score.won, coinDelta: balanceDelta(score.won, wagerEur), wagerEur,
        ratingDelta: ratingDeltaFor(score.won), playedAt: new Date().toISOString(), rounds: [],
        monkey: { seed: activeMatch.seed, playerLevels: score.playerLevels, opponentLevels: score.opponentLevels },
      };
      outcome=tagLadderOutcome(outcome);
      setProfile(prev => {
        const next = applyMatchToProfile(prev,{won:outcome.won,ratingDelta:outcome.ratingDelta,settlement:settlementForMode(outcome.won,wagerEur),bestRoundMs:null});
        storage.write(STORAGE_KEYS.profile,next); return next;
      });
      setHistory(prev => { const next=[outcome,...prev].slice(0,50);storage.write(STORAGE_KEYS.history,next);return next;});
      setLastOutcome(outcome); setActiveMatch(null); return outcome;
    }, [activeMatch,wagerEur,saveHighscore],
  );

  const finishSurvivalMatch: DuelContextValue["finishSurvivalMatch"] = useCallback(
    ({ playerScore, opponentScore }) => {
      if (!activeMatch) return null;
      const won = playerScore > opponentScore;
      saveHighscore(activeMatch.gameId, playerScore);
      let outcome: MatchOutcome = {
        id: activeMatch.id, gameId: activeMatch.gameId,
        opponentName: activeMatch.opponent.username, opponentAvatar: activeMatch.opponent.avatar,
        opponentRating: activeMatch.opponent.rating, playerAvgMs: playerScore,
        opponentAvgMs: opponentScore, playerBestMs: playerScore, falseStarts: 0,
        won, coinDelta: balanceDelta(won, wagerEur), wagerEur,
        ratingDelta: ratingDeltaFor(won), playedAt: new Date().toISOString(), rounds: [],
        survival: { seed: activeMatch.seed, playerScore, opponentScore },
      };
      outcome=tagLadderOutcome(outcome);
      setProfile(prev => {
        const next = applyMatchToProfile(prev,{won,ratingDelta:outcome.ratingDelta,settlement:settlementForMode(won,wagerEur),bestRoundMs:null});
        storage.write(STORAGE_KEYS.profile,next); return next;
      });
      setHistory(prev => { const next=[outcome,...prev].slice(0,50);storage.write(STORAGE_KEYS.history,next);return next;});
      setLastOutcome(outcome); setActiveMatch(null); return outcome;
    }, [activeMatch,wagerEur],
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
      startFriendMatch,
      reserveFriendWager,
      settleFriendChallenge,
      cancelMatch,
      finishMatch,
      finishRhythmMatch,
      finishPrecisionMatch,
      finishDirectionMatch,
      finishMonkeyMatch,
      finishSurvivalMatch,
      resetProgress,
      wagerEur,
      setWagerEur,
      canPlay: canAfford(profile.coins, wagerEur),
      ladder,
      startLadder,
      continueLadder,
      cashOutLadder,
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
      startFriendMatch,
      reserveFriendWager,
      settleFriendChallenge,
      cancelMatch,
      finishMatch,
      finishRhythmMatch,
      finishPrecisionMatch,
      finishDirectionMatch,
      finishMonkeyMatch,
      finishSurvivalMatch,
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
