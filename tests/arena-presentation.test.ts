import { it, expect } from "vitest";
import {
  createEngine,
  input,
  advance,
  MEMORY_PREVIEW_MS,
  memoryHideAt,
} from "../supabase/functions/_shared/arena-engine";
import {
  predictFrame,
  smoothPosition,
  confirmedFeedback,
} from "../src/lib/duel/arena-presentation";
import {
  initialAccount,
  opponentView,
  type Run,
} from "../supabase/functions/_shared/arena-domain";

it("predicts a flap before acknowledgement without changing the official state", () => {
  const server = createEngine("flappy", 1, 1000);
  advance(server, 1400);
  const saved = structuredClone(server);
  const drawn = predictFrame(
    server,
    [{ seq: 1, input: "tap", at: 1410 }],
    1450,
  );
  expect(drawn.velocity).toBeLessThan(0);
  expect(server).toEqual(saved);
  expect(drawn.score).toBe(server.score);
  input(server, "tap", 1410);
  advance(server, 1450);
  expect(predictFrame(server, [], 1450).y).toBeCloseTo(drawn.y);
});
it("smooths incoming position corrections and is independent of frame rate", () => {
  const first = smoothPosition(60, 35, 16);
  expect(first).toBeGreaterThan(35);
  expect(first).toBeLessThan(60);
  const two = smoothPosition(smoothPosition(60, 35, 16), 35, 16);
  expect(two).toBeCloseTo(smoothPosition(60, 35, 32));
});
it("never predicts a Reaction stimulus or result", () => {
  const server = createEngine("reaction", 1, 1000);
  server.next = 0;
  expect(
    predictFrame(server, [{ seq: 1, input: "tap", at: 2000 }], 2300),
  ).toEqual(server);
});
it("derives ms, perfect and good feedback only from confirmed engine transitions", () => {
  const r = createEngine("reaction", 10, 1000),
    before = structuredClone(r);
  input(r, "tap", r.next + 200);
  expect(confirmedFeedback(before, r)?.text).toMatch(/\d+ ms/);
  const p = createEngine("precision", 10, 1000);
  expect(
    confirmedFeedback(p, { ...p, score: 2, index: 1, perfects: 1 })?.text,
  ).toBe("PERFECT!");
  expect(confirmedFeedback(p, { ...p, score: 1, index: 1 })?.text).toBe(
    "GOOD!",
  );
  expect(confirmedFeedback(p, p)).toBeNull();
});
it("keeps Monkey numbers visible an extra half-second and blocks early selections", () => {
  const m = createEngine("memory", 1, 0);
  expect(MEMORY_PREVIEW_MS).toBe(1500);
  expect(memoryHideAt(m)).toBe(2060);
  input(m, "cell:0", 1800);
  expect(m.selected).toEqual([]);
  expect(m.done).toBe(false);
});
it("reveals a bot result only after its server finish time, including remaining points and payout", () => {
  const account = initialAccount("a", "alice");
  const run = {
    engine: createEngine("stack", 1, 1000),
    botScore: 3,
    match: { gameId: "stack", mode: "duel", wagerEur: 1 },
  } as Run;
  expect(opponentView(run, null, account, 2000)).toBeNull();
  expect(opponentView(run, null, account, 6000)).toMatchObject({
    score: 3,
    needed: 4,
    ahead: false,
    prizeUnits: 190,
  });
  run.engine!.score = 4;
  expect(opponentView(run, null, account, 6000)).toMatchObject({
    needed: 0,
    ahead: true,
  });
});
