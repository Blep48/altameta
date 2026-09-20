import { memo, useEffect, useRef, type RefObject } from "react";
import type { RhythmNote } from "@/lib/duel/engine/rhythm";
import { travelMs, type DirectionArrow } from "@/lib/duel/engine/direction";
import { startGameLoop } from "@/lib/duel/game-loop";

/** Animation owns DOM transforms; scores/HUD no longer render every frame. */
export const RhythmField = memo(function RhythmField({
  notes,
  startAt,
  nextIndex,
}: {
  notes: RhythmNote[];
  startAt: RefObject<number>;
  nextIndex: RefObject<number>;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const field = root.current;
    if (!field) return;
    const nodes = Array.from(field.children) as HTMLElement[];
    let height = field.clientHeight;
    const observer = new ResizeObserver(() => {
      height = field.clientHeight;
    });
    observer.observe(field);
    const stop = startGameLoop((_, now) => {
      const elapsed = now - startAt.current;
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i]!,
          node = nodes[i]!;
        const remaining = note.timeMs - elapsed;
        const visible =
          i >= nextIndex.current &&
          remaining <= note.approachMs &&
          remaining > -note.windowMs;
        node.hidden = !visible;
        if (visible) {
          const bottom =
            28 + (height - 60) * Math.max(0, remaining / note.approachMs);
          node.style.transform = `translateY(${-bottom}px)`;
        }
      }
    });
    return () => {
      stop();
      observer.disconnect();
    };
  }, [notes, startAt, nextIndex]);
  return (
    <div
      ref={root}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {notes.map((n) => (
        <span
          hidden
          key={n.index}
          className="absolute bottom-0 h-8 w-[38%] rounded-xl bg-primary shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          style={{ left: n.lane === 0 ? "6%" : "56%", willChange: "transform" }}
        />
      ))}
    </div>
  );
});
const symbols = { up: "↑", right: "→", down: "↓", left: "←" };
export const DirectionField = memo(function DirectionField({
  chart,
  startAt,
  nextIndex,
}: {
  chart: DirectionArrow[];
  startAt: RefObject<number>;
  nextIndex: RefObject<number>;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const field = root.current;
    if (!field) return;
    const nodes = Array.from(field.children) as HTMLElement[];
    let height = field.clientHeight;
    const observer = new ResizeObserver(() => {
      height = field.clientHeight;
    });
    observer.observe(field);
    const stop = startGameLoop((_, now) => {
      const elapsed = now - startAt.current;
      for (let i = 0; i < chart.length; i++) {
        const arrow = chart[i]!,
          node = nodes[i]!,
          progress = (elapsed - arrow.spawnMs) / travelMs(i);
        const visible =
          i >= nextIndex.current && progress >= 0 && progress <= 1;
        node.hidden = !visible;
        if (visible) {
          node.style.transform = `translate(-50%, ${(progress * 0.98 - 0.12) * height}px)`;
          node.style.color =
            i === nextIndex.current ? "var(--primary)" : "var(--foreground)";
          node.style.borderColor =
            i === nextIndex.current ? "var(--primary)" : "var(--border)";
        }
      }
    });
    return () => {
      stop();
      observer.disconnect();
    };
  }, [chart, startAt, nextIndex]);
  return (
    <div
      ref={root}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {chart.map((a) => (
        <span
          hidden
          key={a.index}
          className="absolute left-1/2 top-0 h-14 w-14 rounded-2xl border bg-secondary text-center text-4xl font-bold leading-[56px]"
          style={{ willChange: "transform" }}
        >
          {symbols[a.direction]}
        </span>
      ))}
    </div>
  );
});
