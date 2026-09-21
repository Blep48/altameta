import { it, expect } from "vitest";
import {
  command,
  initialAccount,
  settleChallenge,
  view,
  type Account,
  type Challenge,
  type Command,
} from "../supabase/functions/_shared/arena-domain";
import { createEngine } from "../supabase/functions/_shared/arena-engine";
let serial = 0;
const entropy = () => ({
  id: `match-${++serial}`,
  seed: 42 + serial,
  code: `CODE${serial}`,
});
const run = (
  a: Account,
  action: string,
  fields: Partial<Command> = {},
  c: Challenge | null = null,
  now = 1000,
) =>
  command(
    a,
    c,
    { id: `request-${++serial}`, action, ...fields },
    now,
    entropy(),
  );
const start = (a: Account, mode = "duel") =>
  run(a, "start", { gameId: "stack", wagerEur: 1, mode });
function win(a: Account, c: Challenge | null = null) {
  const r = a.active!;
  r.engine = createEngine("stack", 42, 0);
  r.engine.score = 10;
  r.engine.done = true;
  r.botScore = 2;
  return run(a, "tick", { matchId: r.match.id }, c);
}
it("charges the server wallet and settles a frozen stake exactly once", () => {
  const a = initialAccount("a", "alice");
  start(a);
  expect(a.profile.coins).toBe(9900);
  const id = a.active!.match.id;
  win(a);
  expect(a.profile.coins).toBe(10090);
  expect(a.profile.wins).toBe(1);
  expect(() => run(a, "tick", { matchId: id })).toThrow("Match not active");
  expect(a.profile.coins).toBe(10090);
});
it("continues ladder without a second stake and cashes out 95% of the total pool once", () => {
  const a = initialAccount("a", "alice");
  start(a, "ladder");
  win(a);
  start(a, "ladder");
  win(a);
  expect(a.profile.coins).toBe(9900);
  expect(a.ladder?.streak).toBe(2);
  run(a, "cashout");
  expect(a.profile.coins).toBe(10280);
  expect(() => run(a, "cashout")).toThrow();
  expect(a.profile.coins).toBe(10280);
});
it("cancel before begin refunds once, leaving after begin forfeits", () => {
  const a = initialAccount("a", "alice");
  start(a);
  run(a, "leave", { matchId: a.active!.match.id });
  expect(a.profile.coins).toBe(10000);
  start(a);
  run(a, "begin", { matchId: a.active!.match.id });
  run(a, "leave", { matchId: a.active!.match.id });
  expect(a.profile.coins).toBe(9900);
  expect(a.profile.losses).toBe(1);
  expect(a.profile.highscores).toEqual({});
});
it("rejects invalid games, stakes, commands and arbitrary score uploads", () => {
  const a = initialAccount("a", "alice");
  expect(() =>
    run(a, "start", { gameId: "dash", wagerEur: 1, mode: "duel" }),
  ).toThrow("Game unavailable");
  expect(() =>
    run(a, "start", { gameId: "stack", wagerEur: -50, mode: "duel" }),
  ).toThrow("Invalid stake");
  expect(() => run(a, "submit")).toThrow("Unsupported action");
  expect(() => run(a, "reset")).toThrow("Unsupported action");
});
it("ignores replayed request IDs and rejects skipped input sequence numbers", () => {
  const a = initialAccount("a", "alice");
  start(a);
  const matchId = a.active!.match.id;
  run(a, "begin", { matchId });
  const b = {
    id: "same-request",
    action: "input",
    matchId,
    seq: 1,
    input: "tap",
  };
  command(a, null, b, 2600, entropy());
  const coins = a.profile.coins,
    score = a.active?.engine?.score;
  command(a, null, b, 2700, entropy());
  expect(a.profile.coins).toBe(coins);
  expect(a.active?.engine?.score).toBe(score);
  expect(() =>
    run(a, "input", { matchId, seq: 9, input: "tap" }, null, 2700),
  ).toThrow("Input out of order");
});
it("binds friend runs to authenticated participants and prevents self-joining", () => {
  const a = initialAccount("a", "alice"),
    b = initialAccount("b", "bob"),
    stranger = initialAccount("c", "charlie");
  let c = run(a, "create", {
    gameId: "stack",
    wagerEur: 1,
    paymentMode: "demo",
  })!;
  expect(a.profile.coins).toBe(9900);
  expect(() => run(a, "join", {}, c)).toThrow("Cannot challenge yourself");
  expect(() =>
    run(stranger, "start", { gameId: "stack", wagerEur: 1, mode: "friend" }, c),
  ).toThrow("Not a challenge participant");
  c = run(b, "join", {}, c)!;
  expect(b.profile.coins).toBe(9900);
  c = run(a, "start", { gameId: "stack", wagerEur: 50, mode: "friend" }, c)!;
  expect(a.active!.match.wagerEur).toBe(1);
  c = win(a, c)!;
  expect(a.profile.coins).toBe(9900);
  expect(c.creator_score).toBe(10);
  c = run(b, "start", { gameId: "stack", wagerEur: 1, mode: "friend" }, c)!;
  run(b, "begin", { matchId: b.active!.match.id }, c);
  c = run(b, "leave", { matchId: b.active!.match.id }, c)!;
  expect(c.winner).toBe("creator");
  settleChallenge(a, c, 2000);
  settleChallenge(a, c, 2000);
  expect(a.profile.coins).toBe(10090);
  expect(b.profile.coins).toBe(9900);
  expect(a.profile.wins).toBe(1);
  expect(() =>
    run(a, "start", { gameId: "stack", wagerEur: 1, mode: "friend" }, c),
  ).toThrow("Run already played");
});
it("refunds an expired unfinished friend challenge once; no late result is accepted", () => {
  const a = initialAccount("a", "alice");
  let c = run(a, "create", {
    gameId: "stack",
    wagerEur: 1,
    paymentMode: "demo",
  })!;
  c = run(a, "start", { gameId: "stack", wagerEur: 1, mode: "friend" }, c)!;
  const id = a.active!.match.id;
  run(a, "begin", { matchId: id }, c);
  run(a, "tick", { matchId: id }, c, Date.parse(c.expires_at) + 1);
  expect(c.creator_score).toBeNull();
  expect(a.profile.coins).toBe(10000);
  settleChallenge(a, c, Date.parse(c.expires_at) + 100);
  expect(a.profile.coins).toBe(10000);
});
it("keeps opponent scores, seeds for Reaction and private account state off the wire", () => {
  const a = initialAccount("a", "alice");
  run(a, "start", { gameId: "reaction", wagerEur: 1, mode: "duel" });
  run(a, "begin", { matchId: a.active!.match.id });
  const v = view(a, null, 1000);
  expect(v.activeMatch?.seed).toBe(0);
  expect(v.engine?.seed).toBe(0);
  expect(v.engine?.next).toBe(0);
  expect(v).not.toHaveProperty("botScore");
  expect(v.account).not.toHaveProperty("active");
});
it("in-person challenges never debit or credit the demo wallet", () => {
  const a = initialAccount("a", "alice"),
    b = initialAccount("b", "bob");
  let c = run(a, "create", {
    gameId: "stack",
    wagerEur: 50,
    paymentMode: "in_person",
  })!;
  c = run(b, "join", {}, c)!;
  c.creator_score = 10;
  c.guest_score = 2;
  c.winner = "creator";
  settleChallenge(a, c, 2000);
  settleChallenge(b, c, 2000);
  expect(a.profile.coins).toBe(10000);
  expect(b.profile.coins).toBe(10000);
  expect(a.lastOutcome?.coinDelta).toBe(0);
});
it("a crashed live connection forfeits once after its lease, without replaying its saved engine", () => {
  const a = initialAccount("a", "alice");
  start(a);
  run(a, "begin", { matchId: a.active!.match.id });
  a.active!.connection = "live-connection";
  a.active!.deadline = 5000;
  run(a, "account", {}, null, 10000);
  expect(a.active).not.toBeNull();
  run(a, "account", {}, null, 20001);
  expect(a.active).toBeNull();
  expect(a.profile.losses).toBe(1);
  expect(a.profile.coins).toBe(9900);
  run(a, "account", {}, null, 30000);
  expect(a.profile.losses).toBe(1);
});
it("ties refund a duel stake and preserve a ladder streak", () => {
  for (const mode of ["duel", "ladder"]) {
    const a = initialAccount("a", "alice");
    start(a, mode);
    const r = a.active!;
    r.engine = createEngine("stack", 42, 0);
    r.engine.score = r.botScore;
    r.engine.done = true;
    run(a, "tick", { matchId: r.match.id });
    expect(a.lastOutcome?.tied).toBe(true);
    expect(a.profile.wins).toBe(0);
    expect(a.profile.losses).toBe(0);
    expect(a.profile.coins).toBe(mode === "duel" ? 10000 : 9900);
    if (mode === "ladder")
      expect(a.ladder).toMatchObject({ active: true, streak: 0 });
  }
});
