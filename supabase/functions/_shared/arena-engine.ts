/** Authoritative rules. `now` MUST come from the server, never a request field.
 * The client may run advance() for drawing only; only the server persists results.
 */
export const GAMES = [
  "reaction",
  "rhythm",
  "direction",
  "memory",
  "precision",
  "flappy",
  "stack",
  "knife",
] as const;
export type Game = (typeof GAMES)[number];
export type Input = "tap" | "left" | "right" | "up" | "down" | `cell:${number}`;
export const STEP = 10;
// Finish before the hosted worker wall-clock limit; identical for both players.
export const MAX_RUN_MS = 110_000;
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export interface Engine {
  game: Game;
  seed: number;
  start: number;
  time: number;
  done: boolean;
  score: number;
  index: number;
  next: number;
  phase: number;
  perfects: number;
  x: number;
  y: number;
  velocity: number;
  scroll: number;
  direction: number;
  width: number;
  base: number;
  angle: number;
  projectile: number;
  knives: number[];
  blocks: { x: number; width: number }[];
  reactions: number[];
  falseStarts: number;
  earlyRounds: boolean[];
  offsets: number[];
  selected: number[];
}
export function createEngine(game: Game, seed: number, start: number): Engine {
  if (!(GAMES as readonly string[]).includes(game))
    throw new Error("Game unavailable");
  return {
    game,
    seed,
    start,
    time: start,
    done: false,
    score: 0,
    index: 0,
    next: start + 1500 + Math.floor(rng(seed)() * 3000),
    phase: 0,
    perfects: 0,
    x: game === "stack" ? 14 : 0,
    y: 50,
    velocity: 0,
    scroll: 0,
    direction: 1,
    width: 72,
    base: 14,
    angle: 0,
    projectile: -1,
    knives: [],
    blocks: [{ x: 14, width: 72 }],
    reactions: [],
    falseStarts: 0,
    earlyRounds: [],
    offsets: [],
    selected: [],
  };
}
export function rhythmChart(seed: number) {
  const r = rng(seed),
    out: { lane: string; time: number; window: number; approach: number }[] =
      [];
  let t = 0;
  let scale = Math.floor(r() * 11);
  for (let i = 0; i < 200; i++) {
    const level = Math.floor(i / 8),
      beat = 60000 / Math.min(200, 92 + level * 11);
    t += r() < Math.min(0.5, level * 0.07) ? beat / 2 : beat;
    scale = Math.min(10, Math.max(0, scale + Math.floor(r() * 5) - 2));
    out.push({
      lane: r() < 0.5 ? "left" : "right",
      time: Math.round(2000 + t),
      window: Math.max(75, 135 - level * 4),
      approach: Math.max(520, 1650 - level * 95),
    });
  }
  return out;
}
export function arrows(seed: number) {
  let t = 850;
  return Array.from({ length: 250 }, (_, i) => {
    const item = {
      direction: ["up", "right", "down", "left"][
        Math.floor(rng((seed ^ 0x7f4a7c15) + i * 104729)() * 4)
      ]!,
      spawn: t,
      travel: Math.max(720, 2050 - Math.floor(i / 4) * 90),
    };
    t += Math.max(220, 680 - Math.floor(i / 5) * 38);
    return item;
  });
}
export function board(seed: number, level: number) {
  const r = rng(seed ^ (level * 0x9e3779b1)),
    cells = Array.from({ length: 16 }, (_, i) => i);
  for (let i = 15; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells.slice(0, Math.min(14, 4 + level));
}
export function memoryHideAt(s: Engine) {
  return s.start + s.phase + 1000 + board(s.seed, s.score).length * 140;
}
export function target(seed: number, stops: number) {
  const half = Math.max(0.035, 0.1 - stops * 0.0045),
    margin = half + 0.04;
  return {
    center:
      margin + rng((seed ^ 0x51ed270b) + stops * 7919)() * (1 - margin * 2),
    half,
  };
}
export function obstacles(seed: number) {
  const r = rng(seed ^ 0x51ed270b);
  let x = 110;
  return Array.from({ length: 240 }, (_, i) => {
    const d = Math.min(1, i / 90);
    x += 48 + r() * 34 - d * 10;
    return { x, size: 8 + r() * 5, y: 28 + r() * 42, gap: 30 - d * 9 };
  });
}
function reactionRound(s: Engine, ms: number, early: boolean) {
  s.reactions.push(Math.round(ms));
  (s.earlyRounds ??= []).push(early);
  s.falseStarts += early ? 1 : 0;
  s.index++;
  s.score = Math.round(s.reactions.reduce((a, b) => a + b, 0) / s.index);
  if (s.index === 5) s.done = true;
  else {
    s.phase = s.time + 650;
    s.next = s.phase + 1500 + Math.floor(rng(s.seed + s.index * 7919)() * 3000);
  }
}
/** Advances fixed simulation steps, independent of FPS and viewport size. */
export function advance(s: Engine, now: number) {
  if (!Number.isFinite(now) || now < s.time || s.done) return s;
  const end = Math.min(now, s.start + MAX_RUN_MS);
  const notes = s.game === "rhythm" ? rhythmChart(s.seed) : [];
  const chart = s.game === "direction" ? arrows(s.seed) : [];
  const feed = s.game === "flappy" ? obstacles(s.seed) : [];
  while (s.time + STEP <= end && !s.done) {
    s.time += STEP;
    const dt = STEP / 1000,
      elapsed = s.time - s.start;
    if (s.game === "reaction") {
      if (s.time > s.next + 2500) reactionRound(s, 2500, false);
    }
    if (s.game === "rhythm") {
      const n = notes[s.index];
      if (!n || elapsed > n.time + n.window) s.done = true;
    }
    if (s.game === "direction") {
      const a = chart[s.index];
      if (!a || elapsed > a.spawn + a.travel) s.done = true;
    }
    if (s.game === "precision") {
      s.x += s.direction * Math.min(3.4, 0.6 + s.index * 0.11) * dt;
      if (s.x >= 1) {
        s.x = 2 - s.x;
        s.direction = -1;
      }
      if (s.x <= 0) {
        s.x = -s.x;
        s.direction = 1;
      }
    }
    if (s.game === "stack") {
      s.x += s.direction * (38 + Math.min(82, s.score * 3.6)) * dt;
      if (s.x <= 0) {
        s.x = 0;
        s.direction = 1;
      } else if (s.x + s.width >= 100) {
        s.x = 100 - s.width;
        s.direction = -1;
      }
    }
    if (s.game === "knife") {
      s.angle = (s.angle + (105 + Math.min(220, s.score * 7)) * dt) % 360;
      if (s.projectile >= 0) {
        s.projectile += dt * 7.5;
        if (s.projectile >= 1) {
          const hit = (((180 - s.angle) % 360) + 360) % 360;
          if (
            s.knives.some((a) => Math.abs(((a - hit + 540) % 360) - 180) < 14)
          )
            s.done = true;
          else {
            s.knives.push(hit);
            s.score++;
            if (s.score >= 120) s.done = true;
          }
          s.projectile = -1;
        }
      }
    }
    if (s.game === "flappy") {
      s.velocity += 66 * dt;
      s.y += s.velocity * dt;
      s.scroll += (34 + Math.min(s.score, 30) * 1.15) * dt;
      let passed = 0;
      for (const o of feed) {
        const x = o.x - s.scroll,
          w = Math.max(2.5, o.size * 0.68);
        if (x + w < 21) passed++;
        const gap = Math.max(18, o.gap - Math.min(passed, 30) * 0.55);
        if (
          x < 27 &&
          x + w > 21 &&
          (s.y - 2.4 < o.y - gap / 2 || s.y + 2.4 > o.y + gap / 2)
        )
          s.done = true;
      }
      s.score = passed;
      if (s.y < 2 || s.y > 96 || passed === feed.length) s.done = true;
    }
  }
  if (now >= s.start + MAX_RUN_MS) s.done = true;
  return s;
}
export function input(s: Engine, command: Input, now: number) {
  advance(s, now);
  if (s.done || now < s.start) return s;
  if (s.game === "reaction" && command === "tap") {
    if (s.phase && s.time < s.phase) return s;
    reactionRound(s, s.time < s.next ? 600 : s.time - s.next, s.time < s.next);
  } else if (s.game === "rhythm") {
    if (command !== "left" && command !== "right")
      throw new Error("Invalid input");
    const n = rhythmChart(s.seed)[s.index]!;
    const offset = Math.abs(s.time - s.start - n.time);
    if (command !== n.lane || offset > n.window) s.done = true;
    else {
      s.offsets.push(offset);
      s.index++;
      s.score++;
      if (s.index === 200) s.done = true;
    }
  } else if (s.game === "direction") {
    if (!["up", "down", "left", "right"].includes(command))
      throw new Error("Invalid input");
    const a = arrows(s.seed)[s.index]!;
    if (command !== a.direction || s.time - s.start < a.spawn) s.done = true;
    else {
      s.index++;
      s.score++;
      if (s.index === 250) s.done = true;
    }
  } else if (s.game === "memory") {
    if (!/^cell:(?:[0-9]|1[0-5])$/.test(command))
      throw new Error("Invalid input");
    if (s.time < memoryHideAt(s)) return s;
    const cell = Number(command.slice(5)),
      cells = board(s.seed, s.score);
    if (cell !== cells[s.index]) s.done = true;
    else {
      s.selected.push(cell);
      s.index++;
      if (s.index === cells.length) {
        s.score++;
        s.index = 0;
        s.selected = [];
        s.phase = s.time - s.start;
        if (s.score >= 30) s.done = true;
      }
    }
  } else if (s.game === "precision" && command === "tap") {
    const t = target(s.seed, s.index),
      d = Math.abs(s.x - t.center);
    if (d > t.half) s.done = true;
    else {
      const perfect = d <= t.half * 0.34;
      s.perfects += perfect ? 1 : 0;
      s.score += perfect ? 2 : 1;
      s.index++;
      if (s.index === 40) s.done = true;
    }
  } else if (s.game === "stack" && command === "tap") {
    const left = Math.max(s.x, s.base),
      overlap = Math.min(s.x + s.width, s.base + s.width) - left;
    if (overlap <= 1) s.done = true;
    else {
      const perfect = overlap >= s.width * 0.97;
      s.perfects += perfect ? 1 : 0;
      if (!perfect) {
        s.width = overlap;
        s.base = left;
      }
      s.score++;
      s.blocks.push({ x: s.base, width: s.width });
      s.blocks = s.blocks.slice(-18);
      s.direction *= -1;
      s.x = s.direction > 0 ? 0 : 100 - s.width;
      if (s.score === 100) s.done = true;
    }
  } else if (s.game === "knife" && command === "tap") {
    if (s.projectile < 0) s.projectile = 0;
  } else if (s.game === "flappy" && command === "tap") s.velocity = -31;
  else throw new Error("Invalid input");
  return s;
}
/** The reaction schedule is private until the stimulus is due. */
export function publicEngine(s: Engine): Engine {
  return { ...s, next: s.game === "reaction" && s.time < s.next ? 0 : s.next };
}
