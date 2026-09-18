import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { sfx } from "@/lib/duel/audio";
import {
  MAX_NOTES,
  createChart,
  simulateOpponentSurvival,
} from "@/lib/duel/engine/rhythm";

export const Route = createFileRoute("/play/rhythm")({
  head: () => ({
    meta: [
      { title: "Rhythm duel — DUEL" },
      {
        name: "description",
        content:
          "Two lanes, one life. Hit every note of a seed-generated track that keeps getting faster — the first duellist to miss loses.",
      },
      { property: "og:title", content: "Rhythm duel — DUEL" },
      {
        property: "og:description",
        content: "Sudden-death two-button rhythm duel with a unique track every match.",
      },
    ],
  }),
  component: RhythmGame,
});

type Phase = "ready" | "playing" | "over";

const LANE_HEIGHT = 420;
const HIT_LINE = 60; // px from the bottom of the lane area

function RhythmGame() {
  const navigate = useNavigate();
  const { activeMatch, finishRhythmMatch, ready } = useDuel();

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  const seed = activeMatch?.seed ?? 1;
  const notes = useMemo(() => createChart(seed), [seed]);
  const opponentOut = useMemo(
    () => (activeMatch ? simulateOpponentSurvival(seed, activeMatch.opponent) : MAX_NOTES),
    [seed, activeMatch],
  );

  const startAt = useRef(0);
  const nextIndex = useRef(0);
  const soundedIndex = useRef(0);
  const offsets = useRef<number[]>([]);
  const finished = useRef(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (ready && !activeMatch) navigate({ to: "/" });
  }, [ready, activeMatch, navigate]);

  const end = (playerNotes: number) => {
    if (finished.current) return;
    finished.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    setPhase("over");
    sfx.miss();
    const outcome = finishRhythmMatch({
      playerNotes,
      opponentNotes: opponentOut,
      offsets: offsets.current,
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

  // Main loop
  useEffect(() => {
    if (!activeMatch) return;
    const kickoff = setTimeout(() => {
      setPhase("playing");
      startAt.current = performance.now();

      const tick = () => {
        const t = performance.now() - startAt.current;
        setElapsed(t);

        // The chart is the music: each note sounds as it crosses the line.
        while (soundedIndex.current < notes.length && notes[soundedIndex.current]!.timeMs <= t) {
          sfx.note(notes[soundedIndex.current]!.freq);
          soundedIndex.current += 1;
        }

        const pending = notes[nextIndex.current];
        if (!pending) {
          end(notes.length);
          return;
        }
        if (t > pending.timeMs + pending.windowMs) {
          end(nextIndex.current);
          return;
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, 1200);

    return () => {
      clearTimeout(kickoff);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatch]);

  const tapLane = (lane: number) => {
    if (phase !== "playing" || finished.current) return;
    const t = performance.now() - startAt.current;
    const note = notes[nextIndex.current];
    if (!note) return;
    const diff = note.timeMs - t;
    // Taps ahead of the note are simply ignored — only wrong-lane or
    // fully-missed notes end the run.
    if (diff > note.windowMs) return;
    if (note.lane === lane) {
      offsets.current.push(Math.round(Math.abs(diff)));
      nextIndex.current += 1;
      setHits((h) => h + 1);
      setFlash("hit");
      setTimeout(() => setFlash(null), 90);
      return;
    }
    setFlash("miss");
    end(nextIndex.current);
  };

  if (!activeMatch) return null;

  const level = notes[Math.min(nextIndex.current, notes.length - 1)]!.level;
  const opponentAlive = hits < opponentOut && !(phase === "over" && hits >= opponentOut);
  const opponentNoteCount = Math.min(hits, opponentOut);

  const visible = notes.filter((n) => {
    const remaining = n.timeMs - elapsed;
    return remaining <= n.approachMs && remaining > -n.windowMs && n.index >= nextIndex.current;
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="grid grid-cols-3 gap-2 px-5 pt-6 text-center">
        <Meter label="Notes" value={`${hits}`} />
        <Meter label="Level" value={`${level + 1}`} />
        <Meter
          label="Opponent"
          value={opponentAlive ? `${opponentNoteCount}` : `OUT ${opponentOut}`}
        />
      </header>

      <div className="flex items-center justify-between px-5 pt-3 text-xs text-muted-foreground">
        <span className="truncate">vs {activeMatch.opponent.username}</span>
        <span className="tabular-nums">track #{seed.toString(36).slice(-6)}</span>
      </div>

      <section
        className={`relative mx-5 mt-3 flex-1 overflow-hidden rounded-3xl border bg-card ${
          flash === "miss" ? "animate-shake border-destructive" : "border-border"
        }`}
        style={{ minHeight: LANE_HEIGHT }}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className="absolute inset-x-0 h-1 bg-primary/70"
          style={{ bottom: HIT_LINE }}
        />

        {phase === "playing" &&
          visible.map((n) => {
            const progress = 1 - (n.timeMs - elapsed) / n.approachMs;
            const bottom = LANE_HEIGHT - progress * (LANE_HEIGHT - HIT_LINE) - HIT_LINE;
            return (
              <span
                key={n.index}
                className="absolute h-8 w-[38%] rounded-xl bg-primary shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                style={{
                  bottom: `${Math.max(bottom, HIT_LINE - 16)}px`,
                  left: n.lane === 0 ? "6%" : "56%",
                }}
              />
            );
          })}

        {phase === "ready" && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-3xl font-bold tracking-[0.3em] text-primary">
                GET READY
              </p>
              <p className="mt-2 px-8 text-sm text-muted-foreground">
                One life. Hit every note — the track speeds up as you go.
              </p>
            </div>
          </div>
        )}

        {phase === "over" && (
          <div className="absolute inset-0 grid place-items-center bg-background/85 text-center">
            <div>
              <p className="font-display text-3xl font-bold tracking-[0.25em] text-destructive">
                MISSED
              </p>
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                {hits} notes · opponent {opponentOut}
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 px-5 pb-8 pt-4">
        {[0, 1].map((lane) => (
          <button
            key={lane}
            type="button"
            aria-label={lane === 0 ? "Left note" : "Right note"}
            onPointerDown={() => tapLane(lane)}
            className="select-none rounded-2xl border border-border bg-secondary py-7 font-display text-2xl font-bold tracking-[0.2em] text-foreground transition-transform duration-75 active:scale-95 active:bg-primary active:text-primary-foreground"
          >
            {lane === 0 ? "◀" : "▶"}
          </button>
        ))}
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
