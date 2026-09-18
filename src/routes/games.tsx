import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Screen, TopBar } from "@/components/duel/Screen";
import { MINIGAMES } from "@/lib/duel/games";
import { useDuel } from "@/lib/duel/provider";
import { formatEuro, WAGER_OPTIONS_EUR } from "@/lib/duel/economy";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Choose your minigame — DUEL" },
      {
        name: "description",
        content: "Pick a DUEL minigame: Reaction is live, Rhythm, Direction, Memory and Precision are next.",
      },
      { property: "og:title", content: "Choose your minigame — DUEL" },
      { property: "og:description", content: "Reaction duels are live. More minigames coming soon." },
    ],
  }),
  component: GameSelection,
});

function GameSelection() {
  const navigate = useNavigate();
  const { profile, canPlay, wagerEur, setWagerEur } = useDuel();

  return (
    <Screen>
      <TopBar title="SELECT GAME" back="/" />
      <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Balance {formatEuro(profile.coins)}
      </p>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Choose stake
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {WAGER_OPTIONS_EUR.map((amount) => {
            const affordable = profile.coins >= amount * 100;
            return (
              <button
                key={amount}
                type="button"
                disabled={!affordable}
                onClick={() => setWagerEur(amount)}
                className={`rounded-xl border px-2 py-3 font-display text-sm font-bold tabular-nums transition-transform active:scale-95 disabled:opacity-30 ${
                  wagerEur === amount
                    ? "border-primary bg-primary/15 text-primary neon-glow"
                    : "border-border bg-background text-foreground"
                }`}
              >
                €{amount}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Selected stake <span className="font-semibold text-primary">€{wagerEur}</span>
        </p>
      </section>

      <ul className="mt-6 space-y-3">
        {MINIGAMES.map((g, i) => (
          <li key={g.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <button
              type="button"
              disabled={!g.available || !canPlay}
              onClick={() => navigate({ to: "/match", search: { game: g.id } })}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card px-4 py-5 text-left transition-transform duration-150 active:scale-[0.98] disabled:opacity-45"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                {g.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold tracking-[0.18em]">
                  {g.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{g.tagline}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                  g.available
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {g.available ? "Play" : "Soon"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
