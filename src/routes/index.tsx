import { createFileRoute, Link } from "@tanstack/react-router";
import { Screen, StatTile } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import { formatEuro } from "@/lib/duel/economy";
import { winRate } from "@/lib/duel/player";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DUEL — 1v1 Arcade Duels for Demo Balance" },
      {
        name: "description",
        content:
          "Challenge opponents in lightning-fast 1v1 reaction duels. Stake Demo Balance, climb the rating ladder. Play money only.",
      },
      { property: "og:title", content: "DUEL — 1v1 Arcade Duels" },
      {
        property: "og:description",
        content: "Lightning-fast 1v1 reaction duels with play-money Demo Balance.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { profile, history, muted, toggleMuted, canPlay } = useDuel();

  return (
    <Screen>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold tracking-[0.35em] text-primary text-glow">
            DUEL
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            1v1 arcade · play money
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-lg"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      <section className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 neon-glow">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Demo Balance
          </p>
          <p className="font-display text-3xl font-bold tabular-nums text-primary">
            {formatEuro(profile.coins)}
          </p>
        </div>
        <Link
          to="/profile"
          className="flex shrink-0 items-center gap-3 rounded-xl bg-secondary px-3 py-2"
        >
          <span className="text-2xl">{profile.avatar}</span>
          <span className="min-w-0">
            <span className="block max-w-[7rem] truncate text-sm font-semibold">
              {profile.username}
            </span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {profile.rating} MMR
            </span>
          </span>
        </Link>
      </section>

      <Link
        to="/games"
        className="mt-6 grid place-items-center rounded-3xl bg-primary py-8 font-display text-3xl font-bold tracking-[0.35em] text-primary-foreground transition-transform duration-150 active:scale-[0.97] neon-glow aria-disabled:opacity-40"
        aria-disabled={!canPlay}
      >
        PLAY
        <span className="mt-1 text-[11px] font-semibold tracking-[0.2em] opacity-80">
          CHOOSE YOUR STAKE
        </span>
      </Link>
      {!canPlay && (
        <p className="mt-3 text-center text-xs text-destructive">
          Not enough balance for the selected stake — reset your demo progress in Profile.
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        <StatTile label="Rating" value={profile.rating} accent="primary" />
        <StatTile label="Win rate" value={`${winRate(profile)}%`} accent="accent" />
        <StatTile label="Matches" value={profile.gamesPlayed} />
        <StatTile
          label="Best reaction"
          value={profile.bestReactionMs ? `${profile.bestReactionMs} ms` : "—"}
        />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to="/leaderboard"
          className="rounded-2xl border border-border bg-card px-4 py-4 text-center font-display text-sm font-bold tracking-[0.2em]"
        >
          🏆 RANKS
        </Link>
        <Link
          to="/profile"
          className="rounded-2xl border border-border bg-card px-4 py-4 text-center font-display text-sm font-bold tracking-[0.2em]"
        >
          👤 PROFILE
        </Link>
      </section>

      <section className="mt-7">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Recent matches
        </h2>
        <ul className="mt-3 space-y-2">
          {history.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No duels yet. Hit PLAY to start your record.
            </li>
          )}
          {history.slice(0, 5).map((m) => (
            <li
              key={m.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="text-xl">{m.opponentAvatar}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{m.opponentName}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {m.playerAvgMs} ms vs {m.opponentAvgMs} ms
                </span>
              </span>
              <span
                className={`shrink-0 text-right font-display text-sm font-bold tabular-nums ${
                  m.won ? "text-primary" : "text-destructive"
                }`}
              >
                {m.won ? "WIN" : "LOSS"}
                <span className="block text-[11px] font-medium">
                  {formatEuro(m.coinDelta, true)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
