import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { sfx } from "@/lib/duel/audio";
import { MatchBalance } from "@/components/duel/MatchBalance";
import {
  createDirectionChart,
  simulateDirectionOpponent,
  travelMs,
  type Direction,
} from "@/lib/duel/engine/direction";

export const Route = createFileRoute("/play/direction")({
  head: () => ({ meta: [{ title: "Direction duel — DUEL" }] }),
  component: DirectionGame,
});

type Phase = "ready" | "playing" | "over";
const ARENA_HEIGHT = 470;
const DANGER_Y = 400;
const SWIPE_MIN = 34;
const SYMBOL: Record<Direction, string> = { up: "↑", right: "→", down: "↓", left: "←" };

function DirectionGame() {
  const navigate = useNavigate();
  const { activeMatch, finishDirectionMatch, ready, profile, wagerEur } = useDuel();
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [destroyed, setDestroyed] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const seed = activeMatch?.seed ?? 1;
  const chart = useMemo(() => createDirectionChart(seed), [seed]);
  const opponentOut = useMemo(
    () => activeMatch ? simulateDirectionOpponent(seed, activeMatch.opponent) : 0,
    [seed, activeMatch],
  );
  const startAt = useRef(0);
  const nextIndex = useRef(0);
  const finished = useRef(false);
  const raf = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (ready && !activeMatch) navigate({ to: "/" });
  }, [ready, activeMatch, navigate]);

  const end = (count: number) => {
    if (finished.current) return;
    finished.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    setPhase("over");
    setFlash("miss");
    sfx.miss();
    const outcome = finishDirectionMatch({ playerArrows: count, opponentArrows: opponentOut });
    setTimeout(() => {
      if (outcome) {
        outcome.won ? sfx.win() : sfx.lose();
        navigate({ to: "/result" });
      } else navigate({ to: "/" });
    }, 1100);
  };

  useEffect(() => {
    if (!activeMatch) return;
    const kickoff = setTimeout(() => {
      setPhase("playing");
      startAt.current = performance.now();
      const tick = () => {
        const t = performance.now() - startAt.current;
        setElapsed(t);
        const next = chart[nextIndex.current];
        if (!next) { end(chart.length); return; }
        if (t >= next.spawnMs + travelMs(next.index)) { end(nextIndex.current); return; }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, 1100);
    return () => {
      clearTimeout(kickoff);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatch]);

  const swipe = (direction: Direction) => {
    if (phase !== "playing" || finished.current) return;
    const next = chart[nextIndex.current];
    if (!next || elapsed < next.spawnMs) return;
    if (direction !== next.direction) { end(nextIndex.current); return; }
    nextIndex.current += 1;
    setDestroyed(nextIndex.current);
    setFlash("hit");
    sfx.tap();
    setTimeout(() => setFlash(null), 90);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  if (!activeMatch) return null;
  const visible = chart.filter((a) => elapsed >= a.spawnMs && elapsed <= a.spawnMs + travelMs(a.index) && a.index >= nextIndex.current);
  const level = Math.floor(destroyed / 6) + 1;

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden overscroll-none bg-background">
      <div className="shrink-0 px-5 pt-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">How to play</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Swipe in the direction shown by the lowest falling arrow. A wrong swipe or an arrow crossing the danger line ends the run.</p>
      </div>
      <MatchBalance coins={profile.coins} wagerEur={wagerEur} />
      <header className="grid shrink-0 grid-cols-3 gap-2 px-5 pt-2 text-center">
        <Meter label="Destroyed" value={String(destroyed)} />
        <Meter label="Level" value={String(level)} />
        <Meter label="Opponent" value={destroyed >= opponentOut ? `OUT ${opponentOut}` : String(Math.min(destroyed, opponentOut))} />
      </header>
      <div className="flex shrink-0 items-center justify-between px-5 pt-2 text-xs text-muted-foreground">
        <span className="truncate">vs {activeMatch.opponent.username}</span>
        <span>SWIPE ↑ ↓ ← →</span>
      </div>
      <section
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className={`relative mx-5 mt-3 flex-1 touch-none select-none overflow-hidden rounded-3xl border bg-card ${flash === "miss" ? "animate-shake border-destructive" : "border-border"}`}
        style={{ minHeight: ARENA_HEIGHT }}
      >
        <div className="absolute inset-x-0 border-t-2 border-dashed border-destructive/70" style={{ top: DANGER_Y }}>
          <span className="absolute right-3 -top-5 text-[9px] font-bold tracking-[0.2em] text-destructive">DANGER</span>
        </div>
        {phase === "playing" && visible.map((a) => {
          const progress = (elapsed - a.spawnMs) / travelMs(a.index);
          const y = Math.max(-55, Math.min(DANGER_Y, progress * (DANGER_Y + 55) - 55));
          const isNext = a.index === nextIndex.current;
          return (
            <span key={a.index} className={`absolute left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-2xl border text-4xl font-bold transition-opacity ${isNext ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary text-foreground"}`} style={{ top: y }}>
              {SYMBOL[a.direction]}
            </span>
          );
        })}
        {phase === "ready" && <Overlay title="GET READY" text="Swipe in the direction of the lowest arrow. One mistake and you're out." />}
        {phase === "over" && <Overlay title="OUT" text={`${destroyed} arrows · opponent ${opponentOut}`} danger />}
        {flash === "hit" && <div className="pointer-events-none absolute inset-0 bg-primary/5" />}
      </section>
      <div className="px-5 pb-3 pt-2 text-center text-xs text-muted-foreground">
        Swipe anywhere inside the arena. Destroy the lowest arrow before it reaches the danger line.
      </div>
    </main>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="font-display text-lg font-bold tabular-nums">{value}</p></div>;
}
function Overlay({ title, text, danger = false }: { title: string; text: string; danger?: boolean }) {
  return <div className="absolute inset-0 z-10 grid place-items-center bg-background/85 text-center"><div><p className={`font-display text-3xl font-bold tracking-[0.28em] ${danger ? "text-destructive" : "text-primary"}`}>{title}</p><p className="mt-2 px-8 text-sm text-muted-foreground">{text}</p></div></div>;
}
