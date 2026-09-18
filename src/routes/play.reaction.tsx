import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { sfx } from "@/lib/duel/audio";
import {
  TOTAL_ROUNDS,
  average,
  buildRound,
  randomDelayMs,
} from "@/lib/duel/engine/reaction";
import type { RoundResult } from "@/lib/duel/types";

export const Route = createFileRoute("/play/reaction")({
  head: () => ({
    meta: [
      { title: "Reaction duel — DUEL" },
      { name: "description", content: "Five rounds of pure reaction speed. Tap the moment the target turns green." },
      { property: "og:title", content: "Reaction duel — DUEL" },
      { property: "og:description", content: "Five rounds of pure reaction speed against your opponent." },
    ],
  }),
  component: ReactionGame,
});

type Phase = "ready" | "countdown" | "waiting" | "go" | "scored" | "false";

function ReactionGame() {
  const navigate = useNavigate();
  const { activeMatch, finishMatch, ready } = useDuel();

  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(3);
  const [round, setRound] = useState(1);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const goAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    if (ready && !activeMatch) navigate({ to: "/" });
  }, [ready, activeMatch, navigate]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Intro: GET READY -> 3, 2, 1 -> first round
  useEffect(() => {
    if (!activeMatch) return;
    later(() => {
      setPhase("countdown");
      setCountdown(3);
      sfx.countdown();
      later(() => {
        setCountdown(2);
        sfx.countdown();
      }, 800);
      later(() => {
        setCountdown(1);
        sfx.countdown();
      }, 1600);
      later(() => startRound(), 2400);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatch]);

  const startRound = useCallback(() => {
    setPhase("waiting");
    later(() => {
      goAt.current = performance.now();
      sfx.go();
      setPhase("go");
    }, randomDelayMs());
  }, [later]);

  const commitRound = useCallback(
    (ms: number, falseStart: boolean) => {
      if (!activeMatch) return;
      const result = buildRound(round, ms, falseStart, activeMatch.opponent);
      const next = [...rounds, result];
      setRounds(next);
      setLastMs(result.playerMs);
      setPhase(falseStart ? "false" : "scored");

      later(() => {
        if (next.length >= TOTAL_ROUNDS) {
          const outcome = finishMatch(next);
          if (outcome) {
            outcome.won ? sfx.win() : sfx.lose();
            navigate({ to: "/result" });
          } else {
            navigate({ to: "/" });
          }
        } else {
          setRound((r) => r + 1);
          startRound();
        }
      }, 1200);
    },
    [activeMatch, finishMatch, later, navigate, round, rounds, startRound],
  );

  const handleTap = () => {
    if (phase === "waiting" || phase === "countdown") {
      sfx.falseStart();
      commitRound(0, true);
      return;
    }
    if (phase === "go") {
      sfx.tap();
      commitRound(Math.round(performance.now() - goAt.current), false);
    }
  };

  if (!activeMatch) return null;

  const times = rounds.map((r) => r.playerMs);
  const avg = average(times);
  const best = times.length ? Math.min(...times) : null;

  const surface =
    phase === "go"
      ? "bg-primary text-primary-foreground"
      : phase === "false"
        ? "bg-destructive text-destructive-foreground animate-shake"
        : phase === "waiting"
          ? "bg-card text-foreground"
          : "bg-background text-foreground";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="grid grid-cols-3 gap-2 px-5 pt-6 text-center">
        <Meter label="Round" value={`${Math.min(round, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`} />
        <Meter label="Average" value={avg ? `${avg}` : "—"} />
        <Meter label="Best" value={best ? `${best}` : "—"} />
      </header>

      <div className="flex items-center justify-between px-5 pt-3 text-xs text-muted-foreground">
        <span className="truncate">vs {activeMatch.opponent.username}</span>
        <span className="tabular-nums">last {lastMs != null ? `${lastMs} ms` : "—"}</span>
      </div>

      <button
        type="button"
        onPointerDown={handleTap}
        className={`m-5 flex flex-1 select-none flex-col items-center justify-center rounded-3xl border border-border transition-colors duration-100 ${surface}`}
      >
        {phase === "ready" && (
          <span className="font-display text-3xl font-bold tracking-[0.3em]">GET READY</span>
        )}
        {phase === "countdown" && (
          <span key={countdown} className="animate-pop font-display text-8xl font-bold tabular-nums">
            {countdown}
          </span>
        )}
        {phase === "waiting" && (
          <>
            <span className="font-display text-2xl font-bold tracking-[0.25em] text-muted-foreground">
              WAIT…
            </span>
            <span className="mt-2 text-xs text-muted-foreground">Tap when it turns green</span>
          </>
        )}
        {phase === "go" && (
          <span className="font-display text-6xl font-bold tracking-[0.2em]">TAP!</span>
        )}
        {phase === "scored" && (
          <>
            <span className="font-display text-6xl font-bold tabular-nums text-primary">
              {lastMs}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">milliseconds</span>
          </>
        )}
        {phase === "false" && (
          <>
            <span className="font-display text-3xl font-bold tracking-[0.2em]">FALSE START</span>
            <span className="mt-2 text-sm opacity-80">Round penalised</span>
          </>
        )}
      </button>

      <div className="flex justify-center gap-2 pb-8">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
          const r = rounds[i];
          return (
            <span
              key={i}
              className={`h-2 w-8 rounded-full ${
                !r ? "bg-secondary" : r.falseStart ? "bg-destructive" : "bg-primary"
              }`}
            />
          );
        })}
      </div>
    </main>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
