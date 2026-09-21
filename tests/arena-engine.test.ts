import { describe, it, expect } from "vitest";
import {
  createEngine,
  advance,
  input,
  board,
  memoryHideAt,
  arrows,
  rhythmChart,
  publicEngine,
  GAMES,
} from "../supabase/functions/_shared/arena-engine";
describe("server simulation", () => {
  it("uses five server-timed reaction rounds, with early-tap penalties", () => {
    const s = createEngine("reaction", 123, 1000);
    input(s, "tap", 1100);
    expect(s.reactions).toEqual([600]);
    expect(s.falseStarts).toBe(1);
    for (let i = 1; i < 5; i++) input(s, "tap", s.next + 200);
    expect(s.done).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(270);
    expect(s.score).toBeLessThanOrEqual(280);
    input(s, "tap", 999999);
    expect(s.reactions).toHaveLength(5);
  });
  it("does not reveal an upcoming reaction stimulus", () => {
    const s = createEngine("reaction", 23, 0);
    expect(publicEngine(s).next).toBe(0);
    advance(s, s.next + 10);
    expect(publicEngine(s).next).toBeGreaterThan(0);
  });
  it("rejects direction commands for unseen arrows and ends on the first mistake", () => {
    const s = createEngine("direction", 1, 0),
      chart = arrows(1);
    input(s, chart[0]!.direction as "left", chart[0]!.spawn + 100);
    expect(s.score).toBe(1);
    input(s, chart[1]!.direction as "left", chart[0]!.spawn + 200);
    expect(s.done).toBe(true);
    expect(s.score).toBe(1);
  });
  it("scores rhythm lane inputs, rather than submitted counts", () => {
    const s = createEngine("rhythm", 1, 0),
      notes = rhythmChart(1);
    for (const n of notes.slice(0, 5)) input(s, n.lane as "left", n.time);
    expect(s.score).toBe(5);
    advance(s, notes[5]!.time + 200);
    expect(s.done).toBe(true);
  });
  it("checks actual Monkey Test cell order and hides input during memorization", () => {
    const s = createEngine("memory", 8, 0),
      cells = board(8, 0);
    input(s, `cell:${cells[0]}`, 10);
    expect(s.index).toBe(0);
    const now = memoryHideAt(s) + 10;
    cells.forEach((cell, i) => input(s, `cell:${cell}`, now + i * 80));
    expect(s.score).toBe(1);
  });
  it("rejects malformed controls", () => {
    expect(() =>
      input(createEngine("memory", 1, 0), "cell:99" as never, 2000),
    ).toThrow("Invalid input");
    expect(() =>
      input(createEngine("stack", 1, 0), "score:999" as never, 10),
    ).toThrow("Invalid input");
  });
  it("derives Precision points from the moving marker", () => {
    const s = createEngine("precision", 1, 0);
    input(s, "tap", 0);
    expect(s.done).toBe(true);
    expect(s.score).toBe(0);
  });
  it("counts a landed knife only after flight, and blocks multiple projectiles", () => {
    const s = createEngine("knife", 1, 0);
    input(s, "tap", 0);
    input(s, "tap", 20);
    expect(s.score).toBe(0);
    advance(s, 150);
    expect(s.score).toBe(1);
    expect(s.knives).toHaveLength(1);
  });
  it("cuts Stack blocks and stops a run that misses", () => {
    const s = createEngine("stack", 1, 0);
    input(s, "tap", 0);
    expect(s.score).toBe(1);
    expect(s.width).toBe(72);
    s.width = 5;
    s.base = 50;
    s.x = 0;
    input(s, "tap", 0);
    expect(s.done).toBe(true);
    expect(s.score).toBe(1);
  });
  it("Flappy collisions are independent of polling rate and viewport", () => {
    const a = createEngine("flappy", 1, 0),
      b = createEngine("flappy", 1, 0);
    advance(a, 2000);
    for (let t = 10; t <= 2000; t += 10) advance(b, t);
    expect(a).toEqual(b);
    expect(a.done).toBe(true);
    expect(a.score).toBe(0);
  });
  it.each(GAMES)("%s cannot be paused forever by stopping requests", (game) => {
    const s = createEngine(game, 1, 0);
    advance(s, 400000);
    expect(s.done).toBe(true);
  });
  it("does not run Dino or accept backwards time", () => {
    expect(() => createEngine("dash" as never, 1, 0)).toThrow(
      "Game unavailable",
    );
    const s = createEngine("stack", 1, 1000);
    advance(s, 0);
    expect(s.time).toBe(1000);
  });
});
