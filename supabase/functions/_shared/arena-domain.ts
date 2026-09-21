import {
  advance,
  createEngine,
  GAMES,
  input,
  publicEngine,
  rng,
  type Engine,
  type Game,
  type Input,
} from "./arena-engine.ts";

export interface Profile {
  id: string;
  username: string;
  avatar: string;
  coins: number;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  bestReactionMs: number | null;
  highscores: Record<string, number>;
  peakLeagueIndex: number;
}
export interface Ladder {
  gameId: string;
  wagerEur: number;
  streak: number;
  active: boolean;
  lost?: boolean;
}
export interface Outcome {
  id: string;
  gameId: string;
  mode: "duel" | "ladder" | "friend";
  opponentName: string;
  opponentAvatar: string;
  opponentRating: number;
  playerAvgMs: number;
  opponentAvgMs: number;
  playerBestMs: number;
  falseStarts: number;
  won: boolean;
  tied: boolean;
  coinDelta: number;
  wagerEur: number;
  ratingDelta: number;
  playedAt: string;
  rounds: {
    round: number;
    playerMs: number;
    opponentMs: number;
    falseStart: boolean;
  }[];
  survival?: { seed: number; playerScore: number; opponentScore: number };
  ladderStreak?: number;
  ladderPrizeUnits?: number;
  friendChallengeCode?: string;
}
export interface Match {
  id: string;
  gameId: Game;
  mode: "duel" | "ladder" | "friend";
  entryCharged: boolean;
  wagerEur: number;
  seed: number;
  startedAt: number;
  opponent: {
    id: string;
    username: string;
    avatar: string;
    rating: number;
    meanReactionMs: number;
    varianceMs: number;
  };
  friend?: { code: string; token: string; role: "creator" | "guest" };
}
export interface Run {
  match: Match;
  engine: Engine | null;
  botScore: number;
  seq: number;
  lastInput: string;
  created: number;
  forfeited: boolean;
  connection?: string;
  deadline?: number;
}
export interface Account {
  profile: Profile;
  history: Outcome[];
  ladder: Ladder | null;
  active: Run | null;
  reserved: Record<string, number>;
  settled: string[];
  requests: string[];
  lastOutcome: Outcome | null;
}
export interface Challenge {
  code: string;
  game_id: Game;
  seed: number;
  wager_eur: number;
  payment_mode: "demo" | "in_person";
  score_mode: "low" | "high";
  creator_id: string;
  guest_id: string | null;
  creator_name: string;
  guest_name: string | null;
  creator_avatar: string;
  guest_avatar: string | null;
  creator_score: number | null;
  guest_score: number | null;
  creator_finished_at: string | null;
  guest_finished_at: string | null;
  creator_run: string | null;
  guest_run: string | null;
  creator_forfeit: boolean;
  guest_forfeit: boolean;
  created_at: string;
  expires_at: string;
  winner: "creator" | "guest" | "tie" | null;
}
export interface Command {
  id: string;
  action: string;
  gameId?: unknown;
  wagerEur?: unknown;
  mode?: unknown;
  code?: unknown;
  paymentMode?: unknown;
  matchId?: unknown;
  seq?: unknown;
  input?: unknown;
  avatar?: unknown;
}
export const WAGERS = [1, 2, 5, 10, 20, 30, 50];
export function initialAccount(id: string, username: string): Account {
  return {
    profile: {
      id,
      username,
      avatar: "👾",
      coins: 10000,
      rating: 1200,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      bestReactionMs: null,
      highscores: {},
      peakLeagueIndex: 0,
    },
    history: [],
    ladder: null,
    active: null,
    reserved: {},
    settled: [],
    requests: [],
    lastOutcome: null,
  };
}
function fail(message: string): never {
  throw new Error(message);
}
const game = (value: unknown): Game =>
  (GAMES as readonly unknown[]).includes(value)
    ? (value as Game)
    : fail("Game unavailable");
const wager = (value: unknown): number =>
  WAGERS.includes(value as number) ? (value as number) : fail("Invalid stake");
