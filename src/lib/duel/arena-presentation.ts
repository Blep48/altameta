import {
  advance,
  input,
  type Engine,
  type Input,
} from "../../../supabase/functions/_shared/arena-engine";

export type PendingControl = { seq: number; input: Input; at: number };
/** Disposable drawing state. Never publish predicted scores or feed clocks to the server. */
export function predictFrame(
  authoritative: Engine,
  pending: PendingControl[],
  now: number,
): Engine {
  const visual = structuredClone(authoritative);
  if (visual.game === "reaction") return visual; // Never predict the private stimulus.
  const horizon = Math.max(visual.time, Math.min(now, visual.time + 300));
  for (const control of pending) {
    if (control.at > horizon) continue;
    input(visual, control.input, Math.max(visual.time, control.at));
  }
  advance(visual, horizon);
  return visual;
}

/** Reconcile position continuously, independently of display FPS. */
export function smoothPosition(
  previous: number,
  target: number,
  elapsedMs: number,
) {
  return (
    previous +
    (target - previous) * (1 - Math.exp(-Math.max(0, elapsedMs) / 35))
  );
}

export type GameFeedback = { text: string; good: boolean; perfect: boolean };
export function confirmedFeedback(
  previous: Engine | null,
  next: Engine,
): GameFeedback | null {
  if (!previous) return null;
  if (next.game === "reaction" && next.index > previous.index) {
    const early = next.earlyRounds?.[next.index - 1] ?? false;
    return {
      text: early ? "TOO SOON!" : `${next.reactions[next.index - 1]} ms`,
      good: !early,
      perfect: !early,
    };
  }
  if (
    (next.game === "precision" || next.game === "stack") &&
    next.score > previous.score
  ) {
    const perfect = next.perfects > previous.perfects;
    return { text: perfect ? "PERFECT!" : "GOOD!", good: true, perfect };
  }
  if (next.score > previous.score)
    return {
      text:
        next.game === "memory"
          ? "LEVEL CLEAR!"
          : `+${next.score - previous.score}`,
      good: true,
      perfect: false,
    };
  return null;
}

export const SCORE_UNITS: Record<string, string> = {
  reaction: "AVG MS",
  rhythm: "NOTES",
  direction: "ARROWS",
  memory: "LEVELS",
  precision: "POINTS",
  flappy: "PIPES",
  stack: "BLOCKS",
  knife: "KNIVES",
};
