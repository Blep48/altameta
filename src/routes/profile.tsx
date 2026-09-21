import { createFileRoute } from "@tanstack/react-router";
import { Screen, StatTile, TopBar } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import { AVATARS, winRate } from "@/lib/duel/player";
import { formatEuro } from "@/lib/duel/economy";
import { leagueForIndex, peakLeagueIndex } from "@/lib/duel/leagues";
import { useAccount } from "@/components/duel/AccountGate";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your duelist profile — DUEL" },
      {
        name: "description",
        content:
          "Your DUEL rating, record, best reaction time and Duel Coin balance.",
      },
      { property: "og:title", content: "Your duelist profile — DUEL" },
      {
        property: "og:description",
        content: "Rating, record and best reaction time.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const login = useAccount();
  const { profile, history, updateProfile, resetProgress } = useDuel();
  const scores = highScores(profile.highscores ?? {}, history);

  return (
    <Screen>
      <TopBar title="PROFILE" back="/" />

      <section className="rounded-3xl border border-border bg-card px-5 py-6 text-center">
        <span className="text-5xl">{profile.avatar}</span>
        <input
          readOnly={!!login}
          value={profile.username}
          maxLength={16}
          onChange={(e) =>
            updateProfile({ username: e.target.value.toUpperCase() })
          }
          aria-label="Username"
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-center font-display text-lg font-bold tracking-[0.2em] outline-none focus:border-primary"
        />
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[.22em] text-accent">
          {leagueForIndex(
            peakLeagueIndex(profile.rating, profile.peakLeagueIndex),
          )}
        </p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums text-primary">
          {profile.rating} <span className="text-sm tracking-[0.2em]">MMR</span>
        </p>
      </section>

      <section className="mt-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Avatar
        </h2>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => updateProfile({ avatar: a })}
              aria-label={`Choose avatar ${a}`}
              className={`grid h-12 place-items-center rounded-xl border text-2xl transition-transform active:scale-95 ${
                profile.avatar === a
                  ? "border-primary bg-primary/15"
                  : "border-border bg-card"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <StatTile
          label="Balance"
          value={formatEuro(profile.coins)}
          accent="primary"
        />
        <StatTile
          label="Win rate"
          value={`${winRate(profile)}%`}
          accent="accent"
        />
        <StatTile label="Games played" value={profile.gamesPlayed} />
        <StatTile label="Wins" value={profile.wins} accent="primary" />
        <StatTile label="Losses" value={profile.losses} accent="destructive" />
      </section>

      <section className="mt-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Highscores
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {scores.map((s) => (
            <StatTile key={s.id} label={s.name} value={s.value} />
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          if (
            confirm(
              "Reset profile, stats and balance to a a fresh €100.00 demo balance?",
            )
          ) {
            resetProgress();
          }
        }}
        className="mt-8 rounded-2xl border border-destructive/50 py-3 text-sm font-semibold text-destructive"
      >
        Reset demo progress
      </button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Demo balance only. No deposits, withdrawals or real-money transactions
        are enabled.
      </p>
      {login && (
        <button
          type="button"
          onClick={() => void login.logout()}
          className="mt-5 rounded-xl border border-border p-3"
        >
          LOG OUT · {login.username}
        </button>
      )}
    </Screen>
  );
}

function highScores(
  saved: Record<string, number>,
  history: ReturnType<typeof useDuel>["history"],
) {
  const defs = [
    ["reaction", "REACTION"],
    ["rhythm", "RHYTHM"],
    ["direction", "DIRECTION"],
    ["memory", "MONKEY TEST"],
    ["flappy", "FLAPPY"],
    ["dash", "DINO RUN"],
    ["stack", "STACK"],
    ["knife", "KNIFE IT"],
    ["precision", "PRECISION"],
  ] as const;
  return defs.map(([id, name]) => {
    const rows = history.filter((h) => h.gameId === id);
    const stored = saved[id];
    if (stored != null)
      return {
        id,
        name,
        value:
          id === "reaction"
            ? `${Math.round(stored)} ms`
            : String(Math.round(stored)),
      };
    if (!rows.length) return { id, name, value: "—" };
    if (id === "reaction") {
      const v = Math.min(...rows.map((r) => r.playerAvgMs));
      return { id, name, value: `${Math.round(v)} ms` };
    }
    const v = Math.max(
      ...rows.map(
        (r) =>
          r.survival?.playerScore ??
          r.rhythm?.playerNotes ??
          r.direction?.playerArrows ??
          r.monkey?.playerLevels ??
          r.precision?.playerPoints ??
          r.playerAvgMs,
      ),
    );
    return { id, name, value: String(Math.round(v)) };
  });
}
