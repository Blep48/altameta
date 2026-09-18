import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { sfx } from "@/lib/duel/audio";
import {
  MAX_STOPS,
  createTarget,
  judge,
  pointsFor,
  simulateOpponentRun,
  speedFor,
  type PrecisionTarget,
  type StopVerdict,
} from "@/lib/duel/engine/precision";

export const Route = createFileRoute("/play/precision")({
  head: () => ({
    meta: [
      { title: "Precision duel — DUEL" },
      {
        name: "description",
        content:
          "Stop the sweeping marker inside the target. Hit the inner core for double points — the marker speeds up with every success.",
      },
      { property: "og:title", content: "Precision duel — DUEL" },
      {
        property: "og:description",
        content: "Sudden-death precision duel: perfect stops score double.",
      },
    ],
  }),
  component: PrecisionGame,
});

type Phase = "ready" | "playing" | "over";

function PrecisionGame() {
  const navigate = useNavigate();
  const { activeMatch, finishPrecisionMatch, ready } = useDuel();

  const [phase, setPhase] = useState<Phase>("ready");
  const [position, setPosition] = useState(0);
  const [stops, setStops] = useState(0);
  const [points, setPoints] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [verdict, setVerdict] = useState<StopVerdict | null>(null);
  const [target, setTarget] = useState<PrecisionTarget>(() =>
    createTarget(activeMatch?.seed ?? 1, 0),
  );

  const seed = activeMatch?.seed ?? 1;
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const stopsRef = useRef(0);
  const pointsRef = useRef(0);
  const perfectsRef = useRef(0);
  const targetRef = useRef(target);
  const lockRef = useRef(false);
  const finished = useRef(false);
  const raf = useRef<number | null>(null);
  const lastT = useRef(0);

  const opponentRun = useRef(
    activeMatch
      ? simulateOpponentRun(seed, activeMatch.opponent)
      : { stops: 0, perfects: 0, points: 0 },
  );

  useEffect(() => {
    if (ready && !activeMatch) navigate({ to: "/" });
  }, [ready, activeMatch, navigate]);

  const end = () => {
    if (finished.current) return;
    finished.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    setPhase("over");
    sfx.miss();
    const outcome = finishPrecisionMatch({
      player: {
        stops: stopsRef.current,
        perfects: perfectsRef.current,
        points: pointsRef.current,
      },
      opponent: opponentRun.current,
    });
    setTimeout(() => {
      if (outcome) {
        outcome.won ? sfx.win() : sfx.lose();
        navigate({ to: "/result" });
      } else {
        navigate({ to: "/" });
      }
    }, 1100);
  };

  // Sweep loop
  useEffect(() => {
    if (!activeMatch) return;
    const kickoff = setTimeout(() => {
      setPhase("playing");
      lastT.current = performance.now();

      const tick = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastT.current) / 1000);
        lastT.current = now;

        if (!lockRef.current) {
          let next = posRef.current + dirRef.current * speedFor(stopsRef.current) * dt;
          if (next >= 1) {
            next = 1;
            dirRef.current = -1;
          } else if (next <= 0) {
            next = 0;
            dirRef.current = 1;
          }
          posRef.current = next;
          setPosition(next);
        }

        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, 900);

    return () => {
      clearTimeout(kickoff);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatch]);

  const stop = () => {
    if (phase !== "playing" || finished.current || lockRef.current) return;
    const result = judge(posRef.current, targetRef.current);
    setVerdict(result);

    if (result === "miss") {
      end();
      return;
    }

    lockRef.current = true;
    stopsRef.current += 1;
    pointsRef.current += pointsFor(result);
    if (result === "perfect") perfectsRef.current += 1;
    setStops(stopsRef.current);
    setPoints(pointsRef.current);
    setPerfects(perfectsRef.current);
    result === "perfect" ? sfx.go() : sfx.tap();

    if (stopsRef.current >= MAX_STOPS) {
      end();
      return;
    }

    setTimeout(() => {
      const nextTarget = createTarget(seed, stopsRef.current);
      targetRef.current = nextTarget;
      setTarget(nextTarget);
      setVerdict(null);
      lockRef.current = false;
    }, 420);
  };

  if (!activeMatch) return null;

  const left = `${(target.center - target.goodHalf) * 100}%`;
  const width = `${target.goodHalf * 2 * 100}%`;
  const perfectLeft = `${(target.center - target.perfectHalf) * 100}%`;
  const perfectWidth = `${target.perfectHalf * 2 * 100}%`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="grid grid-cols-3 gap-2 px-5 pt-6 text-center">
        <Meter label="Points" value={`${points}`} />
        <Meter label="Stops" value={`${stops}`} />
        <Meter label="Perfects" value={`${perfects}`} />
      </header>

      <div className="flex items-center justify-between px-5 pt-3 text-xs text-muted-foreground">
        <span className="truncate">vs {activeMatch.opponent.username}</span>
        <span className="tabular-nums">speed ×{speedFor(stops).toFixed(1)}</span>
      </div>

      <section className="mx-5 mt-6 rounded-3xl border border-border bg-card px-4 py-10">
        <div className="relative h-14 w-full overflow-hidden rounded-2xl bg-muted/30">
          <span
            className="absolute inset-y-0 rounded-xl bg-primary/25"
            style={{ left, width }}
          />
          <span
            className="absolute inset-y-0 rounded-xl bg-accent/70"
            style={{ left: perfectLeft, width: perfectWidth }}
          />
          <span
            className="absolute inset-y-[-6px] w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_14px_hsl(var(--foreground))]"
            style={{ left: `${position * 100}%` }}
          />
        </div>

        <p
          className={`mt-6 text-center font-display text-2xl font-bold tracking-[0.25em] ${
            verdict === "perfect"
              ? "text-accent"
              : verdict === "good"
                ? "text-primary"
                : verdict === "miss"
                  ? "text-destructive"
                  : "text-muted-foreground"
          }`}
        >
          {verdict === "perfect"
            ? "PERFECT +2"
            : verdict === "good"
              ? "GOOD +1"
              : verdict === "miss"
                ? "MISSED"
                : phase === "ready"
                  ? "GET READY"
                  : "STOP IT"}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Inner glow = double points. One miss ends the duel.
        </p>
      </section>

      <div className="mt-auto px-5 pb-8 pt-6">
        <button
          type="button"
          onClick={stop}
          disabled={phase !== "playing"}
          className="w-full rounded-3xl bg-primary py-10 font-display text-3xl font-bold tracking-[0.3em] text-primary-foreground disabled:opacity-40"
        >
          STOP
        </button>
      </div>
    </main>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
