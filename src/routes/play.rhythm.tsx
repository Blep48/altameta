import { submitIfFriend } from "@/lib/duel/friend-match";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { sfx, startMusic } from "@/lib/duel/audio";
import { OpponentOutBanner } from "@/components/duel/OpponentOutBanner";
import { MatchBalance } from "@/components/duel/MatchBalance";
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

const HIT_LINE = 44; // px from the bottom of the lane area
const NOTE_HEIGHT = 32;

function RhythmGame() {
  useEffect(() => startMusic("rhythm"), []);
  const navigate = useNavigate();
  const { activeMatch, finishRhythmMatch, ready, profile, wagerEur } = useDuel();

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
  const offsets = useRef<number[]>([]);
  const finished = useRef(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (ready && !activeMatch && !finished.current) navigate({ to: "/" });
  }, [ready, activeMatch, navigate]);

  const end = (playerNotes: number) => {
    if (finished.current) return;
    finished.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    setPhase("over");
    sfx.miss();
    if(activeMatch?.friend){void submitIfFriend(activeMatch,playerNotes).then(()=>navigate({to:"/challenge/$code",params:{code:activeMatch.friend!.code}}));return;}
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
    if (Math.abs(diff) > note.windowMs || note.lane !== lane) {
      setFlash("miss");
      end(nextIndex.current);
      return;
    }
    if (note.lane === lane) {
      sfx.note(note.freq);
      offsets.current.push(Math.round(Math.abs(diff)));
      nextIndex.current += 1;
      setHits((h) => h + 1);
      setFlash("hit");
      setTimeout(() => setFlash(null), 90);
      return;
    }
  };

  if (!activeMatch) return null;

  const level = notes[Math.min(nextIndex.current, notes.length - 1)]!.level;
  const opponentOutMs = opponentOut < notes.length ? notes[opponentOut]!.timeMs + notes[opponentOut]!.windowMs : notes[notes.length - 1]!.timeMs;
  const opponentAlive = hits < opponentOut && !(phase === "over" && hits >= opponentOut);
  const opponentNoteCount = Math.min(hits, opponentOut);

  const visible = notes.filter((n) => {
    const remaining = n.timeMs - elapsed;
    return remaining <= n.approachMs && remaining > -n.windowMs && n.index >= nextIndex.current;
  });

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden overscroll-none bg-background">
      <div className="shrink-0 px-5 pt-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">How to play</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tap the left or right lane when each note reaches the line. One wrong lane or missed note ends your run.</p>
      </div>
      <MatchBalance coins={profile.coins} wagerEur={wagerEur} />
      <header className="grid shrink-0 grid-cols-3 gap-2 px-5 pt-2 text-center">
        <Meter label="Notes" value={`${hits}`} />
        <Meter label="Level" value={`${level + 1}`} />
        <Meter
          label="Opponent"
          value={opponentAlive ? `${opponentNoteCount}` : `OUT ${opponentOut}`}
        />
      </header>

      <div className="flex shrink-0 items-center justify-between px-5 pt-2 text-xs text-muted-foreground">
        <span className="truncate">vs {activeMatch.opponent.username}</span>
        <span className="tabular-nums">track #{seed.toString(36).slice(-6)}</span>
      </div>

      <section
        className={`relative mx-5 mt-2 min-h-0 flex-1 overflow-hidden rounded-3xl border bg-card ${
          flash === "miss" ? "animate-shake border-destructive" : "border-border"
        }`}
      >
        <OpponentOutBanner opponentName={activeMatch.opponent.username} opponentScore={opponentOut} playerScore={hits} wagerEur={wagerEur} outAfterMs={1200 + opponentOutMs} label="notes" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className="absolute inset-x-0 h-1 bg-primary/70"
          style={{ bottom: HIT_LINE }}
        />

        {phase === "playing" &&
          visible.map((n) => {
            const progress = 1 - (n.timeMs - elapsed) / n.approachMs;
            const travel = `calc((100% - ${HIT_LINE}px - ${NOTE_HEIGHT / 2}px) * ${Math.max(0, 1 - progress)})`;
            const bottom = `calc(${HIT_LINE}px - ${NOTE_HEIGHT / 2}px + ${travel})`;
            return (
              <span
                key={n.index}
                className="absolute h-8 w-[38%] rounded-xl bg-primary shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                style={{
                  bottom,
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

      <div className="grid shrink-0 grid-cols-2 gap-3 px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {[0, 1].map((lane) => (
          <button
            key={lane}
            type="button"
            aria-label={lane === 0 ? "Left note" : "Right note"}
            onPointerDown={() => tapLane(lane)}
            className="select-none rounded-2xl border border-border bg-secondary py-[clamp(0.7rem,2.8vh,1.75rem)] font-display text-2xl font-bold tracking-[0.2em] text-foreground transition-transform duration-75 active:scale-95 active:bg-primary active:text-primary-foreground"
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