function debit(a: Account, units: number) {
  if (a.profile.coins < units) fail("Not enough demo balance");
  a.profile.coins -= units;
}
export function prize(l: Ladder) {
  const n = Math.round(l.wagerEur * 100 * 2 ** l.streak * 0.95);
  if (!Number.isSafeInteger(n)) fail("Ladder limit reached");
  return n;
}
function credit(a: Account, units: number) {
  if (!Number.isSafeInteger(a.profile.coins + units))
    fail("Balance limit reached");
  a.profile.coins += units;
}
function botScore(g: Game, seed: number, rating: number) {
  const r = rng(seed ^ 0xa341316c),
    skill = Math.min(1, Math.max(0, (rating - 850) / 700));
  if (g === "reaction") return Math.round(320 - 100 * skill + r() * 40);
  const caps = {
    rhythm: 200,
    direction: 250,
    memory: 10,
    precision: 40,
    flappy: 180,
    stack: 100,
    knife: 120,
  };
  for (let i = 0; i < caps[g]; i++)
    if (
      r() <
      Math.min(
        0.8,
        (g === "memory" ? 0.16 : 0.018) + i * (g === "memory" ? 0.075 : 0.009),
      ) *
        (1.35 - skill * 0.6)
    )
      return g === "precision" ? Math.round(i * 1.3) : i;
  return caps[g];
}
export function role(c: Challenge, id: string): "creator" | "guest" {
  if (c.creator_id === id) return "creator";
  if (c.guest_id === id) return "guest";
  return fail("Not a challenge participant");
}
export function publicChallenge(c: Challenge, id: string) {
  const {
    creator_id,
    guest_id,
    creator_run,
    guest_run,
    creator_forfeit,
    guest_forfeit,
    ...safe
  } = c;
  const mine = creator_id === id ? "creator" : guest_id === id ? "guest" : null;
  return { ...safe, id: c.code, role: mine, token: mine ? "account" : null };
}
function outcome(
  a: Account,
  run: Run,
  mine: number,
  theirs: number,
  won: boolean,
  tied: boolean,
  now: number,
): Outcome {
  const m = run.match,
    e = run.engine;
  const o: Outcome = {
    id: m.id,
    gameId: m.gameId,
    mode: m.mode,
    opponentName: m.opponent.username,
    opponentAvatar: m.opponent.avatar,
    opponentRating: m.opponent.rating,
    playerAvgMs: mine,
    opponentAvgMs: theirs,
    playerBestMs: e?.reactions.length ? Math.min(...e.reactions) : mine,
    falseStarts: e?.falseStarts ?? 0,
    won,
    tied,
    coinDelta: tied ? 0 : won ? Math.round(m.wagerEur * 90) : -m.wagerEur * 100,
    wagerEur: m.wagerEur,
    ratingDelta: m.mode === "friend" || tied ? 0 : won ? 15 : -15,
    playedAt: new Date(now).toISOString(),
    rounds: [],
  };
  if (m.gameId !== "reaction")
    o.survival = { seed: m.seed, playerScore: mine, opponentScore: theirs };
  else
    o.rounds = (e?.reactions ?? []).map((ms, i) => ({
      round: i + 1,
      playerMs: ms,
      opponentMs: theirs,
      falseStart: e?.earlyRounds?.[i] ?? false,
    }));
  if (m.friend) o.friendChallengeCode = m.friend.code;
  if (m.mode === "ladder" && a.ladder) {
    // A tie preserves the same streak; a win doubles the represented pool.
    if (won) a.ladder.streak++;
    else if (!tied) {
      a.ladder.active = false;
      a.ladder.lost = true;
    }
    o.coinDelta = won || tied ? 0 : -m.wagerEur * 100;
    o.ladderStreak = a.ladder.streak;
    o.ladderPrizeUnits = a.ladder.active ? prize(a.ladder) : 0;
  } else if (m.mode !== "friend")
    credit(a, tied ? m.wagerEur * 100 : won ? Math.round(m.wagerEur * 190) : 0);
  const p = a.profile;
  p.gamesPlayed++;
  p.wins += won ? 1 : 0;
  p.losses += !won && !tied ? 1 : 0;
  p.rating = Math.max(100, p.rating + o.ratingDelta);
  p.peakLeagueIndex = Math.max(
    p.peakLeagueIndex,
    Math.min(15, Math.floor(p.rating / 200)),
  );
  if (!run.forfeited) {
    const old = p.highscores[m.gameId];
    if (old == null || (m.gameId === "reaction" ? mine < old : mine > old))
      p.highscores[m.gameId] = mine;
    if (m.gameId === "reaction" && e?.reactions.length)
      p.bestReactionMs =
        p.bestReactionMs == null
          ? o.playerBestMs
          : Math.min(p.bestReactionMs, o.playerBestMs);
  }
  a.history = [o, ...a.history].slice(0, 100);
  a.lastOutcome = o;
  return o;
}
function finish(a: Account, c: Challenge | null, now: number) {
  const run = a.active;
  if (!run?.engine?.done) return;
  const m = run.match,
    score = run.forfeited && m.gameId === "reaction" ? 2500 : run.engine.score;
  if (m.friend) {
    if (!c || c.code !== m.friend.code) fail("Challenge required");
    if (now >= Date.parse(c.expires_at)) {
      a.active = null;
      return;
    }
    const r = role(c, a.profile.id);
    if (c[`${r}_run`] !== m.id) fail("Run mismatch");
    if (c[`${r}_score`] == null) {
      c[`${r}_score`] = score;
      c[`${r}_finished_at`] = new Date(now).toISOString();
      c[`${r}_forfeit`] = run.forfeited;
    }
    if (c.creator_score != null && c.guest_score != null) {
      c.winner =
        c.creator_forfeit && c.guest_forfeit
          ? "tie"
          : c.creator_forfeit !== c.guest_forfeit
            ? c.creator_forfeit
              ? "guest"
              : "creator"
            : c.creator_score === c.guest_score
              ? "tie"
              : (
                    c.score_mode === "low"
                      ? c.creator_score < c.guest_score
                      : c.creator_score > c.guest_score
                  )
                ? "creator"
                : "guest";
    }
  } else {
    const tied = !run.forfeited && score === run.botScore;
    const won =
      !run.forfeited &&
      !tied &&
      (m.gameId === "reaction" ? score < run.botScore : score > run.botScore);
    outcome(a, run, score, run.botScore, won, tied, now);
  }
  a.active = null;
}
export function settleChallenge(a: Account, c: Challenge, now: number) {
  const r = role(c, a.profile.id);
  if (a.settled.includes(c.code)) return;
  if (!c.winner && now < Date.parse(c.expires_at)) return;
  const held = a.reserved[c.code] ?? 0;
  if (!c.winner)
    credit(a, held); // Uncompleted challenges refund both parties at expiry.
  else {
    const won = c.winner === r,
      tied = c.winner === "tie",
      mine = c[`${r}_score`]!,
      other = r === "creator" ? "guest" : "creator";
    if (held) credit(a, tied ? held : won ? Math.round(held * 1.9) : 0);
    const run: Run = {
      match: {
        id: `friend-${c.code}-${r}`,
        gameId: c.game_id,
        seed: c.seed,
        mode: "friend",
        entryCharged: false,
        wagerEur: c.payment_mode === "demo" ? c.wager_eur : 0,
        startedAt: now,
        opponent: {
          id: "friend",
          username: c[`${other}_name`] ?? "FRIEND",
          avatar: c[`${other}_avatar`] ?? "🎮",
          rating: a.profile.rating,
          meanReactionMs: 300,
          varianceMs: 40,
        },
        friend: { code: c.code, role: r, token: "account" },
      },
      engine: null,
      botScore: 0,
      created: now,
      seq: 0,
      lastInput: "",
      forfeited: c[`${r}_forfeit`],
    };
    outcome(a, run, mine, c[`${other}_score`]!, won, tied, now);
  }
  delete a.reserved[c.code];
  a.settled.push(c.code);
}
/** Pure transition. Persistence MUST atomically compare account + challenge revisions. */
export function command(
  a: Account,
  c: Challenge | null,
  b: Command,
  now: number,
  entropy: { id: string; seed: number; code: string; privateSeed?: number },
) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(b.id)) fail("Invalid request ID");
  if (a.requests.includes(b.id)) return c;
  if (b.action === "create") {
    if (Object.keys(a.reserved).length >= 20) fail("Too many open challenges");
    const g = game(b.gameId),
      w = wager(b.wagerEur);
    if (b.paymentMode !== "demo" && b.paymentMode !== "in_person")
      fail("Invalid payment mode");
    if (b.paymentMode === "demo") debit(a, w * 100);
    a.reserved[entropy.code] = b.paymentMode === "demo" ? w * 100 : 0;
    c = {
      code: entropy.code,
      game_id: g,
      seed: entropy.seed,
      wager_eur: w,
      payment_mode: b.paymentMode,
      score_mode: g === "reaction" ? "low" : "high",
      creator_id: a.profile.id,
      creator_name: a.profile.username,
      creator_avatar: a.profile.avatar,
      guest_id: null,
      guest_name: null,
      guest_avatar: null,
      creator_score: null,
      guest_score: null,
      creator_finished_at: null,
      guest_finished_at: null,
      creator_run: null,
      guest_run: null,
      creator_forfeit: false,
      guest_forfeit: false,
      winner: null,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + 86_400_000).toISOString(),
    };
  } else if (b.action === "join") {
    if (!c || now >= Date.parse(c.expires_at)) fail("Challenge expired");
    if (c.creator_id === a.profile.id) fail("Cannot challenge yourself");
    if (c.guest_id && c.guest_id !== a.profile.id)
      fail("Challenge already accepted");
    if (!c.guest_id) {
      if (Object.keys(a.reserved).length >= 20)
        fail("Too many open challenges");
      if (c.payment_mode === "demo") debit(a, c.wager_eur * 100);
      a.reserved[c.code] = c.payment_mode === "demo" ? c.wager_eur * 100 : 0;
      c.guest_id = a.profile.id;
      c.guest_name = a.profile.username;
      c.guest_avatar = a.profile.avatar;
    }
  } else if (b.action === "start") {
    if (a.active) {
      if (
        a.active.match.gameId === b.gameId &&
        a.active.match.mode === b.mode &&
        (a.active.match.friend?.code ?? null) === (b.code ?? null)
      )
        return c;
      fail("A match is already active");
    }
    let g = game(b.gameId),
      w = wager(b.wagerEur);
    const mode = b.mode;
    if (mode !== "duel" && mode !== "ladder" && mode !== "friend")
      fail("Invalid mode");
    let r: "creator" | "guest" | undefined;
    if (mode === "friend") {
      if (!c || now >= Date.parse(c.expires_at)) fail("Challenge expired");
      r = role(c, a.profile.id);
      if (c[`${r}_run`] || c[`${r}_score`] != null) fail("Run already played");
      g = c.game_id;
      w = c.wager_eur;
      c[`${r}_run`] = entropy.id;
    } else if (mode === "ladder" && a.ladder?.active) {
      if (a.ladder.gameId !== g) fail("Finish your current ladder first");
      if (a.ladder.streak >= 35) fail("Cash out before continuing");
      w = a.ladder.wagerEur;
    } else {
      debit(a, w * 100);
      if (mode === "ladder")
        a.ladder = { gameId: g, wagerEur: w, streak: 0, active: true };
    }
    const seed = c && mode === "friend" ? c.seed : entropy.seed;
    const opponent = {
      id: "server-bot",
      username: "DEMO BOT",
      avatar: "🤖",
      rating: a.profile.rating,
      meanReactionMs: 300,
      varianceMs: 40,
    };
    if (c && r) {
      const other = r === "creator" ? "guest" : "creator";
      opponent.id = "friend";
      opponent.username = c[`${other}_name`] ?? "YOUR FRIEND";
      opponent.avatar = c[`${other}_avatar`] ?? "🎮";
    }
    a.active = {
      match: {
        id: entropy.id,
        gameId: g,
        mode,
        wagerEur: w,
        entryCharged: mode !== "friend",
        seed,
        startedAt: now,
        opponent,
        ...(c && r
          ? { friend: { code: c.code, role: r, token: "account" } }
          : {}),
      },
      engine: null,
      botScore: botScore(
        g,
        entropy.privateSeed ?? entropy.seed ^ 0x192bb,
        a.profile.rating,
      ),
      seq: 0,
      lastInput: "",
      created: now,
      forfeited: false,
    };
  } else if (
    b.action === "begin" ||
    b.action === "input" ||
    b.action === "tick" ||
    b.action === "leave"
  ) {
    const run = a.active;
    if (!run || b.matchId !== run.match.id) fail("Match not active");
    if (b.action === "begin" && !run.engine)
      run.engine = createEngine(
        run.match.gameId,
        run.match.gameId === "reaction" ? entropy.seed : run.match.seed,
        now + 1500,
      );
    if (b.action === "input") {
      if (!run.engine) fail("Match not started");
      if (typeof b.seq !== "number" || !Number.isSafeInteger(b.seq))
        fail("Invalid sequence");
      if (b.seq === run.seq && b.input === run.lastInput) return c;
      if (b.seq !== run.seq + 1) fail("Input out of order");
      if (typeof b.input !== "string") fail("Invalid input");
      input(run.engine, b.input as Input, now);
      run.seq = b.seq;
      run.lastInput = b.input;
    } else if (b.action === "leave") {
      if (!run.engine) {
        if (run.match.friend && c) c[`${role(c, a.profile.id)}_run`] = null;
        else if (run.match.mode === "duel" || a.ladder?.streak === 0) {
          credit(a, run.match.wagerEur * 100);
          if (run.match.mode === "ladder") a.ladder = null;
        }
        a.active = null;
        a.requests = [...a.requests, b.id].slice(-128);
        return c;
      }
      run.forfeited = true;
      run.engine.done = true;
    } else if (run.engine) advance(run.engine, now);
    if (c && now >= Date.parse(c.expires_at) && run.match.friend) {
      run.forfeited = true;
      run.engine ??= createEngine(run.match.gameId, run.match.seed, now);
      run.engine.done = true;
    }
    finish(a, c, now);
  } else if (b.action === "cashout") {
    if (a.active || !a.ladder?.active || a.ladder.streak < 1)
      fail("No ladder available to cash out");
    credit(a, prize(a.ladder));
    a.ladder = null;
  } else if (b.action === "avatar") {
    if (
      typeof b.avatar !== "string" ||
      ![
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
      ].includes(b.avatar)
    )
      fail("Invalid avatar");
    a.profile.avatar = b.avatar;
  } else if (b.action === "account") {
    if (a.active?.engine) {
      if (a.active.connection) {
        if (now > (a.active.deadline ?? 0) + 15000) {
          a.active.forfeited = true;
          a.active.engine.done = true;
          finish(a, c, now);
        }
      } else {
        advance(a.active.engine, now);
        finish(a, c, now);
      }
    }
  } else if (b.action !== "get") fail("Unsupported action");
  if (c && (c.creator_id === a.profile.id || c.guest_id === a.profile.id))
    settleChallenge(a, c, now);
  a.requests = [...a.requests, b.id].slice(-128);
  return c;
}
export function view(a: Account, c: Challenge | null, now: number) {
  const active = a.active;
  return {
    serverTime: now,
    account: {
      version: 1,
      profile: a.profile,
      history: a.history,
      ladder: a.ladder,
      entry: null,
      reserved: a.reserved,
      settled: a.settled,
    },
    lastOutcome: a.lastOutcome,
    activeMatch: active
      ? {
          ...active.match,
          seed: active.match.gameId === "reaction" ? 0 : active.match.seed,
        }
      : null,
    engine: active?.engine
      ? {
          ...publicEngine(active.engine),
          seed: active.match.gameId === "reaction" ? 0 : active.engine.seed,
        }
      : null,
    seq: active?.seq ?? 0,
    challenge: c ? publicChallenge(c, a.profile.id) : null,
  };
}
