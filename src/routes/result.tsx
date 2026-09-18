import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Screen } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import { formatEuro } from "@/lib/duel/economy";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Match result — DUEL" },
      { name: "description", content: "See how your reaction times stacked up against your opponent." },
      { property: "og:title", content: "Match result — DUEL" },
      { property: "og:description", content: "Reaction duel results, coin and rating changes." },
    ],
  }),
  component: Result,
});

function Result() {
  const { lastOutcome, profile, ready, canPlay } = useDuel();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !lastOutcome) navigate({ to: "/" });
  }, [ready, lastOutcome, navigate]);

  if (!lastOutcome) return null;
  const won = lastOutcome.won;
  const rhythm = lastOutcome.rhythm;
  const precision = lastOutcome.precision;

  return (
    <Screen>
      <div
        className={`animate-pop rounded-3xl border px-5 py-6 text-center ${
          won ? "border-primary bg-primary/10 neon-glow" : "border-destructive bg-destructive/10"
        }`}
      >
        <h1
          className={`font-display text-4xl font-bold tracking-[0.3em] ${
            won ? "text-primary text-glow" : "text-destructive"
          }`}
        >
          {won ? "VICTORY" : "DEFEAT"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {won ? "Faster hands win duels." : "Too slow this time."}
        </p>
      </div>

      <section className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side
          avatar={profile.avatar}
          name="YOU"
          value={
            precision
              ? `${precision.playerPoints}`
              : rhythm
                ? `${rhythm.playerNotes}`
                : `${lastOutcome.playerAvgMs} ms`
          }
          highlight={won}
        />
        <span className="font-display text-xl font-bold text-accent">VS</span>
        <Side
          avatar={lastOutcome.opponentAvatar}
          name={lastOutcome.opponentName}
          value={
            precision
              ? `${precision.opponentPoints}`
              : rhythm
                ? `${rhythm.opponentNotes}`
                : `${lastOutcome.opponentAvgMs} ms`
          }
          highlight={!won}
        />
      </section>
      {(rhythm || precision) && (
        <p className="mt-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {precision ? "Points scored" : "Notes survived"}
        </p>
      )}


      <section className="mt-6 grid grid-cols-2 gap-3">
        <Delta
          label={`Stake €${lastOutcome.wagerEur}`}
          value={formatEuro(lastOutcome.coinDelta, true)}
          positive={won}
        />
        <Delta
          label="Rating"
          value={`${lastOutcome.ratingDelta > 0 ? "+" : ""}${lastOutcome.ratingDelta}`}
          positive={won}
        />
      </section>

      <p className="mt-3 text-center text-xs text-muted-foreground tabular-nums">
        Balance {formatEuro(profile.coins)} · Rating {profile.rating}
        {precision
          ? ` · ${precision.playerStops} stops · ${precision.perfects} perfect · Opponent ${precision.opponentStops} stops`
          : rhythm
            ? ` · Avg timing ${rhythm.avgOffsetMs} ms · Track #${rhythm.seed.toString(36).slice(-6)}`
            : ` · Best round ${lastOutcome.playerBestMs} ms`}
        {!rhythm &&
          !precision &&
          lastOutcome.falseStarts > 0 &&
          ` · ${lastOutcome.falseStarts} false start(s)`}
      </p>

      {!rhythm && !precision && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Round breakdown
          </h2>
          <ul className="mt-3 space-y-2">
            {lastOutcome.rounds.map((r) => (
              <li
                key={r.round}
                className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm tabular-nums"
              >
                <span className="text-muted-foreground">R{r.round}</span>
                <span className={r.falseStart ? "text-destructive" : "text-primary"}>
                  {r.falseStart ? "FALSE START" : `${r.playerMs} ms`}
                </span>
                <span className="text-right text-muted-foreground">{r.opponentMs} ms</span>
              </li>
            ))}
          </ul>
        </section>
      )}


      <div className="mt-8 space-y-3">
        <Link
          to="/games"
          className={`block rounded-2xl bg-primary py-5 text-center font-display text-xl font-bold tracking-[0.25em] text-primary-foreground ${
            canPlay ? "" : "pointer-events-none opacity-40"
          }`}
        >
          REMATCH
        </Link>
        <Link
          to="/"
          className="block rounded-2xl border border-border bg-card py-4 text-center font-display text-sm font-bold tracking-[0.25em]"
        >
          BACK TO HOME
        </Link>
      </div>
    </Screen>
  );
}

function Side({
  avatar,
  name,
  value,
  highlight,
}: {
  avatar: string;
  name: string;
  value: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border px-3 py-5 text-center ${
        highlight ? "border-primary bg-card" : "border-border bg-card"
      }`}
    >
      <span className="text-3xl">{avatar}</span>
      <span className="mt-1 block truncate text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {name}
      </span>
      <span
        className={`mt-1 block font-display text-2xl font-bold tabular-nums ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Delta({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-display text-2xl font-bold tabular-nums ${
          positive ? "text-primary" : "text-destructive"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
